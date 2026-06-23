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

/* Chart export: SVG and PNG */

(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  function createSvgElement(tag, attributes, text) {
    const element = document.createElementNS(SVG_NS, tag);

    Object.entries(attributes || {}).forEach(([name, value]) => {
      element.setAttribute(name, String(value));
    });

    if (text !== undefined) {
      element.textContent = text;
    }

    return element;
  }

  function getBarColor(bar) {
    if (bar.classList.contains("age-fresh")) return "#2c8c67";
    if (bar.classList.contains("age-current")) return "#337eaf";
    if (bar.classList.contains("age-aging")) return "#bf7a16";
    return "#bb4f24";
  }

  function getBarPercentage(bar) {
    const value = Number.parseFloat(
      bar.style.getPropertyValue("--bar-width")
    );

    return Number.isFinite(value)
      ? Math.max(0, Math.min(value, 100))
      : 0;
  }

  function buildChartSvg(figure) {
    const title =
      figure.querySelector("figcaption")?.textContent.trim() ||
      "图表";

    const description =
      figure.querySelector(".chart-context")?.textContent.trim() ||
      "";

    const rows = [...figure.querySelectorAll(".standards-update-chart-row")]
      .map((row) => {
        const bar = row.querySelector(".chart-bar");

        return {
          label: row.querySelector(".chart-standard")?.textContent.trim() || "",
          value: row.querySelector(".chart-value")?.textContent.trim() || "",
          percentage: bar ? getBarPercentage(bar) : 0,
          color: bar ? getBarColor(bar) : "#337eaf"
        };
      })
      .filter((row) => row.label);

    const legends = [...figure.querySelectorAll(".chart-legend li")].map((item) => {
      const swatch = item.querySelector(".legend-swatch");

      return {
        label: item.textContent.trim(),
        color: swatch
          ? window.getComputedStyle(swatch).backgroundColor
          : "#337eaf"
      };
    });

    const width = 1600;
    const height = 180 + rows.length * 52 + 95;

    const svg = createSvgElement("svg", {
      xmlns: SVG_NS,
      width: width,
      height: height,
      viewBox: `0 0 ${width} ${height}`
    });

    svg.appendChild(
      createSvgElement("rect", {
        x: 0,
        y: 0,
        width: width,
        height: height,
        rx: 22,
        fill: "#ffffff",
        stroke: "#d7dfe5",
        "stroke-width": 2
      })
    );

    svg.appendChild(
      createSvgElement(
        "text",
        {
          x: 52,
          y: 58,
          fill: "#10293a",
          "font-family": '"Noto Sans SC", "Microsoft YaHei", Arial, sans-serif',
          "font-size": 29,
          "font-weight": 750
        },
        title
      )
    );

    svg.appendChild(
      createSvgElement(
        "text",
        {
          x: 52,
          y: 102,
          fill: "#5d748a",
          "font-family": '"Noto Sans SC", "Microsoft YaHei", Arial, sans-serif',
          "font-size": 20
        },
        description
      )
    );

    const labelX = 86;
    const trackX = 525;
    const trackWidth = 760;
    const valueX = 1535;
    const rowStartY = 166;
    const rowGap = 52;

    rows.forEach((row, index) => {
      const y = rowStartY + index * rowGap;
      const fillWidth = Math.max(5, trackWidth * row.percentage / 100);

      svg.appendChild(
        createSvgElement(
          "text",
          {
            x: labelX,
            y: y,
            fill: "#183d5a",
            "font-family": '"Noto Sans SC", "Microsoft YaHei", Arial, sans-serif',
            "font-size": 19,
            "dominant-baseline": "middle"
          },
          row.label
        )
      );

      svg.appendChild(
        createSvgElement("rect", {
          x: trackX,
          y: y - 10,
          width: trackWidth,
          height: 20,
          rx: 10,
          fill: "#e4e8eb"
        })
      );

      svg.appendChild(
        createSvgElement("rect", {
          x: trackX,
          y: y - 10,
          width: fillWidth,
          height: 20,
          rx: 10,
          fill: row.color
        })
      );

      svg.appendChild(
        createSvgElement(
          "text",
          {
            x: valueX,
            y: y,
            fill: "#40627e",
            "font-family": '"Noto Sans SC", "Microsoft YaHei", Arial, sans-serif',
            "font-size": 19,
            "text-anchor": "end",
            "dominant-baseline": "middle"
          },
          row.value
        )
      );
    });

    let legendX = 52;
    const legendY = rowStartY + rows.length * rowGap + 35;

    legends.forEach((legend) => {
      svg.appendChild(
        createSvgElement("circle", {
          cx: legendX,
          cy: legendY,
          r: 8,
          fill: legend.color
        })
      );

      svg.appendChild(
        createSvgElement(
          "text",
          {
            x: legendX + 18,
            y: legendY + 1,
            fill: "#4f687d",
            "font-family": '"Noto Sans SC", "Microsoft YaHei", Arial, sans-serif',
            "font-size": 17,
            "dominant-baseline": "middle"
          },
          legend.label
        )
      );

      legendX += 118;
    });

    return svg;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function exportSvg(figure) {
    const svg = buildChartSvg(figure);
    const svgText =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      new XMLSerializer().serializeToString(svg);

    downloadBlob(
      new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }),
      "prestress-standard-update-comparison-2026.svg"
    );
  }

  async function exportPng(figure) {
    const svg = buildChartSvg(figure);
    const svgText =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      new XMLSerializer().serializeToString(svg);

    const svgBlob = new Blob(
      [svgText],
      { type: "image/svg+xml;charset=utf-8" }
    );

    const imageUrl = URL.createObjectURL(svgBlob);

    try {
      const image = new Image();

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = imageUrl;
      });

      const scale = 2;
      const width = Number(svg.getAttribute("width"));
      const height = Number(svg.getAttribute("height"));

      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;

      const context = canvas.getContext("2d");
      context.scale(scale, scale);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, width, height);

      const pngBlob = await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });

      if (!pngBlob) {
        throw new Error("PNG generation failed.");
      }

      downloadBlob(
        pngBlob,
        "prestress-standard-update-comparison-2026.png"
      );
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  }

  function initialiseChartExport() {
    const figure = document.querySelector("#fig-standard-update");

    if (!figure) return;

    const menu = figure.querySelector(".chart-export-menu");
    const status = figure.querySelector(".chart-export-status");
    const buttons = [...figure.querySelectorAll("[data-chart-export]")];

    buttons.forEach((button) => {
      button.addEventListener("click", async function () {
        const format = button.dataset.chartExport;

        buttons.forEach((item) => {
          item.disabled = true;
        });

        if (status) {
          status.textContent = `正在导出 ${format.toUpperCase()}…`;
          status.removeAttribute("data-state");
        }

        try {
          if (format === "svg") {
            exportSvg(figure);
          } else if (format === "png") {
            await exportPng(figure);
          }

          if (status) {
            status.textContent = `${format.toUpperCase()} 已下载`;
          }

          window.setTimeout(() => {
            if (menu) menu.open = false;
            if (status) status.textContent = "";
          }, 900);
        } catch (error) {
          console.error(error);

          if (status) {
            status.textContent = "导出失败，请重试";
            status.dataset.state = "error";
          }
        } finally {
          buttons.forEach((item) => {
            item.disabled = false;
          });
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", initialiseChartExport);
})();
