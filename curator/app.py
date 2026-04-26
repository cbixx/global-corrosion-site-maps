from __future__ import annotations

from pathlib import Path
from typing import Any, cast
import re

import pandas as pd
import pycountry
import streamlit as st
from geopy.geocoders import Nominatim
from geopy.location import Location

from db import (
    DB_PATH,
    add_metadata_options,
    bulk_update_table_rows,
    bulk_upsert_site_source_links,
    bulk_update_source_metadata,
    delete_site_source_links,
    delete_table_rows,
    ensure_schema_updates,
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
)

from importer import build_import_preview
from exporter import (
    OUTPUT_CSV_PATH,
    get_live_published_site_ids,
    get_publishable_sites,
    publish_selected_sites_csv,
)
from region_classifier import classify_region_category

def get_geolocator() -> Nominatim:
    return Nominatim(user_agent="corrosion_map_curator")


def search_locations(query: str, limit: int = 5) -> list[dict[str, Any]]:
    query = query.strip()
    if not query:
        return []

    geolocator: Any = get_geolocator()
    raw_results = geolocator.geocode(
        query,
        exactly_one=False,
        limit=limit,
        addressdetails=True,
        language="en",
    )

    if raw_results is None:
        return []

    results = cast(list[Location], raw_results)

    suggestions: list[dict[str, Any]] = []
    for result in results:
        address = getattr(result, "raw", {}).get("address", {})

        city = (
            address.get("city")
            or address.get("town")
            or address.get("village")
            or address.get("municipality")
            or address.get("county")
            or ""
        )
        country = address.get("country", "")

        if city and country:
            clean_label = f"{city}, {country}"
        elif country:
            clean_label = country
        else:
            clean_label = result.address

        suggestions.append(
            {
                "label": clean_label,
                "full_label": result.address,
                "latitude": result.latitude,
                "longitude": result.longitude,
                "country": country,
            }
        )

    return suggestions

REGION_TAG_OPTIONS = [
    "Coastal",
    "Inland",
    "Island",
    "Marine",
    "Urban",
    "Rural",
    "Industrial",
    "Sub-arctic",
    "Sub-Antarctic",
]

REGION_TAG_ORDER = {
    "Coastal": 1,
    "Inland": 2,
    "Island": 3,
    "Marine": 4,
    "Urban": 5,
    "Rural": 6,
    "Industrial": 7,
    "Sub-arctic": 8,
    "Sub-Antarctic": 9,
}

def normalize_region_category(selected_tags: list[str]) -> str:
    cleaned = [tag.strip() for tag in selected_tags if tag and tag.strip()]
    unique_tags = list(dict.fromkeys(cleaned))
    sorted_tags = sorted(unique_tags, key=lambda tag: REGION_TAG_ORDER.get(tag, 999))
    return ", ".join(sorted_tags)

SITE_TYPE_OPTIONS = [
    "",
    "Cape site",
    "Cathedral",
    "City",
    "Field site",
    "Industrial Locality",
    "Industrial site",
    "Island",
    "Locality",
    "Monitoring site",
    "National Park",
    "Point site",
    "Port city",
    "Research Park",
    "Research centre",
    "Research station",
    "Rural",
    "Rural monitoring site",
    "Settlement",
    "Sub-Antarctic Islands",
    "Sub-arctic test site",
    "Test site",
    "Town",
    "Village",
    "Waterfall locality",
    "Other / custom",
]

FORMER_ENTITY_OPTIONS = [
    "",
    "Czechoslovakia",
    "USSR",
    "Other / custom",
]

PROGRAMME_OPTIONS = [
    "",
    "ICP/UNECE",
    "MICAT",
    "ISOCORRAG",
    "Other / independent",
]

METAL_OPTIONS = [
    "Carbon steel",
    "Weathering steel",
    "Zinc",
    "Copper",
    "Aluminium",
    "Galvanized steel",
    "Lead",
    "Nickel",
    "Tin",
    "Brass",
    "Bronze",
]

EXPOSURE_PERIOD_OPTIONS = [
    "1 month",
    "3 months",
    "6 months",
    "1 year",
    "2 years",
    "3 years",
    "4 years",
    "5 years",
    "8 years",
    "10 years",
]

def normalize_exposure_period_selection(selected_periods: list[str]) -> str:
    cleaned_periods = [
        period.strip()
        for period in selected_periods
        if period and period.strip()
    ]

    unique_periods = list(dict.fromkeys(cleaned_periods))
    return ", ".join(unique_periods)

def normalize_metal_selection(selected_metals: list[str]) -> str:
    cleaned_metals = [
        metal.strip()
        for metal in selected_metals
        if metal and metal.strip()
    ]

    unique_metals = list(dict.fromkeys(cleaned_metals))
    return ", ".join(unique_metals)

def merge_option_values(*option_groups: list[str], include_blank: bool = False) -> list[str]:
    merged: list[str] = []

    if include_blank:
        merged.append("")

    for option_group in option_groups:
        for option in option_group:
            option = str(option).strip()
            if not option:
                continue
            if option not in merged:
                merged.append(option)

    return merged


def get_programme_options(include_blank: bool = False) -> list[str]:
    try:
        saved_programmes = get_metadata_options("programme")
    except Exception:
        saved_programmes = []

    return merge_option_values(
        PROGRAMME_OPTIONS,
        saved_programmes,
        include_blank=include_blank,
    )


def get_metal_options() -> list[str]:
    try:
        saved_metals = get_metadata_options("metal")
    except Exception:
        saved_metals = []

    return merge_option_values(
        METAL_OPTIONS,
        saved_metals,
        include_blank=False,
    )


def normalize_programme_selection(selected_programmes: list[str]) -> str:
    cleaned_programmes = [
        programme.strip()
        for programme in selected_programmes
        if programme and programme.strip()
    ]

    unique_programmes = list(dict.fromkeys(cleaned_programmes))
    return ", ".join(unique_programmes)


def resolve_option_value(selected_option: str, custom_value: str) -> str:
    if selected_option == "Other / custom":
        return custom_value.strip()
    return selected_option.strip()

ANTARCTIC_LOCATION_NAMES = {
    "Antarctica",
    "Sub-Antarctic Islands",
}

COUNTRY_CODE_NAME_OVERRIDES = {
    "Russia": "RU",
    "United States": "US",
    "United Kingdom": "GB",
    "South Korea": "KR",
    "North Korea": "KP",
    "Czech Republic": "CZ",
    "Bolivia": "BO",
    "Venezuela": "VE",
    "Iran": "IR",
    "Syria": "SY",
    "Tanzania": "TZ",
    "Moldova": "MD",
    "Laos": "LA",
    "Vietnam": "VN",
}


def normalize_location_name(value: str) -> str:
    return (value or "").strip()


def get_country_code(location_name: str) -> str:
    location_name = normalize_location_name(location_name)

    if not location_name:
        return ""

    if location_name in ANTARCTIC_LOCATION_NAMES:
        return "AQ"

    if location_name in COUNTRY_CODE_NAME_OVERRIDES:
        return COUNTRY_CODE_NAME_OVERRIDES[location_name]

    # Try exact pycountry lookup.
    try:
        country = pycountry.countries.lookup(location_name)
        return country.alpha_2.upper()
    except LookupError:
        pass

    # Try comma-separated values, e.g. "Berlin, Germany" -> Germany.
    if "," in location_name:
        last_part = location_name.split(",")[-1].strip()
        if last_part and last_part != location_name:
            return get_country_code(last_part)

    return ""


def build_site_id_prefix(
    modern_country_location: str,
    administering_country: str = "",
) -> str:
    modern_country_location = normalize_location_name(modern_country_location)
    administering_country = normalize_location_name(administering_country)

    location_code = get_country_code(modern_country_location)

    if location_code == "AQ":
        admin_code = get_country_code(administering_country)
        if admin_code:
            return f"AQ-{admin_code}"
        return "AQ"

    return location_code or "XX"

REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_PDF_DIR = REPO_ROOT / "source_pdfs"
SOURCE_PDF_RELATIVE_DIR = "source_pdfs"


def make_safe_file_stem(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9_-]+", "_", value)
    value = re.sub(r"_+", "_", value).strip("_")
    return value or "source"


def save_uploaded_source_pdf(uploaded_file, source_code: str) -> tuple[str, str]:
    SOURCE_PDF_DIR.mkdir(parents=True, exist_ok=True)

    safe_stem = make_safe_file_stem(source_code)
    file_name = f"{safe_stem}.pdf"
    file_path = SOURCE_PDF_DIR / file_name

    counter = 2
    while file_path.exists():
        file_name = f"{safe_stem}_{counter}.pdf"
        file_path = SOURCE_PDF_DIR / file_name
        counter += 1

    file_path.write_bytes(uploaded_file.getbuffer())

    relative_url = f"{SOURCE_PDF_RELATIVE_DIR}/{file_name}"
    return file_name, relative_url


def list_source_pdf_files() -> list[Path]:
    if not SOURCE_PDF_DIR.exists():
        return []

    return sorted(SOURCE_PDF_DIR.glob("*.pdf"))


def source_code_from_pdf_path(pdf_path: Path) -> str:
    return pdf_path.stem.strip()

def clean_editor_value(value):
    if pd.isna(value):
        return ""
    return value

def split_chip_values(value) -> list[str]:
    if value is None:
        return []

    if isinstance(value, list):
        raw_items = value
    else:
        if pd.isna(value):
            return []

        text = str(value).strip()

        if not text or text.lower() == "none":
            return []

        text = text.replace(";", ",")
        raw_items = text.split(",")

    cleaned_items = [
        str(item).strip()
        for item in raw_items
        if str(item).strip()
    ]

    return list(dict.fromkeys(cleaned_items))

def join_chip_values(value) -> str:
    return ", ".join(split_chip_values(value))

def build_row_label(row: dict, table_name: str) -> str:
    if table_name == "sites":
        return f"{row['id']} — {row.get('site_id', '')} — {row.get('site_label', '')}"

    if table_name == "sources":
        return f"{row['id']} — {row.get('source_code', '')} — {row.get('source_title', '') or row.get('local_file_name', '')}"

    return str(row["id"])

SITE_FORM_KEYS = [
    "site_label_input",
    "site_type_select",
    "custom_site_type_input",
    "site_latitude",
    "site_longitude",
    "site_modern_country_location",
    "administering_country_input",
    "site_id_input",
    "last_suggested_site_id",
    "former_entity_select",
    "custom_former_entity_input",
    "region_tags_select",
    "exposure_period_input",
    "metals_select",
    "site_notes_input",
]

