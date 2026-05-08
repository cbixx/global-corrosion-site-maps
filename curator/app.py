from __future__ import annotations

from pathlib import Path
import os
from typing import Any, cast
import re
import json
import hashlib
import time
from datetime import datetime, timezone

import pandas as pd
import pycountry
import streamlit as st
import streamlit.components.v1 as components
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
    get_app_setting,
    set_app_setting,
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
    delete_corrosion_observations,
    get_corrosion_observations,
    get_public_corrosion_observations,
    import_corrosion_observations,
    delete_environmental_observations,
    get_environmental_observations,
    get_public_environmental_observations,
    import_environmental_observations,
)

from importer import build_import_preview, search_osm_suggestions
from exporter import (
    OUTPUT_CSV_PATH,
    get_live_published_site_ids,
    get_publishable_sites,
    publish_selected_sites_csv,
)
from region_classifier import (
    classify_region_category,
    get_default_region_classification_settings,
    merge_region_classification_settings,
)
from github_publish import (
    get_github_config_summary,
    publish_files_to_github,
    publish_file_to_github,
)

from ui_styles import (
    escape_html,
    inject_app_styles,
    render_dashboard_card,
    render_section_title,
    render_workflow_step,
)

from i18n import t, language_code

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
    "Taiwan": "CN",
    "Chinese Taipei": "CN",
}


def normalize_location_name(value: str) -> str:
    return (value or "").strip()


def get_country_code(location_name: str) -> str:
    location_name = normalize_location_name(location_name)

    if not location_name:
        return ""

    if location_name in ANTARCTIC_LOCATION_NAMES:
        return "AQ"

    override_key = location_name.casefold()

    country_code_overrides_normalised = {
        key.casefold(): value
        for key, value in COUNTRY_CODE_NAME_OVERRIDES.items()
    }

    if override_key in country_code_overrides_normalised:
        return country_code_overrides_normalised[override_key]

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
CORROSION_OUTPUT_CSV_PATH = REPO_ROOT / "data" / "corrosion_observations.csv"
ENVIRONMENT_OUTPUT_CSV_PATH = REPO_ROOT / "data" / "environmental_observations.csv"

ENVIRONMENT_REQUIRED_COLUMNS = [
    "site_id",
    "variable_name",
    "value",
    "unit",
]

ENVIRONMENT_OPTIONAL_COLUMNS = [
    "aggregation",
    "period_start",
    "period_end",
    "data_source",
    "source_code",
    "notes",
]

ENVIRONMENT_TEMPLATE_COLUMNS = ENVIRONMENT_REQUIRED_COLUMNS + ENVIRONMENT_OPTIONAL_COLUMNS

CORROSION_REQUIRED_COLUMNS = [
    "site_id",
    "source_code",
    "material",
    "exposure_period",
    "corrosion_metric",
    "value",
    "unit",
]

CORROSION_OPTIONAL_COLUMNS = [
    "measurement_method",
    "specimen_condition",
    "exposure_condition",
    "notes",
]

CORROSION_TEMPLATE_COLUMNS = CORROSION_REQUIRED_COLUMNS + CORROSION_OPTIONAL_COLUMNS

DATA_EDITOR_MAX_HEIGHT = 520
DATAFRAME_MAX_HEIGHT = 420
DATA_EDITOR_ROW_HEIGHT = 34
DATA_EDITOR_HEADER_HEIGHT = 40
DATA_EDITOR_EXTRA_PADDING = 0

REGION_CLASSIFICATION_SETTINGS_KEY = "region_classification_rules"


def get_region_classification_settings() -> dict[str, Any]:
    saved_settings = get_app_setting(
        REGION_CLASSIFICATION_SETTINGS_KEY,
        default=None,
    )

    return merge_region_classification_settings(saved_settings)


def save_region_classification_settings(settings: dict[str, Any]) -> None:
    set_app_setting(
        REGION_CLASSIFICATION_SETTINGS_KEY,
        merge_region_classification_settings(settings),
    )


def lines_to_list(value: str) -> list[str]:
    return [
        line.strip()
        for line in str(value or "").splitlines()
        if line.strip()
    ]


def list_to_lines(value) -> str:
    if isinstance(value, list):
        return "\n".join(str(item).strip() for item in value if str(item).strip())

    return str(value or "").strip()


def build_region_settings_from_form(
    current_settings: dict[str, Any],
    form_prefix: str,
) -> dict[str, Any]:
    return {
        "distance_to_coast": {
            "marine_km": float(st.session_state[f"{form_prefix}_marine_km"]),
            "coastal_km": float(st.session_state[f"{form_prefix}_coastal_km"]),
            "near_coastal_km": float(st.session_state[f"{form_prefix}_near_coastal_km"]),
        },
        "latitude_rules": {
            "antarctic_latitude_max": float(st.session_state[f"{form_prefix}_antarctic_latitude_max"]),
            "sub_antarctic_latitude_min": float(st.session_state[f"{form_prefix}_sub_antarctic_latitude_min"]),
            "sub_antarctic_latitude_max": float(st.session_state[f"{form_prefix}_sub_antarctic_latitude_max"]),
            "sub_arctic_latitude_min": float(st.session_state[f"{form_prefix}_sub_arctic_latitude_min"]),
            "sub_arctic_latitude_max": float(st.session_state[f"{form_prefix}_sub_arctic_latitude_max"]),
            "tropical_abs_latitude_max": float(st.session_state[f"{form_prefix}_tropical_abs_latitude_max"]),
            "cold_abs_latitude_min": float(st.session_state[f"{form_prefix}_cold_abs_latitude_min"]),
            "extreme_cold_abs_latitude_min": float(st.session_state[f"{form_prefix}_extreme_cold_abs_latitude_min"]),
        },
        "semantic_rules": {
            "island_country_hints": lines_to_list(st.session_state[f"{form_prefix}_island_country_hints"]),
            "island_text_patterns": lines_to_list(st.session_state[f"{form_prefix}_island_text_patterns"]),
            "urban_patterns": lines_to_list(st.session_state[f"{form_prefix}_urban_patterns"]),
            "rural_patterns": lines_to_list(st.session_state[f"{form_prefix}_rural_patterns"]),
            "industrial_patterns": lines_to_list(st.session_state[f"{form_prefix}_industrial_patterns"]),
            "hot_arid_patterns": lines_to_list(st.session_state[f"{form_prefix}_hot_arid_patterns"]),
        },
    }


def build_region_classification_preview(
    site_rows: list[dict],
    settings: dict[str, Any],
    overwrite_existing: bool = False,
) -> pd.DataFrame:
    preview_rows = []

    for row in site_rows:
        current_region = str(row.get("region_category", "") or "").strip()

        if current_region and not overwrite_existing:
            continue

        result = classify_region_category(
            latitude=row.get("latitude"),
            longitude=row.get("longitude"),
            current_region_category=current_region,
            modern_country_location=row.get("modern_country_location", ""),
            site_type=row.get("site_type", ""),
            settings=settings,
        )

        suggested_region = str(result.region_category or "").strip()

        preview_rows.append(
            {
                "apply": True,
                "id": int(row["id"]),
                "site_id": row.get("site_id", ""),
                "site_label": row.get("site_label", ""),
                "latitude": row.get("latitude", ""),
                "longitude": row.get("longitude", ""),
                "current_region_category": current_region,
                "suggested_region_category": suggested_region,
                "notes": result.notes,
            }
        )

    return pd.DataFrame(preview_rows)

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
    return pdf_path.stem.strip().lower()

SOURCE_CODE_PATTERN = re.compile(r"^s\d{3}$")


def normalise_source_code(value: str) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"\.pdf$", "", text, flags=re.IGNORECASE)

    match = re.fullmatch(r"s?0*(\d{1,4})", text)

    if match:
        return f"s{int(match.group(1)):03d}"

    return text


def is_canonical_source_code(value: str) -> bool:
    return bool(SOURCE_CODE_PATTERN.fullmatch(str(value or "").strip().lower()))


def source_code_number(value: str) -> int | None:
    canonical_code = normalise_source_code(value)

    if not is_canonical_source_code(canonical_code):
        return None

    return int(canonical_code[1:])


def is_canonical_source_pdf_path(pdf_path: Path) -> bool:
    return is_canonical_source_code(pdf_path.stem)


def suggested_source_pdf_name(source_code: str) -> str:
    return f"{normalise_source_code(source_code)}.pdf"


def source_code_exists(
    source_code: str,
    exclude_source_id: int | None = None,
) -> bool:
    canonical_code = normalise_source_code(source_code)

    with get_connection() as conn:
        if exclude_source_id is None:
            row = conn.execute(
                """
                select id
                from sources
                where lower(trim(source_code)) = lower(trim(?))
                limit 1
                """,
                (canonical_code,),
            ).fetchone()
        else:
            row = conn.execute(
                """
                select id
                from sources
                where lower(trim(source_code)) = lower(trim(?))
                  and id <> ?
                limit 1
                """,
                (canonical_code, int(exclude_source_id)),
            ).fetchone()

    return row is not None


def get_next_source_code() -> str:
    numbers: list[int] = []

    try:
        with get_connection() as conn:
            rows = conn.execute(
                """
                select source_code
                from sources
                where source_code is not null
                """
            ).fetchall()

        for row in rows:
            number = source_code_number(str(row["source_code"]))
            if number is not None:
                numbers.append(number)
    except Exception:
        pass

    for pdf_path in list_source_pdf_files():
        number = source_code_number(pdf_path.stem)
        if number is not None:
            numbers.append(number)

    return f"s{(max(numbers) if numbers else 0) + 1:03d}"

def rename_noncanonical_source_pdf_files() -> dict[str, list[str]]:
    renamed_files: list[str] = []
    skipped_files: list[str] = []
    failed_files: list[str] = []

    for pdf_path in list_source_pdf_files():
        original_name = pdf_path.name
        canonical_source_code = normalise_source_code(pdf_path.stem)

        if not is_canonical_source_code(canonical_source_code):
            skipped_files.append(
                f"{original_name}: could not infer canonical source code"
            )
            continue

        canonical_name = f"{canonical_source_code}.pdf"
        target_path = pdf_path.with_name(canonical_name)

        if pdf_path.name == canonical_name:
            continue

        if target_path.exists():
            skipped_files.append(
                f"{original_name}: target `{canonical_name}` already exists"
            )
            continue

        try:
            pdf_path.rename(target_path)
            renamed_files.append(f"{original_name} → {canonical_name}")
        except Exception as exc:
            failed_files.append(f"{original_name}: {exc}")

    return {
        "renamed": renamed_files,
        "skipped": skipped_files,
        "failed": failed_files,
    }

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

def normalise_bool_value(value) -> bool:
    if isinstance(value, bool):
        return value

    if value is None:
        return False

    text = str(value).strip().lower()

    return text in {"true", "1", "yes", "y", "checked", "selected"}


def normalise_bool_column(df: pd.DataFrame, column: str) -> pd.Series:
    if column not in df.columns:
        return pd.Series([False] * len(df), index=df.index)

    return df[column].apply(normalise_bool_value)

