const BULK_SITE_LIMIT =
  50;

const BULK_LOOKUP_DELAY_MS =
  1100;


const bulkBrowsePanel =
  document.getElementById(
    "sites-browse-panel"
  );

const bulkMultiplePanel =
  document.getElementById(
    "sites-multiple-panel"
  );

const bulkBrowseTab =
  document.getElementById(
    "sites-tab-browse"
  );

const bulkMultipleTab =
  document.getElementById(
    "sites-tab-multiple"
  );

const bulkInput =
  document.getElementById(
    "sites-bulk-input"
  );

const bulkAnalyseButton =
  document.getElementById(
    "sites-bulk-analyse"
  );

const bulkClearButton =
  document.getElementById(
    "sites-bulk-clear"
  );

const bulkProgress =
  document.getElementById(
    "sites-bulk-progress"
  );

const bulkResultsSection =
  document.getElementById(
    "sites-bulk-results-section"
  );

const bulkResultsElement =
  document.getElementById(
    "sites-bulk-results"
  );

const bulkSummaryText =
  document.getElementById(
    "sites-bulk-summary-text"
  );

const bulkSelectionText =
  document.getElementById(
    "sites-bulk-selection-text"
  );

const bulkSelectReadyButton =
  document.getElementById(
    "sites-bulk-select-ready"
  );

const bulkClearSelectionButton =
  document.getElementById(
    "sites-bulk-clear-selection"
  );

const bulkCreateButton =
  document.getElementById(
    "sites-bulk-create"
  );

const bulkCreateMessage =
  document.getElementById(
    "sites-bulk-create-message"
  );


let bulkExistingSites =
  [];

let bulkRows =
  [];

let bulkActiveFilter =
  "all";

let bulkAnalysing =
  false;

let bulkCreating =
  false;

const bulkSearchCache =
  new Map();


function bulkNormalise(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}


function bulkSleep(
  milliseconds
) {
  return new Promise(
    (resolve) => {
      window.setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}


function bulkParseQueries() {
  const rawLines =
    String(
      bulkInput.value || ""
    )
      .split(/\r?\n/)
      .map(
        (line) =>
          line.trim()
      )
      .filter(Boolean);


  const seen =
    new Set();

  const queries =
    [];


  for (
    const line
    of rawLines
  ) {
    const key =
      bulkNormalise(line);

    if (
      !key ||
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);
    queries.push(line);
  }


  return {
    queries,

    original_count:
      rawLines.length,

    duplicate_count:
      rawLines.length -
      queries.length,
  };
}


function bulkDistanceKm(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const values = [
    lat1,
    lon1,
    lat2,
    lon2,
  ].map(Number);


  if (
    values.some(
      (value) =>
        !Number.isFinite(
          value
        )
    )
  ) {
    return Infinity;
  }


  const [
    firstLat,
    firstLon,
    secondLat,
    secondLon,
  ] =
    values;


  const radians =
    Math.PI / 180;

  const dLat =
    (
      secondLat -
      firstLat
    ) *
    radians;

  const dLon =
    (
      secondLon -
      firstLon
    ) *
    radians;


  const a =
    Math.sin(
      dLat / 2
    ) ** 2 +
    Math.cos(
      firstLat *
      radians
    ) *
    Math.cos(
      secondLat *
      radians
    ) *
    Math.sin(
      dLon / 2
    ) ** 2;


  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(
        1 - a
      )
    );


  return 6371 * c;
}


async function bulkLoadExistingSites() {
  const response =
    await fetch(
      "/api/sites",
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
    !payload.ok ||
    !Array.isArray(
      payload.sites
    )
  ) {
    throw new Error(
      payload.error ||
      "Unable to load existing Sites."
    );
  }


  bulkExistingSites =
    payload.sites;
}


async function bulkSearchLocation(
  query
) {
  const cacheKey =
    bulkNormalise(query);


  if (
    bulkSearchCache.has(
      cacheKey
    )
  ) {
    return bulkSearchCache.get(
      cacheKey
    );
  }


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
    await fetch(
      url,
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


  bulkSearchCache.set(
    cacheKey,
    payload.results
  );


  return payload.results;
}


async function bulkClassifyRegion(
  row
) {
  const latitude =
    Number(
      row.latitude
    );

  const longitude =
    Number(
      row.longitude
    );


  if (
    !Number.isFinite(
      latitude
    ) ||
    !Number.isFinite(
      longitude
    )
  ) {
    row.region_category =
      "";

    row.region_note =
      "";

    return;
  }


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
            latitude,
            longitude,

            current_region_category:
              "",

            modern_country_location:
              row.country || "",

            site_type:
              row.site_type || "",
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
      "Region classification failed."
    );
  }


  row.region_category =
    payload.region_category ||
    "";

  row.region_note =
    payload.notes ||
    "";
}


