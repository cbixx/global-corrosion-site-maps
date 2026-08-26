const CURATOR_BUILD_ID = "native-curator-smoke-001";

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function handleSourcesList(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    return Response.json(
      {
        ok: false,
        error: "Supabase configuration is missing.",
      },
      {
        status: 500,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  const endpoint = new URL("/rest/v1/sources", env.SUPABASE_URL);

  endpoint.searchParams.set(
    "select",
    "id,source_code,source_title,authors_or_organization,publication_year,source_kind,source_type"
  );

  endpoint.searchParams.set("order", "source_code.asc");

  const response = await fetch(endpoint, {
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    const detail = await response.text();

    console.error("Supabase sources request failed.", {
      status: response.status,
      detail,
    });

    return Response.json(
      {
        ok: false,
        error: "Unable to load sources.",
      },
      {
        status: 502,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  const sources = await response.json();

  return Response.json(
    {
      ok: true,
      sources,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

async function handleSourceDetail(env, sourceId) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    return Response.json(
      {
        ok: false,
        error: "Supabase configuration is missing.",
      },
      {
        status: 500,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  const id = Number(sourceId);

  if (!Number.isInteger(id) || id <= 0) {
    return Response.json(
      {
        ok: false,
        error: "Invalid source ID.",
      },
      {
        status: 400,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  const endpoint = new URL("/rest/v1/sources", env.SUPABASE_URL);

  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("id", `eq.${id}`);
  endpoint.searchParams.set("limit", "1");

  const response = await fetch(endpoint, {
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    console.error(
      "Supabase source detail request failed.",
      response.status,
      await response.text()
    );

    return Response.json(
      {
        ok: false,
        error: "Unable to load source.",
      },
      {
        status: 502,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  const rows = await response.json();
  const source = rows[0] || null;

  if (!source) {
    return Response.json(
      {
        ok: false,
        error: "Source not found.",
      },
      {
        status: 404,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  return Response.json(
    {
      ok: true,
      source,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

const EDITABLE_SOURCE_FIELDS = new Set([
  "source_code",
  "source_kind",
  "source_type",
  "source_title",
  "authors_or_organization",
  "publication_year",
  "doi",
  "public_url",
  "display_citation",
  "public_notes",
  "programme",
  "metals",
  "exposure_periods",
  "local_file_name",
  "source_url",
  "private_pdf_object_key",
  "notes",
]);

async function handleSourceUpdate(request, env, sourceId) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    return Response.json(
      {
        ok: false,
        error: "Supabase configuration is missing.",
      },
      {
        status: 500,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  const id = Number(sourceId);

  if (!Number.isInteger(id) || id <= 0) {
    return Response.json(
      {
        ok: false,
        error: "Invalid source ID.",
      },
      {
        status: 400,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Invalid JSON body.",
      },
      {
        status: 400,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  const updates = {};

  for (const [field, value] of Object.entries(payload || {})) {
    if (!EDITABLE_SOURCE_FIELDS.has(field)) {
      continue;
    }

    updates[field] =
      value === null || value === undefined
        ? ""
        : String(value).trim();
  }

  if (Object.keys(updates).length === 0) {
    return Response.json(
      {
        ok: false,
        error: "No editable fields were supplied.",
      },
      {
        status: 400,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  if (Object.hasOwn(updates, "source_code")) {
    updates.source_code =
      normaliseSourceCode(
        updates.source_code
      );

    if (
      !isCanonicalSourceCode(
        updates.source_code
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Source code must resolve to canonical sNNN format.",
        },
        {
          status: 400,
          headers: {
            "cache-control": "no-store",
          },
        }
      );
    }

    try {
      if (
        await sourceCodeExists(
          env,
          updates.source_code,
          id
        )
      ) {
        return Response.json(
          {
            ok: false,
            error:
              `Source code ${updates.source_code} already exists.`,
          },
          {
            status: 409,
            headers: {
              "cache-control": "no-store",
            },
          }
        );
      }
    } catch (error) {
      console.error(error);

      return Response.json(
        {
          ok: false,
          error:
            "Unable to verify Source-code uniqueness.",
        },
        {
          status: 502,
          headers: {
            "cache-control": "no-store",
          },
        }
      );
    }
  }

  const endpoint = new URL("/rest/v1/sources", env.SUPABASE_URL);
  endpoint.searchParams.set("id", `eq.${id}`);

  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      "content-type": "application/json",
      accept: "application/json",
      prefer: "return=representation",
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const detail = await response.text();

    console.error("Supabase source update failed.", {
      status: response.status,
      detail,
    });

    return Response.json(
      {
        ok: false,
        error: "Unable to save source.",
      },
      {
        status: 502,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  const rows = await response.json();
  const source = rows[0] || null;

  if (!source) {
    return Response.json(
      {
        ok: false,
        error: "Source not found.",
      },
      {
        status: 404,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  return Response.json(
    {
      ok: true,
      source,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

const EDITABLE_SITE_FIELDS = new Set([
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
]);

async function handleSitesList(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    return Response.json(
      { ok: false, error: "Supabase configuration is missing." },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }

  const endpoint = new URL("/rest/v1/sites", env.SUPABASE_URL);

  endpoint.searchParams.set(
    "select",
    [
      "id",
      "site_id",
      "site_label",
      "site_type",
      "latitude",
      "longitude",
      "modern_country_location",
      "administering_country",
      "region_category",
    ].join(",")
  );

  endpoint.searchParams.set("order", "site_id.asc");

  const response = await fetch(endpoint, {
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    const detail = await response.text();

    console.error("Supabase sites request failed.", {
      status: response.status,
      detail,
    });

    return Response.json(
      { ok: false, error: "Unable to load sites." },
      { status: 502, headers: { "cache-control": "no-store" } }
    );
  }

  return Response.json(
    {
      ok: true,
      sites: await response.json(),
    },
    {
      headers: { "cache-control": "no-store" },
    }
  );
}

async function handleSiteDetail(env, siteId) {
  const id = Number(siteId);

  if (!Number.isInteger(id) || id <= 0) {
    return Response.json(
      { ok: false, error: "Invalid site ID." },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const endpoint = new URL("/rest/v1/sites", env.SUPABASE_URL);

  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("id", `eq.${id}`);
  endpoint.searchParams.set("limit", "1");

  const response = await fetch(endpoint, {
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    console.error(
      "Supabase site detail request failed.",
      response.status,
      await response.text()
    );

    return Response.json(
      { ok: false, error: "Unable to load site." },
      { status: 502, headers: { "cache-control": "no-store" } }
    );
  }

  const rows = await response.json();
  const site = rows[0] || null;

  if (!site) {
    return Response.json(
      { ok: false, error: "Site not found." },
      { status: 404, headers: { "cache-control": "no-store" } }
    );
  }

  return Response.json(
    { ok: true, site },
    { headers: { "cache-control": "no-store" } }
  );
}

async function handleSiteUpdate(request, env, siteId) {
  const id = Number(siteId);

  if (!Number.isInteger(id) || id <= 0) {
    return Response.json(
      { ok: false, error: "Invalid site ID." },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const updates = {};

  for (const [field, value] of Object.entries(payload || {})) {
    if (!EDITABLE_SITE_FIELDS.has(field)) {
      continue;
    }

    if (field === "latitude" || field === "longitude") {
      const number = Number(value);

      if (!Number.isFinite(number)) {
        return Response.json(
          { ok: false, error: `${field} must be a valid number.` },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }

      updates[field] = number;
      continue;
    }

    updates[field] =
      value === null || value === undefined
        ? ""
        : String(value).trim();
  }

  if (!updates.site_id) {
    return Response.json(
      { ok: false, error: "Site ID cannot be blank." },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  if (!updates.site_label) {
    return Response.json(
      { ok: false, error: "Site label cannot be blank." },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const endpoint = new URL("/rest/v1/sites", env.SUPABASE_URL);
  endpoint.searchParams.set("id", `eq.${id}`);

  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      "content-type": "application/json",
      accept: "application/json",
      prefer: "return=representation",
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const detail = await response.text();

    console.error("Supabase site update failed.", {
      status: response.status,
      detail,
    });

    return Response.json(
      { ok: false, error: "Unable to save site." },
      { status: 502, headers: { "cache-control": "no-store" } }
    );
  }

  const rows = await response.json();
  const site = rows[0] || null;

  if (!site) {
    return Response.json(
      { ok: false, error: "Site not found." },
      { status: 404, headers: { "cache-control": "no-store" } }
    );
  }

  return Response.json(
    { ok: true, site },
    { headers: { "cache-control": "no-store" } }
  );
}

async function handleSiteSourceLinks(env, siteId) {
  const id = Number(siteId);

  if (!Number.isInteger(id) || id <= 0) {
    return Response.json(
      { ok: false, error: "Invalid site ID." },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const endpoint = new URL("/rest/v1/site_sources", env.SUPABASE_URL);

  endpoint.searchParams.set(
    "select",
    [
      "id",
      "site_fk",
      "source_fk",
      "source_order",
      "metals",
      "exposure_periods",
      "notes",
      "sources(source_code,source_title,programme)"
    ].join(",")
  );

  endpoint.searchParams.set("site_fk", `eq.${id}`);
  endpoint.searchParams.set("order", "source_order.asc,source_fk.asc");

  const response = await fetch(endpoint, {
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    const detail = await response.text();

    console.error("Unable to load site-source links.", {
      status: response.status,
      detail,
    });

    return Response.json(
      { ok: false, error: "Unable to load linked sources." },
      { status: 502, headers: { "cache-control": "no-store" } }
    );
  }

  const rows = await response.json();

  const links = rows.map((row) => ({
    id: row.id,
    site_fk: row.site_fk,
    source_fk: row.source_fk,
    source_order: row.source_order,
    metals: row.metals || "",
    exposure_periods: row.exposure_periods || "",
    notes: row.notes || "",
    source_code: row.sources?.source_code || "",
    source_title: row.sources?.source_title || "",
    programme: row.sources?.programme || "",
  }));

  return Response.json(
    { ok: true, links },
    { headers: { "cache-control": "no-store" } }
  );
}

async function handleSiteSourceUpsert(request, env, siteId) {
  const siteFk = Number(siteId);

  if (!Number.isInteger(siteFk) || siteFk <= 0) {
    return Response.json(
      { ok: false, error: "Invalid site ID." },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const sourceFk = Number(payload.source_fk);
  const sourceOrder = Number(payload.source_order || 1);

  if (!Number.isInteger(sourceFk) || sourceFk <= 0) {
    return Response.json(
      { ok: false, error: "A valid source is required." },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  if (!Number.isInteger(sourceOrder) || sourceOrder < 1) {
    return Response.json(
      { ok: false, error: "Source order must be a positive integer." },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const link = {
    site_fk: siteFk,
    source_fk: sourceFk,
    source_order: sourceOrder,
    metals: String(payload.metals || "").trim(),
    exposure_periods: String(payload.exposure_periods || "").trim(),
    notes: String(payload.notes || "").trim(),
  };

  const endpoint = new URL("/rest/v1/site_sources", env.SUPABASE_URL);

  endpoint.searchParams.set(
    "on_conflict",
    "site_fk,source_fk"
  );

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      "content-type": "application/json",
      accept: "application/json",
      prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(link),
  });

  if (!response.ok) {
    const detail = await response.text();

    console.error("Unable to save site-source link.", {
      status: response.status,
      detail,
    });

    return Response.json(
      { ok: false, error: "Unable to save source link." },
      { status: 502, headers: { "cache-control": "no-store" } }
    );
  }

  const rows = await response.json();

  return Response.json(
    {
      ok: true,
      link: rows[0] || null,
    },
    { headers: { "cache-control": "no-store" } }
  );
}

async function handleSiteSourceDelete(env, siteId, linkId) {
  const siteFk = Number(siteId);
  const id = Number(linkId);

  if (
    !Number.isInteger(siteFk) ||
    siteFk <= 0 ||
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return Response.json(
      { ok: false, error: "Invalid link." },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const endpoint = new URL("/rest/v1/site_sources", env.SUPABASE_URL);

  endpoint.searchParams.set("id", `eq.${id}`);
  endpoint.searchParams.set("site_fk", `eq.${siteFk}`);

  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      accept: "application/json",
      prefer: "return=representation",
    },
  });

  if (!response.ok) {
    const detail = await response.text();

    console.error("Unable to delete site-source link.", {
      status: response.status,
      detail,
    });

    return Response.json(
      { ok: false, error: "Unable to remove source link." },
      { status: 502, headers: { "cache-control": "no-store" } }
    );
  }

  const rows = await response.json();

  if (rows.length === 0) {
    return Response.json(
      { ok: false, error: "Link not found." },
      { status: 404, headers: { "cache-control": "no-store" } }
    );
  }

  return Response.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } }
  );
}

async function handleSourceSiteLinks(env, sourceId) {
  const id = Number(sourceId);

  if (!Number.isInteger(id) || id <= 0) {
    return Response.json(
      { ok: false, error: "Invalid source ID." },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const endpoint = new URL("/rest/v1/site_sources", env.SUPABASE_URL);

  endpoint.searchParams.set(
    "select",
    [
      "id",
      "site_fk",
      "source_fk",
      "source_order",
      "metals",
      "exposure_periods",
      "notes",
      "sites(site_id,site_label,modern_country_location)"
    ].join(",")
  );

  endpoint.searchParams.set("source_fk", `eq.${id}`);
  endpoint.searchParams.set("order", "source_order.asc,site_fk.asc");

  const response = await fetch(endpoint, {
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    const detail = await response.text();

    console.error("Unable to load source-site links.", {
      status: response.status,
      detail,
    });

    return Response.json(
      { ok: false, error: "Unable to load linked sites." },
      { status: 502, headers: { "cache-control": "no-store" } }
    );
  }

  const rows = await response.json();

  const links = rows.map((row) => ({
    id: row.id,
    site_fk: row.site_fk,
    source_fk: row.source_fk,
    source_order: row.source_order,
    metals: row.metals || "",
    exposure_periods: row.exposure_periods || "",
    notes: row.notes || "",
    site_id: row.sites?.site_id || "",
    site_label: row.sites?.site_label || "",
    modern_country_location:
      row.sites?.modern_country_location || "",
  }));

  return Response.json(
    { ok: true, links },
    { headers: { "cache-control": "no-store" } }
  );
}

const SOURCE_KIND_OPTIONS = [
  "Literature",
  "Dataset",
  "Standard",
  "Technical report",
  "Website",
  "Other / independent",
];

const SOURCE_TYPE_OPTIONS = [
  "Journal Article",
  "Conference Paper",
  "Technical Report",
  "Standard",
  "Dataset",
  "Book / Chapter",
  "Website / Web Page",
  "Other",
];

const PROGRAMME_OPTIONS = [
  "ICP/UNECE",
  "MICAT",
  "ISOCORRAG",
  "Other / independent",
];

const METAL_OPTIONS = [
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
];

const EXPOSURE_PERIOD_OPTIONS = [
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
];

function normaliseSourceCode(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.pdf$/i, "");

  const match = text.match(/^s?0*(\d{1,4})$/);

  if (!match) {
    return text;
  }

  return `s${String(Number(match[1])).padStart(3, "0")}`;
}

function isCanonicalSourceCode(value) {
  return /^s\d{3}$/.test(
    String(value || "").trim().toLowerCase()
  );
}

function sourceCodeNumber(value) {
  const canonical = normaliseSourceCode(value);

  if (!isCanonicalSourceCode(canonical)) {
    return null;
  }

  return Number(canonical.slice(1));
}

function splitMetadataValues(value) {
  return String(value || "")
    .replaceAll(";", ",")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeOptionValues(...groups) {
  const merged = [];

  for (const group of groups) {
    for (const value of group || []) {
      const clean = String(value || "").trim();

      if (clean && !merged.includes(clean)) {
        merged.push(clean);
      }
    }
  }

  return merged;
}

function buildDefaultDisplayCitation(
  authorsOrOrganization,
  publicationYear,
  sourceTitle
) {
  const authors =
    String(authorsOrOrganization || "").trim();

  const year =
    String(publicationYear || "").trim();

  const title =
    String(sourceTitle || "").trim();

  if (authors && year && title) {
    return `${authors}. (${year}). ${title}.`;
  }

  if (authors && title) {
    return `${authors}. ${title}.`;
  }

  if (year && title) {
    return `(${year}). ${title}.`;
  }

  return title;
}

async function sourceCodeExists(
  env,
  sourceCode,
  excludeSourceId = null
) {
  const endpoint =
    new URL("/rest/v1/sources", env.SUPABASE_URL);

  endpoint.searchParams.set("select", "id");

  endpoint.searchParams.set(
    "source_code",
    `ilike.${sourceCode}`
  );

  if (
    Number.isInteger(Number(excludeSourceId)) &&
    Number(excludeSourceId) > 0
  ) {
    endpoint.searchParams.set(
      "id",
      `neq.${Number(excludeSourceId)}`
    );
  }

  endpoint.searchParams.set("limit", "1");

  const response = await fetch(endpoint, {
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    const detail = await response.text();

    console.error(
      "Unable to check source-code uniqueness.",
      {
        status: response.status,
        detail,
      }
    );

    throw new Error(
      "Unable to check source-code uniqueness."
    );
  }

  const rows = await response.json();

  return rows.length > 0;
}

async function handleSourceFormOptions(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    return Response.json(
      {
        ok: false,
        error: "Supabase configuration is missing.",
      },
      {
        status: 500,
        headers: { "cache-control": "no-store" },
      }
    );
  }

  const sourceEndpoint =
    new URL("/rest/v1/sources", env.SUPABASE_URL);

  sourceEndpoint.searchParams.set(
    "select",
    "source_code,programme,metals"
  );

  const sourceResponse = await fetch(
    sourceEndpoint,
    {
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        accept: "application/json",
      },
    }
  );

  if (!sourceResponse.ok) {
    const detail = await sourceResponse.text();

    console.error(
      "Unable to load Source form options.",
      {
        status: sourceResponse.status,
        detail,
      }
    );

    return Response.json(
      {
        ok: false,
        error: "Unable to load Source form options.",
      },
      {
        status: 502,
        headers: { "cache-control": "no-store" },
      }
    );
  }

  const sourceRows =
    await sourceResponse.json();

  let maxSourceNumber = 0;

  const existingProgrammes = [];
  const existingMetals = [];

  for (const row of sourceRows) {
    const number =
      sourceCodeNumber(row.source_code);

    if (
      number !== null &&
      number > maxSourceNumber
    ) {
      maxSourceNumber = number;
    }

    existingProgrammes.push(
      ...splitMetadataValues(row.programme)
    );

    existingMetals.push(
      ...splitMetadataValues(row.metals)
    );
  }

  let savedProgrammes = [];
  let savedMetals = [];

  try {
    const metadataEndpoint =
      new URL(
        "/rest/v1/metadata_options",
        env.SUPABASE_URL
      );

    metadataEndpoint.searchParams.set(
      "select",
      "category,value"
    );

    metadataEndpoint.searchParams.set(
      "order",
      "value.asc"
    );

    const metadataResponse =
      await fetch(metadataEndpoint, {
        headers: {
          apikey: env.SUPABASE_SECRET_KEY,
          accept: "application/json",
        },
      });

    if (metadataResponse.ok) {
      const metadataRows =
        await metadataResponse.json();

      savedProgrammes = metadataRows
        .filter(
          (row) => row.category === "programme"
        )
        .map((row) => row.value);

      savedMetals = metadataRows
        .filter(
          (row) => row.category === "metal"
        )
        .map((row) => row.value);
    } else {
      console.warn(
        "metadata_options could not be loaded.",
        metadataResponse.status
      );
    }
  } catch (error) {
    console.warn(
      "metadata_options lookup failed.",
      error
    );
  }

  const nextSourceCode =
    `s${String(maxSourceNumber + 1).padStart(3, "0")}`;

  return Response.json(
    {
      ok: true,

      next_source_code:
        nextSourceCode,

      source_kind_options:
        SOURCE_KIND_OPTIONS,

      source_type_options:
        SOURCE_TYPE_OPTIONS,

      programme_options:
        mergeOptionValues(
          PROGRAMME_OPTIONS,
          existingProgrammes,
          savedProgrammes
        ),

      metal_options:
        mergeOptionValues(
          METAL_OPTIONS,
          existingMetals,
          savedMetals
        ),

      exposure_period_options:
        EXPOSURE_PERIOD_OPTIONS,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

async function persistSourceMetadataOptions(
  env,
  source
) {
  const rows = [];

  for (
    const value
    of splitMetadataValues(source.programme)
  ) {
    rows.push({
      category: "programme",
      value,
    });
  }

  for (
    const value
    of splitMetadataValues(source.metals)
  ) {
    rows.push({
      category: "metal",
      value,
    });
  }

  const seen = new Set();

  const uniqueRows = rows.filter((row) => {
    const key =
      `${row.category}\u0000${row.value}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  if (uniqueRows.length === 0) {
    return;
  }

  try {
    const endpoint =
      new URL(
        "/rest/v1/metadata_options",
        env.SUPABASE_URL
      );

    endpoint.searchParams.set(
      "on_conflict",
      "category,value"
    );

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        "content-type": "application/json",
        prefer:
          "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(uniqueRows),
    });

    if (!response.ok) {
      console.warn(
        "Unable to persist Source metadata options.",
        response.status,
        await response.text()
      );
    }
  } catch (error) {
    console.warn(
      "Source metadata option persistence failed.",
      error
    );
  }
}

async function handleSourceCreate(request, env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    return Response.json(
      {
        ok: false,
        error: "Supabase configuration is missing.",
      },
      {
        status: 500,
        headers: { "cache-control": "no-store" },
      }
    );
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Invalid JSON body.",
      },
      {
        status: 400,
        headers: { "cache-control": "no-store" },
      }
    );
  }

  const source = {};

  for (const field of EDITABLE_SOURCE_FIELDS) {
    const value = payload?.[field];

    source[field] =
      value === null || value === undefined
        ? ""
        : String(value).trim();
  }

  source.source_code =
    normaliseSourceCode(source.source_code);

  const validationErrors = [];

  if (!source.source_code) {
    validationErrors.push(
      "Source code is required."
    );
  } else if (
    !isCanonicalSourceCode(source.source_code)
  ) {
    validationErrors.push(
      "Source code must resolve to canonical sNNN format."
    );
  }

  if (!source.programme) {
    validationErrors.push(
      "Source programme is required."
    );
  }

  if (!source.metals) {
    validationErrors.push(
      "At least one source metal is required."
    );
  }

  if (!source.exposure_periods) {
    validationErrors.push(
      "At least one source exposure period is required."
    );
  }

  if (validationErrors.length > 0) {
    return Response.json(
      {
        ok: false,
        error: validationErrors.join(" "),
        errors: validationErrors,
      },
      {
        status: 400,
        headers: { "cache-control": "no-store" },
      }
    );
  }

  try {
    if (
      await sourceCodeExists(
        env,
        source.source_code
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            `Source code ${source.source_code} already exists.`,
        },
        {
          status: 409,
          headers: { "cache-control": "no-store" },
        }
      );
    }
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        ok: false,
        error:
          "Unable to verify Source-code uniqueness.",
      },
      {
        status: 502,
        headers: { "cache-control": "no-store" },
      }
    );
  }

  /*
   * PDF/R2 creation is not part of 4B.
   * These fields will be populated by the dedicated
   * private-PDF workflow later.
   */
  source.local_file_name = "";
  source.private_pdf_object_key = "";

  if (!source.public_url) {
    source.public_url = source.source_url;
  }

  if (!source.display_citation) {
    source.display_citation =
      buildDefaultDisplayCitation(
        source.authors_or_organization,
        source.publication_year,
        source.source_title
      );
  }

  const endpoint =
    new URL("/rest/v1/sources", env.SUPABASE_URL);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      "content-type": "application/json",
      accept: "application/json",
      prefer: "return=representation",
    },
    body: JSON.stringify(source),
  });

  if (!response.ok) {
    const detail = await response.text();

    console.error(
      "Unable to create source.",
      {
        status: response.status,
        detail,
      }
    );

    const message =
      response.status === 409
        ? "That source code already exists."
        : "Unable to create source.";

    return Response.json(
      {
        ok: false,
        error: message,
      },
      {
        status:
          response.status === 409
            ? 409
            : 502,

        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  const rows = await response.json();
  const createdSource = rows[0] || null;

  await persistSourceMetadataOptions(
    env,
    source
  );

  return Response.json(
    {
      ok: true,
      source: createdSource,
    },
    {
      status: 201,
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

const COUNTRY_CODE_NAME_OVERRIDES = {
  "russia": "RU",
  "united states": "US",
  "united kingdom": "GB",
  "south korea": "KR",
  "north korea": "KP",
  "czech republic": "CZ",
  "bolivia": "BO",
  "venezuela": "VE",
  "iran": "IR",
  "syria": "SY",
  "tanzania": "TZ",
  "moldova": "MD",
  "laos": "LA",
  "vietnam": "VN",
  "taiwan": "CN",
  "chinese taipei": "CN",
};

let countryNameToCodeCache = null;

function normaliseSiteMatchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getCountryNameToCodeMap() {
  if (countryNameToCodeCache) {
    return countryNameToCodeCache;
  }

  const map = new Map();

  const displayNames =
    new Intl.DisplayNames(
      ["en"],
      { type: "region" }
    );

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  for (const first of letters) {
    for (const second of letters) {
      const code = `${first}${second}`;

      try {
        const name = displayNames.of(code);

        if (
          name &&
          name !== code
        ) {
          map.set(
            String(name).trim().toLowerCase(),
            code
          );
        }
      } catch {
        // Ignore invalid region codes.
      }
    }
  }

  countryNameToCodeCache = map;

  return map;
}

function getCountryCode(value) {
  let text =
    String(value || "").trim();

  if (!text) {
    return "";
  }

  if (/^[a-z]{2}$/i.test(text)) {
    return text.toUpperCase();
  }

  const lower = text.toLowerCase();

  if (
    lower === "antarctica" ||
    lower === "sub-antarctic islands"
  ) {
    return "AQ";
  }

  if (
    COUNTRY_CODE_NAME_OVERRIDES[lower]
  ) {
    return COUNTRY_CODE_NAME_OVERRIDES[lower];
  }

  if (text.includes(",")) {
    const lastPart =
      text.split(",").at(-1).trim();

    if (lastPart && lastPart !== text) {
      return getCountryCode(lastPart);
    }
  }

  return (
    getCountryNameToCodeMap().get(lower) || ""
  );
}

function buildSiteIdPrefix(
  modernCountryLocation,
  administeringCountry = "",
  suppliedCountryCode = ""
) {
  const locationCode =
    String(suppliedCountryCode || "")
      .trim()
      .toUpperCase() ||
    getCountryCode(modernCountryLocation);

  if (locationCode === "AQ") {
    const adminCode =
      getCountryCode(administeringCountry);

    if (adminCode) {
      return `AQ-${adminCode}`;
    }

    return "AQ";
  }

  return locationCode || "XX";
}

function firstNonemptyValue(
  existingValue,
  incomingValue
) {
  const existingText =
    existingValue === null ||
    existingValue === undefined
      ? ""
      : String(existingValue).trim();

  return existingText
    ? existingValue
    : incomingValue;
}

function splitSiteMetadata(value) {
  return String(value || "")
    .replaceAll(";", ",")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeSiteMetadata(
  existingValue,
  incomingValue
) {
  const merged = [];

  for (
    const value
    of [
      ...splitSiteMetadata(existingValue),
      ...splitSiteMetadata(incomingValue),
    ]
  ) {
    if (!merged.includes(value)) {
      merged.push(value);
    }
  }

  return merged.join(", ");
}

function mergeSiteNotes(
  existingValue,
  incomingValue
) {
  const existing =
    String(existingValue || "").trim();

  const incoming =
    String(incomingValue || "").trim();

  if (!incoming) {
    return existing;
  }

  if (!existing) {
    return incoming;
  }

  if (existing.includes(incoming)) {
    return existing;
  }

  return `${existing}\n${incoming}`;
}

async function loadSiteMatchCandidates(env) {
  const endpoint =
    new URL(
      "/rest/v1/sites",
      env.SUPABASE_URL
    );

  endpoint.searchParams.set(
    "select",
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
  );

  endpoint.searchParams.set(
    "order",
    "id.asc"
  );

  const response =
    await fetch(endpoint, {
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        accept: "application/json",
      },
    });

  if (!response.ok) {
    throw new Error(
      "Unable to inspect existing Sites."
    );
  }

  return response.json();
}

function findExistingSite(
  rows,
  values
) {
  const cleanSiteId =
    String(values.site_id || "")
      .trim()
      .toLowerCase();

  const cleanLabel =
    normaliseSiteMatchText(
      values.site_label
    );

  const cleanLocation =
    normaliseSiteMatchText(
      values.modern_country_location
    );

  if (cleanSiteId) {
    const existing =
      rows.find(
        (row) =>
          String(row.site_id || "")
            .trim()
            .toLowerCase() === cleanSiteId
      );

    if (existing) {
      return {
        site: existing,
        reason: "site_id",
      };
    }
  }

  if (cleanLabel && cleanLocation) {
    const existing =
      rows.find(
        (row) =>
          normaliseSiteMatchText(
            row.site_label
          ) === cleanLabel &&
          normaliseSiteMatchText(
            row.modern_country_location
          ) === cleanLocation
      );

    if (existing) {
      return {
        site: existing,
        reason:
          "site_label + modern_country_location",
      };
    }
  }

  const latitude =
    Number(values.latitude);

  const longitude =
    Number(values.longitude);

  const coordinateTolerance =
    0.0005;

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    (cleanLabel || cleanLocation)
  ) {
    const existing =
      rows.find((row) => {
        const rowLatitude =
          Number(row.latitude);

        const rowLongitude =
          Number(row.longitude);

        if (
          !Number.isFinite(rowLatitude) ||
          !Number.isFinite(rowLongitude)
        ) {
          return false;
        }

        const closeEnough =
          Math.abs(
            rowLatitude - latitude
          ) <= coordinateTolerance &&
          Math.abs(
            rowLongitude - longitude
          ) <= coordinateTolerance;

        if (!closeEnough) {
          return false;
        }

        return (
          normaliseSiteMatchText(
            row.site_label
          ) === cleanLabel ||
          normaliseSiteMatchText(
            row.modern_country_location
          ) === cleanLocation
        );
      });

    if (existing) {
      return {
        site: existing,
        reason:
          "coordinates + label/location",
      };
    }
  }

  return {
    site: null,
    reason: "",
  };
}

async function handleSiteIdSuggestion(
  request,
  env
) {
  const url =
    new URL(request.url);

  const country =
    String(
      url.searchParams.get("country") || ""
    ).trim();

  const administeringCountry =
    String(
      url.searchParams.get("admin") || ""
    ).trim();

  const countryCode =
    String(
      url.searchParams.get("country_code") || ""
    ).trim();

  const prefix =
    buildSiteIdPrefix(
      country,
      administeringCountry,
      countryCode
    );

  const endpoint =
    new URL(
      "/rest/v1/sites",
      env.SUPABASE_URL
    );

  endpoint.searchParams.set(
    "select",
    "site_id"
  );

  const response =
    await fetch(endpoint, {
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        accept: "application/json",
      },
    });

  if (!response.ok) {
    return Response.json(
      {
        ok: false,
        error:
          "Unable to generate Site ID.",
      },
      {
        status: 502,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  const rows =
    await response.json();

  let maxNumber = 0;

  const prefixText =
    `${prefix}-`.toUpperCase();

  for (const row of rows) {
    const siteId =
      String(row.site_id || "")
        .trim()
        .toUpperCase();

    if (!siteId.startsWith(prefixText)) {
      continue;
    }

    const suffix =
      siteId.slice(
        prefixText.length
      );

    if (/^\d+$/.test(suffix)) {
      maxNumber =
        Math.max(
          maxNumber,
          Number(suffix)
        );
    }
  }

  const suggestedSiteId =
    `${prefix}-${String(maxNumber + 1).padStart(3, "0")}`;

  return Response.json(
    {
      ok: true,
      prefix,
      suggested_site_id:
        suggestedSiteId,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

async function handleLocationSearch(
  request
) {
  const url =
    new URL(request.url);

  const query =
    String(
      url.searchParams.get("q") || ""
    ).trim();

  if (!query) {
    return Response.json(
      {
        ok: false,
        error:
          "Enter a place name first.",
      },
      {
        status: 400,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  const endpoint =
    new URL(
      "https://nominatim.openstreetmap.org/search"
    );

  endpoint.searchParams.set(
    "q",
    query
  );

  endpoint.searchParams.set(
    "format",
    "jsonv2"
  );

  endpoint.searchParams.set(
    "addressdetails",
    "1"
  );

  endpoint.searchParams.set(
    "limit",
    "5"
  );

  endpoint.searchParams.set(
    "accept-language",
    "en"
  );

  const response =
    await fetch(endpoint, {
      headers: {
        accept: "application/json",
        "user-agent":
          "CorrosionAtlasCurator/1.0 (corrosionatlas.org)",
        referer:
          "https://corrosionatlas.org/",
      },
    });

  if (!response.ok) {
    return Response.json(
      {
        ok: false,
        error:
          "Location search failed.",
      },
      {
        status: 502,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  const rows =
    await response.json();

  const results =
    rows.map((row) => {
      const address =
        row.address || {};

      const city =
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        address.county ||
        "";

      const country =
        address.country || "";

      let label = "";

      if (city && country) {
        label =
          `${city}, ${country}`;
      } else if (country) {
        label = country;
      } else {
        label =
          row.display_name || "";
      }

      const siteLabel =
        city ||
        String(
          row.display_name || ""
        )
          .split(",", 1)[0]
          .trim() ||
        label;

      return {
        label,
        site_label:
          siteLabel,

        full_label:
          row.display_name || label,

        latitude:
          Number(row.lat),

        longitude:
          Number(row.lon),

        country,

        country_code:
          String(
            address.country_code || ""
          ).toUpperCase(),
      };
    });

  return Response.json(
    {
      ok: true,
      results,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

async function handleSiteMatchPreview(
  request,
  env
) {
  let payload;

  try {
    payload =
      await request.json();
  } catch {
    return Response.json(
      {
        ok: false,
        error:
          "Invalid JSON body.",
      },
      { status: 400 }
    );
  }

  if (
    !String(
      payload.site_label || ""
    ).trim() ||
    payload.latitude === "" ||
    payload.latitude === null ||
    payload.latitude === undefined ||
    payload.longitude === "" ||
    payload.longitude === null ||
    payload.longitude === undefined
  ) {
    return Response.json({
      ok: true,
      checked: false,
      will_merge: false,
    });
  }

  const latitude =
    Number(payload.latitude);

  const longitude =
    Number(payload.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return Response.json({
      ok: true,
      checked: false,
      will_merge: false,
      message:
        "Existing-site check skipped: invalid coordinates.",
    });
  }

  const rows =
    await loadSiteMatchCandidates(env);

  const match =
    findExistingSite(
      rows,
      {
        ...payload,
        latitude,
        longitude,
      }
    );

  if (!match.site) {
    return Response.json({
      ok: true,
      checked: true,
      will_merge: false,
    });
  }

  return Response.json({
    ok: true,
    checked: true,
    will_merge: true,

    existing: {
      id: match.site.id,
      site_id:
        match.site.site_id || "",
      site_label:
        match.site.site_label || "",
      modern_country_location:
        match.site
          .modern_country_location || "",
    },

    match_reason:
      match.reason,
  });
}

async function handleSiteCreate(
  request,
  env
) {
  let payload;

  try {
    payload =
      await request.json();
  } catch {
    return Response.json(
      {
        ok: false,
        error:
          "Invalid JSON body.",
      },
      {
        status: 400,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  const site = {};

  for (
    const field
    of EDITABLE_SITE_FIELDS
  ) {
    const value =
      payload?.[field];

    if (
      field === "latitude" ||
      field === "longitude"
    ) {
      const number =
        Number(value);

      if (!Number.isFinite(number)) {
        return Response.json(
          {
            ok: false,
            error:
              `${field} must be a valid number.`,
          },
          { status: 400 }
        );
      }

      site[field] = number;
    } else {
      site[field] =
        value === null ||
        value === undefined
          ? ""
          : String(value).trim();
    }
  }

  const validationErrors = [];

  if (!site.site_id) {
    validationErrors.push(
      "Site ID is required."
    );
  }

  if (!site.site_label) {
    validationErrors.push(
      "Site label is required."
    );
  }

  if (
    payload.latitude === "" ||
    payload.latitude === null ||
    payload.latitude === undefined
  ) {
    validationErrors.push(
      "Latitude is required."
    );
  }

  if (
    payload.longitude === "" ||
    payload.longitude === null ||
    payload.longitude === undefined
  ) {
    validationErrors.push(
      "Longitude is required."
    );
  }

  if (!site.modern_country_location) {
    validationErrors.push(
      "Modern country / location is required."
    );
  }

  if (
    site.latitude < -90 ||
    site.latitude > 90
  ) {
    validationErrors.push(
      "Latitude must be between -90 and 90."
    );
  }

  if (
    site.longitude < -180 ||
    site.longitude > 180
  ) {
    validationErrors.push(
      "Longitude must be between -180 and 180."
    );
  }

  if (validationErrors.length) {
    return Response.json(
      {
        ok: false,
        error:
          validationErrors.join(" "),
        errors:
          validationErrors,
      },
      {
        status: 400,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  let candidateRows;

  try {
    candidateRows =
      await loadSiteMatchCandidates(env);
  } catch (error) {
    console.error(
      "Unable to inspect Site duplicates.",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to check for an existing Site.",
      },
      {
        status: 502,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  const match =
    findExistingSite(
      candidateRows,
      site
    );

  /*
   * Existing Site:
   * preserve populated scalar fields,
   * merge multi-value summary fields,
   * append new notes without duplication.
   */
  if (match.site) {
    const existing =
      match.site;

    const merged = {
      site_id:
        firstNonemptyValue(
          existing.site_id,
          site.site_id
        ),

      site_label:
        firstNonemptyValue(
          existing.site_label,
          site.site_label
        ),

      site_type:
        firstNonemptyValue(
          existing.site_type,
          site.site_type
        ),

      latitude:
        firstNonemptyValue(
          existing.latitude,
          site.latitude
        ),

      longitude:
        firstNonemptyValue(
          existing.longitude,
          site.longitude
        ),

      modern_country_location:
        firstNonemptyValue(
          existing.modern_country_location,
          site.modern_country_location
        ),

      administering_country:
        firstNonemptyValue(
          existing.administering_country,
          site.administering_country
        ),

      former_entity:
        firstNonemptyValue(
          existing.former_entity,
          site.former_entity
        ),

      region_category:
        mergeSiteMetadata(
          existing.region_category,
          site.region_category
        ),

      exposure_period:
        mergeSiteMetadata(
          existing.exposure_period,
          site.exposure_period
        ),

      metal:
        mergeSiteMetadata(
          existing.metal,
          site.metal
        ),

      notes:
        mergeSiteNotes(
          existing.notes,
          site.notes
        ),
    };

    const endpoint =
      new URL(
        "/rest/v1/sites",
        env.SUPABASE_URL
      );

    endpoint.searchParams.set(
      "id",
      `eq.${existing.id}`
    );

    const response =
      await fetch(endpoint, {
        method: "PATCH",
        headers: {
          apikey:
            env.SUPABASE_SECRET_KEY,

          "content-type":
            "application/json",

          accept:
            "application/json",

          prefer:
            "return=representation",
        },
        body:
          JSON.stringify(merged),
      });

    if (!response.ok) {
      console.error(
        "Unable to merge Site.",
        response.status,
        await response.text()
      );

      return Response.json(
        {
          ok: false,
          error:
            "Unable to merge existing Site.",
        },
        {
          status: 502,
          headers: {
            "cache-control": "no-store",
          },
        }
      );
    }

    const rows =
      await response.json();

    return Response.json(
      {
        ok: true,
        site:
          rows[0] || null,

        action:
          "merged",

        match_reason:
          match.reason,
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  const endpoint =
    new URL(
      "/rest/v1/sites",
      env.SUPABASE_URL
    );

  const response =
    await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey:
          env.SUPABASE_SECRET_KEY,

        "content-type":
          "application/json",

        accept:
          "application/json",

        prefer:
          "return=representation",
      },
      body:
        JSON.stringify(site),
    });

  if (!response.ok) {
    console.error(
      "Unable to create Site.",
      response.status,
      await response.text()
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to create Site.",
      },
      {
        status: 502,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  const rows =
    await response.json();

  return Response.json(
    {
      ok: true,
      site:
        rows[0] || null,

      action:
        "created",

      match_reason: "",
    },
    {
      status: 201,
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

async function getSupabaseTableCount(
  env,
  tableName
) {
  const endpoint =
    new URL(
      `/rest/v1/${tableName}`,
      env.SUPABASE_URL
    );

  endpoint.searchParams.set(
    "select",
    "id"
  );

  const response =
    await fetch(endpoint, {
      headers: {
        apikey:
          env.SUPABASE_SECRET_KEY,

        accept:
          "application/json",

        prefer:
          "count=exact",

        range:
          "0-0",
      },
    });

  if (!response.ok) {
    throw new Error(
      `Unable to count ${tableName}.`
    );
  }

  const contentRange =
    response.headers.get(
      "content-range"
    ) || "";

  const match =
    contentRange.match(
      /\/(\d+|\*)$/
    );

  if (
    !match ||
    match[1] === "*"
  ) {
    return 0;
  }

  return Number(match[1]);
}

async function handleDashboardSummary(env) {
  if (
    !env.SUPABASE_URL ||
    !env.SUPABASE_SECRET_KEY
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "Supabase configuration is missing.",
      },
      {
        status: 500,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }

  try {
    const [
      sites,
      sources,
      siteSources,
      corrosionObservations,
      environmentalObservations,
    ] = await Promise.all([
      getSupabaseTableCount(
        env,
        "sites"
      ),

      getSupabaseTableCount(
        env,
        "sources"
      ),

      getSupabaseTableCount(
        env,
        "site_sources"
      ),

      getSupabaseTableCount(
        env,
        "corrosion_observations"
      ),

      getSupabaseTableCount(
        env,
        "environmental_observations"
      ),
    ]);

    return Response.json(
      {
        ok: true,

        counts: {
          sites,
          sources,

          site_sources:
            siteSources,

          corrosion_observations:
            corrosionObservations,

          environmental_observations:
            environmentalObservations,
        },
      },
      {
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Unable to load dashboard summary.",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to load dashboard summary.",
      },
      {
        status: 502,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/api/health") {
      return Response.json(
        {
          ok: true,
          service: "corrosion-atlas-curator",
          buildId: CURATOR_BUILD_ID,
        },
        {
          headers: {
            "cache-control": "no-store",
          },
        }
      );
    }

    if (
      path === "/api/dashboard-summary" &&
      request.method === "GET"
    ) {
      return handleDashboardSummary(env);
    }
    
    if (
      path === "/api/location-search" &&
      request.method === "GET"
    ) {
      return handleLocationSearch(request);
    }

    if (
      path === "/api/site-id-suggestion" &&
      request.method === "GET"
    ) {
      return handleSiteIdSuggestion(
        request,
        env
      );
    }

    if (
      path === "/api/site-match-preview" &&
      request.method === "POST"
    ) {
      return handleSiteMatchPreview(
        request,
        env
      );
    }

    if (path === "/api/source-form-options" && request.method === "GET") {
      return handleSourceFormOptions(env);
    }
    
    if (path === "/api/sources" && request.method === "GET") {
      return handleSourcesList(env);
    }

    if (path === "/api/sources" && request.method === "POST") {
      return handleSourceCreate(request, env);
    }

    const sourceSitesMatch =
      path.match(/^\/api\/sources\/(\d+)\/sites$/);

    if (sourceSitesMatch && request.method === "GET") {
      return handleSourceSiteLinks(
        env,
        sourceSitesMatch[1]
      );
    }

    if (path === "/api/sites" && request.method === "GET") {
      return handleSitesList(env);
    }

    if (path === "/api/sites" && request.method === "POST") {
      return handleSiteCreate(request, env);
    }

    const siteDetailMatch = path.match(/^\/api\/sites\/(\d+)$/);

    if (siteDetailMatch && request.method === "GET") {
      return handleSiteDetail(env, siteDetailMatch[1]);
    }

    if (siteDetailMatch && request.method === "PATCH") {
      return handleSiteUpdate(request, env, siteDetailMatch[1]);
    }

    const siteSourcesMatch =
      path.match(/^\/api\/sites\/(\d+)\/sources$/);

    if (siteSourcesMatch && request.method === "GET") {
      return handleSiteSourceLinks(
        env,
        siteSourcesMatch[1]
      );
    }

    if (siteSourcesMatch && request.method === "POST") {
      return handleSiteSourceUpsert(
        request,
        env,
        siteSourcesMatch[1]
      );
    }

    const siteSourceLinkMatch =
      path.match(/^\/api\/sites\/(\d+)\/sources\/(\d+)$/);

    if (siteSourceLinkMatch && request.method === "DELETE") {
      return handleSiteSourceDelete(
        env,
        siteSourceLinkMatch[1],
        siteSourceLinkMatch[2]
      );
    }
    
    const sourceDetailMatch = path.match(/^\/api\/sources\/(\d+)$/);

    if (sourceDetailMatch && request.method === "GET") {
      return handleSourceDetail(env, sourceDetailMatch[1]);
    }

    if (sourceDetailMatch && request.method === "PATCH") {
      return handleSourceUpdate(request, env, sourceDetailMatch[1]);
    }

    if (path === "/") {
      return env.ASSETS.fetch(request);
    }

    if (path === "/sources") {
      if (url.pathname === "/sources") {
        return Response.redirect(new URL("/sources/", url).toString(), 302);
      }

      return env.ASSETS.fetch(request);
    }

    if (path === "/sites") {
      if (url.pathname === "/sites") {
        return Response.redirect(new URL("/sites/", url).toString(), 302);
      }

      return env.ASSETS.fetch(request);
    }
    
    return env.ASSETS.fetch(request);
  }
}