DRAFT_AUTOSAVE_INTERVAL_SECONDS = 8
IMPORT_PREVIEW_DRAFT_KEY = "import_preview_draft"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def ensure_draft_schema_updates() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            create table if not exists app_drafts (
                draft_key text primary key,
                draft_label text not null,
                payload_json text not null,
                payload_hash text not null,
                updated_at text not null
            )
            """
        )
        conn.commit()


def make_payload_json(payload: dict[str, Any]) -> str:
    return json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        default=str,
    )


def make_payload_hash(payload: dict[str, Any]) -> str:
    payload_json = make_payload_json(payload)
    return hashlib.sha256(payload_json.encode("utf-8")).hexdigest()


def save_app_draft(
    draft_key: str,
    draft_label: str,
    payload: dict[str, Any],
) -> bool:
    payload_json = make_payload_json(payload)
    payload_hash = hashlib.sha256(payload_json.encode("utf-8")).hexdigest()

    with get_connection() as conn:
        existing = conn.execute(
            """
            select payload_hash
            from app_drafts
            where draft_key = ?
            """,
            (draft_key,),
        ).fetchone()

        if existing and str(existing["payload_hash"]) == payload_hash:
            return False

        conn.execute(
            """
            insert into app_drafts (
                draft_key,
                draft_label,
                payload_json,
                payload_hash,
                updated_at
            )
            values (?, ?, ?, ?, ?)
            on conflict(draft_key) do update set
                draft_label = excluded.draft_label,
                payload_json = excluded.payload_json,
                payload_hash = excluded.payload_hash,
                updated_at = excluded.updated_at
            """,
            (
                draft_key,
                draft_label,
                payload_json,
                payload_hash,
                utc_now_iso(),
            ),
        )
        conn.commit()

    return True


def autosave_app_draft(
    draft_key: str,
    draft_label: str,
    payload: dict[str, Any],
    interval_seconds: int = DRAFT_AUTOSAVE_INTERVAL_SECONDS,
) -> bool:
    now = time.time()
    last_save_key = f"draft_last_save_time::{draft_key}"
    last_hash_key = f"draft_last_hash::{draft_key}"

    payload_hash = make_payload_hash(payload)
    last_hash = st.session_state.get(last_hash_key, "")
    last_save_time = float(st.session_state.get(last_save_key, 0.0))

    if payload_hash == last_hash:
        return False

    if now - last_save_time < interval_seconds:
        return False

    saved = save_app_draft(
        draft_key=draft_key,
        draft_label=draft_label,
        payload=payload,
    )

    if saved:
        st.session_state[last_save_key] = now
        st.session_state[last_hash_key] = payload_hash

    return saved


def load_app_draft(draft_key: str) -> dict[str, Any] | None:
    with get_connection() as conn:
        row = conn.execute(
            """
            select draft_key, draft_label, payload_json, updated_at
            from app_drafts
            where draft_key = ?
            """,
            (draft_key,),
        ).fetchone()

    if not row:
        return None

    return {
        "draft_key": str(row["draft_key"]),
        "draft_label": str(row["draft_label"]),
        "payload": json.loads(str(row["payload_json"])),
        "updated_at": str(row["updated_at"]),
    }


def delete_app_draft(draft_key: str) -> None:
    with get_connection() as conn:
        conn.execute(
            "delete from app_drafts where draft_key = ?",
            (draft_key,),
        )
        conn.commit()

    st.session_state.pop(f"draft_last_save_time::{draft_key}", None)
    st.session_state.pop(f"draft_last_hash::{draft_key}", None)


def dataframe_to_draft_payload(df: pd.DataFrame) -> dict[str, Any]:
    clean_df = df.astype(object).where(pd.notna(df), "")
    return {
        "columns": list(clean_df.columns),
        "records": clean_df.to_dict("records"),
    }


def dataframe_from_draft_payload(payload: dict[str, Any]) -> pd.DataFrame:
    return pd.DataFrame(
        payload.get("records", []),
        columns=payload.get("columns", None),
    )

def clear_import_draft_session_state() -> None:
    for key in [
        "restored_import_preview_payload",
        "restored_import_preview_updated_at",
        "restored_import_preview_file_name",
        "import_site_preview_override",
        "latest_import_preview",
        "cached_import_preview_signature",
        "cached_import_preview_df",
        "cached_import_site_preview_df",
        "last_import_upload_signature",
    ]:
        st.session_state.pop(key, None)

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

REQUIRED_MARK = " *"


def required_label(label: str) -> str:
    return f"{label}{REQUIRED_MARK}"


def optional_label(label: str) -> str:
    return f"{label} (optional)"

SITE_FORM_KEYS = [
    "location_query",
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
    "site_type_select",
    "custom_site_type_input",
]

SOURCE_FORM_KEYS = [
    "add_source_code",
    "add_source_title",
    "add_source_programme",
    "add_source_metals",
    "add_source_exposure_periods",
    "add_source_uploaded_pdf",
    "upload_source_pdf_to_github_after_add",
    "add_source_external_url",
    "add_source_notes",
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

SITE_SOURCE_LINK_FORM_KEYS = [
    "link_sites_selected",
    "link_sources_selected",
    "last_link_source_signature",
    "link_source_order",
    "link_metals_selected",
    "link_exposure_periods_selected",
    "link_notes",
    "link_update_site_summary",
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

def clear_source_form_state() -> None:
    for key in SOURCE_FORM_KEYS:
        st.session_state.pop(key, None)

def clear_site_source_link_form_state() -> None:
    for key in SITE_SOURCE_LINK_FORM_KEYS:
        st.session_state.pop(key, None)

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

def normalize_corrosion_column_name(column_name: str) -> str:
    text = str(column_name or "").strip()
    text = text.replace("\ufeff", "")
    text = text.strip().strip('"').strip("'")
    text = text.lower()
    text = re.sub(r"\s+", "_", text)
    text = re.sub(r"[-/]+", "_", text)
    text = re.sub(r"[^a-z0-9_]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")

    aliases = {
        "site": "site_id",
        "siteid": "site_id",
        "site_id": "site_id",
        "site_code": "site_id",
        "source": "source_code",
        "sourcecode": "source_code",
        "source_code": "source_code",
        "source_id": "source_code",
        "metal": "material",
        "metals": "material",
        "material": "material",
        "materials": "material",
        "exposure": "exposure_period",
        "exposure_time": "exposure_period",
        "exposure_duration": "exposure_period",
        "exposure_period": "exposure_period",
        "duration": "exposure_period",
        "metric": "corrosion_metric",
        "corrosion_metric": "corrosion_metric",
        "rate": "value",
        "corrosion_rate": "value",
        "steel_corrosion_rate": "value",
        "zinc_corrosion_rate": "value",
        "value": "value",
        "unit": "unit",
        "units": "unit",
        "method": "measurement_method",
        "measurement_method": "measurement_method",
        "specimen": "specimen_condition",
        "specimen_condition": "specimen_condition",
        "condition": "exposure_condition",
        "exposure_condition": "exposure_condition",
        "note": "notes",
        "notes": "notes",
    }

    return aliases.get(text, text)


def read_corrosion_csv(uploaded_file) -> pd.DataFrame:
    uploaded_file.seek(0)

    df = pd.read_csv(
        uploaded_file,
        sep=None,
        engine="python",
        dtype=str,
        keep_default_na=False,
    )

    df.columns = [
        normalize_corrosion_column_name(column)
        for column in df.columns
    ]

    df = df.loc[
        :,
        [
            column for column in df.columns
            if column and not column.startswith("unnamed")
        ],
    ]

    for column in CORROSION_OPTIONAL_COLUMNS:
        if column not in df.columns:
            df[column] = ""

    if "corrosion_metric" not in df.columns:
        df["corrosion_metric"] = "corrosion_rate"

    missing_columns = [
        column for column in CORROSION_REQUIRED_COLUMNS
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            "The corrosion CSV is missing required column(s): "
            + ", ".join(missing_columns)
            + ". Required columns are: "
            + ", ".join(CORROSION_REQUIRED_COLUMNS)
        )

    df = df[CORROSION_TEMPLATE_COLUMNS].copy()

    df["source_code"] = df["source_code"].apply(normalise_source_code)
    df["corrosion_metric"] = df["corrosion_metric"].replace("", "corrosion_rate")

    return df


def make_corrosion_template_csv() -> str:
    example_rows = pd.DataFrame(
        [
            {
                "site_id": "JP-001",
                "source_code": "s021",
                "material": "Carbon steel",
                "exposure_period": "1 year",
                "corrosion_metric": "corrosion_rate",
                "value": "38.5",
                "unit": "µm/year",
                "measurement_method": "mass loss",
                "specimen_condition": "bare",
                "exposure_condition": "atmospheric",
                "notes": "Example only",
            },
            {
                "site_id": "JP-001",
                "source_code": "s021",
                "material": "Zinc",
                "exposure_period": "1 year",
                "corrosion_metric": "corrosion_rate",
                "value": "2.1",
                "unit": "µm/year",
                "measurement_method": "mass loss",
                "specimen_condition": "bare",
                "exposure_condition": "atmospheric",
                "notes": "Example only",
            },
        ],
        columns=CORROSION_TEMPLATE_COLUMNS,
    )

    return example_rows.to_csv(index=False)


def export_corrosion_observations_to_website_csv() -> int:
    rows = get_public_corrosion_observations()
    output_df = pd.DataFrame(rows)

    CORROSION_OUTPUT_CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    output_df.to_csv(CORROSION_OUTPUT_CSV_PATH, index=False, encoding="utf-8-sig")

    return len(output_df)

def normalize_environment_column_name(column_name: str) -> str:
    text = str(column_name or "").strip()
    text = text.replace("\ufeff", "")
    text = text.strip().strip('"').strip("'")
    text = text.lower()
    text = re.sub(r"\s+", "_", text)
    text = re.sub(r"[-/]+", "_", text)
    text = re.sub(r"[^a-z0-9_]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")

    aliases = {
        "site": "site_id",
        "siteid": "site_id",
        "site_id": "site_id",
        "site_code": "site_id",
        "variable": "variable_name",
        "variable_name": "variable_name",
        "parameter": "variable_name",
        "parameter_name": "variable_name",
        "climate_variable": "variable_name",
        "environment_variable": "variable_name",
        "value": "value",
        "mean_value": "value",
        "unit": "unit",
        "units": "unit",
        "aggregation": "aggregation",
        "statistic": "aggregation",
        "period_start": "period_start",
        "start_date": "period_start",
        "from": "period_start",
        "period_end": "period_end",
        "end_date": "period_end",
        "to": "period_end",
        "data_source": "data_source",
        "source_name": "data_source",
        "source": "source_code",
        "source_code": "source_code",
        "literature_source": "source_code",
        "notes": "notes",
        "note": "notes",
    }

    return aliases.get(text, text)


def read_environment_csv(uploaded_file) -> pd.DataFrame:
    uploaded_file.seek(0)

    df = pd.read_csv(
        uploaded_file,
        sep=None,
        engine="python",
        dtype=str,
        keep_default_na=False,
    )

    df.columns = [
        normalize_environment_column_name(column)
        for column in df.columns
    ]

    df = df.loc[
        :,
        [
            column for column in df.columns
            if column and not column.startswith("unnamed")
        ],
    ]

    for column in ENVIRONMENT_OPTIONAL_COLUMNS:
        if column not in df.columns:
            df[column] = ""

    missing_columns = [
        column for column in ENVIRONMENT_REQUIRED_COLUMNS
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            "The environmental CSV is missing required column(s): "
            + ", ".join(missing_columns)
            + ". Required columns are: "
            + ", ".join(ENVIRONMENT_REQUIRED_COLUMNS)
        )

    df = df[ENVIRONMENT_TEMPLATE_COLUMNS].copy()

    if "source_code" in df.columns:
        df["source_code"] = df["source_code"].apply(normalise_source_code)

    return df


def make_environment_template_csv() -> str:
    example_rows = pd.DataFrame(
        [
            {
                "site_id": "JP-001",
                "variable_name": "air_temperature",
                "value": "16.8",
                "unit": "°C",
                "aggregation": "annual_mean",
                "period_start": "2020-01-01",
                "period_end": "2020-12-31",
                "data_source": "NASA POWER",
                "source_code": "",
                "notes": "Example only",
            },
            {
                "site_id": "JP-001",
                "variable_name": "relative_humidity",
                "value": "72",
                "unit": "%",
                "aggregation": "annual_mean",
                "period_start": "2020-01-01",
                "period_end": "2020-12-31",
                "data_source": "NASA POWER",
                "source_code": "",
                "notes": "Example only",
            },
            {
                "site_id": "JP-001",
                "variable_name": "wind_speed",
                "value": "3.4",
                "unit": "m/s",
                "aggregation": "annual_mean",
                "period_start": "2020-01-01",
                "period_end": "2020-12-31",
                "data_source": "NASA POWER",
                "source_code": "",
                "notes": "Example only",
            },
        ],
        columns=ENVIRONMENT_TEMPLATE_COLUMNS,
    )

    return example_rows.to_csv(index=False)


def export_environmental_observations_to_website_csv() -> int:
    rows = get_public_environmental_observations()
    output_df = pd.DataFrame(rows)

    ENVIRONMENT_OUTPUT_CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    output_df.to_csv(ENVIRONMENT_OUTPUT_CSV_PATH, index=False, encoding="utf-8-sig")

    return len(output_df)

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

def make_import_preview_signature(
    uploaded_file,
    default_import_programme: str,
    geocode_missing_coordinates: bool,
    auto_fill_region_category_import: bool,
    require_registered_source_metadata: bool,
) -> str:
    return "|".join(
        [
            str(getattr(uploaded_file, "name", "")),
            str(getattr(uploaded_file, "size", "")),
            str(default_import_programme or ""),
            str(bool(geocode_missing_coordinates)),
            str(bool(auto_fill_region_category_import)),
            str(bool(require_registered_source_metadata)),
        ]
    )

def refresh_import_preview_editor() -> None:
    current_version = int(st.session_state.get("import_preview_editor_version", 0))

    st.session_state.pop("import_preview_editor", None)
    st.session_state.pop(f"import_preview_editor_{current_version}", None)

    st.session_state["import_preview_editor_version"] = current_version + 1

def clear_cached_import_preview() -> None:
    for key in [
        "cached_import_preview_signature",
        "cached_import_preview_df",
        "cached_import_site_preview_df",
        "import_site_preview_override",
        "latest_import_preview",
        "import_preview_editor",
    ]:
        st.session_state.pop(key, None)

    refresh_import_preview_editor()


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
        normalise_source_code(str(code))
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

        source_code = normalise_source_code(str(row.get("source_code", "")).strip())

        if "source_code" in annotated_df.columns and source_code:
            annotated_df.at[row_index, "source_code"] = source_code

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

def auto_fill_import_region_categories(preview_df: pd.DataFrame) -> pd.DataFrame:
    if preview_df.empty:
        return preview_df

    updated_df = preview_df.copy()

    if "region_category" not in updated_df.columns:
        updated_df["region_category"] = ""

    if "warnings" not in updated_df.columns:
        updated_df["warnings"] = ""

    region_settings = get_region_classification_settings()

    for row_index, row in updated_df.iterrows():
        current_region = str(row.get("region_category", "") or "").strip()

        if current_region:
            continue

        latitude = row.get("latitude", "")
        longitude = row.get("longitude", "")

        if latitude in ("", None) or longitude in ("", None):
            continue

        result = classify_region_category(
            latitude=latitude,
            longitude=longitude,
            current_region_category=current_region,
            modern_country_location=str(row.get("modern_country_location", "") or ""),
            site_type=str(row.get("site_type", "") or ""),
            settings=region_settings,
        )

        suggested_region = str(result.region_category or "").strip()

        if suggested_region:
            updated_df.at[row_index, "region_category"] = suggested_region
            updated_df.at[row_index, "warnings"] = append_warning_text(
                str(updated_df.at[row_index, "warnings"] or ""),
                "Region category filled automatically",
            )

    return updated_df

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
                "import_selected": bool(normalise_bool_column(group, "import_selected").any()),
                "csv_rows": merge_unique_text_values(group["csv_row"].astype(str).tolist()),
                "site_action": first.get("site_action", ""),
                "site_upsert_status": first.get("site_upsert_status", ""),
                "site_upsert_match": first.get("site_upsert_match", ""),
                "site_id": first.get("site_id", ""),
                "site_label": first.get("site_label", ""),
                "site_type": first.get("site_type", ""),
                "latitude": first.get("latitude", ""),
                "longitude": first.get("longitude", ""),
                "retry_osm": False,
                "apply_osm_suggestion": False,
                "geocode_query": first.get("geocode_query", ""),
                "osm_suggestion": first.get("osm_suggestion", ""),
                "osm_full_label": first.get("osm_full_label", ""),
                "osm_suggestion_latitude": first.get("osm_suggestion_latitude", ""),
                "osm_suggestion_longitude": first.get("osm_suggestion_longitude", ""),
                "osm_query_used": first.get("osm_query_used", ""),
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

def site_preview_row_needs_geocoding(row: pd.Series) -> bool:
    latitude = str(row.get("latitude", "") or "").strip()
    longitude = str(row.get("longitude", "") or "").strip()
    warnings = str(row.get("warnings", "") or "")

    return (
        not latitude
        or not longitude
        or "Geocoding failed" in warnings
        or "Missing latitude" in warnings
        or "Missing longitude" in warnings
    )


def retry_osm_for_site_preview(site_preview_df: pd.DataFrame) -> pd.DataFrame:
    updated_df = site_preview_df.copy()

    for column in [
        "retry_osm",
        "apply_osm_suggestion",
        "geocode_query",
        "osm_suggestion",
        "osm_full_label",
        "osm_suggestion_latitude",
        "osm_suggestion_longitude",
        "osm_query_used",
        "warnings",
    ]:
        if column not in updated_df.columns:
            updated_df[column] = ""

    for row_index, row in updated_df.iterrows():
        retry_requested = normalise_bool_value(row.get("retry_osm"))

        if not retry_requested and not site_preview_row_needs_geocoding(row):
            continue

        site_label = str(row.get("site_label", "") or "").strip()
        country = str(row.get("modern_country_location", "") or "").strip()
        geocode_query = str(row.get("geocode_query", "") or "").strip()

        query_candidates = []

        if geocode_query:
            query_candidates.append(geocode_query)

        if site_label and country:
            query_candidates.append(f"{site_label}, {country}")

        if site_label:
            query_candidates.append(site_label)

        query_candidates = list(dict.fromkeys(query_candidates))

        suggestion = {}

        for query in query_candidates:
            suggestions = search_osm_suggestions(query, limit=5)

            if suggestions:
                suggestion = suggestions[0]
                break

        if suggestion:
            updated_df.at[row_index, "osm_suggestion"] = suggestion.get("osm_suggestion", "")
            updated_df.at[row_index, "osm_full_label"] = suggestion.get("osm_full_label", "")
            updated_df.at[row_index, "osm_suggestion_latitude"] = suggestion.get("osm_suggestion_latitude", "")
            updated_df.at[row_index, "osm_suggestion_longitude"] = suggestion.get("osm_suggestion_longitude", "")
            updated_df.at[row_index, "osm_query_used"] = suggestion.get("osm_query_used", "")

            updated_df.at[row_index, "warnings"] = append_warning_text(
                str(updated_df.at[row_index, "warnings"] or ""),
                "OSM suggestion found; review before applying",
            )
        else:
            updated_df.at[row_index, "warnings"] = append_warning_text(
                str(updated_df.at[row_index, "warnings"] or ""),
                "OSM retry found no suggestion",
            )

        updated_df.at[row_index, "retry_osm"] = False

    return updated_df


def apply_osm_suggestions_to_site_preview(site_preview_df: pd.DataFrame) -> pd.DataFrame:
    updated_df = site_preview_df.copy()

    for row_index, row in updated_df.iterrows():
        if not normalise_bool_value(row.get("apply_osm_suggestion")):
            continue

        suggested_latitude = str(row.get("osm_suggestion_latitude", "") or "").strip()
        suggested_longitude = str(row.get("osm_suggestion_longitude", "") or "").strip()

        if suggested_latitude and suggested_longitude:
            updated_df.at[row_index, "latitude"] = suggested_latitude
            updated_df.at[row_index, "longitude"] = suggested_longitude
            updated_df.at[row_index, "warnings"] = append_warning_text(
                str(updated_df.at[row_index, "warnings"] or ""),
                "Latitude/longitude replaced by selected OSM suggestion",
            )

        updated_df.at[row_index, "apply_osm_suggestion"] = False

    return updated_df

def auto_fill_site_preview_region_categories_from_current_coordinates(
    site_preview_df: pd.DataFrame,
    overwrite_existing: bool = False,
) -> tuple[pd.DataFrame, int, int]:
    updated_df = site_preview_df.copy()

    for column in ["region_category", "warnings"]:
        if column not in updated_df.columns:
            updated_df[column] = ""

    updated_count = 0
    skipped_count = 0
    region_settings = get_region_classification_settings()

    for row_index, row in updated_df.iterrows():
        current_region = join_chip_values(row.get("region_category", ""))

        if current_region and not overwrite_existing:
            continue

        latitude_text = str(row.get("latitude", "") or "").strip()
        longitude_text = str(row.get("longitude", "") or "").strip()

        if not latitude_text or not longitude_text:
            skipped_count += 1
            continue

        try:
            latitude_value = float(latitude_text)
            longitude_value = float(longitude_text)
        except (TypeError, ValueError):
            skipped_count += 1
            updated_df.at[row_index, "warnings"] = append_warning_text(
                str(updated_df.at[row_index, "warnings"] or ""),
                "Region category not filled: latitude/longitude are not valid numbers",
            )
            continue

        result = classify_region_category(
            latitude=latitude_value,
            longitude=longitude_value,
            current_region_category=current_region,
            modern_country_location=str(row.get("modern_country_location", "") or ""),
            site_type=str(row.get("site_type", "") or ""),
            settings=region_settings,
        )

        suggested_region = str(result.region_category or "").strip()

        if suggested_region:
            updated_df.at[row_index, "region_category"] = suggested_region
            updated_df.at[row_index, "warnings"] = append_warning_text(
                str(updated_df.at[row_index, "warnings"] or ""),
                "Region category filled from current coordinates",
            )
            updated_count += 1
        else:
            skipped_count += 1

    return updated_df, updated_count, skipped_count

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
        "geocode_query",
    ]

    for row_position in range(len(edited_site_preview_df)):
        original_site_id = str(
            original_site_preview_df.iloc[row_position].get("site_id", "")
        ).strip()

        edited_row = edited_site_preview_df.iloc[row_position]

        mask = updated_detail_df["site_id"].astype(str).str.strip().eq(original_site_id)

        if "import_selected" in edited_row:
            updated_detail_df.loc[mask, "import_selected"] = normalise_bool_value(
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
    source_code = normalise_source_code(str(row.get("source_code", "")).strip())

    if not source_code:
        return None
    if not is_canonical_source_code(source_code):
        raise ValueError(
            f"Invalid source code `{source_code}`. Source codes must use `sNNN` format."
        )

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
    selected_mask = normalise_bool_column(import_df, "import_selected")
    selected_df = import_df[selected_mask].copy()

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

BROWSER_LANGUAGE_STORAGE_KEY = "corrosion_map_ui_language_label"
BROWSER_LANGUAGE_PROMPT_SUPPRESS_KEY = "corrosion_map_ui_language_prompt_suppressed"
LANGUAGE_OPTIONS = ["English", "中文"]


def get_query_param_value(name: str, default: str = "") -> str:
    try:
        value = st.query_params.get(name, default)
    except Exception:
        return default

    if isinstance(value, list):
        return str(value[0]) if value else default

    return str(value or default)


def sync_browser_language_preferences() -> None:
    """
    Read browser localStorage through a tiny hidden JavaScript component.

    Python cannot directly read browser localStorage, so JavaScript copies the saved
    browser preference into URL query parameters. Streamlit can then read those
    query parameters on the next rerun/reload.
    """
    components.html(
        f"""
        <script>
        (function() {{
            const languageKey = {json.dumps(BROWSER_LANGUAGE_STORAGE_KEY)};
            const suppressKey = {json.dumps(BROWSER_LANGUAGE_PROMPT_SUPPRESS_KEY)};

            const savedLanguage = window.parent.localStorage.getItem(languageKey) || "";
            const promptSuppressed = window.parent.localStorage.getItem(suppressKey) || "";

            const url = new URL(window.parent.location.href);
            let changed = false;

            if (savedLanguage && url.searchParams.get("ui_lang") !== savedLanguage) {{
                url.searchParams.set("ui_lang", savedLanguage);
                changed = true;
            }}

            if (promptSuppressed && url.searchParams.get("ui_lang_prompt_suppressed") !== promptSuppressed) {{
                url.searchParams.set("ui_lang_prompt_suppressed", promptSuppressed);
                changed = true;
            }}

            if (changed) {{
                window.parent.history.replaceState(null, "", url.toString());
                window.parent.location.reload();
            }}
        }})();
        </script>
        """,
        height=0,
    )


def write_browser_language_preferences(
    language_label: str = "",
    suppress_prompt: bool = False,
    reload_page: bool = True,
) -> None:
    language_label = str(language_label or "").strip()

    components.html(
        f"""
        <script>
        (function() {{
            const languageKey = {json.dumps(BROWSER_LANGUAGE_STORAGE_KEY)};
            const suppressKey = {json.dumps(BROWSER_LANGUAGE_PROMPT_SUPPRESS_KEY)};
            const languageLabel = {json.dumps(language_label)};
            const suppressPrompt = {json.dumps(bool(suppress_prompt))};

            const url = new URL(window.parent.location.href);

            if (languageLabel) {{
                window.parent.localStorage.setItem(languageKey, languageLabel);
                url.searchParams.set("ui_lang", languageLabel);
            }}

            if (suppressPrompt) {{
                window.parent.localStorage.setItem(suppressKey, "1");
                url.searchParams.set("ui_lang_prompt_suppressed", "1");
            }}

            window.parent.history.replaceState(null, "", url.toString());

            if ({json.dumps(bool(reload_page))}) {{
                window.setTimeout(function() {{
                    window.parent.location.reload();
                }}, 120);
            }}
        }})();
        </script>
        """,
        height=0,
    )


def browser_language_prompt_is_suppressed() -> bool:
    if st.session_state.get("browser_language_prompt_suppressed") is True:
        return True

    return get_query_param_value("ui_lang_prompt_suppressed", "") == "1"


def show_language_save_dialog(selected_language_label: str, ui_language: str) -> None:
    @st.dialog(t("language_save_dialog_title", ui_language))
    def _language_save_dialog() -> None:
        st.write(
            t(
                "language_save_dialog_body",
                ui_language,
                language_label=selected_language_label,
            )
        )

        do_not_show_again = st.checkbox(
            t("language_save_do_not_show_again", ui_language),
            key="language_save_do_not_show_again",
        )

        save_col, not_now_col = st.columns(2)

        with save_col:
            if st.button(
                t("language_save_button", ui_language),
                type="primary",
                use_container_width=True,
                key="save_browser_language_preference",
            ):
                st.session_state["pending_browser_language_save_label"] = ""
                st.session_state["browser_language_prompt_suppressed"] = bool(do_not_show_again)

                write_browser_language_preferences(
                    language_label=selected_language_label,
                    suppress_prompt=bool(do_not_show_again),
                    reload_page=True,
                )

                st.success(t("language_saved_to_browser", ui_language))

        with not_now_col:
            if st.button(
                t("language_not_now_button", ui_language),
                use_container_width=True,
                key="do_not_save_browser_language_preference",
            ):
                st.session_state["pending_browser_language_save_label"] = ""

                if do_not_show_again:
                    st.session_state["browser_language_prompt_suppressed"] = True

                    write_browser_language_preferences(
                        language_label="",
                        suppress_prompt=True,
                        reload_page=True,
                    )
                else:
                    st.rerun()

    _language_save_dialog()

def translate_status(value: str, language: str) -> str:
    status_key_map = {
        "Ready": "status_ready",
        "Missing": "status_missing",
        "Not configured": "status_not_configured",
        "Unknown": "status_unknown",
        "Available": "status_available",
        "None": "status_none",
        "Set": "status_set",
    }

    return t(status_key_map.get(str(value), str(value)), language)


def ui_text(english: str, chinese: str) -> str:
    return chinese if ui_language == "zh" else english


def suggest_region_tags_for_add_site_form(
    latitude,
    longitude,
    modern_country_location: str,
    site_type: str = "",
    current_region_category: str = "",
) -> tuple[list[str], str]:
    latitude_text = str(latitude or "").strip()
    longitude_text = str(longitude or "").strip()

    if not latitude_text or not longitude_text:
        return [], ui_text(
            "Latitude and longitude are required before region classification.",
            "进行区域分类前需要先填写纬度和经度。",
        )

    try:
        latitude_value = float(latitude_text)
        longitude_value = float(longitude_text)
    except (TypeError, ValueError):
        return [], ui_text(
            "Latitude and longitude must be valid numbers before region classification.",
            "进行区域分类前，纬度和经度必须是有效数字。",
        )

    result = classify_region_category(
        latitude=latitude_value,
        longitude=longitude_value,
        current_region_category=current_region_category,
        modern_country_location=modern_country_location,
        site_type=site_type,
        settings=get_region_classification_settings(),
    )

    suggested_region = str(result.region_category or "").strip()

    if not suggested_region:
        return [], ui_text(
            "No region category could be inferred from the current coordinates.",
            "无法根据当前坐标推断区域类别。",
        )

    return split_chip_values(suggested_region), str(result.notes or "").strip()


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
inject_app_styles()

st.markdown(
    """
    <style>
    @media (max-width: 900px) {
        div[data-testid="column"] {
            min-width: 280px !important;
            flex: 1 1 100% !important;
        }

        .stButton > button,
        .stDownloadButton > button,
        a[data-testid="stLinkButton"] {
            white-space: normal !important;
            min-height: 2.55rem;
        }

        div[data-testid="stDataFrame"],
        div[data-testid="stDataEditor"] {
            max-width: 100%;
            overflow-x: auto;
        }
    }
    </style>
    """,
    unsafe_allow_html=True,
)

require_curator_login()

sync_browser_language_preferences()

browser_saved_language_label = get_query_param_value("ui_lang", "")

if "ui_language_label" not in st.session_state:
    if browser_saved_language_label in LANGUAGE_OPTIONS:
        st.session_state.ui_language_label = browser_saved_language_label
    else:
        st.session_state.ui_language_label = "English"

if "last_seen_ui_language_label" not in st.session_state:
    st.session_state.last_seen_ui_language_label = st.session_state.ui_language_label

if "pending_browser_language_save_label" not in st.session_state:
    st.session_state.pending_browser_language_save_label = ""

ui_language = language_code(st.session_state.ui_language_label)

manual_col_title, manual_col_controls = st.columns(
    [0.72, 0.28],
    vertical_alignment="center",
)

with manual_col_title:
    st.title(t("app_title", ui_language))
    st.caption(t("app_caption", ui_language))

with manual_col_controls:
    language_col, manual_button_col, logout_button_col = st.columns(
        [0.34, 0.42, 0.24],
        gap="small",
        vertical_alignment="center",
    )

    with language_col:
        previous_language_label = st.session_state.get(
            "last_seen_ui_language_label",
            st.session_state.ui_language_label,
        )

        selected_language_label = st.selectbox(
            t("language_label", ui_language),
            options=LANGUAGE_OPTIONS,
            key="ui_language_label",
            label_visibility="collapsed",
        )

        ui_language = language_code(selected_language_label)

        if selected_language_label != previous_language_label:
            st.session_state.last_seen_ui_language_label = selected_language_label

            if not browser_language_prompt_is_suppressed():
                st.session_state.pending_browser_language_save_label = selected_language_label

    with manual_button_col:
        with st.popover(t("user_manual_button", ui_language), use_container_width=True):
            manual_language = st.segmented_control(
                t("manual_language", ui_language),
                options=["English", "中文"],
                default="中文" if ui_language == "zh" else "English",
                key="manual_language_selector",
            )

            if manual_language == "English":
                st.markdown(get_user_manual_english())
            else:
                st.markdown(get_user_manual_chinese())

    with logout_button_col:
        if st.button(t("logout", ui_language), key="curator_logout_button", use_container_width=True):
            st.session_state.curator_logged_in = False
            st.rerun()

    pending_browser_language_save_label = str(
        st.session_state.get("pending_browser_language_save_label", "") or ""
    ).strip()

    if pending_browser_language_save_label:
        show_language_save_dialog(
            selected_language_label=pending_browser_language_save_label,
            ui_language=ui_language,
        )

show_flash_message()

if "location_results" not in st.session_state:
    st.session_state.location_results = []

if "selected_location_label" not in st.session_state:
    st.session_state.selected_location_label = None

if st.session_state.pop("clear_source_form_after_success", False):
    clear_source_form_state()

if st.session_state.pop("clear_site_form_after_success", False):
    clear_site_form_state()

if st.session_state.pop("clear_source_metadata_after_success", False):
    clear_source_metadata_form_state()

if st.session_state.pop("clear_site_source_link_after_success", False):
    clear_site_source_link_form_state()

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

if "last_publish_sources_public_path" not in st.session_state:
    st.session_state.last_publish_sources_public_path = ""
    
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
            st.session_state.location_search_message = "Location suggestions found. Review them and click Apply selected location."
        else:
            st.session_state.selected_location_label = None
            st.session_state.location_search_message = "No matching locations found."

    except Exception as exc:
        st.session_state.location_results = []
        st.session_state.selected_location_label = None
        st.session_state.location_search_message = f"Location search failed: {exc}"

try:
    ensure_schema_updates()
    ensure_draft_schema_updates()
except Exception as exc:
    st.warning(f"Schema update check could not be completed: {exc}")


PAGE_OPTIONS = [
    "Dashboard",
    "Sources",
    "Sites",
    "Corrosion Data",
    "Environmental Data",
    "Manage Records",
    "Import",
    "Export / Publish",
    "Settings",
]

PAGE_LABEL_KEYS = {
    "Dashboard": "nav_dashboard",
    "Sources": "nav_sources",
    "Sites": "nav_sites",
    "Corrosion Data": "nav_corrosion_data",
    "Environmental Data": "nav_environmental_data",
    "Manage Records": "nav_manage_records",
    "Import": "nav_import",
    "Export / Publish": "nav_export_publish",
    "Settings": "nav_settings",
}

if "next_active_page" in st.session_state:
    st.session_state.active_page = st.session_state.pop("next_active_page")
elif "active_page" not in st.session_state:
    st.session_state.active_page = "Dashboard"

if st.session_state.active_page not in PAGE_OPTIONS:
    st.session_state.active_page = "Dashboard"

active_page = st.segmented_control(
    t("navigation", ui_language),
    options=PAGE_OPTIONS,
    key="active_page",
    selection_mode="single",
    label_visibility="collapsed",
    width="stretch",
    format_func=lambda page: t(PAGE_LABEL_KEYS.get(page, page), ui_language),
)

if active_page is None:
    active_page = "Dashboard"


if active_page == "Dashboard":

    try:
        counts = table_counts()
        counts_error = ""
    except Exception as exc:
        counts = {}
        counts_error = str(exc)

    existing_pdf_files = list_source_pdf_files()
    noncanonical_pdf_files = [
        pdf_path for pdf_path in existing_pdf_files
        if normalise_source_code(pdf_path.stem) != pdf_path.stem.strip().lower()
    ]

    try:
        existing_source_codes = get_existing_source_codes()
    except Exception:
        existing_source_codes = set()

    canonical_pdf_files = [
        pdf_path for pdf_path in existing_pdf_files
        if normalise_source_code(pdf_path.stem) == pdf_path.stem.strip().lower()
    ]

    missing_pdf_files = [
        pdf_path for pdf_path in canonical_pdf_files
        if source_code_from_pdf_path(pdf_path) not in existing_source_codes
    ]

    backend_status = "Supabase" if str(DB_PATH).upper() == "SUPABASE" else "SQLite"
    backend_tone = "good" if backend_status == "Supabase" else "warn"

    try:
        github_summary = str(get_github_config_summary())
        github_status = (
            "Not configured"
            if "missing" in github_summary.lower() or "not configured" in github_summary.lower()
            else "Ready"
        )
    except Exception:
        github_status = "Unknown"

    public_map_status = "Set" if MAP_WEBSITE_URL else "Missing"

    try:
        draft = load_app_draft(IMPORT_PREVIEW_DRAFT_KEY)
        draft_status = "Available" if draft else "None"
    except Exception:
        draft_status = "Unknown"

    st.markdown(
        f"""
        <div class="dashboard-hero">
            <div class="dashboard-eyebrow">{escape_html(t("dashboard_hero_eyebrow", ui_language))}</div>
            <div class="dashboard-title">{escape_html(t("dashboard_hero_title", ui_language))}</div>
            <div class="dashboard-subtitle">
                {escape_html(t("dashboard_hero_subtitle", ui_language))}
            </div>
            <div style="margin-top: 0.85rem;">
                <span class="status-pill {backend_tone}">
                    {escape_html(t("dashboard_status_backend", ui_language))}: {escape_html(backend_status)}
                </span>
                <span class="status-pill {'good' if github_status == 'Ready' else 'warn'}">
                    {escape_html(t("dashboard_status_github", ui_language))}: {escape_html(translate_status(github_status, ui_language))}
                </span>
                <span class="status-pill {'good' if public_map_status == 'Set' else 'warn'}">
                    {escape_html(t("dashboard_status_public_map", ui_language))}: {escape_html(translate_status(public_map_status, ui_language))}
                </span>
                <span class="status-pill {'good' if draft_status == 'Available' else ''}">
                    {escape_html(t("dashboard_status_import_draft", ui_language))}: {escape_html(translate_status(draft_status, ui_language))}
                </span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    if counts_error:
        st.error(f"Could not read database counts: {counts_error}")
        st.info("Go to the Settings tab and initialize the database if this is a new setup.")

    render_section_title(t("dashboard_section_database_records", ui_language))

    metric_col1, metric_col2, metric_col3, metric_col4, metric_col5 = st.columns(5)

    with metric_col1:
        render_dashboard_card(
            t("dashboard_card_sites", ui_language),
            counts.get("sites", 0),
            t("dashboard_card_sites_hint", ui_language),
        )

    with metric_col2:
        render_dashboard_card(
            t("dashboard_card_sources", ui_language),
            counts.get("sources", 0),
            t("dashboard_card_sources_hint", ui_language),
        )

    with metric_col3:
        render_dashboard_card(
            t("dashboard_card_evidence_links", ui_language),
            counts.get("site_sources", 0),
            t("dashboard_card_evidence_links_hint", ui_language),
        )

    with metric_col4:
        render_dashboard_card(
            t("dashboard_card_corrosion_observations", ui_language),
            counts.get("corrosion_observations", 0),
            t("dashboard_card_corrosion_observations_hint", ui_language),
        )

    with metric_col5:
        render_dashboard_card(
            t("dashboard_card_environmental_observations", ui_language),
            counts.get("environmental_observations", 0),
            t("dashboard_card_environmental_observations_hint", ui_language),
        )

    render_section_title(t("dashboard_section_source_documents", ui_language))

    pdf_col1, pdf_col2, pdf_col3 = st.columns(3)

    with pdf_col1:
        render_dashboard_card(
            t("dashboard_card_pdf_files", ui_language),
            len(existing_pdf_files),
            t("dashboard_card_pdf_files_hint", ui_language),
        )

    with pdf_col2:
        render_dashboard_card(
            t("dashboard_card_unregistered_pdfs", ui_language),
            len(missing_pdf_files),
            t("dashboard_card_unregistered_pdfs_hint", ui_language),
        )

    with pdf_col3:
        render_dashboard_card(
            t("dashboard_card_pdf_folder", ui_language),
            SOURCE_PDF_RELATIVE_DIR,
            t("dashboard_card_pdf_folder_hint", ui_language),
        )

    if noncanonical_pdf_files:
        st.warning(t("dashboard_warning_noncanonical_pdfs", ui_language))

        with st.expander(t("dashboard_expander_show_pdf_renames", ui_language), expanded=False):
            for pdf_path in noncanonical_pdf_files:
                canonical_name = suggested_source_pdf_name(pdf_path.stem)
                st.write(f"- `{pdf_path.name}` → `{canonical_name}`")

        if st.button(
            t("dashboard_button_rename_pdfs", ui_language),
            key="rename_noncanonical_source_pdfs",
        ):
            rename_result = rename_noncanonical_source_pdf_files()

            messages = []

            if rename_result["renamed"]:
                messages.append(
                    "Renamed PDF file(s):\n"
                    + "\n".join(f"- {item}" for item in rename_result["renamed"])
                )

            if rename_result["skipped"]:
                messages.append(
                    "Skipped PDF file(s):\n"
                    + "\n".join(f"- {item}" for item in rename_result["skipped"])
                )

            if rename_result["failed"]:
                messages.append(
                    "Failed PDF rename(s):\n"
                    + "\n".join(f"- {item}" for item in rename_result["failed"])
                )

            set_flash_message(
                "\n\n".join(messages) or "No PDF filename changes were needed.",
                level="warning" if rename_result["failed"] else "success",
            )
            set_next_active_page("Sources")
            st.rerun()

    if missing_pdf_files:
        st.warning(
            t(
                "dashboard_warning_missing_pdfs",
                ui_language,
                count=len(missing_pdf_files),
            )
        )
    elif existing_pdf_files:
        st.success(t("dashboard_success_all_pdfs_registered", ui_language))
    else:
        st.info(t("dashboard_info_no_pdfs", ui_language))

    render_section_title(t("dashboard_section_system_status", ui_language))

    status_col1, status_col2, status_col3, status_col4 = st.columns(4)

    with status_col1:
        render_dashboard_card(
            t("dashboard_card_backend", ui_language),
            backend_status,
            t("dashboard_card_backend_hint", ui_language),
        )

    with status_col2:
        render_dashboard_card(
            t("dashboard_card_github_publish", ui_language),
            translate_status(github_status, ui_language),
            t("dashboard_card_github_publish_hint", ui_language),
        )

    with status_col3:
        render_dashboard_card(
            t("dashboard_card_public_map_url", ui_language),
            translate_status(public_map_status, ui_language),
            MAP_WEBSITE_URL if MAP_WEBSITE_URL else t("dashboard_public_map_missing", ui_language),
        )

    with status_col4:
        render_dashboard_card(
            t("dashboard_card_import_draft", ui_language),
            translate_status(draft_status, ui_language),
            t("dashboard_card_import_draft_hint", ui_language),
        )

    quick_col1, quick_col2, quick_col3, quick_col4 = st.columns(4)

    with quick_col1:
        if st.button(t("common_add_source", ui_language), key="dashboard_go_sources", use_container_width=True):
            set_next_active_page("Sources")
            st.rerun()

    with quick_col2:
        if st.button(t("common_add_site", ui_language), key="dashboard_go_sites", use_container_width=True):
            set_next_active_page("Sites")
            st.rerun()

    with quick_col3:
        if st.button(t("common_import_csv", ui_language), key="dashboard_go_import", use_container_width=True):
            set_next_active_page("Import")
            st.rerun()

    with quick_col4:
        if MAP_WEBSITE_URL:
            st.link_button(t("common_open_public_map", ui_language), MAP_WEBSITE_URL, use_container_width=True)
        else:
            if st.button(t("common_set_public_map_url", ui_language), key="dashboard_go_settings", use_container_width=True):
                set_next_active_page("Settings")
                st.rerun()

    render_section_title(t("dashboard_section_workflow", ui_language))

    workflow_col1, workflow_col2, workflow_col3, workflow_col4 = st.columns(4)

    workflow_steps = [
        (
            "1",
            t("dashboard_workflow_register_sources_title", ui_language),
            t("dashboard_workflow_register_sources_caption", ui_language),
        ),
        (
            "2",
            t("dashboard_workflow_add_sites_title", ui_language),
            t("dashboard_workflow_add_sites_caption", ui_language),
        ),
        (
            "3",
            t("dashboard_workflow_link_evidence_title", ui_language),
            t("dashboard_workflow_link_evidence_caption", ui_language),
        ),
        (
            "4",
            t("dashboard_workflow_publish_title", ui_language),
            t("dashboard_workflow_publish_caption", ui_language),
        ),
    ]

    for column, step in zip(
        [workflow_col1, workflow_col2, workflow_col3, workflow_col4],
        workflow_steps,
    ):
        number, title, caption = step
        with column:
            render_workflow_step(number, title, caption)


