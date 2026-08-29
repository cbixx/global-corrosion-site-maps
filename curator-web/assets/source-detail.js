const statusElement = document.getElementById("status");
const detailElement = document.getElementById("source-detail");
const codeElement = document.getElementById("source-code");
const titleElement = document.getElementById("source-title");
const fieldsElement = document.getElementById("source-fields");
const editButton = document.getElementById("edit-button");
const cancelButton = document.getElementById("cancel-button");
const saveButton = document.getElementById("save-button");
const saveMessage = document.getElementById("save-message");

const siteLinksSection = document.getElementById("site-links-section");
const addSiteLinkButton = document.getElementById("add-site-link-button");
const siteLinkForm = document.getElementById("site-link-form");
const linkSite = document.getElementById("link-site");
const siteLinkOrder = document.getElementById("site-link-order");
const siteLinkMetals = document.getElementById("site-link-metals");
const siteLinkExposurePeriods = document.getElementById("site-link-exposure-periods");
const siteLinkNotes = document.getElementById("site-link-notes");
const cancelSiteLinkButton = document.getElementById("cancel-site-link-button");
const saveSiteLinkButton = document.getElementById("save-site-link-button");
const siteLinkMessage = document.getElementById("site-link-message");
const linkedSitesStatus = document.getElementById("linked-sites-status");
const linkedSitesElement = document.getElementById("linked-sites");
const sourcePdfSection = document.getElementById("source-pdf-section");
const sourcePdfTitle = document.getElementById("source-pdf-title");
const sourcePdfMeta = document.getElementById("source-pdf-meta");
const openSourcePdf = document.getElementById("open-source-pdf");
const uploadSourcePdfButton = document.getElementById("upload-source-pdf");
const removeSourcePdfButton = document.getElementById("remove-source-pdf");
const sourcePdfInput = document.getElementById("source-pdf-input");
const sourcePdfMessage = document.getElementById("source-pdf-message");


let siteOptions = [];
let currentSiteLinks = [];
let currentSource = null;
let editing = false;

const FIELD_LABELS = {
  source_code: "Source code",
  source_title: "Source title",
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
  source_url: "Source URL",
  notes: "Internal notes",
};

const REQUIRED_NEW_SOURCE_FIELDS = new Set([
  "source_code",
  "programme",
  "metals",
  "exposure_periods",
]);

const HIDDEN_NEW_SOURCE_FIELDS = new Set([
  "local_file_name",
  "private_pdf_object_key",
]);

const FIELD_PLACEHOLDERS = {
  source_code:
    "e.g. 21, S21, or s021",

  source_title:
    "Paper, report, dataset, or source title",

  authors_or_organization:
    "e.g. ISO, ASTM, ICP Materials, or author names",

  publication_year:
    "e.g. 2014",

  doi:
    "e.g. 10.xxxx/xxxxx",

  public_url:
    "Publisher, DOI, dataset, or public landing page",

  display_citation:
    "Leave blank to auto-generate from authors, year, and title.",

  programme:
    "e.g. ICP/UNECE",

  metals:
    "Comma-separated, e.g. Carbon steel, Zinc",

  exposure_periods:
    "Comma-separated, e.g. 1 year, 2 years",

  source_url:
    "External source URL",
};

let sourceFormOptions = null;

function isNewSource() {
  const params = new URLSearchParams(window.location.search);
  return params.get("new") === "1";
}

function getSourceId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function normaliseSourceCode(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.pdf$/i, "");

  const match =
    text.match(/^s?0*(\d{1,4})$/);

  if (!match) {
    return text;
  }

  return `s${String(Number(match[1])).padStart(3, "0")}`;
}

async function loadSourceFormOptions() {
  const response =
    await fetch("/api/source-form-options", {
      headers: {
        accept: "application/json",
      },
    });

  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(
      payload.error ||
      "Unable to load Source form options."
    );
  }

  sourceFormOptions = payload;

  return payload;
}

