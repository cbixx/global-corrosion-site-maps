import * as XLSX from "xlsx";

import {
  CORROSION_METRIC_OPTIONS,
  isValidPartialIsoDate,
  normalizeCorrosionObservation,
  normalizeUnitText,
} from "./corrosion-normalization.js";


const WORKBOOK_INPUT_COLUMNS = [
  "source_code",
  "source_title",

  "site_id",
  "site_label",
  "country",

  "observation_id",

  "material",
  "exposure_period",
  "exposure_start",
  "exposure_end",
  "corrosion_metric",

  "reported_value",
  "reported_unit",

  "default_density_g_cm3",
  "density_override_g_cm3",
  "density_used_g_cm3",

  "canonical_thickness_loss_rate_um_year",
  "canonical_mass_loss_rate_g_m2_year",

  "normalization_note",

  "notes",
];


function cleanText(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(
    value
  ).trim();
}


function isBlank(
  value
) {
  return (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  );
}


export function readCorrosionWorkbook(
  bytes
) {
  const workbook =
    XLSX.read(
      bytes,
      {
        type:
          "array",

        cellDates:
          false,
      }
    );


  const sheet =
    workbook.Sheets[
      "Corrosion Observations"
    ];


  if (!sheet) {
    throw new Error(
      "Workbook does not contain the required `Corrosion Observations` sheet."
    );
  }


  const rawRows =
    XLSX.utils.sheet_to_json(
      sheet,
      {
        header:
          1,

        raw:
          true,

        defval:
          "",

        blankrows:
          true,
      }
    );


  if (
    !rawRows.length
  ) {
    throw new Error(
      "The corrosion workbook is empty."
    );
  }


  const headers =
    rawRows[0].map(
      (value) =>
        cleanText(
          value
        )
    );


  const missingColumns =
    WORKBOOK_INPUT_COLUMNS.filter(
      (column) =>
        !headers.includes(
          column
        )
    );


  if (
    missingColumns.length
  ) {
    throw new Error(
      "The workbook is missing required column(s): " +
      missingColumns.join(", ")
    );
  }


  const records = [];


  for (
    let index = 1;
    index < rawRows.length;
    index += 1
  ) {
    const values =
      rawRows[index] ||
      [];


    const rawRecord = {};


    for (
      let columnIndex = 0;
      columnIndex <
        headers.length;
      columnIndex += 1
    ) {
      const header =
        headers[
          columnIndex
        ];


      if (!header) {
        continue;
      }


      rawRecord[
        header
      ] =
        columnIndex <
        values.length
          ? values[
              columnIndex
            ]
          : "";
    }


    const record = {
      excel_row:
        index + 1,

      source_code:
        cleanText(
          rawRecord.source_code
        ),

      source_title:
        cleanText(
          rawRecord.source_title
        ),

      site_id:
        cleanText(
          rawRecord.site_id
        ),

      site_label:
        cleanText(
          rawRecord.site_label
        ),

      country:
        cleanText(
          rawRecord.country
        ),

      observation_id:
        rawRecord
          .observation_id ??
        "",

      material:
        cleanText(
          rawRecord.material
        ),

      exposure_period:
        cleanText(
          rawRecord
            .exposure_period
        ),

      exposure_start:
        cleanText(
          rawRecord
            .exposure_start
        ),

      exposure_end:
        cleanText(
          rawRecord
            .exposure_end
        ),

      corrosion_metric:
        cleanText(
          rawRecord
            .corrosion_metric
        ),

      reported_value:
        rawRecord
          .reported_value ??
        "",

      reported_unit:
        normalizeUnitText(
          rawRecord
            .reported_unit
        ),

      density_override_g_cm3:
        rawRecord
          .density_override_g_cm3 ??
        "",

      notes:
        cleanText(
          rawRecord.notes
        ),
    };


    /*
     * Source/Site context exists even in unused
     * starter rows. Only observation-entry fields
     * determine whether the row is imported.
     */
    const observationValues = [
      record.observation_id,
      record.material,
      record.exposure_period,
      record.exposure_start,
      record.exposure_end,
      record.corrosion_metric,
      record.reported_value,
      record.reported_unit,
      record.density_override_g_cm3,
      record.notes,
    ];


    const hasObservationContent =
      observationValues.some(
        (value) =>
          !isBlank(
            value
          )
      );


    if (
      !hasObservationContent
    ) {
      continue;
    }


    records.push(
      record
    );
  }


  return records;
}