function bulkFindExistingSite(
  row
) {
  const rowLabel =
    bulkNormalise(
      row.site_label
    );

  const rowCountry =
    bulkNormalise(
      row.country
    );


  let coordinateMatch =
    null;


  for (
    const site
    of bulkExistingSites
  ) {
    const siteLabel =
      bulkNormalise(
        site.site_label
      );

    const siteCountry =
      bulkNormalise(
        site.modern_country_location ||
        site.administering_country
      );


    if (
      rowLabel &&
      siteLabel ===
        rowLabel &&
      (
        !rowCountry ||
        !siteCountry ||
        siteCountry ===
          rowCountry
      )
    ) {
      return {
        site,

        reason:
          "Same Site label and country",
      };
    }


    const distance =
      bulkDistanceKm(
        row.latitude,
        row.longitude,
        site.latitude,
        site.longitude
      );


    if (
      distance <=
      0.25
    ) {
      coordinateMatch = {
        site,

        reason:
          `Existing Site within ${Math.round(
            distance * 1000
          )} m`,
      };
    }
  }


  return coordinateMatch;
}


function bulkRefreshRowState(
  row
) {
  row.existing_match =
    bulkFindExistingSite(
      row
    );

  if (
    bulkCreationSucceeded(
      row
    ) &&
    row.created_site
  ) {
    const result =
      document.createElement(
        "div"
      );

    result.className =
      "sites-bulk-created-result";


    const text =
      document.createElement(
        "span"
      );

    text.textContent =
      row.creation_status ===
        "merged"
        ? "Merged into"
        : "Created";


    const link =
      document.createElement(
        "a"
      );

    link.href =
      `/sites/detail/?id=${encodeURIComponent(
        row.created_site.id
      )}`;

    link.target =
      "_blank";

    link.rel =
      "noopener";

    link.textContent =
      [
        row.created_site.site_id,
        row.created_site.site_label,
      ]
        .filter(Boolean)
        .join(" · ");


    result.append(
      text,
      link
    );

    card.append(
      result
    );
  }


  if (
    row.creation_status ===
      "error"
  ) {
    const error =
      document.createElement(
        "div"
      );

    error.className =
      "save-message save-message-error";

    error.textContent =
      row.create_error ||
      "Unable to create Site.";

    card.append(
      error
    );
  }

  if (
    row.existing_match
  ) {
    row.state =
      "existing";

    if (
      !row.selection_touched
    ) {
      row.selected =
        false;
    }

    return;
  }


  if (
    !row.site_label ||
    !row.country ||
    !Number.isFinite(
      Number(
        row.latitude
      )
    ) ||
    !Number.isFinite(
      Number(
        row.longitude
      )
    )
  ) {
    row.state =
      "review";

    if (
      !row.selection_touched
    ) {
      row.selected =
        false;
    }

    return;
  }


  row.state =
    "ready";


  if (
    !row.selection_touched
  ) {
    row.selected =
      true;
  }
}


