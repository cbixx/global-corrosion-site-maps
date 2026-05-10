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

async function serveIndex(request, env) {
  const url = new URL(request.url);
  const indexUrl = new URL("/index.html", url);

  return env.ASSETS.fetch(new Request(indexUrl, request));
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

    if (path === "/team") {
      return serveIndex(request, env);
    }

    if (path === "/api/team/source-pdf") {
      return handleTeamSourcePdf(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};