const statusElement = document.getElementById("status");
const detailElement = document.getElementById("site-detail");
const codeElement = document.getElementById("site-code");
const titleElement = document.getElementById("site-title");
const fieldsElement = document.getElementById("site-fields");

const editButton = document.getElementById("edit-button");
const cancelButton = document.getElementById("cancel-button");
const saveButton = document.getElementById("save-button");
const saveMessage = document.getElementById("save-message");

let currentSite = null;
let editing = false;

const FIELD_LABELS = {
  site_id: "Site ID",
  site_label: "Site label",
  site_type: "Site type",
  latitude: "Latitude",
  longitude: "Longitude",
  modern_country_location: "Modern country location",
  administering_country: "Administering country",
  former_entity: "Former entity",
  region_category: "Region category",
  exposure_period: "Exposure period",
  metal: "Metal",
  notes: "Notes",
};

function getSiteId() {
  return new URLSearchParams(window.location.search).get("id");
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
    const input = document.createElement(
      fieldName === "notes" ? "textarea" : "input"
    );

    input.id = `field-${fieldName}`;
    input.dataset.field = fieldName;
    input.className = "detail-input";

    if (fieldName === "latitude" || fieldName === "longitude") {
      input.type = "number";
      input.step = "any";
    }

    if (fieldName === "notes") {
      input.rows = 4;
    }

    input.value =
      value === null || value === undefined
        ? ""
        : String(value);

    labelElement.htmlFor = input.id;
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

function renderSite() {
  if (!currentSite) {
    return;
  }

  codeElement.textContent = currentSite.site_id || "";
  titleElement.textContent =
    currentSite.site_label || "(Unnamed site)";

  fieldsElement.replaceChildren();

  for (const [fieldName, label] of Object.entries(FIELD_LABELS)) {
    addField(fieldName, label, currentSite[fieldName]);
  }

  editButton.hidden = editing;
  cancelButton.hidden = !editing;
  saveButton.hidden = !editing;
}

async function loadSite() {
  const siteId = getSiteId();

  if (!siteId) {
    statusElement.textContent = "Missing site ID.";
    return;
  }

  try {
    const response = await fetch(
      `/api/sites/${encodeURIComponent(siteId)}`,
      {
        headers: { accept: "application/json" },
      }
    );

    const payload = await response.json();

    if (!response.ok || !payload.ok || !payload.site) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    currentSite = payload.site;

    renderSite();

    document.title =
      `${currentSite.site_id || "Site"} · Corrosion Atlas Curator`;

    statusElement.hidden = true;
    detailElement.hidden = false;
  } catch (error) {
    console.error("Unable to load site.", error);

    statusElement.textContent =
      "Unable to load this site record.";
  }
}

editButton.addEventListener("click", () => {
  editing = true;
  saveMessage.hidden = true;
  renderSite();
});

cancelButton.addEventListener("click", () => {
  editing = false;
  saveMessage.hidden = true;
  renderSite();
});

saveButton.addEventListener("click", async () => {
  const updates = {};

  for (const input of fieldsElement.querySelectorAll("[data-field]")) {
    updates[input.dataset.field] = input.value;
  }

  saveButton.disabled = true;
  cancelButton.disabled = true;
  saveButton.textContent = "Saving…";
  saveMessage.hidden = true;

  try {
    const response = await fetch(
      `/api/sites/${encodeURIComponent(currentSite.id)}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(updates),
      }
    );

    const payload = await response.json();

    if (!response.ok || !payload.ok || !payload.site) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    currentSite = payload.site;
    editing = false;

    renderSite();

    saveMessage.textContent = "Saved.";
    saveMessage.className =
      "save-message save-message-success";
    saveMessage.hidden = false;
  } catch (error) {
    console.error("Unable to save site.", error);

    saveMessage.textContent =
      error.message || "Unable to save site.";

    saveMessage.className =
      "save-message save-message-error";
    saveMessage.hidden = false;
  } finally {
    saveButton.disabled = false;
    cancelButton.disabled = false;
    saveButton.textContent = "Save";
  }
});

loadSite();