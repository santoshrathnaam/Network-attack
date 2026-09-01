"""
Module 1 -- Traffic Intelligence.

Converts raw flow records into the normalized feature + anomaly
contract defined in SIH26153_Predictive_Cyber_Defense_Design_Document.md
§5.1 / §7.1.

Raw flow record format (one dict per packet/flow observed in a window):

    {
        "src_ip": str,
        "dst_ip": str,
        "dst_port": int,
        "protocol": "TCP" | "UDP",
        "tcp_flag": "SYN" | "SYN-ACK" | "ACK" | "RST" | "FIN" | None,
        "packet_size": int,           # bytes
        "connection_failed": bool,    # RST/timeout on a tracked connection
    }

This shape isn't mandated by the design doc (which deliberately leaves
"PCAP-derived flow data / NetFlow-like CSV / synthetic" open); it's
the concrete shape this prototype's generator, and any real ingester
swapped in later, must produce.
"""

import math
from collections import Counter
from datetime import datetime, timezone

from shared import config

from .baseline import AdaptiveBaseline

# Protocol number → name for diversity scoring
_PROTO_NAMES = {6: "TCP", 17: "UDP", 1: "ICMP"}

# Module-level singleton so `process_traffic(records)` -- the exact
# single-argument signature required by the design doc -- still
# accumulates history across calls by default. Pass an explicit
# `baseline=` for tests or multi-tenant use.
_default_baseline = AdaptiveBaseline()


def reset_default_baseline():
    """Replace the module-level default baseline with a fresh one.

    Nothing in this repo relies on the default baseline today -- every
    call site here and in tests passes its own `baseline=` explicitly.
    But it's process-lifetime global state, and the first test anyone
    writes that calls process_traffic(records) without a baseline=
    would silently inherit history from every earlier call in the same
    test run. Call this in a test's setUp()/tearDown() if that ever
    happens.
    """
    global _default_baseline
    _default_baseline = AdaptiveBaseline()


def _shannon_entropy_bits(counts):
    total = sum(counts)
    if total == 0:
        return 0.0
    entropy = 0.0
    for c in counts:
        if c == 0:
            continue
        p = c / total
        entropy -= p * math.log2(p)
    return entropy


def _dns_amplification_ratio(records) -> float:
    """Ratio of DNS response bytes to DNS request bytes (UDP port 53).
    A value > 10 indicates amplification abuse. Returns 0.0 if no DNS traffic."""
    req_bytes = sum(r["packet_size"] for r in records if r.get("dst_port") == 53 and r.get("protocol") == "UDP")
    resp_bytes = sum(r["packet_size"] for r in records if r.get("dst_port") != 53 and r.get("protocol") == "UDP" and r.get("packet_size", 0) > 200)
    if req_bytes == 0:
        return 0.0
    return round(resp_bytes / req_bytes, 4)


def _packet_size_entropy(records) -> float:
    """Shannon entropy over discretized packet sizes (64-byte buckets).
    Mimics JA3/JA4 TLS fingerprint entropy without requiring decryption."""
    if not records:
        return 0.0
    buckets = Counter(r["packet_size"] // 64 for r in records)
    return round(_shannon_entropy_bits(buckets.values()), 4)


def extract_window_features(records, window_seconds=None):
    """Aggregate one window's worth of flow records into the `features`
    block of the Module 1 output contract. Pure function, no state.

    window_seconds resolves against config.WINDOW_SECONDS at CALL time,
    not import time -- a plain `window_seconds=config.WINDOW_SECONDS`
    default would bake the value in when this module first loads, so
    changing the config afterwards (e.g. a faster demo speed) would be
    silently ignored.
    """
    if window_seconds is None:
        window_seconds = config.WINDOW_SECONDS
    n = len(records)
    if n == 0:
        return {
            "packets_per_second": 0.0,
            "bytes_per_second": 0.0,
            "avg_packet_size": 0.0,
            "unique_source_ips": 0,
            "unique_destination_ips": 0,
            "syn_rate": 0.0,
            "failed_connections": 0,
            "connection_rate": 0.0,
            "port_entropy": 0.0,
            "dns_amplification_ratio": 0.0,
            "packet_size_entropy": 0.0,
            "protocol_diversity": 0.0,
        }

    total_bytes = sum(r["packet_size"] for r in records)
    src_ips = {r["src_ip"] for r in records}
    dst_ips = {r["dst_ip"] for r in records}
    tcp_records = [r for r in records if r["protocol"] == "TCP"]
    syn_records = [r for r in tcp_records if r["tcp_flag"] == "SYN"]
    failed = sum(1 for r in records if r["connection_failed"])
    port_counts = Counter(r["dst_port"] for r in records)

    # syn_rate is a RATIO (SYN packets / TCP packets), not a throughput --
    # see design doc §5.1's note on avoiding "SYN rate" as a label.
    syn_rate = (len(syn_records) / len(tcp_records)) if tcp_records else 0.0

    pps = round(n / window_seconds, 4)
    bps = round(total_bytes / window_seconds, 4)
    avg_size = round(bps / pps, 4) if pps > 0 else 0.0

    # Protocol diversity: Shannon entropy across TCP/UDP/ICMP/other counts
    proto_counts = Counter(r.get("protocol", "OTHER") for r in records)
    protocol_diversity = round(_shannon_entropy_bits(proto_counts.values()), 4)

    return {
        "packets_per_second": pps,
        "bytes_per_second": bps,
        "avg_packet_size": avg_size,
        "unique_source_ips": len(src_ips),
        "unique_destination_ips": len(dst_ips),
        "syn_rate": round(syn_rate, 4),
        "failed_connections": failed,
        "connection_rate": round(len(syn_records) / window_seconds, 4),
        "port_entropy": round(_shannon_entropy_bits(port_counts.values()), 4),
        # §2.1 Advanced protocol analytics (Improvements MD)
        "dns_amplification_ratio": _dns_amplification_ratio(records),
        "packet_size_entropy": _packet_size_entropy(records),
        "protocol_diversity": protocol_diversity,
    }


def process_traffic(records, baseline=None, timestamp=None, window_seconds=None):
    """
    Required Module 1 entry point (design doc §5.1):

        window = process_traffic(raw_data)

    records:        list of flow-record dicts covering exactly one
                     window (see module docstring for the record shape).
    baseline:        optional AdaptiveBaseline instance. Defaults to a
                     module-level singleton so repeated calls accumulate
                     history automatically -- pass your own instance to
                     run multiple independent streams (e.g. in tests)
                     in the same process.
    timestamp:       ISO-8601 string for this window; defaults to "now" (UTC).
    window_seconds:  overrides config.WINDOW_SECONDS for this call.
                     Threaded through to extract_window_features so
                     callers can test with a non-default window length
                     without monkeypatching the config module.

    Returns the full §7.1 handoff contract:
        {"timestamp", "baseline_ready", "features", "anomalies", "changepoint_probability"}
    """
    baseline = baseline if baseline is not None else _default_baseline
    features = extract_window_features(records, window_seconds=window_seconds)

    anomalies, baseline_ready, changepoint_prob = baseline.update(
        packets_per_second=features["packets_per_second"],
        bytes_per_second=features["bytes_per_second"],
        syn_rate=features["syn_rate"],
        unique_source_ips=features["unique_source_ips"],
        failed_connections=features["failed_connections"],
    )

    ts = timestamp or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")

    return {
        "timestamp": ts,
        "baseline_ready": baseline_ready,
        "features": features,
        "anomalies": anomalies,
        "changepoint_probability": round(changepoint_prob, 4),
    }

