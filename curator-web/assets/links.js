const statusElement =
  document.getElementById(
    "linking-status"
  );

const contentElement =
  document.getElementById(
    "linking-content"
  );

const siteOptionsElement =
  document.getElementById(
    "site-options"
  );

const sourceOptionsElement =
  document.getElementById(
    "source-options"
  );

const siteFilter =
  document.getElementById(
    "site-filter"
  );

const sourceFilter =
  document.getElementById(
    "source-filter"
  );

const selectedSiteCount =
  document.getElementById(
    "selected-site-count"
  );

const selectedSourceCount =
  document.getElementById(
    "selected-source-count"
  );

const selectAllSitesButton =
  document.getElementById(
    "select-all-sites"
  );

const deselectAllSitesButton =
  document.getElementById(
    "deselect-all-sites"
  );

const selectAllSourcesButton =
  document.getElementById(
    "select-all-sources"
  );

const deselectAllSourcesButton =
  document.getElementById(
    "deselect-all-sources"
  );

const recentSitesPanel =
  document.getElementById(
    "recent-sites-panel"
  );

const recentSitesMessage =
  document.getElementById(
    "recent-sites-message"
  );

const useRecentSitesButton =
  document.getElementById(
    "use-recent-sites"
  );

const sourceMetadataSuggestion =
  document.getElementById(
    "source-metadata-suggestion"
  );

const sourceOrderInput =
  document.getElementById(
    "bulk-source-order"
  );

const metalsInput =
  document.getElementById(
    "bulk-metals"
  );

const exposurePeriodsInput =
  document.getElementById(
    "bulk-exposure-periods"
  );

const notesInput =
  document.getElementById(
    "bulk-link-notes"
  );

const updateSiteSummaryInput =
  document.getElementById(
    "update-site-summary"
  );

const previewElement =
  document.getElementById(
    "bulk-link-preview"
  );

const attachButton =
  document.getElementById(
    "attach-selected"
  );

const messageElement =
  document.getElementById(
    "bulk-link-message"
  );


let sites = [];
let sources = [];

let recentSiteIds =
  new Set();

const selectedSiteIds =
  new Set();

const selectedSourceIds =
  new Set();

let lastSourceSignature = "";


