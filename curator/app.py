from __future__ import annotations

from pathlib import Path
import os
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
from github_publish import (
    get_github_config_summary,
    publish_files_to_github,
)

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
    "Marine",
    "Coastal",
    "Near-coastal",
    "Inland",
    "Island",
    "Industrial",
    "Urban",
    "Rural",
    "Sub-arctic",
    "Sub-Antarctic",
    "Antarctic",
    "Tropical",
    "Hot-arid",
    "Temperate",
    "Cold",
    "Extreme cold",
]

REGION_TAG_ORDER = {
    "Marine": 1,
    "Coastal": 2,
    "Near-coastal": 3,
    "Inland": 4,
    "Island": 5,
    "Industrial": 6,
    "Urban": 7,
    "Rural": 8,
    "Sub-arctic": 9,
    "Sub-Antarctic": 10,
    "Antarctic": 11,
    "Tropical": 12,
    "Hot-arid": 13,
    "Temperate": 14,
    "Cold": 15,
    "Extreme cold": 16,
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
DATA_EDITOR_MAX_HEIGHT = 520
DATAFRAME_MAX_HEIGHT = 420
DATA_EDITOR_ROW_HEIGHT = 34
DATA_EDITOR_HEADER_HEIGHT = 40
DATA_EDITOR_EXTRA_PADDING = 0

def display_app_path(path_value) -> str:
    text = str(path_value or "").strip()

    if not text:
        return ""

    if text.upper() == "SUPABASE":
        return "SUPABASE"

    path = Path(text)

    try:
        return path.resolve().relative_to(REPO_ROOT).as_posix()
    except Exception:
        return path.name or text
    
def get_app_config_value(name: str, default: str = "") -> str:
    value = os.environ.get(name, "").strip()

    if value:
        return value

    try:
        return str(st.secrets.get(name, default)).strip()
    except Exception:
        return default


MAP_WEBSITE_URL = get_app_config_value("MAP_WEBSITE_URL", "")

def get_table_height(
    row_count: int,
    max_height: int = DATA_EDITOR_MAX_HEIGHT,
) -> int:
    row_count = max(1, int(row_count))

    calculated_height = (
        DATA_EDITOR_HEADER_HEIGHT
        + row_count * DATA_EDITOR_ROW_HEIGHT
        + DATA_EDITOR_EXTRA_PADDING
    )

    return min(calculated_height, max_height)


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

def filter_records_by_search(rows: list[dict], search_text: str) -> list[dict]:
    search_text = str(search_text or "").strip().lower()

    if not search_text:
        return rows

    filtered_rows = []

    for row in rows:
        searchable_text = " ".join(
            str(value or "")
            for value in row.values()
        ).lower()

        if search_text in searchable_text:
            filtered_rows.append(row)

    return filtered_rows

def get_visible_page_items(current_page: int, total_pages: int) -> list[int | str]:
    if total_pages <= 7:
        return list(range(1, total_pages + 1))

    if current_page <= 4:
        return [1, 2, 3, 4, 5, "...", total_pages]

    if current_page >= total_pages - 3:
        return [1, "...", total_pages - 4, total_pages - 3, total_pages - 2, total_pages - 1, total_pages]

    return [1, "...", current_page - 1, current_page, current_page + 1, "...", total_pages]


def render_pagination_controls(
    total_rows: int,
    page_key: str,
    page_size_key: str,
    anchor_id: str = "manage-records-top",
) -> tuple[int, int]:
    page_size_options = [10, 25, 50, 100, 200]

    if page_key not in st.session_state:
        st.session_state[page_key] = 1

    nav_left_spacer, nav_col, nav_right_spacer, display_col = st.columns(
        [0.18, 0.48, 0.18, 0.16],
        vertical_alignment="center",
    )

    with display_col:
        page_size = st.selectbox(
            "Display",
            options=page_size_options,
            index=0,
            key=page_size_key,
            format_func=lambda value: f"{value} results",
            label_visibility="collapsed",
        )

        st.markdown(
            f"""
            <div style="text-align: right; margin-top: -0.35rem;">
                <a href="#{anchor_id}" style="text-decoration: none;">Back to top</a>
            </div>
            """,
            unsafe_allow_html=True,
        )

    last_page_size_key = f"{page_size_key}_last_value"

    if st.session_state.get(last_page_size_key) != page_size:
        st.session_state[last_page_size_key] = page_size
        st.session_state[page_key] = 1

    total_pages = max(1, (total_rows + page_size - 1) // page_size)

    if int(st.session_state[page_key]) > total_pages:
        st.session_state[page_key] = total_pages

    if int(st.session_state[page_key]) < 1:
        st.session_state[page_key] = 1

    current_page = int(st.session_state[page_key])
    page_items = get_visible_page_items(current_page, total_pages)

    with nav_col:
        page_columns = st.columns(
            [1.15] + [0.50 for _ in page_items] + [0.85],
            gap="small",
            vertical_alignment="center",
        )

        with page_columns[0]:
            if st.button(
                "‹ Previous",
                key=f"{page_key}_previous",
                disabled=current_page <= 1,
                use_container_width=True,
            ):
                st.session_state[page_key] = current_page - 1
                st.rerun()

        for page_item, page_column in zip(page_items, page_columns[1:-1]):
            with page_column:
                if page_item == "...":
                    st.markdown(
                        "<div style='text-align:center; padding-top:0.45rem;'>...</div>",
                        unsafe_allow_html=True,
                    )
                elif int(page_item) == current_page:
                    st.button(
                        str(page_item),
                        key=f"{page_key}_page_{page_item}_active",
                        disabled=True,
                        use_container_width=True,
                    )
                else:
                    if st.button(
                        str(page_item),
                        key=f"{page_key}_page_{page_item}",
                        use_container_width=True,
                    ):
                        st.session_state[page_key] = int(page_item)
                        st.rerun()

        with page_columns[-1]:
            if st.button(
                "Next ›",
                key=f"{page_key}_next",
                disabled=current_page >= total_pages,
                use_container_width=True,
            ):
                st.session_state[page_key] = current_page + 1
                st.rerun()

    return current_page, page_size

def get_pagination_state(
    total_rows: int,
    page_key: str,
    page_size_key: str,
    default_page_size: int = 10,
) -> tuple[int, int]:
    page_size = int(st.session_state.get(page_size_key, default_page_size) or default_page_size)

    total_pages = max(1, (total_rows + page_size - 1) // page_size)

    current_page = int(st.session_state.get(page_key, 1) or 1)
    current_page = max(1, min(current_page, total_pages))

    st.session_state[page_key] = current_page

    return current_page, page_size

BUTTON_PAIR_COMPACT = (0.13, 0.14, 0.73)
BUTTON_PAIR_MEDIUM = (0.16, 0.18, 0.66)
BUTTON_PAIR_LONG = (0.18, 0.22, 0.60)
BUTTON_PAIR_EXTRA_LONG = (0.23, 0.33, 0.44)


def render_left_button_pair(
    left_label: str,
    right_label: str,
    left_key: str,
    right_key: str,
    widths: tuple[float, float, float] = BUTTON_PAIR_MEDIUM,
) -> tuple[bool, bool]:
    left_col, right_col, spacer_col = st.columns(
        list(widths),
        vertical_alignment="bottom",
    )

    with left_col:
        left_clicked = st.button(
            left_label,
            key=left_key,
            use_container_width=True,
        )

    with right_col:
        right_clicked = st.button(
            right_label,
            key=right_key,
            use_container_width=True,
        )

    return left_clicked, right_clicked

SITE_FORM_KEYS = [
    "site_label_input",
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

def normalize_site_match_text(value: str | None) -> str:
    value = str(value or "").strip().lower()
    value = re.sub(r"\s+", " ", value)
    return value


def first_nonempty_value(existing_value, incoming_value):
    existing_text = str(existing_value or "").strip()
    incoming_text = str(incoming_value or "").strip()

    if existing_text:
        return existing_value

    return incoming_value


def merge_note_values(existing_notes: str | None, incoming_notes: str | None) -> str:
    existing = str(existing_notes or "").strip()
    incoming = str(incoming_notes or "").strip()

    if not incoming:
        return existing

    if not existing:
        return incoming

    if incoming in existing:
        return existing

    return f"{existing}\n{incoming}"


def find_existing_site_for_upsert(
    conn,
    site_id: str,
    site_label: str,
    latitude: float,
    longitude: float,
    modern_country_location: str,
):
    """
    Find an existing site using increasingly soft matching rules.

    Priority:
    1. Exact site_id match.
    2. Same site label + same modern country/location.
    3. Very close coordinates plus matching label or country/location.
    """

    clean_site_id = str(site_id or "").strip()
    clean_label = normalize_site_match_text(site_label)
    clean_location = normalize_site_match_text(modern_country_location)

    if clean_site_id:
        existing = conn.execute(
            """
            select *
            from sites
            where lower(trim(site_id)) = lower(trim(?))
            limit 1
            """,
            (clean_site_id,),
        ).fetchone()

        if existing:
            return existing, "site_id"

    if clean_label and clean_location:
        existing = conn.execute(
            """
            select *
            from sites
            where lower(trim(site_label)) = ?
              and lower(trim(modern_country_location)) = ?
            order by id
            limit 1
            """,
            (clean_label, clean_location),
        ).fetchone()

        if existing:
            return existing, "site_label + modern_country_location"

    coordinate_tolerance = 0.0005

    if clean_label or clean_location:
        existing = conn.execute(
            """
            select *
            from sites
            where abs(latitude - ?) <= ?
              and abs(longitude - ?) <= ?
              and (
                    lower(trim(site_label)) = ?
                    or lower(trim(modern_country_location)) = ?
                  )
            order by id
            limit 1
            """,
            (
                latitude,
                coordinate_tolerance,
                longitude,
                coordinate_tolerance,
                clean_label,
                clean_location,
            ),
        ).fetchone()

        if existing:
            return existing, "coordinates + label/location"

    return None, ""


def upsert_site_record(values: dict) -> tuple[int, str, str]:
    """
    Create a new site if it is genuinely new.

    If the site already exists, merge missing metadata into the existing row
    instead of creating a duplicate site row.

    Returns
    -------
    tuple[int, str, str]
        site database id, action label, match reason
    """

    latitude = float(values["latitude"])
    longitude = float(values["longitude"])

    with get_connection() as conn:
        existing, match_reason = find_existing_site_for_upsert(
            conn=conn,
            site_id=str(values.get("site_id", "")).strip(),
            site_label=str(values.get("site_label", "")).strip(),
            latitude=latitude,
            longitude=longitude,
            modern_country_location=str(values.get("modern_country_location", "")).strip(),
        )

        if existing:
            site_db_id = int(existing["id"])

            merged_values = {
                "site_id": first_nonempty_value(existing["site_id"], values.get("site_id", "")),
                "site_label": first_nonempty_value(existing["site_label"], values.get("site_label", "")),
                "site_type": first_nonempty_value(existing["site_type"], values.get("site_type", "")),
                "latitude": first_nonempty_value(existing["latitude"], latitude),
                "longitude": first_nonempty_value(existing["longitude"], longitude),
                "modern_country_location": first_nonempty_value(
                    existing["modern_country_location"],
                    values.get("modern_country_location", ""),
                ),
                "administering_country": first_nonempty_value(
                    existing["administering_country"],
                    values.get("administering_country", ""),
                ),
                "former_entity": first_nonempty_value(
                    existing["former_entity"],
                    values.get("former_entity", ""),
                ),
                "region_category": merge_unique_text_values(
                    [
                        existing["region_category"],
                        values.get("region_category", ""),
                    ]
                ),
                "exposure_period": merge_unique_text_values(
                    [
                        existing["exposure_period"],
                        values.get("exposure_period", ""),
                    ]
                ),
                "metal": merge_unique_text_values(
                    [
                        existing["metal"],
                        values.get("metal", ""),
                    ]
                ),
                "notes": merge_note_values(
                    existing["notes"],
                    values.get("notes", ""),
                ),
            }

            conn.execute(
                """
                update sites
                set site_id = ?,
                    site_label = ?,
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
                    merged_values["site_id"],
                    merged_values["site_label"],
                    merged_values["site_type"],
                    merged_values["latitude"],
                    merged_values["longitude"],
                    merged_values["modern_country_location"],
                    merged_values["administering_country"],
                    merged_values["former_entity"],
                    merged_values["region_category"],
                    merged_values["exposure_period"],
                    merged_values["metal"],
                    merged_values["notes"],
                    site_db_id,
                ),
            )

            conn.commit()
            return site_db_id, "merged", match_reason

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
                str(values.get("site_id", "")).strip(),
                str(values.get("site_label", "")).strip(),
                str(values.get("site_type", "")).strip(),
                latitude,
                longitude,
                str(values.get("modern_country_location", "")).strip(),
                str(values.get("administering_country", "")).strip(),
                str(values.get("former_entity", "")).strip(),
                str(values.get("region_category", "")).strip(),
                str(values.get("exposure_period", "")).strip(),
                str(values.get("metal", "")).strip(),
                str(values.get("notes", "")).strip(),
            ),
        )

        inserted_site_id = cursor.lastrowid

        if inserted_site_id is None:
            raise RuntimeError("Could not determine inserted site ID.")

        conn.commit()
        return int(inserted_site_id), "created", ""
    
def append_warning_text(existing_warning: str | None, new_warning: str | None) -> str:
    existing = str(existing_warning or "").strip()
    new = str(new_warning or "").strip()

    if not new:
        return existing

    if not existing:
        return new

    if new in existing:
        return existing

    return f"{existing}; {new}"

def add_import_warning(
    df: pd.DataFrame,
    row_index,
    warning_text: str,
) -> None:
    current_warning = str(df.loc[row_index, "warnings"] or "").strip()

    df.loc[row_index, "warnings"] = append_warning_text(
        current_warning,
        warning_text,
    )

def preview_site_upsert_match(
    site_id: str,
    site_label: str,
    latitude,
    longitude,
    modern_country_location: str,
) -> dict[str, Any]:
    """
    Preview whether a submitted/imported site would create a new site row
    or merge into an existing site row.
    """
    if not str(site_label or "").strip():
        return {
            "checked": False,
            "will_merge": False,
            "message": "",
            "match_reason": "",
        }

    if latitude in ("", None) or longitude in ("", None):
        return {
            "checked": False,
            "will_merge": False,
            "message": "",
            "match_reason": "",
        }

    try:
        lat = float(latitude)
        lon = float(longitude)
    except (TypeError, ValueError):
        return {
            "checked": False,
            "will_merge": False,
            "message": "Existing-site check skipped: latitude/longitude are not valid numbers.",
            "match_reason": "",
        }

    with get_connection() as conn:
        existing, match_reason = find_existing_site_for_upsert(
            conn=conn,
            site_id=str(site_id or "").strip(),
            site_label=str(site_label or "").strip(),
            latitude=lat,
            longitude=lon,
            modern_country_location=str(modern_country_location or "").strip(),
        )

    if existing:
        existing_site_id = str(existing["site_id"] or "").strip()
        existing_site_label = str(existing["site_label"] or "").strip()
        existing_country = str(existing["modern_country_location"] or "").strip()

        return {
            "checked": True,
            "will_merge": True,
            "existing_site_id": existing_site_id,
            "existing_site_label": existing_site_label,
            "existing_country": existing_country,
            "match_reason": match_reason,
            "message": (
                f"Existing site likely found: {existing_site_id} — "
                f"{existing_site_label} ({existing_country}). "
                f"Adding this record will update the existing site row instead of creating a duplicate. "
                f"Match basis: {match_reason}."
            ),
        }

    return {
        "checked": True,
        "will_merge": False,
        "message": "No existing site match found. This will create a new site row.",
        "match_reason": "",
    }


def annotate_import_preview_for_upsert(preview_df: pd.DataFrame) -> pd.DataFrame:
    """
    Add user-facing import-preview columns showing:
    - whether each imported site will be created or merged into an existing site;
    - whether each source already exists or will be created.
    """
    if preview_df.empty:
        return preview_df

    annotated_df = preview_df.copy()

    existing_source_codes = {
        str(code).strip()
        for code in get_existing_source_codes()
        if str(code).strip()
    }

    for column in [
        "site_upsert_status",
        "site_upsert_match",
        "source_status",
        "new_source_code",
        "warnings",
    ]:
        if column not in annotated_df.columns:
            annotated_df[column] = ""

    for row_index, row in annotated_df.iterrows():
        site_preview = preview_site_upsert_match(
            site_id=str(row.get("site_id", "")).strip(),
            site_label=str(row.get("site_label", "")).strip(),
            latitude=row.get("latitude", ""),
            longitude=row.get("longitude", ""),
            modern_country_location=str(row.get("modern_country_location", "")).strip(),
        )

        if site_preview.get("will_merge"):
            annotated_df.at[row_index, "site_upsert_status"] = (
                "Existing site — source/metadata will be added"
            )
            annotated_df.at[row_index, "site_upsert_match"] = str(
                site_preview.get("match_reason", "")
            )
            add_import_warning(
                annotated_df,
                row_index,
                str(site_preview.get("message", "")),
            )
        elif site_preview.get("checked"):
            annotated_df.at[row_index, "site_upsert_status"] = (
                "New site — will be created"
            )
            annotated_df.at[row_index, "site_upsert_match"] = ""
        else:
            annotated_df.at[row_index, "site_upsert_status"] = (
                "Site match not checked"
            )
            annotated_df.at[row_index, "site_upsert_match"] = ""

        source_code = str(row.get("source_code", "")).strip()

        if source_code:
            if source_code in existing_source_codes:
                annotated_df.at[row_index, "source_status"] = (
                    "Existing source — will be linked/updated"
                )
            else:
                annotated_df.at[row_index, "source_status"] = (
                    "New source — will be created"
                )
                annotated_df.at[row_index, "new_source_code"] = source_code
                add_import_warning(
                    annotated_df,
                    row_index,
                    f"Source code {source_code} does not exist yet and will be created during import.",
                )

    return annotated_df

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
                "site_upsert_status": first.get("site_upsert_status", ""),
                "site_upsert_match": first.get("site_upsert_match", ""),
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
                "source_statuses": merge_unique_text_values(group.get("source_status", [])),
                "new_sources": merge_unique_text_values(group.get("new_source_code", [])),
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

    site_db_id, _, _ = upsert_site_record(
        {
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
    )

    return site_db_id


def upsert_source_from_import_row(row: pd.Series) -> int | None:
    source_code = str(row.get("source_code", "")).strip()

    if not source_code:
        return None

    source_title = str(row.get("source_title", "") or source_code).strip()
    programme = str(row.get("programme", "")).strip()
    source_url = str(row.get("source_url", "")).strip()
    local_file_name = str(row.get("local_file_name", "")).strip()
    metals = str(row.get("link_metals", "")).strip()
    exposure_periods = str(row.get("link_exposure_periods", "")).strip()

    with get_connection() as conn:
        existing = conn.execute(
            """
            select
                id,
                source_title,
                programme,
                metals,
                exposure_periods,
                source_url,
                local_file_name
            from sources
            where source_code = ?
            """,
            (source_code,),
        ).fetchone()

        if existing:
            source_db_id = int(existing["id"])

            merged_programme = merge_unique_text_values(
                [
                    existing["programme"],
                    programme,
                ]
            )

            merged_metals = merge_unique_text_values(
                [
                    existing["metals"],
                    metals,
                ]
            )

            merged_exposure_periods = merge_unique_text_values(
                [
                    existing["exposure_periods"],
                    exposure_periods,
                ]
            )

            conn.execute(
                """
                update sources
                set source_title = ?,
                    programme = ?,
                    metals = ?,
                    exposure_periods = ?,
                    source_url = ?,
                    local_file_name = ?
                where id = ?
                """,
                (
                    first_nonempty_value(existing["source_title"], source_title),
                    merged_programme,
                    merged_metals,
                    merged_exposure_periods,
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
                source_title,
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

def get_app_password() -> str:
    try:
        secret_password = str(st.secrets.get("CURATOR_APP_PASSWORD", "")).strip()
    except Exception:
        secret_password = ""

    return secret_password


def require_curator_login() -> None:
    app_password = get_app_password()

    if not app_password:
        return

    if st.session_state.get("curator_logged_in") is True:
        return

    st.title("Corrosion Map Curator")
    st.caption("Restricted curator access")

    with st.form("curator_login_form"):
        entered_password = st.text_input(
            "Enter curator password",
            type="password",
            key="curator_login_password",
        )

        login_submitted = st.form_submit_button("Log in")

    if login_submitted:
        if entered_password == app_password:
            st.session_state.curator_logged_in = True
            st.rerun()
        else:
            st.error("Incorrect password.")

    st.stop()

def get_user_manual_english() -> str:
    return """
## Corrosion Map Curator — User Manual

### 1. Purpose of the app

The Corrosion Map Curator is a controlled data-management interface for building and maintaining the corrosion exposure-site database behind the public corrosion map.

It is used to:

- register literature, reports, standards, datasets, and other source materials;
- add corrosion exposure sites with coordinates and metadata;
- link each site to one or more supporting sources;
- record site-level and source-level information such as programme, metal, exposure duration, country/location, and region category;
- import larger CSV tables after preview and correction;
- edit, delete, and bulk-update existing records;
- publish selected curated sites to the public website dataset;
- upload the website dataset to GitHub so that the public map can update.

The curator database and the public map dataset are separate. Adding data to the curator does not automatically make it visible on the public map. A site appears on the public map only after it is selected in **Export / Publish** and the website dataset is uploaded to GitHub.

---

### 2. Main data structure

The app uses three main record types.

#### 2.1 Sources

A source is a paper, report, database, standard, or other document that provides evidence for one or more corrosion exposure sites.

A source normally includes:

- `source_code`, such as `s018`;
- source title;
- programme, such as `ICP/UNECE`, `MICAT`, `ISOCORRAG`, or another programme;
- metals covered by the source;
- exposure periods or durations covered by the source;
- PDF path or external URL;
- notes.

Add or register sources before linking them to sites.

#### 2.2 Sites

A site is a corrosion exposure location.

A site normally includes:

- `site_id`, such as `GB-005`;
- site label, such as `London`;
- latitude and longitude;
- modern country/location;
- administering country, where relevant;
- former political or administrative entity, where relevant;
- region category;
- metal;
- exposure period;
- notes.

The app can suggest a site ID from the country/location. For Antarctic or sub-Antarctic records, the administering country can be used in the site ID prefix.

#### 2.3 Site-source links

A site-source link records that a specific source supports a specific site.

This link can also store metadata that may differ from the broad site or source record, such as:

- source order;
- metal(s) reported for that site in that source;
- exposure period(s) reported for that site in that source;
- link-specific notes.

This is important because one source may report many sites, and one site may be supported by several sources.

---

### 3. Recommended workflow

#### Step 1 — Add or register sources

Go to **Sources**.

Use this page to:

- register existing PDFs from the `source_pdfs/` folder;
- add a new source manually;
- assign programme, metals, and exposure periods to sources;
- update existing source metadata in batches.

Minimum recommended fields for a source are:

- source code;
- source title;
- programme;
- metals;
- exposure periods;
- PDF path or URL where available.

Important: in the online version, uploaded PDFs may not be permanently stored unless they are later committed to GitHub or moved to persistent storage. The database metadata is persistent, but the hosted file system should not be treated as permanent PDF storage.

#### Step 2 — Add sites

Go to **Sites**.

Use the location search to obtain approximate coordinates, or enter coordinates manually. Then fill in the site information.

Recommended fields are:

- site label;
- latitude;
- longitude;
- modern country/location;
- administering country if relevant;
- region category;
- metal;
- exposure period;
- notes where needed.

When a site label and location appear to match an existing site, the app warns you that the new entry may update an existing site row instead of creating a duplicate. Review this message carefully.

#### Step 3 — Link sources to sites

Still in **Sites**, open **Source evidence for existing site(s)**.

Select one or more site records and one or more source records. Then choose the metals and exposure periods that apply to the site-source relationship.

Use this when:

- a source provides evidence for a newly added site;
- a site is already in the database but needs another supporting source;
- source-level metadata should be transferred into site-level metadata.

The checkbox **After linking, add missing metals/exposure periods to the site-level summary fields** is normally useful. It helps keep the site summary fields consistent with the underlying source evidence.

#### Step 4 — Review and edit records

Go to **Manage Records**.

Use this page to:

- search existing sites or sources;
- directly edit table cells;
- save table edits;
- delete selected records;
- bulk-update selected records;
- preview and apply automatic region-category suggestions.

Deletion is intentionally protected. You must tick the relevant confirmation checkbox before destructive actions are applied.

If a site/source cannot be deleted, check whether it still has site-source links. Delete the link first if needed.

#### Step 5 — Import CSV data

Go to **Import**.

Upload a CSV file containing site and source information. The app will build a preview table before anything is written to the database.

During import, check:

- whether each row will create a new site or merge into an existing site;
- whether source codes already exist;
- whether new source codes will be created;
- whether generated site IDs look correct;
- whether latitude and longitude are valid;
- whether the source and metadata fields are correctly interpreted.

No import is saved until you tick the confirmation checkbox and click **Confirm selected import**.

#### Step 6 — Publish to the public website dataset

Go to **Export / Publish**.

This page controls what appears on the public corrosion map.

Use **Yet to be published** to select new curated sites that should be added to the public dataset.

Use **Already published** to keep or remove existing public sites from the next website dataset.

Then:

1. review the selected sites;
2. tick **I reviewed the selected sites and want to update the website dataset**;
3. optionally tick **After confirming publish, upload the website dataset to GitHub using the API**;
4. click **Confirm publish to website**.

If automatic GitHub upload is not selected, use the separate **Upload latest website publish to GitHub** button afterwards.

After upload, the public map may take a few seconds or minutes to show the change. If the change is not visible immediately, hard-refresh the public map page.

---

### 4. Removing a published test site

To remove a published test site from the public map without deleting it from the curator database:

1. Go to **Export / Publish**.
2. Open **Quick remove already published site(s) from public map**.
3. Select the test site.
4. Tick the confirmation checkbox.
5. Click **Remove selected site(s) from public map and upload to GitHub**.
6. Wait for the public map to update.

This removes the site from the public website dataset, not from the curator database.

To delete it completely from the database, also remove it from **Manage Records** after it has been removed from the public dataset.

---

### 5. Good data-entry practice

Use consistent source codes, site IDs, and metadata spelling.

Recommended practices:

- check whether a source already exists before adding a new one;
- check whether a site already exists before adding a duplicate;
- use controlled tags where possible;
- keep notes concise but informative;
- avoid deleting records unless you are certain they are wrong;
- use the preview tables before importing or publishing;
- publish only after reviewing the selected records.

For uncertain data, prefer adding a note rather than forcing an uncertain classification.

---

### 6. What not to do

Please avoid the following unless you know exactly why you are doing it:

- do not use the **Settings** page for database reset or maintenance unless instructed;
- do not delete sources that are still linked to sites;
- do not delete sites that are still intended to appear on the map;
- do not assume uploaded PDFs are permanently stored in the online app;
- do not publish immediately after import without reviewing the imported rows;
- do not share the curator password or GitHub/Supabase credentials publicly.

---

### 7. Troubleshooting

If a table appears blank or does not render correctly, use Chrome and refresh the page.

If newly added data does not appear on the public map, check the following:

1. the site exists in the curator database;
2. the site was selected in **Export / Publish**;
3. the website dataset was uploaded to GitHub successfully;
4. `data/sites.csv` in GitHub contains the new row;
5. the public map page has been refreshed.

If GitHub upload fails, the public map will not update even if the curator database was changed.

If a source or site deletion fails, remove related site-source links first.
If none works, ask Jason.
"""


def get_user_manual_chinese() -> str:
    return """
## 腐蚀地图数据管理器 — 用户手册

### 1. 程序用途

腐蚀地图数据管理器是一个用于维护公开腐蚀地图后台数据的受控数据管理界面。

它主要用于：

- 注册论文、报告、标准、数据库和其他资料来源；
- 添加腐蚀暴露站点及其坐标和元数据；
- 将每个站点与一个或多个资料来源建立关联；
- 记录研究计划、金属材料、暴露时间、国家/地区、区域类别等信息；
- 导入较大的 CSV 表格，并在写入数据库前进行预览和检查；
- 编辑、删除和批量更新已有记录；
- 将选定的站点发布到公开网站数据集；
- 通过 GitHub API 上传网站数据文件，使公开地图更新。

需要注意的是，curator 数据库和公开地图读取的数据集是分开的。把数据加入 curator 数据库，并不代表它会立即出现在公开地图上。只有在 **Export / Publish** 页面中选择站点并上传网站数据集到 GitHub 后，该站点才会出现在公开地图中。

---

### 2. 主要数据结构

本程序主要管理三类记录。

#### 2.1 资料来源 Sources

资料来源可以是论文、报告、数据库、标准或其他能够支持腐蚀暴露站点信息的材料。

一个资料来源通常包括：

- `source_code`，例如 `s018`；
- 资料标题；
- 研究计划，例如 `ICP/UNECE`、`MICAT`、`ISOCORRAG` 或其他计划；
- 该资料涉及的金属材料；
- 该资料涉及的暴露时间或暴露周期；
- PDF 路径或外部链接；
- 备注。

建议先添加或注册资料来源，再将其关联到站点。

#### 2.2 站点 Sites

站点是腐蚀暴露实验或观测发生的位置。

一个站点通常包括：

- `site_id`，例如 `GB-005`；
- 站点名称，例如 `London`；
- 纬度和经度；
- 现代国家或地区；
- 管理国家，如适用；
- 历史政治或行政实体，如适用；
- 区域类别；
- 金属材料；
- 暴露时间；
- 备注。

程序可以根据国家或地区自动建议 site ID。对于南极或亚南极站点，管理国家也可用于生成站点编号前缀。

#### 2.3 站点-资料关联 Site-source links

站点-资料关联用于记录某个资料来源支持某个具体站点。

这个关联本身也可以保存一些信息，例如：

- 资料顺序；
- 该资料中对该站点报道的金属材料；
- 该资料中对该站点报道的暴露时间；
- 关联关系的备注。

这很重要，因为一个资料来源可能包含多个站点，一个站点也可能由多个资料来源支持。

---

### 3. 推荐工作流程

#### 步骤 1 — 添加或注册资料来源

进入 **Sources** 页面。

此页面可用于：

- 注册 `source_pdfs/` 文件夹中已有的 PDF；
- 手动添加新的资料来源；
- 为资料来源分配研究计划、金属材料和暴露时间；
- 批量更新已有资料来源的元数据。

建议至少填写以下字段：

- source code；
- 资料标题；
- 研究计划；
- 金属材料；
- 暴露时间；
- PDF 路径或外部链接，如有。

重要提示：在线版本中的 PDF 上传不一定是永久存储，除非之后将 PDF 提交到 GitHub 或转移到其他持久化存储。数据库中的文字元数据是持久的，但在线托管环境中的文件系统不应被视为永久 PDF 存储位置。

#### 步骤 2 — 添加站点

进入 **Sites** 页面。

可以使用地点搜索功能获取大致坐标，也可以手动输入坐标。之后填写站点信息。

建议填写：

- 站点名称；
- 纬度；
- 经度；
- 现代国家或地区；
- 管理国家，如适用；
- 区域类别；
- 金属材料；
- 暴露时间；
- 必要的备注。

如果程序判断新输入的站点可能与已有站点相同，它会提示该记录可能更新已有站点，而不是创建重复站点。请认真检查该提示。

#### 步骤 3 — 将资料来源关联到站点

仍在 **Sites** 页面，打开 **Source evidence for existing site(s)**。

选择一个或多个站点，再选择一个或多个资料来源。然后为该站点-资料关系选择对应的金属材料和暴露时间。

该功能适用于：

- 某个资料来源支持一个新加入的站点；
- 一个已有站点需要补充新的资料来源；
- 需要把资料来源中的金属和暴露时间信息合并到站点层面的汇总字段中。

通常建议保留 **After linking, add missing metals/exposure periods to the site-level summary fields** 选项。这样有助于保持站点汇总字段与底层资料证据一致。

#### 步骤 4 — 检查和编辑记录

进入 **Manage Records** 页面。

此页面可用于：

- 搜索已有站点或资料来源；
- 直接编辑表格单元格；
- 保存表格修改；
- 删除选定记录；
- 批量更新选定记录；
- 预览并应用自动区域分类建议。

删除操作受到保护。执行删除前必须勾选相应的确认框。

如果某个站点或资料来源无法删除，请检查它是否仍然存在站点-资料关联。必要时先删除关联关系，再删除站点或资料来源。

#### 步骤 5 — 导入 CSV 数据

进入 **Import** 页面。

上传包含站点和资料来源信息的 CSV 文件。程序会先生成预览表，在确认前不会写入数据库。

导入前应检查：

- 每一行是创建新站点，还是合并到已有站点；
- source code 是否已经存在；
- 是否会创建新的资料来源；
- 自动生成的 site ID 是否合理；
- 经纬度是否有效；
- 资料来源和元数据字段是否被正确解析。

只有在勾选确认框并点击 **Confirm selected import** 后，数据才会写入数据库。

#### 步骤 6 — 发布到公开网站数据集

进入 **Export / Publish** 页面。

此页面控制哪些站点会出现在公开腐蚀地图上。

使用 **Yet to be published** 选择需要新增到公开数据集的站点。

使用 **Already published** 保留或移除已经存在于公开数据集中的站点。

操作步骤：

1. 检查选定站点；
2. 勾选 **I reviewed the selected sites and want to update the website dataset**；
3. 如需自动上传到 GitHub，勾选 **After confirming publish, upload the website dataset to GitHub using the API**；
4. 点击 **Confirm publish to website**。

如果没有选择自动 GitHub 上传，则需要之后点击 **Upload latest website publish to GitHub**。

上传后，公开地图可能需要数秒到数分钟才会显示变化。如果没有立即显示，请强制刷新公开地图页面。

---

### 4. 删除已发布的测试站点

如果需要从公开地图中移除一个已发布的测试站点，但暂时不从 curator 数据库删除它：

1. 进入 **Export / Publish**；
2. 打开 **Quick remove already published site(s) from public map**；
3. 选择测试站点；
4. 勾选确认框；
5. 点击 **Remove selected site(s) from public map and upload to GitHub**；
6. 等待公开地图更新。

这个操作只会把站点从公开网站数据集中移除，不会删除 curator 数据库中的站点记录。

如果需要彻底删除测试站点，可以在它从公开数据集中移除后，再到 **Manage Records** 中删除该站点记录。

---

### 5. 良好的数据录入习惯

请尽量保持 source code、site ID 和元数据命名的一致性。

建议：

- 添加资料来源前，先检查是否已经存在；
- 添加站点前，先检查是否已经存在相同或相近站点；
- 尽量使用已有的标准标签；
- 备注应简洁但有信息量；
- 不确定时不要随意删除记录；
- 导入和发布前务必检查预览表；
- 只有在确认数据无误后才发布到公开地图。

对于不确定的信息，建议在备注中说明，而不是强行归类。

---

### 6. 不建议进行的操作

除非明确知道原因，请避免以下操作：

- 不要随意使用 **Settings** 页面中的数据库重置或维护功能；
- 不要删除仍然与站点关联的资料来源；
- 不要删除仍然需要出现在地图上的站点；
- 不要假设在线上传的 PDF 会永久保存；
- 不要在导入后未经检查就立即发布；
- 不要公开分享 curator 密码、GitHub token 或 Supabase 凭据。

---

### 7. 常见问题排查

如果表格显示为空或渲染异常，建议使用 Chrome 浏览器并刷新页面。

如果新加入的数据没有出现在公开地图上，请依次检查：

1. 该站点是否已经存在于 curator 数据库；
2. 该站点是否在 **Export / Publish** 中被选中；
3. 网站数据集是否成功上传到 GitHub；
4. GitHub 仓库中的 `data/sites.csv` 是否包含该站点；
5. 是否已经刷新公开地图页面。

如果 GitHub 上传失败，即使 curator 数据库已经修改，公开地图也不会更新。

如果删除资料来源或站点失败，请先检查并删除相关的站点-资料关联。
如果都没用，找Jason。
"""

st.set_page_config(
    page_title="Corrosion Map Curator",
    layout="wide",
)

require_curator_login()

manual_col_title, manual_col_controls = st.columns(
    [0.72, 0.28],
    vertical_alignment="center",
)

with manual_col_title:
    st.title("Corrosion Map Curator")
    st.caption("Local curation app for managing sites, sources, and site-source links.")

with manual_col_controls:
    manual_button_col, logout_button_col = st.columns(
        [0.66, 0.34],
        gap="small",
        vertical_alignment="center",
    )

    with manual_button_col:
        with st.popover("📘 User Manual", use_container_width=True):
            manual_language = st.segmented_control(
                "Manual language",
                options=["English", "中文"],
                default="English",
                key="manual_language_selector",
            )

            if manual_language == "English":
                st.markdown(get_user_manual_english())
            else:
                st.markdown(get_user_manual_chinese())
    with logout_button_col:
        if st.button("Log out", key="curator_logout_button", use_container_width=True):
            st.session_state.curator_logged_in = False
            st.rerun()

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

if "website_publish_ready_for_git" not in st.session_state:
    st.session_state.website_publish_ready_for_git = False

if "last_git_publish_output" not in st.session_state:
    st.session_state.last_git_publish_output = ""

if "last_git_publish_message" not in st.session_state:
    st.session_state.last_git_publish_message = ""

if "last_publish_live_path" not in st.session_state:
    st.session_state.last_publish_live_path = ""

if "last_publish_batch_path" not in st.session_state:
    st.session_state.last_publish_batch_path = ""
    
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
    if str(DB_PATH).upper() == "SUPABASE":
        st.write("Database backend: `SUPABASE`")
        st.success("Connected in Supabase backend mode.")
    else:
        st.write("Database backend: `Local SQLite`")
        st.write(f"Database file: `{display_app_path(DB_PATH)}`")
        st.warning(
            "Running in local SQLite backend mode. "
            "If this is the online deployment, DB_BACKEND is not being read as 'supabase'."
        )

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

            select_sources_clicked, deselect_sources_clicked = render_left_button_pair(
                "Select all sources",
                "Deselect all sources",
                left_key="select_all_combined_source_metadata",
                right_key="deselect_all_combined_source_metadata",
                widths=BUTTON_PAIR_COMPACT,
            )

            if select_sources_clicked:
                st.session_state[source_selection_key] = source_labels
                st.rerun()

            if deselect_sources_clicked:
                st.session_state[source_selection_key] = []
                st.rerun()

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

    with st.container():
        site_label = st.text_input(
            "Site label",
            placeholder="e.g. Berlin",
            key="site_label_input",
        )

        site_type = ""

        col1, col2 = st.columns(2)

        with col1:
            latitude = st.text_input(
                "Latitude",
                key="site_latitude",
                placeholder="e.g. 50.0755",
            )

        with col2:
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

        submit_site = st.button("Add site", key="add_site_button")

        site_match_preview = preview_site_upsert_match(
            site_id=site_id,
            site_label=site_label,
            latitude=latitude,
            longitude=longitude,
            modern_country_location=modern_country_location,
        )

        if site_match_preview.get("will_merge"):
            st.warning(site_match_preview["message"])
        elif site_match_preview.get("checked"):
            st.success(site_match_preview["message"])
        elif site_match_preview.get("message"):
            st.info(site_match_preview["message"])

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

                    site_db_id, site_action, match_reason = upsert_site_record(
                        {
                            "site_id": site_id,
                            "site_label": site_label,
                            "site_type": site_type,
                            "latitude": latitude_value,
                            "longitude": longitude_value,
                            "modern_country_location": modern_country_location,
                            "administering_country": administering_country,
                            "former_entity": former_entity,
                            "region_category": region_category,
                            "exposure_period": exposure_period,
                            "metal": metal,
                            "notes": site_notes,
                        }
                    )

                    merge_metadata_for_multiple_sites([site_db_id])

                    st.session_state.clear_site_form_after_success = True

                    if site_action == "created":
                        set_flash_message(f"Site '{site_label.strip()}' added successfully.")
                    else:
                        set_flash_message(
                            f"Site '{site_label.strip()}' already existed. "
                            f"The existing site row was updated instead of creating a duplicate. "
                            f"Match basis: {match_reason}."
                        )

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

            site_link_labels = list(site_label_to_id.keys())
            source_link_labels = list(source_label_to_id.keys())

            if "link_sites_selected" not in st.session_state:
                st.session_state["link_sites_selected"] = []

            if "link_sources_selected" not in st.session_state:
                st.session_state["link_sources_selected"] = []

            st.write("##### Site selection")

            select_link_sites_clicked, deselect_link_sites_clicked = render_left_button_pair(
                "Select all sites",
                "Deselect all sites",
                left_key="select_all_link_sites",
                right_key="deselect_all_link_sites",
                widths=BUTTON_PAIR_COMPACT,
            )

            if select_link_sites_clicked:
                st.session_state["link_sites_selected"] = site_link_labels
                st.rerun()

            if deselect_link_sites_clicked:
                st.session_state["link_sites_selected"] = []
                st.rerun()

            selected_site_labels = st.multiselect(
                "Choose site(s)",
                options=site_link_labels,
                help="Choose one or more sites. Multiple selection allows bulk source linking.",
                key="link_sites_selected",
            )

            st.write("##### Source selection")

            select_link_sources_clicked, deselect_link_sources_clicked = render_left_button_pair(
                "Select all sources",
                "Deselect all sources",
                left_key="select_all_link_sources",
                right_key="deselect_all_link_sources",
                widths=BUTTON_PAIR_COMPACT,
            )

            if select_link_sources_clicked:
                st.session_state["link_sources_selected"] = source_link_labels
                st.rerun()

            if deselect_link_sources_clicked:
                st.session_state["link_sources_selected"] = []
                st.rerun()

            selected_source_labels = st.multiselect(
                "Choose source(s)",
                options=source_link_labels,
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
                height=get_table_height(len(link_df_editor)),
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

            confirm_delete_links = st.checkbox(
                "Confirm deletion of selected site-source links",
                key="confirm_delete_site_source_links",
            )

            link_delete_left, link_delete_right = st.columns([0.72, 0.28])

            with link_delete_right:
                delete_links_clicked = st.button(
                    "Delete selected site-source links",
                    key="delete_site_source_links",
                    use_container_width=True,
                )

            if delete_links_clicked:
                if not delete_link_ids:
                    st.error("Tick at least one site-source link first.")
                elif not confirm_delete_links:
                    st.error("Confirm deletion before deleting selected site-source links.")
                else:
                    try:
                        deleted_count = delete_site_source_links(delete_link_ids)
                        set_flash_message(f"Deleted {deleted_count} site-source link(s).")
                        st.rerun()
                    except Exception as exc:
                        st.error(f"Could not delete selected links: {exc}")

if active_page == "Manage Records":
    st.subheader("Manage Records")
    st.markdown('<div id="manage-records-top"></div>', unsafe_allow_html=True)
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
        st.stop()

    st.write("#### Browse records")

    search_text = st.text_input(
        "Search records",
        placeholder="Search by site ID, label, source code, country, metal, programme, etc.",
        key=f"manage_search_{manage_table}",
    )

    filtered_rows = filter_records_by_search(rows, search_text)

    if not filtered_rows:
        st.info("No records match the current search.")
        st.stop()

    total_filtered_rows = len(filtered_rows)

    page_key = f"manage_page_{manage_table}"
    page_size_key = f"manage_page_size_{manage_table}"

    current_page, page_size = get_pagination_state(
        total_rows=total_filtered_rows,
        page_key=page_key,
        page_size_key=page_size_key,
    )

    start_index = (int(current_page) - 1) * page_size
    end_index = start_index + page_size

    page_rows = filtered_rows[start_index:end_index]

    st.caption(
        f"Showing rows {start_index + 1}–{min(end_index, total_filtered_rows)} "
        f"of {total_filtered_rows} matching record(s). "
        f"Total records in `{manage_table}`: {len(rows)}."
    )

    df_original = pd.DataFrame(page_rows).reset_index(drop=True)

    if manage_table == "sites":
        editable_columns = [
            "site_id",
            "site_label",
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
        df_editor["region_category"] = df_editor["region_category"].apply(split_chip_values)
        df_editor["metal"] = df_editor["metal"].apply(split_chip_values)
        df_editor["exposure_period"] = df_editor["exposure_period"].apply(split_chip_values)

        preferred_site_columns = [
            "id",
            "site_id",
            "site_label",
            "source_codes",
            "programmes",
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
        df_editor.insert(0, "delete", False)

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

        region_options = merge_option_values(
            REGION_TAG_OPTIONS,
            [
                item
                for value in df_editor.get("region_category", [])
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
            "region_category": st.column_config.MultiselectColumn(
                "Region category",
                options=region_options,
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

        df_editor.insert(0, "delete", False)

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

    df_editor["delete"] = st.session_state[delete_state_key]

    search_signature = re.sub(
        r"[^a-zA-Z0-9]+",
        "_",
        search_text.strip().lower(),
    )[:30] or "all"

    edited_df = st.data_editor(
        df_editor,
        hide_index=True,
        width="stretch",
        height=get_table_height(len(df_editor)),
        disabled=disabled_columns,
        num_rows="fixed",
        key=f"data_editor_{manage_table}_{current_page}_{page_size}_{search_signature}",
        column_config=column_config,
    )

    confirm_row_left, confirm_row_right = st.columns([0.58, 0.42])

    with confirm_row_right:
        confirm_spacer, confirm_checkbox_col = st.columns(
            [0.22, 0.78],
            vertical_alignment="center",
        )

        with confirm_checkbox_col:
            confirm_bulk_delete = st.checkbox(
                "Confirm deletion of selected records",
                key=f"confirm_delete_{manage_table}",
        )

    action_left, action_right = st.columns([0.58, 0.42], vertical_alignment="bottom")

    with action_left:
        select_delete_clicked, deselect_delete_clicked = render_left_button_pair(
            "Select all for deletion",
            "Deselect all deletion",
            left_key=f"select_all_delete_{manage_table}",
            right_key=f"deselect_all_delete_{manage_table}",
            widths=BUTTON_PAIR_MEDIUM,
        )

        if select_delete_clicked:
            st.session_state[delete_state_key] = True
            st.rerun()

        if deselect_delete_clicked:
            st.session_state[delete_state_key] = False
            st.rerun()

    with action_right:
        right_spacer, delete_button_col, save_button_col = st.columns(
            [0.22, 0.39, 0.39],
            vertical_alignment="bottom",
        )

        with delete_button_col:
            delete_clicked = st.button(
                "Delete selected records",
                key=f"delete_selected_{manage_table}",
                use_container_width=True,
            )

        with save_button_col:
            save_clicked = st.button(
                "Save table edits",
                key=f"save_edits_{manage_table}",
                use_container_width=True,
            )

    if save_clicked:
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

                    if column == "region_category":
                        old_normalised = normalize_region_category(split_chip_values(old_value))
                        new_normalised = normalize_region_category(split_chip_values(new_value))
                    elif column in {"metal", "exposure_period"}:
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

                    if column in {"region_category", "metal", "exposure_period"}:
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

    if delete_clicked:
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

    render_pagination_controls(
        total_rows=total_filtered_rows,
        page_key=page_key,
        page_size_key=page_size_key,
    )

    st.write("#### Bulk edit selected records")

    row_label_to_id = {
        build_row_label(row, manage_table): int(row["id"])
        for row in filtered_rows
    }

    row_labels = list(row_label_to_id.keys())
    bulk_selection_key = f"bulk_rows_{manage_table}"

    if bulk_selection_key not in st.session_state:
        st.session_state[bulk_selection_key] = []

    bulk_select_clicked, bulk_deselect_clicked = render_left_button_pair(
        "Select all records for bulk edit",
        "Deselect all records for bulk edit",
        left_key=f"select_all_bulk_rows_{manage_table}",
        right_key=f"deselect_all_bulk_rows_{manage_table}",
        widths=BUTTON_PAIR_LONG,
    )

    if bulk_select_clicked:
        st.session_state[bulk_selection_key] = row_labels
        st.rerun()

    if bulk_deselect_clicked:
        st.session_state[bulk_selection_key] = []
        st.rerun()

    selected_row_labels = st.multiselect(
        "Choose records to update",
        options=row_labels,
        key=bulk_selection_key,
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
                row for row in filtered_rows
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
                height=get_table_height(
                    len(auto_region_preview_df),
                    max_height=DATAFRAME_MAX_HEIGHT,
                ),
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

            apply_auto_clicked, clear_auto_clicked = render_left_button_pair(
                "Apply automatic region categories",
                "Clear automatic region preview",
                left_key="apply_auto_region_categories",
                right_key="clear_auto_region_preview",
                widths=(0.24, 0.24, 0.52),
            )

            if apply_auto_clicked:
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

            if clear_auto_clicked:
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

            preview_df = annotate_import_preview_for_upsert(preview_df)

            if preview_df.empty:
                st.warning("The uploaded file did not produce any importable preview rows.")
            else:
                st.success(f"Parsed {len(preview_df)} preview row(s).")

                site_preview_df = build_site_level_import_preview(preview_df)

                select_import_clicked, deselect_import_clicked = render_left_button_pair(
                    "Select all import sites",
                    "Deselect all import sites",
                    left_key="select_all_import_sites",
                    right_key="deselect_all_import_sites",
                    widths=BUTTON_PAIR_MEDIUM,
                )

                if select_import_clicked:
                    site_preview_df["import_selected"] = True

                if deselect_import_clicked:
                    site_preview_df["import_selected"] = False

                visible_site_preview_columns = [
                    "import_selected",
                    "csv_rows",
                    "site_action",
                    "site_upsert_status",
                    "site_upsert_match",
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
                    "source_statuses",
                    "new_sources",
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

                for chip_column in [
                    "source_codes",
                    "source_statuses",
                    "new_sources",
                    "programmes",
                    "metals",
                    "exposure_periods",
                ]:
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
                    height=get_table_height(len(site_preview_display_df)),
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
                        "site_upsert_status",
                        "site_upsert_match",
                        "source_statuses",
                        "new_sources",
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

                new_source_codes: list[str] = []

                if "new_sources" in edited_site_preview_df.columns:
                    for value in edited_site_preview_df["new_sources"].dropna().tolist():
                        for item in split_chip_values(value):
                            if item not in new_source_codes:
                                new_source_codes.append(item)

                new_source_codes = sorted(new_source_codes)

                if new_source_codes:
                    st.warning(
                        "New source code(s) detected in the imported CSV and not currently registered "
                        "in the Streamlit database. They will be created during import: "
                        + ", ".join(new_source_codes)
                    )   

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
    st.write(f"Live website file: `{display_app_path(OUTPUT_CSV_PATH)}`")
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
        edited_unpublished_df = pd.DataFrame()

        st.write("### Yet to be published")

        if unpublished_df.empty:
            st.success("All curated sites are currently present in the website dataset.")
        else:
            unpublished_publish_default_key = "unpublished_publish_default"

            if unpublished_publish_default_key not in st.session_state:
                st.session_state[unpublished_publish_default_key] = False

            select_unpublished_clicked, deselect_unpublished_clicked = render_left_button_pair(
                "Select all unpublished sites",
                "Deselect unpublished sites",
                left_key="select_all_unpublished_publish",
                right_key="deselect_all_unpublished_publish",
                widths=BUTTON_PAIR_LONG,
            )

            if select_unpublished_clicked:
                st.session_state[unpublished_publish_default_key] = True
                st.session_state.pop("unpublished_sites_publish_editor", None)
                st.rerun()

            if deselect_unpublished_clicked:
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
                height=get_table_height(len(unpublished_display_df)),
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

            keep_published_clicked, remove_published_clicked = render_left_button_pair(
                "Keep all already published sites",
                "Remove all already published from next website dataset",
                left_key="select_all_published_publish",
                right_key="deselect_all_published_publish",
                widths=BUTTON_PAIR_EXTRA_LONG,
            )

            if keep_published_clicked:
                st.session_state[published_publish_default_key] = True
                st.session_state.pop("published_sites_publish_editor", None)
                st.rerun()

            if remove_published_clicked:
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
                height=get_table_height(len(published_display_df)),
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

        publish_to_github_after_export = st.checkbox(
            "After confirming publish, upload the website dataset to GitHub using the API",
            value=False,
            key="publish_to_github_after_export",
        )

        git_commit_message = st.text_input(
            "Git commit message",
            value="Update corrosion map website dataset",
            key="git_commit_message",
        )

        with st.expander("Quick remove already published site(s) from public map", expanded=False):
            st.caption(
                "Use this to remove one or more already published sites from the public map "
                "without deleting them from the curator database."
            )

            if already_published_df.empty:
                st.info("No already published sites are available to remove.")
            else:
                published_remove_label_to_id = {}

                for _, row in already_published_df.iterrows():
                    label = (
                        f"{row.get('site_id', '')} — "
                        f"{row.get('site_label', '')} "
                        f"[database id: {int(row['site_db_id'])}]"
                    )
                    published_remove_label_to_id[label] = int(row["site_db_id"])

                selected_remove_labels = st.multiselect(
                    "Published site(s) to remove from public map",
                    options=list(published_remove_label_to_id.keys()),
                    key="quick_remove_published_site_labels",
                )

                selected_remove_site_db_ids = [
                    published_remove_label_to_id[label]
                    for label in selected_remove_labels
                ]

                confirm_quick_remove = st.checkbox(
                    "I understand this removes the selected site(s) from the public map dataset, but does not delete them from the curator database.",
                    key="confirm_quick_remove_published_sites",
                )

                if st.button(
                    "Remove selected site(s) from public map and upload to GitHub",
                    key="quick_remove_published_sites_from_map",
                    type="secondary",
                ):
                    if not selected_remove_site_db_ids:
                        st.error("Select at least one already published site to remove.")
                    elif not confirm_quick_remove:
                        st.error("Tick the confirmation checkbox before removing published site(s).")
                    else:
                        keep_site_db_ids = [
                            int(row["site_db_id"])
                            for _, row in publish_df.iterrows()
                            if bool(row["is_already_published"])
                            and int(row["site_db_id"]) not in selected_remove_site_db_ids
                        ]

                        if not keep_site_db_ids:
                            st.error(
                                "This shortcut would publish an empty website dataset. "
                                "Use the normal publish table if you truly intend to remove every site."
                            )
                        else:
                            try:
                                result = publish_selected_sites_csv(keep_site_db_ids)

                                st.session_state.last_publish_live_path = str(result["live_path"])
                                st.session_state.last_publish_batch_path = str(result["batch_path"])

                                github_result = publish_files_to_github(
                                    live_path=str(result["live_path"]),
                                    batch_path=str(result["batch_path"]),
                                    commit_message=(
                                        git_commit_message.strip()
                                        or "Remove published site from corrosion map website dataset"
                                    ),
                                )

                                st.session_state.last_git_publish_output = str(github_result["output"])
                                st.session_state.last_git_publish_message = str(github_result["message"])

                                if bool(github_result["ok"]):
                                    st.session_state.website_publish_ready_for_git = False
                                    set_flash_message(
                                        "Selected published site(s) removed from the public map dataset "
                                        "and uploaded to GitHub. The map may take a few seconds or minutes "
                                        "to show the change.",
                                        level="success",
                                    )
                                else:
                                    st.session_state.website_publish_ready_for_git = True
                                    set_flash_message(
                                        "The local website dataset was updated, but GitHub upload did not complete: "
                                        + str(github_result["message"]),
                                        level="warning",
                                    )

                                set_next_active_page("Export / Publish")
                                st.rerun()

                            except Exception as exc:
                                st.error(f"Could not remove selected published site(s): {exc}")

        publish_button_col, map_button_col = st.columns(
            [0.68, 0.32],
            vertical_alignment="top",
        )

        with publish_button_col:
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
                        st.session_state.last_publish_live_path = str(result["live_path"])
                        st.session_state.last_publish_batch_path = str(result["batch_path"])

                        st.session_state.website_publish_ready_for_git = True

                        publish_message = (
                            "Website dataset published successfully. "
                            f"Published sites: {result['rows']}. "
                            f"Live file: {display_app_path(result['live_path'])}. "
                            f"Batch snapshot: {result['batch_name']}."
                        )

                        if publish_to_github_after_export:
                            github_result = publish_files_to_github(
                                live_path=str(result["live_path"]),
                                batch_path=str(result["batch_path"]),
                                commit_message=git_commit_message,
                            )

                            st.session_state.last_git_publish_output = str(github_result["output"])
                            st.session_state.last_git_publish_message = str(github_result["message"])

                            if bool(github_result["ok"]):
                                st.session_state.website_publish_ready_for_git = False
                                set_flash_message(
                                    publish_message + " " + str(github_result["message"]),
                                    level="success",
                                )
                            else:
                                st.session_state.website_publish_ready_for_git = True
                                set_flash_message(
                                    publish_message + " However, GitHub API publish did not complete: "
                                    + str(github_result["message"]),
                                    level="warning",
                                )
                        else:
                            set_flash_message(
                                publish_message + " You can now use the separate GitHub API upload button.",
                                level="success",
                            )

                        set_next_active_page("Export / Publish")
                        st.rerun()

                    except Exception as exc:
                        st.error(f"Website publish failed: {exc}")
        with map_button_col:
            if MAP_WEBSITE_URL:
                st.link_button(
                    "Open public map website ↗",
                    MAP_WEBSITE_URL,
                    use_container_width=True,
                )
            else:
                st.info("Set MAP_WEBSITE_URL in secrets to enable the map shortcut.")

            st.caption("Published changes may take a few seconds or minutes to appear on the map.")
        
        st.divider()
        st.write("#### Upload latest website publish to GitHub")

        if st.session_state.last_git_publish_message:
            if st.session_state.website_publish_ready_for_git:
                st.warning(st.session_state.last_git_publish_message)
            else:
                st.success(st.session_state.last_git_publish_message)

        if st.session_state.last_git_publish_output:
            with st.expander("Show last Git command output", expanded=False):
                st.code(st.session_state.last_git_publish_output, language="text")

        if st.button("Check GitHub API configuration", key="check_github_api_config"):
            st.session_state.git_status_preview = get_github_config_summary()

        if "git_status_preview" in st.session_state:
            with st.expander("GitHub API configuration", expanded=False):
                st.code(st.session_state.git_status_preview, language="text")

        manual_commit_disabled = not bool(st.session_state.website_publish_ready_for_git)

        if manual_commit_disabled:
            st.info(
                "GitHub upload is disabled until you successfully confirm a website publish in this app session."
            )

        if st.button(
            "Upload latest website publish to GitHub",
            key="upload_latest_publish_to_github",
            disabled=manual_commit_disabled,
        ):
            if not st.session_state.last_publish_live_path or not st.session_state.last_publish_batch_path:
                st.error("No latest publish file paths are available. Confirm website publish first.")
            else:
                github_result = publish_files_to_github(
                    live_path=st.session_state.last_publish_live_path,
                    batch_path=st.session_state.last_publish_batch_path,
                    commit_message=git_commit_message,
                )

                st.session_state.last_git_publish_output = str(github_result["output"])
                st.session_state.last_git_publish_message = str(github_result["message"])

                if bool(github_result["ok"]):
                    st.session_state.website_publish_ready_for_git = False
                    set_flash_message(str(github_result["message"]), level="success")
                else:
                    st.session_state.website_publish_ready_for_git = True
                    set_flash_message(str(github_result["message"]), level="warning")

                st.rerun()

if active_page == "Settings":
    st.subheader("Settings")
    st.caption("Maintenance tools and database safety controls.")

    st.write("#### Paths")
    if str(DB_PATH).upper() == "SUPABASE":
        st.write("Database backend: `SUPABASE`")
    else:
        if str(DB_PATH).upper() == "SUPABASE":
            st.write("Database backend: `SUPABASE`")
        else:
            st.write("Database backend: `Local SQLite`")
            st.write(f"Database file: `{display_app_path(DB_PATH)}`")

    st.write(f"Source PDF folder: `{SOURCE_PDF_RELATIVE_DIR}/`")

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