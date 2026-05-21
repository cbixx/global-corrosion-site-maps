(function () {
  const currentPath = window.location.pathname;

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/map/", label: "Map" },
    { href: "/tools/", label: "Tools" },
    { href: "/policy/", label: "Policy" },
    { href: "/about/", label: "About" },
    { href: "/methodology/", label: "Methodology" }
  ];

  function isActive(href) {
    if (href === "/") {
      return currentPath === "/" || currentPath === "/index.html";
    }
    return currentPath.startsWith(href);
  }

  function createHeader() {
    const header = document.createElement("header");
    header.className = "site-header";

    header.innerHTML = `
      <a class="site-brand" href="/" aria-label="Corrosion Atlas home">
        <img class="site-brand-logo" src="/assets/icons/corrosion-atlas-logo-compact.svg?v=1" alt="Corrosion Atlas">
      </a>

      <nav class="site-nav" aria-label="Main navigation">
        ${navItems.map(item => `
          <a class="site-nav-link ${isActive(item.href) ? "is-active" : ""}" href="${item.href}">
            ${item.label}
          </a>
        `).join("")}
      </nav>
    `;

    return header;
  }

  function createFooter() {
    const footer = document.createElement("footer");
    footer.className = "site-footer";

    footer.innerHTML = `
      <div class="site-footer-inner">
        <p>
          <strong>Corrosion Atlas</strong> is a curated geospatial platform for corrosion exposure-site data,
          material-specific records, exposure periods, corrosion-rate data, environmental classifications,
          and source evidence.
        </p>
        <p class="site-footer-links">
          <a href="/map/">Map</a>
          <span aria-hidden="true">·</span>
          <a href="/tools/">Tools</a>
          <span aria-hidden="true">·</span>
          <a href="/policy/">Citation & Data Use</a>
          <span aria-hidden="true">·</span>
          <a href="/about/">About</a>
          <span aria-hidden="true">·</span>
          <a href="/methodology/">Methodology</a>
        </p>
      </div>
    `;

    return footer;
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.querySelector(".site-header")) {
      document.body.prepend(createHeader());
    }

    if (!document.querySelector(".site-footer")) {
      document.body.appendChild(createFooter());
    }
  });
})();