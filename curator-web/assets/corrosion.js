const workbookStatus =
  document.getElementById(
    "corrosion-workbook-status"
  );

const workbookContent =
  document.getElementById(
    "corrosion-workbook-content"
  );

const workbookSource =
  document.getElementById(
    "corrosion-workbook-source"
  );

const workbookSourceContext =
  document.getElementById(
    "corrosion-workbook-source-context"
  );


const searchInput =
  document.getElementById(
    "corrosion-search"
  );

const pageSizeInput =
  document.getElementById(
    "corrosion-page-size"
  );

const statusElement =
  document.getElementById(
    "corrosion-status"
  );

const contentElement =
  document.getElementById(
    "corrosion-content"
  );

const summaryElement =
  document.getElementById(
    "corrosion-summary"
  );

const listElement =
  document.getElementById(
    "corrosion-list"
  );

const previousButton =
  document.getElementById(
    "corrosion-previous"
  );

const nextButton =
  document.getElementById(
    "corrosion-next"
  );

const pageLabel =
  document.getElementById(
    "corrosion-page-label"
  );

const generateWorkbookButton =
  document.getElementById(
    "corrosion-generate-workbook"
  );

const workbookMessage =
  document.getElementById(
    "corrosion-workbook-message"
  );

const chooseWorkbookButton =
  document.getElementById(
    "corrosion-choose-workbook"
  );

const workbookUploadInput =
  document.getElementById(
    "corrosion-workbook-upload"
  );

const uploadFileName =
  document.getElementById(
    "corrosion-upload-file-name"
  );

const importStatus =
  document.getElementById(
    "corrosion-import-status"
  );

const importPreview =
  document.getElementById(
    "corrosion-import-preview"
  );

const previewReady =
  document.getElementById(
    "corrosion-preview-ready"
  );

const previewErrors =
  document.getElementById(
    "corrosion-preview-errors"
  );

const previewCreate =
  document.getElementById(
    "corrosion-preview-create"
  );

const previewUpdate =
  document.getElementById(
    "corrosion-preview-update"
  );

const previewMessage =
  document.getElementById(
    "corrosion-preview-message"
  );

const previewBody =
  document.getElementById(
    "corrosion-preview-body"
  );

const importConfirm =
  document.getElementById(
    "corrosion-import-confirm"
  );

const importConfirmCheckbox =
  document.getElementById(
    "corrosion-import-confirm-checkbox"
  );

const importButton =
  document.getElementById(
    "corrosion-import-button"
  );

const importResult =
  document.getElementById(
    "corrosion-import-result"
  );


let currentWorkbookFile =
  null;

let currentPreviewSummary =
  null;

let workbookSources = [];

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


function formatNumber(
  value
) {
  if (!hasValue(value)) {
    return "—";
  }

  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return String(value);
  }

  return number.toLocaleString(
    undefined,
    {
      maximumSignificantDigits:
        8,
    }
  );
}


function addDetailRow(
  container,
  label,
  value
) {
  if (!hasValue(value)) {
    return;
  }


  const row =
    document.createElement(
      "div"
    );

  row.className =
    "corrosion-detail-row";


  const labelElement =
    document.createElement(
      "div"
    );

  labelElement.className =
    "corrosion-detail-label";

  labelElement.textContent =
    label;


  const valueElement =
    document.createElement(
      "div"
    );

  valueElement.className =
    "corrosion-detail-value";

  valueElement.textContent =
    String(value);


  row.append(
    labelElement,
    valueElement
  );

  container.append(
    row
  );
}


function buildExposureWindow(
  observation
) {
  const start =
    String(
      observation.exposure_start ||
      ""
    ).trim();

  const end =
    String(
      observation.exposure_end ||
      ""
    ).trim();


  if (
    start &&
    end
  ) {
    return `${start} → ${end}`;
  }


  if (start) {
    return `From ${start}`;
  }


  if (end) {
    return `Until ${end}`;
  }


  return "";
}


