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

  if (
    Object.hasOwn(updates, "source_code") &&
    !/^s\d{3}$/i.test(updates.source_code)
  ) {
    return Response.json(
      {
        ok: false,
        error: "Source code must have the form S001.",
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

async function handleSourceCreate(request, env) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400, headers: { "cache-control": "no-store" } }
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

  source.source_code = source.source_code.toLowerCase();

  if (!/^s\d{3}$/i.test(source.source_code)) {
    return Response.json(
      {
        ok: false,
        error: "Source code must have the form S001.",
      },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const endpoint = new URL("/rest/v1/sources", env.SUPABASE_URL);

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

    console.error("Unable to create source.", {
      status: response.status,
      detail,
    });

    const message =
      response.status === 409
        ? "That source code already exists."
        : "Unable to create source.";

    return Response.json(
      { ok: false, error: message },
      { status: response.status === 409 ? 409 : 502 }
    );
  }

  const rows = await response.json();

  return Response.json(
    {
      ok: true,
      source: rows[0] || null,
    },
    {
      status: 201,
      headers: { "cache-control": "no-store" },
    }
  );
}

async function handleSiteCreate(request, env) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  const site = {};

  for (const field of EDITABLE_SITE_FIELDS) {
    const value = payload?.[field];

    if (field === "latitude" || field === "longitude") {
      const number = Number(value);

      if (!Number.isFinite(number)) {
        return Response.json(
          {
            ok: false,
            error: `${field} must be a valid number.`,
          },
          { status: 400, headers: { "cache-control": "no-store" } }
        );
      }

      site[field] = number;
    } else {
      site[field] =
        value === null || value === undefined
          ? ""
          : String(value).trim();
    }
  }

  if (!site.site_id) {
    return Response.json(
      { ok: false, error: "Site ID is required." },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  if (!site.site_label) {
    return Response.json(
      { ok: false, error: "Site label is required." },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  if (site.latitude < -90 || site.latitude > 90) {
    return Response.json(
      { ok: false, error: "Latitude must be between -90 and 90." },
      { status: 400 }
    );
  }

  if (site.longitude < -180 || site.longitude > 180) {
    return Response.json(
      { ok: false, error: "Longitude must be between -180 and 180." },
      { status: 400 }
    );
  }

  const endpoint = new URL("/rest/v1/sites", env.SUPABASE_URL);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      "content-type": "application/json",
      accept: "application/json",
      prefer: "return=representation",
    },
    body: JSON.stringify(site),
  });

  if (!response.ok) {
    const detail = await response.text();

    console.error("Unable to create site.", {
      status: response.status,
      detail,
    });

    const message =
      response.status === 409
        ? "That site ID already exists."
        : "Unable to create site.";

    return Response.json(
      { ok: false, error: message },
      { status: response.status === 409 ? 409 : 502 }
    );
  }

  const rows = await response.json();

  return Response.json(
    {
      ok: true,
      site: rows[0] || null,
    },
    {
      status: 201,
      headers: { "cache-control": "no-store" },
    }
  );
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

    if (path === "/api/sources" && request.method === "GET") {
      return handleSourcesList(env);
    }

    if (path === "/api/sources" && request.method === "POST") {
      return handleSourceCreate(request, env);
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
      return Response.redirect(new URL("/sources/", url).toString(), 302);
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
