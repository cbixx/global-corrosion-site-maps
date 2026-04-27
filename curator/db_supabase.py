from __future__ import annotations

import os
from types import TracebackType
from typing import Any, Mapping, Sequence, Type
from psycopg_pool import ConnectionPool

DB_PATH = "SUPABASE"
SCHEMA_PATH = "SUPABASE"

_POOL: ConnectionPool | None = None


def _get_pool() -> ConnectionPool:
    global _POOL

    if _POOL is not None:
        return _POOL

    db_url = os.environ.get("SUPABASE_DB_URL", "").strip()

    if not db_url:
        raise RuntimeError("SUPABASE_DB_URL is not set.")

    min_size = int(os.environ.get("SUPABASE_POOL_MIN_SIZE", "1"))
    max_size = int(os.environ.get("SUPABASE_POOL_MAX_SIZE", "5"))

    _POOL = ConnectionPool(
        conninfo=db_url,
        min_size=min_size,
        max_size=max_size,
        open=True,
    )

    return _POOL

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
        "source_title",
        "programme",
        "metals",
        "exposure_periods",
        "local_file_name",
        "source_url",
        "notes",
    },
}


class SupabaseCursor:
    def __init__(self, cursor: Any, lastrowid: int | None = None):
        self._cursor = cursor
        self.lastrowid = lastrowid

    @property
    def rowcount(self) -> int:
        return int(self._cursor.rowcount)

    def _row_to_dict(self, row: Any) -> dict[str, Any] | None:
        if row is None:
            return None

        if isinstance(row, dict):
            return row

        description = self._cursor.description

        if description is None:
            return None

        column_names = [column[0] for column in description]

        return {
            column_name: row[index]
            for index, column_name in enumerate(column_names)
        }

    def fetchone(self) -> dict[str, Any] | None:
        return self._row_to_dict(self._cursor.fetchone())

    def fetchall(self) -> list[dict[str, Any]]:
        return [
            converted_row
            for row in self._cursor.fetchall()
            if (converted_row := self._row_to_dict(row)) is not None
        ]


class SupabaseConnection:
    """
    Compatibility wrapper.

    Existing app code can keep using SQLite-style ? placeholders,
    while this wrapper sends PostgreSQL-style %s placeholders to Supabase.
    """

    def __init__(self) -> None:
        self._pool = _get_pool()
        self._pool_context = self._pool.connection()
        self._conn: Any = self._pool_context.__enter__()

    def __enter__(self) -> "SupabaseConnection":
        return self

    def __exit__(
        self,
        exc_type: Type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        if exc_type is None:
            self._conn.commit()
        else:
            self._conn.rollback()

        self._pool_context.__exit__(exc_type, exc, traceback)

    def _convert_sql(self, query: str) -> tuple[str, bool]:
        converted = query.replace("?", "%s")
        lowered = " ".join(converted.lower().split())

        needs_returning_id = (
            " returning " not in lowered
            and (
                lowered.startswith("insert into sites ")
                or lowered.startswith("insert into sources ")
            )
        )

        if needs_returning_id:
            converted = converted.rstrip().rstrip(";") + " returning id"

        return converted, needs_returning_id

    def execute(
        self,
        query: str,
        params: Sequence[Any] | Mapping[str, Any] | None = None,
    ) -> SupabaseCursor:
        converted_query, needs_returning_id = self._convert_sql(query)

        if params is None:
            param_values: Sequence[Any] | Mapping[str, Any] = []
        else:
            param_values = params

        cursor = self._conn.cursor()
        cursor.execute(converted_query, param_values)

        lastrowid = None

        wrapped_cursor = SupabaseCursor(cursor)

        if needs_returning_id:
            row = wrapped_cursor.fetchone()

            if row is not None:
                lastrowid = int(row["id"])

        return SupabaseCursor(cursor, lastrowid=lastrowid)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()


def get_connection() -> SupabaseConnection:
    return SupabaseConnection()


def init_db() -> None:
    """
    Supabase schema is created in Supabase SQL Editor.
    This function is kept for API compatibility with the SQLite backend.
    """
    ensure_schema_updates()


def ensure_schema_updates() -> None:
    """
    Supabase schema is managed explicitly in SQL Editor.
    This function is intentionally non-destructive.
    """
    return None


def table_counts() -> dict[str, int]:
    counts = {}

    with get_connection() as conn:
        for table in ["sites", "sources", "site_sources"]:
            row = conn.execute(f"select count(*) as count from {table}").fetchone()
            counts[table] = int(row["count"]) if row else 0

    return counts


def list_tables() -> list[str]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            select table_name
            from information_schema.tables
            where table_schema = 'public'
            order by table_name
            """
        ).fetchall()

    return [str(row["table_name"]) for row in rows]


def insert_source(
    source_code: str,
    source_title: str = "",
    programme: str = "",
    metals: str = "",
    exposure_periods: str = "",
    local_file_name: str = "",
    source_url: str = "",
    notes: str = "",
) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            insert into sources (
                source_code,
                source_title,
                programme,
                metals,
                exposure_periods,
                local_file_name,
                source_url,
                notes
            )
            values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                source_code.strip(),
                source_title.strip(),
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

    return {
        str(row["source_code"]).strip()
        for row in rows
        if str(row["source_code"]).strip()
    }


def delete_source_by_code(source_code: str) -> int:
    with get_connection() as conn:
        cursor = conn.execute(
            "delete from sources where source_code = ?",
            (source_code.strip(),),
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
            [int(row_id) for row_id in row_ids],
        )
        conn.commit()
        return cursor.rowcount


def bulk_update_source_metadata(
    source_ids: list[int],
    metals: str,
    exposure_periods: str,
    mode: str = "replace",
) -> int:
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
            cursor = conn.execute(
                """
                insert into metadata_options (category, value)
                values (?, ?)
                on conflict(category, value) do nothing
                """,
                (category, value),
            )
            if cursor.rowcount >= 0:
                changed_count += 1

        conn.commit()

    return changed_count