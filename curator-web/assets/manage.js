const RECORD_TYPES =
  new Set([
    "sites",
    "sources",
    "links",
    "corrosion",
    "environmental",
  ]);


const RECORD_TYPE_LABELS = {
  sites:
    "Sites",

  sources:
    "Sources",

  links:
    "Evidence Links",

  corrosion:
    "Corrosion Observations",

  environmental:
    "Environmental Observations",
};


const tabs =
  [
    ...document.querySelectorAll(
      ".manage-tab"
    ),
  ];

const searchInput =
  document.getElementById(
    "manage-search"
  );

const pageSizeInput =
  document.getElementById(
    "manage-page-size"
  );

const statusElement =
  document.getElementById(
    "manage-status"
  );

const contentElement =
  document.getElementById(
    "manage-content"
  );

const summaryElement =
  document.getElementById(
    "manage-summary"
  );

const recordListElement =
  document.getElementById(
    "manage-record-list"
  );

const previousButton =
  document.getElementById(
    "manage-previous"
  );

const nextButton =
  document.getElementById(
    "manage-next"
  );

const pageLabel =
  document.getElementById(
    "manage-page-label"
  );

const selectVisibleButton =
  document.getElementById(
    "manage-select-visible"
  );

const deselectAllButton =
  document.getElementById(
    "manage-deselect-all"
  );

const selectedCountElement =
  document.getElementById(
    "manage-selected-count"
  );

const reviewDeleteButton =
  document.getElementById(
    "manage-review-delete"
  );

const deletePreviewElement =
  document.getElementById(
    "manage-delete-preview"
  );

const deletePreviewTitle =
  document.getElementById(
    "manage-delete-preview-title"
  );

const deletePreviewLines =
  document.getElementById(
    "manage-delete-preview-lines"
  );

const deletePreviewNote =
  document.getElementById(
    "manage-delete-preview-note"
  );

const confirmDeleteInput =
  document.getElementById(
    "manage-confirm-delete"
  );

const deleteConfirmedButton =
  document.getElementById(
    "manage-delete-confirmed"
  );

const actionMessage =
  document.getElementById(
    "manage-action-message"
  );

const bulkToolsElement =
  document.getElementById(
    "manage-bulk-tools"
  );

const bulkFieldInput =
  document.getElementById(
    "manage-bulk-field"
  );

const bulkValueInput =
  document.getElementById(
    "manage-bulk-value"
  );

const applyBulkUpdateButton =
  document.getElementById(
    "manage-apply-bulk-update"
  );

const bulkMessageElement =
  document.getElementById(
    "manage-bulk-message"
  );

const regionToolsElement =
  document.getElementById(
    "manage-region-tools"
  );

const previewRegionsButton =
  document.getElementById(
    "manage-preview-regions"
  );

const regionPreviewElement =
  document.getElementById(
    "manage-region-preview"
  );

const regionPreviewList =
  document.getElementById(
    "manage-region-preview-list"
  );

const applyRegionsButton =
  document.getElementById(
    "manage-apply-regions"
  );

const clearRegionsButton =
  document.getElementById(
    "manage-clear-regions"
  );

const regionMessageElement =
  document.getElementById(
    "manage-region-message"
  );

const initialParams =
  new URLSearchParams(
    window.location.search
  );

const requestedType =
  initialParams.get("type");


let currentType =
  RECORD_TYPES.has(requestedType)
    ? requestedType
    : "sites";

let currentPage =
  1;

let currentPageSize =
  50;

let currentTotal =
  0;

let currentTotalPages =
  1;

let searchTimer =
  null;

let currentRecords = [];

const selectedRecordIds =
  new Set();

let currentDeletePreview =
  null;

let currentRegionPreview = [];