function getSourceFieldOptions(fieldName) {
  if (!sourceFormOptions) {
    return [];
  }

  const optionKeyByField = {
    source_kind:
      "source_kind_options",

    source_type:
      "source_type_options",

    programme:
      "programme_options",

    metals:
      "metal_options",

    exposure_periods:
      "exposure_period_options",
  };

  const optionKey =
    optionKeyByField[fieldName];

  if (!optionKey) {
    return [];
  }

  const options =
    sourceFormOptions[optionKey];

  return Array.isArray(options)
    ? options
    : [];
}

function addField(fieldName, label, value) {
  const row = document.createElement("div");
  row.className = "detail-field";

  const labelElement = document.createElement("label");
  labelElement.className = "detail-label";

  const requiredForNewSource =
    isNewSource() &&
    REQUIRED_NEW_SOURCE_FIELDS.has(fieldName);

  labelElement.textContent =
    requiredForNewSource
      ? `${label} *`
      : label;

  const valueElement = document.createElement("div");
  valueElement.className = "detail-value";

  if (editing) {
    const longFields = new Set([
      "display_citation",
      "public_notes",
      "notes",
    ]);

    const input = document.createElement(
      longFields.has(fieldName)
        ? "textarea"
        : "input"
    );

    input.className = "detail-input";
    input.dataset.field = fieldName;

    input.value =
      value === null ||
      value === undefined
        ? ""
        : String(value);

    const placeholder =
      FIELD_PLACEHOLDERS[fieldName];

    if (placeholder) {
      input.placeholder = placeholder;
    }

    if (input.tagName === "TEXTAREA") {
      input.rows = 4;
    }

    labelElement.htmlFor =
      `field-${fieldName}`;

    input.id =
      `field-${fieldName}`;

    if (fieldName === "source_code") {
      input.autocapitalize = "off";
      input.autocomplete = "off";

      input.addEventListener(
        "blur",
        () => {
          input.value =
            normaliseSourceCode(
              input.value
            );
        }
      );
    }

    const fieldOptions =
      getSourceFieldOptions(fieldName);

    if (
      input.tagName === "INPUT" &&
      fieldOptions.length > 0
    ) {
      const datalist =
        document.createElement("datalist");

      datalist.id =
        `options-${fieldName}`;

      for (const optionValue of fieldOptions) {
        const option =
          document.createElement("option");

        option.value = optionValue;
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

  row.append(
    labelElement,
    valueElement
  );

  fieldsElement.append(row);
}

function renderSourcePdf() {
  /*
   * A Source must exist in the database
   * before a PDF can be attached.
   */
  if (
    !currentSource ||
    !currentSource.id
  ) {
    sourcePdfSection.hidden =
      true;

    return;
  }


  sourcePdfSection.hidden =
    false;


  const objectKey =
    String(
      currentSource.private_pdf_object_key ||
      ""
    ).trim();


  const localFileName =
    String(
      currentSource.local_file_name ||
      ""
    ).trim();


  const hasPdf =
    Boolean(objectKey);


  if (hasPdf) {
    sourcePdfTitle.textContent =
      localFileName ||
      `${String(
        currentSource.source_code ||
        ""
      ).toLowerCase()}.pdf`;

    sourcePdfMeta.textContent =
      "Stored in the private Corrosion Atlas R2 bucket.";

    openSourcePdf.href =
      `/api/sources/${encodeURIComponent(
        currentSource.id
      )}/pdf`;

    openSourcePdf.hidden =
      false;

    removeSourcePdfButton.hidden =
      false;

    uploadSourcePdfButton.textContent =
      "Replace PDF";
  } else {
    sourcePdfTitle.textContent =
      "No PDF attached";

    sourcePdfMeta.textContent =
      "Upload a private source document for this Source.";

    openSourcePdf.hidden =
      true;

    removeSourcePdfButton.hidden =
      true;

    uploadSourcePdfButton.textContent =
      "Upload PDF";
  }
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

  for (
    const [fieldName, label]
    of Object.entries(FIELD_LABELS)
  ) {
    if (
      isNewSource() &&
      HIDDEN_NEW_SOURCE_FIELDS.has(fieldName)
    ) {
      continue;
    }

    addField(
      fieldName,
      label,
      currentSource[fieldName]
    );
  }

  editButton.hidden = editing;
  cancelButton.hidden = !editing;
  saveButton.hidden = !editing;

  renderSourcePdf();
}

async function loadSource() {

  if (isNewSource()) {
    let suggestedSourceCode = "";

    try {
      const options =
        await loadSourceFormOptions();

      suggestedSourceCode =
        options.next_source_code || "";
    } catch (error) {
      console.error(
        "Unable to load Source creation options.",
        error
      );
    }
    
    currentSource = {
      id: null,
      source_code: suggestedSourceCode,
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
    siteLinksSection.hidden = true;
    
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
    siteLinksSection.hidden = false;

    await Promise.all([
      loadSiteOptions(),
      loadLinkedSites(),
    ]);
  } catch (error) {
    console.error("Unable to load source.", error);

    statusElement.textContent =
      "Unable to load this source record.";
  }
}

editButton.addEventListener(
  "click",
  async () => {
    if (!sourceFormOptions) {
      try {
        await loadSourceFormOptions();
      } catch (error) {
        console.error(
          "Unable to load Source field options.",
          error
        );
      }
    }

    editing = true;
    saveMessage.hidden = true;

    renderSource();
  }
);

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

  const creating =
    !currentSource.id;

  const updates = {};

  for (const input of fieldsElement.querySelectorAll("[data-field]")) {
    updates[input.dataset.field] = input.value;
  }

  if (creating) {
    updates.source_code =
      normaliseSourceCode(
        updates.source_code
      );

    const missingFields = [];

    if (!updates.source_code?.trim()) {
      missingFields.push("Source code");
    }

    if (!updates.programme?.trim()) {
      missingFields.push("Programme");
    }

    if (!updates.metals?.trim()) {
      missingFields.push("Metals");
    }

    if (!updates.exposure_periods?.trim()) {
      missingFields.push(
        "Exposure periods"
      );
    }

    if (missingFields.length > 0) {
      saveMessage.textContent =
        `Required: ${missingFields.join(", ")}.`;

      saveMessage.className =
        "save-message save-message-error";

      saveMessage.hidden = false;
      return;
    }

    if (
      !/^s\d{3}$/.test(
        updates.source_code
      )
    ) {
      saveMessage.textContent =
        "Source code must resolve to canonical sNNN format.";

      saveMessage.className =
        "save-message save-message-error";

      saveMessage.hidden = false;
      return;
    }
  }

  saveButton.disabled = true;
  cancelButton.disabled = true;

  saveButton.textContent = "Saving…";

  saveMessage.hidden = true;

  try {
    
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
      siteLinksSection.hidden = false;

      await Promise.all([
        loadSiteOptions(),
        loadLinkedSites(),
      ]);
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

async function loadSiteOptions() {
  const response = await fetch("/api/sites", {
    headers: { accept: "application/json" },
  });

  const payload = await response.json();

  if (!response.ok || !payload.ok || !Array.isArray(payload.sites)) {
    throw new Error(
      payload.error || "Unable to load site options."
    );
  }

  siteOptions = payload.sites;
  linkSite.replaceChildren();

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "Select a site…";
  linkSite.append(emptyOption);

  for (const site of siteOptions) {
    const option = document.createElement("option");

    option.value = site.id;
    option.textContent =
      `${site.site_id || ""} — ` +
      `${site.site_label || "(Unnamed site)"}`;

    linkSite.append(option);
  }
}

function renderLinkedSites() {
  linkedSitesElement.replaceChildren();

  if (currentSiteLinks.length === 0) {
    linkedSitesStatus.textContent =
      "No sites are linked to this source.";
    linkedSitesStatus.hidden = false;
    linkedSitesElement.hidden = true;
    return;
  }

  for (const link of currentSiteLinks) {
    const row = document.createElement("div");
    row.className = "linked-source";

    const main = document.createElement("div");
    main.className = "linked-source-main";

    const title = document.createElement("a");
    title.className = "linked-source-title";
    title.href =
      `/sites/detail/?id=${encodeURIComponent(link.site_fk)}`;

    title.textContent =
      `${link.site_id || ""} — ` +
      `${link.site_label || "(Unnamed site)"}`;

    const meta = document.createElement("div");
    meta.className = "linked-source-meta";

    meta.textContent = [
      link.modern_country_location,
      link.source_order ? `Order ${link.source_order}` : "",
      link.metals,
      link.exposure_periods,
    ]
      .filter(Boolean)
      .join(" · ");

    const notes = document.createElement("div");
    notes.className = "linked-source-notes";
    notes.textContent = link.notes || "";

    main.append(title);

    if (meta.textContent) {
      main.append(meta);
    }

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
      openSiteLinkForm(link);
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className =
      "button button-small button-danger";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => {
      removeSiteLink(link);
    });

    actions.append(editButton, removeButton);
    row.append(main, actions);
    linkedSitesElement.append(row);
  }

  linkedSitesStatus.hidden = true;
  linkedSitesElement.hidden = false;
}

async function loadLinkedSites() {
  const response = await fetch(
    `/api/sources/${encodeURIComponent(currentSource.id)}/sites`,
    {
      headers: { accept: "application/json" },
    }
  );

  const payload = await response.json();

  if (!response.ok || !payload.ok || !Array.isArray(payload.links)) {
    throw new Error(
      payload.error || "Unable to load linked sites."
    );
  }

  currentSiteLinks = payload.links;
  renderLinkedSites();
}

function resetSiteLinkForm() {
  linkSite.disabled = false;
  linkSite.value = "";
  siteLinkOrder.value = "1";
  siteLinkMetals.value = "";
  siteLinkExposurePeriods.value = "";
  siteLinkNotes.value = "";
  siteLinkMessage.hidden = true;
}

function openSiteLinkForm(link = null) {
  resetSiteLinkForm();

  if (link) {
    linkSite.value = String(link.site_fk);
    linkSite.disabled = true;
    siteLinkOrder.value = String(link.source_order || 1);
    siteLinkMetals.value = link.metals || "";
    siteLinkExposurePeriods.value =
      link.exposure_periods || "";
    siteLinkNotes.value = link.notes || "";
  }

  siteLinkForm.hidden = false;
}

function closeSiteLinkForm() {
  siteLinkForm.hidden = true;
  resetSiteLinkForm();
}

addSiteLinkButton.addEventListener("click", () => {
  openSiteLinkForm();
});

cancelSiteLinkButton.addEventListener("click", () => {
  closeSiteLinkForm();
});

saveSiteLinkButton.addEventListener("click", async () => {
  const siteFk = Number(linkSite.value);

  if (!Number.isInteger(siteFk) || siteFk <= 0) {
    siteLinkMessage.textContent = "Select a site.";
    siteLinkMessage.className =
      "save-message save-message-error";
    siteLinkMessage.hidden = false;
    return;
  }

  saveSiteLinkButton.disabled = true;
  saveSiteLinkButton.textContent = "Saving…";

  try {
    const response = await fetch(
      `/api/sites/${encodeURIComponent(siteFk)}/sources`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          source_fk: currentSource.id,
          source_order: Number(siteLinkOrder.value || 1),
          metals: siteLinkMetals.value,
          exposure_periods: siteLinkExposurePeriods.value,
          notes: siteLinkNotes.value,
        }),
      }
    );

    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(
        payload.error || `HTTP ${response.status}`
      );
    }

    closeSiteLinkForm();
    await loadLinkedSites();

    siteLinkMessage.textContent = "Site link saved.";
    siteLinkMessage.className =
      "save-message save-message-success";
    siteLinkMessage.hidden = false;
  } catch (error) {
    console.error(error);

    siteLinkMessage.textContent =
      error.message || "Unable to save site link.";
    siteLinkMessage.className =
      "save-message save-message-error";
    siteLinkMessage.hidden = false;
  } finally {
    saveSiteLinkButton.disabled = false;
    saveSiteLinkButton.textContent = "Save link";
  }
});

