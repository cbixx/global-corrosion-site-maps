const statusElement =
  document.getElementById(
    "publish-status"
  );

const contentElement =
  document.getElementById(
    "publish-content"
  );

const curatedCount =
  document.getElementById(
    "publish-curated-count"
  );

const currentCount =
  document.getElementById(
    "publish-current-count"
  );

const selectedCount =
  document.getElementById(
    "publish-selected-count"
  );

const duplicateWarning =
  document.getElementById(
    "publish-duplicate-warning"
  );

const searchInput =
  document.getElementById(
    "publish-search"
  );

const unpublishedContainer =
  document.getElementById(
    "publish-unpublished"
  );

const publishedContainer =
  document.getElementById(
    "publish-published"
  );

const selectUnpublished =
  document.getElementById(
    "publish-select-unpublished"
  );

const clearUnpublished =
  document.getElementById(
    "publish-clear-unpublished"
  );

const selectPublished =
  document.getElementById(
    "publish-select-published"
  );

const clearPublished =
  document.getElementById(
    "publish-clear-published"
  );

const includeCorrosion =
  document.getElementById(
    "publish-include-corrosion"
  );

const includeEnvironment =
  document.getElementById(
    "publish-include-environment"
  );

const downloadButton =
  document.getElementById(
    "publish-download"
  );

const resultElement =
  document.getElementById(
    "publish-result"
  );

const githubConfig =
  document.getElementById(
    "publish-github-config"
  );

const commitMessageInput =
  document.getElementById(
    "publish-commit-message"
  );

const githubConfirm =
  document.getElementById(
    "publish-github-confirm"
  );

const githubButton =
  document.getElementById(
    "publish-github-button"
  );

const githubResult =
  document.getElementById(
    "publish-github-result"
  );

const githubFiles =
  document.getElementById(
    "publish-github-files"
  );


let githubConfigured =
  false;


let publishRows = [];

const selectedIds =
  new Set();

let duplicateSiteIds = [];

function updateGithubButton() {
  githubButton.disabled =
    !(
      githubConfigured &&
      githubConfirm.checked &&
      selectedIds.size > 0 &&
      duplicateSiteIds.length ===
        0
    );
}


function resetGithubConfirmation() {
  githubConfirm.checked =
    false;

  updateGithubButton();
}

