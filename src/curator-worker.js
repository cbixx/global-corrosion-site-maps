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

    return env.ASSETS.fetch(request);
  }
}
