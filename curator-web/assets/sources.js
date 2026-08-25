let allSources = [];

const searchInput = document.getElementById("source-search");
const sourceList = document.getElementById("source-list");
const statusElement = document.getElementById("status");
const sourceCount = document.getElementById("source-count");

function normalise(value) {
  return String(value || "").trim().toLowerCase();
}

function sourceMatches(source, query) {
  if (!query) {
    return true;
  }

  const searchableText = [
    source.source_code,
    source.source_title,
    source.authors_or_organization,
    source.publication_year,
    source.source_kind,
    source.source_type,
  ]
    .map(normalise)
    .join(" ");

  return searchableText.includes(query);
}

function formatSourceType(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .trim();
}

function renderSources(sources) {
  sourceList.replaceChildren();

  sourceCount.textContent =
    `${sources.length} source${sources.length === 1 ? "" : "s"}`;

  if (sources.length === 0) {
    statusElement.textContent = "No sources match your search.";
    statusElement.hidden = false;
    sourceList.hidden = true;
    return;
  }

  for (const source of sources) {
    const item = document.createElement("article");
    item.className = "source-item";

    const code = document.createElement("div");
    code.className = "source-code";
    code.textContent = String(source.source_code || "").toUpperCase();

    const content = document.createElement("div");
    content.className = "source-content";

    const title = document.createElement("div");
    title.className = "source-title";
    title.textContent =
      source.source_title || "(Untitled source)";

    const authors = document.createElement("div");
    authors.className = "source-authors";
    authors.textContent =
      source.authors_or_organization || "No author information";

    const metadata = document.createElement("div");
    metadata.className = "source-metadata";

    const metadataParts = [
      source.publication_year,
      formatSourceType(source.source_type),
    ].filter(Boolean);

    metadata.textContent = metadataParts.join(" · ");

    content.append(title, authors, metadata);
    item.append(code, content);

    sourceList.append(item);
  }

  statusElement.hidden = true;
  sourceList.hidden = false;
}

function applySearch() {
  const query = normalise(searchInput.value);

  const filtered = allSources.filter((source) =>
    sourceMatches(source, query)
  );

  renderSources(filtered);
}

async function loadSources() {
  try {
    const response = await fetch("/api/sources", {
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();

    if (!payload.ok || !Array.isArray(payload.sources)) {
      throw new Error("Unexpected API response.");
    }

    allSources = payload.sources;

    renderSources(allSources);
  } catch (error) {
    console.error("Unable to load sources.", error);

    statusElement.textContent =
      "Unable to load sources from the database.";

    statusElement.hidden = false;
    sourceList.hidden = true;
  }
}

searchInput.addEventListener("input", applySearch);

loadSources();