async function removeSiteLink(link) {
  if (!window.confirm(
    `Remove ${link.site_id || "this site"} from this source?`
  )) {
    return;
  }

  try {
    const response = await fetch(
      `/api/sites/${encodeURIComponent(link.site_fk)}` +
      `/sources/${encodeURIComponent(link.id)}`,
      {
        method: "DELETE",
        headers: { accept: "application/json" },
      }
    );

    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(
        payload.error || `HTTP ${response.status}`
      );
    }

    await loadLinkedSites();

    siteLinkMessage.textContent = "Site link removed.";
    siteLinkMessage.className =
      "save-message save-message-success";
    siteLinkMessage.hidden = false;
  } catch (error) {
    console.error(error);

    siteLinkMessage.textContent =
      error.message || "Unable to remove site link.";
    siteLinkMessage.className =
      "save-message save-message-error";
    siteLinkMessage.hidden = false;
  }
}

uploadSourcePdfButton.addEventListener(
  "click",
  () => {
    sourcePdfInput.value =
      "";

    sourcePdfInput.click();
  }
);


sourcePdfInput.addEventListener(
  "change",
  async () => {
    const file =
      sourcePdfInput.files?.[0];

    if (!file) {
      return;
    }


    if (
      !file.name
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      sourcePdfMessage.textContent =
        "Select a PDF file.";

      sourcePdfMessage.className =
        "save-message save-message-error";

      sourcePdfMessage.hidden =
        false;

      return;
    }


    uploadSourcePdfButton.disabled =
      true;

    removeSourcePdfButton.disabled =
      true;

    uploadSourcePdfButton.textContent =
      currentSource
        ?.private_pdf_object_key
        ? "Replacing…"
        : "Uploading…";

    sourcePdfMessage.hidden =
      true;


    try {
      const response =
        await fetch(
          `/api/sources/${encodeURIComponent(
            currentSource.id
          )}/pdf`,
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/pdf",

              accept:
                "application/json",
            },

            body:
              file,
          }
        );


      const payload =
        await response.json();


      if (
        !response.ok ||
        !payload.ok ||
        !payload.source
      ) {
        throw new Error(
          payload.error ||
          `HTTP ${response.status}`
        );
      }


      currentSource =
        payload.source;

      renderSourcePdf();


      sourcePdfMessage.textContent =
        "Private PDF uploaded.";

      sourcePdfMessage.className =
        "save-message save-message-success";

      sourcePdfMessage.hidden =
        false;
    } catch (error) {
      console.error(
        "Unable to upload private PDF.",
        error
      );


      sourcePdfMessage.textContent =
        error.message ||
        "Unable to upload private PDF.";

      sourcePdfMessage.className =
        "save-message save-message-error";

      sourcePdfMessage.hidden =
        false;
    } finally {
      uploadSourcePdfButton.disabled =
        false;

      removeSourcePdfButton.disabled =
        false;

      renderSourcePdf();
    }
  }
);