function matchesSearch(
  row,
  query
) {
  if (!query) {
    return true;
  }

  const haystack =
    [
      row.site_id,
      row.site_label,
      row.site_type,
      row.modern_country_location,
      row.region_category,
      row.metal,
      row.exposure_period,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();

  return haystack.includes(
    query
  );
}


function updateSelectedCount() {
  selectedCount.textContent =
    String(
      selectedIds.size
    );
}


function createSiteRow(
  site
) {
  const label =
    document.createElement(
      "label"
    );

  label.className =
    "publish-site-row";


  const checkbox =
    document.createElement(
      "input"
    );

  checkbox.type =
    "checkbox";

  checkbox.checked =
    selectedIds.has(
      Number(
        site.site_db_id
      )
    );


  checkbox.addEventListener(
    "change",
    () => {
      const id =
        Number(
          site.site_db_id
        );

      if (
        checkbox.checked
      ) {
        selectedIds.add(
          id
        );

      } else {
        selectedIds.delete(
          id
        );
      }

      updateSelectedCount();
      resetGithubConfirmation();
    }
  );


  const content =
    document.createElement(
      "div"
    );

  content.className =
    "publish-site-content";


  const title =
    document.createElement(
      "strong"
    );

  title.textContent =
    `${site.site_id || "Unknown Site"} — ` +
    `${site.site_label || "(Unnamed Site)"}`;


  const metadata =
    document.createElement(
      "span"
    );

  metadata.textContent =
    [
      site.modern_country_location,
      site.region_category,
      site.metal,
      `${site.source_count || 0} source(s)`,
    ]
      .filter(Boolean)
      .join(" · ");


  content.append(
    title,
    metadata
  );


  label.append(
    checkbox,
    content
  );

  return label;
}


function renderSites() {
  const query =
    String(
      searchInput.value ||
      ""
    )
      .trim()
      .toLocaleLowerCase();


  unpublishedContainer
    .replaceChildren();

  publishedContainer
    .replaceChildren();


  const visible =
    publishRows.filter(
      (row) =>
        matchesSearch(
          row,
          query
        )
    );


  const unpublished =
    visible.filter(
      (row) =>
        !row.is_already_published
    );

  const published =
    visible.filter(
      (row) =>
        row.is_already_published
    );


  for (
    const site
    of unpublished
  ) {
    unpublishedContainer.append(
      createSiteRow(
        site
      )
    );
  }


  for (
    const site
    of published
  ) {
    publishedContainer.append(
      createSiteRow(
        site
      )
    );
  }


  if (
    unpublished.length ===
    0
  ) {
    unpublishedContainer.textContent =
      "No matching unpublished Sites.";
  }


  if (
    published.length ===
    0
  ) {
    publishedContainer.textContent =
      "No matching published Sites.";
  }
}


function setGroupSelection(
  isPublished,
  selected
) {
  for (
    const site
    of publishRows
  ) {
    if (
      Boolean(
        site.is_already_published
      ) !==
      isPublished
    ) {
      continue;
    }

    const id =
      Number(
        site.site_db_id
      );

    if (
      selected
    ) {
      selectedIds.add(
        id
      );

    } else {
      selectedIds.delete(
        id
      );
    }
  }

  updateSelectedCount();
  renderSites();
  resetGithubConfirmation();
}

async function loadGithubStatus() {
  try {
    const response =
      await fetch(
        "/api/publish-github-status",
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


    githubConfigured =
      Boolean(
        payload.configured
      );


    if (
      githubConfigured
    ) {
      githubConfig.textContent =
        `${payload.owner}/${payload.repo} · ${payload.branch}`;

      githubConfig.className =
        "publish-github-config publish-github-config-ready";

    } else {
      githubConfig.textContent =
        "GitHub publishing is not configured.";

      githubConfig.className =
        "publish-github-config publish-github-config-missing";
    }


    updateGithubButton();

  } catch (error) {
    console.error(
      "Unable to load GitHub publish status.",
      error
    );


    githubConfigured =
      false;

    githubConfig.textContent =
      error.message ||
      "Unable to check GitHub configuration.";

    githubConfig.className =
      "publish-github-config publish-github-config-missing";

    updateGithubButton();
  }
}

async function loadPublishPreview() {
  statusElement.textContent =
    "Loading publish state…";

  statusElement.hidden =
    false;

  contentElement.hidden =
    true;


  try {
    const response =
      await fetch(
        "/api/publish-preview",
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


    publishRows =
      Array.isArray(
        payload.rows
      )
        ? payload.rows
        : [];


    duplicateSiteIds =
      Array.isArray(
        payload
          .duplicate_site_ids
      )
        ? payload
            .duplicate_site_ids
        : [];


    selectedIds.clear();


    /*
     * Preserve legacy default:
     * currently published = selected,
     * unpublished = not selected.
     */
    for (
      const site
      of publishRows
    ) {
      if (
        site.is_already_published
      ) {
        selectedIds.add(
          Number(
            site.site_db_id
          )
        );
      }
    }


    curatedCount.textContent =
      String(
        payload.counts
          ?.curated ||
        0
      );

    currentCount.textContent =
      String(
        payload.counts
          ?.published ||
        0
      );


    updateSelectedCount();


    if (
      duplicateSiteIds.length
    ) {
      duplicateWarning.textContent =
        "Duplicate site_id values must be fixed before export: " +
        duplicateSiteIds.join(
          ", "
        );

      duplicateWarning.hidden =
        false;

      downloadButton.disabled =
        true;

    } else {
      duplicateWarning.hidden =
        true;

      downloadButton.disabled =
        false;
    }


    renderSites();


    statusElement.hidden =
      true;

    contentElement.hidden =
      false;

  } catch (error) {
    console.error(
      "Unable to load publish preview.",
      error
    );

    statusElement.textContent =
      error.message ||
      "Unable to load publish preview.";
  }
}


searchInput.addEventListener(
  "input",
  renderSites
);


selectUnpublished.addEventListener(
  "click",
  () => {
    setGroupSelection(
      false,
      true
    );
  }
);


clearUnpublished.addEventListener(
  "click",
  () => {
    setGroupSelection(
      false,
      false
    );
  }
);


selectPublished.addEventListener(
  "click",
  () => {
    setGroupSelection(
      true,
      true
    );
  }
);


clearPublished.addEventListener(
  "click",
  () => {
    setGroupSelection(
      true,
      false
    );
  }
);


downloadButton.addEventListener(
  "click",
  async () => {
    if (
      selectedIds.size ===
      0
    ) {
      resultElement.textContent =
        "Select at least one Site.";

      resultElement.className =
        "save-message save-message-error";

      resultElement.hidden =
        false;

      return;
    }


    downloadButton.disabled =
      true;

    downloadButton.textContent =
      "Generating…";


    resultElement.textContent =
      "Generating public website datasets…";

    resultElement.className =
      "save-message";

    resultElement.hidden =
      false;


    try {
      const response =
        await fetch(
          "/api/publish-package",
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",

              accept:
                "application/zip, application/json",
            },

            body:
              JSON.stringify({
                site_ids:
                  [
                    ...selectedIds,
                  ],

                include_corrosion:
                  includeCorrosion.checked,

                include_environment:
                  includeEnvironment.checked,
              }),
          }
        );


      if (!response.ok) {
        let message =
          `HTTP ${response.status}`;

        try {
          const payload =
            await response.json();

          message =
            payload.error ||
            message;

        } catch {
          // Non-JSON error.
        }

        throw new Error(
          message
        );
      }


      const blob =
        await response.blob();


      let fileName =
        "corrosion-atlas-website-data.zip";


      const disposition =
        response.headers.get(
          "content-disposition"
        ) ||
        "";


      const match =
        disposition.match(
          /filename="([^"]+)"/i
        );


      if (match) {
        fileName =
          match[1];
      }


      const url =
        URL.createObjectURL(
          blob
        );


      const anchor =
        document.createElement(
          "a"
        );


      anchor.href =
        url;

      anchor.download =
        fileName;


      document.body.append(
        anchor
      );

      anchor.click();

      anchor.remove();


      setTimeout(
        () =>
          URL.revokeObjectURL(
            url
          ),
        1000
      );


      const sites =
        response.headers.get(
          "x-publish-sites"
        ) ||
        "0";

      const sources =
        response.headers.get(
          "x-publish-sources"
        ) ||
        "0";

      const corrosion =
        response.headers.get(
          "x-publish-corrosion"
        ) ||
        "0";

      const environment =
        response.headers.get(
          "x-publish-environment"
        ) ||
        "0";


      resultElement.textContent =
        `Exported ${sites} Site(s), ` +
        `${sources} public Source(s), ` +
        `${corrosion} corrosion observation(s), and ` +
        `${environment} environmental observation(s).`;

      resultElement.className =
        "save-message save-message-success";

    } catch (error) {
      console.error(
        "Website package export failed.",
        error
      );

      resultElement.textContent =
        error.message ||
        "Unable to generate website package.";

      resultElement.className =
        "save-message save-message-error";

    } finally {
      downloadButton.disabled =
        duplicateSiteIds.length >
        0;

      downloadButton.textContent =
        "Download website package";
    }
  }
);

