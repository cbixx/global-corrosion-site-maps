import JSZip from "jszip";


const SITE_BASE_COLUMNS = [
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
];


const PUBLIC_SOURCE_COLUMNS = [
  "source_code",
  "source_kind",
  "source_type",
  "source_title",
  "authors_or_organization",
  "publication_year",
  "doi",
  "public_url",
  "notes",
  "display_citation",
];


const PUBLIC_CORROSION_COLUMNS = [
  "observation_id",
  "site_id",
  "site_label",
  "latitude",
  "longitude",
  "modern_country_location",
  "source_code",
  "source_title",
  "material",
  "exposure_period",
  "exposure_start",
  "exposure_end",
  "corrosion_metric",
  "value",
  "unit",
  "canonical_thickness_loss_rate_um_year",
  "canonical_mass_loss_rate_g_m2_year",
  "normalized_value",
  "normalized_unit",
  "density_g_cm3",
  "density_basis",
  "derived_penetration_value",
  "derived_penetration_unit",
  "normalization_note",
  "measurement_method",
  "specimen_condition",
  "exposure_condition",
  "notes",
];


const PUBLIC_ENVIRONMENT_COLUMNS = [
  "site_id",
  "site_label",
  "latitude",
  "longitude",
  "modern_country_location",
  "source_code",
  "source_title",
  "variable_name",
  "value",
  "unit",
  "aggregation",
  "period_start",
  "period_end",
  "data_source",
  "notes",
];


function cleanText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}


function csvValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value);
}


function csvEscape(value) {
  const text =
    csvValue(value);

  if (
    /[",\r\n]/.test(text)
  ) {
    return (
      "\"" +
      text.replaceAll(
        "\"",
        "\"\""
      ) +
      "\""
    );
  }

  return text;
}


function buildCsv(
  rows,
  columns
) {
  const lines = [
    columns
      .map(csvEscape)
      .join(","),
  ];

  for (
    const row
    of rows
  ) {
    lines.push(
      columns
        .map(
          (column) =>
            csvEscape(
              row[column]
            )
        )
        .join(",")
    );
  }

  /*
   * Match the existing public files:
   * UTF-8 BOM + standard CSV line endings.
   */
  return (
    "\uFEFF" +
    lines.join("\r\n") +
    "\r\n"
  );
}


function parseCsv(text) {
  const rows = [];

  let row = [];
  let field = "";
  let quoted = false;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const character =
      text[index];

    if (
      character === "\""
    ) {
      if (
        quoted &&
        text[index + 1] === "\""
      ) {
        field += "\"";
        index += 1;

      } else {
        quoted =
          !quoted;
      }

      continue;
    }

    if (
      character === "," &&
      !quoted
    ) {
      row.push(field);
      field = "";
      continue;
    }

    if (
      (
        character === "\n" ||
        character === "\r"
      ) &&
      !quoted
    ) {
      if (
        character === "\r" &&
        text[index + 1] === "\n"
      ) {
        index += 1;
      }

      row.push(field);

      if (
        row.some(
          (value) =>
            String(value).length > 0
        )
      ) {
        rows.push(row);
      }

      row = [];
      field = "";
      continue;
    }

    field +=
      character;
  }

  if (
    field ||
    row.length
  ) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}


function cleanIdArray(value) {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return [
    ...new Set(
      value
        .map(Number)
        .filter(
          (id) =>
            Number.isInteger(id) &&
            id > 0
        )
    ),
  ];
}


async function fetchAllRows(
  env,
  table,
  select
) {
  if (
    !env.SUPABASE_URL ||
    !env.SUPABASE_SECRET_KEY
  ) {
    throw new Error(
      "Supabase configuration is missing."
    );
  }

  const allRows = [];

  const pageSize =
    1000;

  let start =
    0;

  while (true) {
    const url =
      new URL(
        `/rest/v1/${table}`,
        env.SUPABASE_URL
      );

    url.searchParams.set(
      "select",
      select
    );

    const response =
      await fetch(
        url,
        {
          headers: {
            apikey:
              env.SUPABASE_SECRET_KEY,

            authorization:
              `Bearer ${env.SUPABASE_SECRET_KEY}`,

            accept:
              "application/json",

            range:
              `${start}-${start + pageSize - 1}`,
          },
        }
      );

    if (!response.ok) {
      console.error(
        `Unable to export ${table}.`,
        response.status,
        await response.text()
      );

      throw new Error(
        `Unable to load ${table} for website export.`
      );
    }

    const rows =
      await response.json();

    allRows.push(
      ...rows
    );

    if (
      rows.length <
      pageSize
    ) {
      break;
    }

    start +=
      pageSize;
  }

  return allRows;
}


