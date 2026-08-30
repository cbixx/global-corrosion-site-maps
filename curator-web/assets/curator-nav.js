function installCuratorFavicon() {
  let favicon =
    document.querySelector(
      'link[rel~="icon"]'
    );


  if (!favicon) {
    favicon =
      document.createElement(
        "link"
      );

    favicon.rel =
      "icon";

    document.head.append(
      favicon
    );
  }


  favicon.type =
    "image/svg+xml";

  favicon.href =
    "/assets/icons/curator-favicon.svg";
}

installCuratorFavicon();

const CURATOR_NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/",
    match: ["/"],
  },

  {
    label: "Sites",
    href: "/sites/",
    match: [
      "/sites",
      "/sites/",
      "/sites/detail/",
    ],
  },

  {
    label: "Sources",
    href: "/sources/",
    match: [
      "/sources",
      "/sources/",
      "/sources/detail/",
    ],
  },

  {
    label: "Evidence Links",
    href: "/links/",
    match: [
      "/links",
      "/links/",
    ],
  },

  {
    label: "Corrosion",
    href: "/corrosion/",
    match: [
      "/corrosion",
      "/corrosion/",
    ],
  },

  {
    label: "Manage Records",
    href: "/manage/",
    match: [
      "/manage",
      "/manage/",
    ],
  },

  {
    label:
      "Export / Publish",

    href:
      "/publish/",

    match: [
      "/publish",
      "/publish/",
    ],
  },

  {
    label:
      "Settings",

    href:
      "/settings/",

    match: [
      "/settings",
      "/settings/",
    ],
  },
];


function curatorNavMatches(
  pathname,
  item
) {
  if (
    item.href === "/"
  ) {
    return pathname === "/";
  }


  return item.match.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(prefix)
  );
}


function buildCuratorNavigation() {
  const header =
    document.querySelector(
      ".app-header"
    );


  if (
    !header ||
    header.querySelector(
      ".curator-nav"
    )
  ) {
    return;
  }


  const nav =
    document.createElement(
      "nav"
    );

  nav.className =
    "curator-nav";

  nav.setAttribute(
    "aria-label",
    "Curator navigation"
  );


  const pathname =
    window.location.pathname;


  for (
    const item
    of CURATOR_NAV_ITEMS
  ) {
    const link =
      document.createElement(
        "a"
      );

    link.className =
      "curator-nav-link";

    link.href =
      item.href;

    link.textContent =
      item.label;


    if (
      curatorNavMatches(
        pathname,
        item
      )
    ) {
      link.classList.add(
        "curator-nav-link-active"
      );

      link.setAttribute(
        "aria-current",
        "page"
      );
    }


    nav.append(
      link
    );
  }


  header.append(
    nav
  );
}


buildCuratorNavigation();