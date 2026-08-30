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
    label: "Export / Publish",
    href: "/publish/",
    match: [
      "/publish",
      "/publish/",
    ],
  },

  {
    label: "Settings",
    href: "/settings/",
    match: [
      "/settings",
      "/settings/",
    ],
  },
];


let curatorI18nPromise =
  null;


function ensureCuratorI18n() {
  if (
    window.CuratorI18n
  ) {
    return Promise.resolve(
      window.CuratorI18n
    );
  }


  if (
    curatorI18nPromise
  ) {
    return curatorI18nPromise;
  }


  curatorI18nPromise =
    new Promise(
      (
        resolve,
        reject
      ) => {
        const script =
          document.createElement(
            "script"
          );


        script.src =
          "/assets/curator-i18n.js?v=1";

        script.async =
          true;


        script.onload =
          () => {
            if (
              window.CuratorI18n
            ) {
              resolve(
                window.CuratorI18n
              );
            } else {
              reject(
                new Error(
                  "Curator i18n runtime did not initialise."
                )
              );
            }
          };


        script.onerror =
          () => {
            reject(
              new Error(
                "Unable to load curator i18n runtime."
              )
            );
          };


        document.head.append(
          script
        );
      }
    );


  return curatorI18nPromise;
}


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
      pathname.startsWith(
        prefix
      )
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


function buildLanguageSwitcher() {
  const header =
    document.querySelector(
      ".app-header"
    );


  const i18n =
    window.CuratorI18n;


  if (
    !header ||
    !i18n ||
    header.querySelector(
      ".curator-language-switcher"
    )
  ) {
    return;
  }


  const switcher =
    document.createElement(
      "div"
    );


  switcher.className =
    "curator-language-switcher";


  switcher.setAttribute(
    "aria-label",
    "Interface language"
  );


  switcher.title =
    "Switch language";


  const buttons =
    [];


  for (
    const option
    of [
      {
        language: "en",
        label: "EN",
      },

      {
        language: "zh",
        label: "中文",
      },
    ]
  ) {
    const button =
      document.createElement(
        "button"
      );


    button.type =
      "button";

    button.className =
      "curator-language-button";

    button.dataset.language =
      option.language;

    button.textContent =
      option.label;


    button.addEventListener(
      "click",
      () => {
        i18n.setLanguage(
          option.language
        );
      }
    );


    buttons.push(
      button
    );


    switcher.append(
      button
    );
  }


  function updateActiveLanguage() {
    const current =
      i18n.getLanguage();


    for (
      const button
      of buttons
    ) {
      const active =
        button.dataset.language ===
        current;


      button.classList.toggle(
        "curator-language-button-active",
        active
      );


      button.setAttribute(
        "aria-pressed",
        String(active)
      );
    }
  }


  updateActiveLanguage();


  window.addEventListener(
    "curator-language-change",
    updateActiveLanguage
  );


  header.append(
    switcher
  );


  i18n.apply(
    switcher
  );
}


async function initialiseCuratorShell() {
  try {
    await ensureCuratorI18n();
  } catch (error) {
    console.error(
      "Unable to initialise curator translations.",
      error
    );
  }


  buildCuratorNavigation();

  buildLanguageSwitcher();


  if (
    window.CuratorI18n
  ) {
    window.CuratorI18n.apply(
      document
    );
  }
}


initialiseCuratorShell();