const BULK_EDIT_FIELDS = {
  sites: [
    ["site_id", "Site ID"],
    ["site_label", "Site label"],
    ["latitude", "Latitude"],
    ["longitude", "Longitude"],
    [
      "modern_country_location",
      "Modern country / location",
    ],
    [
      "administering_country",
      "Administering country",
    ],
    ["former_entity", "Former entity"],
    ["region_category", "Region category"],
    ["exposure_period", "Exposure period"],
    ["metal", "Metal"],
    ["notes", "Notes"],
  ],

  sources: [
    ["source_code", "Source code"],
    ["source_kind", "Source kind"],
    ["source_type", "Source type"],
    ["source_title", "Source title"],
    [
      "authors_or_organization",
      "Authors / organization",
    ],
    ["publication_year", "Publication year"],
    ["doi", "DOI"],
    ["public_url", "Public URL"],
    ["display_citation", "Suggested citation"],
    ["public_notes", "Public notes"],
    ["programme", "Programme"],
    ["metals", "Metals"],
    ["exposure_periods", "Exposure periods"],
    ["source_url", "Source URL"],
    [
      "private_pdf_object_key",
      "Private PDF object key",
    ],
    ["notes", "Notes"],
  ],
};

function updateUrl() {
  const params =
    new URLSearchParams();

  params.set(
    "type",
    currentType
  );

  const query =
    searchInput.value.trim();

  if (query) {
    params.set(
      "q",
      query
    );
  }

  window.history.replaceState(
    null,
    "",
    `/manage/?${params.toString()}`
  );
}


function updateTabs() {
  for (const tab of tabs) {
    const selected =
      tab.dataset.recordType ===
      currentType;

    tab.classList.toggle(
      "manage-tab-active",
      selected
    );

    tab.setAttribute(
      "aria-selected",
      selected
        ? "true"
        : "false"
    );
  }
}


function createTextElement(
  className,
  text
) {
  const element =
    document.createElement(
      "div"
    );

  element.className =
    className;

  element.textContent =
    text || "";

  return element;
}

function invalidateDeletePreview() {
  currentDeletePreview =
    null;

  deletePreviewElement.hidden =
    true;

  confirmDeleteInput.checked =
    false;

  deleteConfirmedButton.disabled =
    true;
}


function updateSelectionUi() {
  const count =
    selectedRecordIds.size;

  selectedCountElement.textContent =
    `${count} selected`;

  reviewDeleteButton.disabled =
    count === 0;

  updateBulkTools();
}


function clearSelection() {
  selectedRecordIds.clear();

  invalidateDeletePreview();

  updateSelectionUi();

  for (
    const checkbox
    of document.querySelectorAll(
      ".manage-record-checkbox"
    )
  ) {
    checkbox.checked =
      false;
  }
}


function selectionChanged() {
  invalidateDeletePreview();

  clearRegionPreview();

  actionMessage.hidden =
    true;

  bulkMessageElement.hidden =
    true;

  updateSelectionUi();
}

function clearRegionPreview() {
  currentRegionPreview = [];

  regionPreviewList.replaceChildren();

  regionPreviewElement.hidden =
    true;

  regionMessageElement.hidden =
    true;
}


function populateBulkFields() {
  bulkFieldInput.replaceChildren();

  const fields =
    BULK_EDIT_FIELDS[
      currentType
    ] || [];


  for (
    const [
      value,
      label,
    ]
    of fields
  ) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      value;

    option.textContent =
      label;

    bulkFieldInput.append(
      option
    );
  }


  bulkValueInput.value =
    "";
}


function updateBulkTools() {
  const editable =
    currentType === "sites" ||
    currentType === "sources";


  bulkToolsElement.hidden =
    !editable;


  if (!editable) {
    regionToolsElement.hidden =
      true;

    return;
  }


  applyBulkUpdateButton.disabled =
    selectedRecordIds.size === 0;


  regionToolsElement.hidden =
    currentType !== "sites";


  previewRegionsButton.disabled =
    currentType !== "sites" ||
    selectedRecordIds.size === 0;
}

function renderRecord(
  record
) {
  const id =
    Number(record.id);


  const outer =
    document.createElement(
      "div"
    );

  outer.className =
    "manage-record manage-record-selectable";


  const checkbox =
    document.createElement(
      "input"
    );

  checkbox.type =
    "checkbox";

  checkbox.className =
    "manage-record-checkbox";

  checkbox.dataset.manageId =
    String(id);

  checkbox.checked =
    selectedRecordIds.has(
      id
    );


  checkbox.addEventListener(
    "change",
    () => {
      if (checkbox.checked) {
        selectedRecordIds.add(
          id
        );
      } else {
        selectedRecordIds.delete(
          id
        );
      }

      selectionChanged();
    }
  );


  const body =
    record.href
      ? document.createElement(
          "a"
        )
      : document.createElement(
          "div"
        );


  body.className =
    record.href
      ? "manage-record-body manage-record-body-link"
      : "manage-record-body";


  if (record.href) {
    body.href =
      record.href;
  }


  const eyebrow =
    createTextElement(
      "manage-record-eyebrow",
      record.eyebrow
    );

  const title =
    createTextElement(
      "manage-record-title",
      record.title
    );


  body.append(
    eyebrow,
    title
  );


  if (record.metadata) {
    body.append(
      createTextElement(
        "manage-record-meta",
        record.metadata
      )
    );
  }


  if (record.detail) {
    body.append(
      createTextElement(
        "manage-record-detail",
        record.detail
      )
    );
  }


  outer.append(
    checkbox,
    body
  );


  recordListElement.append(
    outer
  );
}

