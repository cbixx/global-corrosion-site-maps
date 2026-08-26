const statusElement =
  document.getElementById("dashboard-status");

const contentElement =
  document.getElementById("dashboard-content");

const sitesElement =
  document.getElementById("dashboard-sites");

const sourcesElement =
  document.getElementById("dashboard-sources");

const linksElement =
  document.getElementById("dashboard-links");

const corrosionElement =
  document.getElementById("dashboard-corrosion");

const environmentElement =
  document.getElementById("dashboard-environment");

async function loadDashboard() {
  try {
    const response =
      await fetch("/api/dashboard-summary", {
        headers: {
          accept: "application/json",
        },
      });

    const payload =
      await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(
        payload.error ||
        `HTTP ${response.status}`
      );
    }

    const counts =
      payload.counts || {};

    sitesElement.textContent =
      counts.sites ?? "—";

    sourcesElement.textContent =
      counts.sources ?? "—";

    linksElement.textContent =
      counts.site_sources ?? "—";

    corrosionElement.textContent =
      counts.corrosion_observations ?? "—";

    environmentElement.textContent =
      counts.environmental_observations ?? "—";

    statusElement.hidden = true;
    contentElement.hidden = false;
  } catch (error) {
    console.error(
      "Unable to load curator dashboard.",
      error
    );

    statusElement.textContent =
      "Unable to load database summary.";

    /*
     * Navigation itself remains useful even if
     * the statistics request fails.
     */
    contentElement.hidden = false;
  }
}

loadDashboard();