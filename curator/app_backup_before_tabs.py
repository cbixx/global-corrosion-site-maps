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
    bulk_update_table_rows,
    delete_table_rows,
    ensure_schema_updates,
    get_connection,
    get_existing_source_codes,
    get_next_site_id_for_prefix,
    get_table_rows,
    init_db,
    insert_source,
    insert_site,
    table_counts,
    update_source_programme,
    update_table_row,
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
    "Others/independent"
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
    "Other / custom",
]


def normalize_metal_selection(selected_metals: list[str], custom_metal: str) -> str:
    metals = [metal for metal in selected_metals if metal != "Other / custom"]

    if "Other / custom" in selected_metals and custom_metal.strip():
        metals.append(custom_metal.strip())

    unique_metals = list(dict.fromkeys(metals))
    return ", ".join(unique_metals)


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


def build_row_label(row: dict, table_name: str) -> str:
    if table_name == "sites":
        return f"{row['id']} — {row.get('site_id', '')} — {row.get('site_label', '')}"

    if table_name == "sources":
        return f"{row['id']} — {row.get('source_code', '')} — {row.get('source_title', '') or row.get('local_file_name', '')}"

    return str(row["id"])

st.set_page_config(
    page_title="Corrosion Map Curator",
    layout="wide",
)

st.title("Corrosion Map Curator")
st.caption("Local curation app for managing sites, sources, and site-source links.")

if "location_results" not in st.session_state:
    st.session_state.location_results = []

if "selected_location_label" not in st.session_state:
    st.session_state.selected_location_label = None

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

st.write("### Database status")
st.write(f"Database file: `{Path(DB_PATH).resolve()}`")

try:
    ensure_schema_updates()
except Exception as exc:
    st.warning(f"Schema update check could not be completed: {exc}")

col1, col2 = st.columns([1, 1])

with col1:
    if st.button("Initialize / reset database"):
        init_db()
        st.success("Database initialized successfully.")

with col2:
    if st.button("Refresh counts"):
        st.rerun()

try:
    counts = table_counts()
    st.write("### Table counts")
    st.json(counts)
except Exception as exc:
    st.error(f"Could not read database counts: {exc}")
    st.stop()

st.write("### Register existing PDFs")

existing_pdf_files = list_source_pdf_files()
existing_source_codes = get_existing_source_codes()

missing_pdf_files = [
    pdf_path for pdf_path in existing_pdf_files
    if source_code_from_pdf_path(pdf_path) not in existing_source_codes
]

if not existing_pdf_files:
    st.info("No PDFs found in source_pdfs/.")
elif not missing_pdf_files:
    st.success("All PDFs in source_pdfs/ are already registered as sources.")
else:
    st.write(f"{len(missing_pdf_files)} unregistered PDF(s) found in `source_pdfs/`.")

    with st.expander("Preview unregistered PDFs"):
        for pdf_path in missing_pdf_files:
            st.write(f"- `{pdf_path.name}` → source code `{source_code_from_pdf_path(pdf_path)}`")

    default_programme_for_scan = st.selectbox(
        "Programme for registered PDFs",
        options=PROGRAMME_OPTIONS,
        key="register_existing_pdf_programme",
        help="This programme will be applied to all PDFs registered in this scan.",
    )

    custom_scan_programme = ""
    if default_programme_for_scan == "Other / custom":
        custom_scan_programme = st.text_input(
            "Custom programme for scanned PDFs",
            placeholder="Enter custom programme name",
        )

    scan_programme = resolve_option_value(
        default_programme_for_scan,
        custom_scan_programme,
    )

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

        st.success(f"Registered {registered_count} PDF source(s).")
        st.rerun()

st.write("### Add source")

with st.form("add_source_form", clear_on_submit=True):
    source_code = st.text_input("Source code", placeholder="e.g. s017")
    source_title = st.text_input("Source title", placeholder="Paper/report title")

    selected_programme = st.selectbox(
        "Source programme",
        options=PROGRAMME_OPTIONS,
        help="Classify the source by major corrosion exposure programme where applicable.",
    )

    custom_programme = ""
    if selected_programme == "Other / custom":
        custom_programme = st.text_input(
            "Custom programme",
            placeholder="Enter custom programme name",
        )

    source_programme = resolve_option_value(selected_programme, custom_programme)

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
                    local_file_name=local_file_name,
                    source_url=source_url,
                    notes=source_notes,
                )

                st.success(f"Source '{source_code.strip()}' added successfully.")
                st.rerun()

            except Exception as exc:
                st.error(f"Could not add source: {exc}")

st.write("### Update source programme")

try:
    with get_connection() as conn:
        source_rows = conn.execute(
            """
            select source_code, source_title, programme
            from sources
            order by source_code
            """
        ).fetchall()

    if source_rows:
        source_labels = [
            f"{row['source_code']} — {row['source_title'] or 'Untitled'}"
            for row in source_rows
        ]

        selected_source_label = st.selectbox(
            "Choose existing source",
            options=source_labels,
            key="update_source_programme_source",
        )

        selected_source_code = selected_source_label.split(" — ")[0]

        selected_existing_programme = st.selectbox(
            "New source programme",
            options=PROGRAMME_OPTIONS,
            key="update_source_programme_value",
        )

        custom_existing_programme = ""
        if selected_existing_programme == "Other / custom":
            custom_existing_programme = st.text_input(
                "Custom programme for existing source",
                placeholder="Enter custom programme name",
            )

        new_programme = resolve_option_value(
            selected_existing_programme,
            custom_existing_programme,
        )

        if st.button("Update programme"):
            update_source_programme(selected_source_code, new_programme)
            st.success(f"Updated programme for source '{selected_source_code}'.")
            st.rerun()
    else:
        st.info("No sources available yet. Add a source first.")

