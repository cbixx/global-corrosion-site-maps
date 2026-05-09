from __future__ import annotations

import sqlite3
import json
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "curation.db"
SCHEMA_PATH = BASE_DIR / "schema.sql"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    if not SCHEMA_PATH.exists():
        raise FileNotFoundError(f"Schema file not found: {SCHEMA_PATH}")

    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8").strip()

    if not schema_sql:
        raise ValueError(f"Schema file is empty: {SCHEMA_PATH}")

    with get_connection() as conn:
        conn.executescript(schema_sql)
        conn.commit()


def table_counts() -> dict[str, int]:
    with get_connection() as conn:
        tables = [
            "sites",
            "sources",
            "site_sources",
            "corrosion_observations",
            "environmental_observations",
        ]
        counts = {}
        for table in tables:
            try:
                value = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                counts[table] = int(value)
            except Exception:
                counts[table] = 0
        return counts


def list_tables() -> list[str]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        return [row[0] for row in rows]
    
def ensure_schema_updates() -> None:
    """Apply non-destructive schema updates to an existing database."""
    with get_connection() as conn:
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
        table_names = {row["name"] for row in tables}

        if "sources" in table_names:
            source_columns = conn.execute("PRAGMA table_info(sources)").fetchall()
            source_column_names = {row["name"] for row in source_columns}

            if "programme" not in source_column_names:
                conn.execute("ALTER TABLE sources ADD COLUMN programme text")

            if "metals" not in source_column_names:
                conn.execute("ALTER TABLE sources ADD COLUMN metals text")

            if "exposure_periods" not in source_column_names:
                conn.execute("ALTER TABLE sources ADD COLUMN exposure_periods text")

            if "private_pdf_object_key" not in source_column_names:
                conn.execute("ALTER TABLE sources ADD COLUMN private_pdf_object_key text")

            source_public_metadata_columns = {
                "source_kind": "text",
                "source_type": "text",
                "authors_or_organization": "text",
                "publication_year": "text",
                "doi": "text",
                "public_url": "text",
                "display_citation": "text",
                "public_notes": "text",
            }

            for column_name, column_type in source_public_metadata_columns.items():
                if column_name not in source_column_names:
                    conn.execute(
                        f"ALTER TABLE sources ADD COLUMN {column_name} {column_type}"
                    )

        if "site_sources" in table_names:
            link_columns = conn.execute("PRAGMA table_info(site_sources)").fetchall()
            link_column_names = {row["name"] for row in link_columns}

            if "metals" not in link_column_names:
                conn.execute("ALTER TABLE site_sources ADD COLUMN metals text")

            if "exposure_periods" not in link_column_names:
                conn.execute("ALTER TABLE site_sources ADD COLUMN exposure_periods text")

            if "notes" not in link_column_names:
                conn.execute("ALTER TABLE site_sources ADD COLUMN notes text")

        conn.execute(
            """
            create table if not exists metadata_options (
                id integer primary key autoincrement,
                category text not null,
                value text not null,
                created_at text default current_timestamp,
                unique(category, value)
            )
            """
        )

        conn.execute(
            """
            create table if not exists corrosion_observations (
                id integer primary key autoincrement,
                site_fk integer not null,
                source_fk integer not null,
                site_source_fk integer,
                material text not null,
                exposure_period text not null,
                corrosion_metric text not null default 'corrosion_rate',
                value real not null,
                unit text not null,
                measurement_method text not null default '',
                specimen_condition text not null default '',
                exposure_condition text not null default '',
                notes text not null default '',
                created_at text default current_timestamp,
                updated_at text default current_timestamp,
                foreign key(site_fk) references sites(id) on delete cascade,
                foreign key(source_fk) references sources(id) on delete cascade,
                foreign key(site_source_fk) references site_sources(id) on delete set null,
                unique(
                    site_fk,
                    source_fk,
                    material,
                    exposure_period,
                    corrosion_metric,
                    measurement_method,
                    specimen_condition
                )
            )
            """
        )

        conn.execute(
            """
            create table if not exists environmental_observations (
                id integer primary key autoincrement,
                site_fk integer not null,
                source_fk integer,
                site_source_fk integer,
                variable_name text not null,
                value real not null,
                unit text not null,
                aggregation text not null default '',
                period_start text not null default '',
                period_end text not null default '',
                data_source text not null default '',
                notes text not null default '',
                created_at text default current_timestamp,
                updated_at text default current_timestamp,
                foreign key(site_fk) references sites(id) on delete cascade,
                foreign key(source_fk) references sources(id) on delete set null,
                foreign key(site_source_fk) references site_sources(id) on delete set null,
                unique(
                    site_fk,
                    variable_name,
                    aggregation,
                    period_start,
                    period_end,
                    data_source
                )
            )
            """
        )

        conn.execute(
            """
            create table if not exists app_settings (
                setting_key text primary key,
                payload_json text not null,
                updated_at text default current_timestamp
            )
            """
        )

        conn.commit()

