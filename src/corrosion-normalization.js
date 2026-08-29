export const CORROSION_METRIC_OPTIONS = [
  "penetration_rate",
  "mass_loss_rate",
  "cumulative_penetration",
  "cumulative_mass_loss",
  "maximum_pit_depth",
  "net_mass_change",
  "MCI",
  "Al-ACI",
  "ICI",
  "corrosion_rate",
];


export const CORROSION_UNIT_RULES = [
  ["penetration_rate", "µm/year", "µm/year", 1.0],
  ["penetration_rate", "µm/a", "µm/year", 1.0],
  ["penetration_rate", "mm/year", "µm/year", 1000.0],
  ["penetration_rate", "mm/a", "µm/year", 1000.0],
  ["penetration_rate", "mpy", "µm/year", 25.4],
  ["penetration_rate", "mil/year", "µm/year", 25.4],

  ["corrosion_rate", "µm/year", "µm/year", 1.0],
  ["corrosion_rate", "µm/a", "µm/year", 1.0],
  ["corrosion_rate", "mm/year", "µm/year", 1000.0],
  ["corrosion_rate", "mm/a", "µm/year", 1000.0],
  ["corrosion_rate", "mpy", "µm/year", 25.4],
  ["corrosion_rate", "mil/year", "µm/year", 25.4],

  ["mass_loss_rate", "g/m²/year", "g/m²/year", 1.0],
  ["mass_loss_rate", "g/m²/a", "g/m²/year", 1.0],
  ["mass_loss_rate", "g/m²·a", "g/m²/year", 1.0],
  ["mass_loss_rate", "g/m².a", "g/m²/year", 1.0],
  ["mass_loss_rate", "g/m2/a", "g/m²/year", 1.0],
  ["mass_loss_rate", "g/m2.a", "g/m²/year", 1.0],
  ["mass_loss_rate", "mg/m²/day", "g/m²/year", 0.365],
  ["mass_loss_rate", "mg/dm²/day", "g/m²/year", 36.5],
  ["mass_loss_rate", "g/dm²/month", "g/m²/year", 1200.0],
  ["mass_loss_rate", "g/dm²/year", "g/m²/year", 100.0],
  ["mass_loss_rate", "mg/cm²/day", "g/m²/year", 3650.0],

  ["cumulative_penetration", "µm", "µm", 1.0],
  ["cumulative_penetration", "mm", "µm", 1000.0],
  ["cumulative_penetration", "mil", "µm", 25.4],

  ["maximum_pit_depth", "µm", "µm", 1.0],
  ["maximum_pit_depth", "mm", "µm", 1000.0],
  ["maximum_pit_depth", "mil", "µm", 25.4],

  ["cumulative_mass_loss", "g/m²", "g/m²", 1.0],
  ["cumulative_mass_loss", "mg/m²", "g/m²", 0.001],
  ["cumulative_mass_loss", "g/dm²", "g/m²", 100.0],
  ["cumulative_mass_loss", "mg/dm²", "g/m²", 0.1],
  ["cumulative_mass_loss", "g/cm²", "g/m²", 10000.0],
  ["cumulative_mass_loss", "mg/cm²", "g/m²", 10.0],

  ["net_mass_change", "g/m²", "g/m²", 1.0],
  ["net_mass_change", "mg/m²", "g/m²", 0.001],
  ["net_mass_change", "g/dm²", "g/m²", 100.0],
  ["net_mass_change", "mg/dm²", "g/m²", 0.1],
  ["net_mass_change", "g/cm²", "g/m²", 10000.0],
  ["net_mass_change", "mg/cm²", "g/m²", 10.0],

  ["MCI", "%", "%", 1.0],
  ["MCI", "index", "index", 1.0],
  ["Al-ACI", "%", "%", 1.0],
  ["Al-ACI", "index", "index", 1.0],
  ["ICI", "%", "%", 1.0],
  ["ICI", "index", "index", 1.0],
];


export const DEFAULT_DENSITY_G_CM3 = {
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
};


export function normalizeUnitText(
  value
) {
  return String(
    value ?? ""
  )
    .trim()
    .replaceAll(
      "μ",
      "µ"
    );
}


