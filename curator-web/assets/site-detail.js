const statusElement = document.getElementById("status");
const detailElement = document.getElementById("site-detail");
const codeElement = document.getElementById("site-code");
const titleElement = document.getElementById("site-title");
const fieldsElement = document.getElementById("site-fields");

const editButton = document.getElementById("edit-button");
const cancelButton = document.getElementById("cancel-button");
const saveButton = document.getElementById("save-button");
const saveMessage = document.getElementById("save-message");
const siteCreateTools = document.getElementById("site-create-tools");
const locationQuery = document.getElementById("location-query");
const locationSearchButton = document.getElementById("location-search-button");
const locationClearButton = document.getElementById("location-clear-button");
const locationSearchStatus = document.getElementById("location-search-status");
const locationResults = document.getElementById("location-results");
const siteIdSuggestion = document.getElementById("site-id-suggestion");
const siteMatchPreview = document.getElementById("site-match-preview");

let lastSuggestedSiteId = "";
let siteCountryCode = "";
let currentRegionSuggestion = null;
let regionSuggestionRequestId = 0;
let regionSuggestionPanel = null;

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
const sourceLinksSection = document.getElementById("source-links-section");

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

function isNewSite() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  return params.get("new") ===
    "1";
}


function updateSiteModeTabs() {
  const activeMode =
    isNewSite()
      ? "single"
      : "browse";


  for (
    const tab
    of document.querySelectorAll(
      "[data-sites-mode]"
    )
  ) {
    const active =
      tab.dataset.sitesMode ===
      activeMode;


    tab.classList.toggle(
      "sites-mode-tab-active",
      active
    );


    if (active) {
      tab.setAttribute(
        "aria-current",
        "page"
      );
    } else {
      tab.removeAttribute(
        "aria-current"
      );
    }
  }
}

function getSiteId() {
  return new URLSearchParams(window.location.search).get("id");
}

const REQUIRED_NEW_SITE_FIELDS =
  new Set([
    "site_id",
    "site_label",
    "latitude",
    "longitude",
    "modern_country_location",
  ]);

const SITE_FIELD_PLACEHOLDERS = {
  site_id:
    "Automatically suggested from country/location",

  site_label:
    "e.g. Yakutsk",

  site_type:
    "e.g. City, Research station, Industrial site",

  latitude:
    "e.g. 62.0355",

  longitude:
    "e.g. 129.6755",

  modern_country_location:
    "e.g. Russia or Antarctica",

  administering_country:
    "For Antarctic IDs such as AQ-RU-001",

  former_entity:
    "e.g. USSR",

  region_category:
    "Comma-separated region tags",

  exposure_period:
    "e.g. 1987–1991 or 1 year",

  metal:
    "Comma-separated materials",

  notes:
    "Optional Site notes",
};

const SITE_FIELD_OPTIONS = {
  site_type: [
    "Cape site",
    "Cathedral",
    "City",
    "Field site",
    "Industrial Locality",
    "Industrial site",
    "Island",
    "Locality",
    "Monitoring site",
    "National Park",
    "Point site",
    "Port city",
    "Research Park",
    "Research centre",
    "Research station",
    "Rural",
    "Rural monitoring site",
    "Settlement",
    "Sub-Antarctic Islands",
    "Sub-arctic test site",
    "Test site",
    "Town",
    "Village",
    "Waterfall locality",
  ],

  former_entity: [
    "Czechoslovakia",
    "USSR",
  ],

  metal: [
    "Carbon steel",
    "Weathering steel",
    "Zinc",
    "Copper",
    "Aluminium",
    "Galvanized steel",
    "Lead",
    "Nickel",
    "Tin",
    "Brass",
    "Bronze",
  ],
};

function hideRegionSuggestion() {
  currentRegionSuggestion = null;

  if (regionSuggestionPanel) {
    regionSuggestionPanel.hidden = true;
  }
}