async function bulkApplyCandidate(
  row,
  candidateIndex
) {
  const candidate =
    row.results[
      candidateIndex
    ];


  if (!candidate) {
    return;
  }


  row.candidate_index =
    candidateIndex;

  row.site_label =
    candidate.site_label ||
    candidate.label ||
    "";

  row.country =
    candidate.country ||
    "";

  row.country_code =
    candidate.country_code ||
    "";

  row.latitude =
    candidate.latitude;

  row.longitude =
    candidate.longitude;

  row.site_type =
    row.site_type ||
    "";


  try {
    await bulkClassifyRegion(
      row
    );

    row.error =
      "";

  } catch (error) {
    console.error(
      "Unable to classify bulk Site.",
      error
    );

    row.region_category =
      "";

    row.region_note =
      "";

    row.error =
      error.message ||
      "Region classification failed.";
  }


  bulkRefreshRowState(
    row
  );
}


function bulkStateLabel(
  state
) {
  if (
    state ===
    "ready"
  ) {
    return "Ready";
  }

  if (
    state ===
    "existing"
  ) {
    return "Existing";
  }

  if (
    state ===
    "searching"
  ) {
    return "Searching";
  }

  return "Needs review";
}

function bulkCreationSucceeded(
  row
) {
  return [
    "created",
    "merged",
  ].includes(
    row.creation_status
  );
}


function bulkVisualState(
  row
) {
  if (
    row.creation_status ===
    "creating"
  ) {
    return "creating";
  }

  if (
    row.creation_status ===
    "created"
  ) {
    return "created";
  }

  if (
    row.creation_status ===
    "merged"
  ) {
    return "merged";
  }

  if (
    row.creation_status ===
    "error"
  ) {
    return "error";
  }

  return row.state;
}


function bulkVisualLabel(
  row
) {
  if (
    row.creation_status ===
    "creating"
  ) {
    return "Creating…";
  }

  if (
    row.creation_status ===
    "created"
  ) {
    return "Created";
  }

  if (
    row.creation_status ===
    "merged"
  ) {
    return "Merged";
  }

  if (
    row.creation_status ===
    "error"
  ) {
    return "Create failed";
  }

  return bulkStateLabel(
    row.state
  );
}


function bulkSelectedRows() {
  return bulkRows.filter(
    (row) =>
      row.state ===
        "ready" &&
      row.selected &&
      !bulkCreationSucceeded(
        row
      )
  );
}


function bulkUpdateSelectionControls() {
  const selected =
    bulkSelectedRows();


  bulkSelectionText.textContent =
    `${selected.length} selected`;


  bulkCreateButton.disabled =
    bulkCreating ||
    selected.length === 0;


  bulkSelectReadyButton.disabled =
    bulkCreating;

  bulkClearSelectionButton.disabled =
    bulkCreating;
}

function bulkUpdateSummary() {
  const ready =
    bulkRows.filter(
      (row) =>
        row.state ===
          "ready" &&
        !bulkCreationSucceeded(
          row
        )
    ).length;

  const review =
    bulkRows.filter(
      (row) =>
        row.state ===
        "review"
    ).length;

  const existing =
    bulkRows.filter(
      (row) =>
        row.state ===
        "existing"
    ).length;

  const searching =
    bulkRows.filter(
      (row) =>
        row.state ===
        "searching"
    ).length;

  const created =
    bulkRows.filter(
      (row) =>
        row.creation_status ===
        "created"
    ).length;

  const merged =
    bulkRows.filter(
      (row) =>
        row.creation_status ===
        "merged"
    ).length;

  const failed =
    bulkRows.filter(
      (row) =>
        row.creation_status ===
        "error"
    ).length;


  const parts = [
    `${bulkRows.length} search${
      bulkRows.length === 1
        ? ""
        : "es"
    }`,

    `${ready} ready`,

    `${review} need review`,

    `${existing} existing`,
  ];


  if (searching) {
    parts.push(
      `${searching} searching`
    );
  }

  if (created) {
    parts.push(
      `${created} created`
    );
  }

  if (merged) {
    parts.push(
      `${merged} merged`
    );
  }

  if (failed) {
    parts.push(
      `${failed} failed`
    );
  }


  bulkSummaryText.textContent =
    parts.join(" · ");


  const countByState = {
    all:
      bulkRows.length,

    ready,

    review,

    existing,
  };


  for (
    const button
    of document.querySelectorAll(
      "[data-bulk-filter]"
    )
  ) {
    const filter =
      button.dataset
        .bulkFilter;

    const baseLabel =
      filter === "all"
        ? "All"
        : filter === "ready"
          ? "Ready"
          : filter === "review"
            ? "Needs review"
            : "Existing";


    button.textContent =
      `${baseLabel} (${countByState[
        filter
      ] || 0})`;
  }


  bulkUpdateSelectionControls();
}