def insert_source(
    source_code: str,
    source_title: str = "",
    programme: str = "",
    metals: str = "",
    exposure_periods: str = "",
    local_file_name: str = "",
    source_url: str = "",
    notes: str = "",
    source_kind: str = "",
    source_type: str = "",
    authors_or_organization: str = "",
    publication_year: str = "",
    doi: str = "",
    public_url: str = "",
    display_citation: str = "",
    public_notes: str = "",
) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            insert into sources (
                source_code,
                source_kind,
                source_type,
                source_title,
                authors_or_organization,
                publication_year,
                doi,
                public_url,
                display_citation,
                public_notes,
                programme,
                metals,
                exposure_periods,
                local_file_name,
                source_url,
                notes
            )
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                source_code.strip(),
                source_kind.strip(),
                source_type.strip(),
                source_title.strip(),
                authors_or_organization.strip(),
                publication_year.strip(),
                doi.strip(),
                public_url.strip(),
                display_citation.strip(),
                public_notes.strip(),
                programme.strip(),
                metals.strip(),
                exposure_periods.strip(),
                local_file_name.strip(),
                source_url.strip(),
                notes.strip(),
            ),
        )
        conn.commit()

def update_source_programme(source_code: str, programme: str) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            update sources
            set programme = ?
            where source_code = ?
            """,
            (
                programme.strip(),
                source_code.strip(),
            ),
        )
        conn.commit()

def insert_site(
    site_id: str,
    site_label: str,
    site_type: str = "",
    latitude: float = 0.0,
    longitude: float = 0.0,
    modern_country_location: str = "",
    administering_country: str = "",
    former_entity: str = "",
    region_category: str = "",
    exposure_period: str = "",
    metal: str = "",
    notes: str = "",
) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            insert into sites (
                site_id,
                site_label,
                site_type,
                latitude,
                longitude,
                modern_country_location,
                administering_country,
                former_entity,
                region_category,
                exposure_period,
                metal,
                notes
            )
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                site_id.strip(),
                site_label.strip(),
                site_type.strip(),
                float(latitude),
                float(longitude),
                modern_country_location.strip(),
                administering_country.strip(),
                former_entity.strip(),
                region_category.strip(),
                exposure_period.strip(),
                metal.strip(),
                notes.strip(),
            ),
        )
        conn.commit()

def get_existing_site_ids() -> list[str]:
    with get_connection() as conn:
        rows = conn.execute(
            "select site_id from sites where site_id is not null"
        ).fetchall()
        return [str(row["site_id"]) for row in rows]


def get_next_site_id_for_prefix(prefix: str) -> str:
    prefix = prefix.strip().upper()
    existing_ids = get_existing_site_ids()

    max_number = 0

    for site_id in existing_ids:
        if not site_id.startswith(f"{prefix}-"):
            continue

        suffix = site_id.replace(f"{prefix}-", "", 1)

        if suffix.isdigit():
            max_number = max(max_number, int(suffix))

    return f"{prefix}-{max_number + 1:03d}"

def get_existing_source_codes() -> set[str]:
    with get_connection() as conn:
        rows = conn.execute(
            "select source_code from sources where source_code is not null"
        ).fetchall()
        return {str(row["source_code"]).strip() for row in rows}

def delete_source_by_code(source_code: str) -> int:
    with get_connection() as conn:
        cursor = conn.execute(
            "delete from sources where source_code = ?",
            (source_code.strip(),),
        )
        conn.commit()
        return cursor.rowcount
    
def get_source_metadata_by_ids(source_ids: list[int]) -> dict[str, str]:
    if not source_ids:
        return {
            "metals": "",
            "exposure_periods": "",
        }

    placeholders = ", ".join(["?"] * len(source_ids))

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            select metals, exposure_periods
            from sources
            where id in ({placeholders})
            """,
            [int(source_id) for source_id in source_ids],
        ).fetchall()

    merged_metals = merge_metadata_values(
        *[(row["metals"] or "") for row in rows]
    )

    merged_exposure_periods = merge_metadata_values(
        *[(row["exposure_periods"] or "") for row in rows]
    )

    return {
        "metals": merged_metals,
        "exposure_periods": merged_exposure_periods,
    }

