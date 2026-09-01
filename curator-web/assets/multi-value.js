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
      const key = value.toLowerCase();

      if (seen.has(key)) {
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
      placeholder = "Type a value and press Enter",
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
    editor.placeholder = placeholder;
    editor.autocomplete = "off";

    const optionValues =
      uniqueValues(
        options.map((value) =>
          String(value).trim()
        )
      );

    let datalist = null;

    if (optionValues.length > 0) {
      datalist =
        document.createElement(
          "datalist"
        );

      datalist.id =
        `multi-value-options-${input.id}`;

      for (const value of optionValues) {
        const option =
          document.createElement(
            "option"
          );

        option.value = value;

        datalist.append(option);
      }

      editor.setAttribute(
        "list",
        datalist.id
      );
    }

    input.hidden = true;

    input.insertAdjacentElement(
      "beforebegin",
      wrapper
    );

    wrapper.append(chips, editor);

    if (datalist) {
      wrapper.append(datalist);
    }

    function getValues() {
      return uniqueValues(
        splitValues(input.value)
      );
    }

    function writeValues(values) {
      input.value =
        uniqueValues(values).join(", ");

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
    }

    function removeValue(value) {
      writeValues(
        getValues().filter(
          (item) =>
            item.toLowerCase() !==
            value.toLowerCase()
        )
      );
    }

    function render() {
      chips.replaceChildren();

      for (const value of getValues()) {
        const chip =
          document.createElement("span");

        chip.className =
          "multi-value-chip";

        const text =
          document.createElement("span");

        text.textContent = value;

        const remove =
          document.createElement("button");

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
          () => {
            removeValue(value);
          }
        );

        chip.append(
          text,
          remove
        );

        chips.append(chip);
      }
    }

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

          return;
        }

        if (
          event.key ===
            "Backspace" &&
          editor.value === ""
        ) {
          const values =
            getValues();

          if (values.length > 0) {
            values.pop();
            writeValues(values);
          }
        }
      }
    );

    editor.addEventListener(
      "change",
      () => {
        addValues(editor.value);
      }
    );

    editor.addEventListener(
      "blur",
      () => {
        addValues(editor.value);
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
      },

      getValue() {
        return input.value;
      },

      focus() {
        editor.focus();
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
    metals: DEFAULT_METALS,

    exposurePeriods:
      DEFAULT_EXPOSURE_PERIODS,
  };
})();