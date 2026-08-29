const statusElement =
  document.getElementById(
    "settings-status"
  );

const contentElement =
  document.getElementById(
    "settings-content"
  );

const saveButton =
  document.getElementById(
    "settings-save"
  );

const resetButton =
  document.getElementById(
    "settings-reset"
  );

const saveResult =
  document.getElementById(
    "settings-save-result"
  );


const fields = {
  marineKm:
    document.getElementById(
      "settings-marine-km"
    ),

  coastalKm:
    document.getElementById(
      "settings-coastal-km"
    ),

  nearCoastalKm:
    document.getElementById(
      "settings-near-coastal-km"
    ),

  antarcticMax:
    document.getElementById(
      "settings-antarctic-max"
    ),

  subAntarcticMin:
    document.getElementById(
      "settings-sub-antarctic-min"
    ),

  subAntarcticMax:
    document.getElementById(
      "settings-sub-antarctic-max"
    ),

  subArcticMin:
    document.getElementById(
      "settings-sub-arctic-min"
    ),

  subArcticMax:
    document.getElementById(
      "settings-sub-arctic-max"
    ),

  tropicalLatMax:
    document.getElementById(
      "settings-tropical-lat-max"
    ),

  coldLatMin:
    document.getElementById(
      "settings-cold-lat-min"
    ),

  extremeColdLatMin:
    document.getElementById(
      "settings-extreme-cold-lat-min"
    ),

  useTemperature:
    document.getElementById(
      "settings-use-temperature"
    ),

  tropicalTempMin:
    document.getElementById(
      "settings-tropical-temp-min"
    ),

  temperateTempMin:
    document.getElementById(
      "settings-temperate-temp-min"
    ),

  coldTempMax:
    document.getElementById(
      "settings-cold-temp-max"
    ),

  extremeColdTempMax:
    document.getElementById(
      "settings-extreme-cold-temp-max"
    ),

  islandCountries:
    document.getElementById(
      "settings-island-countries"
    ),

  islandPatterns:
    document.getElementById(
      "settings-island-patterns"
    ),

  urbanPatterns:
    document.getElementById(
      "settings-urban-patterns"
    ),

  ruralPatterns:
    document.getElementById(
      "settings-rural-patterns"
    ),

  industrialPatterns:
    document.getElementById(
      "settings-industrial-patterns"
    ),

  hotAridPatterns:
    document.getElementById(
      "settings-hot-arid-patterns"
    ),
};


function listToText(
  value
) {
  return Array.isArray(value)
    ? value.join("\n")
    : "";
}


function textToList(
  value
) {
  return [
    ...new Set(
      String(value || "")
        .split(/\r?\n/)
        .map(
          (item) =>
            item.trim()
        )
        .filter(Boolean)
    ),
  ];
}


function renderSettings(
  settings
) {
  const distance =
    settings
      ?.distance_to_coast ||
    {};

  const latitude =
    settings
      ?.latitude_rules ||
    {};

  const temperature =
    settings
      ?.temperature_rules ||
    {};

  const semantic =
    settings
      ?.semantic_rules ||
    {};


  fields.marineKm.value =
    distance.marine_km ?? "";

  fields.coastalKm.value =
    distance.coastal_km ?? "";

  fields.nearCoastalKm.value =
    distance.near_coastal_km ?? "";


  fields.antarcticMax.value =
    latitude
      .antarctic_latitude_max ??
    "";

  fields.subAntarcticMin.value =
    latitude
      .sub_antarctic_latitude_min ??
    "";

  fields.subAntarcticMax.value =
    latitude
      .sub_antarctic_latitude_max ??
    "";

  fields.subArcticMin.value =
    latitude
      .sub_arctic_latitude_min ??
    "";

  fields.subArcticMax.value =
    latitude
      .sub_arctic_latitude_max ??
    "";

  fields.tropicalLatMax.value =
    latitude
      .tropical_abs_latitude_max ??
    "";

  fields.coldLatMin.value =
    latitude
      .cold_abs_latitude_min ??
    "";

  fields.extremeColdLatMin.value =
    latitude
      .extreme_cold_abs_latitude_min ??
    "";


  fields.useTemperature.checked =
    temperature
      .use_temperature_when_available !==
    false;

  fields.tropicalTempMin.value =
    temperature
      .tropical_mean_temperature_min ??
    "";

  fields.temperateTempMin.value =
    temperature
      .temperate_mean_temperature_min ??
    "";

  fields.coldTempMax.value =
    temperature
      .cold_mean_temperature_max ??
    "";

  fields.extremeColdTempMax.value =
    temperature
      .extreme_cold_mean_temperature_max ??
    "";


  fields.islandCountries.value =
    listToText(
      semantic
        .island_country_hints
    );

  fields.islandPatterns.value =
    listToText(
      semantic
        .island_text_patterns
    );

  fields.urbanPatterns.value =
    listToText(
      semantic
        .urban_patterns
    );

  fields.ruralPatterns.value =
    listToText(
      semantic
        .rural_patterns
    );

  fields.industrialPatterns.value =
    listToText(
      semantic
        .industrial_patterns
    );

  fields.hotAridPatterns.value =
    listToText(
      semantic
        .hot_arid_patterns
    );
}