EDITABLE_COLUMNS = {
    "sites": {
        "site_id",
        "site_label",
        "site_type",
        "latitude",
        "longitude",
        "modern_country_location",
        "administering_country",
        "former_entity",
        "region_category",
        "exposure_period",
        "metal",
        "notes",
    },
    "sources": {
        "source_code",
        "source_kind",
        "source_type",
        "source_title",
        "authors_or_organization",
        "publication_year",
        "doi",
        "public_url",
        "display_citation",
        "public_notes",
        "programme",
        "metals",
        "exposure_periods",
        "local_file_name",
        "source_url",
        "notes",
        "private_pdf_object_key",
    },
}

def get_table_rows(table_name: str) -> list[dict]:
    if table_name not in EDITABLE_COLUMNS:
        raise ValueError(f"Table is not editable: {table_name}")

    with get_connection() as conn:
        rows = conn.execute(
            f"select * from {table_name} order by id desc"
        ).fetchall()
        return [dict(row) for row in rows]

def update_table_row(table_name: str, row_id: int, updates: dict) -> int:
    if table_name not in EDITABLE_COLUMNS:
        raise ValueError(f"Table is not editable: {table_name}")

    allowed_columns = EDITABLE_COLUMNS[table_name]
    cleaned_updates = {
        key: value
        for key, value in updates.items()
        if key in allowed_columns
    }

    if not cleaned_updates:
        return 0

    set_clause = ", ".join([f"{column} = ?" for column in cleaned_updates])
    values = list(cleaned_updates.values())
    values.append(row_id)

    with get_connection() as conn:
        cursor = conn.execute(
            f"update {table_name} set {set_clause} where id = ?",
            values,
        )
        conn.commit()
        return cursor.rowcount

def bulk_update_table_rows(
    table_name: str,
    row_ids: list[int],
    field_name: str,
    new_value: str,
) -> int:
    if table_name not in EDITABLE_COLUMNS:
        raise ValueError(f"Table is not editable: {table_name}")

    if field_name not in EDITABLE_COLUMNS[table_name]:
        raise ValueError(f"Field is not editable: {field_name}")

    if not row_ids:
        return 0

    placeholders = ", ".join(["?"] * len(row_ids))

    with get_connection() as conn:
        cursor = conn.execute(
            f"""
            update {table_name}
            set {field_name} = ?
            where id in ({placeholders})
            """,
            [new_value, *row_ids],
        )
        conn.commit()
        return cursor.rowcount
    
def delete_table_rows(table_name: str, row_ids: list[int]) -> int:
    allowed_tables = {"sites", "sources"}

    if table_name not in allowed_tables:
        raise ValueError(f"Table cannot be deleted from here: {table_name}")

    if not row_ids:
        return 0

    placeholders = ", ".join(["?"] * len(row_ids))

    with get_connection() as conn:
        cursor = conn.execute(
            f"""
            delete from {table_name}
            where id in ({placeholders})
            """,
            row_ids,
        )
        conn.commit()
        return cursor.rowcount