function renderObservation(
  observation
) {
  const article =
    document.createElement(
      "article"
    );

  article.className =
    "corrosion-record";


  const heading =
    document.createElement(
      "div"
    );

  heading.className =
    "corrosion-record-heading";


  const location =
    document.createElement(
      "div"
    );

  location.className =
    "corrosion-record-location";


  const siteLink =
    document.createElement(
      "a"
    );

  siteLink.href =
    `/sites/detail/?id=${encodeURIComponent(
      observation.site_fk
    )}`;

  siteLink.className =
    "corrosion-record-link";

  siteLink.textContent =
    `${observation.site_id || "Unknown Site"} — ` +
    `${observation.site_label || "(Unnamed Site)"}`;


  const separator =
    document.createElement(
      "span"
    );

  separator.className =
    "corrosion-record-separator";

  separator.textContent =
    "·";


  const sourceLink =
    document.createElement(
      "a"
    );

  sourceLink.href =
    `/sources/detail/?id=${encodeURIComponent(
      observation.source_fk
    )}`;

  sourceLink.className =
    "corrosion-record-link";

  sourceLink.textContent =
    String(
      observation.source_code ||
      "Unknown Source"
    ).toUpperCase();


  location.append(
    siteLink,
    separator,
    sourceLink
  );


  const recordId =
    document.createElement(
      "div"
    );

  recordId.className =
    "corrosion-record-id";

  recordId.textContent =
    `Observation #${observation.id}`;


  heading.append(
    location,
    recordId
  );


  const title =
    document.createElement(
      "div"
    );

  title.className =
    "corrosion-record-title";

  title.textContent =
    [
      observation.material,
      observation.exposure_period,
    ]
      .filter(Boolean)
      .join(" · ") ||
    "Corrosion observation";


  const exposureWindow =
    buildExposureWindow(
      observation
    );


  const meta =
    document.createElement(
      "div"
    );

  meta.className =
    "corrosion-record-meta";

  meta.textContent =
    [
      observation.modern_country_location,
      observation.corrosion_metric,
      exposureWindow,
    ]
      .filter(Boolean)
      .join(" · ");


  const values =
    document.createElement(
      "div"
    );

  values.className =
    "corrosion-values";


  const reported =
    document.createElement(
      "div"
    );

  reported.className =
    "corrosion-value-block";


  const reportedLabel =
    document.createElement(
      "div"
    );

  reportedLabel.className =
    "corrosion-value-label";

  reportedLabel.textContent =
    "Reported";


  const reportedValue =
    document.createElement(
      "div"
    );

  reportedValue.className =
    "corrosion-value-main";

  reportedValue.textContent =
    hasValue(
      observation.value
    )
      ? `${formatNumber(
          observation.value
        )} ${observation.unit || ""}`.trim()
      : "—";


  reported.append(
    reportedLabel,
    reportedValue
  );


  const canonicalThickness =
    document.createElement(
      "div"
    );

  canonicalThickness.className =
    "corrosion-value-block";


  const thicknessLabel =
    document.createElement(
      "div"
    );

  thicknessLabel.className =
    "corrosion-value-label";

  thicknessLabel.textContent =
    "Canonical thickness-loss rate";


  const thicknessValue =
    document.createElement(
      "div"
    );

  thicknessValue.className =
    "corrosion-value-main";

  thicknessValue.textContent =
    hasValue(
      observation
        .canonical_thickness_loss_rate_um_year
    )
      ? `${formatNumber(
          observation
            .canonical_thickness_loss_rate_um_year
        )} µm/year`
      : "—";


  canonicalThickness.append(
    thicknessLabel,
    thicknessValue
  );


  const canonicalMass =
    document.createElement(
      "div"
    );

  canonicalMass.className =
    "corrosion-value-block";


  const massLabel =
    document.createElement(
      "div"
    );

  massLabel.className =
    "corrosion-value-label";

  massLabel.textContent =
    "Canonical mass-loss rate";


  const massValue =
    document.createElement(
      "div"
    );

  massValue.className =
    "corrosion-value-main";

  massValue.textContent =
    hasValue(
      observation
        .canonical_mass_loss_rate_g_m2_year
    )
      ? `${formatNumber(
          observation
            .canonical_mass_loss_rate_g_m2_year
        )} g/m²/year`
      : "—";


  canonicalMass.append(
    massLabel,
    massValue
  );


  values.append(
    reported,
    canonicalThickness,
    canonicalMass
  );


  const details =
    document.createElement(
      "details"
    );

  details.className =
    "corrosion-details";


  const summary =
    document.createElement(
      "summary"
    );

  summary.textContent =
    "Observation details";


  const detailGrid =
    document.createElement(
      "div"
    );

  detailGrid.className =
    "corrosion-detail-grid";


  addDetailRow(
    detailGrid,
    "Material",
    observation.material
  );

  addDetailRow(
    detailGrid,
    "Exposure period",
    observation.exposure_period
  );

  addDetailRow(
    detailGrid,
    "Exposure start",
    observation.exposure_start
  );

  addDetailRow(
    detailGrid,
    "Exposure end",
    observation.exposure_end
  );

  addDetailRow(
    detailGrid,
    "Corrosion metric",
    observation.corrosion_metric
  );

  addDetailRow(
    detailGrid,
    "Reported value",
    hasValue(
      observation.value
    )
      ? formatNumber(
          observation.value
        )
      : ""
  );

  addDetailRow(
    detailGrid,
    "Reported unit",
    observation.unit
  );

  addDetailRow(
    detailGrid,
    "Density used",
    hasValue(
      observation.density_g_cm3
    )
      ? `${formatNumber(
          observation.density_g_cm3
        )} g/cm³`
      : ""
  );

  addDetailRow(
    detailGrid,
    "Density basis",
    observation.density_basis
  );

  addDetailRow(
    detailGrid,
    "Measurement method",
    observation.measurement_method
  );

  addDetailRow(
    detailGrid,
    "Specimen condition",
    observation.specimen_condition
  );

  addDetailRow(
    detailGrid,
    "Exposure condition",
    observation.exposure_condition
  );

  addDetailRow(
    detailGrid,
    "Normalization note",
    observation.normalization_note
  );

  addDetailRow(
    detailGrid,
    "Notes",
    observation.notes
  );


  details.append(
    summary,
    detailGrid
  );


  article.append(
    heading,
    title
  );


  if (meta.textContent) {
    article.append(
      meta
    );
  }


  article.append(
    values,
    details
  );


  listElement.append(
    article
  );
}