function getRepoConfig(env) {
  return {
    owner:
      String(
        env.GITHUB_REPO_OWNER ||
        "cbixx"
      ).trim(),

    repo:
      String(
        env.GITHUB_REPO_NAME ||
        "global-corrosion-site-maps"
      ).trim(),

    branch:
      String(
        env.GITHUB_BRANCH ||
        "main"
      ).trim(),
  };
}


async function loadCurrentPublishedSiteIds(
  env
) {
  const config =
    getRepoConfig(env);

  const url =
    `https://raw.githubusercontent.com/` +
    `${encodeURIComponent(config.owner)}/` +
    `${encodeURIComponent(config.repo)}/` +
    `${encodeURIComponent(config.branch)}/` +
    `data/sites.csv`;

  const response =
    await fetch(
      url,
      {
        headers: {
          accept:
            "text/csv",
        },
      }
    );

  if (
    response.status ===
    404
  ) {
    return new Set();
  }

  if (!response.ok) {
    throw new Error(
      "Unable to read the currently published data/sites.csv."
    );
  }

  const text =
    await response.text();

  const rows =
    parseCsv(text);

  if (
    rows.length === 0
  ) {
    return new Set();
  }

  const headers =
    rows[0].map(
      (value) =>
        cleanText(value)
          .replace(
            /^\uFEFF/,
            ""
          )
    );

  const siteIdIndex =
    headers.indexOf(
      "site_id"
    );

  if (
    siteIdIndex < 0
  ) {
    throw new Error(
      "The current public sites.csv does not contain a site_id column."
    );
  }

  return new Set(
    rows
      .slice(1)
      .map(
        (row) =>
          cleanText(
            row[
              siteIdIndex
            ]
          )
      )
      .filter(Boolean)
  );
}


async function loadSiteExportContext(
  env
) {
  const [
    sites,
    links,
  ] =
    await Promise.all([
      fetchAllRows(
        env,
        "sites",
        [
          "id",
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
        ].join(",")
      ),

      fetchAllRows(
        env,
        "site_sources",
        [
          "id",
          "site_fk",
          "source_order",
          "sources(source_code)",
        ].join(",")
      ),
    ]);

  return {
    sites,
    links,
  };
}


export async function buildPublishPreview(
  env
) {
  const [
    context,
    currentPublishedIds,
  ] =
    await Promise.all([
      loadSiteExportContext(
        env
      ),

      loadCurrentPublishedSiteIds(
        env
      ),
    ]);

  const sourceCounts =
    new Map();

  for (
    const link
    of context.links
  ) {
    const siteId =
      Number(
        link.site_fk
      );

    sourceCounts.set(
      siteId,
      (
        sourceCounts.get(
          siteId
        ) ||
        0
      ) + 1
    );
  }

  const duplicateTracker =
    new Map();

  for (
    const site
    of context.sites
  ) {
    const siteCode =
      cleanText(
        site.site_id
      );

    if (!siteCode) {
      continue;
    }

    duplicateTracker.set(
      siteCode,
      (
        duplicateTracker.get(
          siteCode
        ) ||
        0
      ) + 1
    );
  }

  const duplicateSiteIds =
    [
      ...duplicateTracker.entries(),
    ]
      .filter(
        ([, count]) =>
          count > 1
      )
      .map(
        ([siteId]) =>
          siteId
      )
      .sort();

  const rows =
    context.sites
      .map(
        (site) => ({
          site_db_id:
            Number(site.id),

          site_id:
            cleanText(
              site.site_id
            ),

          site_label:
            cleanText(
              site.site_label
            ),

          site_type:
            cleanText(
              site.site_type
            ),

          latitude:
            site.latitude,

          longitude:
            site.longitude,

          modern_country_location:
            cleanText(
              site.modern_country_location
            ),

          region_category:
            cleanText(
              site.region_category
            ),

          metal:
            cleanText(
              site.metal
            ),

          exposure_period:
            cleanText(
              site.exposure_period
            ),

          source_count:
            sourceCounts.get(
              Number(site.id)
            ) ||
            0,

          is_already_published:
            currentPublishedIds.has(
              cleanText(
                site.site_id
              )
            ),
        })
      )
      .sort(
        (a, b) =>
          a.site_id.localeCompare(
            b.site_id
          )
      );

  return {
    rows,

    duplicate_site_ids:
      duplicateSiteIds,

    counts: {
      curated:
        rows.length,

      published:
        rows.filter(
          (row) =>
            row.is_already_published
        ).length,

      unpublished:
        rows.filter(
          (row) =>
            !row.is_already_published
        ).length,
    },
  };
}