if active_page == "Sources":
    def source_optional_label(label_key: str) -> str:
        return f"{t(label_key, ui_language)} ({t('common_optional', ui_language)})"

    st.subheader(t("sources_title", ui_language))
    st.caption(t("sources_caption", ui_language))

    with st.expander(t("sources_register_existing_pdfs", ui_language), expanded=False):
        existing_pdf_files = list_source_pdf_files()

        try:
            existing_source_codes = get_existing_source_codes()
        except Exception as exc:
            existing_source_codes = set()
            st.error(
                t(
                    "sources_error_read_existing_source_codes",
                    ui_language,
                    error=str(exc),
                )
            )

        noncanonical_pdf_files = [
            pdf_path for pdf_path in existing_pdf_files
            if normalise_source_code(pdf_path.stem) != pdf_path.stem.strip().lower()
        ]

        canonical_pdf_files = [
            pdf_path for pdf_path in existing_pdf_files
            if normalise_source_code(pdf_path.stem) == pdf_path.stem.strip().lower()
        ]

        if noncanonical_pdf_files:
            st.warning(t("sources_warning_noncanonical_pdfs_register", ui_language))

            with st.expander(
                t("sources_expander_show_pdfs_should_rename", ui_language),
                expanded=False,
            ):
                for pdf_path in noncanonical_pdf_files:
                    canonical_name = suggested_source_pdf_name(pdf_path.stem)
                    st.write(f"- `{pdf_path.name}` → `{canonical_name}`")

            if st.button(
                t("sources_button_rename_pdfs", ui_language),
                key="rename_noncanonical_source_pdfs_from_sources_page",
            ):
                rename_result = rename_noncanonical_source_pdf_files()

                messages = []

                if rename_result["renamed"]:
                    messages.append(
                        t("sources_renamed_pdf_files", ui_language)
                        + ":\n"
                        + "\n".join(f"- {item}" for item in rename_result["renamed"])
                    )

                if rename_result["skipped"]:
                    messages.append(
                        t("sources_skipped_pdf_files", ui_language)
                        + ":\n"
                        + "\n".join(f"- {item}" for item in rename_result["skipped"])
                    )

                if rename_result["failed"]:
                    messages.append(
                        t("sources_failed_pdf_renames", ui_language)
                        + ":\n"
                        + "\n".join(f"- {item}" for item in rename_result["failed"])
                    )

                set_flash_message(
                    "\n\n".join(messages)
                    or t("sources_no_pdf_filename_changes", ui_language),
                    level="warning" if rename_result["failed"] else "success",
                )
                set_next_active_page("Sources")
                st.rerun()

        missing_pdf_files = [
            pdf_path for pdf_path in canonical_pdf_files
            if source_code_from_pdf_path(pdf_path) not in existing_source_codes
        ]

        if not existing_pdf_files:
            st.info(t("sources_no_pdfs_found", ui_language))
        elif not missing_pdf_files:
            st.success(t("sources_all_pdfs_registered", ui_language))
        else:
            st.write(
                t(
                    "sources_unregistered_pdfs_found",
                    ui_language,
                    count=len(missing_pdf_files),
                )
            )

            with st.expander(
                t("sources_preview_unregistered_pdfs", ui_language),
                expanded=False,
            ):
                for pdf_path in missing_pdf_files:
                    st.write(
                        f"- `{pdf_path.name}` → source code `{source_code_from_pdf_path(pdf_path)}`"
                    )

            default_programme_for_scan = st.selectbox(
                t("sources_programme_for_registered_pdfs", ui_language),
                options=get_programme_options(include_blank=True),
                key="register_existing_pdf_programme",
                help=t("sources_programme_for_registered_pdfs_help", ui_language),
                accept_new_options=True,
            )

            scan_programme = default_programme_for_scan.strip()

            selected_scan_metals = st.multiselect(
                t("sources_metals_for_registered_pdfs", ui_language),
                options=get_metal_options(),
                key="register_existing_pdf_metals",
                accept_new_options=True,
            )

            scan_metals = normalize_metal_selection(selected_scan_metals)

            selected_scan_exposure_periods = st.multiselect(
                t("sources_exposure_periods_for_registered_pdfs", ui_language),
                options=EXPOSURE_PERIOD_OPTIONS,
                key="register_existing_pdf_exposure_periods",
                accept_new_options=True,
            )

            scan_exposure_periods = normalize_exposure_period_selection(
                selected_scan_exposure_periods
            )

            if st.button(t("sources_register_missing_pdfs", ui_language)):
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
                            metals=scan_metals,
                            exposure_periods=scan_exposure_periods,
                            local_file_name=local_file_name,
                            source_url=source_url,
                            notes="Registered automatically from source_pdfs folder.",
                        )
                        registered_count += 1
                    except Exception as exc:
                        st.warning(
                            t(
                                "sources_could_not_register_pdf",
                                ui_language,
                                file_name=pdf_path.name,
                                error=str(exc),
                            )
                        )

                set_next_active_page("Sources")
                add_metadata_options("programme", split_chip_values(scan_programme))
                add_metadata_options("metal", split_chip_values(scan_metals))
                set_flash_message(
                    t(
                        "sources_registered_pdf_sources",
                        ui_language,
                        count=registered_count,
                    )
                )
                st.rerun()

    with st.expander(t("sources_upload_pdfs_github", ui_language), expanded=False):
        existing_pdf_files = list_source_pdf_files()

        if not existing_pdf_files:
            st.info(t("sources_no_pdf_files_found", ui_language))
        else:
            pdf_label_to_path = {
                pdf_path.name: pdf_path
                for pdf_path in existing_pdf_files
            }

            selected_pdf_labels = st.multiselect(
                t("sources_choose_pdfs_upload_github", ui_language),
                options=list(pdf_label_to_path.keys()),
                key="source_pdfs_to_upload_to_github",
            )

            if st.button(
                t("sources_upload_selected_pdfs_github", ui_language),
                key="upload_selected_source_pdfs_to_github",
            ):
                if not selected_pdf_labels:
                    st.error(t("sources_select_at_least_one_pdf", ui_language))
                else:
                    upload_messages = []
                    uploaded_count = 0
                    skipped_count = 0
                    failed_count = 0

                    for pdf_label in selected_pdf_labels:
                        pdf_path = pdf_label_to_path[pdf_label]

                        try:
                            result = publish_file_to_github(
                                local_path=pdf_path,
                                commit_message=f"Upload source PDF {pdf_path.name}",
                            )

                            action = str(result.get("upload", {}).get("action", ""))

                            if action == "skipped":
                                skipped_count += 1
                            else:
                                uploaded_count += 1

                            upload_messages.append(
                                f"{pdf_path.name}: {action}"
                            )

                        except Exception as exc:
                            failed_count += 1
                            upload_messages.append(
                                f"{pdf_path.name}: failed — {exc}"
                            )

                    st.session_state.last_git_publish_output = "\n".join(upload_messages)

                    if failed_count:
                        st.warning(
                            t(
                                "sources_pdf_github_upload_completed_failures",
                                ui_language,
                                uploaded=uploaded_count,
                                skipped=skipped_count,
                                failed=failed_count,
                            )
                        )
                    else:
                        st.success(
                            t(
                                "sources_pdf_github_upload_completed",
                                ui_language,
                                uploaded=uploaded_count,
                                skipped=skipped_count,
                            )
                        )

                    with st.expander(
                        t("sources_show_pdf_github_upload_details", ui_language),
                        expanded=True,
                    ):
                        st.code("\n".join(upload_messages), language="text")

    st.divider()

    st.write(f"### {t('sources_add_source_heading', ui_language)}")

    suggested_source_code = get_next_source_code()

    if not str(st.session_state.get("add_source_code", "")).strip():
        st.session_state["add_source_code"] = suggested_source_code

    st.caption(
        t(
            "sources_next_source_code_caption",
            ui_language,
            source_code=suggested_source_code,
        )
    )

    with st.form("add_source_form", clear_on_submit=False):
        st.caption(t("common_required_field", ui_language))

        source_code = st.text_input(
            required_label(t("sources_source_code", ui_language)),
            placeholder=f"e.g. {suggested_source_code}",
            help=t("sources_source_code_help", ui_language),
            key="add_source_code",
        )

        source_title = st.text_input(
            source_optional_label("sources_source_title"),
            placeholder=t("sources_source_title_placeholder", ui_language),
            key="add_source_title",
        )

        selected_programme = st.selectbox(
            required_label(t("sources_source_programme", ui_language)),
            options=get_programme_options(include_blank=True),
            help=t("sources_source_programme_help", ui_language),
            accept_new_options=True,
            key="add_source_programme",
        )

        source_programme = selected_programme.strip()

        selected_source_metals = st.multiselect(
            required_label(t("sources_source_metals", ui_language)),
            options=get_metal_options(),
            help=t("sources_source_metals_help", ui_language),
            key="add_source_metals",
            accept_new_options=True,
        )

        source_metals = normalize_metal_selection(selected_source_metals)

        selected_source_exposure_periods = st.multiselect(
            required_label(t("sources_source_exposure_periods", ui_language)),
            options=EXPOSURE_PERIOD_OPTIONS,
            help=t("sources_source_exposure_periods_help", ui_language),
            key="add_source_exposure_periods",
            accept_new_options=True,
        )

        source_exposure_periods = normalize_exposure_period_selection(
            selected_source_exposure_periods
        )

        uploaded_pdf = st.file_uploader(
            source_optional_label("sources_upload_source_pdf"),
            type=["pdf"],
            help=t("sources_upload_source_pdf_help", ui_language),
            key="add_source_uploaded_pdf",
        )

        upload_source_pdf_to_github = st.checkbox(
            source_optional_label("sources_upload_pdf_github_after_add"),
            value=False,
            help=t("sources_upload_pdf_github_after_add_help", ui_language),
            key="upload_source_pdf_to_github_after_add",
        )

        external_url = st.text_input(
            source_optional_label("sources_external_url"),
            placeholder=t("sources_external_url_placeholder", ui_language),
            key="add_source_external_url",
        )

        source_notes = st.text_area(
            source_optional_label("sources_source_notes"),
            placeholder=t("sources_source_notes_placeholder", ui_language),
            key="add_source_notes",
        )

        submit_source = st.form_submit_button(
            t("sources_add_source_button", ui_language)
        )

        if submit_source:
            validation_errors = []

            raw_source_code = source_code
            source_code = normalise_source_code(raw_source_code)

            if not raw_source_code.strip():
                validation_errors.append(
                    t("sources_validation_source_code_required", ui_language)
                )
            elif not is_canonical_source_code(source_code):
                validation_errors.append(
                    t("sources_validation_source_code_canonical", ui_language)
                )
            elif source_code_exists(source_code):
                validation_errors.append(
                    t(
                        "sources_validation_source_code_duplicate",
                        ui_language,
                        source_code=source_code,
                    )
                )

            if not source_programme.strip():
                validation_errors.append(
                    t("sources_validation_programme_required", ui_language)
                )

            if not source_metals.strip():
                validation_errors.append(
                    t("sources_validation_metal_required", ui_language)
                )

            if not source_exposure_periods.strip():
                validation_errors.append(
                    t("sources_validation_exposure_required", ui_language)
                )

            if validation_errors:
                st.error(t("sources_validation_required_fields", ui_language))
                for error in validation_errors:
                    st.warning(error)
            else:
                try:
                    flash_level = "success"
                    flash_message = ""

                    with st.status(
                        t("sources_status_adding_source", ui_language),
                        expanded=True,
                    ) as source_status:
                        local_file_name = ""
                        source_url = external_url.strip()

                        if uploaded_pdf is not None:
                            st.write(t("sources_status_saving_pdf", ui_language))
                            local_file_name, source_url = save_uploaded_source_pdf(
                                uploaded_pdf,
                                source_code,
                            )

                        st.write(t("sources_status_writing_metadata", ui_language))
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

                        st.write(t("sources_status_updating_options", ui_language))
                        set_next_active_page("Sources")
                        add_metadata_options("programme", split_chip_values(source_programme))
                        add_metadata_options("metal", split_chip_values(source_metals))

                        flash_message = t(
                            "sources_flash_source_added",
                            ui_language,
                            source_code=source_code.strip(),
                        )

                        if uploaded_pdf is not None and upload_source_pdf_to_github:
                            try:
                                st.write(t("sources_status_uploading_pdf_github", ui_language))
                                pdf_local_path = REPO_ROOT / source_url

                                github_pdf_result = publish_file_to_github(
                                    local_path=pdf_local_path,
                                    commit_message=f"Upload source PDF {local_file_name}",
                                )

                                flash_message += t(
                                    "sources_flash_uploaded_pdf_github",
                                    ui_language,
                                )
                                st.session_state.last_git_publish_output = str(
                                    github_pdf_result["output"]
                                )

                            except Exception as github_exc:
                                flash_level = "warning"
                                flash_message += t(
                                    "sources_flash_pdf_not_uploaded",
                                    ui_language,
                                    error=str(github_exc),
                                )

                        source_status.update(
                            label=t("sources_status_processing_completed", ui_language),
                            state="complete",
                            expanded=False,
                        )

                    st.session_state.clear_source_form_after_success = True
                    set_flash_message(flash_message, level=flash_level)
                    st.rerun()

                except Exception as exc:
                    st.error(
                        t(
                            "sources_error_could_not_add_source",
                            ui_language,
                            error=str(exc),
                        )
                    )

    st.divider()

    with st.expander(
        t("sources_assign_metadata_expander", ui_language),
        expanded=True,
    ):
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
            st.error(
                t(
                    "sources_error_could_not_load_sources",
                    ui_language,
                    error=str(exc),
                )
            )

        if not source_records:
            st.info(t("sources_no_sources_available", ui_language))
        else:
            source_labels = []
            source_label_to_id = {}
            source_label_to_code = {}

            for row in source_records:
                source_code = row["source_code"]
                source_title = row["source_title"] or t("sources_untitled", ui_language)
                programme = row["programme"] or t("sources_no_programme", ui_language)

                label = f"{source_code} — {source_title} [{programme}]"

                source_labels.append(label)
                source_label_to_id[label] = int(row["id"])
                source_label_to_code[label] = source_code

            source_selection_key = "combined_source_metadata_selected_sources"

            if source_selection_key not in st.session_state:
                st.session_state[source_selection_key] = []

            select_sources_clicked, deselect_sources_clicked = render_left_button_pair(
                t("sources_select_all_sources", ui_language),
                t("sources_deselect_all_sources", ui_language),
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
                t("sources_choose_sources_update", ui_language),
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

                st.caption(t("sources_current_metadata_selected", ui_language))
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

            st.write(f"#### {t('sources_metadata_to_assign', ui_language)}")

            apply_programme_update = st.checkbox(
                t("sources_update_programme", ui_language),
                value=True,
                key="combined_update_programme_checkbox",
            )

            apply_material_exposure_update = st.checkbox(
                t("sources_update_metals_exposure", ui_language),
                value=False,
                key="combined_update_material_exposure_checkbox",
            )

            programme_to_apply = ""

            if apply_programme_update:
                selected_programmes_to_apply = st.multiselect(
                    t("sources_programmes_to_assign", ui_language),
                    options=get_programme_options(include_blank=False),
                    key="combined_programme_to_apply",
                    help=t("sources_programmes_to_assign_help", ui_language),
                    accept_new_options=True,
                )

                programme_to_apply = normalize_programme_selection(selected_programmes_to_apply)

                if programme_to_apply:
                    st.caption(
                        t(
                            "sources_programme_field_to_apply",
                            ui_language,
                            value=programme_to_apply,
                        )
                    )

            source_metals = ""
            source_exposure_periods = ""
            update_mode = "merge"

            if apply_material_exposure_update:
                selected_source_metals = st.multiselect(
                    t("sources_metals_to_assign", ui_language),
                    options=get_metal_options(),
                    key="combined_assign_source_metals",
                    help=t("sources_metals_to_assign_help", ui_language),
                    accept_new_options=True,
                )

                source_metals = normalize_metal_selection(selected_source_metals)

                selected_source_exposure_periods = st.multiselect(
                    t("sources_exposure_periods_to_assign", ui_language),
                    options=EXPOSURE_PERIOD_OPTIONS,
                    key="combined_assign_source_exposure_periods",
                    help=t("sources_exposure_periods_to_assign_help", ui_language),
                    accept_new_options=True,
                )

                source_exposure_periods = normalize_exposure_period_selection(
                    selected_source_exposure_periods
                )

                update_mode_label = st.radio(
                    t("sources_metadata_update_mode", ui_language),
                    options=[
                        "Replace existing metals and exposure periods",
                        "Add only missing values to existing metadata",
                    ],
                    index=1,
                    key="combined_assign_source_metadata_mode",
                    help=t("sources_metadata_update_mode_help", ui_language),
                    format_func=lambda option: (
                        t("sources_update_mode_replace", ui_language)
                        if option == "Replace existing metals and exposure periods"
                        else t("sources_update_mode_merge", ui_language)
                    ),
                )

                update_mode = (
                    "replace"
                    if update_mode_label == "Replace existing metals and exposure periods"
                    else "merge"
                )

                if source_metals:
                    st.caption(
                        t(
                            "sources_metal_field_to_apply",
                            ui_language,
                            value=source_metals,
                        )
                    )

                if source_exposure_periods:
                    st.caption(
                        t(
                            "sources_exposure_field_to_apply",
                            ui_language,
                            value=source_exposure_periods,
                        )
                    )

            if st.button(
                t("sources_apply_metadata_button", ui_language),
                key="apply_combined_source_metadata",
            ):
                if not selected_source_ids:
                    st.error(t("sources_error_select_one_source", ui_language))
                elif not apply_programme_update and not apply_material_exposure_update:
                    st.error(t("sources_error_choose_update_type", ui_language))
                elif apply_programme_update and not programme_to_apply.strip():
                    st.error(t("sources_error_select_programme", ui_language))
                elif (
                    apply_material_exposure_update
                    and update_mode == "merge"
                    and not (source_metals.strip() or source_exposure_periods.strip())
                ):
                    st.error(t("sources_error_merge_requires_metadata", ui_language))
                elif (
                    apply_material_exposure_update
                    and update_mode == "replace"
                    and (not source_metals.strip() or not source_exposure_periods.strip())
                ):
                    st.error(t("sources_error_replace_requires_metadata", ui_language))
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
                            t(
                                "sources_flash_updated_metadata",
                                ui_language,
                                programme_count=programme_updated_count,
                                metadata_count=metadata_updated_count,
                            )
                        )

                        st.rerun()

                    except Exception as exc:
                        st.error(
                            t(
                                "sources_error_could_not_update_metadata",
                                ui_language,
                                error=str(exc),
                            )
                        )