function ensureRegionSuggestionPanel() {
  if (
    regionSuggestionPanel &&
    regionSuggestionPanel.isConnected
  ) {
    return regionSuggestionPanel;
  }

  regionSuggestionPanel = null;

  const panel =
    document.createElement("div");

  panel.className =
    "region-suggestion";

  panel.hidden = true;

  const heading =
    document.createElement("div");

  heading.className =
    "region-suggestion-heading";

  heading.textContent =
    "Automatic region classification";

  const value =
    document.createElement("div");

  value.className =
    "region-suggestion-value";

  value.dataset.role =
    "region-suggestion-value";

  const notes =
    document.createElement("div");

  notes.className =
    "region-suggestion-notes";

  notes.dataset.role =
    "region-suggestion-notes";

  panel.append(
    heading,
    value,
    notes
  );

  const regionInput =
    getSiteInput(
      "region_category"
    );

  const regionValueElement =
    regionInput?.closest(
      ".detail-value"
    );

  if (regionValueElement) {
    regionValueElement.append(
      panel
    );
  } else {
    fieldsElement.insertAdjacentElement(
      "afterend",
      panel
    );
  }

  regionSuggestionPanel =
    panel;

  return panel;
}

async function refreshRegionClassification() {
  if (!editing) {
    hideRegionSuggestion();
    return;
  }

  const latitude =
    getSiteInput("latitude")
      ?.value.trim() || "";

  const longitude =
    getSiteInput("longitude")
      ?.value.trim() || "";

  if (
    latitude === "" ||
    longitude === ""
  ) {
    hideRegionSuggestion();
    return;
  }

  const lat =
    Number(latitude);

  const lon =
    Number(longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    hideRegionSuggestion();
    return;
  }

  const requestId =
    ++regionSuggestionRequestId;

  const panel =
    ensureRegionSuggestionPanel();

  const valueElement =
    panel.querySelector(
      '[data-role="region-suggestion-value"]'
    );

  const notesElement =
    panel.querySelector(
      '[data-role="region-suggestion-notes"]'
    );

  panel.hidden = false;

  valueElement.textContent =
    "Classifying…";

  notesElement.textContent = "";

  try {
    const response =
      await fetch(
        "/api/region-classification",
        {
          method: "POST",

          headers: {
            "content-type":
              "application/json",

            accept:
              "application/json",
          },

          body:
            JSON.stringify({
              latitude: lat,
              longitude: lon,

              current_region_category:
                getSiteInput(
                  "region_category"
                )?.value.trim() || "",

              modern_country_location:
                getSiteInput(
                  "modern_country_location"
                )?.value.trim() || "",

              site_type:
                getSiteInput(
                  "site_type"
                )?.value.trim() || "",
            }),
        }
      );

    const payload =
      await response.json();

    if (
      requestId !==
      regionSuggestionRequestId
    ) {
      return;
    }

    if (
      !response.ok ||
      !payload.ok
    ) {
      throw new Error(
        payload.error ||
        "Unable to classify region."
      );
    }

    currentRegionSuggestion =
      payload;

    const regionInput =
      getSiteInput(
        "region_category"
      );

    if (
      regionInput &&
      payload.region_category
    ) {
      regionInput.value =
        payload.region_category;
    }

    valueElement.textContent =
      payload.region_category ||
      "No classification suggested.";

    notesElement.textContent =
      payload.notes || "";

    panel.hidden = false;
  } catch (error) {
    console.error(
      "Unable to classify region.",
      error
    );

    if (
      requestId !==
      regionSuggestionRequestId
    ) {
      return;
    }

    currentRegionSuggestion =
      null;

    valueElement.textContent =
      "Region classification unavailable.";

    notesElement.textContent =
      error.message || "";
  }
}