function buildSiteCsv(
  context,
  selectedSiteIds
) {
  const selected =
    new Set(
      selectedSiteIds
    );

  const sites =
    context.sites
      .filter(
        (site) =>
          selected.has(
            Number(site.id)
          )
      )
      .sort(
        (a, b) =>
          cleanText(
            a.site_id
          ).localeCompare(
            cleanText(
              b.site_id
            )
          )
      );

  if (
    sites.length !==
    selected.size
  ) {
    throw new Error(
      "One or more selected Sites no longer exist."
    );
  }

  const duplicateTracker =
    new Set();

  const duplicates =
    new Set();

  for (
    const site
    of sites
  ) {
    const siteId =
      cleanText(
        site.site_id
      );

    if (
      duplicateTracker.has(
        siteId
      )
    ) {
      duplicates.add(
        siteId
      );
    }

    duplicateTracker.add(
      siteId
    );
  }

  if (
    duplicates.size
  ) {
    throw new Error(
      "Duplicate site_id values detected: " +
      [
        ...duplicates,
      ]
        .sort()
        .join(", ")
    );
  }

  const linksBySite =
    new Map();

  for (
    const link
    of context.links
  ) {
    const siteFk =
      Number(
        link.site_fk
      );

    if (
      !selected.has(
        siteFk
      )
    ) {
      continue;
    }

    if (
      !linksBySite.has(
        siteFk
      )
    ) {
      linksBySite.set(
        siteFk,
        []
      );
    }

    linksBySite
      .get(siteFk)
      .push(link);
  }

  let maxSourceCount =
    0;

  const rows = [];

  for (
    const site
    of sites
  ) {
    const siteLinks =
      (
        linksBySite.get(
          Number(site.id)
        ) ||
        []
      )
        .slice()
        .sort(
          (a, b) => {
            const aOrder =
              Number.isFinite(
                Number(
                  a.source_order
                )
              )
                ? Number(
                    a.source_order
                  )
                : 999999;

            const bOrder =
              Number.isFinite(
                Number(
                  b.source_order
                )
              )
                ? Number(
                    b.source_order
                  )
                : 999999;

            if (
              aOrder !==
              bOrder
            ) {
              return (
                aOrder -
                bOrder
              );
            }

            return cleanText(
              a.sources
                ?.source_code
            ).localeCompare(
              cleanText(
                b.sources
                  ?.source_code
              )
            );
          }
        );

    maxSourceCount =
      Math.max(
        maxSourceCount,
        siteLinks.length
      );

    const row = {
      site_id:
        cleanText(
          site.site_id
        ),

      site_label:
        cleanText(
          site.site_label
        ),

      site_type:
        cleanText(
          site.site_type
        ),

      latitude:
        cleanText(
          site.latitude
        ),

      longitude:
        cleanText(
          site.longitude
        ),

      modern_country_location:
        cleanText(
          site.modern_country_location
        ),

      administering_country:
        cleanText(
          site.administering_country
        ),

      former_entity:
        cleanText(
          site.former_entity
        ),

      region_category:
        cleanText(
          site.region_category
        ),

      exposure_period:
        cleanText(
          site.exposure_period
        ),

      metal:
        cleanText(
          site.metal
        ),

      notes:
        cleanText(
          site.notes
        ),
    };

    siteLinks.forEach(
      (
        link,
        index
      ) => {
        row[
          `source_${index + 1}`
        ] =
          cleanText(
            link.sources
              ?.source_code
          );
      }
    );

    rows.push(row);
  }

  const sourceColumns =
    Array.from(
      {
        length:
          maxSourceCount,
      },
      (
        _,
        index
      ) =>
        `source_${index + 1}`
    );

  const columns = [
    ...SITE_BASE_COLUMNS,
    ...sourceColumns,
    "notes",
  ];

  return {
    csv:
      buildCsv(
        rows,
        columns
      ),

    count:
      rows.length,
  };
}