function renderPage(
  payload
) {
  recordListElement.replaceChildren();

  const records =
    Array.isArray(
      payload.records
    )
      ? payload.records
      : [];
    
    currentRecords =
        records;

  currentTotal =
    Number(
      payload.total || 0
    );

  currentTotalPages =
    Math.max(
      1,
      Number(
        payload.total_pages || 1
      )
    );

  currentPage =
    Number(
      payload.page || 1
    );


  if (
    records.length === 0
  ) {
    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "manage-empty";

    empty.textContent =
      searchInput.value.trim()
        ? "No records match the current search."
        : "No records are available.";

    recordListElement.append(
      empty
    );
  } else {
    for (const record of records) {
      renderRecord(
        record
      );
    }
  }


  const firstRow =
    currentTotal === 0
      ? 0
      : (
          (currentPage - 1) *
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
      ? `0 ${RECORD_TYPE_LABELS[currentType]}`
      : `Showing ${firstRow}–${lastRow} of ${currentTotal.toLocaleString()} records`;


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

  updateSelectionUi();

}


async function loadRecords() {
  statusElement.textContent =
    "Loading records…";

  statusElement.hidden =
    false;

  contentElement.hidden =
    true;


  const params =
    new URLSearchParams({
      type:
        currentType,

      page:
        String(
          currentPage
        ),

      page_size:
        String(
          currentPageSize
        ),
    });


  const query =
    searchInput.value.trim();

  if (query) {
    params.set(
      "q",
      query
    );
  }


  updateUrl();


  try {
    const response =
      await fetch(
        `/api/manage-records?${params.toString()}`,
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


    /*
     * If records were deleted elsewhere while
     * sitting on a later page, move back to the
     * final valid page automatically.
     */
    if (
      payload.total_pages &&
      currentPage >
        payload.total_pages
    ) {
      currentPage =
        payload.total_pages;

      await loadRecords();

      return;
    }


    renderPage(
      payload
    );
  } catch (error) {
    console.error(
      "Unable to load managed records.",
      error
    );

    statusElement.textContent =
      error.message ||
      "Unable to load records.";

    statusElement.hidden =
      false;
  }
}


function switchType(
  type
) {
  if (
    !RECORD_TYPES.has(type)
  ) {
    return;
  }

  clearSelection();

  currentType =
    type;

  currentPage =
    1;

  clearRegionPreview();

  populateBulkFields();

  updateTabs();

  loadRecords();
}


function selectVisibleRecords() {
  for (
    const record
    of currentRecords
  ) {
    selectedRecordIds.add(
      Number(record.id)
    );
  }


  for (
    const checkbox
    of document.querySelectorAll(
      ".manage-record-checkbox"
    )
  ) {
    checkbox.checked =
      true;
  }


  selectionChanged();
}


function renderDeletePreview(
  payload
) {
  currentDeletePreview =
    payload;


  deletePreviewTitle.textContent =
    payload.title ||
    "Deletion preview";


  deletePreviewLines.replaceChildren();


  for (
    const consequence
    of payload.consequences || []
  ) {
    const row =
      document.createElement(
        "div"
      );

    row.className =
      "manage-delete-preview-line";


    const label =
      document.createElement(
        "span"
      );

    label.textContent =
      consequence.label || "";


    const value =
      document.createElement(
        "strong"
      );

    value.textContent =
      Number(
        consequence.count || 0
      ).toLocaleString();


    row.append(
      label,
      value
    );

    deletePreviewLines.append(
      row
    );
  }


  deletePreviewNote.textContent =
    payload.note || "";


  confirmDeleteInput.checked =
    false;

  deleteConfirmedButton.disabled =
    true;

  deletePreviewElement.hidden =
    false;
}


async function reviewDeletion() {
  if (
    selectedRecordIds.size === 0
  ) {
    return;
  }


  reviewDeleteButton.disabled =
    true;

  reviewDeleteButton.textContent =
    "Checking…";

  actionMessage.hidden =
    true;


  try {
    const response =
      await fetch(
        "/api/manage-delete-preview",
        {
          method:
            "POST",

          headers: {
            "content-type":
              "application/json",

            accept:
              "application/json",
          },

          body:
            JSON.stringify({
              type:
                currentType,

              ids:
                [
                  ...selectedRecordIds,
                ],
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
        `HTTP ${response.status}`
      );
    }


    renderDeletePreview(
      payload
    );
  } catch (error) {
    console.error(
      "Unable to preview deletion.",
      error
    );


    actionMessage.textContent =
      error.message ||
      "Unable to preview deletion.";

    actionMessage.className =
      "save-message save-message-error";

    actionMessage.hidden =
      false;
  } finally {
    reviewDeleteButton.disabled =
      selectedRecordIds.size === 0;

    reviewDeleteButton.textContent =
      "Review deletion";
  }
}


async function deleteSelectedRecords() {
  if (
    !currentDeletePreview ||
    selectedRecordIds.size === 0
  ) {
    return;
  }


  if (
    !confirmDeleteInput.checked
  ) {
    return;
  }


  deleteConfirmedButton.disabled =
    true;

  deleteConfirmedButton.textContent =
    "Deleting…";

  actionMessage.hidden =
    true;


  const selectedIds =
    [
      ...selectedRecordIds,
    ];


  try {
    const response =
      await fetch(
        "/api/manage-records",
        {
          method:
            "DELETE",

          headers: {
            "content-type":
              "application/json",

            accept:
              "application/json",
          },

          body:
            JSON.stringify({
              type:
                currentType,

              ids:
                selectedIds,

              confirmed:
                true,
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
        `HTTP ${response.status}`
      );
    }


    clearSelection();

    await loadRecords();


    actionMessage.textContent =
      `Deleted ${payload.deleted_count} ` +
      `record` +
      `${payload.deleted_count === 1 ? "" : "s"}.`;

    actionMessage.className =
      "save-message save-message-success";

    actionMessage.hidden =
      false;
  } catch (error) {
    console.error(
      "Unable to delete records.",
      error
    );


    actionMessage.textContent =
      error.message ||
      "Unable to delete selected records.";

    actionMessage.className =
      "save-message save-message-error";

    actionMessage.hidden =
      false;
  } finally {
    deleteConfirmedButton.disabled =
      !confirmDeleteInput.checked;

    deleteConfirmedButton.textContent =
      "Delete selected records";
  }
}

async function applyBulkUpdate() {
  if (
    ![
      "sites",
      "sources",
    ].includes(
      currentType
    )
  ) {
    return;
  }


  if (
    selectedRecordIds.size === 0
  ) {
    return;
  }


  const field =
    bulkFieldInput.value;

  const value =
    bulkValueInput.value;


  if (!field) {
    return;
  }


  applyBulkUpdateButton.disabled =
    true;

  applyBulkUpdateButton.textContent =
    "Updating…";

  bulkMessageElement.hidden =
    true;


  try {
    const response =
      await fetch(
        "/api/manage-bulk-update",
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
              type:
                currentType,

              ids:
                [
                  ...selectedRecordIds,
                ],

              field,

              value,
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
        `HTTP ${response.status}`
      );
    }


    const changedCount =
      payload.updated_count || 0;


    clearSelection();

    await loadRecords();


    bulkMessageElement.textContent =
      `Updated ${changedCount} ` +
      `record` +
      `${changedCount === 1 ? "" : "s"}.`;

    bulkMessageElement.className =
      "save-message save-message-success";

    bulkMessageElement.hidden =
      false;
  } catch (error) {
    console.error(
      "Bulk update failed.",
      error
    );


    bulkMessageElement.textContent =
      error.message ||
      "Unable to apply bulk update.";

    bulkMessageElement.className =
      "save-message save-message-error";

    bulkMessageElement.hidden =
      false;
  } finally {
    applyBulkUpdateButton.disabled =
      selectedRecordIds.size === 0;

    applyBulkUpdateButton.textContent =
      "Apply bulk update";
  }
}

async function classifySelectedSite(
  record
) {
  const data =
    record.data || {};


  const response =
    await fetch(
      "/api/region-classification",
      {
        method:
          "POST",

        headers: {
          "content-type":
            "application/json",

          accept:
            "application/json",
        },

        body:
          JSON.stringify({
            latitude:
              data.latitude,

            longitude:
              data.longitude,

            current_region_category:
              data.region_category || "",

            modern_country_location:
              data.modern_country_location || "",

            site_type:
              data.site_type || "",
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
      "Unable to classify Site."
    );
  }


  return {
    id:
      Number(record.id),

    site_id:
      data.site_id || "",

    site_label:
      data.site_label || "",

    current_region_category:
      data.region_category || "",

    suggested_region_category:
      payload.region_category || "",

    notes:
      payload.notes || "",

    apply:
      true,
  };
}


async function mapWithConcurrency(
  items,
  concurrency,
  worker,
  progress
) {
  const results =
    new Array(
      items.length
    );

  let nextIndex = 0;
  let completed = 0;


  async function run() {
    while (true) {
      const index =
        nextIndex++;

      if (
        index >=
        items.length
      ) {
        return;
      }


      results[index] =
        await worker(
          items[index]
        );


      completed += 1;

      progress(
        completed,
        items.length
      );
    }
  }


  const runnerCount =
    Math.min(
      concurrency,
      items.length
    );


  await Promise.all(
    Array.from(
      {
        length:
          runnerCount,
      },
      run
    )
  );


  return results;
}


function renderRegionPreview() {
  regionPreviewList.replaceChildren();


  for (
    const item
    of currentRegionPreview
  ) {
    const row =
      document.createElement(
        "div"
      );

    row.className =
      "manage-region-preview-row";


    const applyLabel =
      document.createElement(
        "label"
      );

    applyLabel.className =
      "manage-region-apply";


    const checkbox =
      document.createElement(
        "input"
      );

    checkbox.type =
      "checkbox";

    checkbox.checked =
      item.apply !== false;


    checkbox.addEventListener(
      "change",
      () => {
        item.apply =
          checkbox.checked;
      }
    );


    applyLabel.append(
      checkbox
    );


    const body =
      document.createElement(
        "div"
      );

    body.className =
      "manage-region-preview-body";


    const title =
      document.createElement(
        "div"
      );

    title.className =
      "manage-region-preview-title";

    title.textContent =
      `${item.site_id || "Site"} — ` +
      `${item.site_label || "(Unnamed Site)"}`;


    const current =
      document.createElement(
        "div"
      );

    current.className =
      "manage-region-current";

    current.textContent =
      `Current: ` +
      `${item.current_region_category || "—"}`;


    const suggestedLabel =
      document.createElement(
        "label"
      );

    suggestedLabel.className =
      "manage-region-suggested";

    suggestedLabel.textContent =
      "Suggested region category";


    const suggestedInput =
      document.createElement(
        "input"
      );

    suggestedInput.type =
      "text";

    suggestedInput.className =
      "detail-input";

    suggestedInput.value =
      item.suggested_region_category ||
      "";


    suggestedInput.addEventListener(
      "input",
      () => {
        item.suggested_region_category =
          suggestedInput.value;
      }
    );


    const notes =
      document.createElement(
        "div"
      );

    notes.className =
      "manage-region-notes";

    notes.textContent =
      item.notes || "";


    suggestedLabel.append(
      suggestedInput
    );


    body.append(
      title,
      current,
      suggestedLabel,
      notes
    );


    row.append(
      applyLabel,
      body
    );


    regionPreviewList.append(
      row
    );
  }


  regionPreviewElement.hidden =
    currentRegionPreview.length === 0;
}


async function previewRegionClassifications() {
  if (
    currentType !== "sites" ||
    selectedRecordIds.size === 0
  ) {
    return;
  }


  const selected =
    currentRecords.filter(
      (record) =>
        selectedRecordIds.has(
          Number(record.id)
        )
    );


  if (!selected.length) {
    return;
  }


  previewRegionsButton.disabled =
    true;

  regionMessageElement.hidden =
    true;

  clearRegionPreview();


  try {
    currentRegionPreview =
      await mapWithConcurrency(
        selected,
        6,
        classifySelectedSite,
        (
          completed,
          total
        ) => {
          previewRegionsButton.textContent =
            `Classifying ${completed}/${total}…`;
        }
      );


    renderRegionPreview();
  } catch (error) {
    console.error(
      "Region preview failed.",
      error
    );


    currentRegionPreview = [];


    regionMessageElement.textContent =
      error.message ||
      "Unable to build region-classification preview.";

    regionMessageElement.className =
      "save-message save-message-error";

    regionMessageElement.hidden =
      false;
  } finally {
    previewRegionsButton.textContent =
      "Preview classifications";

    previewRegionsButton.disabled =
      selectedRecordIds.size === 0;
  }
}

async function applyRegionClassifications() {
  const updates =
    currentRegionPreview
      .filter(
        (item) =>
          item.apply !== false
      )
      .map(
        (item) => ({
          id:
            Number(item.id),

          region_category:
            String(
              item.suggested_region_category ||
              ""
            ).trim(),
        })
      )
      .filter(
        (item) =>
          item.id > 0 &&
          item.region_category
      );


  if (!updates.length) {
    regionMessageElement.textContent =
      "No classifications are selected to apply.";

    regionMessageElement.className =
      "save-message save-message-error";

    regionMessageElement.hidden =
      false;

    return;
  }


  applyRegionsButton.disabled =
    true;

  applyRegionsButton.textContent =
    "Applying…";


  try {
    const response =
      await fetch(
        "/api/manage-region-apply",
        {
          method:
            "POST",

          headers: {
            "content-type":
              "application/json",

            accept:
              "application/json",
          },

          body:
            JSON.stringify({
              updates,
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
        `HTTP ${response.status}`
      );
    }


    const updatedCount =
      payload.updated_count || 0;


    clearRegionPreview();

    clearSelection();

    await loadRecords();


    regionMessageElement.textContent =
      `Updated region classification for ` +
      `${updatedCount} Site` +
      `${updatedCount === 1 ? "" : "s"}.`;

    regionMessageElement.className =
      "save-message save-message-success";

    regionMessageElement.hidden =
      false;
  } catch (error) {
    console.error(
      "Unable to apply region classifications.",
      error
    );


    regionMessageElement.textContent =
      error.message ||
      "Unable to apply classifications.";

    regionMessageElement.className =
      "save-message save-message-error";

    regionMessageElement.hidden =
      false;
  } finally {
    applyRegionsButton.disabled =
      false;

    applyRegionsButton.textContent =
      "Apply selected classifications";
  }
}

for (const tab of tabs) {
  tab.addEventListener(
    "click",
    () => {
      switchType(
        tab.dataset.recordType
      );
    }
  );
}


searchInput.addEventListener(
  "input",
  () => {
    clearTimeout(
      searchTimer
    );

    searchTimer =
        setTimeout(
            () => {
                clearSelection();

                currentPage =
                1;

                loadRecords();
            },
            350
            );
  }
);


pageSizeInput.addEventListener(
  "change",
  () => {
    
    clearSelection();

    currentPageSize =
      Number(
        pageSizeInput.value
      );

    currentPage =
      1;

    loadRecords();
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

    clearSelection();

    currentPage -= 1;

    loadRecords();
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

    clearSelection();

    currentPage += 1;

    loadRecords();
  }
);

selectVisibleButton.addEventListener(
  "click",
  selectVisibleRecords
);


deselectAllButton.addEventListener(
  "click",
  clearSelection
);


reviewDeleteButton.addEventListener(
  "click",
  reviewDeletion
);


confirmDeleteInput.addEventListener(
  "change",
  () => {
    deleteConfirmedButton.disabled =
      !confirmDeleteInput.checked;
  }
);


deleteConfirmedButton.addEventListener(
  "click",
  deleteSelectedRecords
);

applyBulkUpdateButton.addEventListener(
  "click",
  applyBulkUpdate
);


previewRegionsButton.addEventListener(
  "click",
  previewRegionClassifications
);


applyRegionsButton.addEventListener(
  "click",
  applyRegionClassifications
);


clearRegionsButton.addEventListener(
  "click",
  clearRegionPreview
);

const initialQuery =
  initialParams.get("q");

if (initialQuery) {
  searchInput.value =
    initialQuery;
}

populateBulkFields();
updateBulkTools();

updateTabs();
loadRecords();