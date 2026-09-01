"""
audit_ledger.py: Immutable Cryptographic Audit Ledger (§2.5 Improvements MD)
===========================================================================
Append-only SHA-256 hash-chained event log. Every detected anomaly, threat
forecast, and automated countermeasure is recorded and Merkle-chained so that
tampering with any historical entry is immediately detectable.

Guarantees non-repudiation during post-incident investigations (CERT-In / NCIIPC).
"""

import hashlib
import json
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def _sha256(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


class AuditLedger:
    """
    Thread-safe append-only ledger with SHA-256 hash chaining.
    Each entry carries the hash of the previous entry (like a Merkle chain),
    making retrospective alteration detectable.
    """

    def __init__(self):
        self._entries: List[Dict[str, Any]] = []
        self._lock = threading.Lock()
        # Genesis block
        self._prev_hash = _sha256("SIH26153-GENESIS")

    def append(self, event_type: str, payload: Dict[str, Any]) -> str:
        """
        Append a new event to the ledger. Returns the entry hash.
        event_type: e.g. "ANOMALY_DETECTED", "THREAT_FORECAST", "ACTION_TAKEN"
        payload: arbitrary event data dict (must be JSON-serialisable).
        """
        with self._lock:
            ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
            entry = {
                "seq": len(self._entries),
                "timestamp": ts,
                "event_type": event_type,
                "payload": payload,
                "prev_hash": self._prev_hash,
            }
            entry_hash = _sha256(json.dumps(entry, sort_keys=True, default=str))
            entry["entry_hash"] = entry_hash
            self._entries.append(entry)
            self._prev_hash = entry_hash
            return entry_hash

    def verify_integrity(self) -> bool:
        """
        Recompute the full hash chain and return True only if no entry has been tampered.
        """
        prev = _sha256("SIH26153-GENESIS")
        for entry in self._entries:
            check = dict(entry)
            stored_hash = check.pop("entry_hash")
            check["prev_hash"] = prev
            expected = _sha256(json.dumps(check, sort_keys=True, default=str))
            if expected != stored_hash:
                return False
            prev = stored_hash
        return True

    def recent(self, n: int = 20) -> List[Dict[str, Any]]:
        """Return the n most recent ledger entries."""
        with self._lock:
            return list(self._entries[-n:])

    def all_entries(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._entries)

    def __len__(self):
        return len(self._entries)


# Module-level singleton used by the pipeline
_global_ledger = AuditLedger()


def log_event(event_type: str, payload: Dict[str, Any]) -> str:
    return _global_ledger.append(event_type, payload)


def get_ledger() -> AuditLedger:
    return _global_ledger
