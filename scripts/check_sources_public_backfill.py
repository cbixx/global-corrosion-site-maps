from __future__ import annotations

import csv
import sys
from pathlib import Path

REPO_ROOT = Path.cwd()
CURATOR_DIR = REPO_ROOT / "curator"

if str(CURATOR_DIR) not in sys.path:
    sys.path.insert(0, str(CURATOR_DIR))

from db import DB_PATH, get_connection

CSV_PATH = REPO_ROOT / "data" / "sources_public.csv"

def clean(value):
    return str(value or "").strip()

csv_rows = []
with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as f:
    csv_rows = list(csv.DictReader(f))

csv_by_code = {
    clean(row.get("source_code", "")).lower(): row
    for row in csv_rows
    if clean(row.get("source_code", ""))
}

with get_connection() as conn:
    rows = conn.execute(
        """
        select
            source_code,
            source_title,
            authors_or_organization,
            publication_year,
            doi,
            public_url,
            display_citation,
            public_notes
        from sources
        order by source_code
        """
    ).fetchall()

db_by_code = {
    clean(row["source_code"]).lower(): dict(row)
    for row in rows
    if clean(row["source_code"])
}

missing_in_db = sorted(set(csv_by_code) - set(db_by_code))
missing_in_csv = sorted(set(db_by_code) - set(csv_by_code))

metadata_count = 0
mismatch_count = 0
mismatches = []

for code, csv_row in csv_by_code.items():
    db_row = db_by_code.get(code)
    if not db_row:
        continue

    has_public_metadata = any(
        clean(db_row.get(field, ""))
        for field in [
            "authors_or_organization",
            "publication_year",
            "doi",
            "public_url",
            "display_citation",
            "public_notes",
        ]
    )

    if has_public_metadata:
        metadata_count += 1

    for csv_field, db_field in [
        ("source_title", "source_title"),
        ("authors_or_organization", "authors_or_organization"),
        ("publication_year", "publication_year"),
        ("doi", "doi"),
        ("public_url", "public_url"),
        ("display_citation", "display_citation"),
        ("notes", "public_notes"),
    ]:
        csv_value = clean(csv_row.get(csv_field, ""))
        db_value = clean(db_row.get(db_field, ""))

        if csv_value and csv_value != db_value:
            mismatch_count += 1
            mismatches.append((code, csv_field, csv_value, db_value))
            break

print(f"DB backend: {DB_PATH}")
print(f"CSV source records: {len(csv_by_code)}")
print(f"DB source records: {len(db_by_code)}")
print(f"CSV sources missing in DB: {len(missing_in_db)}")
print(f"DB sources missing in CSV: {len(missing_in_csv)}")
print(f"DB records with public metadata filled: {metadata_count}")
print(f"CSV-vs-DB records with at least one mismatch: {mismatch_count}")

if missing_in_db:
    print("\nMissing in DB:")
    for code in missing_in_db[:30]:
        print(f"- {code}")

if mismatches:
    print("\nFirst mismatches:")
    for code, field, csv_value, db_value in mismatches[:20]:
        print(f"- {code} / {field}")
        print(f"  CSV: {csv_value}")
        print(f"  DB : {db_value}")
