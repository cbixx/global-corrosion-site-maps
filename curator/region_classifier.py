from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any
import math
import re
import urllib.request
import zipfile


BASE_DIR = Path(__file__).resolve().parent
GEO_DATA_DIR = BASE_DIR / "geo_data" / "natural_earth"

COASTLINE_URL = "https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_coastline.zip"
LAND_URL = "https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_land.zip"

COASTLINE_SHP = GEO_DATA_DIR / "ne_10m_coastline.shp"
LAND_SHP = GEO_DATA_DIR / "ne_10m_land.shp"

COAST_TAGS = {"Marine", "Coastal", "Near-coastal", "Inland"}
SETTLEMENT_TAGS = {"Urban", "Rural"}
CLIMATE_TAGS = {"Tropical", "Hot-arid", "Temperate", "Cold", "Extreme cold"}
POLAR_TAGS = {"Sub-arctic", "Sub-Antarctic", "Antarctic"}

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

ISLAND_COUNTRY_HINTS = {
    "antigua and barbuda",
    "bahamas",
    "bahrain",
    "barbados",
    "cape verde",
    "comoros",
    "cuba",
    "cyprus",
    "dominica",
    "dominican republic",
    "fiji",
    "grenada",
    "haiti",
    "iceland",
    "indonesia",
    "ireland",
    "jamaica",
    "japan",
    "kiribati",
    "madagascar",
    "maldives",
    "malta",
    "mauritius",
    "micronesia",
    "new zealand",
    "palau",
    "papua new guinea",
    "philippines",
    "saint kitts and nevis",
    "saint lucia",
    "saint vincent and the grenadines",
    "samoa",
    "seychelles",
    "singapore",
    "solomon islands",
    "sri lanka",
    "taiwan",
    "tonga",
    "trinidad and tobago",
    "tuvalu",
    "united kingdom",
    "vanuatu",
}

ISLAND_TEXT_PATTERNS = [
    r"\bisland\b",
    r"\bislands\b",
    r"\bisle\b",
    r"\bisles\b",
    r"\barchipelago\b",
    r"\batoll\b",
]

URBAN_PATTERNS = [
    r"\bcity\b",
    r"\btown\b",
    r"\burban\b",
    r"\bmetropolitan\b",
    r"\bport city\b",
]

RURAL_PATTERNS = [
    r"\brural\b",
    r"\bvillage\b",
    r"\bfield site\b",
    r"\brural monitoring site\b",
]

INDUSTRIAL_PATTERNS = [
    r"\bindustrial\b",
    r"\bindustry\b",
    r"\bfactory\b",
    r"\brefinery\b",
    r"\bpower plant\b",
    r"\bsteelworks\b",
    r"\bsmelter\b",
]

HOT_ARID_PATTERNS = [
    r"\barid\b",
    r"\bdesert\b",
    r"\bsahara\b",
    r"\barabian desert\b",
    r"\bgobi\b",
]


@dataclass
class RegionClassification:
    region_category: str
    notes: str = ""


@dataclass
class _GeoData:
    coastline_geoms: list[Any]
    coastline_tree: Any
    land_geoms: list[Any]
    land_tree: Any


_GEO_DATA: _GeoData | None = None
_GEO_DATA_ERROR: str | None = None


def _split_tags(value: str | None) -> list[str]:
    if not value:
        return []

    text = str(value).replace(";", ",")
    return [part.strip() for part in text.split(",") if part.strip()]


def _ordered_tags(tags: list[str]) -> list[str]:
    unique_tags = list(dict.fromkeys([tag for tag in tags if tag]))
    return sorted(unique_tags, key=lambda tag: REGION_TAG_ORDER.get(tag, 999))


def _normalise_region(tags: list[str]) -> str:
    return ", ".join(_ordered_tags(tags))


def _text_blob(*values: str | None) -> str:
    return " ".join(str(value or "") for value in values).lower()


def _has_pattern(text: str, patterns: list[str]) -> bool:
    return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in patterns)


def _download_and_extract(url: str, expected_shp: Path) -> None:
    if expected_shp.exists():
        return

    GEO_DATA_DIR.mkdir(parents=True, exist_ok=True)

    zip_path = GEO_DATA_DIR / Path(url).name

    if not zip_path.exists():
        urllib.request.urlretrieve(url, zip_path)

    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        zip_ref.extractall(GEO_DATA_DIR)

    if not expected_shp.exists():
        raise FileNotFoundError(f"Expected shapefile was not found after extraction: {expected_shp}")


