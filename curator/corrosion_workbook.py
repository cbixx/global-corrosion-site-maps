from __future__ import annotations

from io import BytesIO
from typing import Any

import pandas as pd
from openpyxl import load_workbook

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Protection, Side
from openpyxl.utils import get_column_letter, quote_sheetname
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation


CORROSION_METRIC_OPTIONS = [
    "penetration_rate",
    "mass_loss_rate",
    "cumulative_penetration",
    "cumulative_mass_loss",
    "maximum_pit_depth",
    "net_mass_change",
    "MCI",
    "Al-ACI",
    "ICI",

    # Retained for compatibility with observations created
    # before the more specific metric structure was introduced.
    "corrosion_rate",
]


CORROSION_UNIT_RULES = [
    # metric, reported unit, canonical unit, multiplier

    # Penetration rate
    ("penetration_rate", "µm/year", "µm/year", 1.0),
    ("penetration_rate", "µm/a", "µm/year", 1.0),
    ("penetration_rate", "mm/year", "µm/year", 1000.0),
    ("penetration_rate", "mm/a", "µm/year", 1000.0),
    ("penetration_rate", "mpy", "µm/year", 25.4),
    ("penetration_rate", "mil/year", "µm/year", 25.4),

    # Legacy corrosion-rate records are treated as penetration rates
    # only when their unit is a penetration-rate unit.
    ("corrosion_rate", "µm/year", "µm/year", 1.0),
    ("corrosion_rate", "µm/a", "µm/year", 1.0),
    ("corrosion_rate", "mm/year", "µm/year", 1000.0),
    ("corrosion_rate", "mm/a", "µm/year", 1000.0),
    ("corrosion_rate", "mpy", "µm/year", 25.4),
    ("corrosion_rate", "mil/year", "µm/year", 25.4),

    # Mass-loss rate
    ("mass_loss_rate", "g/m²/year", "g/m²/year", 1.0),
    ("mass_loss_rate", "g/m²/a", "g/m²/year", 1.0),
    ("mass_loss_rate", "mg/m²/day", "g/m²/year", 0.365),
    ("mass_loss_rate", "mg/dm²/day", "g/m²/year", 36.5),
    ("mass_loss_rate", "g/dm²/month", "g/m²/year", 1200.0),
    ("mass_loss_rate", "g/dm²/year", "g/m²/year", 100.0),
    ("mass_loss_rate", "mg/cm²/day", "g/m²/year", 3650.0),

    # Cumulative penetration
    ("cumulative_penetration", "µm", "µm", 1.0),
    ("cumulative_penetration", "mm", "µm", 1000.0),
    ("cumulative_penetration", "mil", "µm", 25.4),

    # Maximum pit depth
    ("maximum_pit_depth", "µm", "µm", 1.0),
    ("maximum_pit_depth", "mm", "µm", 1000.0),
    ("maximum_pit_depth", "mil", "µm", 25.4),

    # Cumulative mass loss
    ("cumulative_mass_loss", "g/m²", "g/m²", 1.0),
    ("cumulative_mass_loss", "mg/m²", "g/m²", 0.001),
    ("cumulative_mass_loss", "g/dm²", "g/m²", 100.0),
    ("cumulative_mass_loss", "mg/dm²", "g/m²", 0.1),
    ("cumulative_mass_loss", "g/cm²", "g/m²", 10000.0),
    ("cumulative_mass_loss", "mg/cm²", "g/m²", 10.0),

    # Net mass change.
    # This can be normalized between mass/area units,
    # but must NOT be interpreted automatically as metal loss.
    ("net_mass_change", "g/m²", "g/m²", 1.0),
    ("net_mass_change", "mg/m²", "g/m²", 0.001),
    ("net_mass_change", "g/dm²", "g/m²", 100.0),
    ("net_mass_change", "mg/dm²", "g/m²", 0.1),
    ("net_mass_change", "g/cm²", "g/m²", 10000.0),
    ("net_mass_change", "mg/cm²", "g/m²", 10.0),

    # Corrosivity indices
    ("MCI", "%", "%", 1.0),
    ("MCI", "index", "index", 1.0),
    ("Al-ACI", "%", "%", 1.0),
    ("Al-ACI", "index", "index", 1.0),
    ("ICI", "%", "%", 1.0),
    ("ICI", "index", "index", 1.0),
]


DEFAULT_DENSITY_G_CM3 = {
    "Carbon steel": 7.85,
    "Mild steel": 7.85,
    "Low-alloy steel": 7.85,
    "Weathering steel": 7.85,
    "Copper-bearing steel": 7.85,

    "Iron": 7.87,
    "Ingot iron": 7.87,

    "Zinc": 7.14,
    "Copper": 8.96,

    "Aluminium": 2.70,
    "Aluminum": 2.70,

    "Lead": 11.34,
    "Nickel": 8.90,
    "Tin": 7.31,

    "Brass": 8.50,
    "Bronze": 8.80,
    "Magnesium": 1.74,
}


WORKBOOK_COLUMNS = [
    "source_code",
    "source_title",

    "site_id",
    "site_label",
    "country",

    "observation_id",

    "material",
    "exposure_period",
    "corrosion_metric",

    "reported_value",
    "reported_unit",

    "default_density_g_cm3",
    "density_override_g_cm3",
    "density_used_g_cm3",

    "normalized_value",
    "normalized_unit",

    "normalization_note",

    "notes",
]

WORKBOOK_INPUT_COLUMNS = [
    "source_code",
    "source_title",
    "site_id",
    "site_label",
    "country",
    "observation_id",
    "material",
    "exposure_period",
    "corrosion_metric",
    "reported_value",
    "reported_unit",
    "default_density_g_cm3",
    "density_override_g_cm3",
    "density_used_g_cm3",
    "normalized_value",
    "normalized_unit",
    "normalization_note",
    "notes",
]


CORROSION_ENTRY_REQUIRED_FIELDS = [
    "source_code",
    "site_id",
    "material",
    "exposure_period",
    "corrosion_metric",
    "reported_value",
    "reported_unit",
]


CORROSION_ENTRY_FIELDS = {
    "material",
    "exposure_period",
    "corrosion_metric",
    "reported_value",
    "reported_unit",
    "density_override_g_cm3",
    "notes",
}