export function validateCorrosionWorkbookRows(
  records,
  {
    existingSiteIds,
    existingSourceCodes,
    existingSiteSourcePairs,
    existingObservations,
  }
) {
  const normalizedSites =
    new Set(
      existingSiteIds
        .map(
          (value) =>
            cleanText(
              value
            ).toLocaleLowerCase()
        )
        .filter(Boolean)
    );


  const normalizedSources =
    new Set(
      existingSourceCodes
        .map(
          (value) =>
            cleanText(
              value
            ).toLocaleLowerCase()
        )
        .filter(Boolean)
    );


  const normalizedPairs =
    new Set(
      existingSiteSourcePairs.map(
        ([siteId, sourceCode]) =>
          `${cleanText(siteId).toLocaleLowerCase()}\u0000` +
          `${cleanText(sourceCode).toLocaleLowerCase()}`
      )
    );


  const observationsById =
    new Map();


  for (
    const observation
    of existingObservations
  ) {
    const id =
      Number(
        observation.id
      );


    if (
      Number.isInteger(id)
    ) {
      observationsById.set(
        id,
        observation
      );
    }
  }


  const preview = [];


  for (
    const inputRow
    of records
  ) {
    const row = {
      ...inputRow,

      record_action:
        "",

      validation_status:
        "",

      validation_message:
        "",

      canonical_thickness_loss_rate_um_year:
        "",

      canonical_mass_loss_rate_g_m2_year:
        "",

      default_density_g_cm3:
        "",

      density_used_g_cm3:
        "",

      density_basis:
        "",

      normalization_note:
        "",
    };


    const errors = [];


    const siteId =
      cleanText(
        row.site_id
      );

    const sourceCode =
      cleanText(
        row.source_code
      );

    const material =
      cleanText(
        row.material
      );

    const exposurePeriod =
      cleanText(
        row.exposure_period
      );

    const exposureStart =
      cleanText(
        row.exposure_start
      );

    const exposureEnd =
      cleanText(
        row.exposure_end
      );

    const corrosionMetric =
      cleanText(
        row.corrosion_metric
      );

    const reportedUnit =
      normalizeUnitText(
        row.reported_unit
      );


    row.reported_unit =
      reportedUnit;


    if (
      exposureStart &&
      !isValidPartialIsoDate(
        exposureStart
      )
    ) {
      errors.push(
        "exposure_start must use YYYY, YYYY-MM, or YYYY-MM-DD."
      );
    }


    if (
      exposureEnd &&
      !isValidPartialIsoDate(
        exposureEnd
      )
    ) {
      errors.push(
        "exposure_end must use YYYY, YYYY-MM, or YYYY-MM-DD."
      );
    }


    let observationId =
      null;


    if (
      !isBlank(
        row.observation_id
      )
    ) {
      const idNumber =
        Number(
          row.observation_id
        );


      if (
        !Number.isFinite(
          idNumber
        ) ||
        !Number.isInteger(
          idNumber
        )
      ) {
        errors.push(
          "observation_id is not a valid integer."
        );

      } else {
        observationId =
          idNumber;
      }
    }


    const requiredValues = {
      source_code:
        sourceCode,

      site_id:
        siteId,

      material,

      corrosion_metric:
        corrosionMetric,

      reported_value:
        row.reported_value,

      reported_unit:
        reportedUnit,
    };


    for (
      const [
        fieldName,
        fieldValue,
      ]
      of Object.entries(
        requiredValues
      )
    ) {
      if (
        isBlank(
          fieldValue
        )
      ) {
        errors.push(
          `${fieldName} is required.`
        );
      }
    }


    const siteKey =
      siteId
        .toLocaleLowerCase();

    const sourceKey =
      sourceCode
        .toLocaleLowerCase();


    if (
      siteId &&
      !normalizedSites.has(
        siteKey
      )
    ) {
      errors.push(
        `site_id \`${siteId}\` does not exist.`
      );
    }


    if (
      sourceCode &&
      !normalizedSources.has(
        sourceKey
      )
    ) {
      errors.push(
        `source_code \`${sourceCode}\` does not exist.`
      );
    }


    if (
      siteId &&
      sourceCode &&
      !normalizedPairs.has(
        `${siteKey}\u0000${sourceKey}`
      )
    ) {
      errors.push(
        "The selected source is not linked to " +
        `site \`${siteId}\`.`
      );
    }


    if (
      observationId !== null
    ) {
      const existing =
        observationsById.get(
          observationId
        );


      if (!existing) {
        errors.push(
          `observation_id \`${observationId}\` does not exist.`
        );

      } else {
        const existingSite =
          cleanText(
            existing.site_id
          );

        const existingSource =
          cleanText(
            existing.source_code
          );


        if (
          existingSite
            .toLocaleLowerCase() !==
            siteKey ||
          existingSource
            .toLocaleLowerCase() !==
            sourceKey
        ) {
          errors.push(
            "observation_id does not belong to this source/site pair."
          );
        }
      }


      row.record_action =
        "UPDATE";

    } else {
      row.record_action =
        "CREATE";
    }


    if (
      corrosionMetric &&
      !CORROSION_METRIC_OPTIONS.includes(
        corrosionMetric
      )
    ) {
      errors.push(
        "Unsupported corrosion_metric: " +
        `\`${corrosionMetric}\`.`
      );
    }


    let reportedValue =
      null;


    if (
      !isBlank(
        row.reported_value
      )
    ) {
      const value =
        Number(
          row.reported_value
        );


      if (
        !Number.isFinite(
          value
        )
      ) {
        errors.push(
          "reported_value is not numeric."
        );

      } else {
        reportedValue =
          value;
      }
    }


    let densityOverride =
      null;


    if (
      !isBlank(
        row.density_override_g_cm3
      )
    ) {
      const value =
        Number(
          row.density_override_g_cm3
        );


      if (
        !Number.isFinite(
          value
        )
      ) {
        errors.push(
          "density_override_g_cm3 is not numeric."
        );

      } else {
        densityOverride =
          value;


        if (
          densityOverride <= 0
        ) {
          errors.push(
            "density_override_g_cm3 must be greater than zero."
          );
        }
      }
    }


    if (
      reportedValue !== null &&
      corrosionMetric &&
      reportedUnit
    ) {
      try {
        const normalized =
          normalizeCorrosionObservation({
            material,
            exposurePeriod,
            corrosionMetric,
            reportedValue,
            reportedUnit,
            densityOverrideGcm3:
              densityOverride,
          });


        row
          .canonical_thickness_loss_rate_um_year =
            normalized
              .canonical_thickness_loss_rate_um_year ??
            "";


        row
          .canonical_mass_loss_rate_g_m2_year =
            normalized
              .canonical_mass_loss_rate_g_m2_year ??
            "";


        row
          .default_density_g_cm3 =
            normalized
              .default_density_g_cm3 ??
            "";


        row
          .density_used_g_cm3 =
            normalized
              .density_g_cm3 ??
            "";


        row.density_basis =
          normalized
            .density_basis;


        row.normalization_note =
          normalized
            .normalization_note;

      } catch (error) {
        errors.push(
          error?.message ||
          String(error)
        );
      }
    }


    const uniqueErrors =
      [
        ...new Set(
          errors
        ),
      ];


    if (
      uniqueErrors.length
    ) {
      row.validation_status =
        "ERROR";

      row.validation_message =
        uniqueErrors.join(
          "; "
        );

    } else {
      row.validation_status =
        "READY";

      row.validation_message =
        "";
    }


    preview.push(
      row
    );
  }


  return preview;
}