if active_page == "Sites":
    def site_optional_label(label_key: str) -> str:
        return f"{t(label_key, ui_language)} ({t('common_optional', ui_language)})"

    st.subheader(t("sites_title", ui_language))
    st.caption(t("sites_caption", ui_language))

    st.write(f"### {t('sites_location_lookup', ui_language)}")

    location_query = st.text_input(
        t("sites_search_place", ui_language),
        placeholder=t("sites_search_place_placeholder", ui_language),
        key="location_query",
    )

    lookup_search_col, lookup_clear_col, lookup_spacer_col = st.columns(
        [0.20, 0.20, 0.60],
        vertical_alignment="bottom",
    )

    with lookup_search_col:
        if st.button(
            t("sites_search_location_button", ui_language),
            key="search_location_button",
            use_container_width=True,
        ):
            run_location_search()

    with lookup_clear_col:
        if st.button(
            ui_text("Clear lookup", "清除搜索"),
            key="clear_location_lookup_button",
            use_container_width=True,
        ):
            st.session_state.location_results = []
            st.session_state.selected_location_label = None
            st.session_state.location_search_message = ""
            st.rerun()

    if st.session_state.location_search_message:
        message = str(st.session_state.location_search_message)

        if message.startswith("Location search failed"):
            error_text = message.replace("Location search failed:", "", 1).strip()
            st.error(t("sites_location_search_failed", ui_language, error=error_text))
        elif message == "Enter a place name first.":
            st.warning(t("sites_enter_place_first", ui_language))
        elif message == "No matching locations found.":
            st.warning(t("sites_no_matching_locations", ui_language))
        elif message.startswith("Location suggestions found"):
            st.info(
                ui_text(
                    "Location suggestions found. Review them and click Apply selected location.",
                    "已找到地点建议。请检查后点击“应用选定地点”。",
                )
            )
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

        selected_label = st.radio(
            t("sites_suggested_locations", ui_language),
            options=labels,
            key="selected_location_label",
        )

        selected_location = next(
            (item for item in location_options if item["label"] == selected_label),
            None,
        )

        if selected_location:
            st.info(
                t(
                    "sites_selected_location_info",
                    ui_language,
                    label=selected_location["label"],
                    full_match=selected_location.get(
                        "full_label",
                        selected_location["label"],
                    ),
                    latitude=selected_location["latitude"],
                    longitude=selected_location["longitude"],
                )
            )

            apply_location_col, apply_location_spacer = st.columns(
                [0.34, 0.66],
                vertical_alignment="bottom",
            )

            with apply_location_col:
                if st.button(
                    ui_text("Apply selected location to Add Site form", "应用选定地点到添加站点表单"),
                    key="apply_selected_location_to_site_form",
                    type="primary",
                    use_container_width=True,
                ):
                    apply_selected_location()
                    st.success(
                        ui_text(
                            "Selected location applied to latitude, longitude, and country/location fields.",
                            "已将选定地点应用到纬度、经度和国家/地区字段。",
                        )
                    )

    st.divider()

    st.write(f"### {t('sites_add_site_heading', ui_language)}")
    st.caption(t("common_required_field", ui_language))

    with st.container():
        site_label = st.text_input(
            required_label(t("sites_site_label", ui_language)),
            placeholder=t("sites_site_label_placeholder", ui_language),
            key="site_label_input",
        )

        selected_site_type = st.selectbox(
            site_optional_label("sites_site_type"),
            options=SITE_TYPE_OPTIONS,
            key="site_type_select",
            help=t("sites_site_type_help", ui_language),
        )

        custom_site_type = ""

        if selected_site_type == "Other / custom":
            custom_site_type = st.text_input(
                site_optional_label("sites_custom_site_type"),
                placeholder=t("sites_custom_site_type_placeholder", ui_language),
                key="custom_site_type_input",
            )

        site_type = resolve_option_value(selected_site_type, custom_site_type)

        col1, col2 = st.columns(2)

        with col1:
            latitude = st.text_input(
                required_label(t("sites_latitude", ui_language)),
                key="site_latitude",
                placeholder=t("sites_latitude_placeholder", ui_language),
            )

        with col2:
            longitude = st.text_input(
                required_label(t("sites_longitude", ui_language)),
                key="site_longitude",
                placeholder=t("sites_longitude_placeholder", ui_language),
            )

        modern_country_location = st.text_input(
            required_label(t("sites_modern_country_location", ui_language)),
            key="site_modern_country_location",
            placeholder=t("sites_modern_country_location_placeholder", ui_language),
        )

        administering_country = st.text_input(
            site_optional_label("sites_administering_country"),
            placeholder=t("sites_administering_country_placeholder", ui_language),
            key="administering_country_input",
        )

        site_id_prefix = ""

        if modern_country_location.strip():
            site_id_prefix = build_site_id_prefix(
                modern_country_location=modern_country_location,
                administering_country=administering_country,
            )

        if site_id_prefix:
            suggested_site_id = get_next_site_id_for_prefix(site_id_prefix)
            st.caption(
                t(
                    "sites_suggested_site_id",
                    ui_language,
                    site_id=suggested_site_id,
                )
            )
        else:
            suggested_site_id = ""
            st.caption(t("sites_suggested_site_id_pending", ui_language))

        previous_suggested_site_id = st.session_state.get("last_suggested_site_id", "")
        current_site_id_value = st.session_state.get("site_id_input", "")

        if suggested_site_id and current_site_id_value in ("", previous_suggested_site_id):
            st.session_state.site_id_input = suggested_site_id

        st.session_state.last_suggested_site_id = suggested_site_id

        site_id = st.text_input(
            required_label(t("sites_site_id", ui_language)),
            key="site_id_input",
            help=t("sites_site_id_help", ui_language),
        )

        selected_former_entity = st.selectbox(
            site_optional_label("sites_former_entity"),
            options=FORMER_ENTITY_OPTIONS,
            key="former_entity_select",
        )

        custom_former_entity = ""
        if selected_former_entity == "Other / custom":
            custom_former_entity = st.text_input(
                site_optional_label("sites_custom_former_entity"),
                placeholder=t("sites_custom_former_entity_placeholder", ui_language),
                key="custom_former_entity_input",
            )

        former_entity = resolve_option_value(selected_former_entity, custom_former_entity)

        region_suggest_col, region_clear_col, region_spacer_col = st.columns(
            [0.28, 0.20, 0.52],
            vertical_alignment="bottom",
        )

        with region_suggest_col:
            if st.button(
                ui_text("Suggest region from coordinates", "根据坐标建议区域类别"),
                key="suggest_region_for_add_site",
                use_container_width=True,
            ):
                suggested_region_tags, region_note = suggest_region_tags_for_add_site_form(
                    latitude=latitude,
                    longitude=longitude,
                    modern_country_location=modern_country_location,
                    site_type=site_type,
                    current_region_category=normalize_region_category(
                        st.session_state.get("region_tags_select", [])
                    ),
                )

                if suggested_region_tags:
                    st.session_state.region_tags_select = suggested_region_tags
                    st.success(
                        ui_text(
                            "Region category suggested. Review the tags before adding the site.",
                            "已建议区域类别。添加站点前请检查标签。",
                        )
                    )

                    if region_note:
                        st.caption(region_note)
                else:
                    st.warning(region_note)

        with region_clear_col:
            if st.button(
                ui_text("Clear region", "清除区域"),
                key="clear_region_tags_for_add_site",
                use_container_width=True,
            ):
                st.session_state.region_tags_select = []
                st.rerun()

        selected_region_tags = st.multiselect(
            site_optional_label("sites_region_category_tags"),
            options=REGION_TAG_OPTIONS,
            help=t("sites_region_category_help", ui_language),
            key="region_tags_select",
        )

        region_category = normalize_region_category(selected_region_tags)

        if region_category:
            st.caption(
                t(
                    "sites_saved_region_category",
                    ui_language,
                    value=region_category,
                )
            )

        exposure_period = st.text_input(
            site_optional_label("sites_exposure_period"),
            placeholder=t("sites_exposure_period_placeholder", ui_language),
            key="exposure_period_input",
        )

        selected_metals = st.multiselect(
            site_optional_label("sites_metal"),
            options=get_metal_options(),
            help=t("sites_metal_help", ui_language),
            key="metals_select",
            accept_new_options=True,
        )

        metal = normalize_metal_selection(selected_metals)

        if metal:
            st.caption(
                t(
                    "sites_saved_metal_field",
                    ui_language,
                    value=metal,
                )
            )

        site_notes = st.text_area(
            site_optional_label("sites_site_notes"),
            placeholder=t("sites_site_notes_placeholder", ui_language),
            key="site_notes_input",
        )

        submit_site = st.button(
            t("sites_add_site_button", ui_language),
            key="add_site_button",
        )

        site_match_preview = preview_site_upsert_match(
            site_id=site_id,
            site_label=site_label,
            latitude=latitude,
            longitude=longitude,
            modern_country_location=modern_country_location,
        )

        if site_match_preview.get("will_merge"):
            st.warning(
                t(
                    "sites_existing_site_warning",
                    ui_language,
                    existing_site_id=site_match_preview.get("existing_site_id", ""),
                    existing_site_label=site_match_preview.get("existing_site_label", ""),
                    existing_country=site_match_preview.get("existing_country", ""),
                    match_reason=site_match_preview.get("match_reason", ""),
                )
            )
        elif site_match_preview.get("checked"):
            st.success(t("sites_no_existing_site_match", ui_language))
        elif site_match_preview.get("message"):
            st.info(str(site_match_preview.get("message", "")))

        if submit_site:
            if not site_id.strip():
                st.error(t("sites_validation_site_id_required", ui_language))
            elif not site_label.strip():
                st.error(t("sites_validation_site_label_required", ui_language))
            elif not latitude.strip():
                st.error(t("sites_validation_latitude_required", ui_language))
            elif not longitude.strip():
                st.error(t("sites_validation_longitude_required", ui_language))
            elif not modern_country_location.strip():
                st.error(t("sites_validation_modern_country_required", ui_language))
            else:
                try:
                    latitude_value = float(latitude)
                    longitude_value = float(longitude)

                    region_category_to_save = region_category

                    if not region_category_to_save.strip():
                        auto_region_tags, _ = suggest_region_tags_for_add_site_form(
                            latitude=latitude_value,
                            longitude=longitude_value,
                            modern_country_location=modern_country_location,
                            site_type=site_type,
                            current_region_category="",
                        )
                        region_category_to_save = normalize_region_category(auto_region_tags)

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
                            "region_category": region_category_to_save,
                            "exposure_period": exposure_period,
                            "metal": metal,
                            "notes": site_notes,
                        }
                    )

                    merge_metadata_for_multiple_sites([site_db_id])

                    st.session_state.clear_site_form_after_success = True

                    if site_action == "created":
                        set_flash_message(
                            t(
                                "sites_flash_site_added",
                                ui_language,
                                site_label=site_label.strip(),
                            )
                        )
                    else:
                        set_flash_message(
                            t(
                                "sites_flash_site_merged",
                                ui_language,
                                site_label=site_label.strip(),
                                match_reason=match_reason,
                            )
                        )

                    st.rerun()
                except ValueError:
                    st.error(t("sites_validation_lat_lon_numbers", ui_language))
                except Exception as exc:
                    st.error(
                        t(
                            "sites_error_could_not_add_site",
                            ui_language,
                            error=str(exc),
                        )
                    )

    st.divider()

    st.write(f"### {t('sites_source_evidence_heading', ui_language)}")
    st.caption(t("sites_source_evidence_caption", ui_language))

    with st.expander(t("sites_attach_sources_expander", ui_language), expanded=True):
        try:
            site_options = get_site_options()
            source_options = get_source_options()
        except Exception as exc:
            site_options = []
            source_options = []
            st.error(
                t(
                    "sites_error_load_site_source_options",
                    ui_language,
                    error=str(exc),
                )
            )

        if not site_options:
            st.info(t("sites_no_sites_available", ui_language))
        elif not source_options:
            st.info(t("sites_no_sources_available", ui_language))
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

            st.write(f"##### {t('sites_site_selection', ui_language)}")

            select_link_sites_clicked, deselect_link_sites_clicked = render_left_button_pair(
                t("sites_select_all_sites", ui_language),
                t("sites_deselect_all_sites", ui_language),
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
                required_label(t("sites_choose_sites", ui_language)),
                options=site_link_labels,
                help=t("sites_choose_sites_help", ui_language),
                key="link_sites_selected",
            )

            st.write(f"##### {t('sites_source_selection', ui_language)}")

            select_link_sources_clicked, deselect_link_sources_clicked = render_left_button_pair(
                t("sites_select_all_sources", ui_language),
                t("sites_deselect_all_sources", ui_language),
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
                required_label(t("sites_choose_sources", ui_language)),
                options=source_link_labels,
                help=t("sites_choose_sources_help", ui_language),
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
                    t(
                        "sites_suggested_from_sources",
                        ui_language,
                        metals=suggested_link_metals or "—",
                        exposure_periods=suggested_link_exposure_periods or "—",
                    )
                )

            source_order = st.number_input(
                required_label(t("sites_source_order", ui_language)),
                min_value=1,
                max_value=99,
                value=1,
                step=1,
                help=t("sites_source_order_help", ui_language),
                key="link_source_order",
            )

            selected_link_metals = st.multiselect(
                site_optional_label("sites_link_metals"),
                options=get_metal_options(),
                help=t("sites_link_metals_help", ui_language),
                key="link_metals_selected",
                accept_new_options=True,
            )

            link_metals = normalize_metal_selection(selected_link_metals)

            selected_link_exposure_periods = st.multiselect(
                site_optional_label("sites_link_exposure_periods"),
                options=EXPOSURE_PERIOD_OPTIONS,
                help=t("sites_link_exposure_periods_help", ui_language),
                key="link_exposure_periods_selected",
                accept_new_options=True,
            )

            link_exposure_periods = normalize_exposure_period_selection(
                selected_link_exposure_periods
            )

            link_notes = st.text_area(
                site_optional_label("sites_link_notes"),
                placeholder=t("sites_link_notes_placeholder", ui_language),
                key="link_notes",
            )

            update_site_summary = st.checkbox(
                t("sites_update_site_summary", ui_language),
                value=True,
                key="link_update_site_summary",
            )

            if link_metals:
                st.caption(
                    t(
                        "sites_site_source_metal_field",
                        ui_language,
                        value=link_metals,
                    )
                )

            if link_exposure_periods.strip():
                st.caption(
                    t(
                        "sites_site_source_exposure_field",
                        ui_language,
                        value=link_exposure_periods.strip(),
                    )
                )

            if st.button(
                t("sites_attach_selected_sources", ui_language),
                key="attach_sources_to_sites",
            ):
                if not selected_site_ids:
                    st.error(t("sites_error_select_one_site", ui_language))
                elif not selected_source_ids:
                    st.error(t("sites_error_select_one_source", ui_language))
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

                        message = t(
                            "sites_flash_links_updated",
                            ui_language,
                            count=changed_count,
                        )

                        if update_site_summary:
                            message += t("sites_flash_site_summary_updated", ui_language)

                        set_flash_message(message)
                        st.session_state.clear_site_source_link_after_success = True
                        st.rerun()

                    except Exception as exc:
                        st.error(
                            t(
                                "sites_error_could_not_attach_sources",
                                ui_language,
                                error=str(exc),
                            )
                        )

    with st.expander(t("sites_review_delete_links_expander", ui_language), expanded=False):
        try:
            link_rows = get_site_source_links()
        except Exception as exc:
            link_rows = []
            st.error(
                t(
                    "sites_error_load_links",
                    ui_language,
                    error=str(exc),
                )
            )

        if not link_rows:
            st.info(t("sites_no_links_created", ui_language))
        else:
            link_df_original = pd.DataFrame(link_rows)
            link_df_editor = link_df_original.copy()
            link_df_editor.insert(0, "delete", False)

            st.caption(t("sites_delete_links_caption", ui_language))

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
                        t("sites_delete_column", ui_language),
                        help=t("sites_delete_column_help", ui_language),
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
                t("sites_confirm_delete_links", ui_language),
                key="confirm_delete_site_source_links",
            )

            link_delete_left, link_delete_right = st.columns([0.72, 0.28])

            with link_delete_right:
                delete_links_clicked = st.button(
                    t("sites_delete_selected_links", ui_language),
                    key="delete_site_source_links",
                    use_container_width=True,
                )

            if delete_links_clicked:
                if not delete_link_ids:
                    st.error(t("sites_error_tick_link_first", ui_language))
                elif not confirm_delete_links:
                    st.error(t("sites_error_confirm_delete_links", ui_language))
                else:
                    try:
                        deleted_count = delete_site_source_links(delete_link_ids)
                        set_flash_message(
                            t(
                                "sites_flash_deleted_links",
                                ui_language,
                                count=deleted_count,
                            )
                        )
                        st.rerun()
                    except Exception as exc:
                        st.error(
                            t(
                                "sites_error_could_not_delete_links",
                                ui_language,
                                error=str(exc),
                            )
                        )

