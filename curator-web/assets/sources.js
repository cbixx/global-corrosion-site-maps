let allSources = [];

const searchInput = document.getElementById("source-search");
const sourceList = document.getElementById("source-list");
const statusElement = document.getElementById("status");
const sourceCount = document.getElementById("source-count");
const pdfDownloadOptions =
  document.getElementById(
    "pdf-download-options"
  );

const pdfDownloadCount =
  document.getElementById(
    "pdf-download-count"
  );

const pdfSelectAll =
  document.getElementById(
    "pdf-select-all"
  );

const pdfClearAll =
  document.getElementById(
    "pdf-clear-all"
  );

const pdfDownloadSelected =
  document.getElementById(
    "pdf-download-selected"
  );

const pdfDownloadAll =
  document.getElementById(
    "pdf-download-all"
  );

const selectedPdfIds =
  new Set();

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
    const item = document.createElement("a");
    item.className = "source-item";
    item.href = `/sources/detail/?id=${encodeURIComponent(source.id)}`;

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

function updatePdfSelection() {
  const pdfSources =
    allSources.filter(
      (source) =>
        String(
          source.private_pdf_object_key ||
          ""
        ).trim()
    );

  pdfDownloadCount.textContent =
    `${selectedPdfIds.size} selected · ` +
    `${pdfSources.length} PDF${pdfSources.length === 1 ? "" : "s"} available`;

  pdfDownloadSelected.disabled =
    selectedPdfIds.size === 0;

  pdfDownloadAll.disabled =
    pdfSources.length === 0;
}


function renderPdfDownloadOptions() {
  pdfDownloadOptions.replaceChildren();

  const pdfSources =
    allSources.filter(
      (source) =>
        String(
          source.private_pdf_object_key ||
          ""
        ).trim()
    );

  if (pdfSources.length === 0) {
    pdfDownloadOptions.textContent =
      "No Source PDFs are currently stored.";

    updatePdfSelection();
    return;
  }

  for (const source of pdfSources) {
    const label =
      document.createElement(
        "label"
      );

    label.className =
      "source-pdf-download-option";

    const checkbox =
      document.createElement(
        "input"
      );

    checkbox.type =
      "checkbox";

    checkbox.checked =
      selectedPdfIds.has(
        Number(source.id)
      );

    checkbox.addEventListener(
      "change",
      () => {
        const id =
          Number(source.id);

        if (checkbox.checked) {
          selectedPdfIds.add(id);
        } else {
          selectedPdfIds.delete(id);
        }

        updatePdfSelection();
      }
    );

    const text =
      document.createElement(
        "span"
      );

    text.textContent =
      `${String(
        source.source_code || ""
      ).toUpperCase()} — ` +
      `${source.source_title || "(Untitled source)"}`;

    label.append(
      checkbox,
      text
    );

    pdfDownloadOptions.append(
      label
    );
  }

  updatePdfSelection();
}


function downloadPdfArchive(ids = null) {
  let url =
    "/api/source-pdfs.zip";

  if (
    Array.isArray(ids) &&
    ids.length > 0
  ) {
    url +=
      `?ids=${encodeURIComponent(
        ids.join(",")
      )}`;
  }

  window.location.href =
    url;
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
    renderPdfDownloadOptions();
  } catch (error) {
    console.error("Unable to load sources.", error);

    statusElement.textContent =
      "Unable to load sources from the database.";

    statusElement.hidden = false;
    sourceList.hidden = true;
  }
}

pdfSelectAll.addEventListener(
  "click",
  () => {
    selectedPdfIds.clear();

    for (
      const source
      of allSources
    ) {
      if (
        String(
          source.private_pdf_object_key ||
          ""
        ).trim()
      ) {
        selectedPdfIds.add(
          Number(source.id)
        );
      }
    }

    renderPdfDownloadOptions();
  }
);


pdfClearAll.addEventListener(
  "click",
  () => {
    selectedPdfIds.clear();

    renderPdfDownloadOptions();
  }
);


pdfDownloadSelected.addEventListener(
  "click",
  () => {
    downloadPdfArchive(
      [...selectedPdfIds]
    );
  }
);


pdfDownloadAll.addEventListener(
  "click",
  () => {
    downloadPdfArchive();
  }
);

searchInput.addEventListener("input", applySearch);

loadSources();