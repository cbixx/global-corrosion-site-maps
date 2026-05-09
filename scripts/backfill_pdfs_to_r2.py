from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CURATOR_DIR = REPO_ROOT / "curator"

if str(CURATOR_DIR) not in sys.path:
    sys.path.insert(0, str(CURATOR_DIR))

from db import get_connection
from r2_storage import (
    build_source_pdf_object_key,
    object_exists_in_r2,
    upload_file_to_r2,
    get_r2_storage_usage,
)

SOURCE_PDF_DIR = REPO_ROOT / "source_pdfs"


def normalise_source_code_from_pdf(pdf_path: Path) -> str:
    return pdf_path.stem.strip().lower()


def main() -> None:
    if not SOURCE_PDF_DIR.exists():
        raise FileNotFoundError(f"Missing local folder: {SOURCE_PDF_DIR}")

    pdf_paths = sorted(SOURCE_PDF_DIR.glob("*.pdf"))

    if not pdf_paths:
        print("No local PDFs found.")
        return

    uploaded_count = 0
    skipped_existing_count = 0
    updated_db_count = 0
    missing_db_codes: list[str] = []

    with get_connection() as conn:
        for pdf_path in pdf_paths:
            source_code = normalise_source_code_from_pdf(pdf_path)
            object_key = build_source_pdf_object_key(source_code, pdf_path.name)

            print(f"\n{source_code}: {pdf_path.name}")
            print(f"  object_key: {object_key}")

            if object_exists_in_r2(object_key):
                print("  R2: already exists, skipped upload")
                skipped_existing_count += 1
            else:
                upload_file_to_r2(pdf_path, object_key)
                print("  R2: uploaded")
                uploaded_count += 1

            cursor = conn.execute(
                """
                update sources
                set private_pdf_object_key = ?
                where lower(trim(source_code)) = lower(trim(?))
                """,
                (object_key, source_code),
            )

            if cursor.rowcount == 0:
                missing_db_codes.append(source_code)
                print("  DB: no matching source_code found")
            else:
                updated_db_count += int(cursor.rowcount)
                print("  DB: private_pdf_object_key updated")

        conn.commit()

    usage = get_r2_storage_usage()

    print("\nDone.")
    print(f"Uploaded new objects: {uploaded_count}")
    print(f"Skipped existing objects: {skipped_existing_count}")
    print(f"Updated DB source records: {updated_db_count}")
    print(f"R2 object count: {usage['object_count']}")
    print(f"R2 total MB: {usage['total_mb']:.3f}")
    print(f"R2 total GB: {usage['total_gb']:.6f}")

    if missing_db_codes:
        print("\nPDFs with no matching DB source_code:")
        for code in missing_db_codes:
            print(f"- {code}")


if __name__ == "__main__":
    main()