SOURCE_METADATA_FORM_KEYS = [
    "combined_source_metadata_selected_sources",
    "combined_update_programme_checkbox",
    "combined_update_material_exposure_checkbox",
    "combined_programme_to_apply",
    "combined_assign_source_metals",
    "combined_assign_source_exposure_periods",
    "combined_assign_source_metadata_mode",
]

def clear_source_metadata_form_state() -> None:
    for key in SOURCE_METADATA_FORM_KEYS:
        st.session_state.pop(key, None)

def clear_site_form_state() -> None:
    for key in SITE_FORM_KEYS:
        st.session_state.pop(key, None)

    st.session_state.location_results = []
    st.session_state.selected_location_label = None
    st.session_state.location_search_message = ""

def get_source_metadata_by_code() -> dict[str, dict[str, str]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            select source_code, programme, metals, exposure_periods
            from sources
            where source_code is not null
            """
        ).fetchall()

    metadata: dict[str, dict[str, str]] = {}

    for row in rows:
        source_code = str(row["source_code"]).strip()

        if not source_code:
            continue

        metadata[source_code] = {
            "programme": str(row["programme"] or "").strip(),
            "metals": str(row["metals"] or "").strip(),
            "exposure_periods": str(row["exposure_periods"] or "").strip(),
        }

    return metadata

def make_import_site_id_generator():
    next_number_by_prefix: dict[str, int] = {}

    def generate_site_id(
        modern_country_location: str,
        administering_country: str = "",
    ) -> str:
        prefix = build_site_id_prefix(
            modern_country_location=modern_country_location,
            administering_country=administering_country,
        )

        if not prefix:
            return ""

        if prefix not in next_number_by_prefix:
            next_site_id = get_next_site_id_for_prefix(prefix)
            match = re.search(r"-(\d+)$", next_site_id)

            if match:
                next_number_by_prefix[prefix] = int(match.group(1))
            else:
                next_number_by_prefix[prefix] = 1

        number = next_number_by_prefix[prefix]
        next_number_by_prefix[prefix] += 1

        return f"{prefix}-{number:03d}"

    return generate_site_id

def merge_unique_text_values(values) -> str:
    merged: list[str] = []

    for value in values:
        for item in split_chip_values(value):
            if item not in merged:
                merged.append(item)

    return ", ".join(merged)


def get_source_order_from_column(source_column: str) -> int:
    match = re.search(r"(\d+)$", str(source_column or ""))

    if match:
        return int(match.group(1))

    return 1


def build_site_level_import_preview(detail_df: pd.DataFrame) -> pd.DataFrame:
    if detail_df.empty:
        return detail_df

    rows: list[dict[str, Any]] = []

    for _, group in detail_df.groupby("site_id", sort=False, dropna=False):
        first = group.iloc[0]

        source_codes = [
            str(value).strip()
            for value in group.get("source_code", [])
            if str(value).strip()
        ]

        rows.append(
            {
                "import_selected": bool(group["import_selected"].astype(bool).any()),
                "csv_rows": merge_unique_text_values(group["csv_row"].astype(str).tolist()),
                "site_action": first.get("site_action", ""),
                "site_id": first.get("site_id", ""),
                "site_label": first.get("site_label", ""),
                "site_type": first.get("site_type", ""),
                "latitude": first.get("latitude", ""),
                "longitude": first.get("longitude", ""),
                "modern_country_location": first.get("modern_country_location", ""),
                "administering_country": first.get("administering_country", ""),
                "former_entity": first.get("former_entity", ""),
                "region_category": first.get("region_category", ""),
                "source_count": len(list(dict.fromkeys(source_codes))),
                "source_codes": merge_unique_text_values(group.get("source_code", [])),
                "programmes": merge_unique_text_values(group.get("programme", [])),
                "link_actions": merge_unique_text_values(group.get("link_action", [])),
                "metadata_basis": merge_unique_text_values(group.get("metadata_source", [])),
                "metals": merge_unique_text_values(group.get("link_metals", [])),
                "exposure_periods": merge_unique_text_values(
                    group.get("link_exposure_periods", [])
                ),
                "notes": first.get("notes", ""),
                "warnings": merge_unique_text_values(group.get("warnings", [])),
            }
        )

    return pd.DataFrame(rows)


def apply_site_preview_edits_to_detail(
    original_site_preview_df: pd.DataFrame,
    edited_site_preview_df: pd.DataFrame,
    detail_df: pd.DataFrame,
) -> pd.DataFrame:
    updated_detail_df = detail_df.copy()

    editable_site_columns = [
        "site_id",
        "site_label",
        "site_type",
        "latitude",
        "longitude",
        "modern_country_location",
        "administering_country",
        "former_entity",
        "region_category",
        "notes",
    ]

    for row_position in range(len(edited_site_preview_df)):
        original_site_id = str(
            original_site_preview_df.iloc[row_position].get("site_id", "")
        ).strip()

        edited_row = edited_site_preview_df.iloc[row_position]

        mask = updated_detail_df["site_id"].astype(str).str.strip().eq(original_site_id)

        if "import_selected" in edited_row:
            updated_detail_df.loc[mask, "import_selected"] = bool(
                edited_row.get("import_selected")
            )

        for column in editable_site_columns:
            if column in edited_row and column in updated_detail_df.columns:
                updated_detail_df.loc[mask, column] = str(
                    edited_row.get(column, "")
                ).strip()

    return updated_detail_df


def upsert_site_from_import_row(row: pd.Series) -> int:
    site_id = str(row.get("site_id", "")).strip()

    if not site_id:
        raise ValueError("Cannot import site without site_id.")

    latitude = float(str(row.get("latitude", "")).strip())
    longitude = float(str(row.get("longitude", "")).strip())

    values = {
        "site_id": site_id,
        "site_label": str(row.get("site_label", "")).strip(),
        "site_type": str(row.get("site_type", "")).strip(),
        "latitude": latitude,
        "longitude": longitude,
        "modern_country_location": str(row.get("modern_country_location", "")).strip(),
        "administering_country": str(row.get("administering_country", "")).strip(),
        "former_entity": str(row.get("former_entity", "")).strip(),
        "region_category": str(row.get("region_category", "")).strip(),
        "exposure_period": str(row.get("exposure_period", "")).strip(),
        "metal": str(row.get("metal", "")).strip(),
        "notes": str(row.get("notes", "")).strip(),
    }

    with get_connection() as conn:
        existing = conn.execute(
            "select id from sites where site_id = ?",
            (site_id,),
        ).fetchone()

        if existing:
            site_db_id = int(existing["id"])

            conn.execute(
                """
                update sites
                set site_label = ?,
                    site_type = ?,
                    latitude = ?,
                    longitude = ?,
                    modern_country_location = ?,
                    administering_country = ?,
                    former_entity = ?,
                    region_category = ?,
                    exposure_period = ?,
                    metal = ?,
                    notes = ?
                where id = ?
                """,
                (
                    values["site_label"],
                    values["site_type"],
                    values["latitude"],
                    values["longitude"],
                    values["modern_country_location"],
                    values["administering_country"],
                    values["former_entity"],
                    values["region_category"],
                    values["exposure_period"],
                    values["metal"],
                    values["notes"],
                    site_db_id,
                ),
            )

            conn.commit()
            return site_db_id

        cursor = conn.execute(
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
                values["site_id"],
                values["site_label"],
                values["site_type"],
                values["latitude"],
                values["longitude"],
                values["modern_country_location"],
                values["administering_country"],
                values["former_entity"],
                values["region_category"],
                values["exposure_period"],
                values["metal"],
                values["notes"],
            ),
        )

        inserted_site_id = cursor.lastrowid

        if inserted_site_id is None:
            raise RuntimeError("Could not determine inserted site ID after import.")

        conn.commit()
        return int(inserted_site_id)


def upsert_source_from_import_row(row: pd.Series) -> int | None:
    source_code = str(row.get("source_code", "")).strip()

    if not source_code:
        return None

    programme = str(row.get("programme", "")).strip()
    source_url = str(row.get("source_url", "")).strip()
    local_file_name = str(row.get("local_file_name", "")).strip()
    metals = str(row.get("link_metals", "")).strip()
    exposure_periods = str(row.get("link_exposure_periods", "")).strip()

    with get_connection() as conn:
        existing = conn.execute(
            """
            select id, programme, metals, exposure_periods, source_url, local_file_name
            from sources
            where source_code = ?
            """,
            (source_code,),
        ).fetchone()

        if existing:
            source_db_id = int(existing["id"])

            conn.execute(
                """
                update sources
                set programme = ?,
                    metals = ?,
                    exposure_periods = ?,
                    source_url = ?,
                    local_file_name = ?
                where id = ?
                """,
                (
                    existing["programme"] or programme,
                    existing["metals"] or metals,
                    existing["exposure_periods"] or exposure_periods,
                    existing["source_url"] or source_url,
                    existing["local_file_name"] or local_file_name,
                    source_db_id,
                ),
            )

            conn.commit()
            return source_db_id

        cursor = conn.execute(
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
                source_code,
                source_code,
                programme,
                metals,
                exposure_periods,
                local_file_name,
                source_url,
                "Imported from CSV.",
            ),
        )

        inserted_source_id = cursor.lastrowid

        if inserted_source_id is None:
            raise RuntimeError("Could not determine inserted source ID after import.")

        conn.commit()
        return int(inserted_source_id)


def confirm_import_preview(import_df: pd.DataFrame) -> dict[str, int]:
    selected_df = import_df[import_df["import_selected"].astype(bool)].copy()

    if selected_df.empty:
        return {
            "sites": 0,
            "sources": 0,
            "links": 0,
        }

    imported_site_ids: list[int] = []
    site_count = 0
    source_count = 0
    link_count = 0

    for site_id, site_group in selected_df.groupby("site_id", sort=False):
        site_row = site_group.iloc[0].copy()

        merged_site_metals = merge_unique_text_values(site_group.get("link_metals", []))
        merged_site_exposures = merge_unique_text_values(
            site_group.get("link_exposure_periods", [])
        )

        if merged_site_metals:
            site_row["metal"] = merged_site_metals

        if merged_site_exposures:
            site_row["exposure_period"] = merged_site_exposures

        site_db_id = upsert_site_from_import_row(site_row)
        imported_site_ids.append(site_db_id)
        site_count += 1

        for _, link_row in site_group.iterrows():
            source_code = str(link_row.get("source_code", "")).strip()

            if not source_code:
                continue

            source_db_id = upsert_source_from_import_row(link_row)

            if source_db_id is None:
                continue

            source_count += 1

            changed_links = bulk_upsert_site_source_links(
                site_ids=[site_db_id],
                source_ids=[source_db_id],
                source_order=get_source_order_from_column(
                    str(link_row.get("source_column", ""))
                ),
                metals=str(link_row.get("link_metals", "")).strip(),
                exposure_periods=str(link_row.get("link_exposure_periods", "")).strip(),
                notes=str(link_row.get("notes", "")).strip(),
            )

            link_count += changed_links

    if imported_site_ids:
        merge_metadata_for_multiple_sites(imported_site_ids)

    return {
        "sites": site_count,
        "sources": source_count,
        "links": link_count,
    }

def build_site_option_label(row: dict) -> str:
    site_id = row.get("site_id", "")
    site_label = row.get("site_label", "")
    country = row.get("modern_country_location", "")

    if country:
        return f"{row['id']} — {site_id} — {site_label} ({country})"

    return f"{row['id']} — {site_id} — {site_label}"


def build_source_option_label(row: dict) -> str:
    source_code = row.get("source_code", "")
    source_title = row.get("source_title", "") or "Untitled source"
    programme = row.get("programme", "") or "No programme"

    return f"{row['id']} — {source_code} — {source_title} [{programme}]"


def extract_row_id_from_label(label: str) -> int:
    return int(label.split(" — ")[0])

def get_existing_site_source_pairs() -> set[tuple[str, str]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            select
                sites.site_id as site_id,
                sources.source_code as source_code
            from site_sources
            join sites on site_sources.site_fk = sites.id
            join sources on site_sources.source_fk = sources.id
            """
        ).fetchall()

    return {
        (str(row["site_id"]), str(row["source_code"]))
        for row in rows
    }