if active_page == "Corrosion Data":
    st.subheader(t("corrosion_title", ui_language))
    st.caption(t("corrosion_caption", ui_language))

    st.info(t("corrosion_structure_info", ui_language))

    st.write(f"### {t('corrosion_csv_import', ui_language)}")

    st.download_button(
        t("corrosion_download_template", ui_language),
        data=make_corrosion_template_csv(),
        file_name="corrosion_observations_template.csv",
        mime="text/csv",
    )

    uploaded_corrosion_csv = st.file_uploader(
        t("corrosion_upload_csv", ui_language),
        type=["csv", "txt"],
        key="corrosion_observation_csv_upload",
        help=t("corrosion_upload_csv_help", ui_language),
    )

    corrosion_preview_df = pd.DataFrame()

    if uploaded_corrosion_csv is not None:
        try:
            corrosion_preview_df = read_corrosion_csv(uploaded_corrosion_csv)

            st.success(
                t(
                    "corrosion_preview_built",
                    ui_language,
                    count=len(corrosion_preview_df),
                )
            )

            st.dataframe(
                corrosion_preview_df,
                width="stretch",
                height=get_table_height(len(corrosion_preview_df), max_height=420),
            )

            confirm_corrosion_import = st.checkbox(
                t("corrosion_confirm_import_checkbox", ui_language),
                key="confirm_corrosion_observation_import",
            )

            if st.button(
                t("corrosion_confirm_import_button", ui_language),
                key="confirm_corrosion_observation_import_button",
            ):
                if not confirm_corrosion_import:
                    st.error(t("corrosion_import_confirm_error", ui_language))
                else:
                    result = import_corrosion_observations(
                        corrosion_preview_df.to_dict("records")
                    )

                    message = t(
                        "corrosion_import_result",
                        ui_language,
                        imported=result["inserted_or_updated"],
                        skipped=result["skipped"],
                    )

                    if result["skipped"]:
                        set_flash_message(message, level="warning")
                    else:
                        set_flash_message(message, level="success")

                    if result["messages"]:
                        st.warning(t("corrosion_import_warning_rows", ui_language))
                        st.code("\n".join(result["messages"][:80]), language="text")

                    set_next_active_page("Corrosion Data")
                    st.rerun()

        except Exception as exc:
            st.error(
                t(
                    "corrosion_preview_build_error",
                    ui_language,
                    error=str(exc),
                )
            )

    st.divider()

    st.write(f"### {t('corrosion_existing_heading', ui_language)}")

    try:
        corrosion_rows = get_corrosion_observations()
        corrosion_df = pd.DataFrame(corrosion_rows)
    except Exception as exc:
        corrosion_df = pd.DataFrame()
        st.error(
            t(
                "corrosion_load_error",
                ui_language,
                error=str(exc),
            )
        )

    if corrosion_df.empty:
        st.info(t("corrosion_no_observations", ui_language))
    else:
        search_corrosion = st.text_input(
            t("corrosion_search_label", ui_language),
            placeholder=t("corrosion_search_placeholder", ui_language),
            key="search_corrosion_observations",
        )

        display_df = corrosion_df.copy()

        if search_corrosion.strip():
            query = search_corrosion.strip().lower()
            display_df = display_df[
                display_df.astype(str)
                .agg(" ".join, axis=1)
                .str.lower()
                .str.contains(query, na=False)
            ]

        st.caption(
            t(
                "corrosion_showing_rows",
                ui_language,
                shown=len(display_df),
                total=len(corrosion_df),
            )
        )

        table_df = display_df.copy()
        table_df.insert(0, "delete", False)

        edited_corrosion_df = st.data_editor(
            table_df,
            width="stretch",
            height=get_table_height(len(table_df), max_height=520),
            disabled=[
                column for column in table_df.columns
                if column != "delete"
            ],
            key="corrosion_observations_editor",
        )

        selected_delete_ids = (
            edited_corrosion_df.loc[
                edited_corrosion_df["delete"].apply(normalise_bool_value),
                "id",
            ]
            .astype(int)
            .tolist()
            if not edited_corrosion_df.empty
            else []
        )

        delete_confirmed = st.checkbox(
            t("corrosion_confirm_delete_checkbox", ui_language),
            key="confirm_delete_corrosion_observations",
        )

        delete_col, export_col, github_col = st.columns(
            [0.28, 0.36, 0.36],
            vertical_alignment="bottom",
        )

        with delete_col:
            if st.button(
                t("corrosion_delete_selected", ui_language),
                key="delete_selected_corrosion_observations",
            ):
                if not selected_delete_ids:
                    st.error(t("corrosion_delete_select_error", ui_language))
                elif not delete_confirmed:
                    st.error(t("corrosion_delete_confirm_error", ui_language))
                else:
                    deleted_count = delete_corrosion_observations(selected_delete_ids)
                    set_flash_message(
                        t(
                            "corrosion_deleted_rows",
                            ui_language,
                            count=deleted_count,
                        )
                    )
                    set_next_active_page("Corrosion Data")
                    st.rerun()

        with export_col:
            if st.button(
                t("corrosion_export_csv", ui_language),
                key="export_corrosion_observations_csv",
            ):
                try:
                    exported_count = export_corrosion_observations_to_website_csv()
                    set_flash_message(
                        t(
                            "corrosion_exported_csv",
                            ui_language,
                            count=exported_count,
                            path=CORROSION_OUTPUT_CSV_PATH.relative_to(REPO_ROOT).as_posix(),
                        )
                    )
                    set_next_active_page("Corrosion Data")
                    st.rerun()
                except Exception as exc:
                    st.error(
                        t(
                            "corrosion_export_error",
                            ui_language,
                            error=str(exc),
                        )
                    )

        with github_col:
            if st.button(
                t("corrosion_upload_github", ui_language),
                key="upload_corrosion_csv_to_github",
            ):
                try:
                    if not CORROSION_OUTPUT_CSV_PATH.exists():
                        exported_count = export_corrosion_observations_to_website_csv()
                    else:
                        exported_count = len(pd.read_csv(CORROSION_OUTPUT_CSV_PATH))

                    result = publish_file_to_github(
                        local_path=CORROSION_OUTPUT_CSV_PATH,
                        commit_message="Update corrosion observations dataset",
                    )

                    st.session_state.last_git_publish_output = str(result.get("output", result))
                    set_flash_message(
                        t(
                            "corrosion_uploaded_github",
                            ui_language,
                            count=exported_count,
                        )
                    )
                    set_next_active_page("Corrosion Data")
                    st.rerun()

                except Exception as exc:
                    st.error(
                        t(
                            "corrosion_upload_github_error",
                            ui_language,
                            error=str(exc),
                        )
                    )

        with st.expander(t("corrosion_show_csv_path", ui_language), expanded=False):
            st.code(CORROSION_OUTPUT_CSV_PATH.as_posix(), language="text")