function bulkCreateTextInput(
  label,
  value,
  fieldName,
  row,
  options = {}
) {
  const wrapper =
    document.createElement(
      "label"
    );

  wrapper.className =
    "sites-bulk-field";


  const labelElement =
    document.createElement(
      "span"
    );

  labelElement.textContent =
    label;


  const input =
    document.createElement(
      "input"
    );

  input.className =
    "detail-input";

  input.type =
    options.type ||
    "text";

  if (
    options.step
  ) {
    input.step =
      options.step;
  }

  input.value =
    value === null ||
    value === undefined
      ? ""
      : String(value);

  input.disabled =
    bulkCreationSucceeded(
      row
    );


  input.addEventListener(
    "change",
    async () => {
      if (
        fieldName ===
        "country"
      ) {
        row.country_code =
          "";
      }
      if (
        input.type ===
        "number"
      ) {
        const number =
          Number(
            input.value
          );

        row[fieldName] =
          Number.isFinite(
            number
          )
            ? number
            : "";
      } else {
        row[fieldName] =
          input.value.trim();
      }


      const needsRegionRefresh =
        [
          "latitude",
          "longitude",
          "country",
          "site_type",
        ].includes(
          fieldName
        );


      if (
        needsRegionRefresh
      ) {
        try {
          await bulkClassifyRegion(
            row
          );

          row.error =
            "";

        } catch (error) {
          console.error(
            "Unable to reclassify bulk Site.",
            error
          );

          row.error =
            error.message ||
            "Region classification failed.";
        }
      }


      bulkRefreshRowState(
        row
      );

      bulkRenderRows();
    }
  );


  wrapper.append(
    labelElement,
    input
  );


  return wrapper;
}


