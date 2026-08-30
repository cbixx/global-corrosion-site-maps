const newButton =
  document.getElementById(
    "environment-new"
  );

const formPanel =
  document.getElementById(
    "environment-form-panel"
  );

const formTitle =
  document.getElementById(
    "environment-form-title"
  );

const formMessage =
  document.getElementById(
    "environment-form-message"
  );

const actionMessage =
  document.getElementById(
    "environment-action-message"
  );

const cancelButton =
  document.getElementById(
    "environment-cancel"
  );

const saveButton =
  document.getElementById(
    "environment-save"
  );


const siteInput =
  document.getElementById(
    "environment-site"
  );

const sourceInput =
  document.getElementById(
    "environment-source"
  );

const variableInput =
  document.getElementById(
    "environment-variable"
  );

const valueInput =
  document.getElementById(
    "environment-value"
  );

const unitInput =
  document.getElementById(
    "environment-unit"
  );

const aggregationInput =
  document.getElementById(
    "environment-aggregation"
  );

const periodStartInput =
  document.getElementById(
    "environment-period-start"
  );

const periodEndInput =
  document.getElementById(
    "environment-period-end"
  );

const dataSourceInput =
  document.getElementById(
    "environment-data-source"
  );

const notesInput =
  document.getElementById(
    "environment-notes"
  );


const searchInput =
  document.getElementById(
    "environment-search"
  );

const pageSizeInput =
  document.getElementById(
    "environment-page-size"
  );

const statusElement =
  document.getElementById(
    "environment-status"
  );

const contentElement =
  document.getElementById(
    "environment-content"
  );

const summaryElement =
  document.getElementById(
    "environment-summary"
  );

const listElement =
  document.getElementById(
    "environment-list"
  );

const previousButton =
  document.getElementById(
    "environment-previous"
  );

const nextButton =
  document.getElementById(
    "environment-next"
  );

const pageLabel =
  document.getElementById(
    "environment-page-label"
  );


let sites = [];
let sources = [];
let observations = [];

let editingId = null;

let currentPage = 1;
let currentPageSize = 50;
let currentTotal = 0;
let currentTotalPages = 1;

let searchTimer = null;


function hasValue(
  value
) {
  return (
    value !== null &&
    value !== undefined &&
    String(value).trim() !== ""
  );
}


function siteOptionLabel(
  site
) {
  const country =
    String(
      site.modern_country_location ||
      ""
    ).trim();

  return (
    `${site.site_id || ""} — ` +
    `${site.site_label || "(Unnamed Site)"}` +
    (
      country
        ? ` (${country})`
        : ""
    )
  );
}


function sourceOptionLabel(
  source
) {
  return (
    `${String(
      source.source_code ||
      ""
    ).toUpperCase()} — ` +
    `${source.source_title || "(Untitled Source)"}`
  );
}


function populateOptions() {
  siteInput.replaceChildren();

  const siteBlank =
    document.createElement(
      "option"
    );

  siteBlank.value = "";
  siteBlank.textContent =
    "Select a Site…";

  siteInput.append(
    siteBlank
  );


  for (
    const site
    of sites
  ) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      String(site.id);

    option.textContent =
      siteOptionLabel(
        site
      );

    siteInput.append(
      option
    );
  }


  sourceInput.replaceChildren();

  const sourceBlank =
    document.createElement(
      "option"
    );

  sourceBlank.value = "";

  sourceBlank.textContent =
    "No Curator Source";

  sourceInput.append(
    sourceBlank
  );


  for (
    const source
    of sources
  ) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      String(source.id);

    option.textContent =
      sourceOptionLabel(
        source
      );

    sourceInput.append(
      option
    );
  }
}


