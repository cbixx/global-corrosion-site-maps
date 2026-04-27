from __future__ import annotations

import os

import psycopg
from psycopg import sql


REQUIRED_TABLES = [
    "metadata_options",
    "site_sources",
    "sites",
    "sources",
]


def main() -> None:
    db_url = os.environ.get("SUPABASE_DB_URL", "").strip()

    if not db_url:
        raise SystemExit("SUPABASE_DB_URL is not set.")

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select current_database() as database_name, current_user as user_name;"
            )
            connection_row = cur.fetchone()

            if connection_row is None:
                raise RuntimeError("Database connection test query returned no row.")

            database_name, user_name = connection_row

            print("Connection:")
            print("database_name:", database_name)
            print("user_name:", user_name)

            cur.execute(
                """
                select table_name
                from information_schema.tables
                where table_schema = 'public'
                order by table_name;
                """
            )

            print("\nTables:")
            for row in cur.fetchall():
                print("-", row[0])

            print("\nRow counts:")
            for table_name in REQUIRED_TABLES:
                query = sql.SQL("select count(*) from {}").format(
                    sql.Identifier(table_name)
                )
                cur.execute(query)
                count_row = cur.fetchone()

                if count_row is None:
                    raise RuntimeError(f"Count query returned no row for table: {table_name}")

                count = count_row[0]
                print(f"{table_name}: {count}")


if __name__ == "__main__":
    main()