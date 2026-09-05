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

  /* ============================================================
     APPLICATION STATE
     ============================================================ */

  const state = {
    /*
     * Original loaded deck.
     */
    originalText: "",

    /*
     * Currently parsed working deck.
     */
    deck: null,

    /*
     * Active workspace tab.
     */
    activeView: "overview",

    /*
     * Selected raw keyword block.
     */
    rawIndex: 0,

    /*
     * Whether the working deck differs from the loaded original.
     */
    dirty: false,

    /*
     * Batch 4 — selected PID in the 3D viewer/model tree.
     */
    selectedPartId: null,

    /*
     * Batch 4 — current 3D colouring scheme.
     *
     * Supported:
     * part
     * material
     * section
     * element
     */
    viewerColorMode: "part"
  };


  /* ============================================================
     MODEL EXPLORER STUDY VIEWS
     ============================================================ */

  const studyViews = [
    "overview",
    "preview",
    "model",
    "parts",
    "sections",
    "materials",
    "contacts",
    "motion",
    "controls",
    "outputs",
    "parameters",
    "raw",
    "validation"
  ];

  const studyText = {
    en: {
      nav: {
        preview: "3D Preview",
        model: "Model graph",
        parts: "Parts",
        sections: "Sections",
        materials: "Materials",
        contacts: "Contacts",
        motion: "BCs & motion",
        controls: "Controls",
        outputs: "Outputs"
      },

      view: {
        preview: {
          title: "3D model preview",
          subtitle:
            "Inspect the parsed undeformed finite-element model directly in the browser."
        },
        model: {
          title: "Model graph",
          subtitle: "Trace Part → Section → Material relationships and element assignments."
        },
        parts: {
          title: "Parts",
          subtitle: "Study each physical model component and the LS-DYNA definitions attached to it."
        },
        sections: {
          title: "Sections",
          subtitle: "Review element formulations, shell thicknesses, and section usage."
        },
        materials: {
          title: "Materials",
          subtitle: "Review constitutive models, recognised parameters, and material usage."
        },
        contacts: {
          title: "Contacts",
          subtitle: "Review recognised interaction definitions and friction parameters."
        },
        motion: {
          title: "Boundary conditions & motion",
          subtitle: "Review restraints, node sets, and initial-velocity definitions."
        },
        controls: {
          title: "Analysis controls",
          subtitle: "Review explicit-analysis control cards and their first data records."
        },
        outputs: {
          title: "Output requests",
          subtitle: "Review requested LS-DYNA database and time-history outputs."
        }
      }
    },

    zh: {
      nav: {
        preview: "三维预览",
        model: "模型关系",
        parts: "部件",
        sections: "截面",
        materials: "材料",
        contacts: "接触",
        motion: "边界与运动",
        controls: "控制卡",
        outputs: "输出"
      },

      view: {
        preview: {
          title: "三维模型预览",
          subtitle:
            "直接在浏览器中查看已解析的未变形有限元模型。"
        },        
        model: {
          title: "模型关系",
          subtitle: "追踪 Part → Section → Material 关系以及各部件的单元组成。"
        },
        parts: {
          title: "部件",
          subtitle: "查看各物理构件及其对应的 LS-DYNA 定义。"
        },
        sections: {
          title: "截面",
          subtitle: "查看单元公式、壳厚以及各截面的使用情况。"
        },
        materials: {
          title: "材料",
          subtitle: "查看材料本构、已识别参数及材料使用情况。"
        },
        contacts: {
          title: "接触",
          subtitle: "查看已识别的相互作用定义与摩擦参数。"
        },
        motion: {
          title: "边界条件与运动",
          subtitle: "查看约束、节点集以及初始速度定义。"
        },
        controls: {
          title: "分析控制",
          subtitle: "查看显式分析控制卡及其首行参数。"
        },
        outputs: {
          title: "输出请求",
          subtitle: "查看 LS-DYNA 数据库及时间历程输出请求。"
        }
      }
    }
  };

  function studyValue(group, key) {
    return (
      studyText[locale]?.[group]?.[key] ??
      studyText.en?.[group]?.[key] ??
      null
    );
  }

  function navLabel(view) {
    return studyValue("nav", view) || message(`nav.${view}`);
  }

  function viewMeta(view) {
    return studyValue("view", view) || valueAt(`view.${view}`);
  }

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
    "*CONTACT_AUTOMATIC_SINGLE_SURFACE": "Applies automatic contact among eligible surfaces.",
    "*CONTROL_TIMESTEP": "Controls the explicit solution time step and optional mass scaling.",

    "*CONTROL_HOURGLASS":
      "Defines hourglass-control settings for reduced-integration elements.",

    "*CONTROL_CONTACT":
      "Defines global contact-control options.",

    "*CONTROL_SHELL":
      "Defines global shell-element calculation options.",

    "*DATABASE_RCFORC":
      "Writes resultant contact-force histories.",

    "*DATABASE_D3THDT":
      "Requests high-frequency binary time-history output.",

    "*MAT_PLASTIC_KINEMATIC":
      "Defines elastic-plastic behaviour with optional Cowper-Symonds strain-rate effects.",

    "*INITIAL_VELOCITY_NODE":
      "Assigns initial velocity directly to individual nodes.",

    "*BOUNDARY_SPC_NODE":
      "Restrains selected degrees of freedom for individual nodes."
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

  function numericEntries(entries) {
    return entries.filter((entry) => {
      return entry.fields.length && isNumeric(entry.fields[0]);
    });
  }

  function emptyElementCounts() {
    return {
      shell: 0,
      solid: 0,
      beam: 0,
      other: 0
    };
  }

  /* ============================================================
     PREVIEW GEOMETRY STORE
     ============================================================ */

  function createGeometryStore() {

    return {

      /*
       * Node ID → zero-based index in positionArray.
       */
      nodeIndex: new Map(),


      /*
       * Temporary flat coordinate array:
       * [x1, y1, z1, x2, y2, z2, ...]
       */
      positions: [],


      /*
       * Filled after parsing.
       */
      positionArray: null,


      /*
       * PID →
       * {
       *   shell: [n1,n2,n3,n4,...],
       *   solid: [n1,...n8,...],
       *   beam:  [n1,n2,...]
       * }
       */
      parts: new Map(),


      nodeCount: 0,


      bounds: {

        min: [
          Infinity,
          Infinity,
          Infinity
        ],

        max: [
          -Infinity,
          -Infinity,
          -Infinity
        ]

      }

    };
  }


  function geometryPart(
    geometry,
    partId
  ) {

    const key =
      String(partId);

    if (
      !geometry.parts.has(key)
    ) {

      geometry.parts.set(
        key,
        {
          shell: [],
          solid: [],
          beam: []
        }
      );

    }

    return geometry.parts.get(
      key
    );
  }


  function addGeometryNode(
    geometry,
    id,
    x,
    y,
    z
  ) {

    if (
      id === null ||
      x === null ||
      y === null ||
      z === null
    ) {

      return;
    }


    const index =
      geometry.positions.length / 3;


    geometry.nodeIndex.set(
      id,
      index
    );


    geometry.positions.push(
      x,
      y,
      z
    );


    geometry.nodeCount += 1;


    geometry.bounds.min[0] =
      Math.min(
        geometry.bounds.min[0],
        x
      );

    geometry.bounds.min[1] =
      Math.min(
        geometry.bounds.min[1],
        y
      );

    geometry.bounds.min[2] =
      Math.min(
        geometry.bounds.min[2],
        z
      );


    geometry.bounds.max[0] =
      Math.max(
        geometry.bounds.max[0],
        x
      );

    geometry.bounds.max[1] =
      Math.max(
        geometry.bounds.max[1],
        y
      );

    geometry.bounds.max[2] =
      Math.max(
        geometry.bounds.max[2],
        z
      );
  }


  function addGeometryElement(
    geometry,
    kind,
    partId,
    fields
  ) {

    if (
      partId === null ||
      partId === undefined
    ) {

      return;
    }


    const part =
      geometryPart(
        geometry,
        partId
      );


    if (kind === "shell") {

      const nodes =
        fields
          .slice(2, 6)
          .map(parseNumber);


      if (
        nodes.length >= 3 &&
        nodes
          .slice(0, 3)
          .every(
            (value) =>
              value !== null
          )
      ) {

        const n4 =
          nodes[3] ??
          nodes[2];


        part.shell.push(
          nodes[0],
          nodes[1],
          nodes[2],
          n4
        );

      }

      return;
    }


    if (kind === "solid") {

      const nodes =
        fields
          .slice(2, 10)
          .map(parseNumber);


      if (
        nodes.length === 8 &&
        nodes.every(
          (value) =>
            value !== null
        )
      ) {

        part.solid.push(
          ...nodes
        );

      }

      return;
    }


    if (kind === "beam") {

      const nodes =
        fields
          .slice(2, 4)
          .map(parseNumber);


      if (
        nodes.length === 2 &&
        nodes.every(
          (value) =>
            value !== null
        )
      ) {

        part.beam.push(
          nodes[0],
          nodes[1]
        );

      }

    }
  }


  function finalizeGeometry(
    geometry
  ) {

    /*
     * Float32 is more than adequate for browser visualisation
     * and approximately halves coordinate memory compared with
     * ordinary JavaScript numbers in a numeric array.
     */

    geometry.positionArray =
      new Float32Array(
        geometry.positions
      );


    /*
     * Release the temporary coordinate array.
     */
    geometry.positions = null;


    return geometry;
  }

  function parseMaterialBlock(block, blockIndex, entries) {
    const records = numericEntries(entries);

    const first = records[0]?.fields || [];
    const second = records[1]?.fields || [];

    const baseKeyword = block.keyword.replace(/_TITLE$/, "");

    const material = {
      id: parseNumber(first[0]),

      type: localMaterialType(baseKeyword),

      keyword: block.keyword,
      baseKeyword,

      blockIndex,
      line: block.startLine,

      ro: parseNumber(first[1]),
      e: parseNumber(first[2]),
      pr: parseNumber(first[3]),

      sigy: null,
      etan: null,
      fail: null,
      tdel: null,

      cmo: null,
      con1: null,
      con2: null,

      properties: {}
    };

    if (baseKeyword === "*MAT_ELASTIC") {

      material.properties = {
        RO: parseNumber(first[1]),
        E: parseNumber(first[2]),
        PR: parseNumber(first[3])
      };

    } else if (baseKeyword === "*MAT_RIGID") {

      material.cmo = parseNumber(second[0]);
      material.con1 = parseNumber(second[1]);
      material.con2 = parseNumber(second[2]);

      material.properties = {
        RO: parseNumber(first[1]),
        E: parseNumber(first[2]),
        PR: parseNumber(first[3]),
        CMO: material.cmo,
        CON1: material.con1,
        CON2: material.con2
      };

    } else if (baseKeyword === "*MAT_PLASTIC_KINEMATIC") {

      material.sigy = parseNumber(first[4]);
      material.etan = parseNumber(first[5]);

      material.properties = {
        RO: parseNumber(first[1]),
        E: parseNumber(first[2]),
        PR: parseNumber(first[3]),
        SIGY: material.sigy,
        ETAN: material.etan,
        BETA: parseNumber(first[6]),
        SRC: parseNumber(second[0]),
        SRP: parseNumber(second[1]),
        FS: parseNumber(second[2]),
        VP: parseNumber(second[3])
      };

    } else if (
      baseKeyword === "*MAT_PIECEWISE_LINEAR_PLASTICITY" ||
      baseKeyword === "*MAT_024"
    ) {

      material.sigy = parseNumber(first[4]);
      material.etan = parseNumber(first[5]);
      material.fail = parseNumber(first[6]);
      material.tdel = parseNumber(first[7]);

      material.properties = {
        RO: parseNumber(first[1]),
        E: parseNumber(first[2]),
        PR: parseNumber(first[3]),
        SIGY: material.sigy,
        ETAN: material.etan,
        FAIL: material.fail,
        TDEL: material.tdel,
        C: parseNumber(second[0]),
        P: parseNumber(second[1])
      };

    } else {

      material.properties = {
        RECORD_1: first.join(", "),
        RECORD_2: second.join(", ")
      };

    }

    return material;
  }

  function materialSummary(material) {
    const entries = Object.entries(material.properties || {})
      .filter(([, value]) => {
        return value !== null && value !== undefined && value !== "";
      })
      .slice(0, 8);

    if (!entries.length) {
      return "No recognised parameters";
    }

    return entries
      .map(([key, value]) => `${key}=${formatNumber(value)}`)
      .join(" · ");
  }

  function elementBreakdown(counts) {
    const parts = [];

    if (counts?.shell) parts.push(`${counts.shell} shell`);
    if (counts?.solid) parts.push(`${counts.solid} solid`);
    if (counts?.beam) parts.push(`${counts.beam} beam`);
    if (counts?.other) parts.push(`${counts.other} other`);

    return parts.length ? parts.join(" · ") : "0";
  }

  function buildModelGraph(deck, partMap, materialMap, sectionMap) {
    deck.usage = {
      sections: new Map(),
      materials: new Map()
    };

    deck.modelGraph = deck.parts.map((part) => {
      const id = String(part.id);

      const section =
        part.sectionId === null
          ? null
          : sectionMap.get(String(part.sectionId)) || null;

      const material =
        part.materialId === null
          ? null
          : materialMap.get(String(part.materialId)) || null;

      const elementCounts =
        deck.elements.byPartType.get(id) || emptyElementCounts();

      const totalElements =
        elementCounts.shell +
        elementCounts.solid +
        elementCounts.beam +
        elementCounts.other;

      const elementTypes = Object.entries(elementCounts)
        .filter(([, count]) => count > 0)
        .map(([type]) => type);

      if (section) {
        const key = String(section.id);

        if (!deck.usage.sections.has(key)) {
          deck.usage.sections.set(key, []);
        }

        deck.usage.sections.get(key).push(part.id);
      }

      if (material) {
        const key = String(material.id);

        if (!deck.usage.materials.has(key)) {
          deck.usage.materials.set(key, []);
        }

        deck.usage.materials.get(key).push(part.id);
      }

      return {
        part,
        partId: part.id,
        title: part.title,

        section,
        sectionId: part.sectionId,

        material,
        materialId: part.materialId,

        elementCounts,
        elementTypes,
        totalElements,

        sectionResolved:
          part.sectionId === null ? false : Boolean(section),

        materialResolved:
          part.materialId === null ? false : Boolean(material)
      };
    });
  }

  /* ============================================================
     VIEWER PART METADATA
     ============================================================ */

  function createViewerPartMetadata(deck) {

    const metadata = new Map();

    deck.modelGraph.forEach((item) => {

      metadata.set(
        String(item.partId),
        {
          partId: item.partId,

          title:
            item.title ||
            `Part ${item.partId}`,

          sectionId:
            item.sectionId,

          materialId:
            item.materialId,

          sectionType:
            item.section?.type || "",

          materialType:
            item.material?.type || "",

          materialKeyword:
            item.material?.baseKeyword ||
            item.material?.keyword ||
            "",

          elementTypes:
            [...item.elementTypes],

          elementCounts:
            {
              ...item.elementCounts
            },

          totalElements:
            item.totalElements
        }
      );

    });

    return metadata;
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

        byPart: new Map(),

        /* Separate shell / solid / beam counts for every PID. */
        byPartType: new Map()
      },

      modelGraph: [],

      usage: {
        sections: new Map(),
        materials: new Map()
      },


      /* Actual geometry retained for browser preview. */
      geometry: createGeometryStore(),


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
        const material = parseMaterialBlock(
          block,
          blockIndex,
          entries
        );

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

      if (
        block.keyword === "*NODE" ||
        block.keyword.startsWith("*NODE_")
      ) {

        entries.forEach(
          (entry) => {

            if (
              entry.fields.length >= 4 &&
              entry.fields
                .slice(0, 4)
                .every(isNumeric)
            ) {

              const id =
                parseNumber(
                  entry.fields[0]
                );

              const x =
                parseNumber(
                  entry.fields[1]
                );

              const y =
                parseNumber(
                  entry.fields[2]
                );

              const z =
                parseNumber(
                  entry.fields[3]
                );


              deck.nodes += 1;


              addGeometryNode(
                deck.geometry,
                id,
                x,
                y,
                z
              );
            }

          }
        );
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

            const numericPartId =
              parseNumber(
                entry.fields[1]
              );

            const partId =
              String(
                numericPartId
              );

            deck.elements.byPart.set(
              partId,
              (deck.elements.byPart.get(partId) || 0) + 1
            );

            const typeCounts =
              deck.elements.byPartType.get(partId) ||
              emptyElementCounts();

            typeCounts[kind] += 1;

            deck.elements.byPartType.set(
              partId,
              typeCounts
            );

            addGeometryElement(
              deck.geometry,
              kind,
              numericPartId,
              entry.fields
            );            
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

      if (block.keyword === "*INITIAL_VELOCITY_NODE") {
        const records = numericEntries(entries)
          .filter((entry) => entry.fields.length >= 4);

        let firstVelocity = null;
        let uniform = true;
        let validCount = 0;

        records.forEach((entry) => {
          const vx = parseNumber(entry.fields[1]);
          const vy = parseNumber(entry.fields[2]);
          const vz = parseNumber(entry.fields[3]);

          if (vx === null || vy === null || vz === null) {
            return;
          }

          validCount += 1;

          if (!firstVelocity) {
            firstVelocity = [vx, vy, vz];
            return;
          }

          const tolerance = 1e-10;

          if (
            Math.abs(vx - firstVelocity[0]) > tolerance ||
            Math.abs(vy - firstVelocity[1]) > tolerance ||
            Math.abs(vz - firstVelocity[2]) > tolerance
          ) {
            uniform = false;
          }
        });

        deck.motions.push({
          kind: "initialVelocityNode",

          keyword: block.keyword,

          blockIndex,
          line: block.startLine,

          count: validCount,
          uniform,

          vx: firstVelocity?.[0] ?? null,
          vy: firstVelocity?.[1] ?? null,
          vz: firstVelocity?.[2] ?? null,

          magnitude: firstVelocity
            ? Math.sqrt(
                firstVelocity[0] ** 2 +
                firstVelocity[1] ** 2 +
                firstVelocity[2] ** 2
              )
            : null
        });
      }      

      if (block.keyword.startsWith("*BOUNDARY_")) {
        const records = numericEntries(entries);

        /* -----------------------------------------------
           Node-by-node SPC
           ----------------------------------------------- */

        if (block.keyword === "*BOUNDARY_SPC_NODE") {

          const validRecords = records.filter(
            (entry) => entry.fields.length >= 8
          );

          const patterns = new Map();

          validRecords.forEach((entry) => {
            const pattern = entry.fields
              .slice(2, 8)
              .join(",");

            patterns.set(
              pattern,
              (patterns.get(pattern) || 0) + 1
            );
          });

          deck.boundaries.push({
            keyword: block.keyword,
            blockIndex,
            line: block.startLine,

            type: "spcNode",

            count: validRecords.length,

            sampleTarget:
              parseNumber(validRecords[0]?.fields?.[0]),

            patterns: [...patterns.entries()].map(
              ([pattern, count]) => ({
                pattern,
                count
              })
            )
          });

        /* -----------------------------------------------
           Node-set SPC
           ----------------------------------------------- */

        } else if (block.keyword === "*BOUNDARY_SPC_SET") {

          const fields = records[0]?.fields || [];

          deck.boundaries.push({
            keyword: block.keyword,
            blockIndex,
            line: block.startLine,

            recordIndex: 0,
            type: "spcSet",

            target: parseNumber(fields[0]),

            dofs: fields.slice(2, 8),

            data: fields
          });

        /* -----------------------------------------------
           Prescribed motion
           ----------------------------------------------- */

        } else if (
          block.keyword.includes("PRESCRIBED_MOTION")
        ) {

          const fields = records[0]?.fields || [];

          deck.boundaries.push({
            keyword: block.keyword,
            blockIndex,
            line: block.startLine,

            recordIndex: 0,
            type: "prescribedMotion",

            target: parseNumber(fields[0]),
            dof: parseNumber(fields[1]),
            vad: parseNumber(fields[2]),
            lcid: parseNumber(fields[3]),

            data: fields
          });

        /* -----------------------------------------------
           Other boundary cards
           ----------------------------------------------- */

        } else {

          const fields = records[0]?.fields || [];

          deck.boundaries.push({
            keyword: block.keyword,
            blockIndex,
            line: block.startLine,

            recordIndex: 0,

            type: block.keyword
              .replace("*BOUNDARY_", "")
              .replaceAll("_", " "),

            target: parseNumber(fields[0]),

            data: fields
          });

        }
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
        const records = numericEntries(entries);

        let cursor = 0;
        let contactId = null;

        /*
         * _ID variants usually contain an identification
         * record before the ordinary contact data.
         */
        if (
          block.keyword.endsWith("_ID") &&
          records.length
        ) {
          const candidate = records[0].fields;

          const firstFourNumeric =
            candidate
              .slice(0, 4)
              .filter(isNumeric)
              .length;

          if (firstFourNumeric < 4) {
            contactId = parseNumber(candidate[0]);
            cursor = 1;
          }
        }

        const first =
          records[cursor]?.fields || [];

        const second =
          records[cursor + 1]?.fields || [];

        deck.contacts.push({
          id: contactId,

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

    finalizeGeometry(
      deck.geometry
    );

    /*
     * Convert the independently parsed cards into an
     * explicit model relationship graph.
     */
    buildModelGraph(
      deck,
      partMap,
      materialMap,
      sectionMap
    );

    validateDeck(
      deck,
      partMap,
      materialMap,
      sectionMap
    );

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
    if (motion.kind === "initialVelocityGeneration") {
      return "*INITIAL_VELOCITY_GENERATION";
    }

    if (motion.kind === "initialVelocityRigid") {
      return "*INITIAL_VELOCITY_RIGID_BODY";
    }

    if (motion.kind === "initialVelocityNode") {
      return "*INITIAL_VELOCITY_NODE";
    }

    return motion.keyword || "Initial motion";
  }

  function targetDescription(motion) {
    if (motion.kind === "initialVelocityNode") {
      return `${formatNumber(motion.count)} nodes${
        motion.uniform ? " · uniform vector" : " · variable vectors"
      }`;
    }

    if (motion.targetType === 2) {
      return message(
        "misc.rigidTarget",
        { value: formatNumber(motion.target) }
      );
    }

    return message(
      "misc.target",
      { value: formatNumber(motion.target) }
    );
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

  /* ============================================================
     STUDY VIEWS
     ============================================================ */

  function previewView() {

    const geometry =
      state.deck.geometry;


    const bounds =
      geometry.bounds;


    const size = [

      bounds.max[0] -
      bounds.min[0],

      bounds.max[1] -
      bounds.min[1],

      bounds.max[2] -
      bounds.min[2]

    ];


    return `

      <div class="lsdyna-note">

        <strong>Interactive model study:</strong>

        click a component in the viewer or choose a Part from
        the model tree. The selected geometry is linked to its
        LS-DYNA Part, Section, Material and element composition.

      </div>


      <div class="lsdyna-viewer-toolbar">

        <div class="lsdyna-viewer-toolbar-group">

          <span class="lsdyna-viewer-toolbar-label">
            View
          </span>

          <button
            class="lsdyna-button lsdyna-button-secondary"
            type="button"
            data-action="viewer-view"
            data-viewer-view="iso"
          >
            ISO
          </button>

          <button
            class="lsdyna-button lsdyna-button-secondary"
            type="button"
            data-action="viewer-view"
            data-viewer-view="front"
          >
            Front
          </button>

          <button
            class="lsdyna-button lsdyna-button-secondary"
            type="button"
            data-action="viewer-view"
            data-viewer-view="right"
          >
            Right
          </button>

          <button
            class="lsdyna-button lsdyna-button-secondary"
            type="button"
            data-action="viewer-view"
            data-viewer-view="top"
          >
            Top
          </button>

          <button
            class="lsdyna-button lsdyna-button-secondary"
            type="button"
            data-action="viewer-fit"
          >
            Fit
          </button>

        </div>


        <div class="lsdyna-viewer-toolbar-group">

          <span class="lsdyna-viewer-toolbar-label">
            Colour by
          </span>

          <select
            class="lsdyna-viewer-select"
            id="lsdyna-viewer-color-mode"
            data-action="viewer-color-mode"
          >

            <option
              value="part"
              ${state.viewerColorMode === "part" ? "selected" : ""}
            >
              Part
            </option>

            <option
              value="material"
              ${state.viewerColorMode === "material" ? "selected" : ""}
            >
              Material
            </option>

            <option
              value="section"
              ${state.viewerColorMode === "section" ? "selected" : ""}
            >
              Section
            </option>

            <option
              value="element"
              ${state.viewerColorMode === "element" ? "selected" : ""}
            >
              Element type
            </option>

          </select>

        </div>


        <div class="lsdyna-viewer-toolbar-group">

          <span class="lsdyna-viewer-toolbar-label">
            Display
          </span>

          <button
            class="lsdyna-button lsdyna-button-secondary"
            type="button"
            data-action="viewer-wireframe"
          >
            Wireframe
          </button>

          <button
            class="lsdyna-button lsdyna-button-secondary"
            type="button"
            data-action="viewer-toggle-kind"
            data-viewer-kind="shell"
          >
            Shells
          </button>

          <button
            class="lsdyna-button lsdyna-button-secondary"
            type="button"
            data-action="viewer-toggle-kind"
            data-viewer-kind="solid"
          >
            Solids
          </button>

          <button
            class="lsdyna-button lsdyna-button-secondary"
            type="button"
            data-action="viewer-toggle-kind"
            data-viewer-kind="beam"
          >
            Beams
          </button>

          <button
            class="lsdyna-button lsdyna-button-secondary"
            type="button"
            data-action="viewer-show-all"
          >
            Show all
          </button>

        </div>

      </div>


      <div class="lsdyna-preview-layout">


        <!-- ===================================================
             LEFT — MODEL TREE
             =================================================== -->

        <aside class="lsdyna-preview-tree">

          ${previewModelTreeHtml()}

        </aside>


        <!-- ===================================================
             CENTER — VIEWER
             =================================================== -->

        <section class="lsdyna-preview-center">

          <div class="lsdyna-viewer-frame">

            <div
              class="lsdyna-viewer-stage"
              id="lsdyna-3d-host"
              aria-label="Interactive LS-DYNA finite-element model preview"
            ></div>


            <div class="lsdyna-viewer-statusbar">

              <span id="lsdyna-viewer-status">
                Preparing model preview…
              </span>

              <span>
                Click: select · Left drag: orbit · Right drag: pan · Wheel: zoom
              </span>

            </div>

          </div>

        </section>


        <!-- ===================================================
             RIGHT — INSPECTOR
             =================================================== -->

        <aside
          class="lsdyna-preview-inspector"
          id="lsdyna-preview-inspector"
        >

          ${previewPartInspectorHtml(
            state.selectedPartId
          )}

        </aside>


      </div>


      <div class="lsdyna-stat-grid lsdyna-viewer-stat-grid">

        ${statCard(
          "Model width",
          formatNumber(size[0]),
          "X extent"
        )}

        ${statCard(
          "Model depth",
          formatNumber(size[1]),
          "Y extent"
        )}

        ${statCard(
          "Model height",
          formatNumber(size[2]),
          "Z extent"
        )}

        ${statCard(
          "Geometry parts",
          geometry.parts.size,
          "Parts containing renderable elements"
        )}

      </div>

    `;
  }

  function updatePreviewSelection(partId) {

    state.selectedPartId =
      partId === null ||
      partId === undefined
        ? null
        : String(partId);


    /*
     * Update inspector without rebuilding the WebGL viewer.
     */

    const inspector =
      workspace.querySelector(
        "#lsdyna-preview-inspector"
      );


    if (inspector) {

      inspector.innerHTML =
        previewPartInspectorHtml(
          state.selectedPartId
        );

    }


    /*
     * Update selected row in model tree.
     */

    workspace
      .querySelectorAll(
        "[data-tree-part]"
      )
      .forEach((row) => {

        row.classList.toggle(
          "is-selected",

          String(
            row.dataset.treePart
          ) ===
          String(
            state.selectedPartId
          )
        );

      });
  }


  function selectPreviewPart(partId) {

    state.selectedPartId =
      String(partId);


    window
      .CorrosionAtlasLsdynaViewer
      ?.selectPart(
        state.selectedPartId
      );


    updatePreviewSelection(
      state.selectedPartId
    );
  }


  function modelView() {
    const deck = state.deck;

    const incomplete =
      deck.modelGraph.filter((item) => {
        return (
          !item.sectionResolved ||
          !item.materialResolved
        );
      }).length;

    const rows = deck.modelGraph.map((item) => {
      return `
        <tr>
          <td>${escapeHtml(formatNumber(item.partId))}</td>

          <td>
            <strong>${escapeHtml(item.title)}</strong>
          </td>

          <td>
            ${escapeHtml(
              item.elementTypes.length
                ? item.elementTypes.join(", ")
                : "—"
            )}
          </td>

          <td>
            ${escapeHtml(formatNumber(item.sectionId))}
          </td>

          <td>
            ${
              item.section
                ? escapeHtml(item.section.type)
                : '<span class="lsdyna-missing">Missing</span>'
            }
          </td>

          <td>
            ${escapeHtml(formatNumber(item.materialId))}
          </td>

          <td>
            ${
              item.material
                ? `<code>${escapeHtml(item.material.baseKeyword || item.material.keyword)}</code>`
                : '<span class="lsdyna-missing">Missing</span>'
            }
          </td>

          <td>
            ${escapeHtml(
              item.totalElements.toLocaleString()
            )}
          </td>

          <td>
            ${linkStatusHtml(item)}
          </td>
        </tr>
      `;
    });

    return `
      <div class="lsdyna-note">
        <strong>Core LS-DYNA relationship:</strong>

        geometry is carried by nodes and elements;
        every element belongs to a Part; the Part points to
        a Section and a Material.
      </div>

      <div class="lsdyna-model-chain">
        <span class="lsdyna-model-chain-item">NODE</span>
        <span class="lsdyna-model-chain-arrow">→</span>

        <span class="lsdyna-model-chain-item">ELEMENT</span>
        <span class="lsdyna-model-chain-arrow">→</span>

        <span class="lsdyna-model-chain-item">PART</span>
        <span class="lsdyna-model-chain-arrow">→</span>

        <span class="lsdyna-model-chain-item">SECTION</span>

        <span class="lsdyna-model-chain-arrow">+</span>

        <span class="lsdyna-model-chain-item">MATERIAL</span>
      </div>

      <div class="lsdyna-stat-grid">

        ${statCard(
          "Parts",
          deck.modelGraph.length,
          "Model components"
        )}

        ${statCard(
          "Fully linked",
          deck.modelGraph.length - incomplete,
          "Section + material resolved"
        )}

        ${statCard(
          "Incomplete",
          incomplete,
          "Missing relationship"
        )}

        ${statCard(
          "Element families",
          [
            deck.elements.shell ? "Shell" : "",
            deck.elements.solid ? "Solid" : "",
            deck.elements.beam ? "Beam" : ""
          ].filter(Boolean).join(" / ") || "—",
          "Recognised"
        )}

      </div>

      <h3 class="lsdyna-panel-heading">
        Part → Section → Material map
      </h3>

      <div class="lsdyna-study-table">
        ${standardTable(
          [
            "PID",
            "Part",
            "Element type",
            "SID",
            "Section",
            "MID",
            "Material",
            "Elements",
            "Status"
          ],
          rows,
          "No model relationships were built."
        )}
      </div>
    `;
  }

  function modelGraphItem(partId) {

    if (
      partId === null ||
      partId === undefined
    ) {
      return null;
    }

    return (
      state.deck.modelGraph.find(
        (item) =>
          String(item.partId) ===
          String(partId)
      ) || null
    );
  }

  function previewPartInspectorHtml(partId) {

    const item =
      modelGraphItem(partId);


    if (!item) {

      return `
        <div class="lsdyna-preview-empty">

          <strong>No Part selected</strong>

          <p>
            Click a component in the 3D model or choose a Part
            from the model tree.
          </p>

        </div>
      `;
    }


    const section =
      item.section;

    const material =
      item.material;


    const shellThickness =
      section?.thickness?.length
        ? section.thickness
            .map((value) => formatNumber(value))
            .join(" / ")
        : "—";


    return `

      <div class="lsdyna-inspector-heading">

        <span class="lsdyna-inspector-pid">
          PID ${escapeHtml(formatNumber(item.partId))}
        </span>

        <h3>
          ${escapeHtml(item.title)}
        </h3>

      </div>


      <div class="lsdyna-inspector-section">

        <h4>Finite-element composition</h4>

        <dl class="lsdyna-inspector-list">

          <div>
            <dt>Total elements</dt>
            <dd>
              ${escapeHtml(
                item.totalElements.toLocaleString()
              )}
            </dd>
          </div>

          <div>
            <dt>Element types</dt>
            <dd>
              ${escapeHtml(
                item.elementTypes.length
                  ? item.elementTypes.join(", ")
                  : "—"
              )}
            </dd>
          </div>

          <div>
            <dt>Breakdown</dt>
            <dd>
              ${escapeHtml(
                elementBreakdown(
                  item.elementCounts
                )
              )}
            </dd>
          </div>

        </dl>

      </div>


      <div class="lsdyna-inspector-section">

        <h4>Section</h4>

        <dl class="lsdyna-inspector-list">

          <div>
            <dt>SID</dt>
            <dd>
              ${escapeHtml(
                formatNumber(item.sectionId)
              )}
            </dd>
          </div>

          <div>
            <dt>Type</dt>
            <dd>
              ${escapeHtml(
                section?.type || "Unresolved"
              )}
            </dd>
          </div>

          <div>
            <dt>ELFORM</dt>
            <dd>
              ${escapeHtml(
                formatNumber(
                  section?.elform
                )
              )}
            </dd>
          </div>

          <div>
            <dt>NIP</dt>
            <dd>
              ${escapeHtml(
                formatNumber(
                  section?.nip
                )
              )}
            </dd>
          </div>

          <div>
            <dt>Shell thickness</dt>
            <dd>
              ${escapeHtml(
                shellThickness
              )}
            </dd>
          </div>

        </dl>

      </div>


      <div class="lsdyna-inspector-section">

        <h4>Material</h4>

        <dl class="lsdyna-inspector-list">

          <div>
            <dt>MID</dt>
            <dd>
              ${escapeHtml(
                formatNumber(item.materialId)
              )}
            </dd>
          </div>

          <div>
            <dt>Keyword</dt>
            <dd>
              <code>
                ${escapeHtml(
                  material?.baseKeyword ||
                  material?.keyword ||
                  "Unresolved"
                )}
              </code>
            </dd>
          </div>

          <div>
            <dt>Behaviour</dt>
            <dd>
              ${escapeHtml(
                material?.type ||
                "Unresolved"
              )}
            </dd>
          </div>

        </dl>


        ${
          material
            ? `
              <div class="lsdyna-inspector-properties">

                ${Object.entries(
                  material.properties || {}
                )
                  .filter(([, value]) =>
                    value !== null &&
                    value !== undefined &&
                    value !== ""
                  )
                  .map(([key, value]) => `

                    <span class="lsdyna-tech-tag">
                      ${escapeHtml(key)}
                      =
                      ${escapeHtml(
                        formatNumber(value)
                      )}
                    </span>

                  `)
                  .join("")}

              </div>
            `
            : ""
        }

      </div>


      <div class="lsdyna-inspector-section">

        <h4>Display</h4>

        <label class="lsdyna-viewer-opacity-control">

          <span>
            Selected-Part opacity
          </span>

          <input
            id="lsdyna-viewer-opacity"
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value="1"
            data-action="viewer-part-opacity"
            data-part-id="${escapeHtml(item.partId)}"
          >

        </label>


        <div class="lsdyna-inspector-actions">

          <button
            class="lsdyna-button"
            type="button"
            data-action="viewer-isolate-part"
            data-part-id="${escapeHtml(item.partId)}"
          >
            Isolate Part
          </button>

          <button
            class="lsdyna-button lsdyna-button-secondary"
            type="button"
            data-action="viewer-toggle-part"
            data-part-id="${escapeHtml(item.partId)}"
          >
            Hide / Show
          </button>

        </div>

      </div>

    `;
  }

  function previewModelTreeHtml() {

    const rows =
      [...state.deck.modelGraph]
        .sort(
          (a, b) =>
            Number(a.partId) -
            Number(b.partId)
        )
        .map((item) => {

          const selected =
            String(item.partId) ===
            String(state.selectedPartId);

          return `

            <div
              class="
                lsdyna-model-tree-row
                ${selected ? "is-selected" : ""}
              "
              data-tree-part="${escapeHtml(item.partId)}"
            >

              <button
                class="lsdyna-model-tree-main"
                type="button"
                data-action="viewer-select-part"
                data-part-id="${escapeHtml(item.partId)}"
              >

                <span class="lsdyna-model-tree-pid">
                  ${escapeHtml(formatNumber(item.partId))}
                </span>

                <span class="lsdyna-model-tree-name">
                  ${escapeHtml(item.title)}
                </span>

              </button>


              <button
                class="lsdyna-model-tree-eye"
                type="button"
                data-action="viewer-toggle-part"
                data-part-id="${escapeHtml(item.partId)}"
                title="Hide or show this Part"
                aria-label="Hide or show PID ${escapeHtml(item.partId)}"
              >
                ◉
              </button>

            </div>

          `;
        })
        .join("");


    return `

      <div class="lsdyna-model-tree-header">

        <div>
          <strong>Model tree</strong>

          <span>
            ${state.deck.modelGraph.length} Parts
          </span>
        </div>


        <button
          class="lsdyna-model-tree-small-button"
          type="button"
          data-action="viewer-show-all"
        >
          Show all
        </button>

      </div>


      <div class="lsdyna-model-tree-search-wrap">

        <input
          id="lsdyna-model-tree-search"
          class="lsdyna-model-tree-search"
          type="search"
          placeholder="Filter PID or Part name…"
          autocomplete="off"
        >

      </div>


      <div
        class="lsdyna-model-tree-list"
        id="lsdyna-model-tree-list"
      >
        ${rows}
      </div>

    `;
  }

  function partsStudyView() {
    const rows = state.deck.modelGraph.map((item) => `
      <tr>
        <td>${escapeHtml(formatNumber(item.partId))}</td>

        <td>
          <strong>${escapeHtml(item.title)}</strong>
        </td>

        <td>
          ${escapeHtml(
            elementBreakdown(item.elementCounts)
          )}
        </td>

        <td>${escapeHtml(formatNumber(item.sectionId))}</td>

        <td>${escapeHtml(formatNumber(item.materialId))}</td>

        <td>${escapeHtml(message("misc.line", {
          line: item.part.line
        }))}</td>
      </tr>
    `);

    return `
      <div class="lsdyna-note">
        A Part is the main bridge between physical model
        components and LS-DYNA property definitions.
      </div>

      <div class="lsdyna-study-table">
        ${standardTable(
          [
            "PID",
            "Part title",
            "Element composition",
            "SID",
            "MID",
            "Definition"
          ],
          rows,
          "No Parts were parsed."
        )}
      </div>
    `;
  }


  function sectionsStudyView() {
    const deck = state.deck;

    const rows = deck.sections.map((section) => {
      const usedBy =
        deck.usage.sections.get(String(section.id)) || [];

      const thickness =
        section.thickness?.length
          ? section.thickness
              .map((value) => formatNumber(value))
              .join(" / ")
          : "—";

      return `
        <tr>
          <td>${escapeHtml(formatNumber(section.id))}</td>

          <td>${escapeHtml(section.type)}</td>

          <td>${escapeHtml(formatNumber(section.elform))}</td>

          <td>${escapeHtml(formatNumber(section.nip))}</td>

          <td>${escapeHtml(thickness)}</td>

          <td>
            ${escapeHtml(
              usedBy.length
                ? usedBy.join(", ")
                : "Unused"
            )}
          </td>

          <td>
            ${escapeHtml(
              message("misc.line", {
                line: section.line
              })
            )}
          </td>
        </tr>
      `;
    });

    return `
      <div class="lsdyna-note">
        Sections define element formulation and geometric
        properties such as shell thickness.
      </div>

      <div class="lsdyna-study-table">
        ${standardTable(
          [
            "SID",
            "Type",
            "ELFORM",
            "NIP",
            "Thickness",
            "Used by PID",
            "Definition"
          ],
          rows,
          "No sections were parsed."
        )}
      </div>
    `;
  }


  function materialsStudyView() {
    const deck = state.deck;

    const rows = deck.materials.map((material) => {
      const usedBy =
        deck.usage.materials.get(String(material.id)) || [];

      return `
        <tr>
          <td>${escapeHtml(formatNumber(material.id))}</td>

          <td>
            <code>
              ${escapeHtml(material.baseKeyword || material.keyword)}
            </code>
          </td>

          <td>${escapeHtml(material.type)}</td>

          <td>
            ${escapeHtml(materialSummary(material))}
          </td>

          <td>
            ${escapeHtml(
              usedBy.length
                ? usedBy.join(", ")
                : "Unused"
            )}
          </td>

          <td>
            ${escapeHtml(
              message("misc.line", {
                line: material.line
              })
            )}
          </td>
        </tr>
      `;
    });

    return `
      <div class="lsdyna-note">
        These values are interpreted from recognised material
        cards. Always verify unusual or advanced material options
        against the raw keyword block and LS-DYNA manual.
      </div>

      <div class="lsdyna-study-table">
        ${standardTable(
          [
            "MID",
            "Keyword",
            "Behaviour",
            "Recognised parameters",
            "Used by PID",
            "Definition"
          ],
          rows,
          "No material cards were parsed."
        )}
      </div>
    `;
  }


  function contactsStudyView() {
    const rows = state.deck.contacts.map((contact) => `
      <tr>

        <td>
          ${escapeHtml(
            contact.id === null
              ? "—"
              : formatNumber(contact.id)
          )}
        </td>

        <td>
          <code>${escapeHtml(contact.keyword)}</code>
        </td>

        <td>${escapeHtml(formatNumber(contact.ssid))}</td>

        <td>${escapeHtml(formatNumber(contact.msid))}</td>

        <td>
          ${escapeHtml(formatNumber(contact.sstyp))}
          /
          ${escapeHtml(formatNumber(contact.mstyp))}
        </td>

        <td>${escapeHtml(formatNumber(contact.fs))}</td>

        <td>${escapeHtml(formatNumber(contact.fd))}</td>

        <td>
          ${escapeHtml(
            message("misc.line", {
              line: contact.line
            })
          )}
        </td>

      </tr>
    `);

    return `
      <div class="lsdyna-note">
        SSID/MSID identify the interacting surfaces or sets.
        SSTYP/MSTYP define how those IDs are interpreted.
        Advanced contact options remain available in Raw Deck.
      </div>

      <div class="lsdyna-study-table">
        ${standardTable(
          [
            "CID",
            "Keyword",
            "SSID",
            "MSID",
            "SSTYP / MSTYP",
            "FS",
            "FD",
            "Definition"
          ],
          rows,
          "No contact cards were parsed."
        )}
      </div>
    `;
  }


  function motionStudyView() {
    const deck = state.deck;

    const motionRows = deck.motions.map((motion) => {

      const magnitude =
        motion.magnitude ??
        (
          motion.vx !== null &&
          motion.vy !== null &&
          motion.vz !== null
            ? Math.sqrt(
                motion.vx ** 2 +
                motion.vy ** 2 +
                motion.vz ** 2
              )
            : null
        );

      return `
        <tr>
          <td>
            <code>${escapeHtml(motionDescription(motion))}</code>
          </td>

          <td>${escapeHtml(targetDescription(motion))}</td>

          <td>${escapeHtml(formatNumber(motion.vx))}</td>
          <td>${escapeHtml(formatNumber(motion.vy))}</td>
          <td>${escapeHtml(formatNumber(motion.vz))}</td>

          <td>${escapeHtml(formatNumber(magnitude))}</td>

          <td>
            ${escapeHtml(
              message("misc.line", {
                line: motion.line
              })
            )}
          </td>
        </tr>
      `;
    });


    const boundaryRows = deck.boundaries.map((boundary) => {

      let target = "—";
      let detail = "";

      if (boundary.type === "spcNode") {

        target = `${boundary.count.toLocaleString()} nodes`;

        detail = boundary.patterns
          ?.slice(0, 3)
          .map((item) => {
            return `${item.pattern} (${item.count})`;
          })
          .join(" · ") || "—";

      } else {

        target =
          boundary.target === null ||
          boundary.target === undefined
            ? "—"
            : formatNumber(boundary.target);

        detail =
          boundary.dofs?.join(", ") ||
          boundary.data?.join(", ") ||
          "—";
      }

      return `
        <tr>
          <td><code>${escapeHtml(boundary.keyword)}</code></td>

          <td>${escapeHtml(target)}</td>

          <td>${escapeHtml(detail)}</td>

          <td>
            ${escapeHtml(
              message("misc.line", {
                line: boundary.line
              })
            )}
          </td>
        </tr>
      `;
    });


    return `
      <h3 class="lsdyna-panel-heading">
        Initial motion
      </h3>

      <div class="lsdyna-study-table">
        ${standardTable(
          [
            "Method",
            "Target",
            "Vx",
            "Vy",
            "Vz",
            "|V|",
            "Definition"
          ],
          motionRows,
          "No supported initial motion was parsed."
        )}
      </div>


      <h3 class="lsdyna-panel-heading">
        Boundary conditions
      </h3>

      <div class="lsdyna-study-table">
        ${standardTable(
          [
            "Keyword",
            "Target",
            "DOF / record summary",
            "Definition"
          ],
          boundaryRows,
          "No boundary-condition cards were parsed."
        )}
      </div>
    `;
  }


  function controlsStudyView() {
    const rows = state.deck.controls.map((control) => {

      const explanation =
        help[control.keyword] ||
        "Control card; inspect the raw block for complete options.";

      return `
        <tr>
          <td>
            <code>${escapeHtml(control.keyword)}</code>
          </td>

          <td>
            ${escapeHtml(
              control.values?.join(", ") || "—"
            )}
          </td>

          <td>${escapeHtml(explanation)}</td>

          <td>
            ${escapeHtml(
              message("misc.line", {
                line: control.line
              })
            )}
          </td>
        </tr>
      `;
    });

    return `
      <div class="lsdyna-note">
        Only the first recognised data record is summarised here.
        Use Raw Deck when studying multi-card control definitions.
      </div>

      <div class="lsdyna-study-table">
        ${standardTable(
          [
            "Keyword",
            "First data record",
            "Purpose",
            "Definition"
          ],
          rows,
          "No control cards were parsed."
        )}
      </div>
    `;
  }


  function outputsStudyView() {
    const rows = state.deck.databases.map((database) => {

      const explanation =
        help[database.keyword] ||
        "LS-DYNA database or result-output request.";

      return `
        <tr>

          <td>
            <code>${escapeHtml(database.keyword)}</code>
          </td>

          <td>${escapeHtml(formatNumber(database.dt))}</td>

          <td>
            ${escapeHtml(
              database.values?.join(", ") || "—"
            )}
          </td>

          <td>${escapeHtml(explanation)}</td>

          <td>
            ${escapeHtml(
              message("misc.line", {
                line: database.line
              })
            )}
          </td>

        </tr>
      `;
    });

    return `
      <div class="lsdyna-note">
        Output cards determine which histories and binary result
        files are available after the calculation.
      </div>

      <div class="lsdyna-study-table">
        ${standardTable(
          [
            "Keyword",
            "DT / first value",
            "First data record",
            "Purpose",
            "Definition"
          ],
          rows,
          "No database output cards were parsed."
        )}
      </div>
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

    if (
      state.activeView === "preview"
    ) {

      return previewView();

    }    

    if (state.activeView === "model") {
      return modelView();
    }

    if (state.activeView === "parts") {
      return partsStudyView();
    }

    if (state.activeView === "sections") {
      return sectionsStudyView();
    }

    if (state.activeView === "materials") {
      return materialsStudyView();
    }

    if (state.activeView === "contacts") {
      return contactsStudyView();
    }

    if (state.activeView === "motion") {
      return motionStudyView();
    }

    if (state.activeView === "controls") {
      return controlsStudyView();
    }

    if (state.activeView === "outputs") {
      return outputsStudyView();
    }

    if (state.activeView === "parameters") {
      return parameterView();
    }

    if (state.activeView === "raw") {
      return rawView();
    }

    if (state.activeView === "validation") {
      return validationView();
    }

    return overviewView();
  }

  function workspaceHtml() {
    const deck = state.deck;
    const viewCopy = viewMeta(state.activeView);

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
            ${studyViews.map((view) => `
              <button
                class="lsdyna-view-nav-button ${view === state.activeView ? "is-active" : ""}"
                type="button"
                data-action="switch-view"
                data-view="${view}"
                ${view === state.activeView ? 'aria-current="page"' : ""}
              >
                ${navLabel(view)}
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

    if (!state.deck) {
      return;
    }


    /*
     * Dispose any WebGL viewer attached to the previous
     * workspace DOM before replacing the HTML.
     */

    if (
      window.CorrosionAtlasLsdynaViewer
    ) {

      window
        .CorrosionAtlasLsdynaViewer
        .dispose();

    }


    workspace.innerHTML =
      workspaceHtml();

    workspace.hidden =
      false;

    uploadPanel.hidden =
      true;


    if (
      state.activeView === "preview"
    ) {

      schedulePreviewMount();

    }
  }

  function schedulePreviewMount() {

    window.requestAnimationFrame(
      () => {

        const host =
          workspace.querySelector(
            "#lsdyna-3d-host"
          );

        const statusElement =
          workspace.querySelector(
            "#lsdyna-viewer-status"
          );


        if (!host) {
          return;
        }


        const mountViewer = () => {

          const viewer =
            window
              .CorrosionAtlasLsdynaViewer;


          if (!viewer) {

            if (statusElement) {

              statusElement.textContent =
                "3D viewer module is still loading…";

            }

            return false;
          }


          try {

            if (statusElement) {

              statusElement.textContent =
                "Building 3D geometry…";

            }


            viewer.mount(

              host,

              state.deck.geometry,

              {
                statusElement,

                partMetadata:
                  createViewerPartMetadata(
                    state.deck
                  ),

                colorMode:
                  state.viewerColorMode,

                selectedPartId:
                  state.selectedPartId,

                onSelect:
                  (partId) => {

                    updatePreviewSelection(
                      partId
                    );

                  }
              }

            );


            return true;

          } catch (error) {

            console.error(
              "LS-DYNA viewer error:",
              error
            );


            if (statusElement) {

              statusElement.textContent =
                `Preview error: ${error.message}`;

            }


            return false;
          }
        };


        if (mountViewer()) {
          return;
        }


        /*
         * If the module has not finished loading yet,
         * retry automatically when it announces readiness.
         */

        window.addEventListener(

          "lsdyna-viewer-ready",

          () => {
            mountViewer();
          },

          {
            once: true
          }

        );

      }
    );
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

      if (
        action === "viewer-fit"
      ) {

        window
          .CorrosionAtlasLsdynaViewer
          ?.fit();

      }


      if (
        action === "viewer-view"
      ) {

        window
          .CorrosionAtlasLsdynaViewer
          ?.setView(
            control.dataset.viewerView
          );

      }


      if (
        action === "viewer-wireframe"
      ) {

        const enabled =
          window
            .CorrosionAtlasLsdynaViewer
            ?.toggleWireframe();

        control.classList.toggle(
          "is-active",
          Boolean(enabled)
        );

      }


      if (
        action === "viewer-toggle-kind"
      ) {

        const visible =
          window
            .CorrosionAtlasLsdynaViewer
            ?.toggleKind(
              control.dataset.viewerKind
            );

        control.classList.toggle(
          "is-muted",
          visible === false
        );

      }
      
      if (
        action ===
        "viewer-select-part"
      ) {

        selectPreviewPart(
          control.dataset.partId
        );

      }


      if (
        action ===
        "viewer-toggle-part"
      ) {

        window
          .CorrosionAtlasLsdynaViewer
          ?.togglePart(
            control.dataset.partId
          );

      }


      if (
        action ===
        "viewer-isolate-part"
      ) {

        const partId =
          control.dataset.partId;


        window
          .CorrosionAtlasLsdynaViewer
          ?.isolatePart(
            partId
          );


        selectPreviewPart(
          partId
        );

      }


      if (
        action ===
        "viewer-show-all"
      ) {

        window
          .CorrosionAtlasLsdynaViewer
          ?.showAllParts();

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

    workspace.addEventListener(
      "change",
      (event) => {

        if (
          event.target.dataset.action !==
          "viewer-color-mode"
        ) {
          return;
        }


        const mode =
          event.target.value;


        state.viewerColorMode =
          mode;


        window
          .CorrosionAtlasLsdynaViewer
          ?.setColorMode(
            mode
          );

      }
    );

    workspace.addEventListener(
      "input",
      (event) => {

        /* -----------------------------------------------
           Model tree filtering
           ----------------------------------------------- */

        if (
          event.target.id ===
          "lsdyna-model-tree-search"
        ) {

          const query =
            event.target.value
              .trim()
              .toLowerCase();


          workspace
            .querySelectorAll(
              "[data-tree-part]"
            )
            .forEach((row) => {

              const text =
                row.textContent
                  .toLowerCase();


              row.hidden =
                query &&
                !text.includes(query);

            });

        }


        /* -----------------------------------------------
           Selected-Part opacity
           ----------------------------------------------- */

        if (
          event.target.dataset.action ===
          "viewer-part-opacity"
        ) {

          const partId =
            event.target.dataset.partId;

          const opacity =
            Number(
              event.target.value
            );


          window
            .CorrosionAtlasLsdynaViewer
            ?.setPartOpacity(
              partId,
              opacity
            );

        }

      }
    );
  
  }

  setupEvents();
  setStatus(message("status.ready"));
})();