function normalise(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


function splitValues(value) {
  return String(value || "")
    .replaceAll(";", ",")
    .split(",")
    .map(
      (item) => item.trim()
    )
    .filter(Boolean);
}


function mergeValues(...values) {
  const merged = [];

  for (const value of values) {
    for (
      const item
      of splitValues(value)
    ) {
      if (!merged.includes(item)) {
        merged.push(item);
      }
    }
  }

  return merged.join(", ");
}


function siteLabel(site) {
  const country =
    site.modern_country_location
      ? ` (${site.modern_country_location})`
      : "";

  return (
    `${site.site_id || ""} — ` +
    `${site.site_label || "(Unnamed Site)"}` +
    country
  );
}


function sourceLabel(source) {
  const programme =
    source.programme ||
    "No programme";

  return (
    `${String(source.source_code || "").toUpperCase()} — ` +
    `${source.source_title || "(Untitled Source)"} ` +
    `[${programme}]`
  );
}


function updateSelectionSummary() {
  selectedSiteCount.textContent =
    `${selectedSiteIds.size} selected`;

  selectedSourceCount.textContent =
    `${selectedSourceIds.size} selected`;

  const pairCount =
    selectedSiteIds.size *
    selectedSourceIds.size;

  if (
    selectedSiteIds.size === 0 ||
    selectedSourceIds.size === 0
  ) {
    previewElement.textContent =
      "Select at least one Site and one Source.";

    return;
  }

  previewElement.textContent =
    `This will create or update ${pairCount} ` +
    `Site–Source relationship` +
    `${pairCount === 1 ? "" : "s"}.`;
}


function sourceSelectionChanged() {
  const selectedSources =
    sources.filter(
      (source) =>
        selectedSourceIds.has(
          Number(source.id)
        )
    );

  const signature =
    [...selectedSourceIds]
      .sort((a, b) => a - b)
      .join(",");

  const suggestedMetals =
    mergeValues(
      ...selectedSources.map(
        (source) =>
          source.metals || ""
      )
    );

  const suggestedExposurePeriods =
    mergeValues(
      ...selectedSources.map(
        (source) =>
          source.exposure_periods || ""
      )
    );

  if (
    signature !==
    lastSourceSignature
  ) {
    metalsInput.value =
      suggestedMetals;

    exposurePeriodsInput.value =
      suggestedExposurePeriods;

    lastSourceSignature =
      signature;
  }

  if (
    suggestedMetals ||
    suggestedExposurePeriods
  ) {
    sourceMetadataSuggestion.textContent =
      `Suggested from selected Source(s): ` +
      `Metals: ${suggestedMetals || "—"} · ` +
      `Exposure periods: ${suggestedExposurePeriods || "—"}`;

    sourceMetadataSuggestion.hidden =
      false;
  } else {
    sourceMetadataSuggestion.hidden =
      true;
  }

  updateSelectionSummary();
}


function renderSites() {
  siteOptionsElement.replaceChildren();

  const query =
    normalise(siteFilter.value);

  const visible =
    sites.filter((site) => {
      if (!query) {
        return true;
      }

      return normalise(
        [
          site.site_id,
          site.site_label,
          site.modern_country_location,
        ].join(" ")
      ).includes(query);
    });

  for (const site of visible) {
    const id =
      Number(site.id);

    const row =
      document.createElement("label");

    row.className =
      "bulk-option-row";

    const checkbox =
      document.createElement("input");

    checkbox.type =
      "checkbox";

    checkbox.checked =
      selectedSiteIds.has(id);

    checkbox.addEventListener(
      "change",
      () => {
        if (checkbox.checked) {
          selectedSiteIds.add(id);
        } else {
          selectedSiteIds.delete(id);
        }

        updateSelectionSummary();
      }
    );

    const text =
      document.createElement("span");

    text.textContent =
      siteLabel(site);

    row.append(
      checkbox,
      text
    );

    siteOptionsElement.append(row);
  }
}


function renderSources() {
  sourceOptionsElement.replaceChildren();

  const query =
    normalise(sourceFilter.value);

  const visible =
    sources.filter((source) => {
      if (!query) {
        return true;
      }

      return normalise(
        [
          source.source_code,
          source.source_title,
          source.programme,
        ].join(" ")
      ).includes(query);
    });

  for (const source of visible) {
    const id =
      Number(source.id);

    const row =
      document.createElement("label");

    row.className =
      "bulk-option-row";

    const checkbox =
      document.createElement("input");

    checkbox.type =
      "checkbox";

    checkbox.checked =
      selectedSourceIds.has(id);

    checkbox.addEventListener(
      "change",
      () => {
        if (checkbox.checked) {
          selectedSourceIds.add(id);
        } else {
          selectedSourceIds.delete(id);
        }

        sourceSelectionChanged();
      }
    );

    const text =
      document.createElement("span");

    text.textContent =
      sourceLabel(source);

    row.append(
      checkbox,
      text
    );

    sourceOptionsElement.append(row);
  }
}


function selectAllSites() {
  for (const site of sites) {
    selectedSiteIds.add(
      Number(site.id)
    );
  }

  renderSites();
  updateSelectionSummary();
}


function deselectAllSites() {
  selectedSiteIds.clear();

  renderSites();
  updateSelectionSummary();
}


function selectAllSources() {
  for (const source of sources) {
    selectedSourceIds.add(
      Number(source.id)
    );
  }

  renderSources();
  sourceSelectionChanged();
}


function deselectAllSources() {
  selectedSourceIds.clear();

  renderSources();
  sourceSelectionChanged();
}


function useRecentSites() {
  selectedSiteIds.clear();

  for (
    const id
    of recentSiteIds
  ) {
    selectedSiteIds.add(id);
  }

  renderSites();
  updateSelectionSummary();
}


async function loadOptions() {
  try {
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
        `HTTP ${response.status}`
      );
    }

    sites =
      Array.isArray(payload.sites)
        ? payload.sites
        : [];

    sources =
      Array.isArray(payload.sources)
        ? payload.sources
        : [];

    recentSiteIds =
      new Set(
        (
          payload.recent_site_ids ||
          []
        ).map(Number)
      );

    if (
      recentSiteIds.size > 0
    ) {
      recentSitesMessage.textContent =
        `${recentSiteIds.size} newly added Site` +
        `${recentSiteIds.size === 1 ? "" : "s"} ` +
        `found since the last successful evidence link.`;

      recentSitesPanel.hidden =
        false;
    } else {
      recentSitesPanel.hidden =
        true;
    }

    renderSites();
    renderSources();

    updateSelectionSummary();

    statusElement.hidden =
      true;

    contentElement.hidden =
      false;
  } catch (error) {
    console.error(error);

    statusElement.textContent =
      "Unable to load Site/Source linking options.";
  }
}