githubConfirm.addEventListener(
  "change",
  updateGithubButton
);


includeCorrosion.addEventListener(
  "change",
  resetGithubConfirmation
);


includeEnvironment.addEventListener(
  "change",
  resetGithubConfirmation
);


githubButton.addEventListener(
  "click",
  async () => {
    if (
      !githubConfirm.checked ||
      selectedIds.size === 0
    ) {
      return;
    }


    githubButton.disabled =
      true;

    githubButton.textContent =
      "Publishing…";


    githubResult.textContent =
      "Regenerating website datasets and publishing them to GitHub…";

    githubResult.className =
      "save-message";

    githubResult.hidden =
      false;


    githubFiles.hidden =
      true;

    githubFiles.replaceChildren();


    try {
      const response =
        await fetch(
          "/api/publish-github",
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
                site_ids:
                  [
                    ...selectedIds,
                  ],

                include_corrosion:
                  includeCorrosion
                    .checked,

                include_environment:
                  includeEnvironment
                    .checked,

                commit_message:
                  commitMessageInput
                    .value
                    .trim(),

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
        const error =
          new Error(
            payload.error ||
            `HTTP ${response.status}`
          );

        error.payload =
          payload;

        throw error;
      }


      const github =
        payload.github ||
        {};

      const counts =
        payload.counts ||
        {};


      githubResult.textContent =
        `Published ${counts.sites || 0} Site(s), ` +
        `${counts.sources || 0} Source(s), ` +
        `${counts.corrosion || 0} corrosion observation(s), and ` +
        `${counts.environment || 0} environmental observation(s). ` +
        `${github.changed_count || 0} GitHub file(s) changed; ` +
        `${github.skipped_count || 0} unchanged file(s) skipped.`;

      githubResult.className =
        "save-message save-message-success";

      githubResult.hidden =
        false;


      const uploads =
        Array.isArray(
          github.uploads
        )
          ? github.uploads
          : [];


      for (
        const upload
        of uploads
      ) {
        const row =
          document.createElement(
            "div"
          );

        row.className =
          "publish-github-file";


        const path =
          document.createElement(
            upload.html_url
              ? "a"
              : "span"
          );


        path.textContent =
          upload.path;

        if (
          upload.html_url
        ) {
          path.href =
            upload.html_url;

          path.target =
            "_blank";

          path.rel =
            "noopener";
        }


        const action =
          document.createElement(
            "span"
          );

        action.className =
          "publish-github-file-action";

        action.textContent =
          upload.action;


        row.append(
          path,
          action
        );

        githubFiles.append(
          row
        );
      }


      githubFiles.hidden =
        uploads.length ===
        0;


      githubConfirm.checked =
        false;

      updateGithubButton();


      /*
       * GitHub data/sites.csv is now authoritative,
       * so reload the two published/unpublished groups.
       */
      await loadPublishPreview();

    } catch (error) {
      console.error(
        "GitHub publish failed.",
        error
      );


      githubResult.textContent =
        error.message ||
        "Unable to publish website datasets to GitHub.";

      githubResult.className =
        "save-message save-message-error";

      githubResult.hidden =
        false;


      const uploads =
        error.payload
          ?.github
          ?.uploads;


      if (
        Array.isArray(
          uploads
        ) &&
        uploads.length
      ) {
        githubFiles.textContent =
          "Some files were already updated before the failure. " +
          "Check the GitHub repository before retrying.";

        githubFiles.hidden =
          false;
      }


      updateGithubButton();

    } finally {
      githubButton.textContent =
        "Publish to GitHub";
    }
  }
);


loadPublishPreview();
loadGithubStatus();