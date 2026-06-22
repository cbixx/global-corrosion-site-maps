(() => {
  "use strict";

  const app = document.getElementById("lsdyna-app");
  if (!app) return;

  const locale = document.documentElement.lang.toLowerCase().startsWith("zh") ? "zh" : "en";
  const dictionaries = window.CorrosionAtlasLsdynaDeckI18n || {};
  const copy = dictionaries[locale] || dictionaries.en;

  if (!copy) {
    console.error("LS-DYNA tool i18n dictionary was not loaded.");
    return;
  }

  const fileInput = document.getElementById("lsdyna-file-input");
  const dropzone = document.getElementById("lsdyna-dropzone");
  const uploadPanel = document.getElementById("lsdyna-upload-panel");
  const workspace = document.getElementById("lsdyna-workspace");
  const fileStatus = document.getElementById("lsdyna-file-status");

  const state = {
    originalText: "",
    deck: null,
    activeView: "overview",
    rawIndex: 0,
    dirty: false
  };

  const help = {
    "*CONTROL_TERMINATION": "Sets the intended duration of the analysis.",
    "*CONTROL_ENERGY": "Activates additional global energy accounting.",
    "*DATABASE_BINARY_D3PLOT": "Writes the deformation and animation result file.",
    "*DATABASE_GLSTAT": "Writes global energy and time-history output.",
    "*DATABASE_MATSUM": "Writes part and material energy and motion histories.",
    "*DATABASE_NCFORC": "Writes nodal contact-force histories.",
    "*DATABASE_RBDOUT": "Writes rigid-body time histories.",
    "*SECTION_SHELL": "Defines shell formulation and thickness.",
    "*SECTION_SOLID": "Defines solid-element formulation.",
    "*MAT_RIGID": "Defines a rigid body: it can translate and rotate but does not deform.",
    "*MAT_ELASTIC": "Defines a linear elastic material.",
    "*MAT_PIECEWISE_LINEAR_PLASTICITY": "Defines an elastic-plastic metallic material, often MAT_024.",
    "*MAT_024": "Defines an elastic-plastic metallic material, often MAT_024.",
    "*INITIAL_VELOCITY_GENERATION": "Applies an initial velocity to a selected target such as a part.",
    "*INITIAL_VELOCITY_RIGID_BODY": "Applies an initial velocity to a rigid body.",
    "*BOUNDARY_SPC_SET": "Restrains specified degrees of freedom for a node set.",
    "*CONTACT_AUTOMATIC_SINGLE_SURFACE": "Applies automatic contact among eligible surfaces."
  };

  function message(path, values = {}) {
    const template = path.split(".").reduce((result, key) => result && result[key], copy);

    if (typeof template !== "string") {
      return path;
    }

    return template.replace(/\{(\w+)\}/g, (_, key) => {
      return values[key] === undefined || values[key] === null ? "" : String(values[key]);
    });
  }

  function valueAt(path) {
    return path.split(".").reduce((result, key) => result && result[key], copy);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function parseNumber(value) {
    const parsed = Number(String(value ?? "").replace(/D/gi, "E"));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function isNumeric(value) {
    return parseNumber(value) !== null;
  }

  function formatNumber(value, digits = 5) {
    if (value === null || value === undefined || value === "") {
      return message("misc.noValue");
    }

    if (typeof value === "number") {
      const absolute = Math.abs(value);

      if (absolute && (absolute >= 1e5 || absolute < 1e-3)) {
        return value.toExponential(3);
      }

      return String(Number(value.toFixed(digits)));
    }

    return String(value);
  }

  function splitFields(line) {
    const trimmed = String(line || "").trim();

    if (!trimmed) return [];

    return trimmed.includes(",")
      ? trimmed.split(",").map((item) => item.trim())
      : trimmed.split(/\s+/);
  }

  function formatFileSize(bytes) {
    return (bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1);
  }

  function getEntries(block) {
    return block.lines
      .map((text, physicalIndex) => ({
        text,
        physicalIndex,
        fields: splitFields(text)
      }))
      .filter((entry) => {
        const trimmed = entry.text.trim();
        return trimmed !== "" && !trimmed.startsWith("$");
      });
  }

  function localMaterialType(keyword) {
    if (keyword === "*MAT_RIGID") return message("material.rigid");
    if (keyword === "*MAT_ELASTIC") return message("material.elastic");
    if (keyword === "*MAT_PIECEWISE_LINEAR_PLASTICITY" || keyword === "*MAT_024") {
      return message("material.plastic");
    }

    return keyword.replace("*MAT_", "").replaceAll("_", " ");
  }

  function parseDeck(text, filename) {
    const lines = String(text)
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n");

    const preamble = [];
    const blocks = [];
    let current = null;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (trimmed.startsWith("*")) {
        current = {
          keyword: trimmed.split(/\s+/)[0].toUpperCase(),
          header: line,
          startLine: index + 1,
          lines: []
        };

        blocks.push(current);
        return;
      }

      if (current) {
        current.lines.push(line);
      } else {
        preamble.push(line);
      }
    });

    const deck = {
      filename,
      lines,
      preamble,
      blocks,
      title: "",
      titleRef: null,
      units: "",
      parts: [],
      materials: [],
      sections: [],
      controls: [],
      databases: [],
      motions: [],
      boundaries: [],
      contacts: [],
      sets: [],
      includes: [],
      hasParameters: false,
      nodes: 0,
      elements: {
        solid: 0,
        shell: 0,
        beam: 0,
        other: 0,
        byPart: new Map()
      },
      diagnostics: []
    };

    const partMap = new Map();
    const materialMap = new Map();
    const sectionMap = new Map();

    blocks.forEach((block, blockIndex) => {
      const entries = getEntries(block);

      if (block.keyword === "*TITLE" && entries[0]) {
        deck.title = entries[0].text.trim();
        deck.titleRef = {
          blockIndex,
          physicalIndex: entries[0].physicalIndex
        };
      }

      if (block.keyword.startsWith("*INCLUDE")) {
        deck.includes.push({
          blockIndex,
          line: block.startLine,
          text: entries.map((entry) => entry.text.trim()).join(" ")
        });
      }

      if (block.keyword.startsWith("*PARAMETER")) {
        deck.hasParameters = true;
      }

      if (block.keyword.startsWith("*SECTION_SHELL")) {
        const first = entries[0]?.fields || [];
        const second = entries[1]?.fields || [];

        const section = {
          id: parseNumber(first[0]),
          type: message("misc.shell"),
          elform: parseNumber(first[1]),
          nip: parseNumber(first[3]),
          thickness: second.slice(0, 4).map(parseNumber),
          blockIndex,
          line: block.startLine
        };

        if (section.id !== null) {
          deck.sections.push(section);
          sectionMap.set(String(section.id), section);
        }
      } else if (block.keyword.startsWith("*SECTION_SOLID")) {
        const first = entries[0]?.fields || [];

        const section = {
          id: parseNumber(first[0]),
          type: message("misc.solid"),
          elform: parseNumber(first[1]),
          blockIndex,
          line: block.startLine
        };

        if (section.id !== null) {
          deck.sections.push(section);
          sectionMap.set(String(section.id), section);
        }
      } else if (block.keyword.startsWith("*SECTION_")) {
        const first = entries[0]?.fields || [];

        const section = {
          id: parseNumber(first[0]),
          type: block.keyword.replace("*SECTION_", "").replaceAll("_", " "),
          elform: parseNumber(first[1]),
          blockIndex,
          line: block.startLine
        };

        if (section.id !== null) {
          deck.sections.push(section);
          sectionMap.set(String(section.id), section);
        }
      }

      if (block.keyword.startsWith("*MAT_")) {
        const first = entries[0]?.fields || [];
        const second = entries[1]?.fields || [];

        const material = {
          id: parseNumber(first[0]),
          type: localMaterialType(block.keyword),
          keyword: block.keyword,
          blockIndex,
          line: block.startLine,
          ro: parseNumber(first[1]),
          e: parseNumber(first[2]),
          pr: parseNumber(first[3]),
          sigy: parseNumber(first[4]),
          etan: parseNumber(first[5]),
          fail: parseNumber(first[6]),
          tdel: parseNumber(first[7]),
          cmo: parseNumber(second[0]),
          con1: parseNumber(second[1]),
          con2: parseNumber(second[2])
        };

        if (material.id !== null) {
          deck.materials.push(material);
          materialMap.set(String(material.id), material);
        }
      }

      if (block.keyword === "*PART") {
        let title = message("misc.untitled");
        let partRecord = null;
        let titlePhysicalIndex = null;

        if (entries.length) {
          const first = entries[0].fields;

          if (first.length >= 3 && first.slice(0, 3).every(isNumeric)) {
            partRecord = entries[0];
          } else {
            title = entries[0].text.trim();
            titlePhysicalIndex = entries[0].physicalIndex;
            partRecord = entries[1];
          }
        }

        const fields = partRecord?.fields || [];
        const part = {
          id: parseNumber(fields[0]),
          sectionId: parseNumber(fields[1]),
          materialId: parseNumber(fields[2]),
          title,
          blockIndex,
          line: block.startLine,
          titlePhysicalIndex,
          partPhysicalIndex: partRecord?.physicalIndex ?? null
        };

        if (part.id !== null) {
          deck.parts.push(part);
          partMap.set(String(part.id), part);
        }
      }

      if (block.keyword === "*NODE" || block.keyword.startsWith("*NODE_")) {
        entries.forEach((entry) => {
          if (entry.fields.length >= 4 && entry.fields.slice(0, 4).every(isNumeric)) {
            deck.nodes += 1;
          }
        });
      }

      if (block.keyword.startsWith("*ELEMENT_")) {
        const kind = block.keyword.includes("SHELL")
          ? "shell"
          : block.keyword.includes("SOLID")
            ? "solid"
            : block.keyword.includes("BEAM")
              ? "beam"
              : "other";

        entries.forEach((entry) => {
          if (entry.fields.length >= 2 && isNumeric(entry.fields[0]) && isNumeric(entry.fields[1])) {
            deck.elements[kind] += 1;
            const partId = String(parseNumber(entry.fields[1]));
            deck.elements.byPart.set(partId, (deck.elements.byPart.get(partId) || 0) + 1);
          }
        });
      }

      if (block.keyword.startsWith("*CONTROL_")) {
        deck.controls.push({
          keyword: block.keyword,
          blockIndex,
          line: block.startLine,
          recordIndex: 0,
          value: parseNumber(entries[0]?.fields?.[0]),
          values: entries[0]?.fields || []
        });
      }

      if (block.keyword.startsWith("*DATABASE_")) {
        deck.databases.push({
          keyword: block.keyword,
          blockIndex,
          line: block.startLine,
          recordIndex: 0,
          dt: parseNumber(entries[0]?.fields?.[0]),
          values: entries[0]?.fields || []
        });
      }

      if (block.keyword === "*INITIAL_VELOCITY_GENERATION") {
        const fields = entries[0]?.fields || [];

        deck.motions.push({
          kind: "initialVelocityGeneration",
          keyword: block.keyword,
          blockIndex,
          line: block.startLine,
          recordIndex: 0,
          target: parseNumber(fields[0]),
          targetType: parseNumber(fields[1]),
          vx: parseNumber(fields[3]),
          vy: parseNumber(fields[4]),
          vz: parseNumber(fields[5])
        });
      }

      if (block.keyword === "*INITIAL_VELOCITY_RIGID_BODY") {
        const fields = entries[0]?.fields || [];

        deck.motions.push({
          kind: "initialVelocityRigid",
          keyword: block.keyword,
          blockIndex,
          line: block.startLine,
          recordIndex: 0,
          target: parseNumber(fields[0]),
          targetType: 2,
          vx: parseNumber(fields[1]),
          vy: parseNumber(fields[2]),
          vz: parseNumber(fields[3])
        });
      }

      if (block.keyword.startsWith("*BOUNDARY_")) {
        const fields = entries[0]?.fields || [];
        const boundary = {
          keyword: block.keyword,
          blockIndex,
          line: block.startLine,
          recordIndex: 0,
          target: parseNumber(fields[0]),
          data: fields
        };

        if (block.keyword === "*BOUNDARY_SPC_SET") {
          boundary.type = "spcSet";
          boundary.dofs = fields.slice(2, 8);
        } else if (block.keyword.includes("PRESCRIBED_MOTION")) {
          boundary.type = "prescribedMotion";
          boundary.dof = parseNumber(fields[1]);
          boundary.vad = parseNumber(fields[2]);
          boundary.lcid = parseNumber(fields[3]);
        } else {
          boundary.type = block.keyword.replace("*BOUNDARY_", "").replaceAll("_", " ");
        }

        deck.boundaries.push(boundary);
      }

      if (block.keyword.startsWith("*SET_NODE_LIST")) {
        const fields = entries[0]?.fields || [];
        let count = 0;

        entries.slice(1).forEach((entry) => {
          count += entry.fields.filter(isNumeric).length;
        });

        deck.sets.push({
          id: parseNumber(fields[0]),
          type: "nodeList",
          count,
          blockIndex,
          line: block.startLine
        });
      }

      if (block.keyword.startsWith("*CONTACT_")) {
        const first = entries[0]?.fields || [];
        const second = entries[1]?.fields || [];

        deck.contacts.push({
          keyword: block.keyword,
          blockIndex,
          line: block.startLine,
          ssid: parseNumber(first[0]),
          msid: parseNumber(first[1]),
          sstyp: parseNumber(first[2]),
          mstyp: parseNumber(first[3]),
          fs: parseNumber(second[0]),
          fd: parseNumber(second[1])
        });
      }
    });

    const comments = lines
      .filter((line) => line.trim().startsWith("$"))
      .map((line) => line.trim().replace(/^\$\s?/, ""));

    const unitsComment = comments.find((comment) => /^units?\s*:/i.test(comment));

    if (unitsComment) {
      deck.units = unitsComment.replace(/^units?\s*:\s*/i, "");
    }

    if (!deck.title) {
      deck.title = filename.replace(/\.[^.]+$/, "");
    }

    validateDeck(deck, partMap, materialMap, sectionMap);
    return deck;
  }

  function addDiagnostic(deck, code, values = {}) {
    const definition = valueAt(`diagnostics.${code}`);

    if (!Array.isArray(definition)) return;

    const [level, titleTemplate, detailTemplate] = definition;
    const substitute = (template) => String(template).replace(/\{(\w+)\}/g, (_, key) => {
      return values[key] === undefined || values[key] === null ? "" : String(values[key]);
    });

    deck.diagnostics.push({
      level,
      title: substitute(titleTemplate),
      detail: substitute(detailTemplate)
    });
  }

  function validateDeck(deck, partMap, materialMap, sectionMap) {
    const endCard = deck.controls.find((card) => card.keyword === "*CONTROL_TERMINATION");

    if (!deck.blocks.some((block) => block.keyword === "*KEYWORD")) {
      addDiagnostic(deck, "noKeyword");
    }

    if (!deck.blocks.some((block) => block.keyword === "*END")) {
      addDiagnostic(deck, "noEnd");
    }

    if (!deck.units) {
      addDiagnostic(deck, "noUnits");
    } else {
      addDiagnostic(deck, "units", { units: deck.units });
    }

    if (!endCard) {
      addDiagnostic(deck, "noTermination");
    } else {
      addDiagnostic(deck, "termination", { value: formatNumber(endCard.value) });
    }

    if (!deck.contacts.length) {
      addDiagnostic(deck, "noContact");
    }

    if (!deck.motions.length && !deck.boundaries.some((boundary) => boundary.type === "prescribedMotion")) {
      addDiagnostic(deck, "noMotion");
    }

    if (!deck.databases.some((database) => database.keyword === "*DATABASE_BINARY_D3PLOT")) {
      addDiagnostic(deck, "noD3plot");
    }

    if (deck.includes.length) {
      addDiagnostic(deck, "include");
    }

    if (deck.hasParameters) {
      addDiagnostic(deck, "parameter");
    }

    deck.parts.forEach((part) => {
      if (part.materialId !== null && !materialMap.has(String(part.materialId))) {
        addDiagnostic(deck, "missingMaterial", {
          part: formatNumber(part.id),
          material: formatNumber(part.materialId),
          title: part.title
        });
      }

      if (part.sectionId !== null && !sectionMap.has(String(part.sectionId))) {
        addDiagnostic(deck, "missingSection", {
          part: formatNumber(part.id),
          section: formatNumber(part.sectionId),
          title: part.title
        });
      }
    });

    deck.elements.byPart.forEach((count, partId) => {
      if (!partMap.has(partId)) {
        addDiagnostic(deck, "missingPart", {
          count: formatNumber(count),
          part: partId
        });
      }
    });

    deck.blocks.forEach((block) => {
      if (
        block.keyword === "*NODE" ||
        block.keyword.startsWith("*ELEMENT_") ||
        block.keyword.startsWith("*SET_NODE_LIST")
      ) {
        const blankRecords = block.lines
          .map((line, index) => line.trim() === "" ? index : null)
          .filter((index) => index !== null);

        if (blankRecords.length) {
          addDiagnostic(deck, "blankRecords", {
            keyword: block.keyword,
            line: block.startLine
          });
        }
      }
    });
  }

  function buildDeckText(deck) {
    return [
      ...deck.preamble,
      ...deck.blocks.flatMap((block) => [block.header, ...block.lines])
    ].join("\n");
  }

  function setStatus(text, kind = "") {
    fileStatus.textContent = text;
    fileStatus.className = `lsdyna-file-status ${kind ? `is-${kind}` : ""}`;
  }

  function markDirty(dirty) {
    state.dirty = dirty;
  }

  function reparseDeck(dirty = true) {
    const text = buildDeckText(state.deck);
    state.deck = parseDeck(text, state.deck.filename);
    state.rawIndex = Math.min(state.rawIndex, Math.max(0, state.deck.blocks.length - 1));
    markDirty(dirty);
    render();
  }

  function setField(blockIndex, recordIndex, fieldIndex, value) {
    const block = state.deck.blocks[blockIndex];
    const record = getEntries(block)[recordIndex];

    if (!record) return false;

    const fields = splitFields(record.text);

    while (fields.length <= fieldIndex) {
      fields.push("0");
    }

    fields[fieldIndex] = String(value);
    block.lines[record.physicalIndex] = fields.join(",");
    return true;
  }

  function setLine(blockIndex, physicalIndex, value) {
    if (!state.deck.blocks[blockIndex]) return false;
    state.deck.blocks[blockIndex].lines[physicalIndex] = String(value);
    return true;
  }

  function statCard(label, value, detail = "") {
    return `
      <article class="lsdyna-stat-card">
        <span class="lsdyna-stat-label">${escapeHtml(label)}</span>
        <strong class="lsdyna-stat-value">${escapeHtml(value)}</strong>
        ${detail ? `<span class="lsdyna-stat-detail">${escapeHtml(detail)}</span>` : ""}
      </article>
    `;
  }

  function standardTable(headers, rows, emptyMessage = "") {
    const head = headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("");
    const body = rows.length
      ? rows.join("")
      : `<tr><td colspan="${headers.length}" class="lsdyna-muted">${escapeHtml(emptyMessage)}</td></tr>`;

    return `
      <div class="lsdyna-table-wrap">
        <table class="lsdyna-table">
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  function motionDescription(motion) {
    return motion.kind === "initialVelocityGeneration"
      ? "*INITIAL_VELOCITY_GENERATION"
      : "*INITIAL_VELOCITY_RIGID_BODY";
  }

  function targetDescription(motion) {
    if (motion.targetType === 2) {
      return message("misc.rigidTarget", { value: formatNumber(motion.target) });
    }

    return message("misc.target", { value: formatNumber(motion.target) });
  }

  function overviewView() {
    const deck = state.deck;
    const elementTotal =
      deck.elements.solid +
      deck.elements.shell +
      deck.elements.beam +
      deck.elements.other;

    const endTime = deck.controls.find((control) => control.keyword === "*CONTROL_TERMINATION")?.value;
    const d3plot = deck.databases.find((database) => database.keyword === "*DATABASE_BINARY_D3PLOT")?.dt;

    const partRows = deck.parts.map((part) => {
      const material = deck.materials.find((item) => item.id === part.materialId);
      const section = deck.sections.find((item) => item.id === part.sectionId);
      const materialText = material
        ? escapeHtml(material.type)
        : `<span class="lsdyna-missing">${escapeHtml(message("misc.missing", { value: formatNumber(part.materialId) }))}</span>`;
      const sectionText = section
        ? `${escapeHtml(section.type)}${section.thickness?.length ? ` · t=${escapeHtml(formatNumber(section.thickness[0]))}` : ""}`
        : `<span class="lsdyna-missing">${escapeHtml(message("misc.missing", { value: formatNumber(part.sectionId) }))}</span>`;

      return `
        <tr>
          <td>${escapeHtml(formatNumber(part.id))}</td>
          <td><strong>${escapeHtml(part.title)}</strong></td>
          <td>${materialText}</td>
          <td>${sectionText}</td>
          <td>${escapeHtml(formatNumber(deck.elements.byPart.get(String(part.id)) || 0))}</td>
        </tr>
      `;
    });

    const motionRows = deck.motions.map((motion) => `
      <tr>
        <td>${escapeHtml(motionDescription(motion))}</td>
        <td>${escapeHtml(targetDescription(motion))}</td>
        <td>${escapeHtml(formatNumber(motion.vx))}</td>
        <td>${escapeHtml(formatNumber(motion.vy))}</td>
        <td>${escapeHtml(formatNumber(motion.vz))}</td>
        <td><code>${escapeHtml(motion.keyword)}</code></td>
      </tr>
    `);

    return `
      <div class="lsdyna-note">
        <strong>${message("overview.modelMapTitle")}:</strong>
        ${message("overview.modelMap")}
      </div>

      <div class="lsdyna-stat-grid">
        ${statCard(message("overview.cards.parts"), deck.parts.length, message("overview.cardSub.components"))}
        ${statCard(message("overview.cards.materials"), deck.materials.length, message("overview.cardSub.recognised"))}
        ${statCard(message("overview.cards.sections"), deck.sections.length, message("overview.cardSub.forms"))}
        ${statCard(message("overview.cards.nodes"), deck.nodes.toLocaleString(), message("overview.cardSub.coordinates"))}
        ${statCard(message("overview.cards.elements"), elementTotal.toLocaleString(), message("overview.cardSub.elementBreakdown", { solid: deck.elements.solid, shell: deck.elements.shell }))}
        ${statCard(message("overview.cards.endTime"), endTime === undefined ? message("misc.noValue") : formatNumber(endTime), message("overview.cardSub.deckTime"))}
        ${statCard(message("overview.cards.contacts"), deck.contacts.length, message("overview.cardSub.interaction"))}
        ${statCard(message("overview.cards.d3plot"), d3plot === undefined ? message("misc.noValue") : formatNumber(d3plot), message("overview.cardSub.animation"))}
      </div>

      <h3 class="lsdyna-panel-heading">${message("overview.partMap")}</h3>
      ${standardTable(valueAt("overview.partHeaders"), partRows, message("overview.noParts"))}

      <h3 class="lsdyna-panel-heading">${message("overview.motion")}</h3>
      ${standardTable(valueAt("overview.motionHeaders"), motionRows, message("overview.noMotion"))}

      <p class="lsdyna-footer-note">${message("overview.rawNote")}</p>
    `;
  }

  function textField(label, value, attributes = "", helpText = "") {
    return `
      <label class="lsdyna-field">
        <span>${escapeHtml(label)}</span>
        <input ${attributes} value="${escapeHtml(value ?? "")}">
        ${helpText ? `<small>${escapeHtml(helpText)}</small>` : ""}
      </label>
    `;
  }

  function numericField(label, value, blockIndex, recordIndex, fieldIndex, helpText = "") {
    return textField(
      label,
      value ?? "",
      `type="text" data-field-edit="true" data-block-index="${blockIndex}" data-record-index="${recordIndex}" data-field-index="${fieldIndex}"`,
      helpText
    );
  }

  function parameterSection(title, detail, content, badge = "") {
    return `
      <section class="lsdyna-editor-section">
        <div class="lsdyna-editor-section-header">
          <div>
            <h3>${escapeHtml(title)}</h3>
            ${detail ? `<p>${detail}</p>` : ""}
          </div>
          ${badge ? `<span class="lsdyna-pill">${escapeHtml(badge)}</span>` : ""}
        </div>
        ${content}
      </section>
    `;
  }

  function parameterView() {
    const deck = state.deck;
    const titleControl = deck.titleRef
      ? textField(
          message("parameter.title"),
          deck.title,
          `type="text" data-line-edit="true" data-block-index="${deck.titleRef.blockIndex}" data-physical-index="${deck.titleRef.physicalIndex}"`,
          message("parameter.titleHelp")
        )
      : `<span class="lsdyna-muted">${message("parameter.noEndTime")}</span>`;

    const termination = deck.controls.find((control) => control.keyword === "*CONTROL_TERMINATION");
    const knownDatabases = deck.databases.filter((database) => [
      "*DATABASE_BINARY_D3PLOT",
      "*DATABASE_GLSTAT",
      "*DATABASE_MATSUM",
      "*DATABASE_NCFORC",
      "*DATABASE_RBDOUT"
    ].includes(database.keyword));

    const runtimeContent = `
      <div class="lsdyna-editor-grid">
        ${
          termination
            ? numericField(message("parameter.endTime"), termination.value, termination.blockIndex, 0, 0, "*CONTROL_TERMINATION")
            : `<span class="lsdyna-muted">${message("parameter.noEndTime")}</span>`
        }
        ${knownDatabases.map((database) => numericField(
          database.keyword.replace("*DATABASE_", ""),
          database.dt,
          database.blockIndex,
          0,
          0
        )).join("")}
      </div>
    `;

    const shellSections = deck.sections
      .filter((section) => section.type === message("misc.shell"))
      .map((section) => parameterSection(
        `${message("misc.shell")} ${formatNumber(section.id)}`,
        message("parameter.shellNote"),
        `
          <div class="lsdyna-editor-grid">
            ${[0, 1, 2, 3].map((index) => numericField(
              message("parameter.thickness", { index: index + 1 }),
              section.thickness?.[index] ?? "",
              section.blockIndex,
              1,
              index,
              message("parameter.thicknessHelp")
            )).join("")}
          </div>
        `,
        `ELFORM ${formatNumber(section.elform)}`
      ))
      .join("") || parameterSection("", "", `<span class="lsdyna-muted">${message("parameter.noShell")}</span>`);

    const materials = deck.materials.map((material) => {
      let content = "";

      if (material.keyword === "*MAT_RIGID") {
        content = `
          <div class="lsdyna-editor-grid">
            ${numericField(message("parameter.density"), material.ro, material.blockIndex, 0, 1)}
            ${numericField(message("parameter.modulus"), material.e, material.blockIndex, 0, 2)}
            ${numericField(message("parameter.poisson"), material.pr, material.blockIndex, 0, 3)}
            ${numericField(message("parameter.constraintMode"), material.cmo, material.blockIndex, 1, 0, message("parameter.constraintHelp"))}
            ${numericField("CON1", material.con1, material.blockIndex, 1, 1)}
            ${numericField("CON2", material.con2, material.blockIndex, 1, 2)}
          </div>
        `;
      } else if (material.keyword === "*MAT_PIECEWISE_LINEAR_PLASTICITY" || material.keyword === "*MAT_024") {
        content = `
          <div class="lsdyna-editor-grid">
            ${numericField(message("parameter.density"), material.ro, material.blockIndex, 0, 1)}
            ${numericField(message("parameter.modulus"), material.e, material.blockIndex, 0, 2)}
            ${numericField(message("parameter.poisson"), material.pr, material.blockIndex, 0, 3)}
            ${numericField(message("parameter.yield"), material.sigy, material.blockIndex, 0, 4)}
            ${numericField(message("parameter.tangent"), material.etan, material.blockIndex, 0, 5)}
            ${numericField(message("parameter.failure"), material.fail, material.blockIndex, 0, 6, message("parameter.failureHelp"))}
            ${numericField(message("parameter.delay"), material.tdel, material.blockIndex, 0, 7)}
          </div>
        `;
      } else if (material.keyword === "*MAT_ELASTIC") {
        content = `
          <div class="lsdyna-editor-grid">
            ${numericField(message("parameter.density"), material.ro, material.blockIndex, 0, 1)}
            ${numericField(message("parameter.modulus"), material.e, material.blockIndex, 0, 2)}
            ${numericField(message("parameter.poisson"), material.pr, material.blockIndex, 0, 3)}
          </div>
        `;
      } else {
        content = `<span class="lsdyna-muted">${message("parameter.rawOnly")}</span>`;
      }

      return parameterSection(
        `${message("parameter.materials")} ${formatNumber(material.id)} — ${material.type}`,
        `<code>${escapeHtml(material.keyword)}</code> · ${escapeHtml(message("misc.line", { line: material.line }))}`,
        content
      );
    }).join("") || parameterSection("", "", `<span class="lsdyna-muted">${message("parameter.noMaterial")}</span>`);

    const motions = deck.motions.map((motion) => {
      const offset = motion.keyword === "*INITIAL_VELOCITY_GENERATION" ? 3 : 1;

      return parameterSection(
        motionDescription(motion),
        `${targetDescription(motion)} · ${message("misc.line", { line: motion.line })}`,
        `
          <div class="lsdyna-editor-grid">
            ${numericField("Vx", motion.vx, motion.blockIndex, motion.recordIndex, offset)}
            ${numericField("Vy", motion.vy, motion.blockIndex, motion.recordIndex, offset + 1)}
            ${numericField("Vz", motion.vz, motion.blockIndex, motion.recordIndex, offset + 2)}
          </div>
        `,
        motion.keyword
      );
    }).join("") || parameterSection("", "", `<span class="lsdyna-muted">${message("parameter.noMotion")}</span>`);

    const contacts = deck.contacts.map((contact) => parameterSection(
      contact.keyword.replace("*CONTACT_", "").replaceAll("_", " "),
      message("parameter.contactNote"),
      `
        <div class="lsdyna-editor-grid">
          ${numericField(message("parameter.ssid"), contact.ssid, contact.blockIndex, 0, 0)}
          ${numericField(message("parameter.msid"), contact.msid, contact.blockIndex, 0, 1)}
          ${numericField(message("parameter.sstyp"), contact.sstyp, contact.blockIndex, 0, 2)}
          ${numericField(message("parameter.mstyp"), contact.mstyp, contact.blockIndex, 0, 3)}
          ${numericField(message("parameter.staticFriction"), contact.fs, contact.blockIndex, 1, 0)}
          ${numericField(message("parameter.dynamicFriction"), contact.fd, contact.blockIndex, 1, 1)}
        </div>
      `,
      message("misc.line", { line: contact.line })
    )).join("") || parameterSection("", "", `<span class="lsdyna-muted">${message("parameter.noContact")}</span>`);

    const boundaries = deck.boundaries
      .filter((boundary) => boundary.keyword === "*BOUNDARY_SPC_SET")
      .map((boundary) => parameterSection(
        `SPC ${formatNumber(boundary.target)}`,
        message("parameter.restraintHelp"),
        `
          <div class="lsdyna-editor-grid">
            ${["X", "Y", "Z", "RX", "RY", "RZ"].map((axis, index) => numericField(
              message("parameter.restraint", { axis }),
              boundary.dofs?.[index] ?? "",
              boundary.blockIndex,
              0,
              index + 2
            )).join("")}
          </div>
        `,
        message("misc.line", { line: boundary.line })
      ))
      .join("") || parameterSection("", "", `<span class="lsdyna-muted">${message("parameter.noBoundary")}</span>`);

    return `
      <div class="lsdyna-note lsdyna-note-warning">
        <strong>${message("parameter.ruleTitle")}:</strong> ${message("parameter.rule")}
      </div>

      ${parameterSection(
        message("parameter.identity"),
        message("parameter.identityNote"),
        `<div class="lsdyna-editor-grid">${titleControl}</div>`
      )}

      ${parameterSection(
        message("parameter.runtime"),
        message("parameter.runtimeNote"),
        runtimeContent
      )}

      <h3 class="lsdyna-panel-heading">${message("parameter.shellSections")}</h3>
      ${shellSections}

      <h3 class="lsdyna-panel-heading">${message("parameter.materials")}</h3>
      ${materials}

      <h3 class="lsdyna-panel-heading">${message("parameter.motion")}</h3>
      ${motions}

      <h3 class="lsdyna-panel-heading">${message("parameter.contacts")}</h3>
      ${contacts}

      <h3 class="lsdyna-panel-heading">${message("parameter.boundary")}</h3>
      ${boundaries}

      <div class="lsdyna-editor-actions">
        <button class="lsdyna-button" type="button" data-action="apply-parameters">${message("action.apply")}</button>
        <button class="lsdyna-button lsdyna-button-secondary" type="button" data-action="discard-parameters">${message("action.discard")}</button>
      </div>

      <p class="lsdyna-footer-note">${message("parameter.rawNote")}</p>
    `;
  }

  function rawView() {
    const block = state.deck.blocks[state.rawIndex] || state.deck.blocks[0];

    if (!block) {
      return `<p class="lsdyna-muted">${message("overview.noParts")}</p>`;
    }

    const list = state.deck.blocks.map((item, index) => `
      <button
        class="lsdyna-raw-item ${index === state.rawIndex ? "is-active" : ""}"
        type="button"
        data-action="select-raw"
        data-index="${index}"
      >
        <code>${escapeHtml(item.keyword)}</code>
        <span>${escapeHtml(message("misc.line", { line: item.startLine }))}</span>
      </button>
    `).join("");

    const source = [block.header, ...block.lines].join("\n");
    const explanation = help[block.keyword] || message("raw.intro");

    return `
      <div class="lsdyna-note">
        <strong><code>${escapeHtml(block.keyword)}</code></strong><br>
        ${explanation}
      </div>

      <div class="lsdyna-raw-layout">
        <div class="lsdyna-raw-list" aria-label="${escapeHtml(message("nav.raw"))}">
          ${list}
        </div>

        <div>
          <textarea
            id="lsdyna-raw-text"
            class="lsdyna-raw-editor"
            spellcheck="false"
            aria-label="${escapeHtml(message("nav.raw"))}"
          >${escapeHtml(source)}</textarea>

          <div class="lsdyna-editor-actions">
            <button class="lsdyna-button" type="button" data-action="apply-raw">${message("action.applyRaw")}</button>
            <button class="lsdyna-button lsdyna-button-secondary" type="button" data-action="restore-raw">${message("action.restoreRaw")}</button>
          </div>

          <p class="lsdyna-footer-note">${message("raw.guide")}</p>
        </div>
      </div>
    `;
  }

  function validationView() {
    const statuses = state.deck.diagnostics.map((diagnostic) => `
      <article class="lsdyna-status lsdyna-status-${escapeHtml(diagnostic.level)}">
        <strong>${escapeHtml(diagnostic.title)}</strong>
        <span>${escapeHtml(diagnostic.detail)}</span>
      </article>
    `).join("");

    const recognised = [...new Set(state.deck.blocks.map((block) => block.keyword))]
      .filter((keyword) => help[keyword])
      .map((keyword) => `
        <span class="lsdyna-keyword-pill">
          <code>${escapeHtml(keyword)}</code>
          <span>${escapeHtml(help[keyword])}</span>
        </span>
      `)
      .join("");

    return `
      <div class="lsdyna-note">
        <strong>${message("validation.checks")}:</strong> ${message("validation.intro")}
      </div>

      <h3 class="lsdyna-panel-heading">${message("validation.checks")}</h3>
      <div class="lsdyna-status-list">
        ${statuses || `<article class="lsdyna-status lsdyna-status-good"><strong>${message("validation.noChecks")}</strong></article>`}
      </div>

      <h3 class="lsdyna-panel-heading">${message("validation.recognised")}</h3>
      <div class="lsdyna-keyword-guide">
        ${recognised || `<span class="lsdyna-muted">${message("validation.noRecognised")}</span>`}
      </div>

      <h3 class="lsdyna-panel-heading">${message("validation.export")}</h3>
      <section class="lsdyna-editor-section">
        <p>${message("validation.exportText")}</p>
        <div class="lsdyna-editor-actions">
          <button class="lsdyna-button" type="button" data-action="export-deck">${message("action.exportNow")}</button>
          <button class="lsdyna-button lsdyna-button-secondary" type="button" data-action="export-summary">${message("action.exportSummary")}</button>
        </div>
      </section>
    `;
  }

  function viewHtml() {
    if (state.activeView === "parameters") return parameterView();
    if (state.activeView === "raw") return rawView();
    if (state.activeView === "validation") return validationView();
    return overviewView();
  }

  function workspaceHtml() {
    const deck = state.deck;
    const viewCopy = valueAt(`view.${state.activeView}`);

    return `
      <div class="lsdyna-workspace-layout">
        <aside class="lsdyna-side-panel">
          <div class="lsdyna-file-name">${escapeHtml(deck.title)}</div>
          <div class="lsdyna-file-meta">
            ${escapeHtml(message("side.fileMeta", {
              filename: deck.filename,
              lines: deck.lines.length.toLocaleString(),
              blocks: deck.blocks.length.toLocaleString()
            }))}
          </div>

          ${state.dirty ? `<span class="lsdyna-unsaved">${message("side.unsaved")}</span>` : ""}

          <nav class="lsdyna-view-nav" aria-label="${escapeHtml(message("nav.overview"))}">
            ${["overview", "parameters", "raw", "validation"].map((view) => `
              <button
                class="lsdyna-view-nav-button ${view === state.activeView ? "is-active" : ""}"
                type="button"
                data-action="switch-view"
                data-view="${view}"
                ${view === state.activeView ? 'aria-current="page"' : ""}
              >
                ${message(`nav.${view}`)}
              </button>
            `).join("")}
          </nav>
        </aside>

        <section class="lsdyna-tool-content">
          <div class="lsdyna-tool-content-header">
            <div>
              <h2>${escapeHtml(viewCopy.title)}</h2>
              <p>${escapeHtml(viewCopy.subtitle)}</p>
            </div>

            <div class="lsdyna-toolbar">
              <button class="lsdyna-button" type="button" data-action="export-deck">${message("action.exportDeck")}</button>
              <button class="lsdyna-button lsdyna-button-secondary" type="button" data-action="reset-deck">${message("action.reset")}</button>
              <button class="lsdyna-button lsdyna-button-secondary" type="button" data-action="open-deck">${message("action.openAnother")}</button>
            </div>
          </div>

          <div class="lsdyna-tool-view">
            ${viewHtml()}
          </div>
        </section>
      </div>
    `;
  }

  function render() {
    if (!state.deck) return;

    workspace.innerHTML = workspaceHtml();
    workspace.hidden = false;
    uploadPanel.hidden = true;
  }

  function applyParameterEdits() {
    let changes = 0;

    workspace.querySelectorAll("[data-field-edit='true']").forEach((field) => {
      const value = field.value.trim();

      if (value === "") return;

      if (setField(
        Number(field.dataset.blockIndex),
        Number(field.dataset.recordIndex),
        Number(field.dataset.fieldIndex),
        value
      )) {
        changes += 1;
      }
    });

    workspace.querySelectorAll("[data-line-edit='true']").forEach((field) => {
      if (setLine(
        Number(field.dataset.blockIndex),
        Number(field.dataset.physicalIndex),
        field.value
      )) {
        changes += 1;
      }
    });

    if (changes) {
      reparseDeck(true);
    }
  }

  function applyRawBlock() {
    const textarea = workspace.querySelector("#lsdyna-raw-text");

    if (!textarea) return;

    const lines = textarea.value.replace(/\r/g, "").split("\n");
    const nonempty = lines.filter((line) => line.trim() !== "");

    if (!nonempty.length || !nonempty[0].trim().startsWith("*")) {
      alert(message("raw.firstLine"));
      return;
    }

    if (nonempty.slice(1).some((line) => line.trim().startsWith("*"))) {
      alert(message("raw.oneBlock"));
      return;
    }

    const headerIndex = lines.findIndex((line) => line.trim() !== "");
    const header = lines[headerIndex];
    const body = lines.slice(headerIndex + 1);
    const originalBlock = state.deck.blocks[state.rawIndex];

    state.deck.blocks[state.rawIndex] = {
      keyword: header.trim().split(/\s+/)[0].toUpperCase(),
      header,
      startLine: originalBlock.startLine,
      lines: body
    };

    reparseDeck(true);
  }

  function restoreRawBlock() {
    const original = parseDeck(state.originalText, state.deck.filename);
    const originalBlock = original.blocks[state.rawIndex];

    if (!originalBlock) {
      alert(message("raw.restoreError"));
      return;
    }

    state.deck.blocks[state.rawIndex] = JSON.parse(JSON.stringify(originalBlock));
    reparseDeck(true);
  }

  function downloadFile(name, content, type = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportDeck() {
    if (!state.deck.blocks.some((block) => block.keyword === "*END")) {
      alert(message("validation.exportBlocked"));
      state.activeView = "validation";
      render();
      return;
    }

    const basename = state.deck.filename.replace(/\.[^.]+$/, "");
    downloadFile(`${basename}_edited.k`, buildDeckText(state.deck));
  }

  function createSummary() {
    const deck = state.deck;
    const elementTotal =
      deck.elements.solid +
      deck.elements.shell +
      deck.elements.beam +
      deck.elements.other;
    const endTime = deck.controls.find((control) => control.keyword === "*CONTROL_TERMINATION")?.value;

    return [
      message("validation.summaryTitle"),
      `File: ${deck.filename}`,
      `Title: ${deck.title}`,
      `Units comment: ${deck.units || message("misc.noValue")}`,
      `Parts: ${deck.parts.length}; Materials: ${deck.materials.length}; Sections: ${deck.sections.length}`,
      `Nodes: ${deck.nodes}; Elements: ${elementTotal} (${deck.elements.solid} solid, ${deck.elements.shell} shell, ${deck.elements.beam} beam)`,
      `End time: ${endTime === undefined ? message("misc.noValue") : formatNumber(endTime)}`,
      "",
      ...deck.parts.map((part) => `Part ${part.id}: ${part.title}; section ${part.sectionId}; material ${part.materialId}`),
      "",
      message("validation.diagnostics"),
      ...deck.diagnostics.map((diagnostic) => `[${diagnostic.level.toUpperCase()}] ${diagnostic.title} — ${diagnostic.detail}`)
    ].join("\n");
  }

  function exportSummary() {
    const basename = state.deck.filename.replace(/\.[^.]+$/, "");
    downloadFile(`${basename}_editor_summary.txt`, createSummary());
  }

  function resetDeck() {
    if (!window.confirm(message("confirm.reset"))) return;

    state.deck = parseDeck(state.originalText, state.deck.filename);
    state.activeView = "overview";
    state.rawIndex = 0;
    markDirty(false);
    render();
  }

  function openAnotherDeck() {
    state.originalText = "";
    state.deck = null;
    state.activeView = "overview";
    state.rawIndex = 0;
    markDirty(false);

    fileInput.value = "";
    workspace.innerHTML = "";
    workspace.hidden = true;
    uploadPanel.hidden = false;
    setStatus(message("status.ready"));
  }

  function loadFile(file) {
    if (!file) return;

    const extension = file.name.includes(".")
      ? file.name.split(".").pop().toLowerCase()
      : "";

    const supported = ["k", "key", "dyn", "inc", "txt"];

    if (!supported.includes(extension)) {
      setStatus(message("status.unsupported"), "warning");
    }

    const size = formatFileSize(file.size);

    if (file.size > 20 * 1024 * 1024) {
      setStatus(message("status.tooLarge", { size }), "warning");

      if (!window.confirm(message("confirm.largeFile", { size }))) {
        return;
      }
    }

    setStatus(message("status.reading", { name: file.name }));

    const reader = new FileReader();

    reader.onload = () => {
      try {
        state.originalText = String(reader.result || "");
        state.deck = parseDeck(state.originalText, file.name);
        state.activeView = "overview";
        state.rawIndex = 0;
        markDirty(false);
        setStatus(message("status.loaded", { name: file.name }), "success");
        render();
      } catch (error) {
        console.error(error);
        setStatus(message("status.readError"), "error");
      }
    };

    reader.onerror = () => {
      setStatus(message("status.readError"), "error");
    };

    reader.readAsText(file);
  }

  function setupEvents() {
    fileInput.addEventListener("change", (event) => {
      loadFile(event.target.files?.[0]);
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add("is-dragover");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.remove("is-dragover");
      });
    });

    dropzone.addEventListener("drop", (event) => {
      loadFile(event.dataTransfer.files?.[0]);
    });

    workspace.addEventListener("click", (event) => {
      const control = event.target.closest("[data-action]");

      if (!control) return;

      const action = control.dataset.action;

      if (action === "switch-view") {
        state.activeView = control.dataset.view;
        render();
      }

      if (action === "select-raw") {
        state.rawIndex = Number(control.dataset.index);
        render();
      }

      if (action === "apply-parameters") {
        applyParameterEdits();
      }

      if (action === "discard-parameters") {
        render();
      }

      if (action === "apply-raw") {
        applyRawBlock();
      }

      if (action === "restore-raw") {
        restoreRawBlock();
      }

      if (action === "export-deck") {
        exportDeck();
      }

      if (action === "export-summary") {
        exportSummary();
      }

      if (action === "reset-deck") {
        resetDeck();
      }

      if (action === "open-deck") {
        openAnotherDeck();
      }
    });
  }

  setupEvents();
  setStatus(message("status.ready"));
})();