def split_metadata_values(value: str) -> list[str]:
    if not value:
        return []

    normalised = value.replace(";", ",")
    parts = [part.strip() for part in normalised.split(",")]
    return [part for part in parts if part]


def merge_metadata_values(*values: str) -> str:
    merged: list[str] = []

    for value in values:
        for item in split_metadata_values(value):
            if item not in merged:
                merged.append(item)

    return ", ".join(merged)

def bulk_update_source_metadata(
    source_ids: list[int],
    metals: str,
    exposure_periods: str,
    mode: str = "replace",
) -> int:
    """
    Update source-level metals and exposure periods.

    mode='replace' overwrites existing values.
    mode='merge' adds missing values while preserving existing values.
    """
    if not source_ids:
        return 0

    if mode not in {"replace", "merge"}:
        raise ValueError("mode must be 'replace' or 'merge'")

    changed_count = 0

    with get_connection() as conn:
        for source_id in source_ids:
            if mode == "replace":
                new_metals = metals.strip()
                new_exposure_periods = exposure_periods.strip()
            else:
                row = conn.execute(
                    """
                    select metals, exposure_periods
                    from sources
                    where id = ?
                    """,
                    (int(source_id),),
                ).fetchone()

                if row is None:
                    continue

                new_metals = merge_metadata_values(row["metals"] or "", metals)
                new_exposure_periods = merge_metadata_values(
                    row["exposure_periods"] or "",
                    exposure_periods,
                )

            conn.execute(
                """
                update sources
                set metals = ?,
                    exposure_periods = ?
                where id = ?
                """,
                (
                    new_metals,
                    new_exposure_periods,
                    int(source_id),
                ),
            )
            changed_count += 1

        conn.commit()

    return changed_count

def get_site_options() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            select id, site_id, site_label, modern_country_location
            from sites
            order by site_id
            """
        ).fetchall()

        return [dict(row) for row in rows]


def get_source_options() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            select id, source_code, source_title, programme
            from sources
            order by source_code
            """
        ).fetchall()

        return [dict(row) for row in rows]


def upsert_site_source_link(
    site_fk: int,
    source_fk: int,
    source_order: int = 1,
    metals: str = "",
    exposure_periods: str = "",
    notes: str = "",
) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            insert into site_sources (
                site_fk,
                source_fk,
                source_order,
                metals,
                exposure_periods,
                notes
            )
            values (?, ?, ?, ?, ?, ?)
            on conflict(site_fk, source_fk)
            do update set
                source_order = excluded.source_order,
                metals = excluded.metals,
                exposure_periods = excluded.exposure_periods,
                notes = excluded.notes
            """,
            (
                int(site_fk),
                int(source_fk),
                int(source_order),
                metals.strip(),
                exposure_periods.strip(),
                notes.strip(),
            ),
        )
        conn.commit()


def bulk_upsert_site_source_links(
    site_ids: list[int],
    source_ids: list[int],
    source_order: int = 1,
    metals: str = "",
    exposure_periods: str = "",
    notes: str = "",
) -> int:
    changed_count = 0

    with get_connection() as conn:
        for site_fk in site_ids:
            for source_fk in source_ids:
                conn.execute(
                    """
                    insert into site_sources (
                        site_fk,
                        source_fk,
                        source_order,
                        metals,
                        exposure_periods,
                        notes
                    )
                    values (?, ?, ?, ?, ?, ?)
                    on conflict(site_fk, source_fk)
                    do update set
                        source_order = excluded.source_order,
                        metals = excluded.metals,
                        exposure_periods = excluded.exposure_periods,
                        notes = excluded.notes
                    """,
                    (
                        int(site_fk),
                        int(source_fk),
                        int(source_order),
                        metals.strip(),
                        exposure_periods.strip(),
                        notes.strip(),
                    ),
                )
                changed_count += 1

        conn.commit()

    return changed_count


def get_site_source_links() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            select
                site_sources.id,
                site_sources.site_fk,
                sites.site_id,
                sites.site_label,
                site_sources.source_fk,
                sources.source_code,
                sources.source_title,
                sources.programme,
                site_sources.source_order,
                site_sources.metals,
                site_sources.exposure_periods,
                site_sources.notes
            from site_sources
            join sites on site_sources.site_fk = sites.id
            join sources on site_sources.source_fk = sources.id
            order by sites.site_id, site_sources.source_order, sources.source_code
            """
        ).fetchall()

        return [dict(row) for row in rows]


