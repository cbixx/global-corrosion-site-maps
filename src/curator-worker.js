import JSZip from "jszip";
import {
  readCorrosionWorkbook,
  validateCorrosionWorkbookRows,
} from "./corrosion-workbook-import.js";

import {
  buildPublishPreview,
  buildWebsitePackage,
  buildWebsitePackageZip,
} from "./publish-export.js";


import {
  getGitHubPublishStatus,
  publishWebsiteFilesToGitHub,
} from "./github-publish.js";

const CURATOR_BUILD_ID = "settings-001";

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

  for (
    const field
    of [
      "programme",
      "metals",
      "exposure_periods",
    ]
  ) {
    if (
      Object.hasOwn(
        updates,
        field
      )
    ) {
      updates[field] =
        mergeBulkMetadataValues(
          updates[field]
        );
    }
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

  await persistSourceMetadataOptions(
    env,
    source
  );

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

  if (
    Object.keys(
      updates
    ).length === 0
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "No editable fields were supplied.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  if (
    Object.hasOwn(
      updates,
      "site_id"
    ) &&
    !updates.site_id
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "Site ID cannot be blank.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  if (
    Object.hasOwn(
      updates,
      "site_label"
    ) &&
    !updates.site_label
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "Site label cannot be blank.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
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
      {
        ok: false,

        error:
          response.status === 409
            ? "The Site update conflicts with an existing record."
            : "Unable to save Site.",
      },
      {
        status:
          response.status === 409
            ? 409
            : 502,

        headers: {
          "cache-control":
            "no-store",
        },
      }
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

const REGION_CLASSIFICATION_SETTINGS_KEY =
  "region_classification_rules";

const COAST_TAGS =
  new Set([
    "Marine",
    "Coastal",
    "Near-coastal",
    "Inland",
  ]);

const SETTLEMENT_TAGS =
  new Set([
    "Urban",
    "Rural",
  ]);

const CLIMATE_TAGS =
  new Set([
    "Tropical",
    "Hot-arid",
    "Temperate",
    "Cold",
    "Extreme cold",
  ]);

const POLAR_TAGS =
  new Set([
    "Sub-arctic",
    "Sub-Antarctic",
    "Antarctic",
  ]);

const REGION_TAG_ORDER = {
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
};

const DEFAULT_REGION_CLASSIFICATION_SETTINGS = {
  distance_to_coast: {
    marine_km: 1.0,
    coastal_km: 10.0,
    near_coastal_km: 50.0,
  },

  latitude_rules: {
    antarctic_latitude_max: -60.0,

    sub_antarctic_latitude_min: -60.0,
    sub_antarctic_latitude_max: -45.0,

    sub_arctic_latitude_min: 60.0,
    sub_arctic_latitude_max: 66.5,

    tropical_abs_latitude_max: 23.5,
    cold_abs_latitude_min: 50.0,
    extreme_cold_abs_latitude_min: 66.5,
  },

  temperature_rules: {
    use_temperature_when_available: true,

    tropical_mean_temperature_min: 18.0,
    temperate_mean_temperature_min: 5.0,

    cold_mean_temperature_max: 5.0,
    extreme_cold_mean_temperature_max: 0.0,
  },

  semantic_rules: {
    island_country_hints: [
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
      "tonga",
      "trinidad and tobago",
      "tuvalu",
      "united kingdom",
      "vanuatu",
    ],

    island_text_patterns: [
      "\\bisland\\b",
      "\\bislands\\b",
      "\\bisle\\b",
      "\\bisles\\b",
      "\\barchipelago\\b",
      "\\batoll\\b",
    ],

    urban_patterns: [
      "\\bcity\\b",
      "\\btown\\b",
      "\\burban\\b",
      "\\bmetropolitan\\b",
      "\\bport city\\b",
    ],

    rural_patterns: [
      "\\brural\\b",
      "\\bvillage\\b",
      "\\bfield site\\b",
      "\\brural monitoring site\\b",
    ],

    industrial_patterns: [
      "\\bindustrial\\b",
      "\\bindustry\\b",
      "\\bfactory\\b",
      "\\brefinery\\b",
      "\\bpower plant\\b",
      "\\bsteelworks\\b",
      "\\bsmelter\\b",
    ],

    hot_arid_patterns: [
      "\\barid\\b",
      "\\bdesert\\b",
      "\\bsahara\\b",
      "\\barabian desert\\b",
      "\\bgobi\\b",
    ],
  },
};

function mergeRegionClassificationSettings(
  settings
) {
  const merged =
    structuredClone(
      DEFAULT_REGION_CLASSIFICATION_SETTINGS
    );

  if (
    !settings ||
    typeof settings !== "object" ||
    Array.isArray(settings)
  ) {
    return merged;
  }

  for (
    const [
      groupKey,
      groupValue,
    ]
    of Object.entries(settings)
  ) {
    if (
      groupValue &&
      typeof groupValue === "object" &&
      !Array.isArray(groupValue) &&
      merged[groupKey] &&
      typeof merged[groupKey] === "object" &&
      !Array.isArray(merged[groupKey])
    ) {
      Object.assign(
        merged[groupKey],
        groupValue
      );
    } else {
      merged[groupKey] =
        groupValue;
    }
  }

  return merged;
}

function regionSettingsNumber(
  settings,
  group,
  key,
  fallback
) {
  const value =
    Number(
      settings?.[group]?.[key]
    );

  return Number.isFinite(value)
    ? value
    : fallback;
}

function regionSettingsPatterns(
  settings,
  group,
  key,
  fallback
) {
  const value =
    settings?.[group]?.[key];

  if (Array.isArray(value)) {
    return value
      .map(
        (item) =>
          String(item || "").trim()
      )
      .filter(Boolean);
  }

  if (
    typeof value === "string"
  ) {
    return value
      .split(/\r?\n/)
      .map(
        (item) =>
          item.trim()
      )
      .filter(Boolean);
  }

  return fallback;
}

function splitRegionTags(value) {
  return String(value || "")
    .replaceAll(";", ",")
    .split(",")
    .map(
      (tag) => tag.trim()
    )
    .filter(Boolean);
}

function orderedRegionTags(tags) {
  const unique =
    [...new Set(
      tags.filter(Boolean)
    )];

  return unique.sort(
    (a, b) =>
      (
        REGION_TAG_ORDER[a] ??
        999
      ) -
      (
        REGION_TAG_ORDER[b] ??
        999
      )
  );
}

function normaliseRegionTags(tags) {
  return orderedRegionTags(
    tags
  ).join(", ");
}

function buildRegionTextBlob(
  ...values
) {
  return values
    .map(
      (value) =>
        String(value || "")
    )
    .join(" ")
    .toLowerCase();
}

function regionHasPattern(
  text,
  patterns
) {
  for (const pattern of patterns) {
    try {
      if (
        new RegExp(
          pattern,
          "i"
        ).test(text)
      ) {
        return true;
      }
    } catch (error) {
      console.warn(
        "Ignoring invalid region regex.",
        pattern,
        error
      );
    }
  }

  return false;
}

function optionalRegionNumber(
  value
) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

async function loadRegionClassificationSettings(
  env
) {
  const endpoint =
    new URL(
      "/rest/v1/app_settings",
      env.SUPABASE_URL
    );

  endpoint.searchParams.set(
    "select",
    "payload_json"
  );

  endpoint.searchParams.set(
    "setting_key",
    `eq.${REGION_CLASSIFICATION_SETTINGS_KEY}`
  );

  endpoint.searchParams.set(
    "limit",
    "1"
  );

  try {
    const response =
      await fetch(endpoint, {
        headers: {
          apikey:
            env.SUPABASE_SECRET_KEY,

          authorization:
            `Bearer ${env.SUPABASE_SECRET_KEY}`,

          accept:
            "application/json",
        },
      });

    if (!response.ok) {
      console.warn(
        "Unable to load saved region settings.",
        response.status,
        await response.text()
      );

      return mergeRegionClassificationSettings(
        null
      );
    }

    const rows =
      await response.json();

    if (!rows.length) {
      return mergeRegionClassificationSettings(
        null
      );
    }

    let payload =
      rows[0].payload_json;

    if (
      typeof payload === "string"
    ) {
      try {
        payload =
          JSON.parse(payload);
      } catch (error) {
        console.warn(
          "Saved region settings are invalid JSON.",
          error
        );

        payload = null;
      }
    }

    return mergeRegionClassificationSettings(
      payload
    );
  } catch (error) {
    console.warn(
      "Region settings lookup failed.",
      error
    );

    return mergeRegionClassificationSettings(
      null
    );
  }
}

async function getRegionSpatialContext(
  env,
  latitude,
  longitude
) {
  const endpoint =
    new URL(
      "/rest/v1/rpc/region_spatial_context",
      env.SUPABASE_URL
    );

  const response =
    await fetch(endpoint, {
      method: "POST",

      headers: {
        apikey:
          env.SUPABASE_SECRET_KEY,

        authorization:
          `Bearer ${env.SUPABASE_SECRET_KEY}`,

        "content-type":
          "application/json",

        accept:
          "application/json",
      },

      body:
        JSON.stringify({
          p_latitude:
            latitude,

          p_longitude:
            longitude,
        }),
    });

  if (!response.ok) {
    const detail =
      await response.text();

    console.error(
      "PostGIS region spatial lookup failed.",
      {
        status:
          response.status,

        detail,
      }
    );

    throw new Error(
      "Unable to calculate geographic context."
    );
  }

  const rows =
    await response.json();

  const row =
    rows[0];

  if (!row) {
    throw new Error(
      "Region spatial lookup returned no result."
    );
  }

  return {
    on_land:
      Boolean(row.on_land),

    coast_distance_km:
      row.coast_distance_km === null ||
      row.coast_distance_km === undefined
        ? null
        : Number(
            row.coast_distance_km
          ),
  };
}

function classifyCoastalContext(
  spatial,
  notes,
  settings
) {
  const distance =
    spatial.coast_distance_km;

  if (
    Number.isFinite(distance)
  ) {
    notes.push(
      `Nearest coastline distance ≈ ${distance.toFixed(1)} km.`
    );
  }

  if (!spatial.on_land) {
    notes.push(
      "Point appears offshore or outside the Natural Earth land polygon; classified as Marine."
    );

    return "Marine";
  }

  if (
    !Number.isFinite(distance)
  ) {
    return null;
  }

  const marineKm =
    regionSettingsNumber(
      settings,
      "distance_to_coast",
      "marine_km",
      1.0
    );

  const coastalKm =
    regionSettingsNumber(
      settings,
      "distance_to_coast",
      "coastal_km",
      10.0
    );

  const nearCoastalKm =
    regionSettingsNumber(
      settings,
      "distance_to_coast",
      "near_coastal_km",
      50.0
    );

  if (distance <= marineKm) {
    return "Marine";
  }

  if (distance <= coastalKm) {
    return "Coastal";
  }

  if (
    distance <=
    nearCoastalKm
  ) {
    return "Near-coastal";
  }

  return "Inland";
}

function classifyIsland(
  text,
  modernCountryLocation,
  settings
) {
  const fallbackPatterns =
    DEFAULT_REGION_CLASSIFICATION_SETTINGS
      .semantic_rules
      .island_text_patterns;

  const patterns =
    regionSettingsPatterns(
      settings,
      "semantic_rules",
      "island_text_patterns",
      fallbackPatterns
    );

  if (
    regionHasPattern(
      text,
      patterns
    )
  ) {
    return true;
  }

  const fallbackCountries =
    DEFAULT_REGION_CLASSIFICATION_SETTINGS
      .semantic_rules
      .island_country_hints;

  const countryHints =
    new Set(
      regionSettingsPatterns(
        settings,
        "semantic_rules",
        "island_country_hints",
        fallbackCountries
      ).map(
        (item) =>
          item.toLowerCase()
      )
    );

  const country =
    String(
      modernCountryLocation || ""
    )
      .trim()
      .toLowerCase();

  return countryHints.has(
    country
  );
}

function classifySettlement(
  text,
  settings
) {
  const urbanPatterns =
    regionSettingsPatterns(
      settings,
      "semantic_rules",
      "urban_patterns",
      DEFAULT_REGION_CLASSIFICATION_SETTINGS
        .semantic_rules
        .urban_patterns
    );

  const ruralPatterns =
    regionSettingsPatterns(
      settings,
      "semantic_rules",
      "rural_patterns",
      DEFAULT_REGION_CLASSIFICATION_SETTINGS
        .semantic_rules
        .rural_patterns
    );

  if (
    regionHasPattern(
      text,
      urbanPatterns
    )
  ) {
    return "Urban";
  }

  if (
    regionHasPattern(
      text,
      ruralPatterns
    )
  ) {
    return "Rural";
  }

  return null;
}

function classifyIndustrial(
  text,
  settings
) {
  const patterns =
    regionSettingsPatterns(
      settings,
      "semantic_rules",
      "industrial_patterns",
      DEFAULT_REGION_CLASSIFICATION_SETTINGS
        .semantic_rules
        .industrial_patterns
    );

  return regionHasPattern(
    text,
    patterns
  );
}

function classifyPolarContext(
  latitude,
  text,
  islandDetected,
  settings
) {
  const tags = [];

  const antarcticMax =
    regionSettingsNumber(
      settings,
      "latitude_rules",
      "antarctic_latitude_max",
      -60.0
    );

  const subAntarcticMin =
    regionSettingsNumber(
      settings,
      "latitude_rules",
      "sub_antarctic_latitude_min",
      -60.0
    );

  const subAntarcticMax =
    regionSettingsNumber(
      settings,
      "latitude_rules",
      "sub_antarctic_latitude_max",
      -45.0
    );

  const subArcticMin =
    regionSettingsNumber(
      settings,
      "latitude_rules",
      "sub_arctic_latitude_min",
      60.0
    );

  const subArcticMax =
    regionSettingsNumber(
      settings,
      "latitude_rules",
      "sub_arctic_latitude_max",
      66.5
    );

  if (
    text.includes(
      "sub-antarctic"
    ) ||
    text.includes(
      "subantarctic"
    )
  ) {
    tags.push(
      "Sub-Antarctic"
    );
  } else if (
    latitude >
      subAntarcticMin &&
    latitude <=
      subAntarcticMax &&
    islandDetected
  ) {
    tags.push(
      "Sub-Antarctic"
    );
  }

  if (
    text.includes(
      "antarctica"
    ) ||
    latitude <= antarcticMax
  ) {
    tags.push(
      "Antarctic"
    );
  }

  if (
    text.includes(
      "sub-arctic"
    ) ||
    text.includes(
      "subarctic"
    )
  ) {
    tags.push(
      "Sub-arctic"
    );
  } else if (
    latitude >= subArcticMin &&
    latitude < subArcticMax
  ) {
    tags.push(
      "Sub-arctic"
    );
  }

  return tags;
}

function classifyClimateContext(
  latitude,
  text,
  settings,
  annualMeanTemperature = null
) {
  const hotAridPatterns =
    regionSettingsPatterns(
      settings,
      "semantic_rules",
      "hot_arid_patterns",
      DEFAULT_REGION_CLASSIFICATION_SETTINGS
        .semantic_rules
        .hot_arid_patterns
    );

  if (
    regionHasPattern(
      text,
      hotAridPatterns
    )
  ) {
    return {
      tag:
        "Hot-arid",

      basis:
        "text pattern",
    };
  }

  const temperature =
    optionalRegionNumber(
      annualMeanTemperature
    );

  const useTemperature =
    settings
      ?.temperature_rules
      ?.use_temperature_when_available !==
      false;

  if (
    useTemperature &&
    temperature !== null
  ) {
    const tropicalMin =
      regionSettingsNumber(
        settings,
        "temperature_rules",
        "tropical_mean_temperature_min",
        18.0
      );

    const temperateMin =
      regionSettingsNumber(
        settings,
        "temperature_rules",
        "temperate_mean_temperature_min",
        5.0
      );

    const coldMax =
      regionSettingsNumber(
        settings,
        "temperature_rules",
        "cold_mean_temperature_max",
        5.0
      );

    const extremeColdMax =
      regionSettingsNumber(
        settings,
        "temperature_rules",
        "extreme_cold_mean_temperature_max",
        0.0
      );

    if (
      temperature <=
      extremeColdMax
    ) {
      return {
        tag:
          "Extreme cold",

        basis:
          "annual mean temperature",
      };
    }

    if (
      temperature <= coldMax
    ) {
      return {
        tag:
          "Cold",

        basis:
          "annual mean temperature",
      };
    }

    if (
      temperature >= tropicalMin
    ) {
      return {
        tag:
          "Tropical",

        basis:
          "annual mean temperature",
      };
    }

    if (
      temperature >= temperateMin
    ) {
      return {
        tag:
          "Temperate",

        basis:
          "annual mean temperature",
      };
    }

    return {
      tag:
        "Temperate",

      basis:
        "annual mean temperature",
    };
  }

  const absoluteLatitude =
    Math.abs(latitude);

  const tropicalMax =
    regionSettingsNumber(
      settings,
      "latitude_rules",
      "tropical_abs_latitude_max",
      23.5
    );

  const coldMin =
    regionSettingsNumber(
      settings,
      "latitude_rules",
      "cold_abs_latitude_min",
      50.0
    );

  const extremeColdMin =
    regionSettingsNumber(
      settings,
      "latitude_rules",
      "extreme_cold_abs_latitude_min",
      66.5
    );

  const antarcticMax =
    regionSettingsNumber(
      settings,
      "latitude_rules",
      "antarctic_latitude_max",
      -60.0
    );

  if (
    latitude <= antarcticMax ||
    absoluteLatitude >=
      extremeColdMin
  ) {
    return {
      tag:
        "Extreme cold",

      basis:
        "latitude/text heuristic",
    };
  }

  if (
    absoluteLatitude <=
    tropicalMax
  ) {
    return {
      tag:
        "Tropical",

      basis:
        "latitude/text heuristic",
    };
  }

  if (
    absoluteLatitude >=
    coldMin
  ) {
    return {
      tag:
        "Cold",

      basis:
        "latitude/text heuristic",
    };
  }

  return {
    tag:
      "Temperate",

    basis:
      "latitude/text heuristic",
  };
}

function mergeExistingRegionTags(
  existingTags,
  inferredTags
) {
  const inferredSet =
    new Set(
      inferredTags
    );

  const inferredHasCoast =
    [...COAST_TAGS].some(
      (tag) =>
        inferredSet.has(tag)
    );

  const inferredHasSettlement =
    [...SETTLEMENT_TAGS].some(
      (tag) =>
        inferredSet.has(tag)
    );

  const inferredHasClimate =
    [...CLIMATE_TAGS].some(
      (tag) =>
        inferredSet.has(tag)
    );

  const inferredHasPolar =
    [...POLAR_TAGS].some(
      (tag) =>
        inferredSet.has(tag)
    );

  const preserved = [];

  for (
    const tag
    of existingTags
  ) {
    if (
      COAST_TAGS.has(tag) &&
      inferredHasCoast
    ) {
      continue;
    }

    if (
      SETTLEMENT_TAGS.has(tag) &&
      inferredHasSettlement
    ) {
      continue;
    }

    if (
      CLIMATE_TAGS.has(tag) &&
      inferredHasClimate
    ) {
      continue;
    }

    if (
      POLAR_TAGS.has(tag) &&
      inferredHasPolar
    ) {
      continue;
    }

    preserved.push(tag);
  }

  return orderedRegionTags([
    ...preserved,
    ...inferredTags,
  ]);
}

async function classifyRegion(
  env,
  {
    latitude,
    longitude,

    current_region_category = "",

    modern_country_location = "",

    site_type = "",

    annual_mean_temperature = null,
  }
) {
  const lat =
    Number(latitude);

  const lon =
    Number(longitude);

  const existingTags =
    splitRegionTags(
      current_region_category
    );

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return {
      region_category:
        normaliseRegionTags(
          existingTags
        ),

      notes:
        "Skipped: missing or invalid coordinates.",

      spatial:
        null,
    };
  }

  if (
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return {
      region_category:
        normaliseRegionTags(
          existingTags
        ),

      notes:
        "Skipped: coordinates outside valid latitude/longitude range.",

      spatial:
        null,
    };
  }

  const settings =
    await loadRegionClassificationSettings(
      env
    );

  const spatial =
    await getRegionSpatialContext(
      env,
      lat,
      lon
    );

  const text =
    buildRegionTextBlob(
      modern_country_location,
      site_type,
      current_region_category
    );

  const notes = [];
  const inferredTags = [];

  const coastalContext =
    classifyCoastalContext(
      spatial,
      notes,
      settings
    );

  if (coastalContext) {
    inferredTags.push(
      coastalContext
    );
  }

  const islandDetected =
    classifyIsland(
      text,
      modern_country_location,
      settings
    );

  if (islandDetected) {
    inferredTags.push(
      "Island"
    );

    notes.push(
      "Island flag inferred from location/site text or island-country hint."
    );
  }

  if (
    classifyIndustrial(
      text,
      settings
    )
  ) {
    inferredTags.push(
      "Industrial"
    );

    notes.push(
      "Industrial flag inferred from site/location text."
    );
  }

  const settlement =
    classifySettlement(
      text,
      settings
    );

  if (settlement) {
    inferredTags.push(
      settlement
    );

    notes.push(
      `Settlement context inferred as ${settlement} from site/location text.`
    );
  }

  const polarTags =
    classifyPolarContext(
      lat,
      text,
      islandDetected,
      settings
    );

  inferredTags.push(
    ...polarTags
  );

  if (
    polarTags.length > 0
  ) {
    notes.push(
      "Polar/subpolar context inferred from latitude and/or explicit text."
    );
  }

  const climate =
    classifyClimateContext(
      lat,
      text,
      settings,
      annual_mean_temperature
    );

  inferredTags.push(
    climate.tag
  );

  notes.push(
    `Broad climate context suggested as ${climate.tag} using ${climate.basis}.`
  );

  const finalTags =
    mergeExistingRegionTags(
      existingTags,
      inferredTags
    );

  return {
    region_category:
      normaliseRegionTags(
        finalTags
      ),

    notes:
      notes.join(" "),

    spatial,
  };
}

async function handleRegionClassification(
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
          "cache-control":
            "no-store",
        },
      }
    );
  }

  try {
    const result =
      await classifyRegion(
        env,
        payload || {}
      );

    return Response.json(
      {
        ok: true,

        region_category:
          result.region_category,

        notes:
          result.notes,

        spatial:
          result.spatial,
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
      "Region classification failed.",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to classify region.",
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

const SITE_SOURCE_LINK_BASELINE_KEY =
  "site_source_link_last_successful_site_max_id";


function cleanIdArray(value) {
  if (!Array.isArray(value)) {
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


function mergeBulkMetadataValues(
  ...values
) {
  const merged = [];

  for (const value of values) {
    for (
      const item
      of String(value || "")
        .replaceAll(";", ",")
        .split(",")
        .map(
          (part) =>
            part.trim()
        )
        .filter(Boolean)
    ) {
      if (!merged.includes(item)) {
        merged.push(item);
      }
    }
  }

  return merged.join(", ");
}


function parseStoredSetting(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value !== "string"
  ) {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}


async function saveAppSetting(
  env,
  settingKey,
  value
) {
  const endpoint =
    new URL(
      "/rest/v1/app_settings",
      env.SUPABASE_URL
    );

  endpoint.searchParams.set(
    "on_conflict",
    "setting_key"
  );

  const response =
    await fetch(endpoint, {
      method: "POST",

      headers: {
        apikey:
          env.SUPABASE_SECRET_KEY,

        authorization:
          `Bearer ${env.SUPABASE_SECRET_KEY}`,

        "content-type":
          "application/json",

        prefer:
          "resolution=merge-duplicates,return=minimal",
      },

      body:
        JSON.stringify({
          setting_key:
            settingKey,

          payload_json:
            JSON.stringify(value),

          updated_at:
            new Date().toISOString(),
        }),
    });

  if (!response.ok) {
    throw new Error(
      `Unable to save app setting ${settingKey}.`
    );
  }
}


async function handleLinkingOptions(
  env
) {
  const sitesEndpoint =
    new URL(
      "/rest/v1/sites",
      env.SUPABASE_URL
    );

  sitesEndpoint.searchParams.set(
    "select",
    [
      "id",
      "site_id",
      "site_label",
      "modern_country_location",
    ].join(",")
  );

  sitesEndpoint.searchParams.set(
    "order",
    "site_id.asc"
  );


  const sourcesEndpoint =
    new URL(
      "/rest/v1/sources",
      env.SUPABASE_URL
    );

  sourcesEndpoint.searchParams.set(
    "select",
    [
      "id",
      "source_code",
      "source_title",
      "programme",
      "metals",
      "exposure_periods",
    ].join(",")
  );

  sourcesEndpoint.searchParams.set(
    "order",
    "source_code.asc"
  );


  const settingEndpoint =
    new URL(
      "/rest/v1/app_settings",
      env.SUPABASE_URL
    );

  settingEndpoint.searchParams.set(
    "select",
    "payload_json"
  );

  settingEndpoint.searchParams.set(
    "setting_key",
    `eq.${SITE_SOURCE_LINK_BASELINE_KEY}`
  );

  settingEndpoint.searchParams.set(
    "limit",
    "1"
  );


  const headers = {
    apikey:
      env.SUPABASE_SECRET_KEY,

    authorization:
      `Bearer ${env.SUPABASE_SECRET_KEY}`,

    accept:
      "application/json",
  };


  const [
    sitesResponse,
    sourcesResponse,
    settingResponse,
  ] = await Promise.all([
    fetch(
      sitesEndpoint,
      { headers }
    ),

    fetch(
      sourcesEndpoint,
      { headers }
    ),

    fetch(
      settingEndpoint,
      { headers }
    ),
  ]);


  if (
    !sitesResponse.ok ||
    !sourcesResponse.ok
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "Unable to load linking options.",
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


  const sites =
    await sitesResponse.json();

  const sources =
    await sourcesResponse.json();

  let baseline = null;

  if (settingResponse.ok) {
    const rows =
      await settingResponse.json();

    if (rows.length) {
      baseline =
        Number(
          parseStoredSetting(
            rows[0].payload_json
          )
        );
    }
  }


  const currentMaxSiteId =
    sites.reduce(
      (maxValue, site) =>
        Math.max(
          maxValue,
          Number(site.id) || 0
        ),
      0
    );


  /*
   * Legacy behavior:
   * first use establishes the current maximum
   * as the baseline, so nothing pre-existing is
   * considered "new".
   */
  if (
    !Number.isInteger(baseline) ||
    baseline < 0
  ) {
    baseline =
      currentMaxSiteId;

    try {
      await saveAppSetting(
        env,
        SITE_SOURCE_LINK_BASELINE_KEY,
        baseline
      );
    } catch (error) {
      console.warn(
        "Unable to initialize evidence-link baseline.",
        error
      );
    }
  }


  const recentSiteIds =
    sites
      .filter(
        (site) =>
          Number(site.id) >
          baseline
      )
      .map(
        (site) =>
          Number(site.id)
      );


  return Response.json(
    {
      ok: true,
      sites,
      sources,

      recent_site_ids:
        recentSiteIds,
    },
    {
      headers: {
        "cache-control":
          "no-store",
      },
    }
  );
}


async function mergeSelectedSiteSummaries(
  env,
  siteIds
) {
  if (!siteIds.length) {
    return 0;
  }

  const idFilter =
    `in.(${siteIds.join(",")})`;


  const sitesEndpoint =
    new URL(
      "/rest/v1/sites",
      env.SUPABASE_URL
    );

  sitesEndpoint.searchParams.set(
    "select",
    "id,metal,exposure_period"
  );

  sitesEndpoint.searchParams.set(
    "id",
    idFilter
  );


  const linksEndpoint =
    new URL(
      "/rest/v1/site_sources",
      env.SUPABASE_URL
    );

  linksEndpoint.searchParams.set(
    "select",
    "site_fk,metals,exposure_periods"
  );

  linksEndpoint.searchParams.set(
    "site_fk",
    idFilter
  );


  const headers = {
    apikey:
      env.SUPABASE_SECRET_KEY,

    authorization:
      `Bearer ${env.SUPABASE_SECRET_KEY}`,

    accept:
      "application/json",
  };


  const [
    sitesResponse,
    linksResponse,
  ] = await Promise.all([
    fetch(
      sitesEndpoint,
      { headers }
    ),

    fetch(
      linksEndpoint,
      { headers }
    ),
  ]);


  if (
    !sitesResponse.ok ||
    !linksResponse.ok
  ) {
    throw new Error(
      "Unable to load Site metadata for summary merge."
    );
  }


  const siteRows =
    await sitesResponse.json();

  const linkRows =
    await linksResponse.json();


  const linksBySite =
    new Map();

  for (const link of linkRows) {
    const siteFk =
      Number(link.site_fk);

    if (
      !linksBySite.has(siteFk)
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


  let updatedCount = 0;

  for (const site of siteRows) {
    const siteId =
      Number(site.id);

    const links =
      linksBySite.get(siteId) ||
      [];


    const mergedMetal =
      mergeBulkMetadataValues(
        site.metal || "",
        ...links.map(
          (link) =>
            link.metals || ""
        )
      );


    const mergedExposurePeriod =
      mergeBulkMetadataValues(
        site.exposure_period || "",
        ...links.map(
          (link) =>
            link.exposure_periods || ""
        )
      );


    const endpoint =
      new URL(
        "/rest/v1/sites",
        env.SUPABASE_URL
      );

    endpoint.searchParams.set(
      "id",
      `eq.${siteId}`
    );


    const response =
      await fetch(endpoint, {
        method: "PATCH",

        headers: {
          apikey:
            env.SUPABASE_SECRET_KEY,

          authorization:
            `Bearer ${env.SUPABASE_SECRET_KEY}`,

          "content-type":
            "application/json",

          prefer:
            "return=minimal",
        },

        body:
          JSON.stringify({
            metal:
              mergedMetal,

            exposure_period:
              mergedExposurePeriod,
          }),
      });


    if (!response.ok) {
      throw new Error(
        `Unable to update Site ${siteId} summary metadata.`
      );
    }

    updatedCount += 1;
  }


  return updatedCount;
}


async function updateLinkBaseline(
  env
) {
  const endpoint =
    new URL(
      "/rest/v1/sites",
      env.SUPABASE_URL
    );

  endpoint.searchParams.set(
    "select",
    "id"
  );

  endpoint.searchParams.set(
    "order",
    "id.desc"
  );

  endpoint.searchParams.set(
    "limit",
    "1"
  );


  const response =
    await fetch(endpoint, {
      headers: {
        apikey:
          env.SUPABASE_SECRET_KEY,

        authorization:
          `Bearer ${env.SUPABASE_SECRET_KEY}`,

        accept:
          "application/json",
      },
    });


  if (!response.ok) {
    throw new Error(
      "Unable to update evidence-link baseline."
    );
  }


  const rows =
    await response.json();

  const maxId =
    rows.length
      ? Number(rows[0].id) || 0
      : 0;


  await saveAppSetting(
    env,
    SITE_SOURCE_LINK_BASELINE_KEY,
    maxId
  );
}


async function handleBulkSiteSourceLinks(
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
          "cache-control":
            "no-store",
        },
      }
    );
  }


  const siteIds =
    cleanIdArray(
      payload.site_ids
    );

  const sourceIds =
    cleanIdArray(
      payload.source_ids
    );


  if (!siteIds.length) {
    return Response.json(
      {
        ok: false,
        error:
          "Select at least one Site.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  if (!sourceIds.length) {
    return Response.json(
      {
        ok: false,
        error:
          "Select at least one Source.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  const sourceOrder =
    Number(
      payload.source_order
    );


  if (
    !Number.isInteger(sourceOrder) ||
    sourceOrder < 1 ||
    sourceOrder > 99
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "Source order must be an integer from 1 to 99.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  const metals =
    String(
      payload.metals || ""
    ).trim();

  const exposurePeriods =
    String(
      payload.exposure_periods || ""
    ).trim();

  const notes =
    String(
      payload.notes || ""
    ).trim();


  const rows = [];

  for (const siteFk of siteIds) {
    for (const sourceFk of sourceIds) {
      rows.push({
        site_fk:
          siteFk,

        source_fk:
          sourceFk,

        source_order:
          sourceOrder,

        metals,

        exposure_periods:
          exposurePeriods,

        notes,
      });
    }
  }


  const endpoint =
    new URL(
      "/rest/v1/site_sources",
      env.SUPABASE_URL
    );

  endpoint.searchParams.set(
    "on_conflict",
    "site_fk,source_fk"
  );


  const response =
    await fetch(endpoint, {
      method: "POST",

      headers: {
        apikey:
          env.SUPABASE_SECRET_KEY,

        authorization:
          `Bearer ${env.SUPABASE_SECRET_KEY}`,

        "content-type":
          "application/json",

        prefer:
          "resolution=merge-duplicates,return=minimal",
      },

      body:
        JSON.stringify(rows),
    });


  if (!response.ok) {
    console.error(
      "Bulk Site–Source upsert failed.",
      response.status,
      await response.text()
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to create or update Site–Source links.",
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


  let summaryUpdatedCount = 0;
  let warning = "";


  if (
    payload.update_site_summary !==
    false
  ) {
    try {
      summaryUpdatedCount =
        await mergeSelectedSiteSummaries(
          env,
          siteIds
        );
    } catch (error) {
      console.error(
        "Site summary merge failed after link upsert.",
        error
      );

      warning =
        "Links were saved, but Site-level summary metadata could not be merged.";
    }
  }


  try {
    await updateLinkBaseline(
      env
    );
  } catch (error) {
    console.warn(
      "Unable to update newly-added-Site baseline.",
      error
    );

    if (!warning) {
      warning =
        "Links were saved, but the newly-added-Site baseline could not be updated.";
    }
  }


  return Response.json(
    {
      ok: true,

      changed_count:
        rows.length,

      summary_updated_count:
        summaryUpdatedCount,

      warning,
    },
    {
      headers: {
        "cache-control":
          "no-store",
      },
    }
  );
}

const MANAGE_RECORD_TYPES =
  new Set([
    "sites",
    "sources",
    "links",
    "corrosion",
    "environmental",
  ]);


function parseManageInteger(
  value,
  fallback,
  minimum,
  maximum
) {
  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    number < minimum ||
    number > maximum
  ) {
    return fallback;
  }

  return number;
}


function cleanManageSearchTerm(
  value
) {
  return String(
    value || ""
  )
    .trim()

    /*
     * Commas and parentheses have structural
     * meaning inside PostgREST `or` filters.
     */
    .replace(
      /[(),*]/g,
      " "
    )

    .replace(
      /\s+/g,
      " "
    )

    .slice(
      0,
      120
    );
}


function buildManageIlikeClauses(
  fields,
  searchTerm
) {
  const pattern =
    `*${searchTerm}*`;

  return fields.map(
    (field) =>
      `${field}.ilike.${pattern}`
  );
}


function manageContentRangeTotal(
  response
) {
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

  return Number(
    match[1]
  );
}


async function findManageRelatedIds(
  env,
  tableName,
  fields,
  searchTerm
) {
  if (!searchTerm) {
    return [];
  }

  const endpoint =
    new URL(
      `/rest/v1/${tableName}`,
      env.SUPABASE_URL
    );

  endpoint.searchParams.set(
    "select",
    "id"
  );

  endpoint.searchParams.set(
    "or",
    `(${buildManageIlikeClauses(
      fields,
      searchTerm
    ).join(",")})`
  );

  /*
   * These are only lookup IDs used to expand
   * searches such as "Yakutsk" into site_fk.
   * They are not the managed result page itself.
   */
  endpoint.searchParams.set(
    "limit",
    "500"
  );


  const response =
    await fetch(endpoint, {
      headers: {
        apikey:
          env.SUPABASE_SECRET_KEY,

        authorization:
          `Bearer ${env.SUPABASE_SECRET_KEY}`,

        accept:
          "application/json",
      },
    });


  if (!response.ok) {
    throw new Error(
      `Unable to resolve ${tableName} search matches.`
    );
  }


  const rows =
    await response.json();


  return rows
    .map(
      (row) =>
        Number(row.id)
    )
    .filter(
      (id) =>
        Number.isInteger(id) &&
        id > 0
    );
}


async function getManageSearchRelations(
  env,
  searchTerm
) {
  if (!searchTerm) {
    return {
      siteIds: [],
      sourceIds: [],
    };
  }


  const [
    siteIds,
    sourceIds,
  ] = await Promise.all([
    findManageRelatedIds(
      env,
      "sites",
      [
        "site_id",
        "site_label",
        "site_type",
        "modern_country_location",
        "region_category",
        "metal",
      ],
      searchTerm
    ),

    findManageRelatedIds(
      env,
      "sources",
      [
        "source_code",
        "source_title",
        "authors_or_organization",
        "programme",
        "metals",
      ],
      searchTerm
    ),
  ]);


  return {
    siteIds,
    sourceIds,
  };
}


function manageRecordConfig(
  recordType
) {
  if (
    recordType === "sites"
  ) {
    return {
      table:
        "sites",

      select: [
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
      ].join(","),

      searchFields: [
        "site_id",
        "site_label",
        "site_type",
        "modern_country_location",
        "administering_country",
        "former_entity",
        "region_category",
        "exposure_period",
        "metal",
        "notes",
      ],

      order:
        "site_id.asc",
    };
  }


  if (
    recordType === "sources"
  ) {
    return {
      table:
        "sources",

      select: [
        "id",
        "source_code",
        "source_kind",
        "source_type",
        "source_title",
        "authors_or_organization",
        "publication_year",
        "programme",
        "metals",
        "exposure_periods",
        "doi",
        "notes",
      ].join(","),

      searchFields: [
        "source_code",
        "source_kind",
        "source_type",
        "source_title",
        "authors_or_organization",
        "publication_year",
        "programme",
        "metals",
        "exposure_periods",
        "doi",
        "notes",
      ],

      order:
        "source_code.asc",
    };
  }


  if (
    recordType === "links"
  ) {
    return {
      table:
        "site_sources",

      select: [
        "id",
        "site_fk",
        "source_fk",
        "source_order",
        "metals",
        "exposure_periods",
        "notes",
        "sites(site_id,site_label,modern_country_location)",
        "sources(source_code,source_title,programme)",
      ].join(","),

      searchFields: [
        "metals",
        "exposure_periods",
        "notes",
      ],

      order:
        "id.desc",
    };
  }


  if (
    recordType === "corrosion"
  ) {
    return {
      table:
        "corrosion_observations",

      select: [
        "id",
        "site_fk",
        "source_fk",
        "material",
        "exposure_period",
        "corrosion_metric",
        "value",
        "unit",
        "canonical_thickness_loss_rate_um_year",
        "canonical_mass_loss_rate_g_m2_year",
        "measurement_method",
        "specimen_condition",
        "exposure_condition",
        "normalization_note",
        "notes",
        "sites(site_id,site_label,modern_country_location)",
        "sources(source_code,source_title)",
      ].join(","),

      searchFields: [
        "material",
        "exposure_period",
        "corrosion_metric",
        "unit",
        "measurement_method",
        "specimen_condition",
        "exposure_condition",
        "normalization_note",
        "notes",
      ],

      order:
        "id.desc",
    };
  }


  return {
    table:
      "environmental_observations",

    select: [
      "id",
      "site_fk",
      "source_fk",
      "variable_name",
      "value",
      "unit",
      "aggregation",
      "period_start",
      "period_end",
      "data_source",
      "notes",
      "sites(site_id,site_label,modern_country_location)",
      "sources(source_code,source_title)",
    ].join(","),

    searchFields: [
      "variable_name",
      "unit",
      "aggregation",
      "period_start",
      "period_end",
      "data_source",
      "notes",
    ],

    order:
      "id.desc",
  };
}


function manageHasValue(
  value
) {
  return (
    value !== null &&
    value !== undefined &&
    String(value).trim() !== ""
  );
}


function joinManageText(
  values
) {
  return values
    .filter(
      manageHasValue
    )
    .map(
      (value) =>
        String(value).trim()
    )
    .join(" · ");
}


function formatManagedRecord(
  recordType,
  row
) {
  if (
    recordType === "sites"
  ) {
    return {
      id:
        row.id,

      eyebrow:
        `Site · DB #${row.id}`,

      title:
        `${row.site_id || "No Site ID"} — ` +
        `${row.site_label || "(Unnamed Site)"}`,

      metadata:
        joinManageText([
          row.modern_country_location,
          row.site_type,
          row.region_category,
        ]),

      detail:
        joinManageText([
          row.metal
            ? `Metal: ${row.metal}`
            : "",

          row.exposure_period
            ? `Exposure: ${row.exposure_period}`
            : "",
        ]),

      data: {
        site_id:
          row.site_id || "",

        site_label:
          row.site_label || "",

        site_type:
          row.site_type || "",

        latitude:
          row.latitude,

        longitude:
          row.longitude,

        modern_country_location:
          row.modern_country_location || "",

        region_category:
          row.region_category || "",
      },

      href:
        `/sites/detail/?id=${row.id}`,
    };
  }


  if (
    recordType === "sources"
  ) {
    return {
      id:
        row.id,

      eyebrow:
        `Source · DB #${row.id}`,

      title:
        `${String(
          row.source_code || ""
        ).toUpperCase() || "No source code"} — ` +
        `${row.source_title || "(Untitled Source)"}`,

      metadata:
        joinManageText([
          row.authors_or_organization,
          row.publication_year,
          row.programme,
        ]),

      detail:
        joinManageText([
          row.metals
            ? `Metals: ${row.metals}`
            : "",

          row.exposure_periods
            ? `Exposure: ${row.exposure_periods}`
            : "",
        ]),

      href:
        `/sources/detail/?id=${row.id}`,
    };
  }


  const site =
    row.sites || {};

  const source =
    row.sources || {};


  if (
    recordType === "links"
  ) {
    return {
      id:
        row.id,

      eyebrow:
        `Evidence link · DB #${row.id}`,

      title:
        `${site.site_id || "Unknown Site"} — ` +
        `${site.site_label || "(Unnamed Site)"} ` +
        `↔ ` +
        `${String(
          source.source_code || ""
        ).toUpperCase() || "Unknown Source"} — ` +
        `${source.source_title || "(Untitled Source)"}`,

      metadata:
        joinManageText([
          manageHasValue(
            row.source_order
          )
            ? `Order ${row.source_order}`
            : "",

          row.metals,
          row.exposure_periods,
          source.programme,
        ]),

      detail:
        row.notes || "",

      href:
        "",
    };
  }


  if (
    recordType === "corrosion"
  ) {
    const canonicalParts =
      [];

    if (
      manageHasValue(
        row.canonical_thickness_loss_rate_um_year
      )
    ) {
      canonicalParts.push(
        `Thickness rate: ` +
        `${row.canonical_thickness_loss_rate_um_year} µm/year`
      );
    }

    if (
      manageHasValue(
        row.canonical_mass_loss_rate_g_m2_year
      )
    ) {
      canonicalParts.push(
        `Mass rate: ` +
        `${row.canonical_mass_loss_rate_g_m2_year} g/m²/year`
      );
    }


    return {
      id:
        row.id,

      eyebrow:
        `Corrosion observation · DB #${row.id}`,

      title:
        joinManageText([
          site.site_id ||
            "Unknown Site",

          String(
            source.source_code || ""
          ).toUpperCase() ||
            "Unknown Source",

          row.material,

          row.exposure_period,
        ]),

      metadata:
        joinManageText([
          row.corrosion_metric,

          manageHasValue(
            row.value
          )
            ? `${row.value} ${row.unit || ""}`.trim()
            : "",
        ]),

      detail:
        joinManageText(
          canonicalParts
        ),

      href:
        "",
    };
  }


  return {
    id:
      row.id,

    eyebrow:
      `Environmental observation · DB #${row.id}`,

    title:
      joinManageText([
        site.site_id ||
          "Unknown Site",

        row.variable_name,
      ]),

    metadata:
      joinManageText([
        manageHasValue(
          row.value
        )
          ? `${row.value} ${row.unit || ""}`.trim()
          : "",

        row.aggregation,

        row.period_start &&
        row.period_end
          ? `${row.period_start} → ${row.period_end}`
          : (
              row.period_start ||
              row.period_end ||
              ""
            ),
      ]),

    detail:
      joinManageText([
        source.source_code
          ? `Source ${String(
              source.source_code
            ).toUpperCase()}`
          : "",

        row.data_source,
      ]),

    href:
      "",
  };
}


async function handleManageRecords(
  request,
  env
) {
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


  const url =
    new URL(
      request.url
    );


  const requestedType =
    String(
      url.searchParams.get(
        "type"
      ) || "sites"
    ).trim();


  if (
    !MANAGE_RECORD_TYPES.has(
      requestedType
    )
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "Unknown record type.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  const page =
    parseManageInteger(
      url.searchParams.get(
        "page"
      ),
      1,
      1,
      1000000
    );


  const requestedPageSize =
    parseManageInteger(
      url.searchParams.get(
        "page_size"
      ),
      50,
      1,
      200
    );


  const allowedPageSizes =
    new Set([
      25,
      50,
      100,
      200,
    ]);


  const pageSize =
    allowedPageSizes.has(
      requestedPageSize
    )
      ? requestedPageSize
      : 50;


  const searchTerm =
    cleanManageSearchTerm(
      url.searchParams.get(
        "q"
      )
    );


  const config =
    manageRecordConfig(
      requestedType
    );


  const endpoint =
    new URL(
      `/rest/v1/${config.table}`,
      env.SUPABASE_URL
    );


  endpoint.searchParams.set(
    "select",
    config.select
  );

  endpoint.searchParams.set(
    "order",
    config.order
  );


  if (searchTerm) {
    const clauses =
      buildManageIlikeClauses(
        config.searchFields,
        searchTerm
      );


    if (
      [
        "links",
        "corrosion",
        "environmental",
      ].includes(
        requestedType
      )
    ) {
      const {
        siteIds,
        sourceIds,
      } =
        await getManageSearchRelations(
          env,
          searchTerm
        );


      if (
        siteIds.length
      ) {
        clauses.push(
          `site_fk.in.(${siteIds.join(",")})`
        );
      }


      if (
        sourceIds.length
      ) {
        clauses.push(
          `source_fk.in.(${sourceIds.join(",")})`
        );
      }
    }


    endpoint.searchParams.set(
      "or",
      `(${clauses.join(",")})`
    );
  }


  const start =
    (page - 1) *
    pageSize;

  const end =
    start +
    pageSize -
    1;


  const response =
    await fetch(endpoint, {
      headers: {
        apikey:
          env.SUPABASE_SECRET_KEY,

        authorization:
          `Bearer ${env.SUPABASE_SECRET_KEY}`,

        accept:
          "application/json",

        prefer:
          "count=exact",

        range:
          `${start}-${end}`,
      },
    });


  if (!response.ok) {
    const detail =
      await response.text();

    console.error(
      "Manage Records query failed.",
      {
        type:
          requestedType,

        status:
          response.status,

        detail,
      }
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to load managed records.",
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


  const rows =
    await response.json();

  const total =
    manageContentRangeTotal(
      response
    );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total /
        pageSize
      )
    );


  const records =
    rows.map(
      (row) =>
        formatManagedRecord(
          requestedType,
          row
        )
    );


  return Response.json(
    {
      ok: true,

      record_type:
        requestedType,

      records,

      total,

      page,

      page_size:
        pageSize,

      total_pages:
        totalPages,
    },
    {
      headers: {
        "cache-control":
          "no-store",
      },
    }
  );
}

async function countManageDependency(
  env,
  tableName,
  fieldName,
  ids
) {
  if (!ids.length) {
    return 0;
  }


  const endpoint =
    new URL(
      `/rest/v1/${tableName}`,
      env.SUPABASE_URL
    );


  endpoint.searchParams.set(
    "select",
    "id"
  );


  endpoint.searchParams.set(
    fieldName,
    `in.(${ids.join(",")})`
  );


  const response =
    await fetch(endpoint, {
      headers: {
        apikey:
          env.SUPABASE_SECRET_KEY,

        authorization:
          `Bearer ${env.SUPABASE_SECRET_KEY}`,

        accept:
          "application/json",

        prefer:
          "count=exact",

        range:
          "0-0",
      },
    });


  if (!response.ok) {
    console.error(
      "Dependency count failed.",
      {
        tableName,
        fieldName,
        status:
          response.status,
      }
    );

    throw new Error(
      "Unable to calculate deletion dependencies."
    );
  }


  return manageContentRangeTotal(
    response
  );
}

async function handleManageDeletePreview(
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
          "cache-control":
            "no-store",
        },
      }
    );
  }


  const recordType =
    String(
      payload?.type || ""
    ).trim();


  if (
    !MANAGE_RECORD_TYPES.has(
      recordType
    )
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "Unknown record type.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  const ids =
    cleanIdArray(
      payload?.ids
    );


  if (!ids.length) {
    return Response.json(
      {
        ok: false,
        error:
          "Select at least one record.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  const consequences =
    [];


  let title =
    `Delete ${ids.length} selected record` +
    `${ids.length === 1 ? "" : "s"}?`;

  let note =
    "This operation cannot be undone.";


  if (
    recordType === "sites"
  ) {
    const [
      evidenceLinks,
      corrosionObservations,
      environmentalObservations,
    ] =
      await Promise.all([
        countManageDependency(
          env,
          "site_sources",
          "site_fk",
          ids
        ),

        countManageDependency(
          env,
          "corrosion_observations",
          "site_fk",
          ids
        ),

        countManageDependency(
          env,
          "environmental_observations",
          "site_fk",
          ids
        ),
      ]);


    title =
      `Delete ${ids.length} Site` +
      `${ids.length === 1 ? "" : "s"}?`;


    consequences.push(
      {
        label:
          "Selected Sites",
        count:
          ids.length,
      },

      {
        label:
          "Evidence Links referencing these Sites",
        count:
          evidenceLinks,
      },

      {
        label:
          "Corrosion Observations deleted by Site cascade",
        count:
          corrosionObservations,
      },

      {
        label:
          "Environmental Observations deleted by Site cascade",
        count:
          environmentalObservations,
      }
    );


    note =
      "Deleting a Site is highly destructive because its scientific observations are tied to that Site.";
  }


  if (
    recordType === "sources"
  ) {
    const [
      evidenceLinks,
      corrosionObservations,
      environmentalObservations,
    ] =
      await Promise.all([
        countManageDependency(
          env,
          "site_sources",
          "source_fk",
          ids
        ),

        countManageDependency(
          env,
          "corrosion_observations",
          "source_fk",
          ids
        ),

        countManageDependency(
          env,
          "environmental_observations",
          "source_fk",
          ids
        ),
      ]);


    title =
      `Delete ${ids.length} Source` +
      `${ids.length === 1 ? "" : "s"}?`;


    consequences.push(
      {
        label:
          "Selected Sources",
        count:
          ids.length,
      },

      {
        label:
          "Evidence Links referencing these Sources",
        count:
          evidenceLinks,
      },

      {
        label:
          "Corrosion Observations deleted by Source cascade",
        count:
          corrosionObservations,
      },

      {
        label:
          "Environmental Observations retained but Source reference cleared",
        count:
          environmentalObservations,
      }
    );


    note =
      "Deleting a Source removes its database record. Environmental observations remain but lose that Source reference. Any private PDF object in R2 is not deleted by this database operation.";
  }


  if (
    recordType === "links"
  ) {
    const [
      corrosionReferences,
      environmentalReferences,
    ] =
      await Promise.all([
        countManageDependency(
          env,
          "corrosion_observations",
          "site_source_fk",
          ids
        ),

        countManageDependency(
          env,
          "environmental_observations",
          "site_source_fk",
          ids
        ),
      ]);


    title =
      `Delete ${ids.length} Evidence Link` +
      `${ids.length === 1 ? "" : "s"}?`;


    consequences.push(
      {
        label:
          "Evidence Links deleted",
        count:
          ids.length,
      },

      {
        label:
          "Corrosion Observations retained but Evidence-Link reference cleared",
        count:
          corrosionReferences,
      },

      {
        label:
          "Environmental Observations retained but Evidence-Link reference cleared",
        count:
          environmentalReferences,
      }
    );


    note =
      "Deleting an Evidence Link does not delete its Site, Source, or scientific observations.";
  }


  if (
    recordType === "corrosion"
  ) {
    title =
      `Delete ${ids.length} Corrosion Observation` +
      `${ids.length === 1 ? "" : "s"}?`;


    consequences.push({
      label:
        "Corrosion Observations deleted",
      count:
        ids.length,
    });


    note =
      "Only the selected corrosion-observation rows will be deleted.";
  }


  if (
    recordType === "environmental"
  ) {
    title =
      `Delete ${ids.length} Environmental Observation` +
      `${ids.length === 1 ? "" : "s"}?`;


    consequences.push({
      label:
        "Environmental Observations deleted",
      count:
        ids.length,
    });


    note =
      "Only the selected environmental-observation rows will be deleted.";
  }


  return Response.json(
    {
      ok: true,

      record_type:
        recordType,

      selected_count:
        ids.length,

      title,

      consequences,

      note,
    },
    {
      headers: {
        "cache-control":
          "no-store",
      },
    }
  );
}

const MANAGE_DELETE_TABLES = {
  sites:
    "sites",

  sources:
    "sources",

  links:
    "site_sources",

  corrosion:
    "corrosion_observations",

  environmental:
    "environmental_observations",
};


async function handleManageRecordsDelete(
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
          "cache-control":
            "no-store",
        },
      }
    );
  }


  const recordType =
    String(
      payload?.type || ""
    ).trim();


  const tableName =
    MANAGE_DELETE_TABLES[
      recordType
    ];


  if (!tableName) {
    return Response.json(
      {
        ok: false,
        error:
          "Unknown record type.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  if (
    payload?.confirmed !==
    true
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "Deletion was not confirmed.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  const ids =
    cleanIdArray(
      payload?.ids
    );


  if (!ids.length) {
    return Response.json(
      {
        ok: false,
        error:
          "Select at least one record.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  /*
   * Manage Records currently allows at most
   * 200 visible records per page.
   */
  if (ids.length > 200) {
    return Response.json(
      {
        ok: false,
        error:
          "A maximum of 200 records may be deleted at once.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  const endpoint =
    new URL(
      `/rest/v1/${tableName}`,
      env.SUPABASE_URL
    );


  endpoint.searchParams.set(
    "id",
    `in.(${ids.join(",")})`
  );


  const response =
    await fetch(endpoint, {
      method:
        "DELETE",

      headers: {
        apikey:
          env.SUPABASE_SECRET_KEY,

        authorization:
          `Bearer ${env.SUPABASE_SECRET_KEY}`,

        accept:
          "application/json",

        prefer:
          "return=representation",
      },
    });


  if (!response.ok) {
    const detail =
      await response.text();


    console.error(
      "Manage Records deletion failed.",
      {
        recordType,
        tableName,
        status:
          response.status,
        detail,
      }
    );


    return Response.json(
      {
        ok: false,

        error:
          "Unable to delete the selected records. A database relationship may prevent deletion; no forced cleanup was attempted.",
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


  const deletedRows =
    await response.json();


  return Response.json(
    {
      ok: true,

      record_type:
        recordType,

      deleted_count:
        deletedRows.length,
    },
    {
      headers: {
        "cache-control":
          "no-store",
      },
    }
  );
}

const MANAGE_BULK_EDIT_FIELDS = {
  sites:
    new Set([
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
    ]),

  sources:
    new Set([
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
      "source_url",
      "private_pdf_object_key",
      "notes",
    ]),
};


async function handleManageBulkUpdate(
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
          "cache-control":
            "no-store",
        },
      }
    );
  }


  const recordType =
    String(
      payload?.type || ""
    ).trim();


  const fields =
    MANAGE_BULK_EDIT_FIELDS[
      recordType
    ];


  if (!fields) {
    return Response.json(
      {
        ok: false,
        error:
          "Bulk editing is available only for Sites and Sources.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  const ids =
    cleanIdArray(
      payload?.ids
    );


  if (
    !ids.length ||
    ids.length > 200
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "Select between 1 and 200 records.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  const field =
    String(
      payload?.field || ""
    ).trim();


  if (
    !fields.has(field)
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "That field is not available for bulk editing.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  /*
   * These identifiers must remain unique,
   * so applying one value to several rows
   * would inherently create duplicates.
   */
  if (
    ids.length > 1 &&
    (
      field === "site_id" ||
      field === "source_code"
    )
  ) {
    return Response.json(
      {
        ok: false,
        error:
          `${field} is unique and can only be changed for one record at a time.`,
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  let value =
    payload?.value;


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
        {
          status: 400,
          headers: {
            "cache-control":
              "no-store",
          },
        }
      );
    }


    if (
      field === "latitude" &&
      (
        number < -90 ||
        number > 90
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Latitude must be between -90 and 90.",
        },
        {
          status: 400,
          headers: {
            "cache-control":
              "no-store",
          },
        }
      );
    }


    if (
      field === "longitude" &&
      (
        number < -180 ||
        number > 180
      )
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "Longitude must be between -180 and 180.",
        },
        {
          status: 400,
          headers: {
            "cache-control":
              "no-store",
          },
        }
      );
    }


    value =
      number;
  } else {
    value =
      String(
        value ?? ""
      ).trim();
  }


  if (
    field === "site_id" &&
    !value
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "Site ID cannot be blank.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  if (
    field === "site_label" &&
    !value
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "Site label cannot be blank.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  if (
    field === "source_code"
  ) {
    value =
      normaliseSourceCode(
        value
      );


    if (
      !isCanonicalSourceCode(
        value
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
            "cache-control":
              "no-store",
          },
        }
      );
    }
  }


  if (
    field === "region_category"
  ) {
    value =
      normaliseRegionTags(
        splitRegionTags(
          value
        )
      );
  }


  const tableName =
    recordType === "sites"
      ? "sites"
      : "sources";


  const endpoint =
    new URL(
      `/rest/v1/${tableName}`,
      env.SUPABASE_URL
    );


  endpoint.searchParams.set(
    "id",
    `in.(${ids.join(",")})`
  );


  const response =
    await fetch(endpoint, {
      method:
        "PATCH",

      headers: {
        apikey:
          env.SUPABASE_SECRET_KEY,

        authorization:
          `Bearer ${env.SUPABASE_SECRET_KEY}`,

        "content-type":
          "application/json",

        accept:
          "application/json",

        prefer:
          "return=representation",
      },

      body:
        JSON.stringify({
          [field]:
            value,
        }),
    });


  if (!response.ok) {
    const detail =
      await response.text();


    console.error(
      "Manage bulk update failed.",
      {
        recordType,
        field,
        status:
          response.status,
        detail,
      }
    );


    return Response.json(
      {
        ok: false,

        error:
          response.status === 409
            ? "The new value conflicts with an existing unique record."
            : "Unable to apply the bulk update.",
      },
      {
        status:
          response.status === 409
            ? 409
            : 502,

        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  const rows =
    await response.json();


  if (
    recordType === "sources" &&
    (
      field === "programme" ||
      field === "metals"
    )
  ) {
    await persistSourceMetadataOptions(
      env,
      {
        programme:
          field === "programme"
            ? value
            : "",

        metals:
          field === "metals"
            ? value
            : "",
      }
    );
  }


  return Response.json(
    {
      ok: true,

      updated_count:
        rows.length,
    },
    {
      headers: {
        "cache-control":
          "no-store",
      },
    }
  );
}

async function handleManageRegionApply(
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
          "cache-control":
            "no-store",
        },
      }
    );
  }


  const incoming =
    Array.isArray(
      payload?.updates
    )
      ? payload.updates
      : [];


  const byId =
    new Map();


  for (
    const item
    of incoming
  ) {
    const id =
      Number(
        item?.id
      );


    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      continue;
    }


    const regionCategory =
      normaliseRegionTags(
        splitRegionTags(
          item?.region_category
        )
      );


    if (!regionCategory) {
      continue;
    }


    byId.set(
      id,
      {
        id,

        region_category:
          regionCategory,
      }
    );
  }


  const rows =
    [
      ...byId.values(),
    ];


  if (
    !rows.length ||
    rows.length > 200
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "Provide between 1 and 200 valid Site classifications.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  const endpoint =
    new URL(
      "/rest/v1/sites",
      env.SUPABASE_URL
    );


  endpoint.searchParams.set(
    "on_conflict",
    "id"
  );


  const response =
    await fetch(endpoint, {
      method:
        "POST",

      headers: {
        apikey:
          env.SUPABASE_SECRET_KEY,

        authorization:
          `Bearer ${env.SUPABASE_SECRET_KEY}`,

        "content-type":
          "application/json",

        accept:
          "application/json",

        prefer:
          "resolution=merge-duplicates,return=representation",
      },

      body:
        JSON.stringify(
          rows
        ),
    });


  if (!response.ok) {
    console.error(
      "Bulk region application failed.",
      response.status,
      await response.text()
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to apply Site region classifications.",
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


  const updatedRows =
    await response.json();


  return Response.json(
    {
      ok: true,

      updated_count:
        updatedRows.length,
    },
    {
      headers: {
        "cache-control":
          "no-store",
      },
    }
  );
}

const SOURCE_PDF_MAX_BYTES =
  50 * 1024 * 1024;


function buildSourcePdfObjectKey(
  sourceCode
) {
  const canonical =
    normaliseSourceCode(
      sourceCode
    );


  if (
    !isCanonicalSourceCode(
      canonical
    )
  ) {
    throw new Error(
      "Source code is not canonical."
    );
  }


  return {
    source_code:
      canonical,

    file_name:
      `${canonical}.pdf`,

    object_key:
      `source_pdfs/${canonical}.pdf`,
  };
}


async function loadSourcePdfRecord(
  env,
  sourceId
) {
  const id =
    Number(sourceId);


  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }


  const endpoint =
    new URL(
      "/rest/v1/sources",
      env.SUPABASE_URL
    );


  endpoint.searchParams.set(
    "select",
    [
      "id",
      "source_code",
      "source_title",
      "local_file_name",
      "private_pdf_object_key",
    ].join(",")
  );

  endpoint.searchParams.set(
    "id",
    `eq.${id}`
  );

  endpoint.searchParams.set(
    "limit",
    "1"
  );


  const response =
    await fetch(
      endpoint,
      {
        headers: {
          apikey:
            env.SUPABASE_SECRET_KEY,

          authorization:
            `Bearer ${env.SUPABASE_SECRET_KEY}`,

          accept:
            "application/json",
        },
      }
    );


  if (!response.ok) {
    throw new Error(
      "Unable to load Source PDF metadata."
    );
  }


  const rows =
    await response.json();


  return rows[0] || null;
}


async function updateSourcePdfMetadata(
  env,
  sourceId,
  {
    local_file_name,
    private_pdf_object_key,
  }
) {
  const endpoint =
    new URL(
      "/rest/v1/sources",
      env.SUPABASE_URL
    );


  endpoint.searchParams.set(
    "id",
    `eq.${Number(sourceId)}`
  );


  const response =
    await fetch(
      endpoint,
      {
        method:
          "PATCH",

        headers: {
          apikey:
            env.SUPABASE_SECRET_KEY,

          authorization:
            `Bearer ${env.SUPABASE_SECRET_KEY}`,

          "content-type":
            "application/json",

          accept:
            "application/json",

          prefer:
            "return=representation",
        },

        body:
          JSON.stringify({
            local_file_name:
              String(
                local_file_name || ""
              ).trim(),

            private_pdf_object_key:
              String(
                private_pdf_object_key ||
                ""
              ).trim(),
          }),
      }
    );


  if (!response.ok) {
    console.error(
      "Unable to update Source PDF metadata.",
      response.status,
      await response.text()
    );


    throw new Error(
      "Unable to update Source PDF metadata."
    );
  }


  const rows =
    await response.json();


  return rows[0] || null;
}


function sourcePdfError(
  error,
  status = 400
) {
  return Response.json(
    {
      ok: false,
      error,
    },
    {
      status,
      headers: {
        "cache-control":
          "no-store",
      },
    }
  );
}


async function handleSourcePdfGet(
  request,
  env,
  sourceId
) {
  if (!env.SOURCE_PDFS) {
    return sourcePdfError(
      "Private PDF storage is not configured.",
      500
    );
  }


  let source;


  try {
    source =
      await loadSourcePdfRecord(
        env,
        sourceId
      );
  } catch (error) {
    console.error(
      "Unable to load Source PDF record.",
      error
    );

    return sourcePdfError(
      "Unable to load Source PDF metadata.",
      502
    );
  }


  if (!source) {
    return sourcePdfError(
      "Source not found.",
      404
    );
  }


  const objectKey =
    String(
      source.private_pdf_object_key ||
      ""
    ).trim();


  if (!objectKey) {
    return sourcePdfError(
      "No private PDF is attached to this Source.",
      404
    );
  }


  let object;


  try {
    object =
      await env.SOURCE_PDFS.get(
        objectKey
      );
  } catch (error) {
    console.error(
      "Unable to read PDF from R2.",
      error
    );

    return sourcePdfError(
      "Unable to read private PDF.",
      502
    );
  }


  if (!object) {
    return sourcePdfError(
      "The Source references a PDF that is not present in R2.",
      404
    );
  }


  const headers =
    new Headers();


  object.writeHttpMetadata(
    headers
  );


  const fileName =
    String(
      source.local_file_name ||
      ""
    ).trim() ||
    `${normaliseSourceCode(
      source.source_code
    )}.pdf`;


  headers.set(
    "content-type",
    "application/pdf"
  );

  headers.set(
    "content-disposition",
    `inline; filename="${fileName.replaceAll(
      '"',
      ""
    )}"`
  );

  headers.set(
    "cache-control",
    "private, no-store"
  );

  headers.set(
    "etag",
    object.httpEtag
  );

  headers.set(
    "content-length",
    String(
      object.size
    )
  );


  return new Response(
    object.body,
    {
      status: 200,
      headers,
    }
  );
}


async function handleSourcePdfUpload(
  request,
  env,
  sourceId
) {
  if (!env.SOURCE_PDFS) {
    return sourcePdfError(
      "Private PDF storage is not configured.",
      500
    );
  }


  let source;


  try {
    source =
      await loadSourcePdfRecord(
        env,
        sourceId
      );
  } catch (error) {
    console.error(error);

    return sourcePdfError(
      "Unable to load Source PDF metadata.",
      502
    );
  }


  if (!source) {
    return sourcePdfError(
      "Source not found.",
      404
    );
  }


  let pdfInfo;


  try {
    pdfInfo =
      buildSourcePdfObjectKey(
        source.source_code
      );
  } catch {
    return sourcePdfError(
      "The Source must have a canonical sNNN Source code before a PDF can be uploaded.",
      400
    );
  }


  const declaredLength =
    Number(
      request.headers.get(
        "content-length"
      )
    );


  if (
    Number.isFinite(
      declaredLength
    ) &&
    declaredLength >
      SOURCE_PDF_MAX_BYTES
  ) {
    return sourcePdfError(
      "PDF exceeds the 50 MB upload limit.",
      413
    );
  }


  let bytes;


  try {
    bytes =
      await request.arrayBuffer();
  } catch {
    return sourcePdfError(
      "Unable to read uploaded PDF.",
      400
    );
  }


  if (!bytes.byteLength) {
    return sourcePdfError(
      "The uploaded PDF is empty.",
      400
    );
  }


  if (
    bytes.byteLength >
    SOURCE_PDF_MAX_BYTES
  ) {
    return sourcePdfError(
      "PDF exceeds the 50 MB upload limit.",
      413
    );
  }


  /*
   * Do not trust only the browser MIME type.
   * PDF files begin with "%PDF-".
   */
  const signature =
    new TextDecoder()
      .decode(
        bytes.slice(
          0,
          Math.min(
            5,
            bytes.byteLength
          )
        )
      );


  if (
    signature !== "%PDF-"
  ) {
    return sourcePdfError(
      "The uploaded file does not appear to be a valid PDF.",
      400
    );
  }


  const previousObjectKey =
    String(
      source.private_pdf_object_key ||
      ""
    ).trim();


  try {
    await env.SOURCE_PDFS.put(
      pdfInfo.object_key,
      bytes,
      {
        httpMetadata: {
          contentType:
            "application/pdf",

          contentDisposition:
            `inline; filename="${pdfInfo.file_name}"`,

          cacheControl:
            "private, no-store",
        },

        customMetadata: {
          source_id:
            String(
              source.id
            ),

          source_code:
            pdfInfo.source_code,
        },
      }
    );
  } catch (error) {
    console.error(
      "R2 PDF upload failed.",
      error
    );


    return sourcePdfError(
      "Unable to upload PDF to private storage.",
      502
    );
  }


  let updatedSource;


  try {
    updatedSource =
      await updateSourcePdfMetadata(
        env,
        source.id,
        {
          local_file_name:
            pdfInfo.file_name,

          private_pdf_object_key:
            pdfInfo.object_key,
        }
      );
  } catch (error) {
    console.error(
      "PDF was uploaded but Source metadata could not be updated.",
      error
    );


    return sourcePdfError(
      "PDF reached R2, but the Source record could not be updated.",
      502
    );
  }


  /*
   * If the Source code changed since an older
   * upload, remove the now-obsolete old key only
   * after the new object and DB metadata are safe.
   */
  if (
    previousObjectKey &&
    previousObjectKey !==
      pdfInfo.object_key
  ) {
    try {
      await env.SOURCE_PDFS.delete(
        previousObjectKey
      );
    } catch (error) {
      console.warn(
        "New PDF saved but obsolete R2 object could not be removed.",
        error
      );
    }
  }


  return Response.json(
    {
      ok: true,
      source:
        updatedSource,
    },
    {
      headers: {
        "cache-control":
          "no-store",
      },
    }
  );
}


async function handleSourcePdfDelete(
  env,
  sourceId
) {
  if (!env.SOURCE_PDFS) {
    return sourcePdfError(
      "Private PDF storage is not configured.",
      500
    );
  }


  let source;


  try {
    source =
      await loadSourcePdfRecord(
        env,
        sourceId
      );
  } catch (error) {
    console.error(error);

    return sourcePdfError(
      "Unable to load Source PDF metadata.",
      502
    );
  }


  if (!source) {
    return sourcePdfError(
      "Source not found.",
      404
    );
  }


  const objectKey =
    String(
      source.private_pdf_object_key ||
      ""
    ).trim();


  if (!objectKey) {
    return sourcePdfError(
      "No private PDF is attached to this Source.",
      404
    );
  }


  let updatedSource;


  /*
   * Clear the database reference first.
   * If R2 deletion subsequently fails, the worst
   * outcome is an orphaned private object rather
   * than a Source pointing at a missing file.
   */
  try {
    updatedSource =
      await updateSourcePdfMetadata(
        env,
        source.id,
        {
          local_file_name:
            "",

          private_pdf_object_key:
            "",
        }
      );
  } catch (error) {
    console.error(error);

    return sourcePdfError(
      "Unable to clear Source PDF metadata.",
      502
    );
  }


  let warning = "";


  try {
    await env.SOURCE_PDFS.delete(
      objectKey
    );
  } catch (error) {
    console.error(
      "Unable to remove R2 PDF after clearing database reference.",
      error
    );


    warning =
      "The Source no longer references the PDF, but the R2 object could not be removed automatically.";
  }


  return Response.json(
    {
      ok: true,

      source:
        updatedSource,

      warning,
    },
    {
      headers: {
        "cache-control":
          "no-store",
      },
    }
  );
}

async function handleCorrosionObservations(
  request,
  env
) {
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


  const url =
    new URL(
      request.url
    );


  const page =
    parseManageInteger(
      url.searchParams.get(
        "page"
      ),
      1,
      1,
      1000000
    );


  const requestedPageSize =
    parseManageInteger(
      url.searchParams.get(
        "page_size"
      ),
      50,
      1,
      200
    );


  const allowedPageSizes =
    new Set([
      25,
      50,
      100,
      200,
    ]);


  const pageSize =
    allowedPageSizes.has(
      requestedPageSize
    )
      ? requestedPageSize
      : 50;


  const searchTerm =
    cleanManageSearchTerm(
      url.searchParams.get(
        "q"
      )
    );


  const endpoint =
    new URL(
      "/rest/v1/corrosion_observations",
      env.SUPABASE_URL
    );


  endpoint.searchParams.set(
    "select",
    [
      "id",
      "site_fk",
      "source_fk",
      "site_source_fk",

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

      "normalization_note",

      "measurement_method",
      "specimen_condition",
      "exposure_condition",
      "notes",

      "created_at",
      "updated_at",

      "sites(" +
        "site_id," +
        "site_label," +
        "modern_country_location" +
      ")",

      "sources(" +
        "source_code," +
        "source_title" +
      ")",
    ].join(",")
  );


  endpoint.searchParams.set(
    "order",
    "id.desc"
  );


  if (searchTerm) {
    const clauses =
      buildManageIlikeClauses(
        [
          "material",
          "exposure_period",
          "exposure_start",
          "exposure_end",
          "corrosion_metric",
          "unit",
          "density_basis",
          "normalization_note",
          "measurement_method",
          "specimen_condition",
          "exposure_condition",
          "notes",
        ],
        searchTerm
      );


    const {
      siteIds,
      sourceIds,
    } =
      await getManageSearchRelations(
        env,
        searchTerm
      );


    if (
      siteIds.length
    ) {
      clauses.push(
        `site_fk.in.(${siteIds.join(",")})`
      );
    }


    if (
      sourceIds.length
    ) {
      clauses.push(
        `source_fk.in.(${sourceIds.join(",")})`
      );
    }


    endpoint.searchParams.set(
      "or",
      `(${clauses.join(",")})`
    );
  }


  const start =
    (
      page - 1
    ) *
    pageSize;

  const end =
    start +
    pageSize -
    1;


  const response =
    await fetch(
      endpoint,
      {
        headers: {
          apikey:
            env.SUPABASE_SECRET_KEY,

          authorization:
            `Bearer ${env.SUPABASE_SECRET_KEY}`,

          accept:
            "application/json",

          prefer:
            "count=exact",

          range:
            `${start}-${end}`,
        },
      }
    );


  if (!response.ok) {
    const detail =
      await response.text();


    console.error(
      "Corrosion observation browser query failed.",
      {
        status:
          response.status,

        detail,
      }
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to load corrosion observations.",
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


  const rows =
    await response.json();


  const total =
    manageContentRangeTotal(
      response
    );


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total /
        pageSize
      )
    );


  const observations =
    rows.map(
      (row) => ({
        id:
          row.id,

        site_fk:
          row.site_fk,

        source_fk:
          row.source_fk,

        site_source_fk:
          row.site_source_fk,

        site_id:
          row.sites?.site_id ||
          "",

        site_label:
          row.sites?.site_label ||
          "",

        modern_country_location:
          row.sites?.modern_country_location ||
          "",

        source_code:
          row.sources?.source_code ||
          "",

        source_title:
          row.sources?.source_title ||
          "",

        material:
          row.material ||
          "",

        exposure_period:
          row.exposure_period ||
          "",

        exposure_start:
          row.exposure_start ||
          "",

        exposure_end:
          row.exposure_end ||
          "",

        corrosion_metric:
          row.corrosion_metric ||
          "",

        value:
          row.value,

        unit:
          row.unit ||
          "",

        canonical_thickness_loss_rate_um_year:
          row
            .canonical_thickness_loss_rate_um_year,

        canonical_mass_loss_rate_g_m2_year:
          row
            .canonical_mass_loss_rate_g_m2_year,

        normalized_value:
          row.normalized_value,

        normalized_unit:
          row.normalized_unit ||
          "",

        density_g_cm3:
          row.density_g_cm3,

        density_basis:
          row.density_basis ||
          "",

        normalization_note:
          row.normalization_note ||
          "",

        measurement_method:
          row.measurement_method ||
          "",

        specimen_condition:
          row.specimen_condition ||
          "",

        exposure_condition:
          row.exposure_condition ||
          "",

        notes:
          row.notes ||
          "",

        created_at:
          row.created_at,

        updated_at:
          row.updated_at,
      })
    );


  return Response.json(
    {
      ok: true,

      observations,

      total,

      page,

      page_size:
        pageSize,

      total_pages:
        totalPages,
    },
    {
      headers: {
        "cache-control":
          "no-store",
      },
    }
  );
}


async function handleCorrosionWorkbookSources(
  env
) {
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


  /*
   * The empty inner embed filters Sources to only
   * those having at least one Site–Source relationship,
   * without sending every link to the browser.
   */
  const endpoint =
    new URL(
      "/rest/v1/sources",
      env.SUPABASE_URL
    );


  endpoint.searchParams.set(
    "select",
    [
      "id",
      "source_code",
      "source_title",
      "programme",
      "private_pdf_object_key",
      "site_sources!inner()",
    ].join(",")
  );


  endpoint.searchParams.set(
    "order",
    "source_code.asc"
  );


  const response =
    await fetch(
      endpoint,
      {
        headers: {
          apikey:
            env.SUPABASE_SECRET_KEY,

          authorization:
            `Bearer ${env.SUPABASE_SECRET_KEY}`,

          accept:
            "application/json",
        },
      }
    );


  if (!response.ok) {
    const detail =
      await response.text();


    console.error(
      "Unable to load corrosion workbook Sources.",
      {
        status:
          response.status,

        detail,
      }
    );


    return Response.json(
      {
        ok: false,

        error:
          "Unable to load Sources available for corrosion workbooks.",
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


  const rows =
    await response.json();


  const sources =
    rows.map(
      (row) => ({
        id:
          row.id,

        source_code:
          row.source_code ||
          "",

        source_title:
          row.source_title ||
          "",

        programme:
          row.programme ||
          "",

        has_private_pdf:
          Boolean(
            String(
              row.private_pdf_object_key ||
              ""
            ).trim()
          ),
      })
    );


  return Response.json(
    {
      ok: true,
      sources,
    },
    {
      headers: {
        "cache-control":
          "no-store",
      },
    }
  );
}

function corrosionXmlEscape(
  value
) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    );
}


function corrosionCleanText(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}


function corrosionComparableText(
  value
) {
  return corrosionCleanText(
    value
  ).toLocaleLowerCase();
}


function corrosionExtractRowXml(
  sheetXml,
  rowNumber
) {
  const expression =
    new RegExp(
      `<row\\s+r="${rowNumber}"[^>]*>` +
      `[\\s\\S]*?<\\/row>`
    );

  const match =
    sheetXml.match(
      expression
    );

  return match
    ? match[0]
    : "";
}


function corrosionExtractFirstDataRow(
  sheetXml
) {
  const expression =
    /<row\s+r="(\d+)"[^>]*>[\s\S]*?<\/row>/g;

  let match;

  while (
    (
      match =
        expression.exec(
          sheetXml
        )
    )
  ) {
    const rowNumber =
      Number(
        match[1]
      );

    if (
      Number.isInteger(
        rowNumber
      ) &&
      rowNumber >= 2
    ) {
      return {
        rowNumber,
        xml:
          match[0],
      };
    }
  }

  return null;
}


function corrosionExtractCellXml(
  rowXml,
  columnLetter,
  rowNumber
) {
  const expression =
    new RegExp(
      `<c\\s+r="${columnLetter}${rowNumber}"` +
      `[^>]*` +
      `(?:\\/>|>[\\s\\S]*?<\\/c>)`
    );

  const match =
    rowXml.match(
      expression
    );

  return match
    ? match[0]
    : "";
}


function corrosionCellStyle(
  rowXml,
  columnLetter,
  rowNumber
) {
  const cellXml =
    corrosionExtractCellXml(
      rowXml,
      columnLetter,
      rowNumber
    );

  if (!cellXml) {
    return "";
  }

  const styleMatch =
    cellXml.match(
      /\ss="(\d+)"/
    );

  return styleMatch
    ? styleMatch[1]
    : "";
}


function corrosionStyleAttribute(
  styleId
) {
  return styleId
    ? ` s="${styleId}"`
    : "";
}


function corrosionInlineCell(
  columnLetter,
  rowNumber,
  styleId,
  value
) {
  const text =
    corrosionCleanText(
      value
    );

  const style =
    corrosionStyleAttribute(
      styleId
    );

  if (!text) {
    return (
      `<c r="${columnLetter}${rowNumber}"` +
      `${style} t="inlineStr"/>`
    );
  }

  return (
    `<c r="${columnLetter}${rowNumber}"` +
    `${style} t="inlineStr">` +
    `<is><t>${corrosionXmlEscape(text)}</t></is>` +
    `</c>`
  );
}


function corrosionNumberCell(
  columnLetter,
  rowNumber,
  styleId,
  value
) {
  const numeric =
    Number(value);

  if (
    value === "" ||
    value === null ||
    value === undefined ||
    !Number.isFinite(
      numeric
    )
  ) {
    return corrosionInlineCell(
      columnLetter,
      rowNumber,
      styleId,
      ""
    );
  }

  return (
    `<c r="${columnLetter}${rowNumber}"` +
    `${corrosionStyleAttribute(styleId)} t="n">` +
    `<v>${numeric}</v>` +
    `</c>`
  );
}


function corrosionShiftTemplateCell(
  cellXml,
  columnLetter,
  sourceRowNumber,
  targetRowNumber
) {
  if (!cellXml) {
    return "";
  }

  let shifted =
    cellXml.replace(
      new RegExp(
        `r="${columnLetter}${sourceRowNumber}"`,
        "g"
      ),
      `r="${columnLetter}${targetRowNumber}"`
    );

  /*
   * Shift ordinary/row-relative cell references such as:
   *
   * G2
   * $G2
   * K2
   *
   * Absolute references such as $E$2 remain unchanged
   * because the row number is preceded by "$".
   */
  shifted =
    shifted.replace(
      new RegExp(
        `([A-Z]{1,3})${sourceRowNumber}\\b`,
        "g"
      ),
      `$1${targetRowNumber}`
    );

  return shifted;
}


function corrosionBuildWorkbookRow(
  record,
  rowNumber,
  seedRowXml,
  seedRowNumber
) {
  const styles = {};

  for (
    const column
    of [
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
      "M",
      "N",
      "O",
      "P",
      "Q",
      "R",
      "S",
      "T",
      "V",
      "W",
    ]
  ) {
    styles[column] =
      corrosionCellStyle(
        seedRowXml,
        column,
        seedRowNumber
      );
  }


  const cells = [];


  cells.push(
    corrosionInlineCell(
      "A",
      rowNumber,
      styles.A,
      record.source_code
    )
  );

  cells.push(
    corrosionInlineCell(
      "B",
      rowNumber,
      styles.B,
      record.source_title
    )
  );

  cells.push(
    corrosionInlineCell(
      "C",
      rowNumber,
      styles.C,
      record.site_id
    )
  );

  cells.push(
    corrosionInlineCell(
      "D",
      rowNumber,
      styles.D,
      record.site_label
    )
  );

  cells.push(
    corrosionInlineCell(
      "E",
      rowNumber,
      styles.E,
      record.country
    )
  );


  if (
    record.observation_id !== "" &&
    record.observation_id !== null &&
    record.observation_id !== undefined &&
    Number.isFinite(
      Number(
        record.observation_id
      )
    )
  ) {
    cells.push(
      corrosionNumberCell(
        "F",
        rowNumber,
        styles.F,
        record.observation_id
      )
    );
  } else {
    cells.push(
      corrosionInlineCell(
        "F",
        rowNumber,
        styles.F,
        ""
      )
    );
  }


  cells.push(
    corrosionInlineCell(
      "G",
      rowNumber,
      styles.G,
      record.material
    )
  );

  cells.push(
    corrosionInlineCell(
      "H",
      rowNumber,
      styles.H,
      record.exposure_period
    )
  );

  cells.push(
    corrosionInlineCell(
      "I",
      rowNumber,
      styles.I,
      record.exposure_start
    )
  );

  cells.push(
    corrosionInlineCell(
      "J",
      rowNumber,
      styles.J,
      record.exposure_end
    )
  );

  cells.push(
    corrosionInlineCell(
      "K",
      rowNumber,
      styles.K,
      record.corrosion_metric
    )
  );

  cells.push(
    corrosionNumberCell(
      "L",
      rowNumber,
      styles.L,
      record.reported_value
    )
  );

  cells.push(
    corrosionInlineCell(
      "M",
      rowNumber,
      styles.M,
      record.reported_unit
    )
  );


  /*
   * N/P/Q/R/S/V/W retain the formulas from the
   * legacy-generated runtime scaffold.
   */
  for (
    const column
    of [
      "N",
      "P",
      "Q",
      "R",
      "S",
    ]
  ) {
    const templateCell =
      corrosionExtractCellXml(
        seedRowXml,
        column,
        seedRowNumber
      );

    const shifted =
      corrosionShiftTemplateCell(
        templateCell,
        column,
        seedRowNumber,
        rowNumber
      );

    if (!shifted) {
      throw new Error(
        `Runtime workbook template is missing formula cell ${column}${seedRowNumber}.`
      );
    }

    cells.push(
      shifted
    );
  }


  cells.push(
    corrosionInlineCell(
      "O",
      rowNumber,
      styles.O,
      record.density_override_g_cm3
    )
  );


  /*
   * O belongs between N and P in worksheet order.
   *
   * Move it into the correct position after N.
   */
  const oCell =
    cells.pop();

  cells.splice(
    14,
    0,
    oCell
  );


  cells.push(
    corrosionInlineCell(
      "T",
      rowNumber,
      styles.T,
      record.notes
    )
  );


  for (
    const column
    of [
      "V",
      "W",
    ]
  ) {
    const templateCell =
      corrosionExtractCellXml(
        seedRowXml,
        column,
        seedRowNumber
      );

    const shifted =
      corrosionShiftTemplateCell(
        templateCell,
        column,
        seedRowNumber,
        rowNumber
      );

    if (!shifted) {
      throw new Error(
        `Runtime workbook template is missing helper formula cell ${column}${seedRowNumber}.`
      );
    }

    cells.push(
      shifted
    );
  }


  return (
    `<row r="${rowNumber}">` +
    cells.join("") +
    `</row>`
  );
}


function corrosionUpdateSqref(
  sheetXml,
  columnLetter,
  lastDataRow
) {
  const expression =
    new RegExp(
      `sqref="${columnLetter}2` +
      `(?::${columnLetter}\\d+)?"`,
      "g"
    );

  return sheetXml.replace(
    expression,
    `sqref="${columnLetter}2:${columnLetter}${lastDataRow}"`
  );
}


function corrosionMutateObservationSheet(
  sheetXml,
  records
) {
  if (
    !Array.isArray(
      records
    ) ||
    records.length === 0
  ) {
    throw new Error(
      "No workbook rows were generated."
    );
  }


  const headerRow =
    corrosionExtractRowXml(
      sheetXml,
      1
    );

  if (!headerRow) {
    throw new Error(
      "Runtime workbook template has no header row."
    );
  }


  const seed =
    corrosionExtractFirstDataRow(
      sheetXml
    );

  if (!seed) {
    throw new Error(
      "Runtime workbook template has no starter data row."
    );
  }


  const generatedRows = [];

  for (
    let index = 0;
    index < records.length;
    index += 1
  ) {
    const rowNumber =
      index + 2;

    generatedRows.push(
      corrosionBuildWorkbookRow(
        records[index],
        rowNumber,
        seed.xml,
        seed.rowNumber
      )
    );
  }


  const lastDataRow =
    records.length + 1;


  const sheetData =
    `<sheetData>` +
    headerRow +
    generatedRows.join("") +
    `</sheetData>`;


  let output =
    sheetXml.replace(
      /<sheetData>[\s\S]*?<\/sheetData>/,
      sheetData
    );


  output =
    output.replace(
      /<dimension ref="[^"]*"\/>/,
      `<dimension ref="A1:W${lastDataRow}"/>`
    );


  output =
    output.replace(
      /<autoFilter ref="[^"]*"\/>/,
      `<autoFilter ref="A1:T${lastDataRow}"/>`
    );


  /*
   * Conditional formatting.
   */
  output =
    output.replace(
      /sqref="G2:M\d+"/g,
      `sqref="G2:M${lastDataRow}"`
    );

  output =
    output.replace(
      /sqref="S2(?::S\d+)?"/g,
      `sqref="S2:S${lastDataRow}"`
    );


  /*
   * Validation ranges.
   */
  for (
    const column
    of [
      "G",
      "H",
      "K",
      "L",
      "M",
      "O",
    ]
  ) {
    output =
      corrosionUpdateSqref(
        output,
        column,
        lastDataRow
      );
  }


  return {
    xml:
      output,

    lastDataRow,
  };
}


function corrosionMutateWorkbookXml(
  workbookXml,
  lastDataRow
) {
  let output =
    workbookXml;


  /*
   * Update Excel's hidden AutoFilter defined name.
   */
  output =
    output.replace(
      /'Corrosion Observations'!\$A\$1:\$T\$\d+/g,
      `'Corrosion Observations'!$A$1:$T$${lastDataRow}`
    );


  /*
   * Ensure formulas recalculate when Excel opens.
   */
  if (
    output.includes(
      "<calcPr "
    )
  ) {
    output =
      output.replace(
        /<calcPr\b[^>]*\/>/,
        '<calcPr calcMode="auto" fullCalcOnLoad="1" calcOnSave="1" forceFullCalc="1"/>'
      );
  }


  return output;
}

async function loadCorrosionWorkbookRecords(
  env,
  sourceId
) {
  const id =
    Number(
      sourceId
    );


  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new Error(
      "Invalid Source ID."
    );
  }


  const commonHeaders = {
    apikey:
      env.SUPABASE_SECRET_KEY,

    authorization:
      `Bearer ${env.SUPABASE_SECRET_KEY}`,

    accept:
      "application/json",
  };


  /*
   * ------------------------------------------------------
   * Source
   * ------------------------------------------------------
   */

  const sourceEndpoint =
    new URL(
      "/rest/v1/sources",
      env.SUPABASE_URL
    );


  sourceEndpoint.searchParams.set(
    "select",
    [
      "id",
      "source_code",
      "source_title",
    ].join(",")
  );

  sourceEndpoint.searchParams.set(
    "id",
    `eq.${id}`
  );

  sourceEndpoint.searchParams.set(
    "limit",
    "1"
  );


  const sourceResponse =
    await fetch(
      sourceEndpoint,
      {
        headers:
          commonHeaders,
      }
    );


  if (!sourceResponse.ok) {
    throw new Error(
      "Unable to load Source for workbook generation."
    );
  }


  const sourceRows =
    await sourceResponse.json();


  const source =
    sourceRows[0] ||
    null;


  if (!source) {
    throw new Error(
      "Source not found."
    );
  }


  /*
   * ------------------------------------------------------
   * Linked Sites
   * ------------------------------------------------------
   */

  const linkEndpoint =
    new URL(
      "/rest/v1/site_sources",
      env.SUPABASE_URL
    );


  linkEndpoint.searchParams.set(
    "select",
    [
      "site_fk",
      "sites(" +
        "site_id," +
        "site_label," +
        "modern_country_location" +
      ")",
    ].join(",")
  );

  linkEndpoint.searchParams.set(
    "source_fk",
    `eq.${id}`
  );


  const linkResponse =
    await fetch(
      linkEndpoint,
      {
        headers:
          commonHeaders,
      }
    );


  if (!linkResponse.ok) {
    throw new Error(
      "Unable to load linked Sites for workbook generation."
    );
  }


  const linkRows =
    await linkResponse.json();


  const sites = [];


  for (
    const link
    of linkRows
  ) {
    if (
      !link.sites ||
      !corrosionCleanText(
        link.sites.site_id
      )
    ) {
      continue;
    }


    sites.push({
      site_fk:
        Number(
          link.site_fk
        ),

      site_id:
        corrosionCleanText(
          link.sites.site_id
        ),

      site_label:
        corrosionCleanText(
          link.sites.site_label
        ),

      country:
        corrosionCleanText(
          link
            .sites
            .modern_country_location
        ),
    });
  }


  if (
    sites.length === 0
  ) {
    throw new Error(
      `Source ${source.source_code || id} has no linked Sites.`
    );
  }


  sites.sort(
    (a, b) => {
      const labelCompare =
        corrosionComparableText(
          a.site_label
        ).localeCompare(
          corrosionComparableText(
            b.site_label
          )
        );

      if (
        labelCompare !== 0
      ) {
        return labelCompare;
      }

      return corrosionComparableText(
        a.site_id
      ).localeCompare(
        corrosionComparableText(
          b.site_id
        )
      );
    }
  );


  /*
   * ------------------------------------------------------
   * Existing observations
   * ------------------------------------------------------
   */

  const observationEndpoint =
    new URL(
      "/rest/v1/corrosion_observations",
      env.SUPABASE_URL
    );


  observationEndpoint.searchParams.set(
    "select",
    [
      "id",
      "site_fk",
      "material",
      "exposure_period",
      "exposure_start",
      "exposure_end",
      "corrosion_metric",
      "value",
      "unit",
      "notes",
    ].join(",")
  );


  observationEndpoint.searchParams.set(
    "source_fk",
    `eq.${id}`
  );


  const observationResponse =
    await fetch(
      observationEndpoint,
      {
        headers:
          commonHeaders,
      }
    );


  if (
    !observationResponse.ok
  ) {
    throw new Error(
      "Unable to load existing corrosion observations."
    );
  }


  const observations =
    await observationResponse.json();


  const observationsBySite =
    new Map();


  for (
    const observation
    of observations
  ) {
    const siteFk =
      Number(
        observation.site_fk
      );


    if (
      !observationsBySite.has(
        siteFk
      )
    ) {
      observationsBySite.set(
        siteFk,
        []
      );
    }


    observationsBySite
      .get(siteFk)
      .push(
        observation
      );
  }


  for (
    const siteObservations
    of observationsBySite.values()
  ) {
    siteObservations.sort(
      (a, b) => {
        const keys = [
          "material",
          "exposure_period",
          "exposure_start",
          "exposure_end",
          "corrosion_metric",
        ];


        for (
          const key
          of keys
        ) {
          const comparison =
            corrosionComparableText(
              a[key]
            ).localeCompare(
              corrosionComparableText(
                b[key]
              )
            );

          if (
            comparison !== 0
          ) {
            return comparison;
          }
        }


        return (
          Number(a.id || 0) -
          Number(b.id || 0)
        );
      }
    );
  }


  /*
   * ------------------------------------------------------
   * Source -> Sites -> existing observations -> one starter
   * row per linked Site.
   * ------------------------------------------------------
   */

  const records = [];


  for (
    const site
    of sites
  ) {
    const existing =
      observationsBySite.get(
        site.site_fk
      ) ||
      [];


    for (
      const observation
      of existing
    ) {
      records.push({
        source_code:
          corrosionCleanText(
            source.source_code
          ),

        source_title:
          corrosionCleanText(
            source.source_title
          ),

        site_id:
          site.site_id,

        site_label:
          site.site_label,

        country:
          site.country,

        observation_id:
          observation.id,

        material:
          corrosionCleanText(
            observation.material
          ),

        exposure_period:
          corrosionCleanText(
            observation.exposure_period
          ),

        exposure_start:
          corrosionCleanText(
            observation.exposure_start
          ),

        exposure_end:
          corrosionCleanText(
            observation.exposure_end
          ),

        corrosion_metric:
          corrosionCleanText(
            observation.corrosion_metric
          ),

        reported_value:
          observation.value,

        reported_unit:
          corrosionCleanText(
            observation.unit
          ),

        density_override_g_cm3:
          "",

        notes:
          corrosionCleanText(
            observation.notes
          ),
      });
    }


    /*
     * Exactly one new-observation starter row,
     * matching the current macro-enabled legacy workflow.
     */
    records.push({
      source_code:
        corrosionCleanText(
          source.source_code
        ),

      source_title:
        corrosionCleanText(
          source.source_title
        ),

      site_id:
        site.site_id,

      site_label:
        site.site_label,

      country:
        site.country,

      observation_id:
        "",

      material:
        "",

      exposure_period:
        "",

      exposure_start:
        "",

      exposure_end:
        "",

      corrosion_metric:
        "",

      reported_value:
        "",

      reported_unit:
        "",

      density_override_g_cm3:
        "",

      notes:
        "",
    });
  }


  return {
    source,
    sites,
    observations,
    records,
  };
}

async function handleCorrosionWorkbookGenerate(
  request,
  env
) {
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


  const url =
    new URL(
      request.url
    );


  const sourceId =
    Number(
      url.searchParams.get(
        "source_id"
      )
    );


  if (
    !Number.isInteger(
      sourceId
    ) ||
    sourceId <= 0
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "A valid Source ID is required.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  try {
    const workbookData =
      await loadCorrosionWorkbookRecords(
        env,
        sourceId
      );


    /*
     * Fetch the protected static XLSM scaffold.
     */
    const templateUrl =
      new URL(
        "/templates/corrosion_entry_runtime_template.xlsm",
        request.url
      );


    const templateResponse =
      await env.ASSETS.fetch(
        new Request(
          templateUrl.toString(),
          {
            method:
              "GET",
          }
        )
      );


    if (
      !templateResponse.ok
    ) {
      throw new Error(
        "Native corrosion workbook runtime template was not found."
      );
    }


    const templateBytes =
      await templateResponse.arrayBuffer();


    const zip =
      await JSZip.loadAsync(
        templateBytes
      );


    const sheetFile =
      zip.file(
        "xl/worksheets/sheet1.xml"
      );


    const workbookFile =
      zip.file(
        "xl/workbook.xml"
      );


    if (
      !sheetFile ||
      !workbookFile
    ) {
      throw new Error(
        "Runtime XLSM template has an invalid workbook structure."
      );
    }


    const sheetXml =
      await sheetFile.async(
        "string"
      );


    const workbookXml =
      await workbookFile.async(
        "string"
      );


    const mutatedSheet =
      corrosionMutateObservationSheet(
        sheetXml,
        workbookData.records
      );


    const mutatedWorkbookXml =
      corrosionMutateWorkbookXml(
        workbookXml,
        mutatedSheet.lastDataRow
      );


    /*
     * Replace ONLY the workbook XML parts we intentionally
     * modify. VBA, ActiveX, VML, comments, styles and other
     * package parts remain untouched.
     */
    zip.file(
      "xl/worksheets/sheet1.xml",
      mutatedSheet.xml
    );


    zip.file(
      "xl/workbook.xml",
      mutatedWorkbookXml
    );


    const output =
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


    const sourceCode =
      corrosionCleanText(
        workbookData
          .source
          .source_code
      ) ||
      `source_${sourceId}`;


    return new Response(
      output,
      {
        status:
          200,

        headers: {
          "content-type":
            "application/vnd.ms-excel.sheet.macroEnabled.12",

          "content-disposition":
            `attachment; filename="${sourceCode}_corrosion_observations.xlsm"`,

          "cache-control":
            "private, no-store",

          "x-corrosion-linked-sites":
            String(
              workbookData
                .sites
                .length
            ),

          "x-corrosion-existing-observations":
            String(
              workbookData
                .observations
                .length
            ),
        },
      }
    );
  } catch (error) {
    console.error(
      "Corrosion XLSM generation failed.",
      error
    );


    return Response.json(
      {
        ok: false,

        error:
          error?.message ||
          "Unable to generate corrosion workbook.",
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
}

async function fetchAllCorrosionContextRows(
  env,
  table,
  select
) {
  const allRows = [];

  const pageSize =
    1000;

  let start =
    0;


  while (true) {
    const endpoint =
      new URL(
        `/rest/v1/${table}`,
        env.SUPABASE_URL
      );


    endpoint.searchParams.set(
      "select",
      select
    );


    const response =
      await fetch(
        endpoint,
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
        `Unable to load ${table} for corrosion validation.`,
        response.status,
        await response.text()
      );


      throw new Error(
        "Unable to load database context for corrosion validation."
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


async function loadCorrosionValidationContext(
  env
) {
  const [
    siteRows,
    sourceRows,
    linkRows,
    observationRows,
  ] =
    await Promise.all([
      fetchAllCorrosionContextRows(
        env,
        "sites",
        "site_id"
      ),

      fetchAllCorrosionContextRows(
        env,
        "sources",
        "source_code"
      ),

      fetchAllCorrosionContextRows(
        env,
        "site_sources",
        "sites(site_id),sources(source_code)"
      ),

      fetchAllCorrosionContextRows(
        env,
        "corrosion_observations",
        "id,sites(site_id),sources(source_code)"
      ),
    ]);


  const existingSiteIds =
    siteRows
      .map(
        (row) =>
          String(
            row.site_id ||
            ""
          ).trim()
      )
      .filter(Boolean);


  const existingSourceCodes =
    sourceRows
      .map(
        (row) =>
          normaliseSourceCode(
            row.source_code
          )
      )
      .filter(Boolean);


  const existingSiteSourcePairs =
    linkRows
      .map(
        (row) => [
          String(
            row.sites
              ?.site_id ||
            ""
          ).trim(),

          normaliseSourceCode(
            row.sources
              ?.source_code ||
            ""
          ),
        ]
      )
      .filter(
        ([siteId, sourceCode]) =>
          siteId &&
          sourceCode
      );


  const existingObservations =
    observationRows
      .map(
        (row) => ({
          id:
            row.id,

          site_id:
            String(
              row.sites
                ?.site_id ||
              ""
            ).trim(),

          source_code:
            String(
              row.sources
                ?.source_code ||
              ""
            ).trim(),
        })
      );


  return {
    existingSiteIds,
    existingSourceCodes,
    existingSiteSourcePairs,
    existingObservations,
  };
}


async function handleCorrosionWorkbookPreview(
  request,
  env
) {
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


  let fileName = "";


  try {
    fileName =
      decodeURIComponent(
        request.headers.get(
          "x-corrosion-file-name"
        ) ||
        ""
      );
  } catch {
    fileName =
      "";
  }


  if (
    fileName &&
    !/\.(xlsm|xlsx)$/i.test(
      fileName
    )
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "Upload an XLSM or XLSX corrosion workbook.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  let bytes;


  try {
    bytes =
      await request.arrayBuffer();
  } catch {
    return Response.json(
      {
        ok: false,
        error:
          "Unable to read uploaded workbook.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  if (
    !bytes.byteLength
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "The uploaded workbook is empty.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  try {
    const records =
      readCorrosionWorkbook(
        bytes
      );


    if (
      records.length === 0
    ) {
      return Response.json(
        {
          ok: true,

          file_name:
            fileName,

          preview:
            [],

          summary: {
            total:
              0,

            ready:
              0,

            errors:
              0,

            create:
              0,

            update:
              0,
          },
        },
        {
          headers: {
            "cache-control":
              "no-store",
          },
        }
      );
    }


    const context =
      await loadCorrosionValidationContext(
        env
      );


    const preview =
      validateCorrosionWorkbookRows(
        records,
        context
      );


    const summary = {
      total:
        preview.length,

      ready:
        preview.filter(
          (row) =>
            row.validation_status ===
            "READY"
        ).length,

      errors:
        preview.filter(
          (row) =>
            row.validation_status ===
            "ERROR"
        ).length,

      create:
        preview.filter(
          (row) =>
            row.record_action ===
            "CREATE"
        ).length,

      update:
        preview.filter(
          (row) =>
            row.record_action ===
            "UPDATE"
        ).length,
    };


    return Response.json(
      {
        ok: true,

        file_name:
          fileName,

        preview,

        summary,
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
      "Corrosion workbook preview failed.",
      error
    );


    return Response.json(
      {
        ok: false,

        error:
          error?.message ||
          "Unable to validate corrosion workbook.",
      },
      {
        status: 400,

        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }
}

function corrosionImportKey(
  value
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLocaleLowerCase();
}


function corrosionObservationIdentityKey({
  siteFk,
  sourceFk,
  material,
  exposurePeriod,
  exposureStart,
  exposureEnd,
  corrosionMetric,
  measurementMethod = "",
  specimenCondition = "",
  exposureCondition = "",
}) {
  return [
    Number(siteFk),
    Number(sourceFk),

    corrosionImportKey(
      material
    ),

    corrosionImportKey(
      exposurePeriod
    ),

    corrosionImportKey(
      exposureStart
    ),

    corrosionImportKey(
      exposureEnd
    ),

    corrosionImportKey(
      corrosionMetric
    ),

    corrosionImportKey(
      measurementMethod
    ),

    corrosionImportKey(
      specimenCondition
    ),

    corrosionImportKey(
      exposureCondition
    ),
  ].join(
    "\u0000"
  );
}


function corrosionOptionalNumber(
  value
) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }


  const number =
    Number(value);


  return Number.isFinite(
    number
  )
    ? number
    : null;
}


async function loadCorrosionImportContext(
  env
) {
  const [
    sites,
    sources,
    links,
    observations,
  ] =
    await Promise.all([
      fetchAllCorrosionContextRows(
        env,
        "sites",
        [
          "id",
          "site_id",
          "metal",
          "exposure_period",
        ].join(",")
      ),

      fetchAllCorrosionContextRows(
        env,
        "sources",
        [
          "id",
          "source_code",
        ].join(",")
      ),

      fetchAllCorrosionContextRows(
        env,
        "site_sources",
        [
          "id",
          "site_fk",
          "source_fk",
          "metals",
          "exposure_periods",
          "sites(site_id)",
          "sources(source_code)",
        ].join(",")
      ),

      fetchAllCorrosionContextRows(
        env,
        "corrosion_observations",
        [
          "id",
          "site_fk",
          "source_fk",

          "material",
          "exposure_period",
          "exposure_start",
          "exposure_end",
          "corrosion_metric",

          "measurement_method",
          "specimen_condition",
          "exposure_condition",

          "sites(site_id)",
          "sources(source_code)",
        ].join(",")
      ),
    ]);


  const validationContext = {
    existingSiteIds:
      sites
        .map(
          (row) =>
            String(
              row.site_id ||
              ""
            ).trim()
        )
        .filter(Boolean),

    existingSourceCodes:
      sources
        .map(
          (row) =>
            normaliseSourceCode(
              row.source_code
            )
        )
        .filter(Boolean),

    existingSiteSourcePairs:
      links
        .map(
          (row) => [
            String(
              row.sites
                ?.site_id ||
              ""
            ).trim(),

            normaliseSourceCode(
              row.sources
                ?.source_code ||
              ""
            ),
          ]
        )
        .filter(
          (pair) =>
            pair[0] &&
            pair[1]
        ),

    existingObservations:
      observations.map(
        (row) => ({
          id:
            row.id,

          site_id:
            String(
              row.sites
                ?.site_id ||
              ""
            ).trim(),

          source_code:
            String(
              row.sources
                ?.source_code ||
              ""
            ).trim(),
        })
      ),
  };


  return {
    sites,
    sources,
    links,
    observations,
    validationContext,
  };
}


async function writeCorrosionObservation(
  env,
  {
    id = null,
    payload,
  }
) {
  const endpoint =
    new URL(
      "/rest/v1/corrosion_observations",
      env.SUPABASE_URL
    );


  const headers = {
    apikey:
      env.SUPABASE_SECRET_KEY,

    authorization:
      `Bearer ${env.SUPABASE_SECRET_KEY}`,

    "content-type":
      "application/json",

    accept:
      "application/json",

    prefer:
      "return=representation",
  };


  let response;


  if (
    id !== null
  ) {
    endpoint.searchParams.set(
      "id",
      `eq.${Number(id)}`
    );


    response =
      await fetch(
        endpoint,
        {
          method:
            "PATCH",

          headers,

          body:
            JSON.stringify(
              payload
            ),
        }
      );

  } else {
    response =
      await fetch(
        endpoint,
        {
          method:
            "POST",

          headers,

          body:
            JSON.stringify(
              payload
            ),
        }
      );
  }


  if (!response.ok) {
    const detail =
      await response.text();


    console.error(
      "Corrosion observation write failed.",
      {
        id,
        status:
          response.status,
        detail,
      }
    );


    throw new Error(
      id === null
        ? "Unable to create corrosion observation."
        : `Unable to update corrosion observation #${id}.`
    );
  }


  const rows =
    await response.json();


  if (
    id !== null &&
    rows.length === 0
  ) {
    throw new Error(
      `Corrosion observation #${id} was not found during import.`
    );
  }


  return rows[0] ||
    null;
}


async function updateCorrosionLinkMetadata(
  env,
  linkUpdates
) {
  const headers = {
    apikey:
      env.SUPABASE_SECRET_KEY,

    authorization:
      `Bearer ${env.SUPABASE_SECRET_KEY}`,

    "content-type":
      "application/json",

    accept:
      "application/json",
  };


  for (
    const update
    of linkUpdates.values()
  ) {
    const endpoint =
      new URL(
        "/rest/v1/site_sources",
        env.SUPABASE_URL
      );


    endpoint.searchParams.set(
      "id",
      `eq.${update.id}`
    );


    const response =
      await fetch(
        endpoint,
        {
          method:
            "PATCH",

          headers,

          body:
            JSON.stringify({
              metals:
                update.metals,

              exposure_periods:
                update.exposure_periods,
            }),
        }
      );


    if (!response.ok) {
      console.error(
        "Unable to update corrosion Site–Source metadata.",
        response.status,
        await response.text()
      );


      throw new Error(
        "Corrosion observations were saved, but Site–Source metadata could not be updated."
      );
    }
  }
}


async function handleCorrosionWorkbookImport(
  request,
  env
) {
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


  let fileName = "";


  try {
    fileName =
      decodeURIComponent(
        request.headers.get(
          "x-corrosion-file-name"
        ) ||
        ""
      );
  } catch {
    fileName =
      "";
  }


  if (
    fileName &&
    !/\.(xlsm|xlsx)$/i.test(
      fileName
    )
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "Upload an XLSM or XLSX corrosion workbook.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  let bytes;


  try {
    bytes =
      await request.arrayBuffer();
  } catch {
    return Response.json(
      {
        ok: false,
        error:
          "Unable to read uploaded workbook.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  if (
    !bytes.byteLength
  ) {
    return Response.json(
      {
        ok: false,
        error:
          "The uploaded workbook is empty.",
      },
      {
        status: 400,
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }


  try {
    /*
     * ---------------------------------------------------
     * Parse the ORIGINAL workbook again.
     * Nothing from the browser preview is trusted.
     * ---------------------------------------------------
     */

    let records =
      readCorrosionWorkbook(
        bytes
      );


    records =
      records.map(
        (record) => ({
          ...record,

          source_code:
            normaliseSourceCode(
              record.source_code
            ),
        })
      );


    if (
      records.length === 0
    ) {
      return Response.json(
        {
          ok: false,

          error:
            "No completed corrosion observation rows were found.",
        },
        {
          status: 400,

          headers: {
            "cache-control":
              "no-store",
          },
        }
      );
    }


    const context =
      await loadCorrosionImportContext(
        env
      );


    /*
     * ---------------------------------------------------
     * Full independent validation AGAIN.
     * ---------------------------------------------------
     */

    const validated =
      validateCorrosionWorkbookRows(
        records,
        context.validationContext
      );


    const errors =
      validated.filter(
        (row) =>
          row.validation_status ===
          "ERROR"
      );


    if (
      errors.length > 0
    ) {
      return Response.json(
        {
          ok: false,

          error:
            `Import stopped because ${errors.length} workbook row(s) failed revalidation.`,

          validation_errors:
            errors.map(
              (row) => ({
                excel_row:
                  row.excel_row,

                message:
                  row.validation_message,
              })
            ),
        },
        {
          status: 409,

          headers: {
            "cache-control":
              "no-store",
          },
        }
      );
    }


    /*
     * ---------------------------------------------------
     * Build lookup maps BEFORE making any writes.
     * ---------------------------------------------------
     */

    const sitesByCode =
      new Map();


    for (
      const site
      of context.sites
    ) {
      sitesByCode.set(
        corrosionImportKey(
          site.site_id
        ),
        site
      );
    }


    const sourcesByCode =
      new Map();


    for (
      const source
      of context.sources
    ) {
      sourcesByCode.set(
        corrosionImportKey(
          normaliseSourceCode(
            source.source_code
          )
        ),
        source
      );
    }


    const linksByPair =
      new Map();


    for (
      const link
      of context.links
    ) {
      linksByPair.set(
        `${Number(
          link.site_fk
        )}\u0000${Number(
          link.source_fk
        )}`,
        link
      );
    }


    const observationsById =
      new Map();


    const observationsByIdentity =
      new Map();


    for (
      const observation
      of context.observations
    ) {
      const id =
        Number(
          observation.id
        );


      observationsById.set(
        id,
        observation
      );


      observationsByIdentity.set(
        corrosionObservationIdentityKey({
          siteFk:
            observation.site_fk,

          sourceFk:
            observation.source_fk,

          material:
            observation.material,

          exposurePeriod:
            observation.exposure_period,

          exposureStart:
            observation.exposure_start,

          exposureEnd:
            observation.exposure_end,

          corrosionMetric:
            observation.corrosion_metric,

          measurementMethod:
            observation.measurement_method,

          specimenCondition:
            observation.specimen_condition,

          exposureCondition:
            observation.exposure_condition,
        }),
        observation
      );
    }


    /*
     * ---------------------------------------------------
     * Preflight every validated row.
     *
     * No DB writes occur until every row has resolved
     * Site / Source / Site–Source provenance.
     * ---------------------------------------------------
     */

    const operations = [];


    for (
      const row
      of validated
    ) {
      const site =
        sitesByCode.get(
          corrosionImportKey(
            row.site_id
          )
        );


      const source =
        sourcesByCode.get(
          corrosionImportKey(
            normaliseSourceCode(
              row.source_code
            )
          )
        );


      if (
        !site ||
        !source
      ) {
        throw new Error(
          `Excel row ${row.excel_row}: Site or Source disappeared after validation.`
        );
      }


      const link =
        linksByPair.get(
          `${Number(site.id)}\u0000${Number(source.id)}`
        );


      if (!link) {
        throw new Error(
          `Excel row ${row.excel_row}: the Site–Source relationship no longer exists.`
        );
      }


      let targetObservationId =
        null;


      if (
        row.observation_id !== null &&
        row.observation_id !== undefined &&
        String(
          row.observation_id
        ).trim() !== ""
      ) {
        const requestedId =
          Number(
            row.observation_id
          );


        const existing =
          observationsById.get(
            requestedId
          );


        if (!existing) {
          throw new Error(
            `Excel row ${row.excel_row}: observation #${requestedId} no longer exists.`
          );
        }


        if (
          Number(
            existing.site_fk
          ) !==
            Number(site.id) ||
          Number(
            existing.source_fk
          ) !==
            Number(source.id)
        ) {
          throw new Error(
            `Excel row ${row.excel_row}: observation #${requestedId} belongs to a different Site/Source pair.`
          );
        }


        targetObservationId =
          requestedId;

      } else {
        /*
         * Legacy behavior:
         * a row without observation_id still updates an
         * existing record if its complete observation
         * identity already exists.
         */

        const identity =
          corrosionObservationIdentityKey({
            siteFk:
              site.id,

            sourceFk:
              source.id,

            material:
              row.material,

            exposurePeriod:
              row.exposure_period,

            exposureStart:
              row.exposure_start,

            exposureEnd:
              row.exposure_end,

            corrosionMetric:
              row.corrosion_metric,

            measurementMethod:
              "",

            specimenCondition:
              "",

            exposureCondition:
              "",
          });


        const existing =
          observationsByIdentity.get(
            identity
          );


        if (existing) {
          targetObservationId =
            Number(
              existing.id
            );
        }
      }


      const canonicalThickness =
        corrosionOptionalNumber(
          row
            .canonical_thickness_loss_rate_um_year
        );


      const canonicalMass =
        corrosionOptionalNumber(
          row
            .canonical_mass_loss_rate_g_m2_year
        );


      const densityUsed =
        corrosionOptionalNumber(
          row.density_used_g_cm3
        );


      const payload = {
        site_fk:
          Number(site.id),

        source_fk:
          Number(source.id),

        site_source_fk:
          Number(link.id),

        material:
          String(
            row.material ||
            ""
          ).trim(),

        exposure_period:
          String(
            row.exposure_period ||
            ""
          ).trim(),

        exposure_start:
          String(
            row.exposure_start ||
            ""
          ).trim(),

        exposure_end:
          String(
            row.exposure_end ||
            ""
          ).trim(),

        corrosion_metric:
          String(
            row.corrosion_metric ||
            ""
          ).trim(),

        value:
          Number(
            row.reported_value
          ),

        unit:
          String(
            row.reported_unit ||
            ""
          ).trim(),

        canonical_thickness_loss_rate_um_year:
          canonicalThickness,

        canonical_mass_loss_rate_g_m2_year:
          canonicalMass,

        /*
         * Backward compatibility:
         * normalized_value mirrors canonical thickness.
         */
        normalized_value:
          canonicalThickness,

        normalized_unit:
          canonicalThickness !==
            null
            ? "µm/year"
            : "",

        density_g_cm3:
          densityUsed,

        density_basis:
          String(
            row.density_basis ||
            ""
          ).trim(),

        derived_penetration_value:
          null,

        derived_penetration_unit:
          "",

        normalization_note:
          String(
            row.normalization_note ||
            ""
          ).trim(),

        measurement_method:
          "",

        specimen_condition:
          "",

        exposure_condition:
          "",

        notes:
          String(
            row.notes ||
            ""
          ).trim(),

        updated_at:
          new Date()
            .toISOString(),
      };


      operations.push({
        excelRow:
          row.excel_row,

        site,

        source,

        link,

        targetObservationId,

        payload,
      });
    }


    /*
     * ---------------------------------------------------
     * Perform observation writes.
     * ---------------------------------------------------
     */

    let created = 0;
    let updated = 0;


    const touchedSiteIds =
      new Set();

    const linkUpdates =
      new Map();


    for (
      const operation
      of operations
    ) {
      await writeCorrosionObservation(
        env,
        {
          id:
            operation
              .targetObservationId,

          payload:
            operation.payload,
        }
      );


      if (
        operation
          .targetObservationId ===
        null
      ) {
        created +=
          1;

      } else {
        updated +=
          1;
      }


      touchedSiteIds.add(
        Number(
          operation.site.id
        )
      );


      const linkId =
        Number(
          operation.link.id
        );


      let linkUpdate =
        linkUpdates.get(
          linkId
        );


      if (!linkUpdate) {
        linkUpdate = {
          id:
            linkId,

          metals:
            String(
              operation
                .link
                .metals ||
              ""
            ),

          exposure_periods:
            String(
              operation
                .link
                .exposure_periods ||
              ""
            ),
        };
      }


      linkUpdate.metals =
        mergeBulkMetadataValues(
          linkUpdate.metals,

          operation
            .payload
            .material
        );


      linkUpdate.exposure_periods =
        mergeBulkMetadataValues(
          linkUpdate
            .exposure_periods,

          operation
            .payload
            .exposure_period
        );


      linkUpdates.set(
        linkId,
        linkUpdate
      );
    }


    /*
     * ---------------------------------------------------
     * Preserve legacy metadata propagation.
     * ---------------------------------------------------
     */

    let warning = "";


    try {
      await updateCorrosionLinkMetadata(
        env,
        linkUpdates
      );


      await mergeSelectedSiteSummaries(
        env,
        [
          ...touchedSiteIds,
        ]
      );

    } catch (error) {
      console.error(
        "Corrosion metadata propagation failed after observation import.",
        error
      );


      warning =
        error?.message ||
        "Observations were imported, but metadata summary propagation failed.";
    }


    return Response.json(
      {
        ok: true,

        imported:
          created +
          updated,

        created,

        updated,

        skipped:
          0,

        warning,
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
      "Corrosion workbook import failed.",
      error
    );


    return Response.json(
      {
        ok: false,

        error:
          error?.message ||
          "Unable to import corrosion workbook.",
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
}

async function handlePublishPreview(
  env
) {
  try {
    const result =
      await buildPublishPreview(
        env
      );

    return Response.json(
      {
        ok: true,
        ...result,
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
      "Unable to build publish preview.",
      error
    );

    return Response.json(
      {
        ok: false,

        error:
          error?.message ||
          "Unable to build website publish preview.",
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
}


async function handlePublishPackageDownload(
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
          "Invalid export request.",
      },
      {
        status: 400,
      }
    );
  }

  try {
    const result =
      await buildWebsitePackageZip(
        env,
        {
          siteIds:
            payload.site_ids,

          includeCorrosion:
            payload.include_corrosion !==
            false,

          includeEnvironment:
            payload.include_environment !==
            false,
        }
      );

    const timestamp =
      new Date()
        .toISOString()
        .replace(
          /[-:]/g,
          ""
        )
        .replace(
          /\.\d{3}Z$/,
          "Z"
        );

    return new Response(
      result.bytes,
      {
        headers: {
          "content-type":
            "application/zip",

          "content-disposition":
            `attachment; filename="corrosion-atlas-website-data-${timestamp}.zip"`,

          "cache-control":
            "no-store",

          "x-publish-sites":
            String(
              result.counts.sites
            ),

          "x-publish-sources":
            String(
              result.counts.sources
            ),

          "x-publish-corrosion":
            String(
              result.counts.corrosion
            ),

          "x-publish-environment":
            String(
              result.counts.environment
            ),
        },
      }
    );

  } catch (error) {
    console.error(
      "Website package export failed.",
      error
    );

    return Response.json(
      {
        ok: false,

        error:
          error?.message ||
          "Unable to generate website data package.",
      },
      {
        status: 400,

        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }
}

async function handlePublishGithubStatus(
  env
) {
  const status =
    getGitHubPublishStatus(
      env
    );

  return Response.json(
    {
      ok: true,
      ...status,
    },
    {
      headers: {
        "cache-control":
          "no-store",
      },
    }
  );
}


async function handlePublishGithub(
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
          "Invalid GitHub publish request.",
      },
      {
        status: 400,
      }
    );
  }


  if (
    payload.confirmed !==
    true
  ) {
    return Response.json(
      {
        ok: false,

        error:
          "Confirm that you reviewed the selected Sites before publishing.",
      },
      {
        status: 400,
      }
    );
  }


  try {
    /*
     * Re-read current database state and rebuild
     * everything server-side. Browser-generated
     * CSV content is never accepted.
     */
    const preview =
      await buildPublishPreview(
        env
      );


    if (
      preview
        .duplicate_site_ids
        ?.length
    ) {
      return Response.json(
        {
          ok: false,

          error:
            "Duplicate site_id values must be fixed before publishing: " +
            preview
              .duplicate_site_ids
              .join(", "),
        },
        {
          status: 409,
        }
      );
    }


    const packageResult =
      await buildWebsitePackage(
        env,
        {
          siteIds:
            payload.site_ids,

          includeCorrosion:
            payload
              .include_corrosion !==
            false,

          includeEnvironment:
            payload
              .include_environment !==
            false,
        }
      );


    const githubResult =
      await publishWebsiteFilesToGitHub(
        env,
        {
          files:
            packageResult.files,

          commitMessage:
            payload
              .commit_message,
        }
      );


    if (
      !githubResult.ok
    ) {
      return Response.json(
        {
          ok: false,

          partial:
            githubResult.partial,

          error:
            githubResult.partial
              ? (
                  "GitHub publishing stopped after some files had already been updated. " +
                  `Failed at ${githubResult.failed_path}. ` +
                  githubResult.error
                )
              : githubResult.error,

          github:
            githubResult,

          counts:
            packageResult.counts,
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


    return Response.json(
      {
        ok: true,

        counts:
          packageResult.counts,

        github:
          githubResult,
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
      "GitHub website publish failed.",
      error
    );


    return Response.json(
      {
        ok: false,

        error:
          error?.message ||
          "Unable to publish website datasets to GitHub.",
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
}

function settingsCleanList(
  value
) {
  const values =
    Array.isArray(value)
      ? value
      : String(
          value ?? ""
        ).split(/\r?\n/);

  return [
    ...new Set(
      values
        .map(
          (item) =>
            String(
              item ?? ""
            ).trim()
        )
        .filter(Boolean)
    ),
  ];
}


function settingsNumber(
  group,
  key,
  value
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    throw new Error(
      `${group}.${key} must be a valid number.`
    );
  }

  return number;
}


function validateRegionSettingsPayload(
  payload
) {
  const distance =
    payload
      ?.distance_to_coast ||
    {};

  const latitude =
    payload
      ?.latitude_rules ||
    {};

  const temperature =
    payload
      ?.temperature_rules ||
    {};

  const semantic =
    payload
      ?.semantic_rules ||
    {};


  const settings = {
    distance_to_coast: {
      marine_km:
        settingsNumber(
          "distance_to_coast",
          "marine_km",
          distance.marine_km
        ),

      coastal_km:
        settingsNumber(
          "distance_to_coast",
          "coastal_km",
          distance.coastal_km
        ),

      near_coastal_km:
        settingsNumber(
          "distance_to_coast",
          "near_coastal_km",
          distance.near_coastal_km
        ),
    },


    latitude_rules: {
      antarctic_latitude_max:
        settingsNumber(
          "latitude_rules",
          "antarctic_latitude_max",
          latitude
            .antarctic_latitude_max
        ),

      sub_antarctic_latitude_min:
        settingsNumber(
          "latitude_rules",
          "sub_antarctic_latitude_min",
          latitude
            .sub_antarctic_latitude_min
        ),

      sub_antarctic_latitude_max:
        settingsNumber(
          "latitude_rules",
          "sub_antarctic_latitude_max",
          latitude
            .sub_antarctic_latitude_max
        ),

      sub_arctic_latitude_min:
        settingsNumber(
          "latitude_rules",
          "sub_arctic_latitude_min",
          latitude
            .sub_arctic_latitude_min
        ),

      sub_arctic_latitude_max:
        settingsNumber(
          "latitude_rules",
          "sub_arctic_latitude_max",
          latitude
            .sub_arctic_latitude_max
        ),

      tropical_abs_latitude_max:
        settingsNumber(
          "latitude_rules",
          "tropical_abs_latitude_max",
          latitude
            .tropical_abs_latitude_max
        ),

      cold_abs_latitude_min:
        settingsNumber(
          "latitude_rules",
          "cold_abs_latitude_min",
          latitude
            .cold_abs_latitude_min
        ),

      extreme_cold_abs_latitude_min:
        settingsNumber(
          "latitude_rules",
          "extreme_cold_abs_latitude_min",
          latitude
            .extreme_cold_abs_latitude_min
        ),
    },


    temperature_rules: {
      use_temperature_when_available:
        temperature
          .use_temperature_when_available ===
        true,

      tropical_mean_temperature_min:
        settingsNumber(
          "temperature_rules",
          "tropical_mean_temperature_min",
          temperature
            .tropical_mean_temperature_min
        ),

      temperate_mean_temperature_min:
        settingsNumber(
          "temperature_rules",
          "temperate_mean_temperature_min",
          temperature
            .temperate_mean_temperature_min
        ),

      cold_mean_temperature_max:
        settingsNumber(
          "temperature_rules",
          "cold_mean_temperature_max",
          temperature
            .cold_mean_temperature_max
        ),

      extreme_cold_mean_temperature_max:
        settingsNumber(
          "temperature_rules",
          "extreme_cold_mean_temperature_max",
          temperature
            .extreme_cold_mean_temperature_max
        ),
    },


    semantic_rules: {
      island_country_hints:
        settingsCleanList(
          semantic
            .island_country_hints
        ),

      island_text_patterns:
        settingsCleanList(
          semantic
            .island_text_patterns
        ),

      urban_patterns:
        settingsCleanList(
          semantic
            .urban_patterns
        ),

      rural_patterns:
        settingsCleanList(
          semantic
            .rural_patterns
        ),

      industrial_patterns:
        settingsCleanList(
          semantic
            .industrial_patterns
        ),

      hot_arid_patterns:
        settingsCleanList(
          semantic
            .hot_arid_patterns
        ),
    },
  };


  const {
    marine_km:
      marineKm,

    coastal_km:
      coastalKm,

    near_coastal_km:
      nearCoastalKm,
  } =
    settings
      .distance_to_coast;


  if (
    marineKm < 0 ||
    coastalKm < 0 ||
    nearCoastalKm < 0
  ) {
    throw new Error(
      "Distance-to-coast thresholds cannot be negative."
    );
  }


  if (
    !(
      marineKm <=
        coastalKm &&
      coastalKm <=
        nearCoastalKm
    )
  ) {
    throw new Error(
      "Coast thresholds must satisfy Marine ≤ Coastal ≤ Near-coastal."
    );
  }


  const lat =
    settings
      .latitude_rules;


  for (
    const [
      key,
      value,
    ]
    of Object.entries(lat)
  ) {
    if (
      value < -90 ||
      value > 90
    ) {
      throw new Error(
        `${key} must be between -90 and 90 degrees.`
      );
    }
  }


  if (
    lat
      .sub_antarctic_latitude_min >
    lat
      .sub_antarctic_latitude_max
  ) {
    throw new Error(
      "Sub-Antarctic minimum latitude cannot exceed its maximum."
    );
  }


  if (
    lat
      .sub_arctic_latitude_min >
    lat
      .sub_arctic_latitude_max
  ) {
    throw new Error(
      "Sub-arctic minimum latitude cannot exceed its maximum."
    );
  }


  if (
    lat
      .cold_abs_latitude_min >
    lat
      .extreme_cold_abs_latitude_min
  ) {
    throw new Error(
      "Cold latitude threshold cannot exceed the Extreme cold threshold."
    );
  }


  const temp =
    settings
      .temperature_rules;


  if (
    !(
      temp
        .extreme_cold_mean_temperature_max <=
        temp
          .cold_mean_temperature_max &&
      temp
        .cold_mean_temperature_max <=
        temp
          .temperate_mean_temperature_min &&
      temp
        .temperate_mean_temperature_min <=
        temp
          .tropical_mean_temperature_min
    )
  ) {
    throw new Error(
      "Temperature thresholds must remain ordered from Extreme cold through Tropical."
    );
  }


  const regexGroups = [
    "island_text_patterns",
    "urban_patterns",
    "rural_patterns",
    "industrial_patterns",
    "hot_arid_patterns",
  ];


  for (
    const group
    of regexGroups
  ) {
    for (
      const pattern
      of settings
        .semantic_rules[
          group
        ]
    ) {
      try {
        new RegExp(
          pattern,
          "i"
        );
      } catch {
        throw new Error(
          `Invalid regular expression in ${group}: ${pattern}`
        );
      }
    }
  }


  return settings;
}


async function checkSettingsSupabase(
  env
) {
  if (
    !env.SUPABASE_URL ||
    !env.SUPABASE_SECRET_KEY
  ) {
    return {
      ok: false,
      detail:
        "Not configured",
    };
  }


  try {
    const endpoint =
      new URL(
        "/rest/v1/sites",
        env.SUPABASE_URL
      );

    endpoint.searchParams.set(
      "select",
      "id"
    );

    endpoint.searchParams.set(
      "limit",
      "1"
    );


    const response =
      await fetch(
        endpoint,
        {
          headers: {
            apikey:
              env.SUPABASE_SECRET_KEY,

            authorization:
              `Bearer ${env.SUPABASE_SECRET_KEY}`,

            accept:
              "application/json",
          },
        }
      );


    return {
      ok:
        response.ok,

      detail:
        response.ok
          ? "Connected"
          : `HTTP ${response.status}`,
    };

  } catch {
    return {
      ok: false,
      detail:
        "Unavailable",
    };
  }
}


async function checkSettingsPostgis(
  env
) {
  if (
    !env.SUPABASE_URL ||
    !env.SUPABASE_SECRET_KEY
  ) {
    return {
      ok: false,
      detail:
        "Supabase unavailable",
    };
  }


  try {
    const endpoint =
      new URL(
        "/rest/v1/rpc/region_spatial_context",
        env.SUPABASE_URL
      );


    const response =
      await fetch(
        endpoint,
        {
          method:
            "POST",

          headers: {
            apikey:
              env.SUPABASE_SECRET_KEY,

            authorization:
              `Bearer ${env.SUPABASE_SECRET_KEY}`,

            "content-type":
              "application/json",

            accept:
              "application/json",
          },

          body:
            JSON.stringify({
              p_latitude:
                0,

              p_longitude:
                0,
            }),
        }
      );


    return {
      ok:
        response.ok,

      detail:
        response.ok
          ? "Spatial RPC available"
          : `HTTP ${response.status}`,
    };

  } catch {
    return {
      ok: false,
      detail:
        "Unavailable",
    };
  }
}


async function checkSettingsR2(
  env
) {
  if (
    !env.SOURCE_PDFS
  ) {
    return {
      ok: false,
      configured:
        false,

      detail:
        "R2 binding missing",

      object_count:
        0,

      total_bytes:
        0,
    };
  }


  try {
    let cursor =
      undefined;

    let objectCount =
      0;

    let totalBytes =
      0;


    while (true) {
      const result =
        await env
          .SOURCE_PDFS
          .list({
            prefix:
              "source_pdfs/",

            limit:
              1000,

            cursor,
          });


      for (
        const object
        of result.objects ||
        []
      ) {
        objectCount +=
          1;

        totalBytes +=
          Number(
            object.size ||
            0
          );
      }


      if (
        !result.truncated
      ) {
        break;
      }


      cursor =
        result.cursor;


      if (!cursor) {
        break;
      }
    }


    return {
      ok: true,

      configured:
        true,

      detail:
        "Private R2 available",

      object_count:
        objectCount,

      total_bytes:
        totalBytes,
    };

  } catch (error) {
    console.error(
      "R2 settings status failed.",
      error
    );


    return {
      ok: false,

      configured:
        true,

      detail:
        "R2 status unavailable",

      object_count:
        0,

      total_bytes:
        0,
    };
  }
}


async function handleSettingsGet(
  env
) {
  const [
    regionSettings,
    supabase,
    postgis,
    r2,
  ] =
    await Promise.all([
      loadRegionClassificationSettings(
        env
      ),

      checkSettingsSupabase(
        env
      ),

      checkSettingsPostgis(
        env
      ),

      checkSettingsR2(
        env
      ),
    ]);


  const github =
    getGitHubPublishStatus(
      env
    );


  return Response.json(
    {
      ok: true,

      region_settings:
        regionSettings,

      region_defaults:
        mergeRegionClassificationSettings(
          null
        ),

      system: {
        supabase,

        postgis,

        r2,

        github: {
          ok:
            github.configured,

          configured:
            github.configured,

          detail:
            github.configured
              ? `${github.owner}/${github.repo} · ${github.branch}`
              : "Not configured",
        },

        build: {
          ok: true,

          detail:
            CURATOR_BUILD_ID,
        },
      },
    },
    {
      headers: {
        "cache-control":
          "no-store",
      },
    }
  );
}


async function handleSettingsRegionSave(
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
          "Invalid settings request.",
      },
      {
        status: 400,
      }
    );
  }


  try {
    const settings =
      validateRegionSettingsPayload(
        payload.settings
      );


    await saveAppSetting(
      env,
      REGION_CLASSIFICATION_SETTINGS_KEY,
      settings
    );


    return Response.json(
      {
        ok: true,

        settings,
      },
      {
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );

  } catch (error) {
    return Response.json(
      {
        ok: false,

        error:
          error?.message ||
          "Unable to save region classification settings.",
      },
      {
        status: 400,

        headers: {
          "cache-control":
            "no-store",
        },
      }
    );
  }
}


async function handleSettingsRegionReset(
  env
) {
  try {
    const settings =
      mergeRegionClassificationSettings(
        null
      );


    await saveAppSetting(
      env,
      REGION_CLASSIFICATION_SETTINGS_KEY,
      settings
    );


    return Response.json(
      {
        ok: true,

        settings,
      },
      {
        headers: {
          "cache-control":
            "no-store",
        },
      }
    );

  } catch (error) {
    return Response.json(
      {
        ok: false,

        error:
          error?.message ||
          "Unable to reset region classification settings.",
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

    if (
      path === "/api/linking-options" &&
      request.method === "GET"
    ) {
      return handleLinkingOptions(
        env
      );
    }

    if (
      path === "/api/site-source-links/bulk" &&
      request.method === "POST"
    ) {
      return handleBulkSiteSourceLinks(
        request,
        env
      );
    }

    if (
      path === "/api/manage-records" &&
      request.method === "GET"
    ) {
      return handleManageRecords(
        request,
        env
      );
    }

    if (
      path === "/api/manage-delete-preview" &&
      request.method === "POST"
    ) {
      return handleManageDeletePreview(
        request,
        env
      );
    }

    if (
      path === "/api/corrosion-observations" &&
      request.method === "GET"
    ) {
      return handleCorrosionObservations(
        request,
        env
      );
    }


    if (
      path === "/api/corrosion-workbook-sources" &&
      request.method === "GET"
    ) {
      return handleCorrosionWorkbookSources(
        env
      );
    }

    if (
      path ===
        "/api/corrosion-workbook" &&
      request.method === "GET"
    ) {
      return handleCorrosionWorkbookGenerate(
        request,
        env
      );
    }

    if (
      path ===
        "/api/corrosion-workbook-preview" &&
      request.method === "POST"
    ) {
      return handleCorrosionWorkbookPreview(
        request,
        env
      );
    }

    if (
      path ===
        "/api/corrosion-workbook-import" &&
      request.method === "POST"
    ) {
      return handleCorrosionWorkbookImport(
        request,
        env
      );
    }

    if (
      path === "/api/manage-bulk-update" &&
      request.method === "POST"
    ) {
      return handleManageBulkUpdate(
        request,
        env
      );
    }


    if (
      path === "/api/manage-region-apply" &&
      request.method === "POST"
    ) {
      return handleManageRegionApply(
        request,
        env
      );
    }


    if (
      path === "/api/manage-records" &&
      request.method === "DELETE"
    ) {
      return handleManageRecordsDelete(
        request,
        env
      );
    }

    if (
      path ===
        "/api/publish-preview" &&
      request.method === "GET"
    ) {
      return handlePublishPreview(
        env
      );
    }


    if (
      path ===
        "/api/publish-package" &&
      request.method === "POST"
    ) {
      return handlePublishPackageDownload(
        request,
        env
      );
    }

    if (
      path ===
        "/api/publish-github-status" &&
      request.method === "GET"
    ) {
      return handlePublishGithubStatus(
        env
      );
    }


    if (
      path ===
        "/api/publish-github" &&
      request.method === "POST"
    ) {
      return handlePublishGithub(
        request,
        env
      );
    }

    if (
      path === "/api/settings" &&
      request.method === "GET"
    ) {
      return handleSettingsGet(
        env
      );
    }


    if (
      path === "/api/settings/region" &&
      request.method === "PUT"
    ) {
      return handleSettingsRegionSave(
        request,
        env
      );
    }


    if (
      path === "/api/settings/region/reset" &&
      request.method === "POST"
    ) {
      return handleSettingsRegionReset(
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

    if (
      path === "/api/region-classification" &&
      request.method === "POST"
    ) {
      return handleRegionClassification(
        request,
        env
      );
    }

    const sourcePdfMatch =
      path.match(
        /^\/api\/sources\/(\d+)\/pdf$/
      );


    if (
      sourcePdfMatch &&
      request.method === "GET"
    ) {
      return handleSourcePdfGet(
        request,
        env,
        sourcePdfMatch[1]
      );
    }


    if (
      sourcePdfMatch &&
      request.method === "POST"
    ) {
      return handleSourcePdfUpload(
        request,
        env,
        sourcePdfMatch[1]
      );
    }


    if (
      sourcePdfMatch &&
      request.method === "DELETE"
    ) {
      return handleSourcePdfDelete(
        env,
        sourcePdfMatch[1]
      );
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

    if (path === "/links") {
      if (
        url.pathname === "/links"
      ) {
        return Response.redirect(
          new URL(
            "/links/",
            url
          ).toString(),
          302
        );
      }

      return env.ASSETS.fetch(
        request
      );
    }

    if (path === "/manage") {
      if (
        url.pathname === "/manage"
      ) {
        return Response.redirect(
          new URL(
            "/manage/",
            url
          ).toString(),
          302
        );
      }

      return env.ASSETS.fetch(
        request
      );
    }

    if (
      path === "/corrosion"
    ) {
      if (
        url.pathname === "/corrosion"
      ) {
        return Response.redirect(
          new URL(
            "/corrosion/",
            url
          ).toString(),
          302
        );
      }


      return env.ASSETS.fetch(
        request
      );
    }
    
    return env.ASSETS.fetch(request);
  }
}