function collectSettings() {
  return {
    distance_to_coast: {
      marine_km:
        Number(
          fields.marineKm.value
        ),

      coastal_km:
        Number(
          fields.coastalKm.value
        ),

      near_coastal_km:
        Number(
          fields.nearCoastalKm.value
        ),
    },


    latitude_rules: {
      antarctic_latitude_max:
        Number(
          fields.antarcticMax.value
        ),

      sub_antarctic_latitude_min:
        Number(
          fields.subAntarcticMin.value
        ),

      sub_antarctic_latitude_max:
        Number(
          fields.subAntarcticMax.value
        ),

      sub_arctic_latitude_min:
        Number(
          fields.subArcticMin.value
        ),

      sub_arctic_latitude_max:
        Number(
          fields.subArcticMax.value
        ),

      tropical_abs_latitude_max:
        Number(
          fields.tropicalLatMax.value
        ),

      cold_abs_latitude_min:
        Number(
          fields.coldLatMin.value
        ),

      extreme_cold_abs_latitude_min:
        Number(
          fields.extremeColdLatMin.value
        ),
    },


    temperature_rules: {
      use_temperature_when_available:
        fields
          .useTemperature
          .checked,

      tropical_mean_temperature_min:
        Number(
          fields
            .tropicalTempMin
            .value
        ),

      temperate_mean_temperature_min:
        Number(
          fields
            .temperateTempMin
            .value
        ),

      cold_mean_temperature_max:
        Number(
          fields
            .coldTempMax
            .value
        ),

      extreme_cold_mean_temperature_max:
        Number(
          fields
            .extremeColdTempMax
            .value
        ),
    },


    semantic_rules: {
      island_country_hints:
        textToList(
          fields
            .islandCountries
            .value
        ),

      island_text_patterns:
        textToList(
          fields
            .islandPatterns
            .value
        ),

      urban_patterns:
        textToList(
          fields
            .urbanPatterns
            .value
        ),

      rural_patterns:
        textToList(
          fields
            .ruralPatterns
            .value
        ),

      industrial_patterns:
        textToList(
          fields
            .industrialPatterns
            .value
        ),

      hot_arid_patterns:
        textToList(
          fields
            .hotAridPatterns
            .value
        ),
    },
  };
}


function formatBytes(
  value
) {
  const bytes =
    Number(value || 0);

  if (
    bytes < 1024
  ) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return (
      `${(
        bytes /
        1024
      ).toFixed(1)} KB`
    );
  }

  if (
    bytes <
    1024 * 1024 * 1024
  ) {
    return (
      `${(
        bytes /
        1024 /
        1024
      ).toFixed(1)} MB`
    );
  }

  return (
    `${(
      bytes /
      1024 /
      1024 /
      1024
    ).toFixed(2)} GB`
  );
}


