(function () {
  "use strict";

  function getTargetForLink(link) {
    const id = (link.getAttribute("href") || "").slice(1);
    const target = document.getElementById(id);

    if (!target) {
      return null;
    }

    // Top-level TOC entries point to section containers. Observe their H2 so
    // the scroll state changes when a new section heading reaches the viewport.
    if (target.classList.contains("section")) {
      return target.querySelector(".section-title") || target;
    }

    return target;
  }

  function initialiseHeadingLinks() {
    const headings = document.querySelectorAll(
      ".report-article .section-title, .report-article h3, .report-sources h2"
    );

    headings.forEach(function (heading) {
      let targetId = heading.id;

      if (heading.classList.contains("section-title")) {
        const section = heading.closest(".section");
        targetId = section ? section.id : targetId;
      }

      if (heading.closest(".report-sources")) {
        targetId = "sources";
      }

      if (!targetId || heading.querySelector(".section-anchor")) {
        return;
      }

      const anchor = document.createElement("a");
      anchor.className = "section-anchor";
      anchor.href = "#" + targetId;
      anchor.setAttribute("aria-label", "复制此章节链接");
      anchor.title = "复制此章节链接";
      anchor.textContent = "§";

      heading.appendChild(anchor);
    });
  }

  function initialiseTableOfContents() {
    const toc = document.querySelector(".report-toc");
    if (!toc) {
      return;
    }

    const details = toc.querySelector("details");
    const links = Array.from(toc.querySelectorAll('a[href^="#"]'));
    const records = links
      .map(function (link) {
        const id = (link.getAttribute("href") || "").slice(1);
        const target = getTargetForLink(link);

        return target ? { id: id, link: link, target: target } : null;
      })
      .filter(Boolean);

    if (!records.length) {
      return;
    }

    function activate(id) {
      links.forEach(function (link) {
        const selected = link.getAttribute("href") === "#" + id;
        link.classList.toggle("is-active", selected);

        if (selected) {
          link.setAttribute("aria-current", "location");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    links.forEach(function (link) {
      link.addEventListener("click", function () {
        const id = (link.getAttribute("href") || "").slice(1);

        // On small screens, collapse the long directory after a destination
        // has been chosen, while leaving it expanded on desktop.
        if (window.matchMedia("(max-width: 820px)").matches && details) {
          details.open = false;
        }

        activate(id);
      });
    });

    const initialId = window.location.hash.slice(1);
    if (initialId && records.some(function (record) { return record.id === initialId; })) {
      activate(initialId);
    } else {
      activate(records[0].id);
    }

    if (!("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      function (entries) {
        const visible = entries
          .filter(function (entry) { return entry.isIntersecting; })
          .sort(function (a, b) {
            return a.boundingClientRect.top - b.boundingClientRect.top;
          });

        if (!visible.length) {
          return;
        }

        const matched = records.find(function (record) {
          return record.target === visible[0].target;
        });

        if (matched) {
          activate(matched.id);
        }
      },
      {
        rootMargin: "-104px 0px -68% 0px",
        threshold: [0, 0.15, 0.5]
      }
    );

    records.forEach(function (record) {
      observer.observe(record.target);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initialiseHeadingLinks();
    initialiseTableOfContents();
  });
})();