function resetAfterSuccess() {
  selectedSiteIds.clear();
  selectedSourceIds.clear();

  sourceOrderInput.value =
    "1";

  metalsInput.value =
    "";

  exposurePeriodsInput.value =
    "";

  notesInput.value =
    "";

  updateSiteSummaryInput.checked =
    true;

  lastSourceSignature =
    "";

  renderSites();
  renderSources();

  sourceMetadataSuggestion.hidden =
    true;

  updateSelectionSummary();
}


async function attachSelected() {
  if (
    selectedSiteIds.size === 0
  ) {
    messageElement.textContent =
      "Select at least one Site.";

    messageElement.className =
      "save-message save-message-error";

    messageElement.hidden =
      false;

    return;
  }

  if (
    selectedSourceIds.size === 0
  ) {
    messageElement.textContent =
      "Select at least one Source.";

    messageElement.className =
      "save-message save-message-error";

    messageElement.hidden =
      false;

    return;
  }

  const sourceOrder =
    Number(sourceOrderInput.value);

  if (
    !Number.isInteger(sourceOrder) ||
    sourceOrder < 1 ||
    sourceOrder > 99
  ) {
    messageElement.textContent =
      "Source order must be an integer from 1 to 99.";

    messageElement.className =
      "save-message save-message-error";

    messageElement.hidden =
      false;

    return;
  }

  const pairCount =
    selectedSiteIds.size *
    selectedSourceIds.size;

  attachButton.disabled =
    true;

  attachButton.textContent =
    `Saving ${pairCount} link${pairCount === 1 ? "" : "s"}…`;

  messageElement.hidden =
    true;

  try {
    const response =
      await fetch(
        "/api/site-source-links/bulk",
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
              site_ids:
                [...selectedSiteIds],

              source_ids:
                [...selectedSourceIds],

              source_order:
                sourceOrder,

              metals:
                metalsInput.value,

              exposure_periods:
                exposurePeriodsInput.value,

              notes:
                notesInput.value,

              update_site_summary:
                updateSiteSummaryInput.checked,
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

    let message =
      `Created or updated ${payload.changed_count} ` +
      `Site–Source link` +
      `${payload.changed_count === 1 ? "" : "s"}.`;

    if (
      payload.summary_updated_count > 0
    ) {
      message +=
        ` Site-level metal and exposure-period ` +
        `fields were merged for ` +
        `${payload.summary_updated_count} Site` +
        `${payload.summary_updated_count === 1 ? "" : "s"}.`;
    }

    if (payload.warning) {
      message +=
        ` Warning: ${payload.warning}`;
    }

    messageElement.textContent =
      message;

    messageElement.className =
      payload.warning
        ? "save-message save-message-warning"
        : "save-message save-message-success";

    messageElement.hidden =
      false;

    resetAfterSuccess();

    /*
     * Reload because a successful link resets
     * the "newly added Sites" baseline.
     */
    await loadOptions();
  } catch (error) {
    console.error(error);

    messageElement.textContent =
      error.message ||
      "Unable to attach selected Sources.";

    messageElement.className =
      "save-message save-message-error";

    messageElement.hidden =
      false;
  } finally {
    attachButton.disabled =
      false;

    attachButton.textContent =
      "Attach selected Sources";
  }
}


siteFilter.addEventListener(
  "input",
  renderSites
);

sourceFilter.addEventListener(
  "input",
  renderSources
);

selectAllSitesButton.addEventListener(
  "click",
  selectAllSites
);

deselectAllSitesButton.addEventListener(
  "click",
  deselectAllSites
);

selectAllSourcesButton.addEventListener(
  "click",
  selectAllSources
);

deselectAllSourcesButton.addEventListener(
  "click",
  deselectAllSources
);

useRecentSitesButton.addEventListener(
  "click",
  useRecentSites
);

attachButton.addEventListener(
  "click",
  attachSelected
);


loadOptions();