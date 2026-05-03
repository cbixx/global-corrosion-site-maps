from __future__ import annotations

import os
import importlib


def _get_setting(name: str, default: str = "") -> str:
    value = os.environ.get(name, "").strip()

    if value:
        return value

    try:
        import streamlit as st

        return str(st.secrets.get(name, default)).strip()
    except Exception:
        return default


DB_BACKEND = _get_setting("DB_BACKEND", "sqlite").strip().lower()

if DB_BACKEND == "supabase":
    _backend_module_name = "db_supabase"
else:
    _backend_module_name = "db_sqlite"

_backend = importlib.import_module(_backend_module_name)

for _name in dir(_backend):
    if not _name.startswith("_"):
        globals()[_name] = getattr(_backend, _name)

_REQUIRED_EXPORTS = [
    "delete_corrosion_observations",
    "get_corrosion_observations",
    "get_public_corrosion_observations",
    "import_corrosion_observations",
]

_missing_exports = [
    name for name in _REQUIRED_EXPORTS
    if name not in globals()
]

print("DB_BACKEND resolved as:", DB_BACKEND)
print("DB backend module:", _backend_module_name)
print("DB backend file:", getattr(_backend, "__file__", "unknown"))
print("Corrosion exports available:", [
    name for name in globals()
    if "corrosion" in name.lower()
])

if _missing_exports:
    raise ImportError(
        "The active database backend does not export required corrosion function(s): "
        + ", ".join(_missing_exports)
        + f". Active backend: {_backend_module_name}. "
        + f"Backend file: {getattr(_backend, '__file__', 'unknown')}"
    )