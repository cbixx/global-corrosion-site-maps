from __future__ import annotations

from dataclasses import dataclass
import math


@dataclass
class RegionClassification:
    region_category: str
    notes: str = ""


def classify_region_category(
    latitude: float | str | None,
    longitude: float | str | None,
    current_region_category: str | None = "",
    modern_country_location: str | None = "",
    site_type: str | None = "",
) -> RegionClassification:
    """
    Conservative first-stage region classifier.

    This does not yet calculate true coastline distance. It gives safe
    rule-based suggestions from existing fields and valid coordinates.
    Later, this function can be upgraded with Natural Earth coastline,
    OSM industrial checks, and GHSL urban/rural classification.
    """

    try:
        lat = float(latitude)
        lon = float(longitude)
    except (TypeError, ValueError):
        return RegionClassification(
            region_category=current_region_category or "",
            notes="Skipped: missing or invalid coordinates.",
        )

    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return RegionClassification(
            region_category=current_region_category or "",
            notes="Skipped: coordinates outside valid latitude/longitude range.",
        )

    tags: list[str] = []

    country_text = str(modern_country_location or "").lower()
    site_type_text = str(site_type or "").lower()

    if "island" in country_text or "island" in site_type_text:
        tags.append("Island")

    if "antarctic" in country_text or "antarctic" in site_type_text:
        tags.append("Sub-Antarctic")

    if "port" in site_type_text or "cape" in site_type_text:
        tags.append("Coastal")

    if "industrial" in site_type_text:
        tags.append("Industrial")

    if "city" in site_type_text or "town" in site_type_text:
        tags.append("Urban")

    if "rural" in site_type_text or "village" in site_type_text:
        tags.append("Rural")

    if not tags:
        existing = str(current_region_category or "").strip()
        if existing:
            return RegionClassification(
                region_category=existing,
                notes="Kept existing value. Coordinates are valid, but no rule-based category was inferred.",
            )

        return RegionClassification(
            region_category="Unclassified",
            notes="Coordinates are valid. No rule-based category inferred yet.",
        )

    # Remove duplicates while preserving order.
    unique_tags = list(dict.fromkeys(tags))

    return RegionClassification(
        region_category=", ".join(unique_tags),
        notes="Rule-based preliminary assignment from site type/location text. Not yet coastline-distance based.",
    )