function addField(
  fieldName,
  label,
  value
) {
  const row =
    document.createElement("div");

  row.className =
    "detail-field";

  const labelElement =
    document.createElement("label");

  labelElement.className =
    "detail-label";

  const required =
    isNewSite() &&
    REQUIRED_NEW_SITE_FIELDS.has(
      fieldName
    );

  labelElement.textContent =
    required
      ? `${label} *`
      : label;

  const valueElement =
    document.createElement("div");

  valueElement.className =
    "detail-value";

  if (editing) {
    const input =
      document.createElement(
        fieldName === "notes"
          ? "textarea"
          : "input"
      );

    input.id =
      `field-${fieldName}`;

    input.dataset.field =
      fieldName;

    input.className =
      "detail-input";

    if (
      fieldName === "latitude" ||
      fieldName === "longitude"
    ) {
      input.type = "number";
      input.step = "any";
    }

    if (fieldName === "notes") {
      input.rows = 4;
    }

    input.value =
      value === null ||
      value === undefined
        ? ""
        : String(value);

    const placeholder =
      SITE_FIELD_PLACEHOLDERS[
        fieldName
      ];

    if (placeholder) {
      input.placeholder =
        placeholder;
    }

    labelElement.htmlFor =
      input.id;

    const options =
      SITE_FIELD_OPTIONS[
        fieldName
      ] || [];

    if (
      input.tagName === "INPUT" &&
      options.length > 0
    ) {
      const datalist =
        document.createElement(
          "datalist"
        );

      datalist.id =
        `options-${fieldName}`;

      for (
        const optionValue
        of options
      ) {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          optionValue;

        datalist.append(option);
      }

      input.setAttribute(
        "list",
        datalist.id
      );

      valueElement.append(
        input,
        datalist
      );
    } else {
      valueElement.append(input);
    }

    if (isNewSite()) {
      input.addEventListener(
        "change",
        async () => {
          if (
            fieldName ===
            "modern_country_location"
          ) {
            siteCountryCode = "";
          }

          if (
            fieldName ===
              "modern_country_location" ||
            fieldName ===
              "administering_country"
          ) {
            await refreshSuggestedSiteId();
          }

          if (
            [
              "site_id",
              "site_label",
              "latitude",
              "longitude",
              "modern_country_location",
            ].includes(fieldName)
          ) {
            await refreshSiteMatchPreview();
          }
        }
      );
    }

    if (
      [
        "latitude",
        "longitude",
        "modern_country_location",
        "site_type",
      ].includes(fieldName)
    ) {
      input.addEventListener(
        "change",
        async () => {
          await refreshRegionClassification();
        }
      );
    }

  } else if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    valueElement.textContent =
      "—";

    valueElement.classList.add(
      "detail-empty"
    );
  } else {
    valueElement.textContent =
      String(value);
  }

  row.append(
    labelElement,
    valueElement
  );

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
  if (!editing) {
    hideRegionSuggestion();
  }
}

