"""
action_model.py: Defensive Action Catalog & Extensible Efficacy Models
========================================================================
Defines defensive actions, their operational descriptions, parameterizable
efficacy curves, and an extensible registry for adding future actions seamlessly.
"""

from enum import Enum
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field


class DefensiveAction(str, Enum):
    """
    Enumeration of supported defensive mitigation actions.
    """
    NO_ACTION = "NO_ACTION"
    BLOCK_SOURCES = "BLOCK_SOURCES"
    ISOLATE_ASSET = "ISOLATE_ASSET"
    
    # Future-extensible action definitions
    RATE_LIMIT = "RATE_LIMIT"
    BLOCK_PORT = "BLOCK_PORT"
    DISABLE_ACCOUNT = "DISABLE_ACCOUNT"
    REDIRECT_TRAFFIC = "REDIRECT_TRAFFIC"


@dataclass
class ActionMetadata:
    """
    Metadata and parameterization for a defensive action.
    """
    action: DefensiveAction
    name: str
    description: str
    base_effect: float
    rate_per_min: float
    enabled: bool = True
    target_attack_types: List[str] = field(default_factory=list)
    side_effects: str = "None"


class ActionCatalog:
    """
    Central catalog and registry for defensive actions.
    Loads definitions from configuration while supporting dynamic runtime extension.
    """

    def __init__(self, config_actions: Optional[Dict[str, Any]] = None):
        self._actions: Dict[DefensiveAction, ActionMetadata] = {}
        self._init_defaults()
        if config_actions:
            self.load_from_config(config_actions)

    def _init_defaults(self):
        """
        Initializes the standard action set.
        """
        self._actions[DefensiveAction.NO_ACTION] = ActionMetadata(
            action=DefensiveAction.NO_ACTION,
            name="NO_ACTION",
            description="Baseline — defender takes no intervention, allowing threat escalation",
            base_effect=0.0,
            rate_per_min=0.0,
            enabled=True,
            target_attack_types=["ALL"],
            side_effects="No operational disruption; high security risk"
        )
        self._actions[DefensiveAction.BLOCK_SOURCES] = ActionMetadata(
            action=DefensiveAction.BLOCK_SOURCES,
            name="BLOCK_SOURCES",
            description="Block suspicious IP addresses, botnet sources, and ingress nodes",
            base_effect=0.12,
            rate_per_min=0.065,
            enabled=True,
            target_attack_types=["DDOS", "BRUTEFORCE", "SCANNING", "CREDENTIAL_STUFFING"],
            side_effects="Potential false-positive blocking of legitimate traffic"
        )
        self._actions[DefensiveAction.ISOLATE_ASSET] = ActionMetadata(
            action=DefensiveAction.ISOLATE_ASSET,
            name="ISOLATE_ASSET",
            description="Quarantine affected host/server and sever internal lateral pathways",
            base_effect=0.25,
            rate_per_min=0.085,
            enabled=True,
            target_attack_types=["ALL", "RANSOMWARE", "LATERAL_MOVEMENT", "EXFILTRATION", "DDOS"],
            side_effects="Temporary service downtime for isolated workload"
        )
        # Extensible actions (default disabled until enabled via config)
        self._actions[DefensiveAction.RATE_LIMIT] = ActionMetadata(
            action=DefensiveAction.RATE_LIMIT,
            name="RATE_LIMIT",
            description="Apply strict API and network rate limiting on inbound traffic",
            base_effect=0.08,
            rate_per_min=0.045,
            enabled=False,
            target_attack_types=["DDOS", "API_ABUSE", "BRUTEFORCE"],
            side_effects="Degraded throughput for high-volume users"
        )
        self._actions[DefensiveAction.BLOCK_PORT] = ActionMetadata(
            action=DefensiveAction.BLOCK_PORT,
            name="BLOCK_PORT",
            description="Close targeted network ports and vulnerable listener protocols",
            base_effect=0.10,
            rate_per_min=0.055,
            enabled=False,
            target_attack_types=["EXPLOIT", "PORT_SCAN"],
            side_effects="Inaccessible services on blocked ports"
        )
        self._actions[DefensiveAction.DISABLE_ACCOUNT] = ActionMetadata(
            action=DefensiveAction.DISABLE_ACCOUNT,
            name="DISABLE_ACCOUNT",
            description="Temporarily revoke compromised credentials and invalidate active sessions",
            base_effect=0.15,
            rate_per_min=0.060,
            enabled=False,
            target_attack_types=["UNAUTHORIZED_ACCESS", "CREDENTIAL_THEFT"],
            side_effects="User lockouts"
        )
        self._actions[DefensiveAction.REDIRECT_TRAFFIC] = ActionMetadata(
            action=DefensiveAction.REDIRECT_TRAFFIC,
            name="REDIRECT_TRAFFIC",
            description="Divert suspicious traffic to honeypot or cloud scrubbing center",
            base_effect=0.10,
            rate_per_min=0.050,
            enabled=False,
            target_attack_types=["DDOS", "RECONNAISSANCE"],
            side_effects="Increased routing latency"
        )

    def load_from_config(self, config_actions: Dict[str, Any]):
        """
        Updates action parameters and enabled flags from config.yaml.
        """
        for action_key, params in config_actions.items():
            try:
                action_enum = DefensiveAction(action_key)
            except ValueError:
                # Support custom dynamically registered actions
                action_enum = action_key  # type: ignore
            
            if action_enum in self._actions:
                meta = self._actions[action_enum]
                meta.base_effect = float(params.get("base_effect", meta.base_effect))
                meta.rate_per_min = float(params.get("rate_per_min", meta.rate_per_min))
                meta.description = str(params.get("description", meta.description))
                meta.enabled = bool(params.get("enabled", meta.enabled))
            else:
                # Register new custom action from config
                self._actions[action_enum] = ActionMetadata(
                    action=action_enum,  # type: ignore
                    name=str(action_key),
                    description=str(params.get("description", f"Custom action {action_key}")),
                    base_effect=float(params.get("base_effect", 0.05)),
                    rate_per_min=float(params.get("rate_per_min", 0.03)),
                    enabled=bool(params.get("enabled", True)),
                    target_attack_types=params.get("target_attack_types", ["ALL"]),
                    side_effects=str(params.get("side_effects", "None"))
                )

    def register_action(self, metadata: ActionMetadata):
        """
        Registers a new custom defensive action at runtime.
        """
        self._actions[metadata.action] = metadata

    def get_action(self, action: DefensiveAction) -> Optional[ActionMetadata]:
        return self._actions.get(action)

    def get_enabled_actions(self) -> List[ActionMetadata]:
        """
        Returns all currently active actions to simulate.
        """
        return [meta for meta in self._actions.values() if meta.enabled]

    def compute_defensive_effect(
        self,
        action: DefensiveAction,
        minutes: float,
        attack_type: str = "ALL"
    ) -> float:
        """
        Calculates cumulative risk reduction effect of an action over `minutes`.
        Formula: base_effect + (rate_per_min * minutes) * attack_type_modifier
        """
        meta = self._actions.get(action)
        if not meta or not meta.enabled or action == DefensiveAction.NO_ACTION:
            return 0.0

        # Base effectiveness scaling over time with diminishing returns
        # effect(t) = base_effect + rate_per_min * minutes
        effect = meta.base_effect + (meta.rate_per_min * minutes)

        # Contextual suitability multiplier based on attack type
        multiplier = 1.0
        if meta.target_attack_types and "ALL" not in meta.target_attack_types:
            if attack_type.upper() in [t.upper() for t in meta.target_attack_types]:
                multiplier = 1.15
            else:
                multiplier = 0.85

        return max(0.0, effect * multiplier)