function bulkRenderRow(
  row
) {
  const card =
    document.createElement(
      "article"
    );

  card.className =
    "sites-bulk-card";


  const header =
    document.createElement(
      "div"
    );

  header.className =
    "sites-bulk-card-header";


  const queryBlock =
    document.createElement(
      "div"
    );


  const queryLabel =
    document.createElement(
      "div"
    );

  queryLabel.className =
    "sites-bulk-query-label";

  queryLabel.textContent =
    "Search query";


  const queryValue =
    document.createElement(
      "div"
    );

  queryValue.className =
    "sites-bulk-query";

  queryValue.textContent =
    row.query;


  queryBlock.append(
    queryLabel,
    queryValue
  );


  const controls =
    document.createElement(
      "div"
    );

  controls.className =
    "sites-bulk-card-controls";


  if (
    row.state ===
      "ready" &&
    !bulkCreationSucceeded(
      row
    )
  ) {
    const selectLabel =
      document.createElement(
        "label"
      );

    selectLabel.className =
      "sites-bulk-select";


    const checkbox =
      document.createElement(
        "input"
      );

    checkbox.type =
      "checkbox";

    checkbox.checked =
      Boolean(
        row.selected
      );

    checkbox.disabled =
      bulkCreating;


    checkbox.addEventListener(
      "change",
      () => {
        row.selected =
          checkbox.checked;

        row.selection_touched =
          true;

        bulkUpdateSummary();
      }
    );


    const checkboxText =
      document.createElement(
        "span"
      );

    checkboxText.textContent =
      "Create";


    selectLabel.append(
      checkbox,
      checkboxText
    );

    controls.append(
      selectLabel
    );
  }


  const visualState =
    bulkVisualState(
      row
    );


  const state =
    document.createElement(
      "div"
    );

  state.className =
    `sites-bulk-state sites-bulk-state-${visualState}`;

  state.textContent =
    bulkVisualLabel(
      row
    );


  controls.append(
    state
  );


  header.append(
    queryBlock,
    controls
  );


  card.append(header);


  if (
    row.state ===
    "searching"
  ) {
    const searching =
      document.createElement(
        "div"
      );

    searching.className =
      "sites-bulk-card-message";

    searching.textContent =
      "Searching geographic locations…";

    card.append(searching);

    return card;
  }


  if (
    row.error &&
    row.results.length ===
      0
  ) {
    const error =
      document.createElement(
        "div"
      );

    error.className =
      "save-message save-message-error";

    error.textContent =
      row.error;

    card.append(error);
  }


  if (
    row.results.length >
    0
  ) {
    const candidateField =
      document.createElement(
        "label"
      );

    candidateField.className =
      "sites-bulk-candidate-field";


    const candidateLabel =
      document.createElement(
        "span"
      );

    candidateLabel.textContent =
      "Geographic match";


    const select =
      document.createElement(
        "select"
      );

    select.className =
      "detail-input";

    select.disabled =
      bulkCreationSucceeded(
        row
      );


    row.results.forEach(
      (
        result,
        index
      ) => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          String(index);

        option.textContent =
          result.full_label ||
          result.label ||
          result.site_label ||
          `Result ${index + 1}`;

        if (
          index ===
          row.candidate_index
        ) {
          option.selected =
            true;
        }

        select.append(option);
      }
    );


    select.addEventListener(
      "change",
      async () => {
        select.disabled =
          true;

        try {
          await bulkApplyCandidate(
            row,
            Number(
              select.value
            )
          );

        } finally {
          select.disabled =
            false;

          bulkRenderRows();
        }
      }
    );


    candidateField.append(
      candidateLabel,
      select
    );

    card.append(
      candidateField
    );
  }


  const fieldGrid =
    document.createElement(
      "div"
    );

  fieldGrid.className =
    "sites-bulk-field-grid";


  fieldGrid.append(
    bulkCreateTextInput(
      "Site label",
      row.site_label,
      "site_label",
      row
    ),

    bulkCreateTextInput(
      "Country / location",
      row.country,
      "country",
      row
    ),

    bulkCreateTextInput(
      "Latitude",
      row.latitude,
      "latitude",
      row,
      {
        type:
          "number",

        step:
          "any",
      }
    ),

    bulkCreateTextInput(
      "Longitude",
      row.longitude,
      "longitude",
      row,
      {
        type:
          "number",

        step:
          "any",
      }
    )
  );


  const regionRow =
    document.createElement(
      "div"
    );

  regionRow.className =
    "sites-bulk-region-row";


  regionRow.append(
    bulkCreateTextInput(
      "Region",
      row.region_category,
      "region_category",
      row
    )
  );


  const countryText =
    bulkNormalise(
      row.country
    );


  if (
    countryText.includes(
      "antarctica"
    ) ||
    countryText.includes(
      "antarctic"
    )
  ) {
    regionRow.append(
      bulkCreateTextInput(
        "Administering country",
        row.administering_country,
        "administering_country",
        row
      )
    );
  }


  card.append(
    fieldGrid,
    regionRow
  );

  if (
    row.region_note
  ) {
    const regionNote =
      document.createElement(
        "div"
      );

    regionNote.className =
      "sites-bulk-region-note";

    regionNote.textContent =
      row.region_note;

    card.append(
      regionNote
    );
  }


  if (
    row.existing_match
  ) {
    const existing =
      document.createElement(
        "div"
      );

    existing.className =
      "sites-bulk-existing";


    const existingSite =
      row.existing_match.site;


    const heading =
      document.createElement(
        "strong"
      );

    heading.textContent =
      "Likely existing Site";


    const link =
      document.createElement(
        "a"
      );

    link.href =
      `/sites/detail/?id=${encodeURIComponent(
        existingSite.id
      )}`;

    link.target =
      "_blank";

    link.rel =
      "noopener";

    link.textContent =
      [
        existingSite.site_id,
        existingSite.site_label,
      ]
        .filter(Boolean)
        .join(" · ");


    const detail =
      document.createElement(
        "span"
      );

    detail.textContent =
      row.existing_match
        .reason;


    existing.append(
      heading,
      link,
      detail
    );


    card.append(
      existing
    );
  }


  if (
    row.error &&
    row.results.length >
      0
  ) {
    const warning =
      document.createElement(
        "div"
      );

    warning.className =
      "save-message save-message-warning";

    warning.textContent =
      row.error;

    card.append(
      warning
    );
  }


  return card;
}


