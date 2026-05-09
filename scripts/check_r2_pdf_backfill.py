from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path.cwd()
CURATOR_DIR = REPO_ROOT / "curator"

if str(CURATOR_DIR) not in sys.path:
    sys.path.insert(0, str(CURATOR_DIR))

from db import get_connection

with get_connection() as conn:
    rows = conn.execute(
        """
        select source_code, private_pdf_object_key
        from sources
        order by source_code
        """
    ).fetchall()

missing = [
    str(row["source_code"])
    for row in rows
    if not str(row.get("private_pdf_object_key") or "").strip()
]

print(f"Total sources: {len(rows)}")
print(f"Sources without private_pdf_object_key: {len(missing)}")

if missing:
    print("Missing:")
    for code in missing:
        print(f"- {code}")
