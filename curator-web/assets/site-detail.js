const statusElement = document.getElementById("status");
const detailElement = document.getElementById("site-detail");
const codeElement = document.getElementById("site-code");
const titleElement = document.getElementById("site-title");
const fieldsElement = document.getElementById("site-fields");

const editButton = document.getElementById("edit-button");
const cancelButton = document.getElementById("cancel-button");
const saveButton = document.getElementById("save-button");
const saveMessage = document.getElementById("save-message");

const addSourceLinkButton = document.getElementById("add-source-link-button");
const linkForm = document.getElementById("link-form");
const linkSource = document.getElementById("link-source");
const linkOrder = document.getElementById("link-order");
const linkMetals = document.getElementById("link-metals");
const linkExposurePeriods = document.getElementById("link-exposure-periods");
const linkNotes = document.getElementById("link-notes");
const cancelLinkButton = document.getElementById("cancel-link-button");
const saveLinkButton = document.getElementById("save-link-button");
const linkMessage = document.getElementById("link-message");
const linkedSourcesStatus = document.getElementById("linked-sources-status");
const linkedSourcesElement = document.getElementById("linked-sources");

let sourceOptions = [];
let currentLinks = [];
let editingLink = null;

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

    await Promise.all([
      loadSourceOptions(),
      loadLinkedSources(),
    ]);
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

async function loadSourceOptions() {
  const response = await fetch("/api/sources", {
    headers: { accept: "application/json" },
  });

  const payload = await response.json();

  if (!response.ok || !payload.ok || !Array.isArray(payload.sources)) {
    throw new Error(
      payload.error || "Unable to load source options."
    );
  }

  sourceOptions = payload.sources;

  linkSource.replaceChildren();

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "Select a source…";

  linkSource.append(emptyOption);

  for (const source of sourceOptions) {
    const option = document.createElement("option");

    option.value = source.id;

    option.textContent =
      `${String(source.source_code || "").toUpperCase()} — ` +
      `${source.source_title || "(Untitled source)"}`;

    linkSource.append(option);
  }
}

