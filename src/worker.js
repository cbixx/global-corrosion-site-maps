const WORKER_BUILD_ID = "team-injection-debug-001";
const SOURCE_CODE_PATTERN = /^s\d{3}$/i;

function normaliseSourceCode(value) {
  const text = String(value || "").trim().toLowerCase();
  const match = text.match(/s?0*(\d{1,4})/);

  if (!match) {
    return "";
  }

  const number = Number(match[1]);

  if (!Number.isFinite(number)) {
    return "";
  }

  const sourceCode = `s${String(number).padStart(3, "0")}`;

  return SOURCE_CODE_PATTERN.test(sourceCode) ? sourceCode : "";
}

function textResponse(message, status = 200) {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function safeSameOriginRedirectPath(value) {
  const fallback = "/api/team/map";
  const text = String(value || "").trim();

  if (!text) {
    return fallback;
  }

  // Only allow same-origin relative paths. Block protocol-relative URLs like //evil.com.
  if (!text.startsWith("/") || text.startsWith("//")) {
    return fallback;
  }

  return text;
}

function handleTeamLogin(request) {
  const url = new URL(request.url);
  const nextPath = safeSameOriginRedirectPath(
    url.searchParams.get("next") || "/api/team/map"
  );

  return Response.redirect(new URL(nextPath, url).toString(), 302);
}

async function serveIndex(request, env, audience = "public") {
  const url = new URL(request.url);
  const indexUrl = new URL("/map/index.html", url);

  const response = await env.ASSETS.fetch(new Request(indexUrl, request));

  if (!response.ok) {
    return response;
  }

  let html = await response.text();

  const injectedHead = `
    <!-- corrosion-map-audience-injection:${WORKER_BUILD_ID}:${audience} -->
    <base href="/">
    <script>
      window.CORROSION_MAP_AUDIENCE = ${JSON.stringify(audience)};
      window.CORROSION_MAP_WORKER_BUILD_ID = ${JSON.stringify(WORKER_BUILD_ID)};
    </script>
    `;

  if (html.includes("</head>")) {
    html = html.replace("</head>", `${injectedHead}\n</head>`);
  } else {
    html = `${injectedHead}\n${html}`;
  }

  const headers = new Headers(response.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleTeamSourcePdf(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return textResponse("Method not allowed.", 405);
  }

  /*
    Safety gate:
    Keep this false until Cloudflare Access is configured for:
    /team
    /team/*
    /api/team/*
  */
  if (env.ENABLE_TEAM_PDF_API !== "true") {
    return textResponse("Team PDF API is not enabled yet.", 403);
  }

  if (!env.SOURCE_PDF_BUCKET) {
    return textResponse("R2 bucket binding is not configured.", 500);
  }

  const url = new URL(request.url);
  const sourceCode = normaliseSourceCode(url.searchParams.get("source_code"));

  if (!sourceCode) {
    return textResponse("Invalid or missing source_code.", 400);
  }

  const objectKey = `source_pdfs/${sourceCode}.pdf`;
  const object = await env.SOURCE_PDF_BUCKET.get(objectKey);

  if (!object) {
    return textResponse(`Private PDF not found for ${sourceCode}.`, 404);
  }

  const headers = new Headers();

  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("content-type", "application/pdf");
  headers.set("cache-control", "private, no-store");
  headers.set("content-disposition", `inline; filename="${sourceCode}.pdf"`);

  if (request.method === "HEAD") {
    return new Response(null, { headers });
  }

  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/api/team/login") {
      return handleTeamLogin(request);
    }

    if (path === "/api/team/debug") {
      return Response.json({
        ok: true,
        message: "Worker route is active.",
        buildId: WORKER_BUILD_ID,
        path,
        teamPdfApiEnabled: env.ENABLE_TEAM_PDF_API === "true",
        hasR2Binding: Boolean(env.SOURCE_PDF_BUCKET),
      }, {
        headers: {
          "cache-control": "no-store",
        },
      });
    }

    if (path === "/api/team/map") {
      return serveIndex(request, env, "team");
    }

    if (path === "/team") {
      return serveIndex(request, env, "team");
    }

    if (path === "/api/team/source-pdf") {
      return handleTeamSourcePdf(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};