function renderService(
  name,
  service
) {
  const status =
    document.getElementById(
      `settings-${name}-status`
    );

  const detail =
    document.getElementById(
      `settings-${name}-detail`
    );


  status.textContent =
    service?.ok
      ? "Ready"
      : "Unavailable";

  status.className =
    service?.ok
      ? "settings-service-ready"
      : "settings-service-error";

  detail.textContent =
    service?.detail ||
    "";
}


function renderSystem(
  system
) {
  renderService(
    "supabase",
    system.supabase
  );

  renderService(
    "postgis",
    system.postgis
  );

  renderService(
    "github",
    system.github
  );


  const r2 =
    system.r2 ||
    {};

  const r2Status =
    document.getElementById(
      "settings-r2-status"
    );

  const r2Detail =
    document.getElementById(
      "settings-r2-detail"
    );


  r2Status.textContent =
    r2.ok
      ? "Ready"
      : "Unavailable";

  r2Status.className =
    r2.ok
      ? "settings-service-ready"
      : "settings-service-error";


  r2Detail.textContent =
    r2.ok
      ? (
          `${r2.object_count || 0} PDF object(s) · ` +
          `${formatBytes(
            r2.total_bytes
          )}`
        )
      : (
          r2.detail ||
          ""
        );


  document.getElementById(
    "settings-build-detail"
  ).textContent =
    system.build
      ?.detail ||
    "—";
}


async function loadSettings() {
  statusElement.textContent =
    "Loading settings…";

  statusElement.hidden =
    false;

  contentElement.hidden =
    true;


  try {
    const response =
      await fetch(
        "/api/settings",
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


    renderSettings(
      payload.region_settings
    );

    renderSystem(
      payload.system ||
      {}
    );


    statusElement.hidden =
      true;

    contentElement.hidden =
      false;

  } catch (error) {
    console.error(
      "Unable to load settings.",
      error
    );


    statusElement.textContent =
      error.message ||
      "Unable to load settings.";
  }
}


saveButton.addEventListener(
  "click",
  async () => {
    saveButton.disabled =
      true;

    resetButton.disabled =
      true;

    saveButton.textContent =
      "Saving…";


    saveResult.textContent =
      "Saving region-classification rules…";

    saveResult.className =
      "save-message";

    saveResult.hidden =
      false;


    try {
      const response =
        await fetch(
          "/api/settings/region",
          {
            method:
              "PUT",

            headers: {
              "content-type":
                "application/json",

              accept:
                "application/json",
            },

            body:
              JSON.stringify({
                settings:
                  collectSettings(),
              }),
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


      renderSettings(
        payload.settings
      );


      saveResult.textContent =
        "Region-classification rules saved. Future automatic classifications will use these values.";

      saveResult.className =
        "save-message save-message-success";

    } catch (error) {
      saveResult.textContent =
        error.message ||
        "Unable to save region rules.";

      saveResult.className =
        "save-message save-message-error";

    } finally {
      saveButton.disabled =
        false;

      resetButton.disabled =
        false;

      saveButton.textContent =
        "Save region rules";
    }
  }
);


resetButton.addEventListener(
  "click",
  async () => {
    const confirmed =
      window.confirm(
        "Reset all automatic region-classification rules to the built-in defaults?"
      );


    if (!confirmed) {
      return;
    }


    saveButton.disabled =
      true;

    resetButton.disabled =
      true;

    resetButton.textContent =
      "Resetting…";


    try {
      const response =
        await fetch(
          "/api/settings/region/reset",
          {
            method:
              "POST",

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


      renderSettings(
        payload.settings
      );


      saveResult.textContent =
        "Region-classification rules reset to the built-in defaults.";

      saveResult.className =
        "save-message save-message-success";

      saveResult.hidden =
        false;

    } catch (error) {
      saveResult.textContent =
        error.message ||
        "Unable to reset region rules.";

      saveResult.className =
        "save-message save-message-error";

      saveResult.hidden =
        false;

    } finally {
      saveButton.disabled =
        false;

      resetButton.disabled =
        false;

      resetButton.textContent =
        "Reset to defaults";
    }
  }
);


loadSettings();