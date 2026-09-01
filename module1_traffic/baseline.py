"""
Adaptive baseline for Module 1 anomaly scoring.

Implements the warm-up and freeze rules from
SIH26153_Predictive_Cyber_Defense_Design_Document.md §5.1:

  * Warm-up  -- the first BASELINE_WARMUP_WINDOWS windows seed the
    baseline; anomaly scores are still emitted but flagged not-ready
    (`baseline_ready: false`) so downstream consumers can suppress
    forecasts until then.
  * Freeze   -- once the network looks anomalous enough, the baseline
    stops adapting so it can't "learn the attack as normal" (the
    failure mode the design doc calls out as defeating the whole
    premise of the project). Adaptation resumes only after 5
    consecutive quiet windows.

Design-doc gap this resolves
-----------------------------
The design doc's freeze rule is keyed on `threat_score`, but
threat_score is Module 2's output -- and Module 1 must run standalone
("every module must run standalone against shared/sample_data.json
without any other module being finished", §5). Making Module 1 depend
on Module 2's output to decide whether to freeze would be a circular
dependency between the two modules.

Instead, this class computes a local composite indicator from its own
four anomaly channels, using the same weights Module 2 uses for
syn/traffic/source/connection (renormalized to sum to 1, since Module
1 has no temporal_acceleration term to contribute), and freezes
against that. This indicator is an internal implementation detail --
it approximates but is not identical to the real threat_score Module 2
will compute (which also folds in acceleration), and it is never
exposed on Module 1's output contract.
"""

import math
import numpy as np

from shared import config

_UNFREEZE_QUIET_WINDOWS = 5
_EWMA_ALPHA = 0.05
_Z_CAP = 6.0  # anomaly saturates at 6 standard deviations from baseline

# Renormalized weights -- see module docstring above.
_RAW_WEIGHTS = {
    "syn": config.WEIGHT_SYN,
    "traffic": config.WEIGHT_TRAFFIC,
    "source": config.WEIGHT_SOURCE,
    "connection": config.WEIGHT_CONNECTION,
}
_WEIGHT_TOTAL = sum(_RAW_WEIGHTS.values())
_INDICATOR_WEIGHTS = {k: v / _WEIGHT_TOTAL for k, v in _RAW_WEIGHTS.items()}


def _clamp01(x):
    return max(0.0, min(1.0, x))


class BayesianChangepointDetector:
    """
    Online Bayesian Changepoint Detection for adaptive network baseline drift.
    Distinguishes legitimate traffic spikes from malicious kill-chain trajectory shifts.
    (See curr.txt §4.2)
    """

    def __init__(self, hazard_rate: float = 1 / 100.0, mean_prior: float = 100.0, var_prior: float = 20.0):
        self.hazard = hazard_rate
        self.mean_prior = mean_prior
        self.var_prior = var_prior
        self.R = np.array([1.0])  # Run length distribution
        self.means = np.array([mean_prior])
        self.vars = np.array([var_prior])

    def update(self, x_t: float) -> float:
        """
        Ingests new window observation x_t, returns probability of changepoint P(r_t = 0).
        """
        # Limit memory footprint of run-length distribution to 100 states
        if len(self.R) > 100:
            self.R = self.R[:100]
            self.means = self.means[:100]
            self.vars = self.vars[:100]
            self.R /= np.sum(self.R)

        # 1. Predictive probability under Gaussian prior
        epsilon = 1e-6
        safe_vars = np.maximum(self.vars, epsilon)
        pred_probs = 1.0 / np.sqrt(2 * np.pi * safe_vars) * np.exp(-0.5 * ((x_t - self.means) ** 2) / safe_vars)
        pred_probs = np.maximum(pred_probs, 1e-12)

        # 2. Growth and changepoint probabilities
        growth_probs = self.R * pred_probs * (1.0 - self.hazard)
        cp_prob = np.sum(self.R * pred_probs * self.hazard)

        # 3. Update run length distribution
        self.R = np.append([cp_prob], growth_probs)
        total_mass = np.sum(self.R)
        if total_mass > 0:
            self.R /= total_mass
        else:
            self.R = np.array([1.0])

        # 4. Update sufficient statistics
        self.means = np.append([self.mean_prior], (self.means * self.vars + x_t) / (self.vars + 1))
        self.vars = np.append([self.var_prior], self.vars / (self.vars + 1))

        return float(self.R[0])


