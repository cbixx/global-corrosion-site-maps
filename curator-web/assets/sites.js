let allSites = [];

const searchInput = document.getElementById("site-search");
const siteList = document.getElementById("site-list");
const statusElement = document.getElementById("status");
const siteCount = document.getElementById("site-count");

function normalise(value) {
  return String(value || "").trim().toLowerCase();
}

function siteMatches(site, query) {
  if (!query) {
    return true;
  }

  return [
    site.site_id,
    site.site_label,
    site.site_type,
    site.modern_country_location,
    site.administering_country,
    site.region_category,
  ]
    .map(normalise)
    .join(" ")
    .includes(query);
}

function renderSites(sites) {
  siteList.replaceChildren();

  siteCount.textContent =
    `${sites.length} site${sites.length === 1 ? "" : "s"}`;

  if (sites.length === 0) {
    statusElement.textContent = "No sites match your search.";
    statusElement.hidden = false;
    siteList.hidden = true;
    return;
  }

  for (const site of sites) {
    const item = document.createElement("a");
    item.className = "source-item";
    item.href = `/sites/detail/?id=${encodeURIComponent(site.id)}`;

    const code = document.createElement("div");
    code.className = "source-code";
    code.textContent = site.site_id || "";

    const content = document.createElement("div");
    content.className = "source-content";

    const title = document.createElement("div");
    title.className = "source-title";
    title.textContent = site.site_label || "(Unnamed site)";

    const location = document.createElement("div");
    location.className = "source-authors";
    location.textContent =
      site.modern_country_location ||
      site.administering_country ||
      "No location information";

    const metadata = document.createElement("div");
    metadata.className = "source-metadata";

    metadata.textContent = [
      site.site_type,
      site.region_category,
    ]
      .filter(Boolean)
      .join(" · ");

    content.append(title, location, metadata);
    item.append(code, content);

    siteList.append(item);
  }

  statusElement.hidden = true;
  siteList.hidden = false;
}

function applySearch() {
  const query = normalise(searchInput.value);

  renderSites(
    allSites.filter((site) => siteMatches(site, query))
  );
}

async function loadSites() {
  try {
    const response = await fetch("/api/sites", {
      headers: { accept: "application/json" },
    });

    const payload = await response.json();

    if (!response.ok || !payload.ok || !Array.isArray(payload.sites)) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    allSites = payload.sites;
    renderSites(allSites);
  } catch (error) {
    console.error("Unable to load sites.", error);

    statusElement.textContent =
      "Unable to load sites from the database.";

    statusElement.hidden = false;
    siteList.hidden = true;
  }
}

searchInput.addEventListener("input", applySearch);

loadSites();