def get_site_link_summary_by_site_db_id() -> dict[int, dict[str, str]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            select
                sites.id as site_db_id,
                sources.source_code as source_code,
                sources.programme as programme
            from sites
            left join site_sources on site_sources.site_fk = sites.id
            left join sources on sources.id = site_sources.source_fk
            order by sites.id, site_sources.source_order, sources.source_code
            """
        ).fetchall()

    summary: dict[int, dict[str, str]] = {}

    for row in rows:
        site_db_id = int(row["site_db_id"])

        if site_db_id not in summary:
            summary[site_db_id] = {
                "source_codes": "",
                "programmes": "",
            }

        source_code = str(row["source_code"] or "").strip()
        programme = str(row["programme"] or "").strip()

        if source_code:
            summary[site_db_id]["source_codes"] = merge_unique_text_values(
                [
                    summary[site_db_id]["source_codes"],
                    source_code,
                ]
            )

        if programme:
            summary[site_db_id]["programmes"] = merge_unique_text_values(
                [
                    summary[site_db_id]["programmes"],
                    programme,
                ]
            )

    return summary

def get_existing_site_ids() -> set[str]:
    with get_connection() as conn:
        rows = conn.execute(
            "select site_id from sites where site_id is not null"
        ).fetchall()

    return {
        str(row["site_id"]).strip()
        for row in rows
        if str(row["site_id"]).strip()
    }


def set_flash_message(message: str, level: str = "success") -> None:
    st.session_state["flash_message"] = {
        "message": message,
        "level": level,
    }

def set_next_active_page(page_name: str) -> None:
    st.session_state["next_active_page"] = page_name


def show_flash_message() -> None:
    flash = st.session_state.pop("flash_message", None)

    if not flash:
        return

    message = flash.get("message", "")
    level = flash.get("level", "success")

    if level == "success":
        st.success(message)
        st.toast(message, icon="✅")
    elif level == "warning":
        st.warning(message)
        st.toast(message, icon="⚠️")
    elif level == "error":
        st.error(message)
        st.toast(message, icon="❌")
    else:
        st.info(message)
        st.toast(message, icon="ℹ️")

st.set_page_config(
    page_title="Corrosion Map Curator",
    layout="wide",
)

st.title("Corrosion Map Curator")
st.caption("Local curation app for managing sites, sources, and site-source links.")

show_flash_message()

if "location_results" not in st.session_state:
    st.session_state.location_results = []

if "selected_location_label" not in st.session_state:
    st.session_state.selected_location_label = None

if st.session_state.pop("clear_site_form_after_success", False):
    clear_site_form_state()

if st.session_state.pop("clear_source_metadata_after_success", False):
    clear_source_metadata_form_state()

if "location_search_message" not in st.session_state:
    st.session_state.location_search_message = ""

if "site_latitude" not in st.session_state:
    st.session_state.site_latitude = ""

if "site_longitude" not in st.session_state:
    st.session_state.site_longitude = ""

if "site_modern_country_location" not in st.session_state:
    st.session_state.site_modern_country_location = ""
    
def apply_selected_location() -> None:
    selected_label = st.session_state.get("selected_location_label")
    location_results = st.session_state.get("location_results", [])

    selected_location = next(
        (item for item in location_results if item["label"] == selected_label),
        None,
    )

    if not selected_location:
        return

    st.session_state.site_latitude = str(selected_location["latitude"])
    st.session_state.site_longitude = str(selected_location["longitude"])

    country = selected_location.get("country", "") or ""
    if country:
        st.session_state.site_modern_country_location = country


def run_location_search() -> None:
    query = st.session_state.get("location_query", "").strip()

    if not query:
        st.session_state.location_results = []
        st.session_state.selected_location_label = None
        st.session_state.location_search_message = "Enter a place name first."
        return

    try:
        results = search_locations(query, limit=5)
        st.session_state.location_results = results

        if results:
            st.session_state.selected_location_label = results[0]["label"]
            st.session_state.location_search_message = ""
            apply_selected_location()
        else:
            st.session_state.selected_location_label = None
            st.session_state.location_search_message = "No matching locations found."

    except Exception as exc:
        st.session_state.location_results = []
        st.session_state.selected_location_label = None
        st.session_state.location_search_message = f"Location search failed: {exc}"

try:
    ensure_schema_updates()
except Exception as exc:
    st.warning(f"Schema update check could not be completed: {exc}")


PAGE_OPTIONS = [
    "Dashboard",
    "Sources",
    "Sites",
    "Manage Records",
    "Import",
    "Export / Publish",
    "Settings",
]

if "next_active_page" in st.session_state:
    st.session_state.active_page = st.session_state.pop("next_active_page")
elif "active_page" not in st.session_state:
    st.session_state.active_page = "Dashboard"

if st.session_state.active_page not in PAGE_OPTIONS:
    st.session_state.active_page = "Dashboard"

active_page = st.segmented_control(
    "Navigation",
    options=PAGE_OPTIONS,
    key="active_page",
    selection_mode="single",
    label_visibility="collapsed",
    width="stretch",
)

if active_page is None:
    active_page = "Dashboard"


if active_page == "Dashboard":
    st.subheader("Dashboard")
    st.caption("Overview of the local curation database and source-PDF folder.")

    st.write("#### Database")
    st.write(f"Database file: `{Path(DB_PATH).resolve()}`")

    try:
        counts = table_counts()

        metric_col1, metric_col2, metric_col3 = st.columns(3)

        with metric_col1:
            st.metric("Sites", counts.get("sites", 0))

        with metric_col2:
            st.metric("Sources", counts.get("sources", 0))

        with metric_col3:
            st.metric("Site-source links", counts.get("site_sources", 0))

    except Exception as exc:
        st.error(f"Could not read database counts: {exc}")
        st.info("Go to the Settings tab and initialize the database if this is a new setup.")

    st.write("#### Source PDFs")

    existing_pdf_files = list_source_pdf_files()

    try:
        existing_source_codes = get_existing_source_codes()
    except Exception:
        existing_source_codes = set()

    missing_pdf_files = [
        pdf_path for pdf_path in existing_pdf_files
        if source_code_from_pdf_path(pdf_path) not in existing_source_codes
    ]

    pdf_col1, pdf_col2, pdf_col3 = st.columns(3)

    with pdf_col1:
        st.metric("PDF files", len(existing_pdf_files))

    with pdf_col2:
        st.metric("Unregistered PDFs", len(missing_pdf_files))

    with pdf_col3:
        st.metric("PDF folder", SOURCE_PDF_RELATIVE_DIR)

    if missing_pdf_files:
        st.warning(
            f"{len(missing_pdf_files)} PDF(s) in `source_pdfs/` are not registered yet. "
            "Go to the Sources tab to register them."
        )
    elif existing_pdf_files:
        st.success("All detected PDFs are registered as sources.")
    else:
        st.info("No PDFs found in `source_pdfs/` yet.")

    st.write("#### Workflow")
    st.markdown(
        """
        1. Register or upload source PDFs in **Sources**.
        2. Add site records in **Sites**.
        3. Correct, delete, or bulk-edit records in **Manage Records**.
        4. Later, export website-ready data in **Import / Export**.
        """
    )


if active_page == "Sources":
    st.subheader("Sources")
    st.caption("Register PDFs, add source records, and classify source programmes.")

    with st.expander("Register existing PDFs from source_pdfs/", expanded=False):
        existing_pdf_files = list_source_pdf_files()

        try:
            existing_source_codes = get_existing_source_codes()
        except Exception as exc:
            existing_source_codes = set()
            st.error(f"Could not read existing source codes: {exc}")

        missing_pdf_files = [
            pdf_path for pdf_path in existing_pdf_files
            if source_code_from_pdf_path(pdf_path) not in existing_source_codes
        ]

        if not existing_pdf_files:
            st.info("No PDFs found in `source_pdfs/`.")
        elif not missing_pdf_files:
            st.success("All PDFs in `source_pdfs/` are already registered as sources.")
        else:
            st.write(f"{len(missing_pdf_files)} unregistered PDF(s) found in `source_pdfs/`.")

            with st.expander("Preview unregistered PDFs", expanded=False):
                for pdf_path in missing_pdf_files:
                    st.write(
                        f"- `{pdf_path.name}` → source code `{source_code_from_pdf_path(pdf_path)}`"
                    )

            default_programme_for_scan = st.selectbox(
                "Programme for registered PDFs",
                options=get_programme_options(include_blank=True),
                key="register_existing_pdf_programme",
                help="This programme will be applied to all PDFs registered in this scan. Type a new value to add a new programme.",
                accept_new_options=True,
            )

            scan_programme = default_programme_for_scan.strip()

            if st.button("Register missing PDFs"):
                registered_count = 0

                for pdf_path in missing_pdf_files:
                    source_code = source_code_from_pdf_path(pdf_path)
                    local_file_name = pdf_path.name
                    source_url = f"{SOURCE_PDF_RELATIVE_DIR}/{pdf_path.name}"

                    try:
                        insert_source(
                            source_code=source_code,
                            source_title=source_code,
                            programme=scan_programme,
                            local_file_name=local_file_name,
                            source_url=source_url,
                            notes="Registered automatically from source_pdfs folder.",
                        )
                        registered_count += 1
                    except Exception as exc:
                        st.warning(f"Could not register `{pdf_path.name}`: {exc}")

                set_next_active_page("Sources")
                add_metadata_options("programme", split_chip_values(scan_programme))
                set_flash_message(f"Registered {registered_count} PDF source(s).")
                st.rerun()

    st.divider()

    st.write("### Add source")

    with st.form("add_source_form", clear_on_submit=True):
        source_code = st.text_input("Source code", placeholder="e.g. s017")
        source_title = st.text_input("Source title", placeholder="Paper/report title")

        selected_programme = st.selectbox(
            "Source programme",
            options=get_programme_options(include_blank=True),
            help="Classify the source by major corrosion exposure programme where applicable. Type a new value to add a new programme.",
            accept_new_options=True,
        )

        source_programme = selected_programme.strip()

        selected_source_metals = st.multiselect(
            "Metal(s) covered by this source",
            options=get_metal_options(),
            help=(
                "Required. These become default metals when this source is linked to a site. "
                "Type a new value and press Enter to add a new metal."
            ),
            key="add_source_metals",
            accept_new_options=True,
        )

        source_metals = normalize_metal_selection(selected_source_metals)

        selected_source_exposure_periods = st.multiselect(
            "Exposure period(s) covered by this source",
            options=EXPOSURE_PERIOD_OPTIONS,
            help=(
                "Required. These become default exposure periods when this source is linked to a site. "
                "Type a new value and press Enter to add a custom duration."
            ),
            key="add_source_exposure_periods",
            accept_new_options=True,
        )

        source_exposure_periods = normalize_exposure_period_selection(
            selected_source_exposure_periods
        )

        uploaded_pdf = st.file_uploader(
            "Upload source PDF",
            type=["pdf"],
            help="The PDF will be copied into source_pdfs/ and linked from the website later.",
        )

        external_url = st.text_input(
            "External URL",
            placeholder="Optional. If a PDF is uploaded, the uploaded PDF path will be used.",
        )

        source_notes = st.text_area("Source notes", placeholder="Optional notes")

        submit_source = st.form_submit_button("Add source")

        if submit_source:
            if not source_code.strip():
                st.error("Source code is required.")
            elif not source_metals.strip():
                st.error("At least one source metal is required.")
            elif not source_exposure_periods.strip():
                st.error("At least one source exposure period is required.")
            else:
                try:
                    local_file_name = ""
                    source_url = external_url.strip()

                    if uploaded_pdf is not None:
                        local_file_name, source_url = save_uploaded_source_pdf(
                            uploaded_pdf,
                            source_code,
                        )

                    insert_source(
                        source_code=source_code,
                        source_title=source_title,
                        programme=source_programme,
                        metals=source_metals,
                        exposure_periods=source_exposure_periods,
                        local_file_name=local_file_name,
                        source_url=source_url,
                        notes=source_notes,
                    )

                    set_next_active_page("Sources")
                    add_metadata_options("programme", split_chip_values(source_programme))
                    add_metadata_options("metal", split_chip_values(source_metals))
                    set_flash_message(f"Source '{source_code.strip()}' added successfully.")
                    st.rerun()

                except Exception as exc:
                    st.error(f"Could not add source: {exc}")

    st.divider()

    with st.expander("Assign programme, metals, and exposure periods to existing sources", expanded=True):
        
        try:
            with get_connection() as conn:
                source_rows = conn.execute(
                    """
                    select id, source_code, source_title, programme, metals, exposure_periods
                    from sources
                    order by source_code
                    """
                ).fetchall()

            source_records = [dict(row) for row in source_rows]

        except Exception as exc:
            source_records = []
            st.error(f"Could not load sources: {exc}")

        if not source_records:
            st.info("No sources available yet. Add or register sources first.")
        else:
            source_labels = []
            source_label_to_id = {}
            source_label_to_code = {}

            for row in source_records:
                source_code = row["source_code"]
                source_title = row["source_title"] or "Untitled"
                programme = row["programme"] or "No programme"

                label = f"{source_code} — {source_title} [{programme}]"

                source_labels.append(label)
                source_label_to_id[label] = int(row["id"])
                source_label_to_code[label] = source_code

            source_selection_key = "combined_source_metadata_selected_sources"

            if source_selection_key not in st.session_state:
                st.session_state[source_selection_key] = []

            col_select_sources, col_clear_sources = st.columns(2)

            with col_select_sources:
                if st.button("Select all sources", key="select_all_combined_source_metadata"):
                    st.session_state[source_selection_key] = source_labels

            with col_clear_sources:
                if st.button("Deselect all sources", key="deselect_all_combined_source_metadata"):
                    st.session_state[source_selection_key] = []

            selected_source_labels = st.multiselect(
                "Choose source(s) to update",
                options=source_labels,
                key=source_selection_key,
            )

            selected_source_ids = [
                source_label_to_id[label]
                for label in selected_source_labels
            ]

            selected_source_codes = [
                source_label_to_code[label]
                for label in selected_source_labels
            ]

            if selected_source_ids:
                selected_preview = [
                    row for row in source_records
                    if int(row["id"]) in selected_source_ids
                ]

                st.caption("Current metadata for selected source(s):")
                st.dataframe(
                    pd.DataFrame(selected_preview)[
                        [
                            "source_code",
                            "source_title",
                            "programme",
                            "metals",
                            "exposure_periods",
                        ]
                    ],
                    width="stretch",
                )

            st.write("#### Metadata to assign")

            apply_programme_update = st.checkbox(
                "Update programme",
                value=True,
                key="combined_update_programme_checkbox",
            )

            apply_material_exposure_update = st.checkbox(
                "Update metals and exposure periods",
                value=False,
                key="combined_update_material_exposure_checkbox",
            )

            programme_to_apply = ""

            if apply_programme_update:
                selected_programmes_to_apply = st.multiselect(
                    "Programme(s) to assign",
                    options=get_programme_options(include_blank=False),
                    key="combined_programme_to_apply",
                    help="Choose programme(s), or type a new value and press Enter.",
                    accept_new_options=True,
                )

                programme_to_apply = normalize_programme_selection(selected_programmes_to_apply)

                if programme_to_apply:
                    st.caption(f"Programme field to apply: {programme_to_apply}")

            source_metals = ""
            source_exposure_periods = ""
            update_mode = "merge"

            if apply_material_exposure_update:
                selected_source_metals = st.multiselect(
                    "Metal(s) to assign",
                    options=get_metal_options(),
                    key="combined_assign_source_metals",
                    help="Choose metals, or type a new value and press Enter.",
                    accept_new_options=True,
                )

                source_metals = normalize_metal_selection(selected_source_metals)

                selected_source_exposure_periods = st.multiselect(
                    "Exposure period(s) / duration(s) to assign",
                    options=EXPOSURE_PERIOD_OPTIONS,
                    key="combined_assign_source_exposure_periods",
                    help="Choose exposure periods, or type a new value and press Enter.",
                    accept_new_options=True,
                )

                source_exposure_periods = normalize_exposure_period_selection(
                    selected_source_exposure_periods
                )

                update_mode_label = st.radio(
                    "Metal/exposure update mode",
                    options=[
                        "Replace existing metals and exposure periods",
                        "Add only missing values to existing metadata",
                    ],
                    index=1,
                    key="combined_assign_source_metadata_mode",
                    help=(
                        "Replace overwrites metal/exposure metadata. "
                        "Add missing values preserves existing values and removes duplicates."
                    ),
                )

                update_mode = (
                    "replace"
                    if update_mode_label == "Replace existing metals and exposure periods"
                    else "merge"
                )

                if source_metals:
                    st.caption(f"Metal field to apply: {source_metals}")

                if source_exposure_periods:
                    st.caption(f"Exposure-period field to apply: {source_exposure_periods}")

            if st.button("Apply metadata to selected source(s)", key="apply_combined_source_metadata"):
                if not selected_source_ids:
                    st.error("Select at least one source.")
                elif not apply_programme_update and not apply_material_exposure_update:
                    st.error("Choose at least one update type.")
                elif apply_programme_update and not programme_to_apply.strip():
                    st.error("Select or enter a programme.")
                elif (
                    apply_material_exposure_update
                    and update_mode == "merge"
                    and not (source_metals.strip() or source_exposure_periods.strip())
                ):
                    st.error(
                        "To add missing source metadata, select at least one metal or at least one exposure period."
                    )
                elif (
                    apply_material_exposure_update
                    and update_mode == "replace"
                    and (not source_metals.strip() or not source_exposure_periods.strip())
                ):
                    st.error(
                        "Replace mode requires at least one metal and at least one exposure period. "
                        "Use merge mode if you only want to add metals or only exposure periods."
                    )
                else:
                    try:
                        programme_updated_count = 0
                        metadata_updated_count = 0

                        if apply_programme_update:
                            for source_code in selected_source_codes:
                                update_source_programme(source_code, programme_to_apply)
                                programme_updated_count += 1

                        if apply_material_exposure_update:
                            metadata_updated_count = bulk_update_source_metadata(
                                source_ids=selected_source_ids,
                                metals=source_metals,
                                exposure_periods=source_exposure_periods,
                                mode=update_mode,
                            )

                        set_next_active_page("Sources")
                        st.session_state.clear_source_metadata_after_success = True

                        if apply_programme_update:
                            add_metadata_options("programme", split_chip_values(programme_to_apply))

                        if apply_material_exposure_update:
                            add_metadata_options("metal", split_chip_values(source_metals))

                        set_flash_message(
                            "Updated selected source record(s). "
                            f"Programme updates: {programme_updated_count}. "
                            f"Metal/exposure updates: {metadata_updated_count}."
                        )

                        st.rerun()

                    except Exception as exc:
                        st.error(f"Could not update selected source metadata: {exc}")


if active_page == "Sites":
    st.subheader("Sites")
    st.caption("Search a location, confirm coordinates, classify the site, and add it to the database.")

    st.write("### Location lookup")

    location_query = st.text_input(
        "Search place",
        placeholder="e.g. Berlin, Germany",
        key="location_query",
        on_change=run_location_search,
    )

    if st.button("Search location", key="search_location_button"):
        run_location_search()

    if st.session_state.location_search_message:
        message = st.session_state.location_search_message
        if message.startswith("Location search failed"):
            st.error(message)
        else:
            st.warning(message)

    location_options = st.session_state.location_results
    selected_location = None

    if location_options:
        labels = [item["label"] for item in location_options]

        if (
            not st.session_state.selected_location_label
            or st.session_state.selected_location_label not in labels
        ):
            st.session_state.selected_location_label = labels[0]
            apply_selected_location()

        selected_label = st.radio(
            "Suggested locations",
            options=labels,
            key="selected_location_label",
            on_change=apply_selected_location,
        )

        selected_location = next(
            (item for item in location_options if item["label"] == selected_label),
            None,
        )

        if selected_location:
            st.info(
                f"Selected: {selected_location['label']}\n\n"
                f"Full match: {selected_location.get('full_label', selected_location['label'])}\n\n"
                f"Latitude: {selected_location['latitude']}, "
                f"Longitude: {selected_location['longitude']}"
            )

    st.divider()

    st.write("### Add site")

    with st.form("add_site_form", clear_on_submit=False):
        site_label = st.text_input(
            "Site label",
            placeholder="e.g. Berlin",
            key="site_label_input",
        )

        col1, col2, col3 = st.columns(3)

        with col1:
            selected_site_type = st.selectbox(
                "Site type",
                options=SITE_TYPE_OPTIONS,
                key="site_type_select",
            )

            custom_site_type = ""
            if selected_site_type == "Other / custom":
                custom_site_type = st.text_input(
                    "Custom site type",
                    placeholder="Enter custom site type",
                    key="custom_site_type_input",
                )

            site_type = resolve_option_value(selected_site_type, custom_site_type)

        with col2:
            latitude = st.text_input(
                "Latitude",
                key="site_latitude",
                placeholder="e.g. 50.0755",
            )

        with col3:
            longitude = st.text_input(
                "Longitude",
                key="site_longitude",
                placeholder="e.g. 14.4378",
            )

        modern_country_location = st.text_input(
            "Modern country / location",
            key="site_modern_country_location",
            placeholder="e.g. Germany or Antarctica",
        )

        administering_country = st.text_input(
            "Administering country",
            placeholder="Optional; used for Antarctic IDs such as AQ-RU-001",
            key="administering_country_input",
        )

        site_id_prefix = build_site_id_prefix(
            modern_country_location=modern_country_location,
            administering_country=administering_country,
        )

        suggested_site_id = get_next_site_id_for_prefix(site_id_prefix)

        st.caption(f"Suggested site ID: `{suggested_site_id}`")

        previous_suggested_site_id = st.session_state.get("last_suggested_site_id", "")
        current_site_id_value = st.session_state.get("site_id_input", "")

        if current_site_id_value in ("", previous_suggested_site_id):
            st.session_state.site_id_input = suggested_site_id

        st.session_state.last_suggested_site_id = suggested_site_id

        site_id = st.text_input(
            "Site ID",
            key="site_id_input",
            help=(
                "Automatically suggested from the country/location. "
                "For Antarctica, administering country is included when provided."
            ),
        )

        selected_former_entity = st.selectbox(
            "Former entity",
            options=FORMER_ENTITY_OPTIONS,
            key="former_entity_select",
        )

        custom_former_entity = ""
        if selected_former_entity == "Other / custom":
            custom_former_entity = st.text_input(
                "Custom former entity",
                placeholder="Enter custom former entity",
                key="custom_former_entity_input",
            )

        former_entity = resolve_option_value(selected_former_entity, custom_former_entity)

        selected_region_tags = st.multiselect(
            "Region category tags",
            options=REGION_TAG_OPTIONS,
            help="Choose one or more tags. They will be combined into a normalized region category.",
            key="region_tags_select",
        )

        region_category = normalize_region_category(selected_region_tags)

        if region_category:
            st.caption(f"Saved region category: {region_category}")

        exposure_period = st.text_input(
            "Exposure period",
            placeholder="e.g. 1987–1991 or 1 year",
            key="exposure_period_input",
        )

        selected_metals = st.multiselect(
            "Metal",
            options=get_metal_options(),
            help="Choose one or more metals. Type a new value and press Enter to add a custom metal.",
            key="metals_select",
            accept_new_options=True,
        )

        metal = normalize_metal_selection(selected_metals)

        if metal:
            st.caption(f"Saved metal field: {metal}")

        site_notes = st.text_area(
            "Site notes",
            placeholder="Optional notes about the site",
            key="site_notes_input",
        )

        submit_site = st.form_submit_button("Add site")

        if submit_site:
            if not site_id.strip():
                st.error("Site ID is required.")
            elif not site_label.strip():
                st.error("Site label is required.")
            elif not latitude.strip():
                st.error("Latitude is required.")
            elif not longitude.strip():
                st.error("Longitude is required.")
            else:
                try:
                    latitude_value = float(latitude)
                    longitude_value = float(longitude)

                    insert_site(
                        site_id=site_id,
                        site_label=site_label,
                        site_type=site_type,
                        latitude=latitude_value,
                        longitude=longitude_value,
                        modern_country_location=modern_country_location,
                        administering_country=administering_country,
                        former_entity=former_entity,
                        region_category=region_category,
                        exposure_period=exposure_period,
                        metal=metal,
                        notes=site_notes,
                    )
                    st.session_state.clear_site_form_after_success = True
                    set_flash_message(f"Site '{site_label.strip()}' added successfully.")
                    st.rerun()
                except ValueError:
                    st.error("Latitude and longitude must be valid numbers.")
                except Exception as exc:
                    st.error(f"Could not add site: {exc}")

    st.divider()

    st.write("### Source evidence for existing site(s)")
    st.caption(
        "Attach one or more sources to site records, and record the metals and exposure periods "
        "reported by those sources for the selected site(s)."
    )

    with st.expander("Attach source(s) to site(s)", expanded=True):
        try:
            site_options = get_site_options()
            source_options = get_source_options()
        except Exception as exc:
            site_options = []
            source_options = []
            st.error(f"Could not load site/source options: {exc}")

        if not site_options:
            st.info("No sites available yet. Add at least one site first.")
        elif not source_options:
            st.info("No sources available yet. Add at least one source first.")
        else:
            site_label_to_id = {
                build_site_option_label(row): int(row["id"])
                for row in site_options
            }

            source_label_to_id = {
                build_source_option_label(row): int(row["id"])
                for row in source_options
            }

            selected_site_labels = st.multiselect(
                "Choose site(s)",
                options=list(site_label_to_id.keys()),
                help="Choose one or more sites. Multiple selection allows bulk source linking.",
                key="link_sites_selected",
            )

            selected_source_labels = st.multiselect(
                "Choose source(s)",
                options=list(source_label_to_id.keys()),
                help="Choose one or more sources to attach to the selected site(s).",
                key="link_sources_selected",
            )

            selected_site_ids = [
                site_label_to_id[label]
                for label in selected_site_labels
            ]

            selected_source_ids = [
                source_label_to_id[label]
                for label in selected_source_labels
            ]

            selected_link_source_signature = tuple(sorted(selected_source_ids))

            if st.session_state.get("last_link_source_signature") != selected_link_source_signature:
                suggested_link_metadata = get_source_metadata_by_ids(selected_source_ids)

                st.session_state.link_metals_selected = split_chip_values(
                    suggested_link_metadata["metals"]
                )

                st.session_state.link_exposure_periods_selected = split_chip_values(
                    suggested_link_metadata["exposure_periods"]
                )

                st.session_state.last_link_source_signature = selected_link_source_signature
            else:
                suggested_link_metadata = get_source_metadata_by_ids(selected_source_ids)

            suggested_link_metals = suggested_link_metadata["metals"]
            suggested_link_exposure_periods = suggested_link_metadata["exposure_periods"]

            if suggested_link_metals or suggested_link_exposure_periods:
                st.info(
                    f"Suggested from selected source(s):\n\n"
                    f"Metals: {suggested_link_metals or '—'}\n\n"
                    f"Exposure period(s): {suggested_link_exposure_periods or '—'}"
                )

            source_order = st.number_input(
                "Source order",
                min_value=1,
                max_value=99,
                value=1,
                step=1,
                help="Controls source ordering later when exported to the website.",
                key="link_source_order",
            )

            selected_link_metals = st.multiselect(
                "Metal(s) for this site-source link",
                options=get_metal_options(),
                help=(
                    "Defaults to the selected source metadata. "
                    "You can customise this for the specific site-source relationship."
                ),
                key="link_metals_selected",
                accept_new_options=True,
            )

            link_metals = normalize_metal_selection(selected_link_metals)

            selected_link_exposure_periods = st.multiselect(
                "Exposure period(s) for this site-source link",
                options=EXPOSURE_PERIOD_OPTIONS,
                help=(
                    "Defaults to the selected source metadata. "
                    "You can customise this for the specific site-source relationship."
                ),
                key="link_exposure_periods_selected",
                accept_new_options=True,
            )

            link_exposure_periods = normalize_exposure_period_selection(
                selected_link_exposure_periods
            )

            link_notes = st.text_area(
                "Notes for this site-source relationship",
                placeholder="Optional notes, e.g. table number, exposure series, extraction remarks.",
                key="link_notes",
            )

            update_site_summary = st.checkbox(
                "After linking, add missing metals/exposure periods to the site-level summary fields",
                value=True,
                key="link_update_site_summary",
            )

            if link_metals:
                st.caption(f"Site-source metal field: {link_metals}")

            if link_exposure_periods.strip():
                st.caption(f"Site-source exposure period field: {link_exposure_periods.strip()}")

            if st.button("Attach selected source(s)", key="attach_sources_to_sites"):
                if not selected_site_ids:
                    st.error("Select at least one site.")
                elif not selected_source_ids:
                    st.error("Select at least one source.")
                else:
                    try:
                        changed_count = bulk_upsert_site_source_links(
                            site_ids=selected_site_ids,
                            source_ids=selected_source_ids,
                            source_order=int(source_order),
                            metals=link_metals,
                            exposure_periods=link_exposure_periods,
                            notes=link_notes,
                        )

                        if update_site_summary:
                            merge_metadata_for_multiple_sites(selected_site_ids)

                        message = f"Created or updated {changed_count} site-source link(s)."

                        if update_site_summary:
                            message += " Site-level metal and exposure-period fields were merged and updated."

                        set_flash_message(message)
                        st.rerun()

                    except Exception as exc:
                        st.error(f"Could not attach source(s): {exc}")

    with st.expander("Review or delete existing site-source links", expanded=False):
        try:
            link_rows = get_site_source_links()
        except Exception as exc:
            link_rows = []
            st.error(f"Could not load site-source links: {exc}")

        if not link_rows:
            st.info("No site-source links have been created yet.")
        else:
            link_df_original = pd.DataFrame(link_rows)
            link_df_editor = link_df_original.copy()
            link_df_editor.insert(0, "delete", False)

            st.caption(
                "Tick Delete for site-source links you want to remove. "
                "This removes only the relationship record, not the site, source, or PDF."
            )

            edited_link_df = st.data_editor(
                link_df_editor,
                hide_index=True,
                width="stretch",
                disabled=[
                    column for column in link_df_editor.columns
                    if column != "delete"
                ],
                num_rows="fixed",
                key="site_source_links_editor",
                column_config={
                    "delete": st.column_config.CheckboxColumn(
                        "Delete",
                        help="Tick links to delete, then click Delete selected links.",
                        default=False,
                    )
                },
            )

            delete_link_ids = [
                int(row["id"])
                for _, row in edited_link_df.iterrows()
                if bool(row.get("delete"))
            ]

            if st.button("Delete selected site-source links", key="delete_site_source_links"):
                if not delete_link_ids:
                    st.error("Tick at least one site-source link first.")
                else:
                    try:
                        deleted_count = delete_site_source_links(delete_link_ids)
                        set_flash_message(f"Deleted {deleted_count} site-source link(s).")
                        st.rerun()
                    except Exception as exc:
                        st.error(f"Could not delete selected links: {exc}")

if active_page == "Manage Records":
    st.subheader("Manage Records")
    st.caption("Edit, delete, or bulk-update existing site and source records.")

    manage_table = st.selectbox(
        "Choose table to manage",
        options=["sites", "sources"],
        index=0,
        key="manage_table_select",
    )

    try:
        rows = get_table_rows(manage_table)
    except Exception as exc:
        st.error(f"Could not load records: {exc}")
        rows = []

    if not rows:
        st.info(f"No records found in `{manage_table}`.")
    else:
        df_original = pd.DataFrame(rows)

        if manage_table == "sites":
            editable_columns = [
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
            ]

            link_summary_by_site_id = get_site_link_summary_by_site_db_id()

            df_editor = df_original.copy()

            df_editor["source_codes"] = df_editor["id"].apply(
                lambda site_db_id: link_summary_by_site_id.get(
                    int(site_db_id),
                    {},
                ).get("source_codes", "")
            )

            df_editor["programmes"] = df_editor["id"].apply(
                lambda site_db_id: link_summary_by_site_id.get(
                    int(site_db_id),
                    {},
                ).get("programmes", "")
            )

            df_editor["source_codes"] = df_editor["source_codes"].apply(split_chip_values)
            df_editor["programmes"] = df_editor["programmes"].apply(split_chip_values)
            df_editor["metal"] = df_editor["metal"].apply(split_chip_values)
            df_editor["exposure_period"] = df_editor["exposure_period"].apply(split_chip_values)

            preferred_site_columns = [
                "id",
                "site_id",
                "site_label",
                "source_codes",
                "programmes",
                "site_type",
                "latitude",
                "longitude",
                "modern_country_location",
                "administering_country",
                "former_entity",
                "region_category",
                "metal",
                "exposure_period",
                "notes",
            ]

            preferred_site_columns = [
                column for column in preferred_site_columns
                if column in df_editor.columns
            ]

            df_editor = df_editor[preferred_site_columns].copy()
            df_editor["delete"] = False

            disabled_columns = [
                column for column in df_editor.columns
                if column not in editable_columns and column != "delete"
            ]

            source_code_options = merge_option_values(
                [
                    item
                    for value in df_original.get("source_codes", [])
                    for item in split_chip_values(value)
                ],
                [
                    item
                    for value in df_editor.get("source_codes", [])
                    for item in split_chip_values(value)
                ],
            )

            programme_options = merge_option_values(
                get_programme_options(include_blank=False),
                [
                    item
                    for value in df_editor.get("programmes", [])
                    for item in split_chip_values(value)
                ],
            )

            metal_options = merge_option_values(
                get_metal_options(),
                [
                    item
                    for value in df_editor.get("metal", [])
                    for item in split_chip_values(value)
                ],
            )

            exposure_options = merge_option_values(
                EXPOSURE_PERIOD_OPTIONS,
                [
                    item
                    for value in df_editor.get("exposure_period", [])
                    for item in split_chip_values(value)
                ],
            )

            column_config = {
                "id": None,
                "source_codes": st.column_config.MultiselectColumn(
                    "Source codes",
                    options=source_code_options,
                    accept_new_options=True,
                    width="large",
                ),
                "programmes": st.column_config.MultiselectColumn(
                    "Programmes",
                    options=programme_options,
                    accept_new_options=True,
                    width="large",
                ),
                "metal": st.column_config.MultiselectColumn(
                    "Metal",
                    options=metal_options,
                    accept_new_options=True,
                    width="large",
                ),
                "exposure_period": st.column_config.MultiselectColumn(
                    "Exposure period",
                    options=exposure_options,
                    accept_new_options=True,
                    width="large",
                ),
                "delete": st.column_config.CheckboxColumn(
                    "Delete",
                    help="Tick records to delete, then click Delete selected records.",
                    default=False,
                ),
            }

        else:
            editable_columns = [
                "source_code",
                "source_title",
                "programme",
                "metals",
                "exposure_periods",
                "source_url",
                "notes",
            ]

            required_source_columns = [
                "source_code",
                "source_title",
                "programme",
                "metals",
                "exposure_periods",
                "source_url",
                "notes",
            ]

            for column in required_source_columns:
                if column not in df_original.columns:
                    df_original[column] = ""

            df_editor = df_original[required_source_columns].copy()

            df_editor["programme"] = df_editor["programme"].apply(split_chip_values)
            df_editor["metals"] = df_editor["metals"].apply(split_chip_values)
            df_editor["exposure_periods"] = df_editor["exposure_periods"].apply(split_chip_values)

            df_editor["delete"] = False

            disabled_columns = []

            column_config = {
                "programme": st.column_config.MultiselectColumn(
                    "Programme",
                    options=get_programme_options(include_blank=False),
                    accept_new_options=True,
                    help="Programme(s) associated with this source.",
                    width="medium",
                ),
                "source_code": st.column_config.TextColumn(
                    "Source code",
                    width="small",
                ),
                "source_title": st.column_config.TextColumn(
                    "Source title",
                    width="large",
                ),
                "metals": st.column_config.MultiselectColumn(
                    "Metals",
                    options=get_metal_options(),
                    accept_new_options=True,
                    help="Metal types associated with this source.",
                    width="large",
                ),
                "exposure_periods": st.column_config.MultiselectColumn(
                    "Exposure periods",
                    options=EXPOSURE_PERIOD_OPTIONS,
                    accept_new_options=True,
                    help="Exposure periods or durations associated with this source.",
                    width="large",
                ),
                "source_url": st.column_config.LinkColumn(
                    "Source URL",
                    help="PDF path or external source URL.",
                    width="medium",
                ),
                "delete": st.column_config.CheckboxColumn(
                    "Delete",
                    help="Tick records to delete, then click Delete selected records.",
                    default=False,
                ),
            }

        st.caption(
            "Edit cells directly in the table, or tick Delete for records you want to remove. "
            "Nothing is changed in the database until you click a save/delete button."
        )

        delete_state_key = f"delete_all_state_{manage_table}"

        if delete_state_key not in st.session_state:
            st.session_state[delete_state_key] = False

        col_select_delete, col_deselect_delete = st.columns(2)

        with col_select_delete:
            if st.button("Select all for deletion", key=f"select_all_delete_{manage_table}"):
                st.session_state[delete_state_key] = True

        with col_deselect_delete:
            if st.button("Deselect all deletion", key=f"deselect_all_delete_{manage_table}"):
                st.session_state[delete_state_key] = False

        confirm_bulk_delete = st.checkbox(
            "Confirm deletion of selected records",
            key=f"confirm_delete_{manage_table}",
        )

        df_editor["delete"] = st.session_state[delete_state_key]

        edited_df = st.data_editor(
            df_editor,
            hide_index=True,
            width="stretch",
            disabled=disabled_columns,
            num_rows="fixed",
            key=f"data_editor_{manage_table}",
            column_config=column_config,
        )

        col_save, col_delete = st.columns([1, 1])

        with col_save:
            if st.button("Save table edits", key=f"save_edits_{manage_table}"):
                updated_rows = 0

                if manage_table == "sources":
                    for row_position in range(len(edited_df)):
                        row_id = int(df_original.iloc[row_position]["id"])
                        updates = {}

                        for column in editable_columns:
                            old_value = clean_editor_value(
                                df_original.iloc[row_position].get(column, "")
                            )
                            new_value = edited_df.iloc[row_position].get(column, "")

                            if column in {"programme", "metals", "exposure_periods"}:
                                old_normalised = join_chip_values(old_value)
                                new_normalised = join_chip_values(new_value)
                            else:
                                old_normalised = str(old_value)
                                new_normalised = str(clean_editor_value(new_value))

                            if old_normalised != new_normalised:
                                updates[column] = new_normalised

                        if updates:
                            updated_rows += update_table_row(
                                manage_table,
                                row_id,
                                updates,
                            )

                    for row_position in range(len(edited_df)):
                        add_metadata_options(
                            "programme",
                            split_chip_values(edited_df.iloc[row_position].get("programme", "")),
                        )

                        add_metadata_options(
                            "metal",
                            split_chip_values(edited_df.iloc[row_position].get("metals", "")),
                        )

                else:
                    original_by_id = df_original.set_index("id")
                    edited_by_id = edited_df.drop(columns=["delete"]).set_index("id")

                    for row_id in edited_by_id.index:
                        updates = {}

                        for column in editable_columns:
                            if column not in edited_by_id.columns:
                                continue

                            old_value = clean_editor_value(original_by_id.loc[row_id, column])
                            new_value = edited_by_id.loc[row_id, column]

                            if column in {"metal", "exposure_period"}:
                                old_normalised = join_chip_values(old_value)
                                new_normalised = join_chip_values(new_value)
                            else:
                                old_normalised = str(old_value)
                                new_normalised = str(clean_editor_value(new_value))

                            if old_normalised != new_normalised:
                                updates[column] = new_normalised

                        if updates:
                            updated_rows += update_table_row(
                                manage_table,
                                int(row_id),
                                updates,
                            )

                if updated_rows:
                    set_flash_message(f"Saved edits for {updated_rows} row(s).")
                    st.rerun()
                else:
                    st.info("No changes detected.")

        with col_delete:
            if manage_table == "sources":
                delete_ids = [
                    int(df_original.iloc[row_position]["id"])
                    for row_position, (_, row) in enumerate(edited_df.iterrows())
                    if bool(row.get("delete"))
                ]
            else:
                delete_ids = [
                    int(row["id"])
                    for _, row in edited_df.iterrows()
                    if bool(row.get("delete"))
                ]

            if st.button("Delete selected records", key=f"delete_selected_{manage_table}"):
                if not delete_ids:
                    st.error("Tick at least one record in the Delete column.")
                elif not confirm_bulk_delete:
                    st.error("Confirm deletion before deleting selected records.")
                else:
                    try:
                        deleted_count = delete_table_rows(manage_table, delete_ids)
                        set_flash_message(
                            f"Deleted {deleted_count} record(s) from `{manage_table}`."
                        )
                        st.rerun()
                    except Exception as exc:
                        st.error(f"Delete failed: {exc}")

        st.write("#### Bulk edit selected records")

        row_label_to_id = {
            build_row_label(row, manage_table): int(row["id"])
            for row in rows
        }

        selected_row_labels = st.multiselect(
            "Choose records to update",
            options=list(row_label_to_id.keys()),
            key=f"bulk_rows_{manage_table}",
        )

        selected_row_ids = [
            row_label_to_id[label]
            for label in selected_row_labels
        ]

        if manage_table == "sites":
            st.write("#### Auto-assign region category for selected sites")

            if st.button(
                "Preview automatic region categories",
                key="preview_auto_region_categories",
                disabled=not selected_row_ids,
            ):
                selected_rows = [
                    row for row in rows
                    if int(row["id"]) in selected_row_ids
                ]

                preview_rows = []

                for row in selected_rows:
                    result = classify_region_category(
                        latitude=row.get("latitude"),
                        longitude=row.get("longitude"),
                        current_region_category=row.get("region_category", ""),
                        modern_country_location=row.get("modern_country_location", ""),
                        site_type=row.get("site_type", ""),
                    )

                    preview_rows.append(
                        {
                            "apply": True,
                            "id": int(row["id"]),
                            "site_id": row.get("site_id", ""),
                            "site_label": row.get("site_label", ""),
                            "latitude": row.get("latitude", ""),
                            "longitude": row.get("longitude", ""),
                            "current_region_category": row.get("region_category", ""),
                            "suggested_region_category": result.region_category,
                            "notes": result.notes,
                        }
                    )

                st.session_state["auto_region_preview_df"] = pd.DataFrame(preview_rows)

            auto_region_preview_df = st.session_state.get("auto_region_preview_df")

            if auto_region_preview_df is not None and not auto_region_preview_df.empty:
                edited_auto_region_df = st.data_editor(
                    auto_region_preview_df,
                    hide_index=True,
                    width="stretch",
                    num_rows="fixed",
                    key="auto_region_preview_editor",
                    disabled=[
                        "id",
                        "site_id",
                        "site_label",
                        "latitude",
                        "longitude",
                        "current_region_category",
                        "notes",
                    ],
                    column_config={
                        "apply": st.column_config.CheckboxColumn(
                            "Apply",
                            help="Tick rows to update.",
                            default=True,
                        ),
                        "id": None,
                        "suggested_region_category": st.column_config.TextColumn(
                            "Suggested region category",
                            help="You can edit the suggestion before applying.",
                        ),
                    },
                )

                apply_auto_region_df = edited_auto_region_df[
                    edited_auto_region_df["apply"].astype(bool)
                ].copy()

                col_apply_auto_region, col_clear_auto_region = st.columns(2)

                with col_apply_auto_region:
                    if st.button(
                        "Apply automatic region categories",
                        key="apply_auto_region_categories",
                        disabled=apply_auto_region_df.empty,
                    ):
                        updated_count = 0

                        for _, row in apply_auto_region_df.iterrows():
                            suggested_value = str(
                                row.get("suggested_region_category", "")
                            ).strip()

                            if not suggested_value:
                                continue

                            updated_count += update_table_row(
                                "sites",
                                int(row["id"]),
                                {"region_category": suggested_value},
                            )

                        st.session_state.pop("auto_region_preview_df", None)
                        set_flash_message(
                            f"Updated region_category for {updated_count} site row(s)."
                        )
                        st.rerun()

                with col_clear_auto_region:
                    if st.button(
                        "Clear automatic region preview",
                        key="clear_auto_region_preview",
                    ):
                        st.session_state.pop("auto_region_preview_df", None)
                        st.rerun()    

        bulk_field = st.selectbox(
            "Field to bulk update",
            options=editable_columns,
            key=f"bulk_field_{manage_table}",
        )

        bulk_value = st.text_input(
            "New value",
            key=f"bulk_value_{manage_table}",
        )

        if st.button("Apply bulk edit", key=f"apply_bulk_{manage_table}"):
            if not selected_row_ids:
                st.error("Select at least one record.")
            else:
                try:
                    changed_count = bulk_update_table_rows(
                        manage_table,
                        selected_row_ids,
                        bulk_field,
                        bulk_value,
                    )
                    set_flash_message(f"Updated {changed_count} record(s).")
                    st.rerun()
                except Exception as exc:
                    st.error(f"Bulk edit failed: {exc}")


if active_page == "Import":
    st.subheader("Import")
    st.caption(
        "Import flat CSV files, review the parsed site-source links, "
        "and write selected rows into the curator database."
    )

    st.write("### Import sites CSV")

    uploaded_import_csv = st.file_uploader(
        "Upload CSV file",
        type=["csv", "txt"],
        help=(
            "Expected columns include site_id, site_label, site_type, latitude, longitude, "
            "modern_country_location, administering_country, former_entity, region_category, "
            "exposure_period, metal, source_1, source_2, source_3..., notes."
        ),
        key="import_sites_csv",
    )

    import_col1, import_col2 = st.columns(2)

    with import_col1:
        default_import_programme = st.selectbox(
            "Default programme for imported sources",
            options=get_programme_options(include_blank=True),
            key="default_import_programme",
        )

    with import_col2:
        geocode_missing_coordinates = st.checkbox(
            "Auto-fill missing latitude/longitude using site label and country",
            value=False,
            help=(
                "Uses the current geocoder. Keep this off for very large imports unless needed."
            ),
            key="geocode_missing_coordinates_import",
        )

    st.write("#### Import rules")

    st.markdown(
        """
        - One CSV site row may become several preview rows if it has multiple source columns.
        - Source columns are detected dynamically: `source_1`, `source_2`, `source_3`, etc.
        - If a source already exists in the app, its assigned metals and exposure periods are used for the site-source link preview.
        - If a source has no assigned metadata, the CSV `metal` and `exposure_period` values are used as fallback values.
        - Missing `site_id` values are automatically generated from `modern_country_location` and, for Antarctic records, `administering_country`.
        - No database changes are made until the confirmation step is implemented and clicked.
        """
    )

    if uploaded_import_csv is not None:
        try:
            preview_df = build_import_preview(
                uploaded_file=uploaded_import_csv,
                existing_site_ids=get_existing_site_ids(),
                existing_source_codes=get_existing_source_codes(),
                existing_site_source_pairs=get_existing_site_source_pairs(),
                default_programme=default_import_programme,
                geocode_missing_coordinates=geocode_missing_coordinates,
                source_metadata_by_code=get_source_metadata_by_code(),
                site_id_generator=make_import_site_id_generator(),
            )

            if preview_df.empty:
                st.warning("The uploaded file did not produce any importable preview rows.")
            else:
                st.success(f"Parsed {len(preview_df)} preview row(s).")

                site_preview_df = build_site_level_import_preview(preview_df)

                col_select_all, col_deselect_all = st.columns(2)

                with col_select_all:
                    if st.button("Select all import sites", key="select_all_import_sites"):
                        site_preview_df["import_selected"] = True

                with col_deselect_all:
                    if st.button("Deselect all import sites", key="deselect_all_import_sites"):
                        site_preview_df["import_selected"] = False

                visible_site_preview_columns = [
                    "import_selected",
                    "csv_rows",
                    "site_action",
                    "site_id",
                    "site_label",
                    "site_type",
                    "latitude",
                    "longitude",
                    "modern_country_location",
                    "administering_country",
                    "former_entity",
                    "region_category",
                    "source_count",
                    "source_codes",
                    "programmes",
                    "metals",
                    "exposure_periods",
                    "notes",
                    "warnings",
                ]

                visible_site_preview_columns = [
                    column for column in visible_site_preview_columns
                    if column in site_preview_df.columns
                ]

                site_preview_display_df = site_preview_df[visible_site_preview_columns].copy()

                for chip_column in ["source_codes", "programmes", "metals", "exposure_periods"]:
                    if chip_column in site_preview_display_df.columns:
                        site_preview_display_df[chip_column] = site_preview_display_df[
                            chip_column
                        ].apply(split_chip_values)

                source_code_chip_options = merge_option_values(
                    [
                        item
                        for value in site_preview_df.get("source_codes", [])
                        for item in split_chip_values(value)
                    ],
                )

                programme_chip_options = merge_option_values(
                    get_programme_options(include_blank=False),
                    [
                        item
                        for value in site_preview_df.get("programmes", [])
                        for item in split_chip_values(value)
                    ],
                )

                metal_chip_options = merge_option_values(
                    get_metal_options(),
                    [
                        item
                        for value in site_preview_df.get("metals", [])
                        for item in split_chip_values(value)
                    ],
                )

                exposure_chip_options = merge_option_values(
                    EXPOSURE_PERIOD_OPTIONS,
                    [
                        item
                        for value in site_preview_df.get("exposure_periods", [])
                        for item in split_chip_values(value)
                    ],
                )

                edited_site_preview_df = st.data_editor(
                    site_preview_display_df,
                    hide_index=True,
                    width="stretch",
                    num_rows="fixed",
                    key="import_preview_editor",
                    column_config={
                        "import_selected": st.column_config.CheckboxColumn(
                            "Import",
                            help="Untick sites that should be skipped.",
                            default=True,
                        ),
                        "source_codes": st.column_config.MultiselectColumn(
                            "Source codes",
                            options=source_code_chip_options,
                            accept_new_options=True,
                            width="large",
                        ),
                        "programmes": st.column_config.MultiselectColumn(
                            "Programmes",
                            options=programme_chip_options,
                            accept_new_options=True,
                            width="large",
                        ),
                        "metals": st.column_config.MultiselectColumn(
                            "Metals",
                            options=metal_chip_options,
                            accept_new_options=True,
                            width="large",
                        ),
                        "exposure_periods": st.column_config.MultiselectColumn(
                            "Exposure periods",
                            options=exposure_chip_options,
                            accept_new_options=True,
                            width="large",
                        ),
                    },
                    disabled=[
                        "csv_rows",
                        "source_count",
                        "source_codes",
                        "programmes",
                        "metals",
                        "exposure_periods",
                        "warnings",
                    ],
                )

                edited_preview_df = apply_site_preview_edits_to_detail(
                    original_site_preview_df=site_preview_df,
                    edited_site_preview_df=edited_site_preview_df,
                    detail_df=preview_df,
                )

                st.session_state["latest_import_preview"] = edited_preview_df

                selected_site_count = int(edited_site_preview_df["import_selected"].sum())
                selected_link_count = int(edited_preview_df["import_selected"].sum())
                warning_count = int(
                    edited_site_preview_df["warnings"].astype(str).str.len().gt(0).sum()
                )

                metric1, metric2, metric3 = st.columns(3)

                with metric1:
                    st.metric("Preview sites", len(edited_site_preview_df))

                with metric2:
                    st.metric("Selected sites", selected_site_count)

                with metric3:
                    st.metric("Selected site-source links", selected_link_count)

                if warning_count:
                    with st.expander("Show site rows with warnings", expanded=False):
                        warning_df = edited_site_preview_df[
                            edited_site_preview_df["warnings"].astype(str).str.len() > 0
                        ]
                        st.dataframe(warning_df, width="stretch")

                st.write("#### Confirm import")

                confirm_import_checked = st.checkbox(
                    "I reviewed the preview and want to write the selected rows into the database.",
                    key="confirm_import_checked",
                )

                if st.button("Confirm selected import", type="primary", key="confirm_selected_import"):
                    if not confirm_import_checked:
                        st.error("Tick the confirmation checkbox before importing.")
                    elif selected_site_count == 0:
                        st.error("Select at least one site to import.")
                    else:
                        try:
                            result = confirm_import_preview(edited_preview_df)

                            set_next_active_page("Import")
                            set_flash_message(
                                "Import confirmed and written to database. "
                                f"Sites processed: {result['sites']}. "
                                f"Sources processed: {result['sources']}. "
                                f"Site-source links processed: {result['links']}."
                            )
                            st.rerun()

                        except Exception as exc:
                            st.error(f"Import failed: {exc}")

        except Exception as exc:
            st.error(f"Could not build import preview: {exc}")

    st.divider()

if active_page == "Export / Publish":
    st.subheader("Export / Publish")
    st.caption(
        "Select curated site records and publish them to the website-facing dataset."
    )

    st.write("### Website dataset")
    st.write(f"Live website file: `{OUTPUT_CSV_PATH}`")
    st.caption(
        "The website reads `data/sites.csv`. Each publish also creates a dated batch snapshot "
        "inside `data/publish_batches/`."
    )

    try:
        publishable_rows = get_publishable_sites()
        live_published_site_ids = get_live_published_site_ids()
    except Exception as exc:
        publishable_rows = []
        live_published_site_ids = set()
        st.error(f"Could not load publishable site records: {exc}")

    if not publishable_rows:
        st.info("No curated sites are available for publishing yet.")
    else:
        publish_df = pd.DataFrame(publishable_rows)

        publish_df["is_already_published"] = publish_df["site_id"].astype(str).isin(
            live_published_site_ids
        )

        duplicate_site_ids = publish_df[
            publish_df["site_id"].duplicated(keep=False)
        ]["site_id"].dropna().astype(str).tolist()

        if duplicate_site_ids:
            st.error(
                "Duplicate site_id values exist in the curation database and must be fixed before publishing: "
                + ", ".join(sorted(set(duplicate_site_ids)))
            )

        already_published_df = publish_df[
            publish_df["is_already_published"]
        ].copy()

        unpublished_df = publish_df[
            ~publish_df["is_already_published"]
        ].copy()

        st.write("### Yet to be published")

        if unpublished_df.empty:
            st.success("All curated sites are currently present in the website dataset.")
        else:
            unpublished_publish_default_key = "unpublished_publish_default"

            if unpublished_publish_default_key not in st.session_state:
                st.session_state[unpublished_publish_default_key] = False

            col_unpub_all, col_unpub_none = st.columns(2)

            with col_unpub_all:
                if st.button("Select all unpublished sites", key="select_all_unpublished_publish"):
                    st.session_state[unpublished_publish_default_key] = True
                    st.session_state.pop("unpublished_sites_publish_editor", None)
                    st.rerun()

            with col_unpub_none:
                if st.button("Deselect unpublished sites", key="deselect_all_unpublished_publish"):
                    st.session_state[unpublished_publish_default_key] = False
                    st.session_state.pop("unpublished_sites_publish_editor", None)
                    st.rerun()

            unpublished_df["publish"] = st.session_state[unpublished_publish_default_key]

            unpublished_visible_columns = [
                "publish",
                "site_db_id",
                "site_id",
                "site_label",
                "site_type",
                "latitude",
                "longitude",
                "modern_country_location",
                "administering_country",
                "region_category",
                "metal",
                "exposure_period",
                "source_count",
            ]

            unpublished_visible_columns = [
                column for column in unpublished_visible_columns
                if column in unpublished_df.columns
            ]

            unpublished_display_df = unpublished_df[unpublished_visible_columns].copy()

            edited_unpublished_df = st.data_editor(
                unpublished_display_df,
                hide_index=True,
                width="stretch",
                num_rows="fixed",
                key="unpublished_sites_publish_editor",
                column_config={
                    "publish": st.column_config.CheckboxColumn(
                        "Publish",
                        help="Tick sites that should be added to the website dataset.",
                        default=False,
                    ),
                },
                disabled=[
                    column for column in unpublished_display_df.columns
                    if column != "publish"
                ],
            )

        st.write("### Already published")

        if already_published_df.empty:
            st.info("No curated sites are currently present in the website dataset.")
            edited_published_df = pd.DataFrame()
        else:
            published_publish_default_key = "published_publish_default"

            if published_publish_default_key not in st.session_state:
                st.session_state[published_publish_default_key] = True

            col_pub_all, col_pub_none = st.columns(2)

            with col_pub_all:
                if st.button(
                    "Keep all already published sites",
                    key="select_all_published_publish",
                ):
                    st.session_state[published_publish_default_key] = True
                    st.session_state.pop("published_sites_publish_editor", None)
                    st.rerun()

            with col_pub_none:
                if st.button(
                    "Remove all already published from next website dataset",
                    key="deselect_all_published_publish",
                ):
                    st.session_state[published_publish_default_key] = False
                    st.session_state.pop("published_sites_publish_editor", None)
                    st.rerun()

            already_published_df["publish"] = st.session_state[published_publish_default_key]

            published_visible_columns = [
                "publish",
                "site_db_id",
                "site_id",
                "site_label",
                "site_type",
                "latitude",
                "longitude",
                "modern_country_location",
                "administering_country",
                "region_category",
                "metal",
                "exposure_period",
                "source_count",
            ]

            published_visible_columns = [
                column
                for column in published_visible_columns
                if column in already_published_df.columns
            ]

            published_display_df = already_published_df[published_visible_columns].copy()

            edited_published_df = st.data_editor(
                published_display_df,
                hide_index=True,
                width="stretch",
                num_rows="fixed",
                key="published_sites_publish_editor",
                column_config={
                    "publish": st.column_config.CheckboxColumn(
                        "Publish",
                        help="Keep ticked if this site should remain on the website.",
                        default=True,
                    ),
                },
                disabled=[
                    column
                    for column in published_display_df.columns
                    if column != "publish"
                ],
            )

        selected_site_db_ids: list[int] = []

        if not unpublished_df.empty:
            selected_site_db_ids.extend(
                [
                    int(row["site_db_id"])
                    for _, row in edited_unpublished_df.iterrows()
                    if bool(row.get("publish"))
                ]
            )

        if not already_published_df.empty:
            selected_site_db_ids.extend(
                [
                    int(row["site_db_id"])
                    for _, row in edited_published_df.iterrows()
                    if bool(row.get("publish"))
                ]
            )

        selected_site_db_ids = list(dict.fromkeys(selected_site_db_ids))

        metric_pub_1, metric_pub_2, metric_pub_3 = st.columns(3)

        with metric_pub_1:
            st.metric("Curated sites", len(publish_df))

        with metric_pub_2:
            st.metric("Already published", len(already_published_df))

        with metric_pub_3:
            st.metric("Selected for next website dataset", len(selected_site_db_ids))

        st.write("#### Confirm website publish")

        confirm_publish_checked = st.checkbox(
            "I reviewed the selected sites and want to update the website dataset.",
            key="confirm_publish_checked",
        )

        if st.button("Confirm publish to website", type="primary", key="confirm_publish_to_website"):
            if duplicate_site_ids:
                st.error("Fix duplicate site_id values before publishing.")
            elif not selected_site_db_ids:
                st.error("Select at least one site to publish.")
            elif not confirm_publish_checked:
                st.error("Tick the confirmation checkbox before publishing.")
            else:
                try:
                    result = publish_selected_sites_csv(selected_site_db_ids)

                    set_next_active_page("Export / Publish")
                    set_flash_message(
                        "Website dataset published successfully. "
                        f"Published sites: {result['rows']}. "
                        f"Live file: {result['live_path']}. "
                        f"Batch snapshot: {result['batch_name']}."
                    )
                    st.rerun()

                except Exception as exc:
                    st.error(f"Website publish failed: {exc}")

if active_page == "Settings":
    st.subheader("Settings")
    st.caption("Maintenance tools and database safety controls.")

    st.write("#### Paths")
    st.write(f"Database file: `{Path(DB_PATH).resolve()}`")
    st.write(f"Source PDF folder: `{SOURCE_PDF_DIR.resolve()}`")

    st.write("#### App controls")

    if st.button("Refresh app"):
        st.rerun()

    st.write("#### Database maintenance")

    st.warning(
        "Resetting the database deletes the local curation tables and recreates them. "
        "Use this only for testing or if you have a backup."
    )

    confirm_reset = st.checkbox(
        "I understand this will reset the local curation database.",
        key="confirm_database_reset",
    )

    if st.button("Initialize / reset database"):
        if not confirm_reset:
            st.error("Tick the confirmation checkbox before resetting the database.")
        else:
            init_db()
            set_flash_message("Database initialized successfully.")
            st.rerun()