from __future__ import annotations

import argparse
import os
import sqlite3
from pathlib import Path
from typing import Any

import psycopg
from psycopg import sql


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SQLITE_DB_PATH = PROJECT_ROOT / "curator" / "curation.db"

TABLE_ORDER = [
    "metadata_options",
    "sources",
    "sites",
    "site_sources",
]


def sqlite_connect() -> sqlite3.Connection:
    if not SQLITE_DB_PATH.exists():
        raise FileNotFoundError(f"SQLite database not found: {SQLITE_DB_PATH}")

    conn = sqlite3.connect(SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def postgres_connect():
    db_url = os.environ.get("SUPABASE_DB_URL", "").strip()

    if not db_url:
        raise RuntimeError("SUPABASE_DB_URL is not set.")

    return psycopg.connect(db_url)


def get_sqlite_columns(conn: sqlite3.Connection, table_name: str) -> list[str]:
    rows = conn.execute(f"pragma table_info({table_name})").fetchall()
    return [str(row["name"]) for row in rows]


def get_postgres_columns(conn, table_name: str) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select column_name
            from information_schema.columns
            where table_schema = 'public'
              and table_name = %s
            order by ordinal_position
            """,
            (table_name,),
        )
        return [str(row[0]) for row in cur.fetchall()]


def table_count_sqlite(conn: sqlite3.Connection, table_name: str) -> int:
    row = conn.execute(f"select count(*) as count from {table_name}").fetchone()
    return int(row["count"])


def table_count_postgres(conn, table_name: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            sql.SQL("select count(*) from {}").format(sql.Identifier(table_name))
        )
        row = cur.fetchone()

    if row is None:
        raise RuntimeError(f"Count query returned no row for {table_name}")

    return int(row[0])


def fetch_sqlite_rows(
    conn: sqlite3.Connection,
    table_name: str,
    columns: list[str],
) -> list[dict[str, Any]]:
    column_sql = ", ".join(columns)
    rows = conn.execute(f"select {column_sql} from {table_name} order by id").fetchall()
    return [dict(row) for row in rows]


def clear_supabase_tables(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            truncate table
                site_sources,
                sources,
                sites,
                metadata_options
            restart identity cascade
            """
        )


def insert_rows_postgres(
    conn,
    table_name: str,
    rows: list[dict[str, Any]],
    columns: list[str],
) -> int:
    if not rows:
        return 0

    insert_query = sql.SQL("insert into {} ({}) values ({})").format(
        sql.Identifier(table_name),
        sql.SQL(", ").join(sql.Identifier(column) for column in columns),
        sql.SQL(", ").join(sql.Placeholder() for _ in columns),
    )

    values = [
        [row.get(column) for column in columns]
        for row in rows
    ]

    with conn.cursor() as cur:
        cur.executemany(insert_query, values)

    return len(rows)


def reset_identity_sequence(conn, table_name: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            select pg_get_serial_sequence(%s, 'id')
            """,
            (f"public.{table_name}",),
        )
        row = cur.fetchone()

        if row is None or row[0] is None:
            return

        sequence_name = row[0]

        cur.execute(
            sql.SQL(
                """
                select coalesce(max(id), 0)
                from {}
                """
            ).format(sql.Identifier(table_name))
        )
        max_id_row = cur.fetchone()
        max_id = int(max_id_row[0]) if max_id_row else 0

        cur.execute(
            "select setval(%s, %s, %s)",
            (sequence_name, max_id, max_id > 0),
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Migrate local SQLite curator database into Supabase PostgreSQL."
    )
    parser.add_argument(
        "--clear-destination",
        action="store_true",
        help="Delete existing Supabase rows before migration.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be migrated without writing to Supabase.",
    )

    args = parser.parse_args()

    with sqlite_connect() as sqlite_conn:
        with postgres_connect() as pg_conn:
            print("SQLite database:", SQLITE_DB_PATH)
            print()

            print("Source SQLite row counts:")
            sqlite_counts = {}
            for table_name in TABLE_ORDER:
                sqlite_counts[table_name] = table_count_sqlite(sqlite_conn, table_name)
                print(f"- {table_name}: {sqlite_counts[table_name]}")

            print()
            print("Destination Supabase row counts before migration:")
            pg_counts_before = {}
            for table_name in TABLE_ORDER:
                pg_counts_before[table_name] = table_count_postgres(pg_conn, table_name)
                print(f"- {table_name}: {pg_counts_before[table_name]}")

            destination_has_rows = any(count > 0 for count in pg_counts_before.values())

            if destination_has_rows and not args.clear_destination:
                raise SystemExit(
                    "\nSupabase destination is not empty. "
                    "Re-run with --clear-destination if you want to replace test rows."
                )

            if args.dry_run:
                print()
                print("Dry run only. No rows were written to Supabase.")
                return

            try:
                if args.clear_destination:
                    print()
                    print("Clearing Supabase destination tables...")
                    clear_supabase_tables(pg_conn)

                print()
                print("Migrating rows...")

                for table_name in TABLE_ORDER:
                    sqlite_columns = get_sqlite_columns(sqlite_conn, table_name)
                    pg_columns = get_postgres_columns(pg_conn, table_name)

                    columns = [
                        column
                        for column in sqlite_columns
                        if column in pg_columns
                    ]

                    rows = fetch_sqlite_rows(sqlite_conn, table_name, columns)
                    inserted = insert_rows_postgres(pg_conn, table_name, rows, columns)

                    print(f"- {table_name}: inserted {inserted} row(s)")

                for table_name in TABLE_ORDER:
                    reset_identity_sequence(pg_conn, table_name)

                pg_conn.commit()

            except Exception:
                pg_conn.rollback()
                raise

            print()
            print("Destination Supabase row counts after migration:")
            for table_name in TABLE_ORDER:
                count = table_count_postgres(pg_conn, table_name)
                expected = sqlite_counts[table_name]
                status = "OK" if count == expected else "MISMATCH"
                print(f"- {table_name}: {count} / expected {expected} [{status}]")


if __name__ == "__main__":
    main()