class _ChannelStat:
    """Exponentially-weighted mean/variance for one raw signal."""

    __slots__ = ("mean", "var", "initialized")

    def __init__(self):
        self.mean = 0.0
        self.var = 0.0
        self.initialized = False

    def z_score(self, value):
        if not self.initialized:
            return 0.0
        std = math.sqrt(self.var)
        std = max(std, abs(self.mean) * 0.01, 1e-6)
        return (value - self.mean) / std

    def observe(self, value, alpha=_EWMA_ALPHA):
        if not self.initialized:
            self.mean = value
            self.var = 0.0
            self.initialized = True
            return
        delta = value - self.mean
        self.mean += alpha * delta
        self.var = (1 - alpha) * (self.var + alpha * delta * delta)


class AdaptiveBaseline:
    """Stateful per-channel baseline. One instance per network/tenant;
    reuse it across consecutive windows so it can actually adapt."""

    def __init__(self):
        self._stats = {
            "pps": _ChannelStat(),
            "bps": _ChannelStat(),
            "syn_rate": _ChannelStat(),
            "unique_source_ips": _ChannelStat(),
            "failed_connections": _ChannelStat(),
        }
        self._windows_seen = 0
        self._frozen = False
        self._quiet_streak = 0
        self.bocpd = BayesianChangepointDetector()

    @property
    def windows_seen(self):
        return self._windows_seen

    @property
    def is_frozen(self):
        return self._frozen

    def update(self, packets_per_second, bytes_per_second, syn_rate,
               unique_source_ips, failed_connections):
        """Score one window's raw feature values against the current
        baseline, then (unless frozen) fold them into it.

        Returns (anomalies: dict[str, float] in [0,1], baseline_ready: bool, changepoint_prob: float).
        """
        stats = self._stats

        z_pps = stats["pps"].z_score(packets_per_second)
        z_bps = stats["bps"].z_score(bytes_per_second)
        z_syn = stats["syn_rate"].z_score(syn_rate)
        z_source = stats["unique_source_ips"].z_score(unique_source_ips)
        z_conn = stats["failed_connections"].z_score(failed_connections)

        anomalies = {
            "traffic": _clamp01(max(z_pps, z_bps) / _Z_CAP),
            "syn": _clamp01(z_syn / _Z_CAP),
            "source": _clamp01(z_source / _Z_CAP),
            "connection": _clamp01(z_conn / _Z_CAP),
        }

        indicator = sum(
            _INDICATOR_WEIGHTS[k] * anomalies[k] for k in _INDICATOR_WEIGHTS
        )

        cp_prob = self.bocpd.update(packets_per_second)

        still_warming_up = self._windows_seen < config.BASELINE_WARMUP_WINDOWS

        if still_warming_up:
            self._frozen = False
            self._quiet_streak = 0
        elif indicator > config.BASELINE_FREEZE_THRESHOLD:
            self._frozen = True
            self._quiet_streak = 0
        elif self._frozen:
            self._quiet_streak += 1
            if self._quiet_streak >= _UNFREEZE_QUIET_WINDOWS:
                self._frozen = False
                self._quiet_streak = 0

        if not self._frozen:
            stats["pps"].observe(packets_per_second)
            stats["bps"].observe(bytes_per_second)
            stats["syn_rate"].observe(syn_rate)
            stats["unique_source_ips"].observe(unique_source_ips)
            stats["failed_connections"].observe(failed_connections)

        self._windows_seen += 1
        baseline_ready = self._windows_seen > config.BASELINE_WARMUP_WINDOWS

        return anomalies, baseline_ready, cp_prob

