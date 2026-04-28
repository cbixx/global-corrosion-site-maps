from __future__ import annotations

import os

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
    from db_supabase import *  # noqa: F401,F403
else:
    from db_sqlite import *  # noqa: F401,F403