def delete_site_source_links(link_ids: list[int]) -> int:
    if not link_ids:
        return 0

    placeholders = ", ".join(["?"] * len(link_ids))

    with get_connection() as conn:
        cursor = conn.execute(
            f"""
            delete from site_sources
            where id in ({placeholders})
            """,
            [int(link_id) for link_id in link_ids],
        )
        conn.commit()
        return cursor.rowcount
    
def merge_site_metadata_from_links(site_fk: int) -> dict[str, str]:
    with get_connection() as conn:
        site_row = conn.execute(
            """
            select metal, exposure_period
            from sites
            where id = ?
            """,
            (int(site_fk),),
        ).fetchone()

        if site_row is None:
            raise ValueError(f"Site not found: {site_fk}")

        link_rows = conn.execute(
            """
            select metals, exposure_periods
            from site_sources
            where site_fk = ?
            """,
            (int(site_fk),),
        ).fetchall()

        linked_metals = [
            row["metals"] or ""
            for row in link_rows
        ]

        linked_exposure_periods = [
            row["exposure_periods"] or ""
            for row in link_rows
        ]

        merged_metal = merge_metadata_values(
            site_row["metal"] or "",
            *linked_metals,
        )

        merged_exposure_period = merge_metadata_values(
            site_row["exposure_period"] or "",
            *linked_exposure_periods,
        )

        conn.execute(
            """
            update sites
            set metal = ?,
                exposure_period = ?
            where id = ?
            """,
            (
                merged_metal,
                merged_exposure_period,
                int(site_fk),
            ),
        )

        conn.commit()

        return {
            "metal": merged_metal,
            "exposure_period": merged_exposure_period,
        }


def merge_metadata_for_multiple_sites(site_ids: list[int]) -> int:
    updated_count = 0

    for site_fk in site_ids:
        merge_site_metadata_from_links(site_fk)
        updated_count += 1

    return updated_count

def get_metadata_options(category: str) -> list[str]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            select value
            from metadata_options
            where category = ?
            order by lower(value)
            """,
            (category.strip(),),
        ).fetchall()

    return [str(row["value"]).strip() for row in rows if str(row["value"]).strip()]


def add_metadata_options(category: str, values: list[str]) -> int:
    category = category.strip()

    cleaned_values = []
    for value in values:
        value = str(value).strip()
        if value and value not in cleaned_values:
            cleaned_values.append(value)

    if not category or not cleaned_values:
        return 0

    changed_count = 0

    with get_connection() as conn:
        for value in cleaned_values:
            conn.execute(
                """
                insert or ignore into metadata_options (category, value)
                values (?, ?)
                """,
                (category, value),
            )
            changed_count += 1

        conn.commit()

    return changed_count

def _normalise_source_code_for_corrosion(value: str) -> str:
    import re

    text = str(value or "").strip().lower()
    text = re.sub(r"\.pdf$", "", text)

    match = re.fullmatch(r"s?0*(\d{1,4})", text)

    if match:
        return f"s{int(match.group(1)):03d}"

    return text


def get_corrosion_observations() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            select
                corrosion_observations.id,
                sites.site_id,
                sites.site_label,
                sites.modern_country_location,
                sources.source_code,
                sources.source_title,
                corrosion_observations.material,
                corrosion_observations.exposure_period,
                corrosion_observations.corrosion_metric,
                corrosion_observations.value,
                corrosion_observations.unit,
                corrosion_observations.measurement_method,
                corrosion_observations.specimen_condition,
                corrosion_observations.exposure_condition,
                corrosion_observations.notes,
                corrosion_observations.created_at,
                corrosion_observations.updated_at
            from corrosion_observations
            join sites on sites.id = corrosion_observations.site_fk
            join sources on sources.id = corrosion_observations.source_fk
            order by
                sites.site_id,
                sources.source_code,
                corrosion_observations.material,
                corrosion_observations.exposure_period
            """
        ).fetchall()

    return [dict(row) for row in rows]