function bulkRenderRows() {
  bulkResultsElement
    .replaceChildren();


  const visibleRows =
    bulkRows.filter(
      (row) => {
        if (
          bulkActiveFilter ===
          "all"
        ) {
          return true;
        }

        if (
          bulkActiveFilter ===
          "ready"
        ) {
          return (
            row.state ===
              "ready" &&
            !bulkCreationSucceeded(
              row
            )
          );
        }

        return (
          row.state ===
          bulkActiveFilter
        );
      }
    );


  if (
    visibleRows.length ===
    0
  ) {
    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "sites-bulk-empty";

    empty.textContent =
      "No Sites in this filter.";

    bulkResultsElement.append(
      empty
    );
  } else {
    for (
      const row
      of visibleRows
    ) {
      bulkResultsElement.append(
        bulkRenderRow(
          row
        )
      );
    }
  }


  bulkUpdateSummary();
}

async function bulkSuggestSiteId(
  row
) {
  const url =
    new URL(
      "/api/site-id-suggestion",
      window.location.origin
    );


  url.searchParams.set(
    "country",
    row.country || ""
  );

  url.searchParams.set(
    "admin",
    row.administering_country ||
      ""
  );


  if (
    row.country_code
  ) {
    url.searchParams.set(
      "country_code",
      row.country_code
    );
  }


  const response =
    await fetch(
      url,
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
    !payload.ok ||
    !payload.suggested_site_id
  ) {
    throw new Error(
      payload.error ||
      "Unable to generate Site ID."
    );
  }


  return String(
    payload.suggested_site_id
  ).trim();
}


async function bulkCreateRow(
  row
) {
  row.creation_status =
    "creating";

  row.create_error =
    "";

  bulkRenderRows();


  try {
    const siteId =
      await bulkSuggestSiteId(
        row
      );


    const response =
      await fetch(
        "/api/sites",
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
              site_id:
                siteId,

              site_label:
                row.site_label ||
                "",

              site_type:
                row.site_type ||
                "",

              latitude:
                Number(
                  row.latitude
                ),

              longitude:
                Number(
                  row.longitude
                ),

              modern_country_location:
                row.country ||
                "",

              administering_country:
                row.administering_country ||
                "",

              former_entity:
                "",

              region_category:
                row.region_category ||
                "",

              exposure_period:
                "",

              metal:
                "",

              notes:
                "",
            }),
        }
      );


    const payload =
      await response.json();


    if (
      !response.ok ||
      !payload.ok ||
      !payload.site
    ) {
      throw new Error(
        payload.error ||
        "Unable to create Site."
      );
    }


    row.created_site =
      payload.site;

    row.creation_status =
      payload.action ===
        "merged"
        ? "merged"
        : "created";

    row.selected =
      false;

    row.selection_touched =
      true;


    return {
      action:
        row.creation_status,

      site:
        payload.site,
    };

  } catch (error) {
    console.error(
      "Unable to create bulk Site.",
      error
    );


    row.creation_status =
      "error";

    row.create_error =
      error.message ||
      "Unable to create Site.";


    throw error;

  } finally {
    bulkRenderRows();
  }
}


