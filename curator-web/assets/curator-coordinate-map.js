// Shared coordinate verification map for Site creation.
(() => {
  const valid = (lat, lon) =>
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) &&
    Number(lat) >= -90 && Number(lat) <= 90 &&
    Number(lon) >= -180 && Number(lon) <= 180;

  const distanceM = (a, b, c, d) => {
    const rad = Math.PI / 180;
    const p = (c - a) * rad;
    const q = (d - b) * rad;
    const x = Math.sin(p / 2) ** 2 +
      Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(q / 2) ** 2;
    return 12742000 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  function create(element, {
    latitude, longitude, sites = [], relatedIds = [], onPick
  }) {
    if (!window.L) throw new Error("Leaflet could not be loaded.");
    if (!valid(latitude, longitude)) {
      throw new Error("Enter valid coordinates first.");
    }

    let position = [Number(latitude), Number(longitude)];
    let existingSites = sites;
    let related = new Set(relatedIds.map(String));

    const map = L.map(element, { scrollWheelZoom: false })
      .setView(position, 16);


    /*
    * Coordinate map geographic label language.
    * English uses Tracestrack; Local uses the original OSM tiles.
    */
    const TRACESTRACK_KEY = "PASTE_YOUR_TRACESTRACK_KEY_HERE";

    const hasEnglishTiles = Boolean(
      TRACESTRACK_KEY &&
      TRACESTRACK_KEY !== "PASTE_YOUR_TRACESTRACK_KEY_HERE"
    );

    const localTileLayer = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">' +
          'OpenStreetMap</a> contributors'
      }
    );

    const englishTileLayer = hasEnglishTiles
      ? L.tileLayer(
          "https://tile.tracestrack.com/en/{z}/{x}/{y}@1x.png?key=" +
            encodeURIComponent(TRACESTRACK_KEY),
          {
            maxZoom: 19,
            attribution:
              'Map tiles &copy; <a href="https://tracestrack.com/">' +
              'Tracestrack</a>; data &copy; ' +
              '<a href="https://www.openstreetmap.org/copyright">' +
              'OpenStreetMap contributors</a>'
          }
        )
      : null;

    const storageKey = "corrosionCuratorMapLabels";

    let savedLanguage = hasEnglishTiles ? "english" : "local";

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "english" || stored === "local") {
        savedLanguage = stored;
      }
    } catch {
      // Storage may be unavailable.
    }

    let activeTileLayer = null;

    function setMapLanguage(language, persist = true) {
      const useEnglish =
        language === "english" && Boolean(englishTileLayer);

      const nextLayer = useEnglish
        ? englishTileLayer
        : localTileLayer;

      if (activeTileLayer !== nextLayer) {
        if (activeTileLayer) {
          map.removeLayer(activeTileLayer);
        }

        nextLayer.addTo(map);
        nextLayer.bringToBack();
        activeTileLayer = nextLayer;
      }

      const actualLanguage = useEnglish ? "english" : "local";

      if (languageSelect) {
        languageSelect.value = actualLanguage;
      }

      if (persist) {
        try {
          localStorage.setItem(storageKey, actualLanguage);
        } catch {
          // Storage may be unavailable.
        }
      }
    }

    /*
    * Small language selector inside the map.
    */
    let languageSelect = null;

    const languageControl = L.control({
      position: "topright"
    });

    languageControl.onAdd = function () {
      const container = L.DomUtil.create(
        "div",
        "leaflet-bar"
      );

      container.style.background = "#fff";
      container.style.padding = "5px";
      container.style.borderRadius = "5px";

      languageSelect = document.createElement("select");
      languageSelect.setAttribute(
        "aria-label",
        "Map label language"
      );

      languageSelect.style.padding = "5px";
      languageSelect.style.fontSize = "12px";
      languageSelect.style.maxWidth = "145px";

      const englishOption = new Option(
        "English labels",
        "english"
      );

      const localOption = new Option(
        "Local names",
        "local"
      );

      if (!hasEnglishTiles) {
        englishOption.disabled = true;
      }

      languageSelect.append(
        englishOption,
        localOption
      );

      container.appendChild(languageSelect);

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      languageSelect.addEventListener("change", () => {
        setMapLanguage(languageSelect.value);
      });

      return container;
    };

    languageControl.addTo(map);

    if (englishTileLayer) {
      englishTileLayer.on("tileerror", () => {
        if (activeTileLayer === englishTileLayer) {
          setMapLanguage("local", false);
        }
      });
    }

    setMapLanguage(savedLanguage, false);


    const proposed = L.marker(position, { draggable: true })
      .addTo(map);
    proposed.bindTooltip("Proposed Site");

    const candidates = L.layerGroup().addTo(map);
    const summary = document.createElement("div");
    summary.className = "site-map-summary";
    element.insertAdjacentElement("afterend", summary);

    function redraw() {
      candidates.clearLayers();

      const matches = existingSites
        .filter(s =>
          s.latitude !== "" && s.longitude !== "" &&
          s.latitude != null && s.longitude != null &&
          valid(s.latitude, s.longitude)
        )
        .map(s => ({
          site: s,
          distance: distanceM(
            position[0], position[1],
            Number(s.latitude), Number(s.longitude)
          )
        }))
        .filter(x =>
          x.distance <= 250 ||
          related.has(String(x.site.id ?? x.site.site_pk))
        )
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 12);

      for (const { site, distance } of matches) {
        const pin = L.circleMarker(
          [Number(site.latitude), Number(site.longitude)],
          {
            radius: 8,
            color: "#b91c1c",
            weight: 2,
            fillColor: "#ef4444",
            fillOpacity: 0.9
          }
        ).addTo(candidates);

        const popup = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent =
          `${site.site_id || ""} — ${site.site_label || "Existing Site"}`;

        const detail = document.createElement("div");
        detail.textContent =
          `${distance.toFixed(1)} m from proposed pin`;

        popup.append(name, detail);

        if (site.id != null || site.site_pk != null) {
          const link = document.createElement("a");
          link.href = `/sites/detail/?id=${encodeURIComponent(
            site.id ?? site.site_pk
          )}`;
          link.target = "_blank";
          link.rel = "noopener";
          link.textContent = "Open existing Site";
          popup.append(link);
        }

        pin.bindPopup(popup);
      }

      const nearest = matches[0];

      summary.textContent =
        `Proposed: ${position[0].toFixed(6)}, ` +
        `${position[1].toFixed(6)}. ` +
        (!nearest
          ? "No existing Site flagged within 250 m among loaded records."
          : nearest.distance <= 200
            ? `Existing Site ${nearest.distance.toFixed(1)} m away ` +
              "(within 200 m); review before creating."
            : `Potential matching Site ` +
              `${nearest.distance.toFixed(1)} m away; review before creating.`);
    }

    function setPosition(lat, lon, recenter = true) {
      if (!valid(lat, lon)) return;

      position = [Number(lat), Number(lon)];
      proposed.setLatLng(position);

      if (recenter) {
        map.setView(position, Math.max(map.getZoom(), 15));
      }

      redraw();
    }

    function selectPoint(lat, lon) {
      setPosition(lat, lon, false);
      onPick?.(
        Number(lat.toFixed(6)),
        Number(lon.toFixed(6))
      );
    }

    map.on("click", event =>
      selectPoint(event.latlng.lat, event.latlng.lng)
    );

    proposed.on("dragend", () => {
      const point = proposed.getLatLng();
      selectPoint(point.lat, point.lng);
    });

    redraw();

    return {
      setPosition,

      // Move only the map viewport; do not alter Site coordinates.
      previewLocation(lat, lon) {
        if (!valid(lat, lon)) return;

        map.setView(
          [Number(lat), Number(lon)],
          13
        );
      },

      setSites(nextSites, ids = []) {
        existingSites = nextSites;
        related = new Set(ids.map(String));
        redraw();

        const flagged = existingSites.filter(s =>
          related.has(String(s.id ?? s.site_pk)) &&
          valid(s.latitude, s.longitude)
        );

        if (flagged.length) {
          const points = [
            position,
            ...flagged.slice(0, 8).map(s => [
              Number(s.latitude),
              Number(s.longitude)
            ])
          ];

          map.fitBounds(points, {
            padding: [35, 35],
            maxZoom: 16
          });
        }
      },

      refresh() {
        map.invalidateSize();
      },

      destroy() {
        map.remove();
        summary.remove();
      }
    };
  }

  window.CuratorCoordinateMap = {
    create, valid, distanceM
  };
})();