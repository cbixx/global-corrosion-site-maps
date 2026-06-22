(function () {
  "use strict";

  const currentPath = normalizePath(window.location.pathname || "/");
  const isZh = currentPath.startsWith("/zh/");
  const locale = isZh ? "zh" : "en";
  const dictionary = window.CorrosionAtlasI18n?.[locale];

  if (!dictionary) {
    console.error("Corrosion Atlas shared i18n dictionary was not loaded.");
    return;
  }

  const routePairs = {
    "/": "/zh/",
    "/map/": "/zh/map/",
    "/tools/": "/zh/tools/",
    "/tools/color-compatible-repair/": "/zh/tools/color-compatible-repair/",
    "/tools/lsdyna-deck/": "/zh/tools/lsdyna-deck/",
    "/reports/": "/zh/reports/",
    "/policy/": "/zh/policy/",
    "/about/": "/zh/about/",
    "/methodology/": "/zh/methodology/"
  };

  const navItems = [
    { href: "/", key: "home" },
    { href: "/map/", key: "map" },
    { href: "/tools/", key: "tools" },
    { href: "/reports/", key: "reports" },
    { href: "/policy/", key: "policy" },
    { href: "/about/", key: "about" },
    { href: "/methodology/", key: "methodology" }
  ];

  const footerItems = [
    { href: "/map/", key: "map" },
    { href: "/tools/", key: "tools" },
    { href: "/reports/", key: "reports" },
    { href: "/policy/", key: "policy" },
    { href: "/about/", key: "about" },
    { href: "/methodology/", key: "methodology" }
  ];

  function normalizePath(pathname) {
    let path = pathname.replace(/\/index\.html$/, "/");

    if (!path.startsWith("/")) {
      path = `/${path}`;
    }

    if (!path.endsWith("/") && !path.includes(".")) {
      path = `${path}/`;
    }

    return path;
  }

  function routeForLocale(englishPath, targetLocale) {
    if (targetLocale === "en") {
      return englishPath;
    }

    return routePairs[englishPath] || `/zh${englishPath}`;
  }

  function englishToChinesePath(pathname) {
    return routePairs[pathname] || `/zh${pathname}`;
  }

  function chineseToEnglishPath(pathname) {
    if (pathname.startsWith("/zh/reports/prestress/")) {
      return "/reports/";
    }

    const matchedRoute = Object.entries(routePairs).find(
      ([, chinesePath]) => chinesePath === pathname
    );

    if (matchedRoute) {
      return matchedRoute[0];
    }

    return pathname.replace(/^\/zh/, "") || "/";
  }

  function languageDestination() {
    return isZh
      ? chineseToEnglishPath(currentPath)
      : englishToChinesePath(currentPath);
  }

  function isActive(englishPath) {
    const localPath = routeForLocale(englishPath, locale);

    if (localPath === "/" || localPath === "/zh/") {
      return currentPath === localPath;
    }

    return currentPath.startsWith(localPath);
  }

  function createHeader() {
    const homeHref = isZh ? "/zh/" : "/";

    const header = document.createElement("header");
    header.className = "site-header";

    header.innerHTML = `
      <a class="site-brand" href="${homeHref}" aria-label="${dictionary.brandHomeLabel}">
        <img
          class="site-brand-logo"
          src="/assets/icons/corrosion-atlas-logo-compact.svg?v=1"
          alt="Corrosion Atlas"
        >
      </a>

      <nav class="site-nav" aria-label="${dictionary.navigationLabel}">
        ${navItems.map((item) => {
          const href = routeForLocale(item.href, locale);
          const active = isActive(item.href);

          return `
            <a
              class="site-nav-link ${active ? "is-active" : ""}"
              href="${href}"
              ${active ? 'aria-current="page"' : ""}
            >
              ${dictionary.nav[item.key]}
            </a>
          `;
        }).join("")}

        <a
          class="site-lang-switch"
          href="${languageDestination()}"
          aria-label="${dictionary.languageSwitch.ariaLabel}"
        >
          ${dictionary.languageSwitch.label}
        </a>
      </nav>
    `;

    return header;
  }

  function createFooter() {
    const footer = document.createElement("footer");
    footer.className = "site-footer";

    footer.innerHTML = `
      <div class="site-footer-inner">
        <p>${dictionary.footer.description}</p>

        <p class="site-footer-links">
          ${footerItems.map((item, index) => {
            const separator = index === 0
              ? ""
              : '<span aria-hidden="true">·</span>';

            return `
              ${separator}
              <a href="${routeForLocale(item.href, locale)}">
                ${dictionary.footer[item.key]}
              </a>
            `;
          }).join("")}
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