from __future__ import annotations

from pathlib import Path
import csv
import re
from typing import Any
from datetime import datetime

from db import get_connection


BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent

OUTPUT_CSV_PATH = REPO_ROOT / "data" / "sites.csv"
PUBLISH_BATCH_DIR = REPO_ROOT / "data" / "publish_batches"


BASE_SITE_COLUMNS = [
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
]

def clean_value(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()

def get_live_published_site_ids(output_path: Path = OUTPUT_CSV_PATH) -> set[str]:
    if not output_path.exists():
        return set()

    with output_path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        return {
            clean_value(row.get("site_id", ""))
            for row in reader
            if clean_value(row.get("site_id", ""))
        }


def get_next_publish_batch_path(
    batch_dir: Path = PUBLISH_BATCH_DIR,
    publish_date: datetime | None = None,
) -> Path:
    batch_dir.mkdir(parents=True, exist_ok=True)

    publish_date = publish_date or datetime.now()
    date_text = publish_date.strftime("%Y%m%d")

    existing_paths = list(batch_dir.glob(f"publish_batch??_{date_text}.csv"))

    existing_numbers: list[int] = []

    for path in existing_paths:
        match = re.match(rf"publish_batch(\d{{2}})_{date_text}\.csv$", path.name)
        if match:
            existing_numbers.append(int(match.group(1)))

    next_number = max(existing_numbers, default=0) + 1

    return batch_dir / f"publish_batch{next_number:02d}_{date_text}.csv"


def write_website_csv(
    output_path: Path,
    export_rows: list[dict[str, str]],
    fieldnames: list[str],
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(export_rows)


def source_export_value(row: Any) -> str:
    """
    Public website export should reference the stable source code only.

    Private/local PDF paths and raw source URLs must not be written into
    data/sites.csv. Public citation/URL metadata belongs in data/sources_public.csv.
    """
    return clean_value(row["source_code"])


def get_publishable_sites() -> list[dict[str, Any]]:
    """
    Returns one row per curated site for the publish selector.
    This is only for the frontend preview/selection table.
    """
    with get_connection() as conn:
        rows = conn.execute(
            """
            select
                sites.id as site_db_id,
                sites.site_id,
                sites.site_label,
                sites.site_type,
                sites.latitude,
                sites.longitude,
                sites.modern_country_location,
                sites.administering_country,
                sites.region_category,
                sites.metal,
                sites.exposure_period,
                count(site_sources.id) as source_count
            from sites
            left join site_sources on site_sources.site_fk = sites.id
            group by sites.id
            order by sites.site_id
            """
        ).fetchall()

    publishable_sites: list[dict[str, Any]] = []

    for row in rows:
        row_dict = dict(row)

        publishable_sites.append(
            {
                "publish": False,
                "site_db_id": str(row_dict.get("site_db_id", "")),
                "site_id": clean_value(row_dict.get("site_id", "")),
                "site_label": clean_value(row_dict.get("site_label", "")),
                "site_type": clean_value(row_dict.get("site_type", "")),
                "latitude": clean_value(row_dict.get("latitude", "")),
                "longitude": clean_value(row_dict.get("longitude", "")),
                "modern_country_location": clean_value(
                    row_dict.get("modern_country_location", "")
                ),
                "administering_country": clean_value(
                    row_dict.get("administering_country", "")
                ),
                "region_category": clean_value(row_dict.get("region_category", "")),
                "metal": clean_value(row_dict.get("metal", "")),
                "exposure_period": clean_value(row_dict.get("exposure_period", "")),
                "source_count": str(row_dict.get("source_count", "")),
            }
        )

    return publishable_sites


def get_site_rows_for_publish(site_db_ids: list[int]) -> list[Any]:
    if not site_db_ids:
        return []

    placeholders = ", ".join(["?"] * len(site_db_ids))

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            select
                id,
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
            from sites
            where id in ({placeholders})
            order by site_id
            """,
            [int(site_db_id) for site_db_id in site_db_ids],
        ).fetchall()

    return rows


def get_site_sources_by_site_id(site_db_ids: list[int]) -> dict[int, list[Any]]:
    if not site_db_ids:
        return {}

    placeholders = ", ".join(["?"] * len(site_db_ids))

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            select
                site_sources.site_fk as site_db_id,
                site_sources.source_order as source_order,
                sources.source_code as source_code,
                sources.source_url as source_url,
                sources.local_file_name as local_file_name
            from site_sources
            join sources on sources.id = site_sources.source_fk
            where site_sources.site_fk in ({placeholders})
            order by
                site_sources.site_fk,
                site_sources.source_order,
                sources.source_code
            """,
            [int(site_db_id) for site_db_id in site_db_ids],
        ).fetchall()

    grouped: dict[int, list[Any]] = {}

    for row in rows:
        site_db_id = int(row["site_db_id"])
        grouped.setdefault(site_db_id, []).append(row)

    return grouped


def build_website_rows(site_db_ids: list[int]) -> tuple[list[dict[str, str]], list[str]]:
    site_rows = get_site_rows_for_publish(site_db_ids)
    site_sources = get_site_sources_by_site_id(site_db_ids)

    max_source_count = 0
    export_rows: list[dict[str, str]] = []

    for site in site_rows:
        site_db_id = int(site["id"])
        source_rows = site_sources.get(site_db_id, [])

        max_source_count = max(max_source_count, len(source_rows))

        export_row = {
            "site_id": clean_value(site["site_id"]),
            "site_label": clean_value(site["site_label"]),
            "site_type": clean_value(site["site_type"]),
            "latitude": clean_value(site["latitude"]),
            "longitude": clean_value(site["longitude"]),
            "modern_country_location": clean_value(site["modern_country_location"]),
            "administering_country": clean_value(site["administering_country"]),
            "former_entity": clean_value(site["former_entity"]),
            "region_category": clean_value(site["region_category"]),
            "exposure_period": clean_value(site["exposure_period"]),
            "metal": clean_value(site["metal"]),
            "notes": clean_value(site["notes"]),
        }

        for source_index, source_row in enumerate(source_rows, start=1):
            export_row[f"source_{source_index}"] = source_export_value(source_row)

        export_rows.append(export_row)

    source_columns = [
        f"source_{index}"
        for index in range(1, max_source_count + 1)
    ]

    fieldnames = BASE_SITE_COLUMNS + source_columns + ["notes"]

    for row in export_rows:
        for fieldname in fieldnames:
            row.setdefault(fieldname, "")

    return export_rows, fieldnames


def publish_selected_sites_csv(
    site_db_ids: list[int],
    output_path: Path = OUTPUT_CSV_PATH,
) -> dict[str, int | str]:
    if not site_db_ids:
        raise ValueError("No sites selected for publishing.")

    export_rows, fieldnames = build_website_rows(site_db_ids)

    seen_site_ids: set[str] = set()
    duplicate_site_ids: set[str] = set()

    for row in export_rows:
        site_id = row.get("site_id", "").strip()

        if not site_id:
            continue

        if site_id in seen_site_ids:
            duplicate_site_ids.add(site_id)

        seen_site_ids.add(site_id)

    if duplicate_site_ids:
        duplicate_text = ", ".join(sorted(duplicate_site_ids))
        raise ValueError(f"Duplicate site_id values detected: {duplicate_text}")

    batch_path = get_next_publish_batch_path()

    # Live website file read by index.html
    write_website_csv(output_path, export_rows, fieldnames)

    # Archived snapshot of this publish event
    write_website_csv(batch_path, export_rows, fieldnames)

    return {
        "rows": len(export_rows),
        "columns": len(fieldnames),
        "live_path": str(output_path),
        "batch_path": str(batch_path),
        "batch_name": batch_path.name,
    }