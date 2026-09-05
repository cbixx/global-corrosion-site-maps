(() => {
  const DEFAULT_METALS = [
    "Carbon steel",
    "Weathering steel",
    "Zinc",
    "Copper",
    "Aluminium",
    "Galvanized steel",
    "Lead",
    "Nickel",
    "Tin",
    "Brass",
    "Bronze",
  ];

  const DEFAULT_EXPOSURE_PERIODS = [
    "1 month",
    "3 months",
    "6 months",
    "1 year",
    "2 years",
    "3 years",
    "4 years",
    "5 years",
    "8 years",
    "10 years",
  ];

  function splitValues(value) {
    return String(value || "")
      .split(/[,;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function uniqueValues(values) {
    const seen = new Set();

    return values.filter((value) => {
      const key =
        String(value)
          .trim()
          .toLowerCase();

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  function createMultiValueInput(
    input,
    {
      options = [],
      placeholder =
        "Type a value and press Enter",
    } = {}
  ) {
    if (!input) {
      return null;
    }

    if (input._multiValueController) {
      return input._multiValueController;
    }

    const wrapper =
      document.createElement("div");

    wrapper.className =
      "multi-value-control";

    const chips =
      document.createElement("div");

    chips.className =
      "multi-value-chips";

    const editor =
      document.createElement("input");

    editor.type = "text";

    editor.className =
      "multi-value-editor";

    editor.placeholder =
      placeholder;

    editor.autocomplete = "off";

    const menu =
      document.createElement("div");

    menu.className =
      "multi-value-menu";

    menu.hidden = true;

    const optionValues =
      uniqueValues(
        options.map((value) =>
          String(value).trim()
        )
      );

    input.hidden = true;

    input.insertAdjacentElement(
      "beforebegin",
      wrapper
    );

    wrapper.append(
      chips,
      editor,
      menu
    );

    function getValues() {
      return uniqueValues(
        splitValues(input.value)
      );
    }

    function writeValues(values) {
      input.value =
        uniqueValues(values)
          .join(", ");

      render();

      input.dispatchEvent(
        new Event("input", {
          bubbles: true,
        })
      );

      input.dispatchEvent(
        new Event("change", {
          bubbles: true,
        })
      );
    }

    function addValues(rawValue) {
      const incoming =
        splitValues(rawValue);

      if (incoming.length === 0) {
        return;
      }

      writeValues([
        ...getValues(),
        ...incoming,
      ]);

      editor.value = "";

      renderMenu();
    }

    function removeValue(value) {
      writeValues(
        getValues().filter(
          (item) =>
            item.toLowerCase() !==
            value.toLowerCase()
        )
      );

      renderMenu();
    }

    function render() {
      chips.replaceChildren();

      for (const value of getValues()) {
        const chip =
          document.createElement(
            "span"
          );

        chip.className =
          "multi-value-chip";

        const text =
          document.createElement(
            "span"
          );

        text.textContent =
          value;

        const remove =
          document.createElement(
            "button"
          );

        remove.type = "button";

        remove.className =
          "multi-value-remove";

        remove.textContent = "×";

        remove.setAttribute(
          "aria-label",
          `Remove ${value}`
        );

        remove.addEventListener(
          "click",
          (event) => {
            event.stopPropagation();

            removeValue(value);

            editor.focus();
          }
        );

        chip.append(
          text,
          remove
        );

        chips.append(chip);
      }
    }

    function getAvailableOptions() {
      const selected =
        new Set(
          getValues().map(
            (value) =>
              value.toLowerCase()
          )
        );

      const query =
        editor.value
          .trim()
          .toLowerCase();

      return optionValues.filter(
        (value) => {
          if (
            selected.has(
              value.toLowerCase()
            )
          ) {
            return false;
          }

          if (
            query &&
            !value
              .toLowerCase()
              .includes(query)
          ) {
            return false;
          }

          return true;
        }
      );
    }

    function renderMenu() {
      menu.replaceChildren();

      if (
        document.activeElement !==
        editor
      ) {
        menu.hidden = true;
        return;
      }

      const availableOptions =
        getAvailableOptions();

      if (
        availableOptions.length === 0
      ) {
        menu.hidden = true;
        return;
      }

      for (
        const value
        of availableOptions
      ) {
        const option =
          document.createElement(
            "button"
          );

        option.type = "button";

        option.className =
          "multi-value-option";

        option.textContent =
          value;

        /*
         * Prevent the editor from
         * losing focus when an option
         * is selected. This keeps the
         * dropdown open for the next
         * selection.
         */
        option.addEventListener(
          "mousedown",
          (event) => {
            event.preventDefault();
          }
        );

        option.addEventListener(
          "click",
          () => {
            addValues(value);

            editor.focus();

            renderMenu();
          }
        );

        menu.append(option);
      }

      menu.hidden = false;
    }

    editor.addEventListener(
      "focus",
      () => {
        renderMenu();
      }
    );

    editor.addEventListener(
      "input",
      () => {
        renderMenu();
      }
    );

    editor.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Enter" ||
          event.key === "," ||
          event.key === ";"
        ) {
          event.preventDefault();

          addValues(
            editor.value
          );

          editor.focus();

          renderMenu();

          return;
        }

        if (
          event.key ===
            "Backspace" &&
          editor.value === ""
        ) {
          const values =
            getValues();

          if (
            values.length > 0
          ) {
            values.pop();

            writeValues(values);

            renderMenu();
          }
        }

        if (
          event.key === "Escape"
        ) {
          menu.hidden = true;
        }
      }
    );

    editor.addEventListener(
      "blur",
      () => {
        /*
         * Delay closing slightly so
         * option clicks can complete.
         */
        window.setTimeout(
          () => {
            if (
              !wrapper.contains(
                document.activeElement
              )
            ) {
              menu.hidden = true;
            }
          },
          0
        );
      }
    );

    wrapper.addEventListener(
      "click",
      (event) => {
        if (
          event.target === wrapper ||
          event.target === chips
        ) {
          editor.focus();
          renderMenu();
        }
      }
    );

    const label =
      input.id
        ? document.querySelector(
            `label[for="${input.id}"]`
          )
        : null;

    if (label) {
      label.addEventListener(
        "click",
        () => {
          editor.focus();
          renderMenu();
        }
      );
    }

    const controller = {
      setValue(value) {
        input.value =
          uniqueValues(
            splitValues(value)
          ).join(", ");

        render();
        renderMenu();
      },

      getValue() {
        return input.value;
      },

      focus() {
        editor.focus();
        renderMenu();
      },
    };

    input._multiValueController =
      controller;

    render();

    return controller;
  }

  window.createMultiValueInput =
    createMultiValueInput;

  window.CURATOR_MULTI_VALUE_OPTIONS = {
    metals:
      DEFAULT_METALS,

    exposurePeriods:
      DEFAULT_EXPOSURE_PERIODS,
  };
})();