removeSourcePdfButton.addEventListener(
  "click",
  async () => {
    if (
      !currentSource ||
      !currentSource.private_pdf_object_key
    ) {
      return;
    }


    if (
      !window.confirm(
        "Remove this private PDF from the Source?"
      )
    ) {
      return;
    }


    uploadSourcePdfButton.disabled =
      true;

    removeSourcePdfButton.disabled =
      true;

    removeSourcePdfButton.textContent =
      "Removing…";

    sourcePdfMessage.hidden =
      true;


    try {
      const response =
        await fetch(
          `/api/sources/${encodeURIComponent(
            currentSource.id
          )}/pdf`,
          {
            method:
              "DELETE",

            headers: {
              accept:
                "application/json",
            },
          }
        );


      const payload =
        await response.json();


      if (
        !response.ok ||
        !payload.ok ||
        !payload.source
      ) {
        throw new Error(
          payload.error ||
          `HTTP ${response.status}`
        );
      }


      currentSource =
        payload.source;

      renderSourcePdf();


      sourcePdfMessage.textContent =
        payload.warning ||
        "Private PDF removed.";

      sourcePdfMessage.className =
        payload.warning
          ? "save-message save-message-warning"
          : "save-message save-message-success";

      sourcePdfMessage.hidden =
        false;
    } catch (error) {
      console.error(
        "Unable to remove private PDF.",
        error
      );


      sourcePdfMessage.textContent =
        error.message ||
        "Unable to remove private PDF.";

      sourcePdfMessage.className =
        "save-message save-message-error";

      sourcePdfMessage.hidden =
        false;
    } finally {
      uploadSourcePdfButton.disabled =
        false;

      removeSourcePdfButton.disabled =
        false;

      removeSourcePdfButton.textContent =
        "Remove PDF";

      renderSourcePdf();
    }
  }
);

loadSource();