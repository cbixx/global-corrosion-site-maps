from __future__ import annotations

import re
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


def clean_cell(value) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


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
        "source_code": source_code.strip(),
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


def geocode_site(site_label: str, country: str) -> tuple[str, str, str]:
    site_label = clean_cell(site_label)
    country = clean_cell(country)

    query_parts = [part for part in [site_label, country] if part]
    query = ", ".join(query_parts)

    if not query:
        return "", "", "Cannot geocode: missing site label and country/location"

    try:
        geolocator: Any = Nominatim(user_agent="corrosion_map_curator_import")

        raw_result = geolocator.geocode(
            query,
            exactly_one=True,
            addressdetails=True,
            language="en",
            timeout=10,
        )

        if raw_result is None:
            return "", "", f"Geocoding failed for: {query}"

        result = cast(Location, raw_result)

        return str(result.latitude), str(result.longitude), ""

    except Exception as exc:
        return "", "", f"Geocoding error for {query}: {exc}"


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

    df.columns = [str(column).strip() for column in df.columns]

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
        raise ValueError(
            "The import CSV is missing required column(s): "
            + ", ".join(missing_required_columns)
            + ". Minimum recommended columns are: "
            "site_label, modern_country_location, administering_country, "
            "site_type, source_1, source_2, notes."
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
            geocoded_latitude, geocoded_longitude, geocode_warning = geocode_site(
                site_label=site_label,
                country=modern_country_location,
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