except Exception as exc:
    st.error(f"Could not load source programme updater: {exc}")

st.write("### Add site")
st.caption("Search a place first, choose a suggestion, then complete the site fields.")

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

prefill_latitude = ""
prefill_longitude = ""
prefill_country = ""

if selected_location:
    prefill_latitude = str(selected_location["latitude"])
    prefill_longitude = str(selected_location["longitude"])
    prefill_country = selected_location.get("country", "") or ""

with st.form("add_site_form", clear_on_submit=True):
    site_label = st.text_input(
        "Site label",
        placeholder="e.g. Berlin",
    )

    col1, col2, col3 = st.columns(3)

    with col1:
        selected_site_type = st.selectbox(
            "Site type",
            options=SITE_TYPE_OPTIONS,
        )

        custom_site_type = ""
        if selected_site_type == "Other / custom":
            custom_site_type = st.text_input(
                "Custom site type",
                placeholder="Enter custom site type",
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
    )

    site_id_prefix = build_site_id_prefix(
        modern_country_location=modern_country_location,
        administering_country=administering_country,
    )

    suggested_site_id = get_next_site_id_for_prefix(site_id_prefix)

    site_id = st.text_input(
        "Site ID",
        value=suggested_site_id,
        help=(
            "Automatically suggested from the country/location. "
            "For Antarctica, administering country is included when provided."
        ),
    )

    selected_former_entity = st.selectbox(
        "Former entity",
        options=FORMER_ENTITY_OPTIONS,
    )

    custom_former_entity = ""
    if selected_former_entity == "Other / custom":
        custom_former_entity = st.text_input(
            "Custom former entity",
            placeholder="Enter custom former entity",
        )

    former_entity = resolve_option_value(selected_former_entity, custom_former_entity)

    selected_region_tags = st.multiselect(
        "Region category tags",
        options=REGION_TAG_OPTIONS,
        help="Choose one or more tags. They will be combined into a normalized region category.",
    )

    region_category = normalize_region_category(selected_region_tags)

    if region_category:
        st.caption(f"Saved region category: {region_category}")

    exposure_period = st.text_input(
        "Exposure period",
        placeholder="e.g. 1987–1991 or 1 year",
    )

    metal = st.text_input(
        "Metal",
        placeholder="e.g. carbon steel, zinc, copper",
    )

    site_notes = st.text_area(
        "Site notes",
        placeholder="Optional notes about the site",
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
                st.success(f"Site '{site_label.strip()}' added successfully.")
                st.rerun()
            except ValueError:
                st.error("Latitude and longitude must be valid numbers.")
            except Exception as exc:
                st.error(f"Could not add site: {exc}")

st.write("### Manage records")

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
    else:
        editable_columns = [
            "source_code",
            "source_title",
            "programme",
            "local_file_name",
            "source_url",
            "notes",
        ]

    df_editor = df_original.copy()
    df_editor.insert(0, "delete", False)

    disabled_columns = [
        column for column in df_editor.columns
        if column not in editable_columns and column != "delete"
    ]

    st.caption(
        "Edit cells directly in the table, or tick Delete for records you want to remove. "
        "Nothing is changed in the database until you click a save/delete button."
    )

    edited_df = st.data_editor(
        df_editor,
        hide_index=True,
        use_container_width=True,
        disabled=disabled_columns,
        num_rows="fixed",
        key=f"data_editor_{manage_table}",
        column_config={
            "delete": st.column_config.CheckboxColumn(
                "Delete",
                help="Tick records to delete, then click Delete selected records.",
                default=False,
            )
        },
    )

    col_save, col_delete = st.columns([1, 1])

    with col_save:
        if st.button("Save table edits", key=f"save_edits_{manage_table}"):
            original_by_id = df_original.set_index("id")
            edited_by_id = edited_df.drop(columns=["delete"]).set_index("id")

            updated_rows = 0

            for row_id in edited_by_id.index:
                updates = {}

                for column in editable_columns:
                    if column not in edited_by_id.columns:
                        continue

                    old_value = clean_editor_value(original_by_id.loc[row_id, column])
                    new_value = clean_editor_value(edited_by_id.loc[row_id, column])

                    if str(old_value) != str(new_value):
                        updates[column] = new_value

                if updates:
                    updated_rows += update_table_row(
                        manage_table,
                        int(row_id),
                        updates,
                    )

            if updated_rows:
                st.success(f"Saved edits for {updated_rows} row(s).")
                st.rerun()
            else:
                st.info("No changes detected.")

    with col_delete:
        delete_ids = [
            int(row["id"])
            for _, row in edited_df.iterrows()
            if bool(row.get("delete"))
        ]

        if st.button("Delete selected records", key=f"delete_selected_{manage_table}"):
            if not delete_ids:
                st.error("Tick at least one record in the Delete column.")
            else:
                try:
                    deleted_count = delete_table_rows(manage_table, delete_ids)
                    st.success(f"Deleted {deleted_count} record(s) from `{manage_table}`.")
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
                st.success(f"Updated {changed_count} record(s).")
                st.rerun()
            except Exception as exc:
                st.error(f"Bulk edit failed: {exc}")

st.write("### Notes")
st.markdown(
    """
- This is the first minimal version of the curator app.
- The website frontend is still separate and remains HTML/JavaScript.
- Later, this app will gain:
  - site entry/edit forms
  - source entry/edit forms
  - batch import
  - export to website-ready JSON
"""
)