async function loadSite() {
  updateSiteModeTabs();

  if (isNewSite()) {
    currentSite = {
      id: null,
      site_id: "",
      site_label: "",
      site_type: "",
      latitude: "",
      longitude: "",
      modern_country_location: "",
      administering_country: "",
      former_entity: "",
      region_category: "",
      exposure_period: "",
      metal: "",
      notes: "",
    };

    editing = true;
    siteCreateTools.hidden = false;
    sourceLinksSection.hidden = true;

    renderSite();

    document.title = "New Site · Corrosion Atlas Curator";

    statusElement.hidden = true;
    detailElement.hidden = false;
    sourceLinksSection.hidden = true;

    return;
  }

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

editButton.addEventListener(
  "click",
  async () => {
    editing = true;
    saveMessage.hidden = true;

    renderSite();

    await refreshRegionClassification();
  }
);

cancelButton.addEventListener("click", () => {
  if (isNewSite()) {
    window.location.href = "/sites/";
    return;
  }

  editing = false;
  saveMessage.hidden = true;
  renderSite();
});

saveButton.addEventListener("click", async () => {
  const creating =
    !currentSite.id;
  const updates = {};

  for (const input of fieldsElement.querySelectorAll("[data-field]")) {
    updates[input.dataset.field] = input.value;
  }

  if (creating) {
    const missing = [];

    if (!updates.site_id?.trim()) {
      missing.push("Site ID");
    }

    if (!updates.site_label?.trim()) {
      missing.push("Site label");
    }

    if (!updates.latitude?.trim()) {
      missing.push("Latitude");
    }

    if (!updates.longitude?.trim()) {
      missing.push("Longitude");
    }

    if (
      !updates
        .modern_country_location
        ?.trim()
    ) {
      missing.push(
        "Modern country / location"
      );
    }

    if (missing.length) {
      saveMessage.textContent =
        `Required: ${missing.join(", ")}.`;

      saveMessage.className =
        "save-message save-message-error";

      saveMessage.hidden =
        false;

      return;
    }

    const latitude =
      Number(updates.latitude);

    const longitude =
      Number(updates.longitude);

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {
      saveMessage.textContent =
        "Latitude must be a valid number between -90 and 90.";

      saveMessage.className =
        "save-message save-message-error";

      saveMessage.hidden =
        false;

      return;
    }

    if (
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      saveMessage.textContent =
        "Longitude must be a valid number between -180 and 180.";

      saveMessage.className =
        "save-message save-message-error";

      saveMessage.hidden =
        false;

      return;
    }
  }

  saveButton.disabled = true;
  cancelButton.disabled = true;
  saveButton.textContent = "Saving…";
  saveMessage.hidden = true;

  try {

    const endpoint = creating
      ? "/api/sites"
      : `/api/sites/${encodeURIComponent(currentSite.id)}`;

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

    if (!response.ok || !payload.ok || !payload.site) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    currentSite = payload.site;
    editing = false;

    if (
      creating &&
      payload.action === "merged"
    ) {
      saveMessage.textContent =
        `Merged with existing Site. ` +
        `Match basis: ${payload.match_reason}.`;
    } else {
      saveMessage.textContent =
        "Saved.";
    }

    if (creating) {
      window.history.replaceState(
        {},
        "",
        `/sites/detail/?id=${encodeURIComponent(currentSite.id)}`
      );
      sourceLinksSection.hidden = false;
      siteCreateTools.hidden = true;

      await Promise.all([
        loadSourceOptions(),
        loadLinkedSources(),
      ]);
    }

    renderSite();

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

function getSiteInput(
  fieldName
) {
  return fieldsElement.querySelector(
    `[data-field="${fieldName}"]`
  );
}

async function refreshSuggestedSiteId() {
  if (!isNewSite()) {
    return;
  }

  const countryInput =
    getSiteInput(
      "modern_country_location"
    );

  const adminInput =
    getSiteInput(
      "administering_country"
    );

  const siteIdInput =
    getSiteInput("site_id");

  const country =
    countryInput?.value.trim() || "";

  const admin =
    adminInput?.value.trim() || "";

  if (!country) {
    siteIdSuggestion.textContent =
      "Enter a modern country / location to generate a Site ID.";

    return;
  }

  try {
    const url =
      new URL(
        "/api/site-id-suggestion",
        window.location.origin
      );

    url.searchParams.set(
      "country",
      country
    );

    url.searchParams.set(
      "admin",
      admin
    );

    if (siteCountryCode) {
      url.searchParams.set(
        "country_code",
        siteCountryCode
      );
    }

    const response =
      await fetch(url, {
        headers: {
          accept:
            "application/json",
        },
      });

    const payload =
      await response.json();

    if (
      !response.ok ||
      !payload.ok
    ) {
      throw new Error(
        payload.error ||
        "Unable to suggest Site ID."
      );
    }

    const suggested =
      payload.suggested_site_id;

    siteIdSuggestion.textContent =
      `Suggested Site ID: ${suggested}`;

    if (
      siteIdInput &&
      (
        !siteIdInput.value.trim() ||
        siteIdInput.value.trim() ===
          lastSuggestedSiteId
      )
    ) {
      siteIdInput.value =
        suggested;
    }

    lastSuggestedSiteId =
      suggested;
  } catch (error) {
    console.error(error);

    siteIdSuggestion.textContent =
      "Unable to generate a Site ID suggestion.";
  }
}

async function refreshSiteMatchPreview() {
  if (!isNewSite()) {
    return;
  }

  const siteId =
    getSiteInput("site_id")
      ?.value.trim() || "";

  const siteLabel =
    getSiteInput("site_label")
      ?.value.trim() || "";

  const latitude =
    getSiteInput("latitude")
      ?.value.trim() || "";

  const longitude =
    getSiteInput("longitude")
      ?.value.trim() || "";

  const country =
    getSiteInput(
      "modern_country_location"
    )?.value.trim() || "";

  if (
    !siteLabel ||
    !latitude ||
    !longitude
  ) {
    siteMatchPreview.hidden =
      true;

    return;
  }

  try {
    const response =
      await fetch(
        "/api/site-match-preview",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",

            accept:
              "application/json",
          },

          body:
            JSON.stringify({
              site_id:
                siteId,

              site_label:
                siteLabel,

              latitude,
              longitude,

              modern_country_location:
                country,
            }),
        }
      );

    const payload =
      await response.json();

    if (
      !response.ok ||
      !payload.ok
    ) {
      throw new Error(
        payload.error ||
        "Unable to check existing Sites."
      );
    }

    if (!payload.checked) {
      siteMatchPreview.hidden =
        true;

      return;
    }

    if (payload.will_merge) {
      const existing =
        payload.existing || {};

      siteMatchPreview.textContent =
        `Existing Site likely found: ` +
        `${existing.site_id || ""} — ` +
        `${existing.site_label || ""}. ` +
        `Saving will merge into this row. ` +
        `Match basis: ${payload.match_reason}.`;

      siteMatchPreview.className =
        "save-message save-message-warning";
    } else {
      siteMatchPreview.textContent =
        "No matching Site found. Saving will create a new Site row.";

      siteMatchPreview.className =
        "save-message save-message-success";
    }

    siteMatchPreview.hidden =
      false;
  } catch (error) {
    console.error(error);

    siteMatchPreview.textContent =
      "Existing-Site check is currently unavailable.";

    siteMatchPreview.className =
      "save-message save-message-warning";

    siteMatchPreview.hidden =
      false;
  }
}

function renderLocationResults(
  results
) {
  locationResults.replaceChildren();

  if (!results.length) {
    locationSearchStatus.textContent =
      "No matching locations found.";

    locationSearchStatus.hidden =
      false;

    locationResults.hidden =
      true;

    return;
  }

  for (const result of results) {
    const row =
      document.createElement("div");

    row.className =
      "location-result";

    const main =
      document.createElement("div");

    const title =
      document.createElement("div");

    title.className =
      "location-result-title";

    title.textContent =
      result.label ||
      result.site_label ||
      "(Unnamed result)";

    const detail =
      document.createElement("div");

    detail.className =
      "location-result-detail";

    detail.textContent =
      `${result.full_label || ""} · ` +
      `${result.latitude}, ${result.longitude}`;

    main.append(
      title,
      detail
    );

    const applyButton =
      document.createElement("button");

    applyButton.type =
      "button";

    applyButton.className =
      "button button-small";

    applyButton.textContent =
      "Apply";

    applyButton.addEventListener(
      "click",
      async () => {
        await applyLocationResult(
          result
        );
      }
    );

    row.append(
      main,
      applyButton
    );

    locationResults.append(row);
  }

  locationSearchStatus.textContent =
    "Location suggestions found.";

  locationSearchStatus.hidden =
    false;

  locationResults.hidden =
    false;
}

async function applyLocationResult(
  result
) {
  const siteLabelInput =
    getSiteInput("site_label");

  const latitudeInput =
    getSiteInput("latitude");

  const longitudeInput =
    getSiteInput("longitude");

  const countryInput =
    getSiteInput(
      "modern_country_location"
    );

  const siteIdInput =
    getSiteInput("site_id");

  if (siteLabelInput) {
    siteLabelInput.value =
      result.site_label || "";
  }

  if (latitudeInput) {
    latitudeInput.value =
      result.latitude;
  }

  if (longitudeInput) {
    longitudeInput.value =
      result.longitude;
  }

  if (countryInput) {
    countryInput.value =
      result.country || "";
  }

  siteCountryCode =
    result.country_code || "";

  if (siteIdInput) {
    siteIdInput.value = "";
  }

  lastSuggestedSiteId = "";

  await refreshSuggestedSiteId();
  await refreshSiteMatchPreview();
  await refreshRegionClassification();

  locationSearchStatus.textContent =
    "Selected location applied to the Site form.";

  locationSearchStatus.hidden =
    false;
}

async function searchLocations() {
  const query =
    locationQuery.value.trim();

  if (!query) {
    locationSearchStatus.textContent =
      "Enter a place name first.";

    locationSearchStatus.hidden =
      false;

    return;
  }

  locationSearchButton.disabled =
    true;

  locationSearchButton.textContent =
    "Searching…";

  try {
    const url =
      new URL(
        "/api/location-search",
        window.location.origin
      );

    url.searchParams.set(
      "q",
      query
    );

    const response =
      await fetch(url, {
        headers: {
          accept:
            "application/json",
        },
      });

    const payload =
      await response.json();

    if (
      !response.ok ||
      !payload.ok ||
      !Array.isArray(
        payload.results
      )
    ) {
      throw new Error(
        payload.error ||
        "Location search failed."
      );
    }

    renderLocationResults(
      payload.results
    );
  } catch (error) {
    console.error(error);

    locationSearchStatus.textContent =
      error.message ||
      "Location search failed.";

    locationSearchStatus.hidden =
      false;

    locationResults.hidden =
      true;
  } finally {
    locationSearchButton.disabled =
      false;

    locationSearchButton.textContent =
      "Search";
  }
}

locationSearchButton.addEventListener(
  "click",
  searchLocations
);

locationQuery.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchLocations();
    }
  }
);

locationClearButton.addEventListener(
  "click",
  () => {
    locationQuery.value = "";
    locationResults.replaceChildren();
    locationResults.hidden = true;
    locationSearchStatus.hidden = true;
  }
);

loadSite();