export function parseExposureYears(
  exposurePeriod
) {
  let text =
    String(
      exposurePeriod ?? ""
    )
      .trim()
      .toLowerCase();

  if (!text) {
    return null;
  }


  text =
    text
      .replaceAll("–", "-")
      .replaceAll("—", "-");


  if (
    /\d\s*-\s*\d/.test(
      text
    )
  ) {
    return null;
  }


  const match =
    text.match(
      /^\s*(\d+(?:\.\d+)?)\s*(years?|yrs?|yr|y|months?|mos?|mo|weeks?|wks?|wk|days?|d)\s*$/
    );


  if (!match) {
    return null;
  }


  const value =
    Number(
      match[1]
    );

  const unit =
    match[2];


  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }


  if (
    [
      "year",
      "years",
      "yr",
      "yrs",
      "y",
    ].includes(unit)
  ) {
    return value;
  }


  if (
    [
      "month",
      "months",
      "mo",
      "mos",
    ].includes(unit)
  ) {
    return value / 12;
  }


  if (
    [
      "week",
      "weeks",
      "wk",
      "wks",
    ].includes(unit)
  ) {
    return value * 7 / 365.25;
  }


  if (
    [
      "day",
      "days",
      "d",
    ].includes(unit)
  ) {
    return value / 365.25;
  }


  return null;
}


function isLeapYear(
  year
) {
  return (
    year % 4 === 0 &&
    (
      year % 100 !== 0 ||
      year % 400 === 0
    )
  );
}


export function isValidPartialIsoDate(
  value
) {
  const text =
    String(
      value ?? ""
    ).trim();


  if (!text) {
    return true;
  }


  const match =
    text.match(
      /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/
    );


  if (!match) {
    return false;
  }


  const year =
    Number(
      match[1]
    );


  if (
    year < 1 ||
    year > 9999
  ) {
    return false;
  }


  if (!match[2]) {
    return true;
  }


  const month =
    Number(
      match[2]
    );


  if (
    month < 1 ||
    month > 12
  ) {
    return false;
  }


  if (!match[3]) {
    return true;
  }


  const day =
    Number(
      match[3]
    );


  const daysPerMonth = [
    31,
    isLeapYear(year)
      ? 29
      : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];


  return (
    day >= 1 &&
    day <=
      daysPerMonth[
        month - 1
      ]
  );
}


export function getDefaultDensityGcm3(
  material
) {
  const clean =
    String(
      material ?? ""
    ).trim();


  if (!clean) {
    return null;
  }


  if (
    Object.hasOwn(
      DEFAULT_DENSITY_G_CM3,
      clean
    )
  ) {
    return Number(
      DEFAULT_DENSITY_G_CM3[
        clean
      ]
    );
  }


  const key =
    clean.toLocaleLowerCase();


  for (
    const [
      knownMaterial,
      density,
    ]
    of Object.entries(
      DEFAULT_DENSITY_G_CM3
    )
  ) {
    if (
      knownMaterial
        .toLocaleLowerCase() ===
      key
    ) {
      return Number(
        density
      );
    }
  }


  return null;
}


function getUnitRule(
  metric,
  reportedUnit
) {
  const cleanMetric =
    String(
      metric ?? ""
    ).trim();

  const cleanUnit =
    normalizeUnitText(
      reportedUnit
    );


  for (
    const [
      ruleMetric,
      ruleUnit,
      canonicalUnit,
      multiplier,
    ]
    of CORROSION_UNIT_RULES
  ) {
    if (
      ruleMetric ===
        cleanMetric &&
      normalizeUnitText(
        ruleUnit
      ) === cleanUnit
    ) {
      return {
        canonicalUnit,
        multiplier:
          Number(
            multiplier
          ),
      };
    }
  }


  return null;
}


function displayNumber(
  value
) {
  return Number(value)
    .toString();
}


