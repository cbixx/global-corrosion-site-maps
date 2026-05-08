from __future__ import annotations

import csv
import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
CURATOR_DIR = REPO_ROOT / "curator"

if str(CURATOR_DIR) not in sys.path:
    sys.path.insert(0, str(CURATOR_DIR))

from db import DB_PATH, get_connection

SOURCE_PUBLIC_CSV = REPO_ROOT / "data" / "sources_public.csv"

PUBLIC_SOURCE_COLUMNS = {
    "source_kind": "text",
    "source_type": "text",
    "authors_or_organization": "text",
    "publication_year": "text",
    "doi": "text",
    "public_url": "text",
    "display_citation": "text",
    "public_notes": "text",
}


def clean(value) -> str:
    return str(value or "").strip()


def normalise_source_code(value: str) -> str:
    text = clean(value).lower()
    text = re.sub(r"\.pdf$", "", text)

    match = re.fullmatch(r"s?0*(\d{1,4})", text)

    if match:
        return f"s{int(match.group(1)):03d}"

    return text


def get_source_columns(conn) -> set[str]:
    if str(DB_PATH).upper() == "SUPABASE":
        rows = conn.execute(
            """
            select column_name
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'sources'
            """
        ).fetchall()
        return {str(row["column_name"]) for row in rows}

    rows = conn.execute("PRAGMA table_info(sources)").fetchall()
    return {str(row["name"]) for row in rows}


def ensure_source_public_columns() -> None:
    with get_connection() as conn:
        existing_columns = get_source_columns(conn)

        for column_name, column_type in PUBLIC_SOURCE_COLUMNS.items():
            if column_name in existing_columns:
                continue

            if str(DB_PATH).upper() == "SUPABASE":
                conn.execute(
                    f"alter table sources add column if not exists {column_name} {column_type}"
                )
            else:
                conn.execute(
                    f"alter table sources add column {column_name} {column_type}"
                )

        conn.commit()


def backfill_sources_public_metadata() -> None:
    if not SOURCE_PUBLIC_CSV.exists():
        raise FileNotFoundError(f"Missing file: {SOURCE_PUBLIC_CSV}")

    updated_count = 0
    skipped_count = 0
    missing_codes = []

    with SOURCE_PUBLIC_CSV.open("r", encoding="utf-8-sig", newline="") as file:
        rows = list(csv.DictReader(file))

    with get_connection() as conn:
        for row in rows:
            source_code = normalise_source_code(row.get("source_code", ""))

            if not source_code:
                skipped_count += 1
                continue

            public_notes = (
                clean(row.get("public_notes", ""))
                or clean(row.get("notes", ""))
            )

            values = {
                "source_kind": clean(row.get("source_kind", "")),
                "source_type": clean(row.get("source_type", "")),
                "source_title": clean(row.get("source_title", "")),
                "authors_or_organization": clean(row.get("authors_or_organization", "")),
                "publication_year": clean(row.get("publication_year", "")),
                "doi": clean(row.get("doi", "")),
                "public_url": clean(row.get("public_url", "")),
                "display_citation": clean(row.get("display_citation", "")),
                "public_notes": public_notes,
            }

            existing = conn.execute(
                """
                select id
                from sources
                where lower(trim(source_code)) = lower(trim(?))
                limit 1
                """,
                (source_code,),
            ).fetchone()

            if existing is None:
                missing_codes.append(source_code)
                skipped_count += 1
                continue

            conn.execute(
                """
                update sources
                set source_kind = ?,
                    source_type = ?,
                    source_title = ?,
                    authors_or_organization = ?,
                    publication_year = ?,
                    doi = ?,
                    public_url = ?,
                    display_citation = ?,
                    public_notes = ?
                where lower(trim(source_code)) = lower(trim(?))
                """,
                (
                    values["source_kind"],
                    values["source_type"],
                    values["source_title"],
                    values["authors_or_organization"],
                    values["publication_year"],
                    values["doi"],
                    values["public_url"],
                    values["display_citation"],
                    values["public_notes"],
                    source_code,
                ),
            )

            updated_count += 1

        conn.commit()

    print(f"Updated source records: {updated_count}")
    print(f"Skipped rows/codes: {skipped_count}")

    if missing_codes:
        print("Source codes present in CSV but missing from database:")
        for code in missing_codes:
            print(f"- {code}")


if __name__ == "__main__":
    ensure_source_public_columns()
    backfill_sources_public_metadata()