function renderLinkedSources() {
  linkedSourcesElement.replaceChildren();

  if (currentLinks.length === 0) {
    linkedSourcesStatus.textContent =
      "No sources are linked to this site.";

    linkedSourcesStatus.hidden = false;
    linkedSourcesElement.hidden = true;

    return;
  }

  for (const link of currentLinks) {
    const row = document.createElement("div");
    row.className = "linked-source";

    const main = document.createElement("div");
    main.className = "linked-source-main";

    const title = document.createElement("a");
    title.className = "linked-source-title";

    title.href =
      `/sources/detail/?id=${encodeURIComponent(link.source_fk)}`;

    title.textContent =
      `${String(link.source_code || "").toUpperCase()} — ` +
      `${link.source_title || "(Untitled source)"}`;

    const meta = document.createElement("div");
    meta.className = "linked-source-meta";

    const parts = [];

    if (link.source_order) {
      parts.push(`Order ${link.source_order}`);
    }

    if (link.metals) {
      parts.push(link.metals);
    }

    if (link.exposure_periods) {
      parts.push(link.exposure_periods);
    }

    meta.textContent = parts.join(" · ");

    const notes = document.createElement("div");
    notes.className = "linked-source-notes";
    notes.textContent = link.notes || "";

    main.append(title, meta);

    if (link.notes) {
      main.append(notes);
    }

    const actions = document.createElement("div");
    actions.className = "linked-source-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "button button-small";
    editButton.textContent = "Edit link";

    editButton.addEventListener("click", () => {
      openLinkForm(link);
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className =
      "button button-small button-danger";

    removeButton.textContent = "Remove";

    removeButton.addEventListener("click", () => {
      removeSourceLink(link);
    });

    actions.append(editButton, removeButton);

    row.append(main, actions);
    linkedSourcesElement.append(row);
  }

  linkedSourcesStatus.hidden = true;
  linkedSourcesElement.hidden = false;
}

async function loadLinkedSources() {
  if (!currentSite) {
    return;
  }

  try {
    const response = await fetch(
      `/api/sites/${encodeURIComponent(currentSite.id)}/sources`,
      {
        headers: { accept: "application/json" },
      }
    );

    const payload = await response.json();

    if (!response.ok || !payload.ok || !Array.isArray(payload.links)) {
      throw new Error(
        payload.error || "Unable to load linked sources."
      );
    }

    currentLinks = payload.links;
    renderLinkedSources();
  } catch (error) {
    console.error(error);

    linkedSourcesStatus.textContent =
      "Unable to load linked sources.";

    linkedSourcesStatus.hidden = false;
    linkedSourcesElement.hidden = true;
  }
}

function resetLinkForm() {
  editingLink = null;

  linkSource.disabled = false;
  linkSource.value = "";

  linkOrder.value = "1";
  linkMetals.value = "";
  linkExposurePeriods.value = "";
  linkNotes.value = "";

  linkMessage.hidden = true;
}

function openLinkForm(link = null) {
  resetLinkForm();

  editingLink = link;

  if (link) {
    linkSource.value = String(link.source_fk);
    linkSource.disabled = true;

    linkOrder.value =
      String(link.source_order || 1);

    linkMetals.value =
      link.metals || "";

    linkExposurePeriods.value =
      link.exposure_periods || "";

    linkNotes.value =
      link.notes || "";
  }

  linkForm.hidden = false;
}

function closeLinkForm() {
  linkForm.hidden = true;
  resetLinkForm();
}

addSourceLinkButton.addEventListener("click", () => {
  openLinkForm();
});

cancelLinkButton.addEventListener("click", () => {
  closeLinkForm();
});

saveLinkButton.addEventListener("click", async () => {
  if (!currentSite) {
    return;
  }

  const sourceFk = Number(linkSource.value);

  if (!Number.isInteger(sourceFk) || sourceFk <= 0) {
    linkMessage.textContent = "Select a source.";
    linkMessage.className =
      "save-message save-message-error";
    linkMessage.hidden = false;
    return;
  }

  saveLinkButton.disabled = true;
  saveLinkButton.textContent = "Saving…";

  try {
    const response = await fetch(
      `/api/sites/${encodeURIComponent(currentSite.id)}/sources`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          source_fk: sourceFk,
          source_order: Number(linkOrder.value || 1),
          metals: linkMetals.value,
          exposure_periods: linkExposurePeriods.value,
          notes: linkNotes.value,
        }),
      }
    );

    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(
        payload.error || `HTTP ${response.status}`
      );
    }

    closeLinkForm();

    await loadLinkedSources();

    linkMessage.textContent = "Source link saved.";
    linkMessage.className =
      "save-message save-message-success";
    linkMessage.hidden = false;
  } catch (error) {
    console.error(error);

    linkMessage.textContent =
      error.message || "Unable to save source link.";

    linkMessage.className =
      "save-message save-message-error";
    linkMessage.hidden = false;
  } finally {
    saveLinkButton.disabled = false;
    saveLinkButton.textContent = "Save link";
  }
});

async function removeSourceLink(link) {
  const confirmed = window.confirm(
    `Remove ${String(link.source_code || "").toUpperCase()} ` +
    `from this site?`
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(
      `/api/sites/${encodeURIComponent(currentSite.id)}` +
      `/sources/${encodeURIComponent(link.id)}`,
      {
        method: "DELETE",
        headers: {
          accept: "application/json",
        },
      }
    );

    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(
        payload.error || `HTTP ${response.status}`
      );
    }

    await loadLinkedSources();

    linkMessage.textContent = "Source link removed.";
    linkMessage.className =
      "save-message save-message-success";
    linkMessage.hidden = false;
  } catch (error) {
    console.error(error);

    linkMessage.textContent =
      error.message || "Unable to remove source link.";

    linkMessage.className =
      "save-message save-message-error";
    linkMessage.hidden = false;
  }
}



loadSite();