async function buildSourcesCsv(
  env
) {
  const sourceRows =
    await fetchAllRows(
      env,
      "sources",
      [
        "source_code",
        "source_kind",
        "source_type",
        "source_title",
        "authors_or_organization",
        "publication_year",
        "doi",
        "public_url",
        "public_notes",
        "display_citation",
      ].join(",")
    );

  const rows =
    sourceRows
      .filter(
        (row) =>
          cleanText(
            row.source_code
          )
      )
      .map(
        (row) => ({
          source_code:
            cleanText(
              row.source_code
            ),

          source_kind:
            cleanText(
              row.source_kind
            ),

          source_type:
            cleanText(
              row.source_type
            ),

          source_title:
            cleanText(
              row.source_title
            ),

          authors_or_organization:
            cleanText(
              row.authors_or_organization
            ),

          publication_year:
            cleanText(
              row.publication_year
            ),

          doi:
            cleanText(
              row.doi
            ),

          public_url:
            cleanText(
              row.public_url
            ),

          /*
           * Deliberately public_notes,
           * never internal notes.
           */
          notes:
            cleanText(
              row.public_notes
            ),

          display_citation:
            cleanText(
              row.display_citation
            ),
        })
      )
      .sort(
        (a, b) =>
          a.source_code.localeCompare(
            b.source_code
          )
      );

  return {
    csv:
      buildCsv(
        rows,
        PUBLIC_SOURCE_COLUMNS
      ),

    count:
      rows.length,
  };
}


async function buildCorrosionCsv(
  env
) {
  const sourceRows =
    await fetchAllRows(
      env,
      "corrosion_observations",
      [
        "id",
        "material",
        "exposure_period",
        "exposure_start",
        "exposure_end",
        "corrosion_metric",
        "value",
        "unit",
        "canonical_thickness_loss_rate_um_year",
        "canonical_mass_loss_rate_g_m2_year",
        "normalized_value",
        "normalized_unit",
        "density_g_cm3",
        "density_basis",
        "derived_penetration_value",
        "derived_penetration_unit",
        "normalization_note",
        "measurement_method",
        "specimen_condition",
        "exposure_condition",
        "notes",
        "sites(site_id,site_label,latitude,longitude,modern_country_location)",
        "sources(source_code,source_title)",
      ].join(",")
    );

  const rows =
    sourceRows
      .map(
        (row) => ({
          observation_id:
            row.id,

          site_id:
            row.sites
              ?.site_id,

          site_label:
            row.sites
              ?.site_label,

          latitude:
            row.sites
              ?.latitude,

          longitude:
            row.sites
              ?.longitude,

          modern_country_location:
            row.sites
              ?.modern_country_location,

          source_code:
            row.sources
              ?.source_code,

          source_title:
            row.sources
              ?.source_title,

          material:
            row.material,

          exposure_period:
            row.exposure_period,

          exposure_start:
            row.exposure_start,

          exposure_end:
            row.exposure_end,

          corrosion_metric:
            row.corrosion_metric,

          value:
            row.value,

          unit:
            row.unit,

          canonical_thickness_loss_rate_um_year:
            row
              .canonical_thickness_loss_rate_um_year,

          canonical_mass_loss_rate_g_m2_year:
            row
              .canonical_mass_loss_rate_g_m2_year,

          normalized_value:
            row.normalized_value,

          normalized_unit:
            row.normalized_unit,

          density_g_cm3:
            row.density_g_cm3,

          density_basis:
            row.density_basis,

          derived_penetration_value:
            row
              .derived_penetration_value,

          derived_penetration_unit:
            row
              .derived_penetration_unit,

          normalization_note:
            row.normalization_note,

          measurement_method:
            row.measurement_method,

          specimen_condition:
            row.specimen_condition,

          exposure_condition:
            row.exposure_condition,

          notes:
            row.notes,
        })
      )
      .sort(
        (a, b) =>
          cleanText(
            a.site_id
          ).localeCompare(
            cleanText(
              b.site_id
            )
          ) ||
          cleanText(
            a.material
          ).localeCompare(
            cleanText(
              b.material
            )
          ) ||
          cleanText(
            a.exposure_period
          ).localeCompare(
            cleanText(
              b.exposure_period
            )
          ) ||
          cleanText(
            a.source_code
          ).localeCompare(
            cleanText(
              b.source_code
            )
          )
      );

  return {
    csv:
      buildCsv(
        rows,
        PUBLIC_CORROSION_COLUMNS
      ),

    count:
      rows.length,
  };
}