def get_public_corrosion_observations() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            select
                sites.site_id,
                sites.site_label,
                sites.latitude,
                sites.longitude,
                sites.modern_country_location,
                sources.source_code,
                sources.source_title,
                corrosion_observations.material,
                corrosion_observations.exposure_period,
                corrosion_observations.corrosion_metric,
                corrosion_observations.value,
                corrosion_observations.unit,
                corrosion_observations.measurement_method,
                corrosion_observations.specimen_condition,
                corrosion_observations.exposure_condition,
                corrosion_observations.notes
            from corrosion_observations
            join sites on sites.id = corrosion_observations.site_fk
            join sources on sources.id = corrosion_observations.source_fk
            order by
                sites.site_id,
                corrosion_observations.material,
                corrosion_observations.exposure_period,
                sources.source_code
            """
        ).fetchall()

    return [dict(row) for row in rows]


def delete_corrosion_observations(observation_ids: list[int]) -> int:
    if not observation_ids:
        return 0

    placeholders = ", ".join(["?"] * len(observation_ids))

    with get_connection() as conn:
        cursor = conn.execute(
            f"""
            delete from corrosion_observations
            where id in ({placeholders})
            """,
            [int(observation_id) for observation_id in observation_ids],
        )
        conn.commit()
        return cursor.rowcount


def import_corrosion_observations(records: list[dict]) -> dict:
    result = {
        "inserted_or_updated": 0,
        "skipped": 0,
        "messages": [],
    }

    with get_connection() as conn:
        for row_number, record in enumerate(records, start=2):
            site_id = str(record.get("site_id", "") or "").strip()
            source_code = _normalise_source_code_for_corrosion(
                str(record.get("source_code", "") or "").strip()
            )
            material = str(record.get("material", "") or "").strip()
            exposure_period = str(record.get("exposure_period", "") or "").strip()
            corrosion_metric = str(record.get("corrosion_metric", "") or "corrosion_rate").strip()
            unit = str(record.get("unit", "") or "").strip()
            measurement_method = str(record.get("measurement_method", "") or "").strip()
            specimen_condition = str(record.get("specimen_condition", "") or "").strip()
            exposure_condition = str(record.get("exposure_condition", "") or "").strip()
            notes = str(record.get("notes", "") or "").strip()

            try:
                value = float(str(record.get("value", "")).strip())
            except Exception:
                result["skipped"] += 1
                result["messages"].append(f"Row {row_number}: invalid value.")
                continue

            if not site_id or not source_code or not material or not exposure_period or not unit:
                result["skipped"] += 1
                result["messages"].append(
                    f"Row {row_number}: missing site_id, source_code, material, exposure_period, or unit."
                )
                continue

            site_row = conn.execute(
                """
                select id
                from sites
                where lower(trim(site_id)) = lower(trim(?))
                limit 1
                """,
                (site_id,),
            ).fetchone()

            if site_row is None:
                result["skipped"] += 1
                result["messages"].append(f"Row {row_number}: site_id `{site_id}` not found.")
                continue

            source_row = conn.execute(
                """
                select id
                from sources
                where lower(trim(source_code)) = lower(trim(?))
                limit 1
                """,
                (source_code,),
            ).fetchone()

            if source_row is None:
                result["skipped"] += 1
                result["messages"].append(f"Row {row_number}: source_code `{source_code}` not found.")
                continue

            site_fk = int(site_row["id"])
            source_fk = int(source_row["id"])

            link_row = conn.execute(
                """
                select id
                from site_sources
                where site_fk = ?
                  and source_fk = ?
                limit 1
                """,
                (site_fk, source_fk),
            ).fetchone()

            site_source_fk = int(link_row["id"]) if link_row else None

            conn.execute(
                """
                insert into corrosion_observations (
                    site_fk,
                    source_fk,
                    site_source_fk,
                    material,
                    exposure_period,
                    corrosion_metric,
                    value,
                    unit,
                    measurement_method,
                    specimen_condition,
                    exposure_condition,
                    notes,
                    updated_at
                )
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, current_timestamp)
                on conflict(
                    site_fk,
                    source_fk,
                    material,
                    exposure_period,
                    corrosion_metric,
                    measurement_method,
                    specimen_condition
                )
                do update set
                    site_source_fk = excluded.site_source_fk,
                    value = excluded.value,
                    unit = excluded.unit,
                    exposure_condition = excluded.exposure_condition,
                    notes = excluded.notes,
                    updated_at = current_timestamp
                """,
                (
                    site_fk,
                    source_fk,
                    site_source_fk,
                    material,
                    exposure_period,
                    corrosion_metric,
                    value,
                    unit,
                    measurement_method,
                    specimen_condition,
                    exposure_condition,
                    notes,
                ),
            )

            result["inserted_or_updated"] += 1

        conn.commit()

    return result

def get_environmental_observations() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            select
                environmental_observations.id,
                sites.site_id,
                sites.site_label,
                sites.modern_country_location,
                sources.source_code,
                sources.source_title,
                environmental_observations.variable_name,
                environmental_observations.value,
                environmental_observations.unit,
                environmental_observations.aggregation,
                environmental_observations.period_start,
                environmental_observations.period_end,
                environmental_observations.data_source,
                environmental_observations.notes,
                environmental_observations.created_at,
                environmental_observations.updated_at
            from environmental_observations
            join sites on sites.id = environmental_observations.site_fk
            left join sources on sources.id = environmental_observations.source_fk
            order by
                sites.site_id,
                environmental_observations.variable_name,
                environmental_observations.period_start,
                environmental_observations.data_source
            """
        ).fetchall()

    return [dict(row) for row in rows]