export function normalizeCorrosionObservation({
  material,
  exposurePeriod,
  corrosionMetric,
  reportedValue,
  reportedUnit,
  densityOverrideGcm3 = null,
}) {
  const cleanMaterial =
    String(
      material ?? ""
    ).trim();

  const cleanExposurePeriod =
    String(
      exposurePeriod ?? ""
    ).trim();

  const cleanMetric =
    String(
      corrosionMetric ?? ""
    ).trim();

  const cleanUnit =
    normalizeUnitText(
      reportedUnit
    );

  const numericValue =
    Number(
      reportedValue
    );


  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    throw new Error(
      "reported_value is not numeric."
    );
  }


  if (
    cleanMetric !==
      "net_mass_change" &&
    numericValue < 0
  ) {
    throw new Error(
      "Negative reported values are only accepted for net_mass_change."
    );
  }


  const defaultDensity =
    getDefaultDensityGcm3(
      cleanMaterial
    );


  let densityOverride =
    null;


  if (
    densityOverrideGcm3 !== null &&
    densityOverrideGcm3 !== undefined &&
    String(
      densityOverrideGcm3
    ).trim() !== ""
  ) {
    densityOverride =
      Number(
        densityOverrideGcm3
      );


    if (
      !Number.isFinite(
        densityOverride
      )
    ) {
      densityOverride =
        null;
    }
  }


  if (
    densityOverride !== null &&
    densityOverride <= 0
  ) {
    throw new Error(
      "density_override_g_cm3 must be greater than zero."
    );
  }


  let densityUsed =
    null;

  let densityBasis =
    "";


  if (
    densityOverride !== null
  ) {
    densityUsed =
      densityOverride;

    densityBasis =
      "curator_override";

  } else if (
    defaultDensity !== null
  ) {
    densityUsed =
      defaultDensity;

    densityBasis =
      "default_material_density";
  }


  const exposureYears =
    parseExposureYears(
      cleanExposurePeriod
    );


  let canonicalThickness =
    null;

  let canonicalMass =
    null;

  let normalizationNote =
    "";


  if (
    cleanMetric ===
      "penetration_rate" ||
    cleanMetric ===
      "corrosion_rate"
  ) {
    const rule =
      getUnitRule(
        cleanMetric,
        cleanUnit
      );


    if (!rule) {
      throw new Error(
        `Unsupported metric/unit combination: ${cleanMetric} + ${cleanUnit}`
      );
    }


    if (
      rule.canonicalUnit !==
      "µm/year"
    ) {
      throw new Error(
        "Penetration-rate conversion must first produce µm/year."
      );
    }


    canonicalThickness =
      numericValue *
      rule.multiplier;


    if (
      densityUsed !== null
    ) {
      canonicalMass =
        canonicalThickness *
        densityUsed;

      normalizationNote =
        "Converted reported penetration rate to " +
        "µm/year and derived mass-loss rate using " +
        `density ${displayNumber(densityUsed)} g/cm³.`;

    } else {
      normalizationNote =
        "Converted reported penetration rate to " +
        "µm/year. Mass-loss rate could not be " +
        "derived because density is unavailable.";
    }

  } else if (
    cleanMetric ===
    "mass_loss_rate"
  ) {
    const rule =
      getUnitRule(
        cleanMetric,
        cleanUnit
      );


    if (!rule) {
      throw new Error(
        `Unsupported metric/unit combination: ${cleanMetric} + ${cleanUnit}`
      );
    }


    if (
      rule.canonicalUnit !==
      "g/m²/year"
    ) {
      throw new Error(
        "Mass-loss-rate conversion must first produce g/m²/year."
      );
    }


    canonicalMass =
      numericValue *
      rule.multiplier;


    if (
      densityUsed !== null
    ) {
      canonicalThickness =
        canonicalMass /
        densityUsed;

      normalizationNote =
        "Converted reported mass-loss rate to " +
        "g/m²/year and derived thickness-loss rate " +
        `using density ${displayNumber(densityUsed)} g/cm³.`;

    } else {
      normalizationNote =
        "Converted reported mass-loss rate to " +
        "g/m²/year. Thickness-loss rate could not " +
        "be derived because density is unavailable.";
    }

  } else if (
    cleanMetric ===
    "cumulative_penetration"
  ) {
    const rule =
      getUnitRule(
        cleanMetric,
        cleanUnit
      );


    if (!rule) {
      throw new Error(
        `Unsupported metric/unit combination: ${cleanMetric} + ${cleanUnit}`
      );
    }


    if (
      rule.canonicalUnit !==
      "µm"
    ) {
      throw new Error(
        "Cumulative penetration must first normalize to µm."
      );
    }


    const cumulative =
      numericValue *
      rule.multiplier;


    if (
      exposureYears === null
    ) {
      if (
        !cleanExposurePeriod
      ) {
        normalizationNote =
          "Exposure period not reported. " +
          "Cumulative penetration is preserved as " +
          "reported but cannot be converted to annual " +
          "canonical corrosion rates.";

      } else {
        normalizationNote =
          "Cumulative penetration is preserved as " +
          "reported but cannot be converted to annual " +
          "canonical corrosion rates because the " +
          "exposure duration could not be interpreted.";
      }

    } else {
      canonicalThickness =
        cumulative /
        exposureYears;


      if (
        densityUsed !== null
      ) {
        canonicalMass =
          canonicalThickness *
          densityUsed;

        normalizationNote =
          "Converted cumulative penetration to " +
          "average annual thickness-loss rate over " +
          `${displayNumber(exposureYears)} year(s), then derived ` +
          "mass-loss rate using density " +
          `${displayNumber(densityUsed)} g/cm³.`;

      } else {
        normalizationNote =
          "Converted cumulative penetration to " +
          "average annual thickness-loss rate over " +
          `${displayNumber(exposureYears)} year(s). Mass-loss ` +
          "rate could not be derived because density " +
          "is unavailable.";
      }
    }

  } else if (
    cleanMetric ===
    "cumulative_mass_loss"
  ) {
    const rule =
      getUnitRule(
        cleanMetric,
        cleanUnit
      );


    if (!rule) {
      throw new Error(
        `Unsupported metric/unit combination: ${cleanMetric} + ${cleanUnit}`
      );
    }


    if (
      rule.canonicalUnit !==
      "g/m²"
    ) {
      throw new Error(
        "Cumulative mass loss must first normalize to g/m²."
      );
    }


    const cumulative =
      numericValue *
      rule.multiplier;


    if (
      exposureYears === null
    ) {
      if (
        !cleanExposurePeriod
      ) {
        normalizationNote =
          "Exposure period not reported. " +
          "Cumulative mass loss is preserved as " +
          "reported but cannot be converted to annual " +
          "canonical corrosion rates.";

      } else {
        normalizationNote =
          "Cumulative mass loss is preserved as " +
          "reported but cannot be converted to annual " +
          "canonical corrosion rates because the " +
          "exposure duration could not be interpreted.";
      }

    } else {
      canonicalMass =
        cumulative /
        exposureYears;


      if (
        densityUsed !== null
      ) {
        canonicalThickness =
          canonicalMass /
          densityUsed;

        normalizationNote =
          "Converted cumulative mass loss to " +
          "average annual mass-loss rate over " +
          `${displayNumber(exposureYears)} year(s), then derived ` +
          "thickness-loss rate using density " +
          `${displayNumber(densityUsed)} g/cm³.`;

      } else {
        normalizationNote =
          "Converted cumulative mass loss to " +
          "average annual mass-loss rate over " +
          `${displayNumber(exposureYears)} year(s). Thickness-loss ` +
          "rate could not be derived because density " +
          "is unavailable.";
      }
    }

  } else if (
    cleanMetric ===
    "maximum_pit_depth"
  ) {
    if (
      !getUnitRule(
        cleanMetric,
        cleanUnit
      )
    ) {
      throw new Error(
        `Unsupported metric/unit combination: ${cleanMetric} + ${cleanUnit}`
      );
    }


    normalizationNote =
      "Maximum pit depth is a localized-corrosion " +
      "metric and is not converted to the canonical " +
      "general thickness-loss or mass-loss rates.";

  } else if (
    cleanMetric ===
    "net_mass_change"
  ) {
    if (
      !getUnitRule(
        cleanMetric,
        cleanUnit
      )
    ) {
      throw new Error(
        `Unsupported metric/unit combination: ${cleanMetric} + ${cleanUnit}`
      );
    }


    normalizationNote =
      "Net mass change is not assumed to equal cleaned " +
      "metal loss and therefore is not converted to " +
      "canonical corrosion rates.";

  } else if (
    [
      "MCI",
      "Al-ACI",
      "ICI",
    ].includes(
      cleanMetric
    )
  ) {
    if (
      !getUnitRule(
        cleanMetric,
        cleanUnit
      )
    ) {
      throw new Error(
        `Unsupported metric/unit combination: ${cleanMetric} + ${cleanUnit}`
      );
    }


    normalizationNote =
      `${cleanMetric} is a corrosivity index and ` +
      "cannot be converted to canonical general " +
      "corrosion rates.";

  } else {
    throw new Error(
      `Unsupported corrosion metric: ${cleanMetric}`
    );
  }


  return {
    canonical_thickness_loss_rate_um_year:
      canonicalThickness,

    canonical_mass_loss_rate_g_m2_year:
      canonicalMass,

    default_density_g_cm3:
      defaultDensity,

    density_override_g_cm3:
      densityOverride,

    density_g_cm3:
      densityUsed,

    density_basis:
      densityBasis,

    normalization_note:
      normalizationNote,

    exposure_years:
      exposureYears,

    normalized_value:
      canonicalThickness,

    normalized_unit:
      canonicalThickness !== null
        ? "µm/year"
        : "",
  };
}