def _clean_unique(values: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()

    for value in values:
        text = str(value or "").strip()

        if not text:
            continue

        key = text.casefold()

        if key in seen:
            continue

        seen.add(key)
        cleaned.append(text)

    return cleaned


def _safe_float(value: Any) -> float | None:
    if value in (None, ""):
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None

def _normalize_unit_text(value: Any) -> str:
    text = str(value or "").strip()

    replacements = {
        "μ": "µ",
        "²": "²",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    return text

def parse_exposure_years(
    exposure_period: str,
) -> float | None:
    """
    Convert a simple exposure-duration string to years.

    Examples:
        1 year      -> 1.0
        2 years     -> 2.0
        6 months    -> 0.5
        90 days     -> 90 / 365.25
        18 months   -> 1.5
        0.5 year    -> 0.5
        3 weeks     -> 21 / 365.25

    Ambiguous ranges or unrecognised text return None.
    """

    import re

    text = str(
        exposure_period or ""
    ).strip().lower()

    if not text:
        return None

    text = (
        text
        .replace("–", "-")
        .replace("—", "-")
    )

    # Do not guess ranges such as 1-2 years.
    if re.search(
        r"\d\s*-\s*\d",
        text,
    ):
        return None

    match = re.fullmatch(
        r"\s*"
        r"(\d+(?:\.\d+)?)"
        r"\s*"
        r"(years?|yrs?|yr|y|"
        r"months?|mos?|mo|"
        r"weeks?|wks?|wk|"
        r"days?|d)"
        r"\s*",
        text,
    )

    if match is None:
        return None

    value = float(
        match.group(1)
    )

    unit = match.group(2)

    if value <= 0:
        return None

    if unit in {
        "year",
        "years",
        "yr",
        "yrs",
        "y",
    }:
        return value

    if unit in {
        "month",
        "months",
        "mo",
        "mos",
    }:
        return value / 12.0

    if unit in {
        "week",
        "weeks",
        "wk",
        "wks",
    }:
        return (
            value * 7.0 / 365.25
        )

    if unit in {
        "day",
        "days",
        "d",
    }:
        return (
            value / 365.25
        )

    return None

def _get_unit_rule(
    metric: str,
    reported_unit: str,
) -> tuple[str, float] | None:

    clean_metric = str(metric or "").strip()
    clean_unit = _normalize_unit_text(
        reported_unit
    )

    for (
        rule_metric,
        rule_unit,
        canonical_unit,
        multiplier,
    ) in CORROSION_UNIT_RULES:

        if (
            rule_metric == clean_metric
            and _normalize_unit_text(
                rule_unit
            ) == clean_unit
        ):
            return (
                canonical_unit,
                float(multiplier),
            )

    return None


def get_default_density_g_cm3(
    material: str,
) -> float | None:

    clean_material = str(
        material or ""
    ).strip()

    if not clean_material:
        return None

    # Exact match first.
    if clean_material in DEFAULT_DENSITY_G_CM3:
        return float(
            DEFAULT_DENSITY_G_CM3[
                clean_material
            ]
        )

    # Case-insensitive fallback.
    material_key = clean_material.casefold()

    for (
        known_material,
        density,
    ) in DEFAULT_DENSITY_G_CM3.items():

        if (
            known_material.casefold()
            == material_key
        ):
            return float(density)

    return None


def normalize_corrosion_observation(
    *,
    material: str,
    exposure_period: str,
    corrosion_metric: str,
    reported_value: float,
    reported_unit: str,
    density_override_g_cm3: float | None = None,
) -> dict[str, Any]:
    """
    Convert a source-reported observation to the Atlas'
    comparable corrosion-rate quantity:

        normalized_value = corrosion penetration rate
        normalized_unit  = µm/year

    whenever that conversion is scientifically valid.

    The source-reported metric/value/unit remain unchanged.

    Non-comparable metrics such as MCI, Al-ACI, ICI,
    maximum pit depth and net mass change deliberately
    receive no normalized corrosion rate.
    """

    material = str(
        material or ""
    ).strip()

    exposure_period = str(
        exposure_period or ""
    ).strip()

    corrosion_metric = str(
        corrosion_metric or ""
    ).strip()

    reported_unit = (
        _normalize_unit_text(
            reported_unit
        )
    )

    reported_value = float(
        reported_value
    )

    if (
        corrosion_metric != "net_mass_change"
        and reported_value < 0
    ):
        raise ValueError(
            "Negative reported values are only accepted "
            "for net_mass_change."
        )

    default_density = (
        get_default_density_g_cm3(
            material
        )
    )

    density_override = (
        _safe_float(
            density_override_g_cm3
        )
    )

    if (
        density_override is not None
        and density_override <= 0
    ):
        raise ValueError(
            "density_override_g_cm3 must be greater than zero."
        )

    if density_override is not None:
        density_used = (
            density_override
        )
        density_basis = (
            "curator_override"
        )

    elif default_density is not None:
        density_used = (
            default_density
        )
        density_basis = (
            "default_material_density"
        )

    else:
        density_used = None
        density_basis = ""

    exposure_years = (
        parse_exposure_years(
            exposure_period
        )
    )

    normalized_value = None
    normalized_unit = ""

    normalization_note = ""

    # -----------------------------------------------------
    # 1. Penetration rate -> µm/year
    # -----------------------------------------------------

    if corrosion_metric in {
        "penetration_rate",
        "corrosion_rate",
    }:
        unit_rule = _get_unit_rule(
            corrosion_metric,
            reported_unit,
        )

        if unit_rule is None:
            raise ValueError(
                "Unsupported metric/unit combination: "
                f"{corrosion_metric} + {reported_unit}"
            )

        (
            canonical_unit,
            multiplier,
        ) = unit_rule

        if canonical_unit != "µm/year":
            raise ValueError(
                "Penetration-rate normalization must "
                "produce µm/year."
            )

        normalized_value = (
            reported_value
            * multiplier
        )

        normalized_unit = "µm/year"

        normalization_note = (
            "Converted reported penetration rate "
            "to µm/year."
        )

    # -----------------------------------------------------
    # 2. Mass-loss rate -> penetration rate
    # -----------------------------------------------------

    elif corrosion_metric == "mass_loss_rate":
        unit_rule = _get_unit_rule(
            corrosion_metric,
            reported_unit,
        )

        if unit_rule is None:
            raise ValueError(
                "Unsupported metric/unit combination: "
                f"{corrosion_metric} + {reported_unit}"
            )

        (
            canonical_unit,
            multiplier,
        ) = unit_rule

        mass_loss_g_m2_year = (
            reported_value
            * multiplier
        )

        if canonical_unit != "g/m²/year":
            raise ValueError(
                "Mass-loss-rate normalization must "
                "first produce g/m²/year."
            )

        if density_used is None:
            normalization_note = (
                "Mass-loss rate is convertible, but "
                "no valid material density is available."
            )

        else:
            # g/m²/year divided by g/cm³
            # numerically gives µm/year.
            normalized_value = (
                mass_loss_g_m2_year
                / density_used
            )

            normalized_unit = (
                "µm/year"
            )

            normalization_note = (
                "Converted mass-loss rate to "
                "penetration rate using density "
                f"{density_used:g} g/cm³."
            )

    # -----------------------------------------------------
    # 3. Cumulative penetration -> average µm/year
    # -----------------------------------------------------

    elif (
        corrosion_metric
        == "cumulative_penetration"
    ):
        unit_rule = _get_unit_rule(
            corrosion_metric,
            reported_unit,
        )

        if unit_rule is None:
            raise ValueError(
                "Unsupported metric/unit combination: "
                f"{corrosion_metric} + {reported_unit}"
            )

        (
            canonical_unit,
            multiplier,
        ) = unit_rule

        cumulative_um = (
            reported_value
            * multiplier
        )

        if canonical_unit != "µm":
            raise ValueError(
                "Cumulative penetration must first "
                "normalize to µm."
            )

        if exposure_years is None:
            normalization_note = (
                "Cumulative penetration cannot be "
                "converted to an average corrosion rate "
                "because the exposure duration could not "
                "be interpreted."
            )

        else:
            normalized_value = (
                cumulative_um
                / exposure_years
            )

            normalized_unit = (
                "µm/year"
            )

            normalization_note = (
                "Converted cumulative penetration to "
                "average corrosion penetration rate over "
                f"{exposure_years:g} year(s)."
            )

    # -----------------------------------------------------
    # 4. Cumulative mass loss -> average penetration rate
    # -----------------------------------------------------

    elif (
        corrosion_metric
        == "cumulative_mass_loss"
    ):
        unit_rule = _get_unit_rule(
            corrosion_metric,
            reported_unit,
        )

        if unit_rule is None:
            raise ValueError(
                "Unsupported metric/unit combination: "
                f"{corrosion_metric} + {reported_unit}"
            )

        (
            canonical_unit,
            multiplier,
        ) = unit_rule

        cumulative_mass_loss_g_m2 = (
            reported_value
            * multiplier
        )

        if canonical_unit != "g/m²":
            raise ValueError(
                "Cumulative mass loss must first "
                "normalize to g/m²."
            )

        if density_used is None:
            normalization_note = (
                "Cumulative mass loss cannot be converted "
                "to penetration rate because no valid "
                "material density is available."
            )

        elif exposure_years is None:
            normalization_note = (
                "Cumulative mass loss cannot be converted "
                "to penetration rate because the exposure "
                "duration could not be interpreted."
            )

        else:
            cumulative_penetration_um = (
                cumulative_mass_loss_g_m2
                / density_used
            )

            normalized_value = (
                cumulative_penetration_um
                / exposure_years
            )

            normalized_unit = (
                "µm/year"
            )

            normalization_note = (
                "Converted cumulative mass loss to "
                "average penetration rate using density "
                f"{density_used:g} g/cm³ over "
                f"{exposure_years:g} year(s)."
            )

    # -----------------------------------------------------
    # 5. Metrics intentionally NOT converted
    # -----------------------------------------------------

    elif corrosion_metric == "maximum_pit_depth":
        normalization_note = (
            "Maximum pit depth is preserved as a separate "
            "localized-corrosion metric and is not converted "
            "to general corrosion rate."
        )

    elif corrosion_metric == "net_mass_change":
        normalization_note = (
            "Net mass change is not treated as cleaned metal "
            "loss and cannot be converted to corrosion "
            "penetration rate."
        )

    elif corrosion_metric in {
        "MCI",
        "Al-ACI",
        "ICI",
    }:
        normalization_note = (
            f"{corrosion_metric} is a corrosivity index and "
            "cannot be converted to µm/year."
        )

    else:
        raise ValueError(
            "Unsupported corrosion metric: "
            f"{corrosion_metric}"
        )

    return {
        "normalized_value": (
            normalized_value
        ),

        "normalized_unit": (
            normalized_unit
        ),

        "default_density_g_cm3": (
            default_density
        ),

        "density_override_g_cm3": (
            density_override
        ),

        "density_g_cm3": (
            density_used
        ),

        "density_basis": (
            density_basis
        ),

        # These older fields are retained for database
        # compatibility, but the useful comparable quantity
        # is now normalized_value / normalized_unit.
        "derived_penetration_value": None,
        "derived_penetration_unit": "",

        "normalization_note": (
            normalization_note
        ),

        "exposure_years": (
            exposure_years
        ),
    }

def build_corrosion_entry_workbook(
    *,
    source_row: dict[str, Any],
    site_links: list[dict[str, Any]],
    site_lookup: dict[str, dict[str, Any]],
    existing_observations: list[dict[str, Any]],
    metal_options: list[str],
    exposure_options: list[str],
    blank_rows_per_site: int = 8,
) -> bytes:
    """
    Build a source-first Excel workbook for corrosion observation entry.

    Structure:
        source
            -> linked sites
                -> existing observations
                -> blank observation-entry rows

    Source and site values are repeated on every row intentionally.
    Merged cells are avoided because they make later Excel import fragile.
    """

    source_code = str(
        source_row.get("source_code", "") or ""
    ).strip()

    source_title = str(
        source_row.get("source_title", "") or ""
    ).strip()

    if not source_code:
        raise ValueError(
            "A source_code is required to generate a corrosion workbook."
        )

    blank_rows_per_site = max(
        1,
        min(int(blank_rows_per_site), 50),
    )

    # ---------------------------------------------------------
    # Identify unique sites linked to this source
    # ---------------------------------------------------------

    unique_links_by_site: dict[str, dict[str, Any]] = {}

    for link in site_links:
        site_id = str(
            link.get("site_id", "") or ""
        ).strip()

        if site_id and site_id not in unique_links_by_site:
            unique_links_by_site[site_id] = link

    if not unique_links_by_site:
        raise ValueError(
            f"Source {source_code} has no site-source links. "
            "Link the source to site(s) first."
        )

    # ---------------------------------------------------------
    # Group existing observations by site
    # ---------------------------------------------------------

    observations_by_site: dict[
        str,
        list[dict[str, Any]]
    ] = {}

    for observation in existing_observations:
        observation_source = str(
            observation.get("source_code", "") or ""
        ).strip().casefold()

        if observation_source != source_code.casefold():
            continue

        site_id = str(
            observation.get("site_id", "") or ""
        ).strip()

        # Observation worksheets are based on curated
        # site-source relationships.
        if site_id not in unique_links_by_site:
            continue

        observations_by_site.setdefault(
            site_id,
            [],
        ).append(observation)

    for site_observations in observations_by_site.values():
        site_observations.sort(
            key=lambda row: (
                str(
                    row.get("material", "") or ""
                ).casefold(),
                str(
                    row.get("exposure_period", "") or ""
                ).casefold(),
                str(
                    row.get("corrosion_metric", "") or ""
                ).casefold(),
                int(row.get("id", 0) or 0),
            )
        )

    # ---------------------------------------------------------
    # Dropdown lists
    # ---------------------------------------------------------

    metal_options = _clean_unique(
        list(metal_options)
        + [
            str(
                observation.get("material", "") or ""
            )
            for observation in existing_observations
        ]
        + list(DEFAULT_DENSITY_G_CM3.keys())
    )

    exposure_options = _clean_unique(
        list(exposure_options)
        + [
            str(
                observation.get(
                    "exposure_period",
                    "",
                ) or ""
            )
            for observation in existing_observations
        ]
    )

    metric_options = _clean_unique(
        CORROSION_METRIC_OPTIONS
        + [
            str(
                observation.get(
                    "corrosion_metric",
                    "",
                ) or ""
            )
            for observation in existing_observations
        ]
    )

    unit_options = _clean_unique(
        [
            unit
            for _, unit, _, _
            in CORROSION_UNIT_RULES
        ]
        + [
            str(
                observation.get("unit", "") or ""
            )
            for observation in existing_observations
        ]
    )

    # ---------------------------------------------------------
    # Workbook
    # ---------------------------------------------------------

    workbook = Workbook()

    sheet = workbook.active
    sheet.title = "Corrosion Observations"

    lists_sheet = workbook.create_sheet("Lists")

    # =========================================================
    # Hidden lookup sheet
    # =========================================================

    lists_sheet.append(
        [
            "metric_unit_key",
            "normalized_unit",
            "multiplier",
        ]
    )

    for (
        metric,
        unit,
        normalized_unit,
        multiplier,
    ) in CORROSION_UNIT_RULES:
        lists_sheet.append(
            [
                f"{metric}|{unit}",
                normalized_unit,
                multiplier,
            ]
        )

    unit_rule_end_row = lists_sheet.max_row

    # Density table

    density_start_row = 2

    lists_sheet["E1"] = "material"
    lists_sheet["F1"] = "density_g_cm3"

    for row_number, (
        material,
        density,
    ) in enumerate(
        DEFAULT_DENSITY_G_CM3.items(),
        start=density_start_row,
    ):
        lists_sheet.cell(
            row=row_number,
            column=5,
            value=material,
        )

        lists_sheet.cell(
            row=row_number,
            column=6,
            value=density,
        )

    density_end_row = (
        density_start_row
        + len(DEFAULT_DENSITY_G_CM3)
        - 1
    )

    # Metal dropdown

    lists_sheet["H1"] = "metal_options"

    for index, value in enumerate(
        metal_options,
        start=2,
    ):
        lists_sheet.cell(
            row=index,
            column=8,
            value=value,
        )

    metal_end_row = max(
        2,
        len(metal_options) + 1,
    )

    # Exposure dropdown

    lists_sheet["I1"] = "exposure_options"

    for index, value in enumerate(
        exposure_options,
        start=2,
    ):
        lists_sheet.cell(
            row=index,
            column=9,
            value=value,
        )

    exposure_end_row = max(
        2,
        len(exposure_options) + 1,
    )

    # Metric dropdown

    lists_sheet["J1"] = "metric_options"

    for index, value in enumerate(
        metric_options,
        start=2,
    ):
        lists_sheet.cell(
            row=index,
            column=10,
            value=value,
        )

    metric_end_row = max(
        2,
        len(metric_options) + 1,
    )

    # Unit dropdown

    lists_sheet["K1"] = "unit_options"

    for index, value in enumerate(
        unit_options,
        start=2,
    ):
        lists_sheet.cell(
            row=index,
            column=11,
            value=value,
        )

    unit_end_row = max(
        2,
        len(unit_options) + 1,
    )

    # Excel data validation does not reliably accept
    # direct references to a different worksheet.
    # Named ranges are therefore used.

    lists_ref = quote_sheetname(
        lists_sheet.title
    )

    workbook.defined_names.add(
        DefinedName(
            "CorrosionMetalOptions",
            attr_text=(
                f"{lists_ref}!$H$2:$H${metal_end_row}"
            ),
        )
    )

    workbook.defined_names.add(
        DefinedName(
            "CorrosionExposureOptions",
            attr_text=(
                f"{lists_ref}!$I$2:$I${exposure_end_row}"
            ),
        )
    )

    workbook.defined_names.add(
        DefinedName(
            "CorrosionMetricOptions",
            attr_text=(
                f"{lists_ref}!$J$2:$J${metric_end_row}"
            ),
        )
    )

    workbook.defined_names.add(
        DefinedName(
            "CorrosionUnitOptions",
            attr_text=(
                f"{lists_ref}!$K$2:$K${unit_end_row}"
            ),
        )
    )

    lists_sheet.sheet_state = "hidden"

    # =========================================================
    # Main observation sheet
    # =========================================================

    sheet.append(WORKBOOK_COLUMNS)

    header_fill = PatternFill(
        "solid",
        fgColor="17365D",
    )

    header_font = Font(
        color="FFFFFF",
        bold=True,
    )

    header_border = Border(
        bottom=Side(
            style="thin",
            color="FFFFFF",
        )
    )

    thin_gray = Side(
        style="thin",
        color="D9E1F2",
    )

    for cell in sheet[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(
            horizontal="center",
            vertical="center",
            wrap_text=True,
        )
        cell.border = header_border

    sheet.row_dimensions[1].height = 34

    # Freeze source/site identity columns as well as header.
    sheet.freeze_panes = "G2"

    sheet.auto_filter.ref = (
        f"A1:"
        f"{get_column_letter(len(WORKBOOK_COLUMNS))}"
        f"1"
    )

    # ---------------------------------------------------------
    # Header explanations
    # ---------------------------------------------------------

    header_comments = {
        "observation_id": (
            "Existing observations carry a database ID. "
            "Leave blank for new observations."
        ),

        "material": (
            "Choose a metal/material already known to "
            "the curator database."
        ),

        "exposure_period": (
            "Choose a known duration or type a custom "
            "duration if the source uses another value."
        ),

        "corrosion_metric": (
            "Select the physical quantity actually "
            "reported by the source."
        ),

        "reported_value": (
            "Enter the numerical value exactly as "
            "reported by the source."
        ),

        "reported_unit": (
            "Choose the unit actually reported by the "
            "source. Only approved units are accepted "
            "during import."
        ),

        "default_density_g_cm3": (
            "Automatically looked up from the material "
            "when a generic density is available."
        ),

        "density_override_g_cm3": (
            "Optional. Use only when a source-specific "
            "or alloy-specific density should replace "
            "the default."
        ),

        "density_used_g_cm3": (
            "Calculated from the override when supplied; "
            "otherwise from the default density."
        ),

        "normalized_value": (
            "Calculated workbook preview. The curator "
            "app will recalculate this during import."
        ),

        "derived_penetration_value": (
            "For mass-loss quantities only, calculated "
            "from normalized mass loss and density when "
            "density is available."
        ),

        "normalization_note": (
            "Workbook QA note. The curator app will "
            "independently validate and recalculate "
            "on upload."
        ),
    }

    for (
        column_name,
        comment_text,
    ) in header_comments.items():

        column_index = (
            WORKBOOK_COLUMNS.index(
                column_name
            )
            + 1
        )

        sheet.cell(
            row=1,
            column=column_index,
        ).comment = Comment(
            comment_text,
            "Corrosion Atlas",
        )

    # ---------------------------------------------------------
    # Source -> sites -> observations
    # ---------------------------------------------------------

    site_ids = sorted(
        unique_links_by_site.keys(),
        key=lambda site_id: (
            str(
                unique_links_by_site[
                    site_id
                ].get(
                    "site_label",
                    "",
                ) or ""
            ).casefold(),
            site_id.casefold(),
        ),
    )

    first_data_row = 2

    for site_id in site_ids:
        link = unique_links_by_site[
            site_id
        ]

        site = site_lookup.get(
            site_id,
            {},
        )

        site_label = str(
            site.get("site_label")
            or link.get("site_label")
            or ""
        ).strip()

        country = str(
            site.get(
                "modern_country_location",
                "",
            ) or ""
        ).strip()

        site_existing = (
            observations_by_site.get(
                site_id,
                [],
            )
        )

        rows_for_site: list[
            dict[str, Any]
        ] = []

        # Existing records first

        for observation in site_existing:
            rows_for_site.append(
                {
                    "source_code": source_code,
                    "source_title": source_title,

                    "site_id": site_id,
                    "site_label": site_label,
                    "country": country,

                    "observation_id": (
                        observation.get(
                            "id",
                            "",
                        )
                    ),

                    "material": (
                        observation.get(
                            "material",
                            "",
                        )
                    ),

                    "exposure_period": (
                        observation.get(
                            "exposure_period",
                            "",
                        )
                    ),

                    "corrosion_metric": (
                        observation.get(
                            "corrosion_metric",
                            "",
                        )
                    ),

                    "reported_value": (
                        _safe_float(
                            observation.get(
                                "value"
                            )
                        )
                    ),

                    "reported_unit": (
                        observation.get(
                            "unit",
                            "",
                        )
                    ),

                    "density_override_g_cm3": "",

                    "notes": (
                        observation.get(
                            "notes",
                            "",
                        )
                    ),
                }
            )

        # Blank rows for new records

        for _ in range(
            blank_rows_per_site
        ):
            rows_for_site.append(
                {
                    "source_code": source_code,
                    "source_title": source_title,

                    "site_id": site_id,
                    "site_label": site_label,
                    "country": country,

                    "observation_id": "",

                    "material": "",
                    "exposure_period": "",
                    "corrosion_metric": "",

                    "reported_value": "",
                    "reported_unit": "",

                    "density_override_g_cm3": "",

                    "notes": "",
                }
            )

        for record in rows_for_site:

            output_row = [
                record.get(
                    "source_code",
                    "",
                ),

                record.get(
                    "source_title",
                    "",
                ),

                record.get(
                    "site_id",
                    "",
                ),

                record.get(
                    "site_label",
                    "",
                ),

                record.get(
                    "country",
                    "",
                ),

                record.get(
                    "observation_id",
                    "",
                ),

                record.get(
                    "material",
                    "",
                ),

                record.get(
                    "exposure_period",
                    "",
                ),

                record.get(
                    "corrosion_metric",
                    "",
                ),

                record.get(
                    "reported_value",
                    "",
                ),

                record.get(
                    "reported_unit",
                    "",
                ),

                "",

                record.get(
                    "density_override_g_cm3",
                    "",
                ),

                "",

                "",

                "",

                "",

                "",

                "",

                record.get(
                    "notes",
                    "",
                ),
            ]

            sheet.append(output_row)

    last_data_row = sheet.max_row

    if last_data_row < first_data_row:
        raise ValueError(
            "No corrosion workbook rows "
            "were generated."
        )

    lists_name = quote_sheetname(
        lists_sheet.title
    )

    # =========================================================
    # Calculated columns
    # =========================================================

    for row_number in range(
        first_data_row,
        last_data_row + 1,
    ):

        material_cell = (
            f"G{row_number}"
        )

        metric_cell = (
            f"I{row_number}"
        )

        value_cell = (
            f"J{row_number}"
        )

        unit_cell = (
            f"K{row_number}"
        )

        default_density_cell = (
            f"L{row_number}"
        )

        density_override_cell = (
            f"M{row_number}"
        )

        density_used_cell = (
            f"N{row_number}"
        )

        normalized_value_cell = (
            f"O{row_number}"
        )

        normalized_unit_cell = (
            f"P{row_number}"
        )

        derived_value_cell = (
            f"Q{row_number}"
        )

        derived_unit_cell = (
            f"R{row_number}"
        )

        note_cell = (
            f"S{row_number}"
        )

        # Default density

        sheet[
            default_density_cell
        ] = (
            f'=IF('
            f'{material_cell}="",'
            f'"",'
            f'IFERROR('
            f'VLOOKUP('
            f'{material_cell},'
            f'{lists_name}!'
            f'$E${density_start_row}:'
            f'$F${density_end_row},'
            f'2,'
            f'FALSE'
            f'),'
            f'""'
            f')'
            f')'
        )

        # Density actually used

        sheet[
            density_used_cell
        ] = (
            f'=IF('
            f'{density_override_cell}<>"",'
            f'{density_override_cell},'
            f'{default_density_cell}'
            f')'
        )

        # Normalized value

        sheet[
            normalized_value_cell
        ] = (
            f'=IF('
            f'OR('
            f'{metric_cell}="",'
            f'{value_cell}="",'
            f'{unit_cell}=""'
            f'),'
            f'"",'
            f'IFERROR('
            f'{value_cell}*'
            f'VLOOKUP('
            f'{metric_cell}&"|"&{unit_cell},'
            f'{lists_name}!'
            f'$A$2:$C${unit_rule_end_row},'
            f'3,'
            f'FALSE'
            f'),'
            f'""'
            f')'
            f')'
        )

        # Normalized unit

        sheet[
            normalized_unit_cell
        ] = (
            f'=IF('
            f'OR('
            f'{metric_cell}="",'
            f'{unit_cell}=""'
            f'),'
            f'"",'
            f'IFERROR('
            f'VLOOKUP('
            f'{metric_cell}&"|"&{unit_cell},'
            f'{lists_name}!'
            f'$A$2:$C${unit_rule_end_row},'
            f'2,'
            f'FALSE'
            f'),'
            f'""'
            f')'
            f')'
        )

        # Derived penetration.
        #
        # Conveniently:
        #
        #     g/m² ÷ g/cm³ = µm
        #
        # after the area/length unit conversion,
        # so normalized mass loss divided by density
        # directly gives penetration in µm.

        sheet[
            derived_value_cell
        ] = (
            f'=IF('
            f'AND('
            f'{metric_cell}="mass_loss_rate",'
            f'{normalized_value_cell}<>"",'
            f'{density_used_cell}<>""'
            f'),'
            f'{normalized_value_cell}/'
            f'{density_used_cell},'
            f'IF('
            f'AND('
            f'{metric_cell}="cumulative_mass_loss",'
            f'{normalized_value_cell}<>"",'
            f'{density_used_cell}<>""'
            f'),'
            f'{normalized_value_cell}/'
            f'{density_used_cell},'
            f'""'
            f')'
            f')'
        )

        sheet[
            derived_unit_cell
        ] = (
            f'=IF('
            f'{derived_value_cell}="",'
            f'"",'
            f'IF('
            f'{metric_cell}="mass_loss_rate",'
            f'"µm/year",'
            f'IF('
            f'{metric_cell}="cumulative_mass_loss",'
            f'"µm",'
            f'""'
            f')'
            f')'
            f')'
        )

        # Human-readable QA note

        sheet[
            note_cell
        ] = (
            f'=IF('
            f'AND('
            f'{metric_cell}<>"",'
            f'{value_cell}<>"",'
            f'{unit_cell}<>"",'
            f'{normalized_value_cell}=""'
            f'),'
            f'"Unsupported metric/unit combination",'

            f'IF('
            f'AND('
            f'OR('
            f'{metric_cell}="mass_loss_rate",'
            f'{metric_cell}="cumulative_mass_loss"'
            f'),'
            f'{normalized_value_cell}<>"",'
            f'{density_used_cell}=""'
            f'),'
            f'"Mass loss normalized; penetration not '
            f'derived because density is unavailable",'

            f'IF('
            f'{derived_value_cell}<>"",'
            f'"Normalized from reported unit; '
            f'penetration derived using density "'
            f'&TEXT('
            f'{density_used_cell},'
            f'"0.###"'
            f')'
            f'&" g/cm³",'

            f'IF('
            f'{normalized_value_cell}<>"",'
            f'"Normalized from reported unit",'
            f'""'
            f')'
            f')'
            f')'
            f')'
        )

    # =========================================================
    # Data validation
    # =========================================================

    metal_validation = DataValidation(
        type="list",
        formula1="=CorrosionMetalOptions",
        allow_blank=True,
    )

    metal_validation.error = (
        "Choose a material from the curator list."
    )

    metal_validation.errorTitle = (
        "Invalid material"
    )

    metal_validation.showErrorMessage = True

    metal_validation.showInputMessage = True

    metal_validation.promptTitle = (
        "Material"
    )

    metal_validation.prompt = (
        "Choose a material already registered "
        "in the curator database."
    )

    # Exposure values can be manually overridden/customized.

    exposure_validation = DataValidation(
        type="list",
        formula1="=CorrosionExposureOptions",
        allow_blank=True,
    )

    exposure_validation.showErrorMessage = False

    exposure_validation.showInputMessage = True

    exposure_validation.promptTitle = (
        "Exposure duration"
    )

    exposure_validation.prompt = (
        "Choose a known duration or type a "
        "custom duration."
    )

    metric_validation = DataValidation(
        type="list",
        formula1="=CorrosionMetricOptions",
        allow_blank=True,
    )

    metric_validation.error = (
        "Choose an approved corrosion metric."
    )

    metric_validation.errorTitle = (
        "Invalid metric"
    )

    metric_validation.showErrorMessage = True

    unit_validation = DataValidation(
        type="list",
        formula1="=CorrosionUnitOptions",
        allow_blank=True,
    )

    unit_validation.error = (
        "Choose one of the approved reported units."
    )

    unit_validation.errorTitle = (
        "Invalid unit"
    )

    unit_validation.showErrorMessage = True

    numeric_value_validation = DataValidation(
        type="decimal",
        operator="between",
        formula1="-1E+100",
        formula2="1E+100",
        allow_blank=True,
    )

    numeric_value_validation.error = (
        "Enter a numerical reported value."
    )

    numeric_value_validation.errorTitle = (
        "Invalid number"
    )

    numeric_value_validation.showErrorMessage = True

    density_validation = DataValidation(
        type="decimal",
        operator="greaterThan",
        formula1="0",
        allow_blank=True,
    )

    density_validation.error = (
        "Density must be greater than zero."
    )

    density_validation.errorTitle = (
        "Invalid density"
    )

    density_validation.showErrorMessage = True

    for validation in [
        metal_validation,
        exposure_validation,
        metric_validation,
        unit_validation,
        numeric_value_validation,
        density_validation,
    ]:
        sheet.add_data_validation(
            validation
        )

    metal_validation.add(
        f"G{first_data_row}:"
        f"G{last_data_row}"
    )

    exposure_validation.add(
        f"H{first_data_row}:"
        f"H{last_data_row}"
    )

    metric_validation.add(
        f"I{first_data_row}:"
        f"I{last_data_row}"
    )

    numeric_value_validation.add(
        f"J{first_data_row}:"
        f"J{last_data_row}"
    )

    unit_validation.add(
        f"K{first_data_row}:"
        f"K{last_data_row}"
    )

    density_validation.add(
        f"M{first_data_row}:"
        f"M{last_data_row}"
    )

    # =========================================================
    # Formatting
    # =========================================================

    identity_fill = PatternFill(
        "solid",
        fgColor="EAF2F8",
    )

    entry_fill = PatternFill(
        "solid",
        fgColor="FFF2CC",
    )

    calculated_fill = PatternFill(
        "solid",
        fgColor="E7E6E6",
    )

    existing_fill = PatternFill(
        "solid",
        fgColor="E2F0D9",
    )

    warning_fill = PatternFill(
        "solid",
        fgColor="FCE4D6",
    )

    for row_number in range(
        first_data_row,
        last_data_row + 1,
    ):

        # Source/site/ID context

        for column_index in range(
            1,
            7,
        ):
            sheet.cell(
                row=row_number,
                column=column_index,
            ).fill = identity_fill

        # Human-entry fields

        for column_index in [
            7,   # material
            8,   # exposure
            9,   # metric
            10,  # reported value
            11,  # reported unit
            13,  # density override
            20,  # notes
        ]:
            sheet.cell(
                row=row_number,
                column=column_index,
            ).fill = entry_fill

        # Calculated columns

        for column_index in [
            12,
            14,
            15,
            16,
            17,
            18,
            19,
        ]:
            cell = sheet.cell(
                row=row_number,
                column=column_index,
            )

            cell.fill = calculated_fill

            cell.protection = Protection(
                locked=True
            )

        # Existing database rows are subtly green.

        observation_id = sheet.cell(
            row=row_number,
            column=6,
        ).value

        if observation_id not in (
            None,
            "",
        ):
            for column_index in range(
                1,
                len(WORKBOOK_COLUMNS) + 1,
            ):
                # Keep calculated fields grey.
                if column_index not in [
                    12,
                    14,
                    15,
                    16,
                    17,
                    18,
                    19,
                ]:
                    sheet.cell(
                        row=row_number,
                        column=column_index,
                    ).fill = existing_fill

        for column_index in range(
            1,
            len(WORKBOOK_COLUMNS) + 1,
        ):
            cell = sheet.cell(
                row=row_number,
                column=column_index,
            )

            cell.border = Border(
                bottom=thin_gray
            )

            cell.alignment = Alignment(
                vertical="top",
                wrap_text=(
                    column_index
                    in [
                        2,
                        4,
                        19,
                        20,
                    ]
                ),
            )

    # Unsupported metric/unit combinations become orange.

    sheet.conditional_formatting.add(
        f"S{first_data_row}:"
        f"S{last_data_row}",

        FormulaRule(
            formula=[
                f'ISNUMBER('
                f'SEARCH('
                f'"Unsupported",'
                f'S{first_data_row}'
                f')'
                f')'
            ],

            fill=warning_fill,
        ),
    )

    # Number display

    for row_number in range(
        first_data_row,
        last_data_row + 1,
    ):

        for column_index in [
            10,
            12,
            13,
            14,
            15,
            17,
        ]:
            sheet.cell(
                row=row_number,
                column=column_index,
            ).number_format = (
                "0.0000############"
            )

    # Column widths

    column_widths = {
        "A": 13,
        "B": 34,
        "C": 13,
        "D": 26,
        "E": 20,
        "F": 15,

        "G": 22,
        "H": 18,
        "I": 24,

        "J": 16,
        "K": 18,

        "L": 20,
        "M": 21,
        "N": 19,

        "O": 18,
        "P": 18,

        "Q": 25,
        "R": 23,

        "S": 52,
        "T": 42,
    }

    for (
        column_letter,
        width,
    ) in column_widths.items():

        sheet.column_dimensions[
            column_letter
        ].width = width

    sheet.sheet_view.showGridLines = False

    workbook.active = workbook.sheetnames.index(
        "Corrosion Observations"
    )

    output = BytesIO()

    workbook.save(output)

    return output.getvalue()

def read_corrosion_entry_workbook(
    uploaded_file,
) -> pd.DataFrame:
    """
    Read a curator-generated corrosion workbook.

    Calculated Excel columns are intentionally ignored.
    The app recalculates normalization itself.

    Completely blank observation rows are ignored.
    """

    uploaded_file.seek(0)

    workbook = load_workbook(
        uploaded_file,
        read_only=True,
        data_only=False,
    )

    if "Corrosion Observations" not in workbook.sheetnames:
        raise ValueError(
            "Workbook does not contain the required "
            "`Corrosion Observations` sheet."
        )

    sheet = workbook[
        "Corrosion Observations"
    ]

    raw_rows = list(
        sheet.iter_rows(
            values_only=True
        )
    )

    if not raw_rows:
        raise ValueError(
            "The corrosion workbook is empty."
        )

    headers = [
        str(value or "").strip()
        for value in raw_rows[0]
    ]

    missing_columns = [
        column
        for column in WORKBOOK_INPUT_COLUMNS
        if column not in headers
    ]

    if missing_columns:
        raise ValueError(
            "The workbook is missing required column(s): "
            + ", ".join(missing_columns)
        )

    row_records: list[
        dict[str, Any]
    ] = []

    for excel_row_number, values in enumerate(
        raw_rows[1:],
        start=2,
    ):
        raw_record = {
            headers[index]: (
                values[index]
                if index < len(values)
                else ""
            )
            for index in range(
                len(headers)
            )
        }

        # Ignore the workbook formula/calculation outputs.
        # Python will regenerate all of them.

        record = {
            "excel_row": excel_row_number,

            "source_code": str(
                raw_record.get(
                    "source_code",
                    "",
                ) or ""
            ).strip(),

            "source_title": str(
                raw_record.get(
                    "source_title",
                    "",
                ) or ""
            ).strip(),

            "site_id": str(
                raw_record.get(
                    "site_id",
                    "",
                ) or ""
            ).strip(),

            "site_label": str(
                raw_record.get(
                    "site_label",
                    "",
                ) or ""
            ).strip(),

            "country": str(
                raw_record.get(
                    "country",
                    "",
                ) or ""
            ).strip(),

            "observation_id": (
                raw_record.get(
                    "observation_id",
                    "",
                )
            ),

            "material": str(
                raw_record.get(
                    "material",
                    "",
                ) or ""
            ).strip(),

            "exposure_period": str(
                raw_record.get(
                    "exposure_period",
                    "",
                ) or ""
            ).strip(),

            "corrosion_metric": str(
                raw_record.get(
                    "corrosion_metric",
                    "",
                ) or ""
            ).strip(),

            "reported_value": (
                raw_record.get(
                    "reported_value",
                    "",
                )
            ),

            "reported_unit": (
                _normalize_unit_text(
                    raw_record.get(
                        "reported_unit",
                        "",
                    )
                )
            ),

            "density_override_g_cm3": (
                raw_record.get(
                    "density_override_g_cm3",
                    "",
                )
            ),

            "notes": str(
                raw_record.get(
                    "notes",
                    "",
                ) or ""
            ).strip(),
        }

        # A generated source/site row contains context even when
        # no observation has been entered. Determine whether any
        # observation-entry field is actually populated.

        observation_entry_values = [
            record.get(
                "observation_id",
                ""
            ),
            record.get(
                "material",
                ""
            ),
            record.get(
                "exposure_period",
                ""
            ),
            record.get(
                "corrosion_metric",
                ""
            ),
            record.get(
                "reported_value",
                ""
            ),
            record.get(
                "reported_unit",
                ""
            ),
            record.get(
                "density_override_g_cm3",
                ""
            ),
            record.get(
                "notes",
                ""
            ),
        ]

        has_observation_content = any(
            str(value or "").strip()
            for value
            in observation_entry_values
        )

        if not has_observation_content:
            continue

        row_records.append(
            record
        )

    return pd.DataFrame(
        row_records
    )

def validate_corrosion_workbook_rows(
    dataframe: pd.DataFrame,
    *,
    existing_site_ids: set[str],
    existing_source_codes: set[str],
    existing_site_source_pairs: set[
        tuple[str, str]
    ],
    existing_observations: list[
        dict[str, Any]
    ],
) -> pd.DataFrame:
    """
    Validate workbook rows before database import.

    This function does not write anything to the database.
    """

    if dataframe.empty:
        return dataframe.copy()

    preview_df = dataframe.copy()

    preview_columns = [
        "record_action",
        "validation_status",
        "validation_message",

        "normalized_value",
        "normalized_unit",

        "default_density_g_cm3",
        "density_used_g_cm3",
        "density_basis",

        "derived_penetration_value",
        "derived_penetration_unit",

        "normalization_note",
    ]

    for column in preview_columns:
        if column not in preview_df.columns:
            preview_df[column] = ""

    normalized_existing_sites = {
        str(value).strip().casefold()
        for value
        in existing_site_ids
        if str(value).strip()
    }

    normalized_existing_sources = {
        str(value).strip().casefold()
        for value
        in existing_source_codes
        if str(value).strip()
    }

    normalized_site_source_pairs = {
        (
            str(site_id).strip().casefold(),
            str(source_code).strip().casefold(),
        )
        for (
            site_id,
            source_code,
        )
        in existing_site_source_pairs
    }

    observations_by_id: dict[
        int,
        dict[str, Any]
    ] = {}

    for observation in existing_observations:
        try:
            observation_id = int(
                observation.get(
                    "id"
                )
            )
        except (
            TypeError,
            ValueError,
        ):
            continue

        observations_by_id[
            observation_id
        ] = observation

    for row_index, row in preview_df.iterrows():
        errors: list[str] = []

        site_id = str(
            row.get(
                "site_id",
                "",
            ) or ""
        ).strip()

        source_code = str(
            row.get(
                "source_code",
                "",
            ) or ""
        ).strip()

        material = str(
            row.get(
                "material",
                "",
            ) or ""
        ).strip()

        exposure_period = str(
            row.get(
                "exposure_period",
                "",
            ) or ""
        ).strip()

        corrosion_metric = str(
            row.get(
                "corrosion_metric",
                "",
            ) or ""
        ).strip()

        reported_unit = (
            _normalize_unit_text(
                row.get(
                    "reported_unit",
                    "",
                )
            )
        )

        observation_id_raw = (
            row.get(
                "observation_id",
                ""
            )
        )

        observation_id: int | None = None

        if str(
            observation_id_raw or ""
        ).strip():
            try:
                observation_id = int(
                    float(
                        observation_id_raw
                    )
                )
            except (
                TypeError,
                ValueError,
            ):
                errors.append(
                    "observation_id is not a valid integer."
                )

        # ---------------------------------------------
        # Required fields
        # ---------------------------------------------

        required_values = {
            "source_code": source_code,
            "site_id": site_id,
            "material": material,
            "exposure_period": exposure_period,
            "corrosion_metric": corrosion_metric,
            "reported_value": row.get(
                "reported_value",
                "",
            ),
            "reported_unit": reported_unit,
        }

        for (
            field_name,
            field_value,
        ) in required_values.items():

            if str(
                field_value
                if field_value is not None
                else ""
            ).strip() == "":
                errors.append(
                    f"{field_name} is required."
                )

        # ---------------------------------------------
        # Site / source / site-source provenance
        # ---------------------------------------------

        site_key = site_id.casefold()
        source_key = source_code.casefold()

        if (
            site_id
            and site_key
            not in normalized_existing_sites
        ):
            errors.append(
                f"site_id `{site_id}` does not exist."
            )

        if (
            source_code
            and source_key
            not in normalized_existing_sources
        ):
            errors.append(
                f"source_code `{source_code}` does not exist."
            )

        if (
            site_id
            and source_code
            and (
                site_key,
                source_key,
            )
            not in normalized_site_source_pairs
        ):
            errors.append(
                "The selected source is not linked to "
                f"site `{site_id}`."
            )

        # ---------------------------------------------
        # Existing observation ID protection
        # ---------------------------------------------

        if observation_id is not None:
            existing_observation = (
                observations_by_id.get(
                    observation_id
                )
            )

            if existing_observation is None:
                errors.append(
                    f"observation_id `{observation_id}` "
                    "does not exist."
                )

            else:
                existing_site = str(
                    existing_observation.get(
                        "site_id",
                        "",
                    ) or ""
                ).strip()

                existing_source = str(
                    existing_observation.get(
                        "source_code",
                        "",
                    ) or ""
                ).strip()

                if (
                    existing_site.casefold()
                    != site_key
                    or
                    existing_source.casefold()
                    != source_key
                ):
                    errors.append(
                        "observation_id does not belong "
                        "to this source/site pair."
                    )

            preview_df.at[
                row_index,
                "record_action",
            ] = "UPDATE"

        else:
            preview_df.at[
                row_index,
                "record_action",
            ] = "CREATE"

        # ---------------------------------------------
        # Metric
        # ---------------------------------------------

        if (
            corrosion_metric
            and corrosion_metric
            not in CORROSION_METRIC_OPTIONS
        ):
            errors.append(
                "Unsupported corrosion_metric: "
                f"`{corrosion_metric}`."
            )

        # ---------------------------------------------
        # Numerical value
        # ---------------------------------------------

        try:
            reported_value = float(
                row.get(
                    "reported_value"
                )
            )

        except (
            TypeError,
            ValueError,
        ):
            reported_value = None

            if str(
                row.get(
                    "reported_value",
                    "",
                ) or ""
            ).strip():
                errors.append(
                    "reported_value is not numeric."
                )

        # ---------------------------------------------
        # Density override
        # ---------------------------------------------

        density_override_raw = (
            row.get(
                "density_override_g_cm3",
                "",
            )
        )

        density_override = None

        if str(
            density_override_raw or ""
        ).strip():
            try:
                density_override = float(
                    density_override_raw
                )

                if density_override <= 0:
                    errors.append(
                        "density_override_g_cm3 must "
                        "be greater than zero."
                    )

            except (
                TypeError,
                ValueError,
            ):
                errors.append(
                    "density_override_g_cm3 is not numeric."
                )

        # ---------------------------------------------
        # Recalculate normalized values
        # ---------------------------------------------

        if (
            reported_value is not None
            and corrosion_metric
            and reported_unit
        ):
            try:
                normalized = (
                    normalize_corrosion_observation(
                        material=material,
                        exposure_period=(
                            exposure_period
                        ),
                        corrosion_metric=(
                            corrosion_metric
                        ),
                        reported_value=(
                            reported_value
                        ),
                        reported_unit=(
                            reported_unit
                        ),
                        density_override_g_cm3=(
                            density_override
                        ),
                    )
                )

                preview_df.at[
                    row_index,
                    "normalized_value",
                ] = normalized[
                    "normalized_value"
                ]

                preview_df.at[
                    row_index,
                    "normalized_unit",
                ] = normalized[
                    "normalized_unit"
                ]

                preview_df.at[
                    row_index,
                    "default_density_g_cm3",
                ] = (
                    normalized[
                        "default_density_g_cm3"
                    ]
                    if normalized[
                        "default_density_g_cm3"
                    ] is not None
                    else ""
                )

                preview_df.at[
                    row_index,
                    "density_used_g_cm3",
                ] = (
                    normalized[
                        "density_g_cm3"
                    ]
                    if normalized[
                        "density_g_cm3"
                    ] is not None
                    else ""
                )

                preview_df.at[
                    row_index,
                    "density_basis",
                ] = normalized[
                    "density_basis"
                ]

                preview_df.at[
                    row_index,
                    "derived_penetration_value",
                ] = (
                    normalized[
                        "derived_penetration_value"
                    ]
                    if normalized[
                        "derived_penetration_value"
                    ] is not None
                    else ""
                )

                preview_df.at[
                    row_index,
                    "derived_penetration_unit",
                ] = normalized[
                    "derived_penetration_unit"
                ]

                preview_df.at[
                    row_index,
                    "normalization_note",
                ] = normalized[
                    "normalization_note"
                ]

            except ValueError as exc:
                errors.append(
                    str(exc)
                )

        if errors:
            preview_df.at[
                row_index,
                "validation_status",
            ] = "ERROR"

            preview_df.at[
                row_index,
                "validation_message",
            ] = "; ".join(
                list(
                    dict.fromkeys(
                        errors
                    )
                )
            )

        else:
            preview_df.at[
                row_index,
                "validation_status",
            ] = "READY"

            preview_df.at[
                row_index,
                "validation_message",
            ] = ""

    return preview_df