def _explode_geometries(geom: Any) -> list[Any]:
    geom_type = getattr(geom, "geom_type", "")

    if geom_type in {"LineString", "Polygon"}:
        return [geom]

    if geom_type in {"MultiLineString", "MultiPolygon", "GeometryCollection"}:
        parts = []
        for part in geom.geoms:
            if not part.is_empty:
                parts.extend(_explode_geometries(part))
        return parts

    return []


def _load_shapefile_geometries(shp_path: Path) -> list[Any]:
    import shapefile
    from shapely.geometry import shape

    reader = shapefile.Reader(str(shp_path))
    geometries: list[Any] = []

    for shp_record in reader.shapes():
        geo_interface = getattr(shp_record, "__geo_interface__", None)

        if geo_interface is None:
            continue

        geom = shape(geo_interface)

        if geom.is_empty:
            continue

        geometries.extend(_explode_geometries(geom))

    return geometries


def _resolve_tree_result(item: Any, geometries: list[Any]) -> Any:
    if hasattr(item, "geom_type"):
        return item

    return geometries[int(item)]


def _get_geo_data() -> _GeoData:
    global _GEO_DATA, _GEO_DATA_ERROR

    if _GEO_DATA is not None:
        return _GEO_DATA

    if _GEO_DATA_ERROR is not None:
        raise RuntimeError(_GEO_DATA_ERROR)

    try:
        from shapely.strtree import STRtree

        _download_and_extract(COASTLINE_URL, COASTLINE_SHP)
        _download_and_extract(LAND_URL, LAND_SHP)

        coastline_geoms = _load_shapefile_geometries(COASTLINE_SHP)
        land_geoms = _load_shapefile_geometries(LAND_SHP)

        if not coastline_geoms:
            raise RuntimeError("No coastline geometries were loaded.")

        if not land_geoms:
            raise RuntimeError("No land geometries were loaded.")

        _GEO_DATA = _GeoData(
            coastline_geoms=coastline_geoms,
            coastline_tree=STRtree(coastline_geoms),
            land_geoms=land_geoms,
            land_tree=STRtree(land_geoms),
        )

        return _GEO_DATA

    except Exception as exc:
        _GEO_DATA_ERROR = (
            "Natural Earth geospatial classifier is unavailable. "
            f"Reason: {exc}"
        )
        raise RuntimeError(_GEO_DATA_ERROR) from exc


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0088

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(d_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2.0) ** 2
    )

    return 2.0 * radius_km * math.asin(math.sqrt(a))


def _point_is_on_land(lat: float, lon: float, geo_data: _GeoData) -> bool:
    from shapely.geometry import Point

    point = Point(lon, lat)
    candidates = geo_data.land_tree.query(point)

    for candidate in candidates:
        geom = _resolve_tree_result(candidate, geo_data.land_geoms)

        if geom.contains(point) or geom.touches(point):
            return True

    return False


def _distance_to_nearest_coast_km(lat: float, lon: float, geo_data: _GeoData) -> float:
    from shapely.geometry import Point
    from shapely.ops import nearest_points

    point = Point(lon, lat)
    nearest_item = geo_data.coastline_tree.nearest(point)
    nearest_geom = _resolve_tree_result(nearest_item, geo_data.coastline_geoms)

    nearest_point_on_coast = nearest_points(point, nearest_geom)[1]

    return _haversine_km(
        lat,
        lon,
        float(nearest_point_on_coast.y),
        float(nearest_point_on_coast.x),
    )


def _classify_coastal_context(lat: float, lon: float, notes: list[str]) -> str | None:
    try:
        geo_data = _get_geo_data()
    except RuntimeError as exc:
        notes.append(str(exc))
        return None

    on_land = _point_is_on_land(lat, lon, geo_data)
    distance_km = _distance_to_nearest_coast_km(lat, lon, geo_data)

    notes.append(f"Nearest coastline distance ≈ {distance_km:.1f} km.")

    if not on_land:
        notes.append("Point appears offshore or outside the Natural Earth land polygon; classified as Marine.")
        return "Marine"

    if distance_km <= 1:
        return "Marine"

    if distance_km <= 10:
        return "Coastal"

    if distance_km <= 50:
        return "Near-coastal"

    return "Inland"


def _classify_island(
    text: str,
    modern_country_location: str | None,
) -> bool:
    country_text = str(modern_country_location or "").strip().lower()

    if _has_pattern(text, ISLAND_TEXT_PATTERNS):
        return True

    if country_text in ISLAND_COUNTRY_HINTS:
        return True

    return False


def _classify_settlement(text: str) -> str | None:
    if _has_pattern(text, URBAN_PATTERNS):
        return "Urban"

    if _has_pattern(text, RURAL_PATTERNS):
        return "Rural"

    return None