if active_page == "Environmental Data":
    st.subheader(t("environment_title", ui_language))
    st.caption(t("environment_caption", ui_language))

    st.info(t("environment_structure_info", ui_language))

    st.write(f"### {t('environment_csv_import', ui_language)}")

    st.download_button(
        t("environment_download_template", ui_language),
        data=make_environment_template_csv(),
        file_name="environmental_observations_template.csv",
        mime="text/csv",
    )

    uploaded_environment_csv = st.file_uploader(
        t("environment_upload_csv", ui_language),
        type=["csv", "txt"],
        key="environmental_observation_csv_upload",
        help=t("environment_upload_csv_help", ui_language),
    )

    environment_preview_df = pd.DataFrame()

    if uploaded_environment_csv is not None:
        try:
            environment_preview_df = read_environment_csv(uploaded_environment_csv)

            st.success(
                t(
                    "environment_preview_built",
                    ui_language,
                    count=len(environment_preview_df),
                )
            )

            st.dataframe(
                environment_preview_df,
                width="stretch",
                height=get_table_height(len(environment_preview_df), max_height=420),
            )

            confirm_environment_import = st.checkbox(
                t("environment_confirm_import_checkbox", ui_language),
                key="confirm_environmental_observation_import",
            )

            if st.button(
                t("environment_confirm_import_button", ui_language),
                key="confirm_environmental_observation_import_button",
            ):
                if not confirm_environment_import:
                    st.error(t("environment_import_confirm_error", ui_language))
                else:
                    result = import_environmental_observations(
                        environment_preview_df.to_dict("records")
                    )

                    message = t(
                        "environment_import_result",
                        ui_language,
                        imported=result["inserted_or_updated"],
                        skipped=result["skipped"],
                    )

                    if result["skipped"]:
                        set_flash_message(message, level="warning")
                    else:
                        set_flash_message(message, level="success")

                    if result["messages"]:
                        st.warning(t("environment_import_warning_rows", ui_language))
                        st.code("\n".join(result["messages"][:80]), language="text")

                    set_next_active_page("Environmental Data")
                    st.rerun()

        except Exception as exc:
            st.error(
                t(
                    "environment_preview_build_error",
                    ui_language,
                    error=str(exc),
                )
            )

    st.divider()

    st.write(f"### {t('environment_existing_heading', ui_language)}")

    try:
        environment_rows = get_environmental_observations()
        environment_df = pd.DataFrame(environment_rows)
    except Exception as exc:
        environment_df = pd.DataFrame()
        st.error(
            t(
                "environment_load_error",
                ui_language,
                error=str(exc),
            )
        )

    if environment_df.empty:
        st.info(t("environment_no_observations", ui_language))
    else:
        search_environment = st.text_input(
            t("environment_search_label", ui_language),
            placeholder=t("environment_search_placeholder", ui_language),
            key="search_environmental_observations",
        )

        display_df = environment_df.copy()

        if search_environment.strip():
            query = search_environment.strip().lower()
            display_df = display_df[
                display_df.astype(str)
                .agg(" ".join, axis=1)
                .str.lower()
                .str.contains(query, na=False)
            ]

        st.caption(
            t(
                "environment_showing_rows",
                ui_language,
                shown=len(display_df),
                total=len(environment_df),
            )
        )

        table_df = display_df.copy()
        table_df.insert(0, "delete", False)

        edited_environment_df = st.data_editor(
            table_df,
            width="stretch",
            height=get_table_height(len(table_df), max_height=520),
            disabled=[
                column for column in table_df.columns
                if column != "delete"
            ],
            key="environmental_observations_editor",
            column_config={
                "delete": st.column_config.CheckboxColumn(
                    t("environment_delete_column", ui_language),
                    default=False,
                ),
            },
        )

        selected_delete_ids = (
            edited_environment_df.loc[
                edited_environment_df["delete"].apply(normalise_bool_value),
                "id",
            ]
            .astype(int)
            .tolist()
            if not edited_environment_df.empty
            else []
        )

        delete_confirmed = st.checkbox(
            t("environment_confirm_delete_checkbox", ui_language),
            key="confirm_delete_environmental_observations",
        )

        delete_col, export_col, github_col = st.columns(
            [0.28, 0.36, 0.36],
            vertical_alignment="bottom",
        )

        with delete_col:
            if st.button(
                t("environment_delete_selected", ui_language),
                key="delete_selected_environmental_observations",
            ):
                if not selected_delete_ids:
                    st.error(t("environment_delete_select_error", ui_language))
                elif not delete_confirmed:
                    st.error(t("environment_delete_confirm_error", ui_language))
                else:
                    deleted_count = delete_environmental_observations(selected_delete_ids)
                    set_flash_message(
                        t(
                            "environment_deleted_rows",
                            ui_language,
                            count=deleted_count,
                        )
                    )
                    set_next_active_page("Environmental Data")
                    st.rerun()

        with export_col:
            if st.button(
                t("environment_export_csv", ui_language),
                key="export_environmental_observations_csv",
            ):
                try:
                    exported_count = export_environmental_observations_to_website_csv()
                    set_flash_message(
                        t(
                            "environment_exported_csv",
                            ui_language,
                            count=exported_count,
                            path=ENVIRONMENT_OUTPUT_CSV_PATH.relative_to(REPO_ROOT).as_posix(),
                        )
                    )
                    set_next_active_page("Environmental Data")
                    st.rerun()
                except Exception as exc:
                    st.error(
                        t(
                            "environment_export_error",
                            ui_language,
                            error=str(exc),
                        )
                    )

        with github_col:
            if st.button(
                t("environment_upload_github", ui_language),
                key="upload_environmental_csv_to_github",
            ):
                try:
                    if not ENVIRONMENT_OUTPUT_CSV_PATH.exists():
                        exported_count = export_environmental_observations_to_website_csv()
                    else:
                        exported_count = len(pd.read_csv(ENVIRONMENT_OUTPUT_CSV_PATH))

                    result = publish_file_to_github(
                        local_path=ENVIRONMENT_OUTPUT_CSV_PATH,
                        commit_message="Update environmental observations dataset",
                    )

                    st.session_state.last_git_publish_output = str(result.get("output", result))
                    set_flash_message(
                        t(
                            "environment_uploaded_github",
                            ui_language,
                            count=exported_count,
                        )
                    )
                    set_next_active_page("Environmental Data")
                    st.rerun()

                except Exception as exc:
                    st.error(
                        t(
                            "environment_upload_github_error",
                            ui_language,
                            error=str(exc),
                        )
                    )

        with st.expander(t("environment_show_csv_path", ui_language), expanded=False):
            st.code(ENVIRONMENT_OUTPUT_CSV_PATH.as_posix(), language="text")

if active_page == "Manage Records":
    def manage_table_label(table_name: str) -> str:
        if table_name == "sites":
            return t("manage_table_sites", ui_language)
        if table_name == "sources":
            return t("manage_table_sources", ui_language)
        return str(table_name)

    def manage_field_label(field_name: str) -> str:
        field_key_map = {
            "site_id": "manage_field_site_id",
            "site_label": "manage_field_site_label",
            "latitude": "manage_field_latitude",
            "longitude": "manage_field_longitude",
            "modern_country_location": "manage_field_modern_country_location",
            "administering_country": "manage_field_administering_country",
            "former_entity": "manage_field_former_entity",
            "region_category": "manage_field_region_category",
            "exposure_period": "manage_field_exposure_period",
            "metal": "manage_field_metal",
            "notes": "manage_field_notes",
            "source_code": "manage_field_source_code",
            "source_title": "manage_field_source_title",
            "programme": "manage_field_programme",
            "metals": "manage_field_metals",
            "exposure_periods": "manage_field_exposure_periods",
            "source_url": "manage_field_source_url",
        }

        return t(field_key_map.get(field_name, field_name), ui_language)

    st.subheader(t("manage_title", ui_language))
    st.markdown('<div id="manage-records-top"></div>', unsafe_allow_html=True)
    st.caption(t("manage_caption", ui_language))

    manage_table = st.selectbox(
        t("manage_choose_table", ui_language),
        options=["sites", "sources"],
        index=0,
        key="manage_table_select",
        format_func=manage_table_label,
    )

    try:
        rows = get_table_rows(manage_table)
    except Exception as exc:
        st.error(
            t(
                "manage_load_error",
                ui_language,
                error=str(exc),
            )
        )
        rows = []

    if not rows:
        st.info(
            t(
                "manage_no_records",
                ui_language,
                table=manage_table_label(manage_table),
            )
        )
        st.stop()

    st.write(f"#### {t('manage_browse_records', ui_language)}")

    search_text = st.text_input(
        t("manage_search_records", ui_language),
        placeholder=t("manage_search_placeholder", ui_language),
        key=f"manage_search_{manage_table}",
    )

    filtered_rows = filter_records_by_search(rows, search_text)

    if not filtered_rows:
        st.info(t("manage_no_search_match", ui_language))
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
        t(
            "manage_showing_rows",
            ui_language,
            start=start_index + 1,
            end=min(end_index, total_filtered_rows),
            filtered=total_filtered_rows,
            table=manage_table_label(manage_table),
            total=len(rows),
        )
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
                t("manage_column_source_codes", ui_language),
                options=source_code_options,
                accept_new_options=True,
                width="large",
            ),
            "region_category": st.column_config.MultiselectColumn(
                t("manage_column_region_category", ui_language),
                options=region_options,
                accept_new_options=True,
                width="large",
            ),
            "programmes": st.column_config.MultiselectColumn(
                t("manage_column_programmes", ui_language),
                options=programme_options,
                accept_new_options=True,
                width="large",
            ),
            "metal": st.column_config.MultiselectColumn(
                t("manage_column_metal", ui_language),
                options=metal_options,
                accept_new_options=True,
                width="large",
            ),
            "exposure_period": st.column_config.MultiselectColumn(
                t("manage_column_exposure_period", ui_language),
                options=exposure_options,
                accept_new_options=True,
                width="large",
            ),
            "delete": st.column_config.CheckboxColumn(
                t("manage_column_delete", ui_language),
                help=t("manage_help_delete_column", ui_language),
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
                t("manage_column_programme", ui_language),
                options=get_programme_options(include_blank=False),
                accept_new_options=True,
                help=t("manage_help_programme_column", ui_language),
                width="medium",
            ),
            "source_code": st.column_config.TextColumn(
                t("manage_column_source_code", ui_language),
                width="small",
            ),
            "source_title": st.column_config.TextColumn(
                t("manage_column_source_title", ui_language),
                width="large",
            ),
            "metals": st.column_config.MultiselectColumn(
                t("manage_column_metals", ui_language),
                options=get_metal_options(),
                accept_new_options=True,
                help=t("manage_help_metals_column", ui_language),
                width="large",
            ),
            "exposure_periods": st.column_config.MultiselectColumn(
                t("manage_column_exposure_periods", ui_language),
                options=EXPOSURE_PERIOD_OPTIONS,
                accept_new_options=True,
                help=t("manage_help_exposure_periods_column", ui_language),
                width="large",
            ),
            "source_url": st.column_config.LinkColumn(
                t("manage_column_source_url", ui_language),
                help=t("manage_help_source_url_column", ui_language),
                width="medium",
            ),
            "delete": st.column_config.CheckboxColumn(
                t("manage_column_delete", ui_language),
                help=t("manage_help_delete_column", ui_language),
                default=False,
            ),
        }

    st.caption(t("manage_edit_table_caption", ui_language))

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
                t("manage_confirm_delete", ui_language),
                key=f"confirm_delete_{manage_table}",
            )

    action_left, action_right = st.columns([0.58, 0.42], vertical_alignment="bottom")

    with action_left:
        select_delete_clicked, deselect_delete_clicked = render_left_button_pair(
            t("manage_select_all_delete", ui_language),
            t("manage_deselect_all_delete", ui_language),
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
                t("manage_delete_selected", ui_language),
                key=f"delete_selected_{manage_table}",
                use_container_width=True,
            )

        with save_button_col:
            save_clicked = st.button(
                t("manage_save_edits", ui_language),
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

                    if column in {"programme", "metals", "exposure_periods"}:
                        old_normalised = join_chip_values(old_value)
                        new_normalised = join_chip_values(new_value)
                    elif column == "source_code":
                        old_normalised = normalise_source_code(str(old_value))
                        new_normalised = normalise_source_code(str(clean_editor_value(new_value)))

                        if not is_canonical_source_code(new_normalised):
                            st.error(
                                t(
                                    "manage_invalid_source_code",
                                    ui_language,
                                    value=str(new_value),
                                )
                            )
                            st.stop()

                        if source_code_exists(new_normalised, exclude_source_id=row_id):
                            st.error(
                                t(
                                    "manage_duplicate_source_code",
                                    ui_language,
                                    source_code=new_normalised,
                                )
                            )
                            st.stop()
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
            set_flash_message(
                t(
                    "manage_saved_edits",
                    ui_language,
                    count=updated_rows,
                )
            )
            st.rerun()
        else:
            st.info(t("manage_no_changes", ui_language))

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
            st.error(t("manage_delete_select_error", ui_language))
        elif not confirm_bulk_delete:
            st.error(t("manage_delete_confirm_error", ui_language))
        else:
            try:
                deleted_count = delete_table_rows(manage_table, delete_ids)
                set_flash_message(
                    t(
                        "manage_deleted_records",
                        ui_language,
                        count=deleted_count,
                        table=manage_table_label(manage_table),
                    )
                )
                st.rerun()
            except Exception as exc:
                st.error(
                    t(
                        "manage_delete_failed",
                        ui_language,
                        error=str(exc),
                    )
                )

    render_pagination_controls(
        total_rows=total_filtered_rows,
        page_key=page_key,
        page_size_key=page_size_key,
    )

    st.write(f"#### {t('manage_bulk_edit_heading', ui_language)}")

    row_label_to_id = {
        build_row_label(row, manage_table): int(row["id"])
        for row in filtered_rows
    }

    row_labels = list(row_label_to_id.keys())
    bulk_selection_key = f"bulk_rows_{manage_table}"

    if bulk_selection_key not in st.session_state:
        st.session_state[bulk_selection_key] = []

    bulk_select_clicked, bulk_deselect_clicked = render_left_button_pair(
        t("manage_select_all_bulk", ui_language),
        t("manage_deselect_all_bulk", ui_language),
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
        t("manage_choose_records_update", ui_language),
        options=row_labels,
        key=bulk_selection_key,
    )

    selected_row_ids = [
        row_label_to_id[label]
        for label in selected_row_labels
    ]

    if manage_table == "sites":
        st.write(f"#### {t('manage_auto_region_heading', ui_language)}")

        if st.button(
            t("manage_preview_auto_region", ui_language),
            key="preview_auto_region_categories",
            disabled=not selected_row_ids,
        ):
            selected_rows = [
                row for row in filtered_rows
                if int(row["id"]) in selected_row_ids
            ]

            preview_rows = []
            region_settings = get_region_classification_settings()

            for row in selected_rows:
                result = classify_region_category(
                    latitude=row.get("latitude"),
                    longitude=row.get("longitude"),
                    current_region_category=row.get("region_category", ""),
                    modern_country_location=row.get("modern_country_location", ""),
                    site_type=row.get("site_type", ""),
                    settings=region_settings,
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
                        t("manage_auto_apply_column", ui_language),
                        help=t("manage_auto_apply_help", ui_language),
                        default=True,
                    ),
                    "id": None,
                    "suggested_region_category": st.column_config.TextColumn(
                        t("manage_auto_suggested_region", ui_language),
                        help=t("manage_auto_suggested_region_help", ui_language),
                    ),
                },
            )

            apply_auto_region_df = edited_auto_region_df[
                edited_auto_region_df["apply"].astype(bool)
            ].copy()

            apply_auto_clicked, clear_auto_clicked = render_left_button_pair(
                t("manage_apply_auto_region", ui_language),
                t("manage_clear_auto_region", ui_language),
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
                    t(
                        "manage_auto_region_updated",
                        ui_language,
                        count=updated_count,
                    )
                )
                st.rerun()

            if clear_auto_clicked:
                st.session_state.pop("auto_region_preview_df", None)
                st.rerun()

    bulk_field = st.selectbox(
        t("manage_field_bulk_update", ui_language),
        options=editable_columns,
        key=f"bulk_field_{manage_table}",
        format_func=manage_field_label,
    )

    bulk_value = st.text_input(
        t("manage_new_value", ui_language),
        key=f"bulk_value_{manage_table}",
    )

    if st.button(t("manage_apply_bulk_edit", ui_language), key=f"apply_bulk_{manage_table}"):
        if not selected_row_ids:
            st.error(t("manage_bulk_select_error", ui_language))
        else:
            try:
                changed_count = bulk_update_table_rows(
                    manage_table,
                    selected_row_ids,
                    bulk_field,
                    bulk_value,
                )
                set_flash_message(
                    t(
                        "manage_bulk_updated",
                        ui_language,
                        count=changed_count,
                    )
                )
                st.rerun()
            except Exception as exc:
                st.error(
                    t(
                        "manage_bulk_failed",
                        ui_language,
                        error=str(exc),
                    )
                )

