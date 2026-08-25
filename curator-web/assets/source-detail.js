const statusElement = document.getElementById("status");
const detailElement = document.getElementById("source-detail");
const codeElement = document.getElementById("source-code");
const titleElement = document.getElementById("source-title");
const fieldsElement = document.getElementById("source-fields");

const FIELD_LABELS = {
  source_kind: "Source kind",
  source_type: "Source type",
  authors_or_organization: "Authors / organization",
  publication_year: "Publication year",
  doi: "DOI",
  public_url: "Public URL",
  display_citation: "Display citation",
  public_notes: "Public notes",
  programme: "Programme",
  metals: "Metals",
  exposure_periods: "Exposure periods",
  local_file_name: "Local file name",
  source_url: "Source URL",
  private_pdf_object_key: "Private PDF object key",
  notes: "Internal notes",
};

function getSourceId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function addField(label, value) {
  const row = document.createElement("div");
  row.className = "detail-field";

  const labelElement = document.createElement("div");
  labelElement.className = "detail-label";
  labelElement.textContent = label;

  const valueElement = document.createElement("div");
  valueElement.className = "detail-value";

  if (value === null || value === undefined || String(value).trim() === "") {
    valueElement.textContent = "—";
    valueElement.classList.add("detail-empty");
  } else {
    valueElement.textContent = String(value);
  }

  row.append(labelElement, valueElement);
  fieldsElement.append(row);
}

async function loadSource() {
  const sourceId = getSourceId();

  if (!sourceId) {
    statusElement.textContent = "Missing source ID.";
    return;
  }

  try {
    const response = await fetch(
      `/api/sources/${encodeURIComponent(sourceId)}`,
      {
        headers: {
          accept: "application/json",
        },
      }
    );

    const payload = await response.json();

    if (!response.ok || !payload.ok || !payload.source) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    const source = payload.source;

    codeElement.textContent =
      String(source.source_code || "").toUpperCase();

    titleElement.textContent =
      source.source_title || "(Untitled source)";

    fieldsElement.replaceChildren();

    for (const [fieldName, label] of Object.entries(FIELD_LABELS)) {
      addField(label, source[fieldName]);
    }

    document.title =
      `${String(source.source_code || "").toUpperCase()} · Corrosion Atlas Curator`;

    statusElement.hidden = true;
    detailElement.hidden = false;
  } catch (error) {
    console.error("Unable to load source.", error);

    statusElement.textContent =
      "Unable to load this source record.";
  }
}

loadSource();