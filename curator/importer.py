from __future__ import annotations

import re
import time
from pathlib import Path
from typing import Any, BinaryIO, Callable, cast

import pandas as pd
from geopy.geocoders import Nominatim
from geopy.location import Location


SOURCE_COLUMN_RE = re.compile(r"^source_\d+$", re.IGNORECASE)

EXPECTED_SITE_COLUMNS = [
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

GEOCODE_MIN_INTERVAL_SECONDS = 1.1
_GEOCODE_CACHE: dict[str, tuple[str, str, str]] = {}
_LAST_GEOCODE_REQUEST_TIME = 0.0
_OSM_SUGGESTION_CACHE: dict[str, list[dict[str, str]]] = {}

def clean_cell(value) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()

def normalize_import_column_name(column_name: str) -> str:
    text = clean_cell(column_name)

    # Remove invisible UTF-8 BOM and common wrapping characters.
    text = text.replace("\ufeff", "")
    text = text.strip().strip('"').strip("'")

    # Make matching case-insensitive and separator-insensitive.
    text = text.lower()
    text = re.sub(r"\s+", "_", text)
    text = re.sub(r"[-/]+", "_", text)
    text = re.sub(r"[^a-z0-9_]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")

    # Flexible source-column recognition:
    # source1, source_1, source 1, source-01 -> source_1
    source_match = re.fullmatch(r"source_?0*(\d+)", text)
    if source_match:
        return f"source_{int(source_match.group(1))}"

    aliases = {
        # Site label
        "site": "site_label",
        "site_name": "site_label",
        "site_label": "site_label",
        "station": "site_label",
        "station_name": "site_label",
        "exposure_site": "site_label",
        "exposure_site_name": "site_label",
        "location": "site_label",
        "location_name": "site_label",

        # Site ID
        "siteid": "site_id",
        "site_id": "site_id",
        "site_code": "site_id",
        "station_id": "site_id",
        "station_code": "site_id",

        # Site type
        "site_type": "site_type",
        "type": "site_type",
        "station_type": "site_type",
        "location_type": "site_type",

        # Coordinates
        "lat": "latitude",
        "latitude": "latitude",
        "y": "latitude",
        "lon": "longitude",
        "long": "longitude",
        "lng": "longitude",
        "longitude": "longitude",
        "x": "longitude",

        # Country/location
        "country": "modern_country_location",
        "modern_country": "modern_country_location",
        "modern_location": "modern_country_location",
        "modern_country_location": "modern_country_location",
        "country_location": "modern_country_location",
        "current_country": "modern_country_location",
        "current_location": "modern_country_location",
        "modern_country_or_location": "modern_country_location",

        # Administering country
        "admin_country": "administering_country",
        "administering_country": "administering_country",
        "administrating_country": "administering_country",
        "administrator_country": "administering_country",
        "administered_by": "administering_country",

        # Former entity
        "former_entity": "former_entity",
        "former_country": "former_entity",
        "former_state": "former_entity",
        "historical_entity": "former_entity",

        # Region
        "region": "region_category",
        "region_category": "region_category",
        "region_categories": "region_category",
        "environment": "region_category",
        "environment_type": "region_category",

        # Exposure/metal
        "duration": "exposure_period",
        "exposure_duration": "exposure_period",
        "exposure_period": "exposure_period",
        "exposure_time": "exposure_period",
        "period": "exposure_period",
        "metal": "metal",
        "metals": "metal",
        "material": "metal",
        "materials": "metal",

        # Geocoding helper
        "geocode": "geocode_query",
        "geocode_query": "geocode_query",
        "search_query": "geocode_query",
        "map_query": "geocode_query",
        "osm_query": "geocode_query",
        "openstreetmap_query": "geocode_query",

        # Notes
        "note": "notes",
        "notes": "notes",
        "remark": "notes",
        "remarks": "notes",
        "comment": "notes",
        "comments": "notes",
    }

    return aliases.get(text, text)

def detect_source_columns(columns: list[str]) -> list[str]:
    source_columns = [
        column for column in columns
        if SOURCE_COLUMN_RE.match(str(column).strip())
    ]

    def source_number(column_name: str) -> int:
        try:
            return int(column_name.split("_")[1])
        except Exception:
            return 9999

    return sorted(source_columns, key=source_number)


def parse_source_value(source_value: str) -> dict[str, str]:
    raw_value = clean_cell(source_value)

    if not raw_value:
        return {
            "source_code": "",
            "source_url": "",
            "local_file_name": "",
        }

    normalized = raw_value.replace("\\", "/")
    file_name = Path(normalized).name

    if file_name.lower().endswith(".pdf"):
        local_file_name = file_name
        source_code = Path(file_name).stem

        if normalized.startswith("http://") or normalized.startswith("https://"):
            source_url = normalized
        elif "/" in normalized:
            source_url = normalized
        else:
            source_url = f"source_pdfs/{file_name}"
    else:
        local_file_name = ""
        source_code = Path(normalized).stem or normalized
        source_url = normalized

    return {
        "source_code": source_code.strip().lower(),
        "source_url": source_url.strip(),
        "local_file_name": local_file_name.strip(),
    }


def parse_float_or_blank(value: str) -> tuple[str, str]:
    value = clean_cell(value)

    if not value:
        return "", ""

    try:
        parsed = float(value)
        return str(parsed), ""
    except ValueError:
        return value, f"Invalid numeric value: {value}"
    
BLOCKING_WARNING_PREFIXES = (
    "Missing",
    "Invalid",
    "Cannot geocode",
    "Geocoding failed",
    "Geocoding error",
    "Source code",
    "Source metadata missing",
)


def has_blocking_import_warning(warnings: list[str]) -> bool:
    return any(
        str(warning).startswith(BLOCKING_WARNING_PREFIXES)
        for warning in warnings
    )

def wait_for_geocode_rate_limit() -> None:
    global _LAST_GEOCODE_REQUEST_TIME

    elapsed = time.monotonic() - _LAST_GEOCODE_REQUEST_TIME

    if elapsed < GEOCODE_MIN_INTERVAL_SECONDS:
        time.sleep(GEOCODE_MIN_INTERVAL_SECONDS - elapsed)

    _LAST_GEOCODE_REQUEST_TIME = time.monotonic()


def make_osm_suggestion_label(result: Location) -> str:
    raw = getattr(result, "raw", {}) or {}
    address = raw.get("address", {}) or {}

    locality = (
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("municipality")
        or address.get("county")
        or address.get("suburb")
        or address.get("neighbourhood")
        or ""
    )

    state = address.get("state", "") or address.get("region", "")
    country = address.get("country", "")

    parts = [
        part.strip()
        for part in [locality, state, country]
        if str(part or "").strip()
    ]

    if parts:
        return ", ".join(dict.fromkeys(parts))

    return str(getattr(result, "address", "") or "").strip()


def search_osm_suggestions(
    query: str,
    limit: int = 5,
) -> list[dict[str, str]]:
    query = clean_cell(query)

    if not query:
        return []

    cache_key = f"{query.lower()}::{limit}"

    if cache_key in _OSM_SUGGESTION_CACHE:
        return _OSM_SUGGESTION_CACHE[cache_key]

    try:
        wait_for_geocode_rate_limit()

        geolocator: Any = Nominatim(user_agent="corrosion_map_curator_import")

        raw_results = geolocator.geocode(
            query,
            exactly_one=False,
            limit=limit,
            addressdetails=True,
            language="en",
            timeout=15,
        )

        if not raw_results:
            return []

        results = cast(list[Location], raw_results)

        suggestions: list[dict[str, str]] = []

        for result in results:
            suggestion_label = make_osm_suggestion_label(result)
            full_label = str(getattr(result, "address", "") or suggestion_label).strip()

            suggestions.append(
                {
                    "osm_suggestion": suggestion_label,
                    "osm_full_label": full_label,
                    "osm_suggestion_latitude": str(result.latitude),
                    "osm_suggestion_longitude": str(result.longitude),
                    "osm_query_used": query,
                }
            )

        _OSM_SUGGESTION_CACHE[cache_key] = suggestions
        return suggestions

    except Exception:
        return []

def geocode_site(
    site_label: str,
    country: str,
    geocode_query: str = "",
) -> tuple[str, str, str, dict[str, str]]:
    site_label = clean_cell(site_label)
    country = clean_cell(country)
    geocode_query = clean_cell(geocode_query)

    if not site_label and not country and not geocode_query:
        return "", "", "Cannot geocode: missing site label and country/location", {}

    query_candidates = []

    if geocode_query:
        query_candidates.append(geocode_query)

    if site_label and country:
        query_candidates.append(f"{site_label}, {country}")

    if site_label:
        query_candidates.append(site_label)

    query_candidates = list(dict.fromkeys(query_candidates))

    cache_key = " | ".join(query_candidates).lower()

    if cache_key in _GEOCODE_CACHE:
        cached_latitude, cached_longitude, cached_warning = _GEOCODE_CACHE[cache_key]
        return cached_latitude, cached_longitude, cached_warning, {}

    warning_messages: list[str] = []
    first_suggestion: dict[str, str] = {}

    for query in query_candidates:
        suggestions = search_osm_suggestions(query, limit=5)

        if suggestions and not first_suggestion:
            first_suggestion = suggestions[0]

        if suggestions:
            best = suggestions[0]
            latitude = best.get("osm_suggestion_latitude", "")
            longitude = best.get("osm_suggestion_longitude", "")

            if latitude and longitude:
                geocode_result = latitude, longitude, ""
                _GEOCODE_CACHE[cache_key] = geocode_result
                return latitude, longitude, "", best

        warning_messages.append(f"No result for: {query}")

    warning_text = "Geocoding failed: " + "; ".join(warning_messages)

    # Do not cache failed geocoding results. Temporary OSM failures should be retryable.
    return "", "", warning_text, first_suggestion


def read_uploaded_csv(uploaded_file: BinaryIO) -> pd.DataFrame:
    uploaded_file.seek(0)

    # sep=None lets pandas infer comma, tab, semicolon, etc.
    return pd.read_csv(
        uploaded_file,
        sep=None,
        engine="python",
        dtype=str,
        keep_default_na=False,
    )


def build_import_preview(
    uploaded_file: BinaryIO,
    existing_site_ids: set[str],
    existing_source_codes: set[str],
    existing_site_source_pairs: set[tuple[str, str]],
    default_programme: str = "",
    geocode_missing_coordinates: bool = False,
    source_metadata_by_code: dict[str, dict[str, str]] | None = None,
    site_id_generator: Callable[[str, str], str] | None = None,
    require_existing_source_metadata: bool = False,
) -> pd.DataFrame:
    df = read_uploaded_csv(uploaded_file)
    source_metadata_by_code = source_metadata_by_code or {}

    existing_source_codes = {
        str(source_code).strip().lower()
        for source_code in existing_source_codes
        if str(source_code).strip()
    }

    existing_site_source_pairs = {
        (
            str(site_id).strip(),
            str(source_code).strip().lower(),
        )
        for site_id, source_code in existing_site_source_pairs
    }

    source_metadata_by_code = {
        str(source_code).strip().lower(): metadata
        for source_code, metadata in source_metadata_by_code.items()
        if str(source_code).strip()
    }

    original_columns = [str(column) for column in df.columns]
    normalised_columns = [
        normalize_import_column_name(column)
        for column in original_columns
    ]

    df.columns = normalised_columns

    df = df.loc[
        :,
        [
            column for column in df.columns
            if column and not column.startswith("unnamed")
        ],
    ]

    source_columns = detect_source_columns(list(df.columns))

    minimal_required_columns = [
        "site_label",
        "modern_country_location",
    ]

    missing_required_columns = [
        column for column in minimal_required_columns
        if column not in df.columns
    ]

    if missing_required_columns:
        detected_columns = ", ".join(list(df.columns))

        raise ValueError(
            "The import CSV is missing required column(s): "
            + ", ".join(missing_required_columns)
            + ". Minimum recommended columns are: "
            "site_label, modern_country_location, administering_country, "
            "site_type, source_1, source_2, notes. "
            "Detected columns after normalisation: "
            + detected_columns
        )

    if not source_columns:
        raise ValueError(
            "The import CSV must contain at least one source column, "
            "for example source_1."
        )

    preview_rows: list[dict] = []

    for csv_row_number, (_, row) in enumerate(df.iterrows(), start=2):

        warnings: list[str] = []

        site_id = clean_cell(row.get("site_id", ""))
        site_label = clean_cell(row.get("site_label", ""))
        geocode_query = clean_cell(row.get("geocode_query", ""))
        osm_suggestion = {}
        site_type = clean_cell(row.get("site_type", ""))
        modern_country_location = clean_cell(row.get("modern_country_location", ""))
        administering_country = clean_cell(row.get("administering_country", ""))
        if not site_id and site_id_generator is not None:
            generated_site_id = site_id_generator(
                modern_country_location,
                administering_country,
            )

            if generated_site_id:
                site_id = generated_site_id
                warnings.append("Site ID filled automatically")
        former_entity = clean_cell(row.get("former_entity", ""))
        region_category = clean_cell(row.get("region_category", ""))
        exposure_period = clean_cell(row.get("exposure_period", ""))
        metal = clean_cell(row.get("metal", ""))
        notes = clean_cell(row.get("notes", ""))

        latitude, latitude_warning = parse_float_or_blank(row.get("latitude", ""))
        longitude, longitude_warning = parse_float_or_blank(row.get("longitude", ""))

        if latitude_warning:
            warnings.append(latitude_warning)

        if longitude_warning:
            warnings.append(longitude_warning)

        if (not latitude or not longitude) and geocode_missing_coordinates:
            geocoded_latitude, geocoded_longitude, geocode_warning, osm_suggestion = geocode_site(
                site_label=site_label,
                country=modern_country_location,
                geocode_query=geocode_query,
            )

            if geocoded_latitude and geocoded_longitude:
                latitude = latitude or geocoded_latitude
                longitude = longitude or geocoded_longitude
                warnings.append("Coordinates filled by geocoding")
            elif geocode_warning:
                warnings.append(geocode_warning)

        if not site_id:
            warnings.append("Missing site_id")

        if not site_label:
            warnings.append("Missing site_label")

        if not latitude:
            warnings.append("Missing latitude")

        if not longitude:
            warnings.append("Missing longitude")

        site_action = "update_site" if site_id in existing_site_ids else "new_site"

        parsed_sources = []
        seen_source_codes = set()

        for source_column in source_columns:
            parsed_source = parse_source_value(row.get(source_column, ""))

            source_code = parsed_source["source_code"]

            if not source_code:
                continue

            if source_code in seen_source_codes:
                continue

            seen_source_codes.add(source_code)

            parsed_sources.append(
                {
                    "source_column": source_column,
                    **parsed_source,
                }
            )

        if not parsed_sources:
            preview_rows.append(
                {
                    "import_selected": not has_blocking_import_warning(warnings),
                    "csv_row": csv_row_number,
                    "site_action": site_action,
                    "site_id": site_id,
                    "site_label": site_label,
                    "site_type": site_type,
                    "latitude": latitude,
                    "longitude": longitude,
                    "geocode_query": geocode_query,
                    "osm_suggestion": osm_suggestion.get("osm_suggestion", ""),
                    "osm_full_label": osm_suggestion.get("osm_full_label", ""),
                    "osm_suggestion_latitude": osm_suggestion.get("osm_suggestion_latitude", ""),
                    "osm_suggestion_longitude": osm_suggestion.get("osm_suggestion_longitude", ""),
                    "osm_query_used": osm_suggestion.get("osm_query_used", ""),
                    "modern_country_location": modern_country_location,
                    "administering_country": administering_country,
                    "former_entity": former_entity,
                    "region_category": region_category,
                    "source_column": "",
                    "source_action": "no_source",
                    "source_code": "",
                    "source_url": "",
                    "local_file_name": "",
                    "programme": "",
                    "metadata_source": "no_source",
                    "link_action": "no_link",
                    "link_metals": "",
                    "link_exposure_periods": "",
                    "notes": notes,
                    "warnings": "; ".join(warnings),
                }
            )
            continue

        for parsed_source in parsed_sources:
            source_code = parsed_source["source_code"]
            source_metadata = source_metadata_by_code.get(source_code, {})

            db_source_programme = clean_cell(source_metadata.get("programme", ""))
            db_source_metals = clean_cell(source_metadata.get("metals", ""))
            db_source_exposure_periods = clean_cell(
                source_metadata.get("exposure_periods", "")
            )

            effective_programme = db_source_programme or default_programme
            effective_link_metals = db_source_metals or metal
            effective_link_exposure_periods = db_source_exposure_periods or exposure_period

            if db_source_programme or db_source_metals or db_source_exposure_periods:
                metadata_source = "source_database"
            else:
                metadata_source = "csv_fallback"

            if require_existing_source_metadata:
                if source_code not in existing_source_codes:
                    warnings.append(
                        f"Source code {source_code} is not registered yet. "
                        "Register the source and assign programme/metal/exposure metadata before import."
                    )

                if not db_source_programme:
                    warnings.append(
                        f"Source metadata missing for {source_code}: programme"
                    )

                if not db_source_metals:
                    warnings.append(
                        f"Source metadata missing for {source_code}: metals"
                    )

                if not db_source_exposure_periods:
                    warnings.append(
                        f"Source metadata missing for {source_code}: exposure periods"
                    )
            source_action = (
                "existing_source"
                if source_code in existing_source_codes
                else "new_source"
            )

            pair = (site_id, source_code)
            link_action = (
                "existing_link"
                if pair in existing_site_source_pairs
                else "new_link"
            )

            preview_rows.append(
                {
                    "import_selected": not has_blocking_import_warning(warnings),
                    "csv_row": csv_row_number,
                    "site_action": site_action,
                    "site_id": site_id,
                    "site_label": site_label,
                    "site_type": site_type,
                    "latitude": latitude,
                    "longitude": longitude,
                    "geocode_query": geocode_query,
                    "osm_suggestion": osm_suggestion.get("osm_suggestion", ""),
                    "osm_full_label": osm_suggestion.get("osm_full_label", ""),
                    "osm_suggestion_latitude": osm_suggestion.get("osm_suggestion_latitude", ""),
                    "osm_suggestion_longitude": osm_suggestion.get("osm_suggestion_longitude", ""),
                    "osm_query_used": osm_suggestion.get("osm_query_used", ""),
                    "modern_country_location": modern_country_location,
                    "administering_country": administering_country,
                    "former_entity": former_entity,
                    "region_category": region_category,
                    "source_column": parsed_source["source_column"],
                    "source_action": source_action,
                    "source_code": source_code,
                    "source_url": parsed_source["source_url"],
                    "local_file_name": parsed_source["local_file_name"],
                    "programme": effective_programme,
                    "link_action": link_action,
                    "metadata_source": metadata_source,
                    "link_metals": effective_link_metals,
                    "link_exposure_periods": effective_link_exposure_periods,
                    "notes": notes,
                    "warnings": "; ".join(warnings),
                }
            )

    return pd.DataFrame(preview_rows)