async function buildEnvironmentCsv(
  env
) {
  const sourceRows =
    await fetchAllRows(
      env,
      "environmental_observations",
      [
        "variable_name",
        "value",
        "unit",
        "aggregation",
        "period_start",
        "period_end",
        "data_source",
        "notes",
        "sites(site_id,site_label,latitude,longitude,modern_country_location)",
        "sources(source_code,source_title)",
      ].join(",")
    );

  const rows =
    sourceRows
      .map(
        (row) => ({
          site_id:
            row.sites
              ?.site_id,

          site_label:
            row.sites
              ?.site_label,

          latitude:
            row.sites
              ?.latitude,

          longitude:
            row.sites
              ?.longitude,

          modern_country_location:
            row.sites
              ?.modern_country_location,

          source_code:
            row.sources
              ?.source_code,

          source_title:
            row.sources
              ?.source_title,

          variable_name:
            row.variable_name,

          value:
            row.value,

          unit:
            row.unit,

          aggregation:
            row.aggregation,

          period_start:
            row.period_start,

          period_end:
            row.period_end,

          data_source:
            row.data_source,

          notes:
            row.notes,
        })
      )
      .sort(
        (a, b) =>
          cleanText(
            a.site_id
          ).localeCompare(
            cleanText(
              b.site_id
            )
          ) ||
          cleanText(
            a.variable_name
          ).localeCompare(
            cleanText(
              b.variable_name
            )
          ) ||
          cleanText(
            a.period_start
          ).localeCompare(
            cleanText(
              b.period_start
            )
          ) ||
          cleanText(
            a.data_source
          ).localeCompare(
            cleanText(
              b.data_source
            )
          )
      );

  return {
    csv:
      buildCsv(
        rows,
        PUBLIC_ENVIRONMENT_COLUMNS
      ),

    count:
      rows.length,
  };
}


export async function buildWebsitePackage(
  env,
  {
    siteIds,
    includeCorrosion = true,
    includeEnvironment = true,
  }
) {
  const selectedSiteIds =
    cleanIdArray(
      siteIds
    );

  if (
    selectedSiteIds.length ===
    0
  ) {
    throw new Error(
      "Select at least one Site for the public website dataset."
    );
  }

  const context =
    await loadSiteExportContext(
      env
    );

  const [
    siteExport,
    sourceExport,
    corrosionExport,
    environmentExport,
  ] =
    await Promise.all([
      Promise.resolve(
        buildSiteCsv(
          context,
          selectedSiteIds
        )
      ),

      buildSourcesCsv(
        env
      ),

      includeCorrosion
        ? buildCorrosionCsv(
            env
          )
        : Promise.resolve(
            null
          ),

      includeEnvironment
        ? buildEnvironmentCsv(
            env
          )
        : Promise.resolve(
            null
          ),
    ]);

  const files = {
    "data/sites.csv":
      siteExport.csv,

    "data/sources_public.csv":
      sourceExport.csv,
  };

  if (
    corrosionExport
  ) {
    files[
      "data/corrosion_observations.csv"
    ] =
      corrosionExport.csv;
  }

  if (
    environmentExport
  ) {
    files[
      "data/environmental_observations.csv"
    ] =
      environmentExport.csv;
  }

  return {
    files,

    counts: {
      sites:
        siteExport.count,

      sources:
        sourceExport.count,

      corrosion:
        corrosionExport
          ?.count ??
        0,

      environment:
        environmentExport
          ?.count ??
        0,
    },
  };
}


export async function buildWebsitePackageZip(
  env,
  options
) {
  const packageResult =
    await buildWebsitePackage(
      env,
      options
    );

  const zip =
    new JSZip();

  for (
    const [
      path,
      content,
    ]
    of Object.entries(
      packageResult.files
    )
  ) {
    zip.file(
      path,
      content
    );
  }

  const bytes =
    await zip.generateAsync({
      type:
        "uint8array",

      compression:
        "DEFLATE",

      compressionOptions: {
        level:
          6,
      },
    });

  return {
    ...packageResult,
    bytes,
  };
}