def get_public_environmental_observations() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            select
                sites.site_id,
                sites.site_label,
                sites.latitude,
                sites.longitude,
                sites.modern_country_location,
                sources.source_code,
                sources.source_title,
                environmental_observations.variable_name,
                environmental_observations.value,
                environmental_observations.unit,
                environmental_observations.aggregation,
                environmental_observations.period_start,
                environmental_observations.period_end,
                environmental_observations.data_source,
                environmental_observations.notes
            from environmental_observations
            join sites on sites.id = environmental_observations.site_fk
            left join sources on sources.id = environmental_observations.source_fk
            order by
                sites.site_id,
                environmental_observations.variable_name,
                environmental_observations.period_start,
                environmental_observations.data_source
            """
        ).fetchall()

    return [dict(row) for row in rows]


def delete_environmental_observations(observation_ids: list[int]) -> int:
    if not observation_ids:
        return 0

    placeholders = ", ".join(["?"] * len(observation_ids))

    with get_connection() as conn:
        cursor = conn.execute(
            f"""
            delete from environmental_observations
            where id in ({placeholders})
            """,
            [int(observation_id) for observation_id in observation_ids],
        )
        conn.commit()
        return cursor.rowcount


def import_environmental_observations(records: list[dict]) -> dict:
    result = {
        "inserted_or_updated": 0,
        "skipped": 0,
        "messages": [],
    }

    with get_connection() as conn:
        for row_number, record in enumerate(records, start=2):
            site_id = str(record.get("site_id", "") or "").strip()
            source_code = _normalise_source_code_for_corrosion(
                str(record.get("source_code", "") or "").strip()
            )
            variable_name = str(record.get("variable_name", "") or "").strip()
            unit = str(record.get("unit", "") or "").strip()
            aggregation = str(record.get("aggregation", "") or "").strip()
            period_start = str(record.get("period_start", "") or "").strip()
            period_end = str(record.get("period_end", "") or "").strip()
            data_source = str(record.get("data_source", "") or "").strip()
            notes = str(record.get("notes", "") or "").strip()

            try:
                value = float(str(record.get("value", "")).strip())
            except Exception:
                result["skipped"] += 1
                result["messages"].append(f"Row {row_number}: invalid value.")
                continue

            if not site_id or not variable_name or not unit:
                result["skipped"] += 1
                result["messages"].append(
                    f"Row {row_number}: missing site_id, variable_name, or unit."
                )
                continue

            site_row = conn.execute(
                """
                select id
                from sites
                where lower(trim(site_id)) = lower(trim(?))
                limit 1
                """,
                (site_id,),
            ).fetchone()

            if site_row is None:
                result["skipped"] += 1
                result["messages"].append(f"Row {row_number}: site_id `{site_id}` not found.")
                continue

            source_fk = None
            site_source_fk = None

            if source_code:
                source_row = conn.execute(
                    """
                    select id
                    from sources
                    where lower(trim(source_code)) = lower(trim(?))
                    limit 1
                    """,
                    (source_code,),
                ).fetchone()

                if source_row is None:
                    result["messages"].append(
                        f"Row {row_number}: source_code `{source_code}` not found; imported without source link."
                    )
                else:
                    source_fk = int(source_row["id"])

                    link_row = conn.execute(
                        """
                        select id
                        from site_sources
                        where site_fk = ?
                          and source_fk = ?
                        limit 1
                        """,
                        (
                            int(site_row["id"]),
                            source_fk,
                        ),
                    ).fetchone()

                    if link_row is not None:
                        site_source_fk = int(link_row["id"])

            conn.execute(
                """
                insert into environmental_observations (
                    site_fk,
                    source_fk,
                    site_source_fk,
                    variable_name,
                    value,
                    unit,
                    aggregation,
                    period_start,
                    period_end,
                    data_source,
                    notes
                )
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                on conflict(
                    site_fk,
                    variable_name,
                    aggregation,
                    period_start,
                    period_end,
                    data_source
                )
                do update set
                    source_fk = excluded.source_fk,
                    site_source_fk = excluded.site_source_fk,
                    value = excluded.value,
                    unit = excluded.unit,
                    notes = excluded.notes,
                    updated_at = current_timestamp
                """,
                (
                    int(site_row["id"]),
                    source_fk,
                    site_source_fk,
                    variable_name,
                    value,
                    unit,
                    aggregation,
                    period_start,
                    period_end,
                    data_source,
                    notes,
                ),
            )

            result["inserted_or_updated"] += 1

        conn.commit()

    return result

def get_app_setting(setting_key: str, default=None):
    setting_key = str(setting_key or "").strip()

    if not setting_key:
        return default

    with get_connection() as conn:
        row = conn.execute(
            """
            select payload_json
            from app_settings
            where setting_key = ?
            """,
            (setting_key,),
        ).fetchone()

    if row is None:
        return default

    try:
        return json.loads(str(row["payload_json"]))
    except Exception:
        return default


def set_app_setting(setting_key: str, value) -> None:
    setting_key = str(setting_key or "").strip()

    if not setting_key:
        raise ValueError("setting_key is required.")

    payload_json = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        default=str,
    )

    with get_connection() as conn:
        conn.execute(
            """
            insert into app_settings (
                setting_key,
                payload_json,
                updated_at
            )
            values (?, ?, current_timestamp)
            on conflict(setting_key) do update set
                payload_json = excluded.payload_json,
                updated_at = current_timestamp
            """,
            (setting_key, payload_json),
        )
        conn.commit()

if __name__ == "__main__":
    print("BASE_DIR =", BASE_DIR)
    print("DB_PATH =", DB_PATH)
    print("SCHEMA_PATH =", SCHEMA_PATH)
    init_db()
    print("Tables =", list_tables())
    print("Table counts =", table_counts())