async function bulkCreateSelected() {
  if (
    bulkCreating ||
    bulkAnalysing
  ) {
    return;
  }


  const rows =
    bulkSelectedRows();


  if (
    rows.length ===
    0
  ) {
    return;
  }


  const confirmed =
    window.confirm(
      `Create ${rows.length} selected Site${
        rows.length === 1
          ? ""
          : "s"
      }?\n\n` +
      "Each Site will be validated and saved sequentially."
    );


  if (
    !confirmed
  ) {
    return;
  }


  bulkCreating =
    true;

  bulkAnalyseButton.disabled =
    true;

  bulkClearButton.disabled =
    true;

  bulkCreateMessage.hidden =
    false;

  bulkCreateMessage.className =
    "save-message";

  bulkCreateMessage.textContent =
    `Creating ${rows.length} Site${
      rows.length === 1
        ? ""
        : "s"
    }…`;

  bulkUpdateSelectionControls();


  let created =
    0;

  let merged =
    0;

  let failed =
    0;


  for (
    let index = 0;
    index < rows.length;
    index += 1
  ) {
    const row =
      rows[index];


    bulkCreateMessage.textContent =
      `Creating ${index + 1} of ${rows.length}: ${row.site_label || row.query}`;


    try {
      const result =
        await bulkCreateRow(
          row
        );


      if (
        result.action ===
        "merged"
      ) {
        merged += 1;
      } else {
        created += 1;
      }

    } catch {
      failed += 1;
    }
  }


  try {
    await bulkLoadExistingSites();
  } catch (error) {
    console.error(
      "Unable to refresh Sites after bulk creation.",
      error
    );
  }


  bulkCreating =
    false;

  bulkAnalyseButton.disabled =
    false;

  bulkClearButton.disabled =
    false;


  bulkCreateMessage.className =
    failed
      ? "save-message save-message-warning"
      : "save-message save-message-success";


  bulkCreateMessage.textContent =
    [
      `${created} created`,
      `${merged} merged`,
      `${failed} failed`,
    ].join(" · ");


  bulkRenderRows();
}

async function bulkAnalyseSites() {
  if (
    bulkAnalysing ||
    bulkCreating
  ) {
    return;
  }


  const parsed =
    bulkParseQueries();


  if (
    parsed.queries.length ===
    0
  ) {
    bulkProgress.textContent =
      "Enter at least one geographic search.";

    bulkProgress.hidden =
      false;

    return;
  }


  if (
    parsed.queries.length >
    BULK_SITE_LIMIT
  ) {
    bulkProgress.textContent =
      `This batch contains ${parsed.queries.length} unique searches. ` +
      `Please limit each batch to ${BULK_SITE_LIMIT}.`;

    bulkProgress.hidden =
      false;

    return;
  }


  bulkAnalysing =
    true;

  bulkAnalyseButton.disabled =
    true;

  bulkClearButton.disabled =
    true;

  bulkAnalyseButton.textContent =
    "Analysing…";


  bulkProgress.hidden =
    false;

  bulkProgress.textContent =
    "Loading existing Sites…";


  try {
    await bulkLoadExistingSites();


    bulkRows =
      parsed.queries.map(
        (
          query,
          index
        ) => ({
          key:
            `${Date.now()}-${index}`,

          query,

          results:
            [],

          candidate_index:
            0,

          site_label:
            "",

          site_type:
            "",

          country:
            "",

          country_code:
            "",

          administering_country:
            "",

          latitude:
            "",

          longitude:
            "",

          region_category:
            "",

          region_note:
            "",

          existing_match:
            null,

          state:
            "searching",

          error:
            "",

          selected:
            false,

          selection_touched:
            false,

          creation_status:
            "",

          created_site:
            null,

          create_error:
            "",
        })
      );


    bulkResultsSection.hidden =
      false;

    bulkRenderRows();


    for (
      let index = 0;
      index <
      bulkRows.length;
      index += 1
    ) {
      const row =
        bulkRows[index];


      bulkProgress.textContent =
        `Looking up Site ${index + 1} of ${bulkRows.length}: ${row.query}`;


      try {
        row.results =
          await bulkSearchLocation(
            row.query
          );


        if (
          row.results.length ===
          0
        ) {
          row.state =
            "review";

          row.error =
            "No geographic matches were returned.";

        } else {
          await bulkApplyCandidate(
            row,
            0
          );
        }

      } catch (error) {
        console.error(
          "Bulk location lookup failed.",
          error
        );

        row.state =
          "review";

        row.error =
          error.message ||
          "Location lookup failed.";
      }


      bulkRenderRows();


      if (
        index <
        bulkRows.length -
          1
      ) {
        await bulkSleep(
          BULK_LOOKUP_DELAY_MS
        );
      }
    }


    const duplicateNote =
      parsed.duplicate_count >
        0
        ? (
            ` ${parsed.duplicate_count} duplicate input ` +
            `line${parsed.duplicate_count === 1 ? "" : "s"} removed.`
          )
        : "";


    bulkProgress.textContent =
      `Analysis complete.${duplicateNote}`;

  } catch (error) {
    console.error(
      "Unable to analyse Sites.",
      error
    );

    bulkProgress.textContent =
      error.message ||
      "Unable to analyse Sites.";

  } finally {
    bulkAnalysing =
      false;

    bulkAnalyseButton.disabled =
      false;

    bulkClearButton.disabled =
      false;

    bulkAnalyseButton.textContent =
      "Analyse Sites";
  }
}