if active_page == "Import":
    st.subheader(t("import_title", ui_language))
    st.caption(t("import_caption", ui_language))

    import_success_message = st.session_state.pop("last_import_success_message", "")

    if import_success_message:
        st.success(t("import_success_message", ui_language, message=import_success_message))

    restored_import_preview_payload = st.session_state.get(
        "restored_import_preview_payload"
    )

    if restored_import_preview_payload:
        restored_file_name = st.session_state.get(
            "restored_import_preview_file_name",
            restored_import_preview_payload.get("uploaded_file_name", "previous CSV"),
        )

        restored_updated_at = st.session_state.get(
            "restored_import_preview_updated_at",
            "",
        )

        st.info(
            t(
                "import_restored_draft_active",
                ui_language,
                file_name=restored_file_name,
                updated_at=restored_updated_at or t("import_unknown_time", ui_language),
            )
        )

        discard_active_draft_col, active_draft_spacer = st.columns(
            [0.28, 0.72],
            vertical_alignment="bottom",
        )

        with discard_active_draft_col:
            if st.button(
                t("import_discard_active_draft", ui_language),
                key="discard_active_import_preview_draft",
                use_container_width=True,
            ):
                delete_app_draft(IMPORT_PREVIEW_DRAFT_KEY)
                clear_import_draft_session_state()
                refresh_import_preview_editor()
                st.rerun()

    else:
        try:
            saved_import_draft = load_app_draft(IMPORT_PREVIEW_DRAFT_KEY)
        except Exception as exc:
            saved_import_draft = None
            st.warning(
                t(
                    "import_check_saved_draft_error",
                    ui_language,
                    error=str(exc),
                )
            )

        if saved_import_draft:
            draft_payload = saved_import_draft.get("payload", {})
            draft_file_name = str(
                draft_payload.get("uploaded_file_name", "previous CSV")
            ).strip() or "previous CSV"

            site_preview_payload = draft_payload.get("site_preview_df", {})
            draft_site_count = len(site_preview_payload.get("records", []))

            st.warning(
                t(
                    "import_unsaved_draft_found",
                    ui_language,
                    file_name=draft_file_name,
                    updated_at=saved_import_draft.get(
                        "updated_at",
                        t("import_unknown_time", ui_language),
                    ),
                    site_count=draft_site_count,
                )
            )

            restore_col, discard_col, draft_spacer = st.columns(
                [0.20, 0.20, 0.60],
                vertical_alignment="bottom",
            )

            with restore_col:
                restore_import_draft_clicked = st.button(
                    t("import_restore_draft", ui_language),
                    key="restore_import_preview_draft",
                    use_container_width=True,
                )

            with discard_col:
                discard_import_draft_clicked = st.button(
                    t("import_discard_draft", ui_language),
                    key="discard_import_preview_draft",
                    use_container_width=True,
                )

            if restore_import_draft_clicked:
                st.session_state["restored_import_preview_payload"] = draft_payload
                st.session_state["restored_import_preview_updated_at"] = str(
                    saved_import_draft.get("updated_at", "")
                )
                st.session_state["restored_import_preview_file_name"] = draft_file_name

                st.session_state["import_upload_version"] = (
                    int(st.session_state.get("import_upload_version", 0)) + 1
                )

                st.session_state.pop("import_site_preview_override", None)
                st.session_state.pop("latest_import_preview", None)
                st.session_state.pop("cached_import_preview_signature", None)
                st.session_state.pop("cached_import_preview_df", None)
                st.session_state.pop("cached_import_site_preview_df", None)
                st.session_state.pop("last_import_upload_signature", None)

                refresh_import_preview_editor()
                st.rerun()

            if discard_import_draft_clicked:
                delete_app_draft(IMPORT_PREVIEW_DRAFT_KEY)
                clear_import_draft_session_state()
                refresh_import_preview_editor()
                st.rerun()

    st.write(f"### {t('import_sites_csv_heading', ui_language)}")

    st.info(t("import_minimal_format_info", ui_language))

    if "import_upload_version" not in st.session_state:
        st.session_state["import_upload_version"] = 0

    import_upload_version = int(st.session_state["import_upload_version"])

    uploaded_import_csv = st.file_uploader(
        required_label(t("import_upload_csv_file", ui_language)),
        type=["csv", "txt"],
        help=t("import_upload_csv_help", ui_language),
        key=f"import_sites_csv_{import_upload_version}",
    )

    import_template_csv = (
        "site_label,modern_country_location,administering_country,former_entity,"
        "site_type,geocode_query,latitude,longitude,source_1,source_2,source_3,notes\n"
        "Example site,China,,,,\"Example site, China\",,,s001,,,Optional note\n"
    )

    st.download_button(
        t("import_download_template", ui_language),
        data=import_template_csv.encode("utf-8-sig"),
        file_name="corrosion_map_import_template.csv",
        mime="text/csv",
        key="download_import_template_csv",
    )

    if uploaded_import_csv is not None:
        uploaded_import_signature = (
            f"{uploaded_import_csv.name}:"
            f"{getattr(uploaded_import_csv, 'size', '')}"
        )

        if st.session_state.get("last_import_upload_signature") != uploaded_import_signature:
            st.session_state["last_import_upload_signature"] = uploaded_import_signature

            st.session_state.pop("restored_import_preview_payload", None)
            st.session_state.pop("restored_import_preview_updated_at", None)
            st.session_state.pop("restored_import_preview_file_name", None)
            st.session_state.pop("import_site_preview_override", None)
            st.session_state.pop("latest_import_preview", None)

            refresh_import_preview_editor()

    import_col1, import_col2 = st.columns(2)

    with import_col1:
        default_import_programme = st.selectbox(
            t("import_default_programme", ui_language),
            options=get_programme_options(include_blank=True),
            key="default_import_programme",
        )

    with import_col2:
        geocode_missing_coordinates = st.checkbox(
            t("import_geocode_missing", ui_language),
            value=True,
            help=t("import_geocode_missing_help", ui_language),
            key="geocode_missing_coordinates_import",
        )

        auto_fill_region_category_import = st.checkbox(
            t("import_auto_fill_region", ui_language),
            value=True,
            help=t("import_auto_fill_region_help", ui_language),
            key="auto_fill_region_category_import",
        )

        require_registered_source_metadata = st.checkbox(
            t("import_require_registered_metadata", ui_language),
            value=True,
            help=t("import_require_registered_metadata_help", ui_language),
            key="require_registered_source_metadata_import",
        )

    rebuild_import_preview_clicked = False

    if uploaded_import_csv is not None:
        rebuild_import_preview_clicked = st.button(
            t("import_rebuild_preview", ui_language),
            key="rebuild_import_preview_from_uploaded_csv",
            help=t("import_rebuild_preview_help", ui_language),
        )

    st.write(f"#### {t('import_rules_heading', ui_language)}")
    st.markdown(t("import_rules_markdown", ui_language))

    restored_import_preview_payload = st.session_state.get(
        "restored_import_preview_payload"
    )

    has_restored_import_preview = isinstance(restored_import_preview_payload, dict)

    if uploaded_import_csv is not None or has_restored_import_preview:
        try:
            if has_restored_import_preview and uploaded_import_csv is None:
                restored_payload = cast(dict[str, Any], restored_import_preview_payload)

                preview_payload = restored_payload.get("preview_df", {})
                site_preview_payload = restored_payload.get("site_preview_df", {})

                preview_df = dataframe_from_draft_payload(preview_payload)
                site_preview_df = dataframe_from_draft_payload(site_preview_payload)

                if preview_df.empty or site_preview_df.empty:
                    st.warning(t("import_saved_draft_invalid", ui_language))
                    st.stop()

                st.session_state["import_site_preview_override"] = site_preview_df.copy()

                st.caption(t("import_using_restored_draft", ui_language))

            else:
                if uploaded_import_csv is None:
                    st.warning(t("import_upload_or_restore_first", ui_language))
                    st.stop()

                uploaded_csv_for_preview = uploaded_import_csv

                current_import_preview_signature = make_import_preview_signature(
                    uploaded_file=uploaded_csv_for_preview,
                    default_import_programme=default_import_programme,
                    geocode_missing_coordinates=geocode_missing_coordinates,
                    auto_fill_region_category_import=auto_fill_region_category_import,
                    require_registered_source_metadata=require_registered_source_metadata,
                )

                cached_signature = st.session_state.get(
                    "cached_import_preview_signature",
                    "",
                )

                needs_preview_rebuild = (
                    rebuild_import_preview_clicked
                    or cached_signature != current_import_preview_signature
                    or "cached_import_preview_df" not in st.session_state
                    or "cached_import_site_preview_df" not in st.session_state
                )

                if needs_preview_rebuild:
                    st.session_state.pop("import_site_preview_override", None)
                    st.session_state.pop("latest_import_preview", None)
                    refresh_import_preview_editor()

                    loading_message = (
                        t("import_building_preview_geocode", ui_language)
                        if geocode_missing_coordinates
                        else t("import_building_preview", ui_language)
                    )

                    with st.status(loading_message, expanded=True) as import_status:
                        st.write(t("import_status_reading_csv", ui_language))
                        st.write(t("import_status_checking_records", ui_language))

                        if geocode_missing_coordinates:
                            st.write(t("import_status_contacting_osm", ui_language))

                        preview_df = build_import_preview(
                            uploaded_file=uploaded_csv_for_preview,
                            existing_site_ids=get_existing_site_ids(),
                            existing_source_codes=get_existing_source_codes(),
                            existing_site_source_pairs=get_existing_site_source_pairs(),
                            default_programme=default_import_programme,
                            geocode_missing_coordinates=geocode_missing_coordinates,
                            source_metadata_by_code=get_source_metadata_by_code(),
                            site_id_generator=make_import_site_id_generator(),
                            require_existing_source_metadata=require_registered_source_metadata,
                        )

                        st.write(t("import_status_checking_site_matches", ui_language))
                        preview_df = annotate_import_preview_for_upsert(preview_df)

                        if auto_fill_region_category_import:
                            st.write(t("import_status_auto_filling_regions", ui_language))
                            preview_df = auto_fill_import_region_categories(preview_df)

                        st.write(t("import_status_preparing_table", ui_language))
                        site_preview_df = build_site_level_import_preview(preview_df)

                        st.session_state["cached_import_preview_signature"] = (
                            current_import_preview_signature
                        )
                        st.session_state["cached_import_preview_df"] = preview_df.copy()
                        st.session_state["cached_import_site_preview_df"] = site_preview_df.copy()

                        import_status.update(
                            label=t("import_status_preview_ready", ui_language),
                            state="complete",
                            expanded=False,
                        )

                else:
                    preview_df = st.session_state["cached_import_preview_df"].copy()
                    site_preview_df = st.session_state["cached_import_site_preview_df"].copy()
                    st.caption(t("import_using_cached_preview", ui_language))

            if "import_site_preview_override" in st.session_state:
                override_df = st.session_state["import_site_preview_override"]

                if isinstance(override_df, pd.DataFrame) and not override_df.empty:
                    site_preview_df = override_df.copy()

            if preview_df.empty:
                st.warning(t("import_no_preview_rows", ui_language))
            else:
                st.success(
                    t(
                        "import_parsed_preview_rows",
                        ui_language,
                        count=len(preview_df),
                    )
                )

                last_region_fill_message = st.session_state.pop(
                    "last_import_region_fill_message",
                    "",
                )

                if last_region_fill_message:
                    st.info(last_region_fill_message)

                select_import_clicked, deselect_import_clicked = render_left_button_pair(
                    t("import_select_all_sites", ui_language),
                    t("import_deselect_all_sites", ui_language),
                    left_key="select_all_import_sites",
                    right_key="deselect_all_import_sites",
                    widths=BUTTON_PAIR_MEDIUM,
                )

                if select_import_clicked:
                    site_preview_df["import_selected"] = True
                    st.session_state["import_site_preview_override"] = site_preview_df
                    refresh_import_preview_editor()
                    st.rerun()

                if deselect_import_clicked:
                    site_preview_df["import_selected"] = False
                    st.session_state["import_site_preview_override"] = site_preview_df
                    refresh_import_preview_editor()
                    st.rerun()

                visible_site_preview_columns = [
                    "import_selected",
                    "retry_osm",
                    "apply_osm_suggestion",
                    "site_id",
                    "site_label",
                    "geocode_query",
                    "osm_suggestion",
                    "osm_full_label",
                    "osm_suggestion_latitude",
                    "osm_suggestion_longitude",
                    "latitude",
                    "longitude",
                    "modern_country_location",
                    "administering_country",
                    "former_entity",
                    "region_category",
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

                for chip_column in [
                    "source_codes",
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

                import_preview_editor_version = int(
                    st.session_state.get("import_preview_editor_version", 0)
                )

                edited_site_preview_df = st.data_editor(
                    site_preview_display_df,
                    hide_index=True,
                    width="stretch",
                    height=get_table_height(len(site_preview_display_df)),
                    num_rows="fixed",
                    key=f"import_preview_editor_{import_preview_editor_version}",
                    column_config={
                        "import_selected": st.column_config.CheckboxColumn(
                            t("import_column_import", ui_language),
                            help=t("import_column_import_help", ui_language),
                            default=True,
                        ),
                        "source_codes": st.column_config.MultiselectColumn(
                            t("import_column_source_codes", ui_language),
                            options=source_code_chip_options,
                            accept_new_options=True,
                            width="large",
                        ),
                        "programmes": st.column_config.MultiselectColumn(
                            t("import_column_programmes", ui_language),
                            options=programme_chip_options,
                            accept_new_options=True,
                            width="large",
                        ),
                        "metals": st.column_config.MultiselectColumn(
                            t("import_column_metals", ui_language),
                            options=metal_chip_options,
                            accept_new_options=True,
                            width="large",
                        ),
                        "exposure_periods": st.column_config.MultiselectColumn(
                            t("import_column_exposure_periods", ui_language),
                            options=exposure_chip_options,
                            accept_new_options=True,
                            width="large",
                        ),
                        "retry_osm": st.column_config.CheckboxColumn(
                            t("import_column_retry_osm", ui_language),
                            help=t("import_column_retry_osm_help", ui_language),
                            default=False,
                        ),
                        "apply_osm_suggestion": st.column_config.CheckboxColumn(
                            t("import_column_apply_osm", ui_language),
                            help=t("import_column_apply_osm_help", ui_language),
                            default=False,
                        ),
                        "geocode_query": st.column_config.TextColumn(
                            t("import_column_geocode_query", ui_language),
                            help=t("import_column_geocode_query_help", ui_language),
                            width="medium",
                        ),
                        "osm_suggestion": st.column_config.TextColumn(
                            t("import_column_osm_suggestion", ui_language),
                            help=t("import_column_osm_suggestion_help", ui_language),
                            width="large",
                        ),
                        "osm_full_label": st.column_config.TextColumn(
                            t("import_column_osm_full_label", ui_language),
                            help=t("import_column_osm_full_label_help", ui_language),
                            width="large",
                        ),
                        "osm_suggestion_latitude": st.column_config.TextColumn(
                            t("import_column_osm_lat", ui_language),
                            width="small",
                        ),
                        "osm_suggestion_longitude": st.column_config.TextColumn(
                            t("import_column_osm_lon", ui_language),
                            width="small",
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
                        "osm_suggestion",
                        "osm_full_label",
                        "osm_suggestion_latitude",
                        "osm_suggestion_longitude",
                        "osm_query_used",
                    ],
                )

                edited_site_preview_df = edited_site_preview_df.copy()

                if "import_selected" in edited_site_preview_df.columns:
                    edited_site_preview_df["import_selected"] = normalise_bool_column(
                        edited_site_preview_df,
                        "import_selected",
                    )

                osm_retry_clicked, osm_apply_clicked = render_left_button_pair(
                    t("import_retry_osm", ui_language),
                    t("import_apply_osm", ui_language),
                    left_key="retry_osm_for_import_preview",
                    right_key="apply_osm_suggestions_import_preview",
                    widths=BUTTON_PAIR_LONG,
                )

                if osm_retry_clicked:
                    with st.status(t("import_status_retrying_osm", ui_language), expanded=True) as osm_status:
                        st.write(t("import_status_retrying_osm_rows", ui_language))
                        site_preview_df = retry_osm_for_site_preview(edited_site_preview_df)
                        osm_status.update(
                            label=t("import_status_osm_finished", ui_language),
                            state="complete",
                            expanded=False,
                        )

                    st.session_state["import_site_preview_override"] = site_preview_df
                    refresh_import_preview_editor()
                    st.rerun()

                if osm_apply_clicked:
                    site_preview_df = apply_osm_suggestions_to_site_preview(edited_site_preview_df)
                    st.session_state["import_site_preview_override"] = site_preview_df
                    refresh_import_preview_editor()
                    st.rerun()

                region_fill_col, region_fill_spacer = st.columns(
                    [0.42, 0.58],
                    vertical_alignment="bottom",
                )

                with region_fill_col:
                    fill_regions_clicked = st.button(
                        t("import_auto_fill_regions_button", ui_language),
                        key="auto_fill_import_regions_from_current_coordinates",
                        use_container_width=True,
                    )

                if fill_regions_clicked:
                    site_preview_df, updated_count, skipped_count = (
                        auto_fill_site_preview_region_categories_from_current_coordinates(
                            edited_site_preview_df,
                            overwrite_existing=False,
                        )
                    )

                    st.session_state["import_site_preview_override"] = site_preview_df
                    st.session_state["last_import_region_fill_message"] = (
                        t(
                            "import_region_fill_message",
                            ui_language,
                            filled=updated_count,
                            skipped=skipped_count,
                        )
                    )
                    refresh_import_preview_editor()
                    st.rerun()

                if st.button(t("import_reset_preview_edits", ui_language), key="reset_import_preview_edits"):
                    st.session_state.pop("import_site_preview_override", None)
                    refresh_import_preview_editor()
                    st.rerun()

                edited_preview_df = apply_site_preview_edits_to_detail(
                    original_site_preview_df=site_preview_df,
                    edited_site_preview_df=edited_site_preview_df,
                    detail_df=preview_df,
                )

                st.session_state["latest_import_preview"] = edited_preview_df

                if uploaded_import_csv is not None:
                    import_draft_file_name = getattr(uploaded_import_csv, "name", "")
                else:
                    import_draft_file_name = str(
                        restored_import_preview_payload.get("uploaded_file_name", "")
                        if isinstance(restored_import_preview_payload, dict)
                        else ""
                    )

                import_preview_draft_payload = {
                    "preview_df": dataframe_to_draft_payload(preview_df),
                    "site_preview_df": dataframe_to_draft_payload(edited_site_preview_df),
                    "edited_preview_df": dataframe_to_draft_payload(edited_preview_df),
                    "uploaded_file_name": import_draft_file_name,
                }

                draft_saved = autosave_app_draft(
                    draft_key=IMPORT_PREVIEW_DRAFT_KEY,
                    draft_label=t("import_preview_draft_label", ui_language),
                    payload=import_preview_draft_payload,
                    interval_seconds=8,
                )

                if draft_saved:
                    st.caption(t("import_preview_draft_saved", ui_language))

                selected_site_count = int(
                    normalise_bool_column(edited_site_preview_df, "import_selected").sum()
                )

                selected_link_count = int(
                    normalise_bool_column(edited_preview_df, "import_selected").sum()
                )
                warning_count = int(
                    edited_site_preview_df["warnings"].astype(str).str.len().gt(0).sum()
                )

                metric1, metric2, metric3 = st.columns(3)

                with metric1:
                    st.metric(t("import_metric_preview_sites", ui_language), len(edited_site_preview_df))

                with metric2:
                    st.metric(t("import_metric_selected_sites", ui_language), selected_site_count)

                with metric3:
                    st.metric(t("import_metric_selected_links", ui_language), selected_link_count)

                new_source_codes: list[str] = []

                if "new_sources" in edited_site_preview_df.columns:
                    for value in edited_site_preview_df["new_sources"].dropna().tolist():
                        for item in split_chip_values(value):
                            if item not in new_source_codes:
                                new_source_codes.append(item)

                new_source_codes = sorted(new_source_codes)

                if new_source_codes:
                    st.warning(
                        t(
                            "import_new_sources_warning",
                            ui_language,
                            source_codes=", ".join(new_source_codes),
                        )
                    )

                if warning_count:
                    with st.expander(t("import_show_warning_rows", ui_language), expanded=False):
                        warning_df = edited_site_preview_df[
                            edited_site_preview_df["warnings"].astype(str).str.len() > 0
                        ]
                        st.dataframe(warning_df, width="stretch")

                        st.download_button(
                            t("import_download_warning_rows", ui_language),
                            data=warning_df.to_csv(index=False).encode("utf-8-sig"),
                            file_name="import_warning_rows.csv",
                            mime="text/csv",
                            key="download_import_warning_rows",
                        )

                st.write(f"#### {t('import_confirm_heading', ui_language)}")

                confirm_import_checked = st.checkbox(
                    required_label(t("import_confirm_checkbox", ui_language)),
                    key="confirm_import_checked",
                )

                if st.button(t("import_confirm_button", ui_language), type="primary", key="confirm_selected_import"):
                    if not confirm_import_checked:
                        st.error(t("import_confirm_error", ui_language))
                    elif selected_site_count == 0:
                        st.error(t("import_select_site_error", ui_language))
                    else:
                        try:
                            result = confirm_import_preview(edited_preview_df)

                            success_message = t(
                                "import_success_written",
                                ui_language,
                                sites=result["sites"],
                                sources=result["sources"],
                                links=result["links"],
                            )

                            st.session_state["last_import_success_message"] = success_message

                            st.session_state["import_upload_version"] = (
                                int(st.session_state.get("import_upload_version", 0)) + 1
                            )

                            st.session_state.pop("import_site_preview_override", None)
                            st.session_state.pop("latest_import_preview", None)
                            st.session_state.pop("last_import_upload_signature", None)
                            refresh_import_preview_editor()
                            st.session_state.pop("cached_import_preview_signature", None)
                            st.session_state.pop("cached_import_preview_df", None)
                            st.session_state.pop("cached_import_site_preview_df", None)
                            st.session_state.pop("restored_import_preview_payload", None)
                            st.session_state.pop("restored_import_preview_updated_at", None)
                            st.session_state.pop("restored_import_preview_file_name", None)
                            delete_app_draft(IMPORT_PREVIEW_DRAFT_KEY)

                            set_next_active_page("Import")
                            set_flash_message(success_message)
                            st.rerun()

                        except Exception as exc:
                            st.error(
                                t(
                                    "import_failed",
                                    ui_language,
                                    error=str(exc),
                                )
                            )

        except Exception as exc:
            st.error(
                t(
                    "import_preview_build_failed",
                    ui_language,
                    error=str(exc),
                )
            )

    st.divider()

if active_page == "Export / Publish":
    st.subheader(t("publish_title", ui_language))
    st.caption(t("publish_caption", ui_language))

    st.write(f"### {t('publish_website_dataset_heading', ui_language)}")
    st.write(
        t(
            "publish_live_file",
            ui_language,
            path=display_app_path(OUTPUT_CSV_PATH),
        )
    )
    st.caption(t("publish_dataset_caption", ui_language))

    try:
        publishable_rows = get_publishable_sites()
        live_published_site_ids = get_live_published_site_ids()
    except Exception as exc:
        publishable_rows = []
        live_published_site_ids = set()
        st.error(
            t(
                "publish_load_error",
                ui_language,
                error=str(exc),
            )
        )

    if not publishable_rows:
        st.info(t("publish_no_curated_sites", ui_language))
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
                t(
                    "publish_duplicate_site_ids",
                    ui_language,
                    site_ids=", ".join(sorted(set(duplicate_site_ids))),
                )
            )

        already_published_df = publish_df[
            publish_df["is_already_published"]
        ].copy()

        unpublished_df = publish_df[
            ~publish_df["is_already_published"]
        ].copy()
        edited_unpublished_df = pd.DataFrame()

        st.write(f"### {t('publish_unpublished_heading', ui_language)}")

        if unpublished_df.empty:
            st.success(t("publish_all_sites_already_present", ui_language))
        else:
            unpublished_publish_default_key = "unpublished_publish_default"

            if unpublished_publish_default_key not in st.session_state:
                st.session_state[unpublished_publish_default_key] = False

            select_unpublished_clicked, deselect_unpublished_clicked = render_left_button_pair(
                t("publish_select_all_unpublished", ui_language),
                t("publish_deselect_unpublished", ui_language),
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
                        t("publish_column_publish", ui_language),
                        help=t("publish_unpublished_help", ui_language),
                        default=False,
                    ),
                },
                disabled=[
                    column for column in unpublished_display_df.columns
                    if column != "publish"
                ],
            )

        st.write(f"### {t('publish_published_heading', ui_language)}")

        if already_published_df.empty:
            st.info(t("publish_no_currently_published", ui_language))
            edited_published_df = pd.DataFrame()
        else:
            published_publish_default_key = "published_publish_default"

            if published_publish_default_key not in st.session_state:
                st.session_state[published_publish_default_key] = True

            keep_published_clicked, remove_published_clicked = render_left_button_pair(
                t("publish_keep_all_published", ui_language),
                t("publish_remove_all_published", ui_language),
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
                        t("publish_column_publish", ui_language),
                        help=t("publish_published_help", ui_language),
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
            st.metric(t("publish_metric_curated_sites", ui_language), len(publish_df))

        with metric_pub_2:
            st.metric(t("publish_metric_already_published", ui_language), len(already_published_df))

        with metric_pub_3:
            st.metric(t("publish_metric_selected_next", ui_language), len(selected_site_db_ids))

        st.write(f"#### {t('publish_confirm_heading', ui_language)}")

        confirm_publish_checked = st.checkbox(
            required_label(t("publish_confirm_checkbox", ui_language)),
            key="confirm_publish_checked",
        )

        publish_to_github_after_export = st.checkbox(
            t("publish_upload_after_export", ui_language),
            value=False,
            key="publish_to_github_after_export",
        )

        git_commit_message = st.text_input(
            t("publish_git_commit_message", ui_language),
            value=t("publish_default_commit_message", ui_language),
            key="git_commit_message",
        )

        with st.expander(t("publish_quick_remove_heading", ui_language), expanded=False):
            st.caption(t("publish_quick_remove_caption", ui_language))

            if already_published_df.empty:
                st.info(t("publish_no_published_to_remove", ui_language))
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
                    t("publish_sites_to_remove", ui_language),
                    options=list(published_remove_label_to_id.keys()),
                    key="quick_remove_published_site_labels",
                )

                selected_remove_site_db_ids = [
                    published_remove_label_to_id[label]
                    for label in selected_remove_labels
                ]

                confirm_quick_remove = st.checkbox(
                    t("publish_quick_remove_confirm", ui_language),
                    key="confirm_quick_remove_published_sites",
                )

                if st.button(
                    t("publish_quick_remove_button", ui_language),
                    key="quick_remove_published_sites_from_map",
                    type="secondary",
                ):
                    if not selected_remove_site_db_ids:
                        st.error(t("publish_quick_remove_select_error", ui_language))
                    elif not confirm_quick_remove:
                        st.error(t("publish_quick_remove_confirm_error", ui_language))
                    else:
                        keep_site_db_ids = [
                            int(row["site_db_id"])
                            for _, row in publish_df.iterrows()
                            if bool(row["is_already_published"])
                            and int(row["site_db_id"]) not in selected_remove_site_db_ids
                        ]

                        if not keep_site_db_ids:
                            st.error(t("publish_quick_remove_empty_error", ui_language))
                        else:
                            try:
                                result = publish_selected_sites_csv(keep_site_db_ids)

                                st.session_state.last_publish_live_path = str(result["live_path"])
                                st.session_state.last_publish_batch_path = str(result["batch_path"])

                                st.session_state.last_publish_sources_public_path = str(
                                    result.get("sources_public_path", "")
                                )

                                github_result = publish_files_to_github(
                                    live_path=str(result["live_path"]),
                                    batch_path=str(result["batch_path"]),
                                    commit_message=(
                                        git_commit_message.strip()
                                        or t("publish_quick_remove_commit_fallback", ui_language)
                                    ),
                                    extra_paths=[
                                        str(result["sources_public_path"]),
                                    ] if result.get("sources_public_path") else None,
                                )

                                st.session_state.last_git_publish_output = str(github_result["output"])
                                st.session_state.last_git_publish_message = str(github_result["message"])

                                if bool(github_result["ok"]):
                                    st.session_state.website_publish_ready_for_git = False
                                    set_flash_message(
                                        t("publish_quick_remove_success", ui_language),
                                        level="success",
                                    )
                                else:
                                    st.session_state.website_publish_ready_for_git = True
                                    set_flash_message(
                                        t(
                                            "publish_quick_remove_partial",
                                            ui_language,
                                            message=str(github_result["message"]),
                                        ),
                                        level="warning",
                                    )

                                set_next_active_page("Export / Publish")
                                st.rerun()

                            except Exception as exc:
                                st.error(
                                    t(
                                        "publish_quick_remove_failed",
                                        ui_language,
                                        error=str(exc),
                                    )
                                )

        publish_button_col, map_button_col = st.columns(
            [0.68, 0.32],
            vertical_alignment="top",
        )

        with publish_button_col:
            if st.button(
                t("publish_confirm_button", ui_language),
                type="primary",
                key="confirm_publish_to_website",
            ):
                if duplicate_site_ids:
                    st.error(t("publish_fix_duplicates_error", ui_language))
                elif not selected_site_db_ids:
                    st.error(t("publish_select_site_error", ui_language))
                elif not confirm_publish_checked:
                    st.error(t("publish_confirm_required_error", ui_language))
                else:
                    try:
                        result = publish_selected_sites_csv(selected_site_db_ids)
                        st.session_state.last_publish_live_path = str(result["live_path"])
                        st.session_state.last_publish_batch_path = str(result["batch_path"])

                        st.session_state.website_publish_ready_for_git = True

                        publish_message = t(
                            "publish_success_message",
                            ui_language,
                            rows=result["rows"],
                            live_file=display_app_path(result["live_path"]),
                            batch_name=result["batch_name"],
                        )

                        if publish_to_github_after_export:
                            github_result = publish_files_to_github(
                                live_path=str(result["live_path"]),
                                batch_path=str(result["batch_path"]),
                                commit_message=git_commit_message,
                                extra_paths=[
                                    str(result["sources_public_path"]),
                                ] if result.get("sources_public_path") else None,
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
                                    t(
                                        "publish_github_partial",
                                        ui_language,
                                        publish_message=publish_message,
                                        github_message=str(github_result["message"]),
                                    ),
                                    level="warning",
                                )
                        else:
                            set_flash_message(
                                t(
                                    "publish_ready_for_manual_upload",
                                    ui_language,
                                    publish_message=publish_message,
                                ),
                                level="success",
                            )

                        set_next_active_page("Export / Publish")
                        st.rerun()

                    except Exception as exc:
                        st.error(
                            t(
                                "publish_failed",
                                ui_language,
                                error=str(exc),
                            )
                        )

        with map_button_col:
            if MAP_WEBSITE_URL:
                st.link_button(
                    t("publish_open_public_map", ui_language),
                    MAP_WEBSITE_URL,
                    use_container_width=True,
                )
            else:
                st.info(t("publish_missing_map_url", ui_language))

            st.caption(t("publish_map_delay_caption", ui_language))

        st.divider()
        st.write(f"#### {t('publish_upload_latest_heading', ui_language)}")

        if st.session_state.last_git_publish_message:
            if st.session_state.website_publish_ready_for_git:
                st.warning(st.session_state.last_git_publish_message)
            else:
                st.success(st.session_state.last_git_publish_message)

        if st.session_state.last_git_publish_output:
            with st.expander(t("publish_show_last_git_output", ui_language), expanded=False):
                st.code(st.session_state.last_git_publish_output, language="text")

        if st.button(t("publish_check_github_config", ui_language), key="check_github_api_config"):
            st.session_state.git_status_preview = get_github_config_summary()

        if "git_status_preview" in st.session_state:
            with st.expander(t("publish_github_config_expander", ui_language), expanded=False):
                st.code(st.session_state.git_status_preview, language="text")

        manual_commit_disabled = not bool(st.session_state.website_publish_ready_for_git)

        if manual_commit_disabled:
            st.info(t("publish_manual_upload_disabled", ui_language))

        if st.button(
            t("publish_upload_latest_button", ui_language),
            key="upload_latest_publish_to_github",
            disabled=manual_commit_disabled,
        ):
            if not st.session_state.last_publish_live_path or not st.session_state.last_publish_batch_path:
                st.error(t("publish_no_latest_paths_error", ui_language))
            else:
                extra_paths = []

                if st.session_state.get("last_publish_sources_public_path"):
                    extra_paths.append(st.session_state.last_publish_sources_public_path)

                github_result = publish_files_to_github(
                    live_path=st.session_state.last_publish_live_path,
                    batch_path=st.session_state.last_publish_batch_path,
                    commit_message=git_commit_message,
                    extra_paths=extra_paths,
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
    st.subheader(t("settings_title", ui_language))
    st.caption(t("settings_caption", ui_language))

    st.write(f"#### {t('settings_section_paths', ui_language)}")
    if str(DB_PATH).upper() == "SUPABASE":
        st.write(f"{t('settings_database_backend', ui_language)}: `SUPABASE`")
    else:
        if str(DB_PATH).upper() == "SUPABASE":
            st.write(f"{t('settings_database_backend', ui_language)}: `SUPABASE`")
        else:
            st.write(f"{t('settings_database_backend', ui_language)}: `{t('settings_database_backend_sqlite', ui_language)}`")
            st.write(f"{t('settings_database_file', ui_language)}: `{display_app_path(DB_PATH)}`")

    st.write(f"{t('settings_source_pdf_folder', ui_language)}: `{SOURCE_PDF_RELATIVE_DIR}/`")

    st.write(f"#### {t('settings_section_app_controls', ui_language)}")

    if st.button(t("settings_button_refresh_app", ui_language)):
        st.rerun()

    st.divider()
    st.write(f"#### {t('settings_section_region_rules', ui_language)}")

    st.caption(t("settings_region_rules_caption", ui_language))

    current_region_settings = get_region_classification_settings()
    distance_settings = current_region_settings["distance_to_coast"]
    latitude_settings = current_region_settings["latitude_rules"]
    semantic_settings = current_region_settings["semantic_rules"]

    form_prefix = "region_rule_settings"

    with st.form("region_classification_settings_form"):
        st.write(f"##### {t('settings_distance_thresholds', ui_language)}")

        coast_col1, coast_col2, coast_col3 = st.columns(3)

        with coast_col1:
            st.number_input(
                t("settings_marine_threshold_km", ui_language),
                min_value=0.0,
                max_value=1000.0,
                value=float(distance_settings.get("marine_km", 1.0)),
                step=0.5,
                key=f"{form_prefix}_marine_km",
            )

        with coast_col2:
            st.number_input(
                t("settings_coastal_threshold_km", ui_language),
                min_value=0.0,
                max_value=1000.0,
                value=float(distance_settings.get("coastal_km", 10.0)),
                step=1.0,
                key=f"{form_prefix}_coastal_km",
            )

        with coast_col3:
            st.number_input(
                t("settings_near_coastal_threshold_km", ui_language),
                min_value=0.0,
                max_value=2000.0,
                value=float(distance_settings.get("near_coastal_km", 50.0)),
                step=5.0,
                key=f"{form_prefix}_near_coastal_km",
            )

        st.write(f"##### {t('settings_latitude_rules', ui_language)}")

        lat_col1, lat_col2, lat_col3, lat_col4 = st.columns(4)

        with lat_col1:
            st.number_input(
                t("settings_antarctic_latitude_max", ui_language),
                value=float(latitude_settings.get("antarctic_latitude_max", -60.0)),
                step=1.0,
                key=f"{form_prefix}_antarctic_latitude_max",
            )

        with lat_col2:
            st.number_input(
                t("settings_sub_antarctic_latitude_min", ui_language),
                value=float(latitude_settings.get("sub_antarctic_latitude_min", -60.0)),
                step=1.0,
                key=f"{form_prefix}_sub_antarctic_latitude_min",
            )

        with lat_col3:
            st.number_input(
                t("settings_sub_antarctic_latitude_max", ui_language),
                value=float(latitude_settings.get("sub_antarctic_latitude_max", -45.0)),
                step=1.0,
                key=f"{form_prefix}_sub_antarctic_latitude_max",
            )

        with lat_col4:
            st.number_input(
                t("settings_sub_arctic_latitude_min", ui_language),
                value=float(latitude_settings.get("sub_arctic_latitude_min", 60.0)),
                step=1.0,
                key=f"{form_prefix}_sub_arctic_latitude_min",
            )

        lat_col5, lat_col6, lat_col7, lat_col8 = st.columns(4)

        with lat_col5:
            st.number_input(
                t("settings_sub_arctic_latitude_max", ui_language),
                value=float(latitude_settings.get("sub_arctic_latitude_max", 66.5)),
                step=0.5,
                key=f"{form_prefix}_sub_arctic_latitude_max",
            )

        with lat_col6:
            st.number_input(
                t("settings_tropical_abs_latitude_max", ui_language),
                value=float(latitude_settings.get("tropical_abs_latitude_max", 23.5)),
                step=0.5,
                key=f"{form_prefix}_tropical_abs_latitude_max",
            )

        with lat_col7:
            st.number_input(
                t("settings_cold_abs_latitude_min", ui_language),
                value=float(latitude_settings.get("cold_abs_latitude_min", 50.0)),
                step=1.0,
                key=f"{form_prefix}_cold_abs_latitude_min",
            )

        with lat_col8:
            st.number_input(
                t("settings_extreme_cold_abs_latitude_min", ui_language),
                value=float(latitude_settings.get("extreme_cold_abs_latitude_min", 66.5)),
                step=0.5,
                key=f"{form_prefix}_extreme_cold_abs_latitude_min",
            )

        st.write(f"##### {t('settings_semantic_rules', ui_language)}")

        st.caption(t("settings_semantic_rules_caption", ui_language))

        sem_col1, sem_col2 = st.columns(2)

        with sem_col1:
            st.text_area(
                t("settings_island_country_hints", ui_language),
                value=list_to_lines(semantic_settings.get("island_country_hints", [])),
                height=180,
                key=f"{form_prefix}_island_country_hints",
            )

            st.text_area(
                t("settings_island_text_patterns", ui_language),
                value=list_to_lines(semantic_settings.get("island_text_patterns", [])),
                height=120,
                key=f"{form_prefix}_island_text_patterns",
            )

            st.text_area(
                t("settings_industrial_text_patterns", ui_language),
                value=list_to_lines(semantic_settings.get("industrial_patterns", [])),
                height=120,
                key=f"{form_prefix}_industrial_patterns",
            )

        with sem_col2:
            st.text_area(
                t("settings_urban_text_patterns", ui_language),
                value=list_to_lines(semantic_settings.get("urban_patterns", [])),
                height=120,
                key=f"{form_prefix}_urban_patterns",
            )

            st.text_area(
                t("settings_rural_text_patterns", ui_language),
                value=list_to_lines(semantic_settings.get("rural_patterns", [])),
                height=120,
                key=f"{form_prefix}_rural_patterns",
            )

            st.text_area(
                t("settings_hot_arid_text_patterns", ui_language),
                value=list_to_lines(semantic_settings.get("hot_arid_patterns", [])),
                height=120,
                key=f"{form_prefix}_hot_arid_patterns",
            )

        settings_form_col1, settings_form_col2 = st.columns([0.28, 0.72])

        with settings_form_col1:
            save_region_rules_clicked = st.form_submit_button(
                t("settings_save_region_rules", ui_language),
                use_container_width=True,
            )

        with settings_form_col2:
            reset_region_rules_clicked = st.form_submit_button(
                t("settings_reset_region_rules", ui_language),
                use_container_width=True,
            )

    if save_region_rules_clicked:
        new_settings = build_region_settings_from_form(
            current_settings=current_region_settings,
            form_prefix=form_prefix,
        )

        save_region_classification_settings(new_settings)
        set_flash_message(t("settings_region_rules_saved", ui_language))
        set_next_active_page("Settings")
        st.rerun()

    if reset_region_rules_clicked:
        save_region_classification_settings(get_default_region_classification_settings())
        st.session_state.pop("region_rules_existing_preview_df", None)
        set_flash_message(t("settings_region_rules_reset", ui_language))
        set_next_active_page("Settings")
        st.rerun()

    st.write(f"##### {t('settings_apply_rules_existing', ui_language)}")

    st.warning(t("settings_apply_rules_existing_warning", ui_language))

    preview_col1, preview_col2 = st.columns([0.28, 0.72])

    with preview_col1:
        preview_existing_mode = st.radio(
            t("settings_existing_preview_mode", ui_language),
            options=[
                "Only sites with empty region_category",
                "All sites, preserving manual tags outside replaced dimensions",
            ],
            key="region_rules_existing_preview_mode",
            format_func=lambda option: (
                t("settings_preview_mode_empty_only", ui_language)
                if option == "Only sites with empty region_category"
                else t("settings_preview_mode_all_sites", ui_language)
            ),
        )

    with preview_col2:
        if st.button(t("settings_preview_existing_sites", ui_language), key="preview_region_rules_existing_sites"):
            try:
                site_rows = get_table_rows("sites")
                overwrite_existing = (
                    preview_existing_mode
                    == "All sites, preserving manual tags outside replaced dimensions"
                )

                settings_to_preview = get_region_classification_settings()

                st.session_state["region_rules_existing_preview_df"] = (
                    build_region_classification_preview(
                        site_rows=site_rows,
                        settings=settings_to_preview,
                        overwrite_existing=overwrite_existing,
                    )
                )

                st.rerun()
            except Exception as exc:
                st.error(
                    t(
                        "settings_preview_build_error",
                        ui_language,
                        error=str(exc),
                    )
                )

    existing_preview_df = st.session_state.get("region_rules_existing_preview_df")

    if isinstance(existing_preview_df, pd.DataFrame) and not existing_preview_df.empty:
        edited_existing_preview_df = st.data_editor(
            existing_preview_df,
            hide_index=True,
            width="stretch",
            height=get_table_height(len(existing_preview_df), max_height=520),
            num_rows="fixed",
            key="region_rules_existing_preview_editor",
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
                    t("settings_editor_apply", ui_language),
                    help=t("settings_editor_apply_help", ui_language),
                    default=True,
                ),
                "id": None,
                "suggested_region_category": st.column_config.TextColumn(
                    t("settings_editor_suggested_region", ui_language),
                    help=t("settings_editor_suggested_region_help", ui_language),
                ),
            },
        )

        apply_preview_col1, apply_preview_col2, apply_preview_col3 = st.columns(
            [0.26, 0.26, 0.48],
            vertical_alignment="bottom",
        )

        with apply_preview_col1:
            apply_selected_existing = st.button(
                t("settings_apply_selected_preview_rows", ui_language),
                key="apply_region_rules_selected_existing",
                use_container_width=True,
            )

        with apply_preview_col2:
            clear_existing_preview = st.button(
                t("settings_clear_preview", ui_language),
                key="clear_region_rules_existing_preview",
                use_container_width=True,
            )

        with apply_preview_col3:
            confirm_existing_region_apply = st.checkbox(
                t("settings_confirm_existing_region_apply", ui_language),
                key="confirm_existing_region_rule_apply",
            )

        if apply_selected_existing:
            if not confirm_existing_region_apply:
                st.error(t("settings_confirm_existing_region_apply_error", ui_language))
            else:
                selected_preview_rows = edited_existing_preview_df[
                    edited_existing_preview_df["apply"].astype(bool)
                ]

                updated_count = 0

                for _, row in selected_preview_rows.iterrows():
                    suggested_value = str(row.get("suggested_region_category", "") or "").strip()

                    if not suggested_value:
                        continue

                    updated_count += update_table_row(
                        "sites",
                        int(row["id"]),
                        {"region_category": suggested_value},
                    )

                st.session_state.pop("region_rules_existing_preview_df", None)
                set_flash_message(
                    t(
                        "settings_existing_sites_updated",
                        ui_language,
                        count=updated_count,
                    )
                )
                set_next_active_page("Settings")
                st.rerun()

        if clear_existing_preview:
            st.session_state.pop("region_rules_existing_preview_df", None)
            st.rerun()

    elif isinstance(existing_preview_df, pd.DataFrame) and existing_preview_df.empty:
        st.info(t("settings_no_existing_sites_matched", ui_language))

    st.write(f"#### {t('settings_section_database_maintenance', ui_language)}")

    st.write(f"#### {t('settings_section_database_maintenance', ui_language)}")

    confirm_reset = st.checkbox(
        t("settings_confirm_database_reset", ui_language),
        key="confirm_database_reset",
    )

    if st.button(t("settings_button_initialize_reset_database", ui_language)):
        if not confirm_reset:
            st.error(t("settings_database_reset_confirm_error", ui_language))
        else:
            init_db()
            set_flash_message(t("settings_database_initialized", ui_language))
            st.rerun()