const statusElement = document.getElementById("status");
const detailElement = document.getElementById("source-detail");
const codeElement = document.getElementById("source-code");
const titleElement = document.getElementById("source-title");
const fieldsElement = document.getElementById("source-fields");
const editButton = document.getElementById("edit-button");
const cancelButton = document.getElementById("cancel-button");
const saveButton = document.getElementById("save-button");
const saveMessage = document.getElementById("save-message");

let currentSource = null;
let editing = false;

const FIELD_LABELS = {
  source_code: "Source code",
  source_title: "Source title",
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

function isNewSource() {
  const params = new URLSearchParams(window.location.search);
  return params.get("new") === "1";
}

function getSourceId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function addField(fieldName, label, value) {
  const row = document.createElement("div");
  row.className = "detail-field";

  const labelElement = document.createElement("label");
  labelElement.className = "detail-label";
  labelElement.textContent = label;

  const valueElement = document.createElement("div");
  valueElement.className = "detail-value";

  if (editing) {
    const longFields = new Set([
      "display_citation",
      "public_notes",
      "notes",
    ]);

    const input = document.createElement(
      longFields.has(fieldName) ? "textarea" : "input"
    );

    input.className = "detail-input";
    input.dataset.field = fieldName;
    input.value =
      value === null || value === undefined
        ? ""
        : String(value);

    if (input.tagName === "TEXTAREA") {
      input.rows = 4;
    }

    labelElement.htmlFor = `field-${fieldName}`;
    input.id = `field-${fieldName}`;

    valueElement.append(input);
  } else if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    valueElement.textContent = "—";
    valueElement.classList.add("detail-empty");
  } else {
    valueElement.textContent = String(value);
  }

  row.append(labelElement, valueElement);
  fieldsElement.append(row);
}

function renderSource() {
  if (!currentSource) {
    return;
  }

  codeElement.textContent =
    String(currentSource.source_code || "").toUpperCase();

  titleElement.textContent =
    currentSource.source_title || "(Untitled source)";

  fieldsElement.replaceChildren();

  for (const [fieldName, label] of Object.entries(FIELD_LABELS)) {
    addField(fieldName, label, currentSource[fieldName]);
  }

  editButton.hidden = editing;
  cancelButton.hidden = !editing;
  saveButton.hidden = !editing;
}

async function loadSource() {

  if (isNewSource()) {
    currentSource = {
      id: null,
      source_code: "",
      source_title: "",
      source_kind: "",
      source_type: "",
      authors_or_organization: "",
      publication_year: "",
      doi: "",
      public_url: "",
      display_citation: "",
      public_notes: "",
      programme: "",
      metals: "",
      exposure_periods: "",
      local_file_name: "",
      source_url: "",
      private_pdf_object_key: "",
      notes: "",
    };

    editing = true;

    renderSource();

    document.title = "New Source · Corrosion Atlas Curator";

    statusElement.hidden = true;
    detailElement.hidden = false;

    return;
  }
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

    currentSource = payload.source;
    renderSource();

    document.title =
    `${String(currentSource.source_code || "").toUpperCase()} · Corrosion Atlas Curator`;

    statusElement.hidden = true;
    detailElement.hidden = false;
  } catch (error) {
    console.error("Unable to load source.", error);

    statusElement.textContent =
      "Unable to load this source record.";
  }
}

editButton.addEventListener("click", () => {
  editing = true;

  saveMessage.hidden = true;

  renderSource();
});

cancelButton.addEventListener("click", () => {
  if (isNewSource()) {
    window.location.href = "/sources/";
    return;
  }

  editing = false;
  saveMessage.hidden = true;
  renderSource();
});

saveButton.addEventListener("click", async () => {
  if (!currentSource) {
    return;
  }

  const updates = {};

  for (const input of fieldsElement.querySelectorAll("[data-field]")) {
    updates[input.dataset.field] = input.value;
  }

  saveButton.disabled = true;
  cancelButton.disabled = true;

  saveButton.textContent = "Saving…";

  saveMessage.hidden = true;

  try {
    const creating = !currentSource.id;

    const endpoint = creating
      ? "/api/sources"
      : `/api/sources/${encodeURIComponent(currentSource.id)}`;

    const response = await fetch(
      endpoint,
      {
        method: creating ? "POST" : "PATCH",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(updates),
      }
    );

    const payload = await response.json();

    if (!response.ok || !payload.ok || !payload.source) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    currentSource = payload.source;
    editing = false;

    if (creating) {
      window.history.replaceState(
        {},
        "",
        `/sources/detail/?id=${encodeURIComponent(currentSource.id)}`
      );
    }

    renderSource();

    saveMessage.textContent = "Saved.";
    saveMessage.className = "save-message save-message-success";
    saveMessage.hidden = false;

    document.title =
      `${String(currentSource.source_code || "").toUpperCase()} · Corrosion Atlas Curator`;
  } catch (error) {
    console.error("Unable to save source.", error);

    saveMessage.textContent =
      error.message || "Unable to save source.";

    saveMessage.className = "save-message save-message-error";
    saveMessage.hidden = false;
  } finally {
    saveButton.disabled = false;
    cancelButton.disabled = false;
    saveButton.textContent = "Save";
  }
});

loadSource();