function bulkClearAll() {
  if (
    bulkAnalysing ||
    bulkCreating
  ) {
    return;
  }


  bulkInput.value =
    "";

  bulkRows =
    [];

  bulkActiveFilter =
    "all";

  bulkResultsElement
    .replaceChildren();

  bulkResultsSection.hidden =
    true;

  bulkProgress.hidden =
    true;

  bulkCreateMessage.hidden =
    true;

  bulkCreateMessage.textContent =
    "";


  for (
    const button
    of document.querySelectorAll(
      "[data-bulk-filter]"
    )
  ) {
    button.classList.toggle(
      "sites-bulk-filter-active",
      button.dataset.bulkFilter ===
        "all"
    );
  }
}


function bulkInitialiseMode() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const multiple =
    params.get("mode") ===
    "multiple";


  bulkBrowsePanel.hidden =
    multiple;

  bulkMultiplePanel.hidden =
    !multiple;


  bulkBrowseTab.classList.toggle(
    "sites-mode-tab-active",
    !multiple
  );

  bulkMultipleTab.classList.toggle(
    "sites-mode-tab-active",
    multiple
  );


  if (
    !multiple
  ) {
    bulkBrowseTab.setAttribute(
      "aria-current",
      "page"
    );

    bulkMultipleTab.removeAttribute(
      "aria-current"
    );
  } else {
    bulkMultipleTab.setAttribute(
      "aria-current",
      "page"
    );

    bulkBrowseTab.removeAttribute(
      "aria-current"
    );
  }
}

bulkSelectReadyButton.addEventListener(
  "click",
  () => {
    for (
      const row
      of bulkRows
    ) {
      if (
        row.state ===
          "ready" &&
        !bulkCreationSucceeded(
          row
        )
      ) {
        row.selected =
          true;

        row.selection_touched =
          true;
      }
    }


    bulkRenderRows();
  }
);


bulkClearSelectionButton.addEventListener(
  "click",
  () => {
    for (
      const row
      of bulkRows
    ) {
      row.selected =
        false;

      row.selection_touched =
        true;
    }


    bulkRenderRows();
  }
);


bulkCreateButton.addEventListener(
  "click",
  bulkCreateSelected
);

bulkAnalyseButton.addEventListener(
  "click",
  bulkAnalyseSites
);


bulkClearButton.addEventListener(
  "click",
  bulkClearAll
);


for (
  const button
  of document.querySelectorAll(
    "[data-bulk-filter]"
  )
) {
  button.addEventListener(
    "click",
    () => {
      bulkActiveFilter =
        button.dataset
          .bulkFilter ||
        "all";


      for (
        const other
        of document.querySelectorAll(
          "[data-bulk-filter]"
        )
      ) {
        other.classList.toggle(
          "sites-bulk-filter-active",
          other === button
        );
      }


      bulkRenderRows();
    }
  );
}


bulkInitialiseMode();