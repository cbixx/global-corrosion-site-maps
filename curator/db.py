from __future__ import annotations

import os

DB_BACKEND = os.environ.get("DB_BACKEND", "sqlite").strip().lower()

if DB_BACKEND == "supabase":
    from db_supabase import *  # noqa: F401,F403
else:
    from db_sqlite import *  # noqa: F401,F403