function renderObservationPage(
  payload
) {
  listElement.replaceChildren();


  const observations =
    Array.isArray(
      payload.observations
    )
      ? payload.observations
      : [];


  currentPage =
    Number(
      payload.page || 1
    );

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


  if (
    observations.length === 0
  ) {
    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "corrosion-empty";

    empty.textContent =
      searchInput.value.trim()
        ? "No corrosion observations match the current search."
        : "No corrosion observations have been added yet.";

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
      ? "0 corrosion observations"
      : `Showing ${firstRow.toLocaleString()}–` +
        `${lastRow.toLocaleString()} of ` +
        `${currentTotal.toLocaleString()} observations`;


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


function updateObservationUrl() {
  const params =
    new URLSearchParams();


  const query =
    searchInput.value.trim();


  if (query) {
    params.set(
      "q",
      query
    );
  }


  if (
    currentPage > 1
  ) {
    params.set(
      "page",
      String(
        currentPage
      )
    );
  }


  const queryString =
    params.toString();


  window.history.replaceState(
    null,
    "",
    queryString
      ? `/corrosion/?${queryString}`
      : "/corrosion/"
  );
}


async function loadObservations() {
  statusElement.textContent =
    "Loading corrosion observations…";

  statusElement.hidden =
    false;

  contentElement.hidden =
    true;


  const params =
    new URLSearchParams({
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


  updateObservationUrl();


  try {
    const response =
      await fetch(
        `/api/corrosion-observations?${params.toString()}`,
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


    if (
      payload.total_pages &&
      currentPage >
        payload.total_pages
    ) {
      currentPage =
        payload.total_pages;

      await loadObservations();

      return;
    }


    renderObservationPage(
      payload
    );
  } catch (error) {
    console.error(
      "Unable to load corrosion observations.",
      error
    );


    statusElement.textContent =
      error.message ||
      "Unable to load corrosion observations.";

    statusElement.hidden =
      false;
  }
}


function renderWorkbookSourceContext() {
  const sourceId =
    Number(
      workbookSource.value
    );
  const source =
    workbookSources.find(
      (item) =>
        Number(item.id) ===
        sourceId
    );

  workbookSourceContext.replaceChildren();

  if (!source) {
    generateWorkbookButton.disabled =
      true;

    workbookSourceContext.hidden =
      true;

    return;
  }


  generateWorkbookButton.disabled =
    false;


  const title =
    document.createElement(
      "div"
    );

  title.className =
    "corrosion-source-title";

  title.textContent =
    `${String(
      source.source_code || ""
    ).toUpperCase()} — ` +
    `${source.source_title || "(Untitled Source)"}`;


  const metadata =
    document.createElement(
      "div"
    );

  metadata.className =
    "corrosion-source-meta";

  metadata.textContent =
    [
      source.programme,
      source.has_private_pdf
        ? "Private PDF available"
        : "No private PDF attached",
    ]
      .filter(Boolean)
      .join(" · ");


  const actions =
    document.createElement(
      "div"
    );

  actions.className =
    "corrosion-source-actions";


  const sourceLink =
    document.createElement(
      "a"
    );

  sourceLink.className =
    "button button-small";

  sourceLink.href =
    `/sources/detail/?id=${encodeURIComponent(
      source.id
    )}`;

  sourceLink.textContent =
    "Open Source";


  actions.append(
    sourceLink
  );


  if (
    source.has_private_pdf
  ) {
    const pdfLink =
      document.createElement(
        "a"
      );

    pdfLink.className =
      "button button-small";

    pdfLink.href =
      `/api/sources/${encodeURIComponent(
        source.id
      )}/pdf`;

    pdfLink.target =
      "_blank";

    pdfLink.rel =
      "noopener";

    pdfLink.textContent =
      "Open PDF";


    actions.append(
      pdfLink
    );
  }


  workbookSourceContext.append(
    title
  );


  if (
    metadata.textContent
  ) {
    workbookSourceContext.append(
      metadata
    );
  }


  workbookSourceContext.append(
    actions
  );


  workbookSourceContext.hidden =
    false;
}


async function loadWorkbookSources() {
  workbookStatus.textContent =
    "Loading Sources…";

  workbookStatus.hidden =
    false;

  workbookContent.hidden =
    true;


  try {
    const response =
      await fetch(
        "/api/corrosion-workbook-sources",
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


    workbookSources =
      Array.isArray(
        payload.sources
      )
        ? payload.sources
        : [];


    workbookSource.replaceChildren();


    if (
      workbookSources.length === 0
    ) {
      workbookStatus.textContent =
        "No Source with linked Sites is available yet. " +
        "Create Site–Source evidence links before generating " +
        "a corrosion workbook.";

      workbookStatus.hidden =
        false;

      workbookContent.hidden =
        true;

      return;
    }


    for (
      const source
      of workbookSources
    ) {
      const option =
        document.createElement(
          "option"
        );

      option.value =
        String(
          source.id
        );

      option.textContent =
        `${String(
          source.source_code || ""
        ).toUpperCase()} — ` +
        `${source.source_title || "(Untitled Source)"}`;


      workbookSource.append(
        option
      );
    }


    workbookStatus.hidden =
      true;

    workbookContent.hidden =
      false;


    renderWorkbookSourceContext();
  } catch (error) {
    console.error(
      "Unable to load workbook Sources.",
      error
    );


    workbookStatus.textContent =
      error.message ||
      "Unable to load workbook Sources.";

    workbookStatus.hidden =
      false;
  }
}


workbookSource.addEventListener(
  "change",
  renderWorkbookSourceContext
);

generateWorkbookButton.addEventListener(
  "click",
  async () => {
    const sourceId =
      Number(
        workbookSource.value
      );


    if (
      !Number.isInteger(sourceId) ||
      sourceId <= 0
    ) {
      return;
    }


    generateWorkbookButton.disabled =
      true;

    generateWorkbookButton.textContent =
      "Generating…";

    workbookMessage.textContent =
      "Building macro-enabled workbook…";


    try {
      const response =
        await fetch(
          `/api/corrosion-workbook?source_id=${encodeURIComponent(
            sourceId
          )}`,
          {
            headers: {
              accept:
                "application/vnd.ms-excel.sheet.macroEnabled.12, application/json",
            },
          }
        );


      if (!response.ok) {
        let message =
          `HTTP ${response.status}`;

        try {
          const payload =
            await response.json();

          if (payload.error) {
            message =
              payload.error;
          }
        } catch {
          // Non-JSON error response.
        }

        throw new Error(
          message
        );
      }


      const blob =
        await response.blob();


      let fileName =
        "corrosion_observations.xlsm";


      const disposition =
        response.headers.get(
          "content-disposition"
        ) || "";


      const nameMatch =
        disposition.match(
          /filename="([^"]+)"/i
        );


      if (nameMatch) {
        fileName =
          nameMatch[1];
      }


      const downloadUrl =
        URL.createObjectURL(
          blob
        );


      const anchor =
        document.createElement(
          "a"
        );

      anchor.href =
        downloadUrl;

      anchor.download =
        fileName;

      document.body.append(
        anchor
      );

      anchor.click();
      anchor.remove();


      setTimeout(
        () => {
          URL.revokeObjectURL(
            downloadUrl
          );
        },
        1000
      );


      const siteCount =
        response.headers.get(
          "x-corrosion-linked-sites"
        );

      const observationCount =
        response.headers.get(
          "x-corrosion-existing-observations"
        );


      workbookMessage.textContent =
        `${siteCount || "—"} linked Site(s) · ` +
        `${observationCount || "—"} existing observation(s) · ` +
        `1 starter row per Site.`;

    } catch (error) {
      console.error(
        "Unable to generate corrosion workbook.",
        error
      );


      workbookMessage.textContent =
        error.message ||
        "Unable to generate corrosion workbook.";

    } finally {
      generateWorkbookButton.disabled =
        false;

      generateWorkbookButton.textContent =
        "Generate XLSM";
    }
  }
);

function appendPreviewCell(
  row,
  value
) {
  const cell =
    document.createElement(
      "td"
    );

  cell.textContent =
    value === null ||
    value === undefined ||
    String(value).trim() === ""
      ? "—"
      : String(value);

  row.append(
    cell
  );
}


function renderCorrosionPreview(
  payload
) {
  const preview =
    Array.isArray(
      payload.preview
    )
      ? payload.preview
      : [];

  const summary =
    payload.summary ||
    {};

  currentPreviewSummary =
    summary;


  importConfirmCheckbox.checked =
    false;

  importButton.disabled =
    true;

  importResult.hidden =
    true;


  previewReady.textContent =
    String(
      summary.ready ||
      0
    );

  previewErrors.textContent =
    String(
      summary.errors ||
      0
    );

  previewCreate.textContent =
    String(
      summary.create ||
      0
    );

  previewUpdate.textContent =
    String(
      summary.update ||
      0
    );


  previewBody.replaceChildren();


  for (
    const observation
    of preview
  ) {
    const row =
      document.createElement(
        "tr"
      );


    row.className =
      observation.validation_status ===
      "ERROR"
        ? "corrosion-preview-row-error"
        : "corrosion-preview-row-ready";


    appendPreviewCell(
      row,
      observation.excel_row
    );

    appendPreviewCell(
      row,
      observation.record_action
    );

    appendPreviewCell(
      row,
      observation.validation_status
    );

    appendPreviewCell(
      row,
      observation.source_code
    );

    appendPreviewCell(
      row,
      observation.site_id
    );

    appendPreviewCell(
      row,
      observation.material
    );

    appendPreviewCell(
      row,
      observation.exposure_period
    );


    const dates =
      [
        observation.exposure_start,
        observation.exposure_end,
      ]
        .filter(Boolean)
        .join(" → ");


    appendPreviewCell(
      row,
      dates
    );

    appendPreviewCell(
      row,
      observation.corrosion_metric
    );


    const reported =
      observation.reported_value !==
        "" &&
      observation.reported_value !==
        null &&
      observation.reported_value !==
        undefined
        ? `${formatNumber(
            observation.reported_value
          )} ${observation.reported_unit || ""}`.trim()
        : "";


    appendPreviewCell(
      row,
      reported
    );


    const thickness =
      hasValue(
        observation
          .canonical_thickness_loss_rate_um_year
      )
        ? `${formatNumber(
            observation
              .canonical_thickness_loss_rate_um_year
          )} µm/year`
        : "";


    appendPreviewCell(
      row,
      thickness
    );


    const mass =
      hasValue(
        observation
          .canonical_mass_loss_rate_g_m2_year
      )
        ? `${formatNumber(
            observation
              .canonical_mass_loss_rate_g_m2_year
          )} g/m²/year`
        : "";


    appendPreviewCell(
      row,
      mass
    );


    const density =
      hasValue(
        observation
          .density_used_g_cm3
      )
        ? `${formatNumber(
            observation
              .density_used_g_cm3
          )} g/cm³`
        : "";


    appendPreviewCell(
      row,
      density
    );


    appendPreviewCell(
      row,
      observation.validation_message
    );


    previewBody.append(
      row
    );
  }


  if (
    preview.length === 0
  ) {
    previewMessage.textContent =
      "No completed corrosion observation rows were found. " +
      "Blank starter rows were ignored.";

    previewMessage.className =
      "save-message save-message-warning";

    previewMessage.hidden =
      false;

  } else if (
    Number(
      summary.errors ||
      0
    ) > 0
  ) {
    previewMessage.textContent =
      "The workbook contains validation errors. " +
      "Correct those rows in Excel and upload the workbook again.";

    previewMessage.className =
      "save-message save-message-error";

    previewMessage.hidden =
      false;

  } else {
    previewMessage.textContent =
      "All workbook rows passed validation. " +
      "Database import is intentionally disabled in this preview-only patch.";

    previewMessage.className =
      "save-message save-message-success";

    previewMessage.hidden =
      false;
  }

  const canImport =
    preview.length > 0 &&
    Number(
      summary.errors ||
      0
    ) === 0;


  importConfirm.hidden =
    !canImport;

  importPreview.hidden =
    false;
}


chooseWorkbookButton.addEventListener(
  "click",
  () => {
    workbookUploadInput.value =
      "";

    workbookUploadInput.click();
  }
);


workbookUploadInput.addEventListener(
  "change",
  async () => {
    const file =
      workbookUploadInput
        .files?.[0];


    if (!file) {
      return;
    }

    currentWorkbookFile =
      file;

    currentPreviewSummary =
      null;

    importConfirm.hidden =
      true;

    importConfirmCheckbox.checked =
      false;

    importButton.disabled =
      true;

    importResult.hidden =
      true;

    if (
      !/\.(xlsm|xlsx)$/i.test(
        file.name
      )
    ) {
      importStatus.textContent =
        "Choose an XLSM or XLSX workbook.";

      importStatus.className =
        "save-message save-message-error";

      importStatus.hidden =
        false;

      return;
    }


    uploadFileName.textContent =
      file.name;

    chooseWorkbookButton.disabled =
      true;

    chooseWorkbookButton.textContent =
      "Validating…";

    importPreview.hidden =
      true;

    importStatus.textContent =
      "Reading workbook and independently recalculating corrosion values…";

    importStatus.className =
      "save-message";

    importStatus.hidden =
      false;


    try {
      const response =
        await fetch(
          "/api/corrosion-workbook-preview",
          {
            method:
              "POST",

            headers: {
              "content-type":
                file.type ||
                "application/octet-stream",

              "x-corrosion-file-name":
                encodeURIComponent(
                  file.name
                ),

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
        !payload.ok
      ) {
        throw new Error(
          payload.error ||
          `HTTP ${response.status}`
        );
      }


      importStatus.hidden =
        true;


      renderCorrosionPreview(
        payload
      );

    } catch (error) {
      console.error(
        "Unable to validate corrosion workbook.",
        error
      );


      importStatus.textContent =
        error.message ||
        "Unable to validate corrosion workbook.";

      importStatus.className =
        "save-message save-message-error";

      importStatus.hidden =
        false;

    } finally {
      chooseWorkbookButton.disabled =
        false;

      chooseWorkbookButton.textContent =
        "Choose XLSM / XLSX";
    }
  }
);

importConfirmCheckbox.addEventListener(
  "change",
  () => {
    const canImport =
      Boolean(
        currentWorkbookFile
      ) &&
      Number(
        currentPreviewSummary
          ?.errors ||
        0
      ) === 0 &&
      Number(
        currentPreviewSummary
          ?.ready ||
        0
      ) > 0;


    importButton.disabled =
      !(
        canImport &&
        importConfirmCheckbox.checked
      );
  }
);

importButton.addEventListener(
  "click",
  async () => {
    if (
      !currentWorkbookFile
    ) {
      return;
    }


    if (
      !importConfirmCheckbox.checked
    ) {
      importResult.textContent =
        "Confirm that you reviewed the validated rows first.";

      importResult.className =
        "save-message save-message-error";

      importResult.hidden =
        false;

      return;
    }


    if (
      Number(
        currentPreviewSummary
          ?.errors ||
        0
      ) > 0
    ) {
      importResult.textContent =
        "The workbook contains validation errors and cannot be imported.";

      importResult.className =
        "save-message save-message-error";

      importResult.hidden =
        false;

      return;
    }


    importButton.disabled =
      true;

    importButton.textContent =
      "Importing…";

    chooseWorkbookButton.disabled =
      true;

    importResult.textContent =
      "Re-reading and revalidating the workbook before database import…";

    importResult.className =
      "save-message";

    importResult.hidden =
      false;


    try {
      const response =
        await fetch(
          "/api/corrosion-workbook-import",
          {
            method:
              "POST",

            headers: {
              "content-type":
                currentWorkbookFile
                  .type ||
                "application/octet-stream",

              "x-corrosion-file-name":
                encodeURIComponent(
                  currentWorkbookFile
                    .name
                ),

              accept:
                "application/json",
            },

            body:
              currentWorkbookFile,
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


      let message =
        `Imported ${payload.imported} corrosion observation` +
        `${payload.imported === 1 ? "" : "s"}. ` +
        `${payload.created} created, ` +
        `${payload.updated} updated.`;


      if (
        payload.warning
      ) {
        message +=
          ` ${payload.warning}`;
      }


      importResult.textContent =
        message;

      importResult.className =
        payload.warning
          ? "save-message save-message-warning"
          : "save-message save-message-success";

      importResult.hidden =
        false;


      /*
       * Prevent accidental second import from the
       * same preview without explicitly selecting
       * the workbook again.
       */
      currentWorkbookFile =
        null;

      currentPreviewSummary =
        null;

      importConfirmCheckbox.checked =
        false;

      importConfirmCheckbox.disabled =
        true;

      importButton.disabled =
        true;


      /*
       * Refresh the observation browser so newly
       * created / updated rows are immediately visible.
       */
      currentPage =
        1;

      await loadObservations();

    } catch (error) {
      console.error(
        "Unable to import corrosion workbook.",
        error
      );


      importResult.textContent =
        error.message ||
        "Unable to import corrosion workbook.";

      importResult.className =
        "save-message save-message-error";

      importResult.hidden =
        false;


      /*
       * Keep the selected workbook available after
       * a failed import so the user can retry.
       */
      importButton.disabled =
        !importConfirmCheckbox.checked;

    } finally {
      chooseWorkbookButton.disabled =
        false;

      importButton.textContent =
        "Import validated observations";
    }
  }
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
        350
      );
  }
);


pageSizeInput.addEventListener(
  "change",
  () => {
    currentPageSize =
      Number(
        pageSizeInput.value
      );

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


    currentPage -= 1;

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


    currentPage += 1;

    loadObservations();
  }
);


const initialParams =
  new URLSearchParams(
    window.location.search
  );


const initialQuery =
  initialParams.get(
    "q"
  );


if (initialQuery) {
  searchInput.value =
    initialQuery;
}


const initialPage =
  Number(
    initialParams.get(
      "page"
    )
  );


if (
  Number.isInteger(
    initialPage
  ) &&
  initialPage > 0
) {
  currentPage =
    initialPage;
}


Promise.all([
  loadWorkbookSources(),
  loadObservations(),
]);