from __future__ import annotations

import os
import importlib
from typing import TYPE_CHECKING


if TYPE_CHECKING:
    from db_supabase import (
        DB_PATH,
        SCHEMA_PATH,
        add_metadata_options,
        bulk_update_table_rows,
        bulk_upsert_site_source_links,
        bulk_update_source_metadata,
        delete_site_source_links,
        delete_table_rows,
        ensure_schema_updates,
        get_app_setting,
        set_app_setting,
        get_connection,
        get_existing_source_codes,
        get_metadata_options,
        get_next_site_id_for_prefix,
        get_site_options,
        get_site_source_links,
        get_source_metadata_by_ids,
        get_source_options,
        get_table_rows,
        init_db,
        insert_source,
        insert_site,
        merge_metadata_for_multiple_sites,
        table_counts,
        update_source_programme,
        update_table_row,
        delete_corrosion_observations,
        get_corrosion_observations,
        get_public_corrosion_observations,
        import_corrosion_observations,
        delete_environmental_observations,
        get_environmental_observations,
        get_public_environmental_observations,
        import_environmental_observations,
    )


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
    "DB_PATH",
    "add_metadata_options",
    "bulk_update_table_rows",
    "bulk_upsert_site_source_links",
    "bulk_update_source_metadata",
    "delete_site_source_links",
    "delete_table_rows",
    "ensure_schema_updates",
    "get_app_setting",
    "set_app_setting",
    "get_connection",
    "get_existing_source_codes",
    "get_metadata_options",
    "get_next_site_id_for_prefix",
    "get_site_options",
    "get_site_source_links",
    "get_source_metadata_by_ids",
    "get_source_options",
    "get_table_rows",
    "init_db",
    "insert_source",
    "insert_site",
    "merge_metadata_for_multiple_sites",
    "table_counts",
    "update_source_programme",
    "update_table_row",
    "delete_corrosion_observations",
    "get_corrosion_observations",
    "get_public_corrosion_observations",
    "import_corrosion_observations",
    "delete_environmental_observations",
    "get_environmental_observations",
    "get_public_environmental_observations",
    "import_environmental_observations",
]

_missing_exports = [
    name for name in _REQUIRED_EXPORTS
    if name not in globals()
]

print("DB_BACKEND resolved as:", DB_BACKEND)
print("DB backend module:", _backend_module_name)
print("DB backend file:", getattr(_backend, "__file__", "unknown"))
print(
    "Corrosion exports available:",
    [
        name for name in globals()
        if "corrosion" in name.lower()
    ],
)

if _missing_exports:
    raise ImportError(
        "The active database backend does not export required function(s): "
        + ", ".join(_missing_exports)
        + f". Active backend: {_backend_module_name}. "
        + f"Backend file: {getattr(_backend, '__file__', 'unknown')}"
    )