def _classify_industrial(text: str) -> bool:
    return _has_pattern(text, INDUSTRIAL_PATTERNS)


def _classify_polar_context(lat: float, text: str, island_detected: bool) -> list[str]:
    tags: list[str] = []

    if "sub-antarctic" in text or "subantarctic" in text:
        tags.append("Sub-Antarctic")
    elif -60 < lat <= -45 and island_detected:
        tags.append("Sub-Antarctic")

    if "antarctica" in text or lat <= -60:
        tags.append("Antarctic")

    if "sub-arctic" in text or "subarctic" in text:
        tags.append("Sub-arctic")
    elif 60 <= lat < 66.5:
        tags.append("Sub-arctic")

    return tags


def _classify_climate_context(lat: float, text: str) -> str:
    abs_lat = abs(lat)

    if _has_pattern(text, HOT_ARID_PATTERNS):
        return "Hot-arid"

    if lat <= -60 or abs_lat >= 66.5:
        return "Extreme cold"

    if abs_lat <= 23.5:
        return "Tropical"

    if abs_lat >= 50:
        return "Cold"

    return "Temperate"


def _merge_existing_and_inferred(
    existing_tags: list[str],
    inferred_tags: list[str],
) -> list[str]:
    inferred_set = set(inferred_tags)

    inferred_has_coast = bool(inferred_set & COAST_TAGS)
    inferred_has_settlement = bool(inferred_set & SETTLEMENT_TAGS)
    inferred_has_climate = bool(inferred_set & CLIMATE_TAGS)
    inferred_has_polar = bool(inferred_set & POLAR_TAGS)

    preserved_existing: list[str] = []

    for tag in existing_tags:
        if tag in COAST_TAGS and inferred_has_coast:
            continue

        if tag in SETTLEMENT_TAGS and inferred_has_settlement:
            continue

        if tag in CLIMATE_TAGS and inferred_has_climate:
            continue

        if tag in POLAR_TAGS and inferred_has_polar:
            continue

        preserved_existing.append(tag)

    return _ordered_tags([*preserved_existing, *inferred_tags])


def classify_region_category(
    latitude: Any,
    longitude: Any,
    current_region_category: str | None = "",
    modern_country_location: str | None = "",
    site_type: str | None = "",
) -> RegionClassification:
    """
    Coordinate-based region-category classifier.

    Current automatic dimensions:
    - Marine / Coastal / Near-coastal / Inland from Natural Earth coastline distance.
    - Island from conservative text/country hints.
    - Industrial from site/location text.
    - Urban / Rural from site-type/location text.
    - Sub-arctic / Sub-Antarctic / Antarctic from latitude and explicit text.
    - Tropical / Hot-arid / Temperate / Cold / Extreme cold from latitude/text heuristic.

    The result remains a suggestion. The Streamlit preview table should still be reviewed
    before applying to the database.
    """

    notes: list[str] = []
    existing_tags = _split_tags(current_region_category)

    try:
        lat = float(latitude)
        lon = float(longitude)
    except (TypeError, ValueError):
        return RegionClassification(
            region_category=_normalise_region(existing_tags),
            notes="Skipped: missing or invalid coordinates.",
        )

    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return RegionClassification(
            region_category=_normalise_region(existing_tags),
            notes="Skipped: coordinates outside valid latitude/longitude range.",
        )

    text = _text_blob(
        modern_country_location,
        site_type,
        current_region_category,
    )

    inferred_tags: list[str] = []

    coastal_context = _classify_coastal_context(lat, lon, notes)
    if coastal_context:
        inferred_tags.append(coastal_context)

    island_detected = _classify_island(
        text=text,
        modern_country_location=modern_country_location,
    )

    if island_detected:
        inferred_tags.append("Island")
        notes.append("Island flag inferred from location/site text or island-country hint.")

    if _classify_industrial(text):
        inferred_tags.append("Industrial")
        notes.append("Industrial flag inferred from site/location text.")

    settlement_context = _classify_settlement(text)
    if settlement_context:
        inferred_tags.append(settlement_context)
        notes.append(f"Settlement context inferred as {settlement_context} from site/location text.")

    polar_tags = _classify_polar_context(lat, text, island_detected)
    inferred_tags.extend(polar_tags)

    if polar_tags:
        notes.append("Polar/subpolar context inferred from latitude and/or explicit text.")

    climate_context = _classify_climate_context(lat, text)
    inferred_tags.append(climate_context)
    notes.append(f"Broad climate context suggested as {climate_context} using latitude/text heuristic.")

    final_tags = _merge_existing_and_inferred(existing_tags, inferred_tags)

    return RegionClassification(
        region_category=_normalise_region(final_tags),
        notes=" ".join(notes),
    )