async function loadOptions() {
  const response =
    await fetch(
      "/api/linking-options",
      {
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
    !payload.ok
  ) {
    throw new Error(
      payload.error ||
      "Unable to load Site and Source options."
    );
  }


  sites =
    Array.isArray(
      payload.sites
    )
      ? payload.sites
      : [];


  sources =
    Array.isArray(
      payload.sources
    )
      ? payload.sources
      : [];


  populateOptions();
}


function clearForm() {
  editingId = null;

  siteInput.value = "";
  sourceInput.value = "";

  variableInput.value = "";
  valueInput.value = "";
  unitInput.value = "";

  aggregationInput.value = "";
  periodStartInput.value = "";
  periodEndInput.value = "";
  dataSourceInput.value = "";
  notesInput.value = "";

  formMessage.hidden =
    true;
}


function openCreateForm() {
  clearForm();

  formTitle.textContent =
    "New environmental observation";

  formPanel.hidden =
    false;

  actionMessage.hidden =
    true;

  siteInput.focus();

  formPanel.scrollIntoView({
    behavior:
      "smooth",

    block:
      "start",
  });
}


function closeForm() {
  formPanel.hidden =
    true;

  formMessage.hidden =
    true;

  editingId = null;
}


function findObservation(
  id
) {
  return observations.find(
    (observation) =>
      Number(
        observation.id
      ) ===
      Number(id)
  ) || null;
}


function openEditForm(
  observation
) {
  if (!observation) {
    return;
  }


  editingId =
    Number(
      observation.id
    );


  siteInput.value =
    String(
      observation.site_fk ||
      ""
    );


  sourceInput.value =
    observation.source_fk
      ? String(
          observation.source_fk
        )
      : "";


  variableInput.value =
    observation.variable_name ||
    "";

  valueInput.value =
    hasValue(
      observation.value
    )
      ? String(
          observation.value
        )
      : "";

  unitInput.value =
    observation.unit ||
    "";

  aggregationInput.value =
    observation.aggregation ||
    "";

  periodStartInput.value =
    observation.period_start ||
    "";

  periodEndInput.value =
    observation.period_end ||
    "";

  dataSourceInput.value =
    observation.data_source ||
    "";

  notesInput.value =
    observation.notes ||
    "";


  formTitle.textContent =
    `Edit environmental observation #${observation.id}`;


  formMessage.hidden =
    true;

  actionMessage.hidden =
    true;

  formPanel.hidden =
    false;


  formPanel.scrollIntoView({
    behavior:
      "smooth",

    block:
      "start",
  });
}


function makeMetaItem(
  label,
  value
) {
  if (!hasValue(value)) {
    return null;
  }


  const item =
    document.createElement(
      "div"
    );

  item.className =
    "environment-record-meta-item";


  const labelElement =
    document.createElement(
      "strong"
    );

  labelElement.textContent =
    label;


  const valueElement =
    document.createElement(
      "span"
    );

  valueElement.textContent =
    String(value);


  item.append(
    labelElement,
    valueElement
  );


  return item;
}


function observationPeriod(
  observation
) {
  const start =
    String(
      observation.period_start ||
      ""
    ).trim();

  const end =
    String(
      observation.period_end ||
      ""
    ).trim();


  if (
    start &&
    end
  ) {
    return `${start} → ${end}`;
  }


  return (
    start ||
    end ||
    ""
  );
}


function renderObservation(
  observation
) {
  const article =
    document.createElement(
      "article"
    );

  article.className =
    "environment-record";


  const heading =
    document.createElement(
      "div"
    );

  heading.className =
    "environment-record-heading";


  const headingMain =
    document.createElement(
      "div"
    );


  const eyebrow =
    document.createElement(
      "div"
    );

  eyebrow.className =
    "environment-record-eyebrow";

  eyebrow.textContent =
    `Environmental observation · DB #${observation.id}`;


  const site =
    observation.sites ||
    {};


  const siteLink =
    document.createElement(
      "a"
    );

  siteLink.className =
    "environment-record-site";

  siteLink.href =
    `/sites/detail/?id=${encodeURIComponent(
      observation.site_fk
    )}`;


  siteLink.textContent =
    `${site.site_id || "Unknown Site"} — ` +
    `${site.site_label || "(Unnamed Site)"}`;


  headingMain.append(
    eyebrow,
    siteLink
  );


  const editButton =
    document.createElement(
      "button"
    );

  editButton.className =
    "button button-small";

  editButton.type =
    "button";

  editButton.textContent =
    "Edit";


  editButton.addEventListener(
    "click",
    () => {
      openEditForm(
        observation
      );
    }
  );


  heading.append(
    headingMain,
    editButton
  );


  const variable =
    document.createElement(
      "div"
    );

  variable.className =
    "environment-record-variable";

  variable.textContent =
    observation.variable_name ||
    "Environmental observation";


  const value =
    document.createElement(
      "div"
    );

  value.className =
    "environment-record-value";


  if (
    hasValue(
      observation.value
    )
  ) {
    value.textContent =
      `${observation.value} ${observation.unit || ""}`.trim();
  } else {
    value.textContent =
      "—";
  }


  const metadata =
    document.createElement(
      "div"
    );

  metadata.className =
    "environment-record-metadata";


  const metadataItems = [
    makeMetaItem(
      "Aggregation",
      observation.aggregation
    ),

    makeMetaItem(
      "Period",
      observationPeriod(
        observation
      )
    ),

    makeMetaItem(
      "Data source",
      observation.data_source
    ),
  ].filter(Boolean);


  for (
    const item
    of metadataItems
  ) {
    metadata.append(
      item
    );
  }


  const source =
    observation.sources ||
    {};


  if (
    source.source_code
  ) {
    const sourceRow =
      makeMetaItem(
        "Curator Source",
        `${String(
          source.source_code
        ).toUpperCase()} — ` +
        `${source.source_title || "(Untitled Source)"}`
      );


    if (sourceRow) {
      metadata.append(
        sourceRow
      );
    }
  }


  if (
    observation.notes
  ) {
    const notes =
      makeMetaItem(
        "Notes",
        observation.notes
      );


    if (notes) {
      notes.classList.add(
        "environment-record-notes"
      );

      metadata.append(
        notes
      );
    }
  }


  article.append(
    heading,
    variable,
    value
  );


  if (
    metadata.childElementCount >
    0
  ) {
    article.append(
      metadata
    );
  }


  listElement.append(
    article
  );
}


function renderObservations(
  payload
) {
  observations =
    Array.isArray(
      payload.observations
    )
      ? payload.observations
      : [];


  currentPage =
    Number(
      payload.page ||
      1
    );


  currentTotal =
    Number(
      payload.total ||
      0
    );


  currentTotalPages =
    Math.max(
      1,
      Number(
        payload.total_pages ||
        1
      )
    );


  listElement.replaceChildren();


  if (
    observations.length ===
    0
  ) {
    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "environment-empty";

    empty.textContent =
      searchInput.value.trim()
        ? "No environmental observations match the current search."
        : "No environmental observations have been added yet.";

    listElement.append(
      empty
    );

  } else {
    for (
      const observation
      of observations
    ) {
      renderObservation(
        observation
      );
    }
  }


  const firstRow =
    currentTotal === 0
      ? 0
      : (
          (
            currentPage - 1
          ) *
          currentPageSize
        ) + 1;


  const lastRow =
    Math.min(
      currentPage *
        currentPageSize,
      currentTotal
    );


  summaryElement.textContent =
    currentTotal === 0
      ? "0 observations"
      : (
          `Showing ${firstRow.toLocaleString()}–` +
          `${lastRow.toLocaleString()} of ` +
          `${currentTotal.toLocaleString()} observations`
        );


  pageLabel.textContent =
    `Page ${currentPage.toLocaleString()} ` +
    `of ${currentTotalPages.toLocaleString()}`;


  previousButton.disabled =
    currentPage <= 1;


  nextButton.disabled =
    currentPage >=
    currentTotalPages;


  statusElement.hidden =
    true;

  contentElement.hidden =
    false;
}


async function loadObservations() {
  statusElement.textContent =
    "Loading environmental observations…";

  statusElement.hidden =
    false;

  contentElement.hidden =
    true;


  const params =
    new URLSearchParams();


  params.set(
    "page",
    String(
      currentPage
    )
  );


  params.set(
    "page_size",
    String(
      currentPageSize
    )
  );


  const query =
    searchInput.value.trim();


  if (query) {
    params.set(
      "q",
      query
    );
  }


  try {
    const response =
      await fetch(
        `/api/environmental-observations?${params.toString()}`,
        {
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
      !payload.ok
    ) {
      throw new Error(
        payload.error ||
        `HTTP ${response.status}`
      );
    }


    renderObservations(
      payload
    );

  } catch (error) {
    console.error(
      "Unable to load environmental observations.",
      error
    );


    statusElement.textContent =
      error.message ||
      "Unable to load environmental observations.";

    statusElement.hidden =
      false;

    contentElement.hidden =
      true;
  }
}


function formPayload() {
  return {
    site_fk:
      siteInput.value,

    source_fk:
      sourceInput.value,

    variable_name:
      variableInput.value,

    value:
      valueInput.value,

    unit:
      unitInput.value,

    aggregation:
      aggregationInput.value,

    period_start:
      periodStartInput.value,

    period_end:
      periodEndInput.value,

    data_source:
      dataSourceInput.value,

    notes:
      notesInput.value,
  };
}


function validateForm() {
  if (
    !siteInput.value
  ) {
    return "Select a Site.";
  }


  if (
    !variableInput.value.trim()
  ) {
    return "Enter an environmental variable.";
  }


  if (
    valueInput.value.trim() ===
    "" ||
    !Number.isFinite(
      Number(
        valueInput.value
      )
    )
  ) {
    return "Enter a valid numeric value.";
  }


  if (
    !unitInput.value.trim()
  ) {
    return "Enter a unit.";
  }


  return "";
}


async function saveObservation() {
  const validationError =
    validateForm();


  if (validationError) {
    formMessage.textContent =
      validationError;

    formMessage.className =
      "save-message save-message-error";

    formMessage.hidden =
      false;

    return;
  }


  const creating =
    editingId === null;


  const endpoint =
    creating
      ? "/api/environmental-observations"
      : (
          `/api/environmental-observations/` +
          `${encodeURIComponent(
            editingId
          )}`
        );


  saveButton.disabled =
    true;

  cancelButton.disabled =
    true;

  newButton.disabled =
    true;


  saveButton.textContent =
    "Saving…";


  formMessage.hidden =
    true;


  try {
    const response =
      await fetch(
        endpoint,
        {
          method:
            creating
              ? "POST"
              : "PATCH",

          headers: {
            "content-type":
              "application/json",

            accept:
              "application/json",
          },

          body:
            JSON.stringify(
              formPayload()
            ),
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
        `HTTP ${response.status}`
      );
    }


    closeForm();


    actionMessage.textContent =
      creating
        ? "Environmental observation created."
        : "Environmental observation updated.";

    actionMessage.className =
      "save-message save-message-success";

    actionMessage.hidden =
      false;


    if (creating) {
      currentPage =
        1;
    }


    await loadObservations();

  } catch (error) {
    console.error(
      "Unable to save environmental observation.",
      error
    );


    formMessage.textContent =
      error.message ||
      "Unable to save environmental observation.";

    formMessage.className =
      "save-message save-message-error";

    formMessage.hidden =
      false;

  } finally {
    saveButton.disabled =
      false;

    cancelButton.disabled =
      false;

    newButton.disabled =
      false;

    saveButton.textContent =
      "Save observation";
  }
}


newButton.addEventListener(
  "click",
  openCreateForm
);


cancelButton.addEventListener(
  "click",
  closeForm
);


saveButton.addEventListener(
  "click",
  saveObservation
);


searchInput.addEventListener(
  "input",
  () => {
    clearTimeout(
      searchTimer
    );


    searchTimer =
      setTimeout(
        () => {
          currentPage =
            1;

          loadObservations();
        },
        250
      );
  }
);


pageSizeInput.addEventListener(
  "change",
  () => {
    currentPageSize =
      Number(
        pageSizeInput.value
      ) ||
      50;

    currentPage =
      1;

    loadObservations();
  }
);


previousButton.addEventListener(
  "click",
  () => {
    if (
      currentPage <= 1
    ) {
      return;
    }


    currentPage -=
      1;

    loadObservations();
  }
);


nextButton.addEventListener(
  "click",
  () => {
    if (
      currentPage >=
      currentTotalPages
    ) {
      return;
    }


    currentPage +=
      1;

    loadObservations();
  }
);


async function initialiseEnvironmentPage() {
  try {
    await loadOptions();
  } catch (error) {
    console.error(
      "Unable to load environmental form options.",
      error
    );


    newButton.disabled =
      true;

    actionMessage.textContent =
      error.message ||
      "Unable to load Site and Source options.";

    actionMessage.className =
      "save-message save-message-error";

    actionMessage.hidden =
      false;
  }


  await loadObservations();
}


initialiseEnvironmentPage();