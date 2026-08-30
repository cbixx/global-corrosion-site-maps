(() => {
  const STORAGE_KEY =
    "corrosion-atlas-curator-language";

  const SUPPORTED =
    new Set([
      "en",
      "zh",
    ]);

  const ZH = {
    "Curator":
      "管理端",

    "Private curator":
      "私有管理端",

    "Dashboard":
      "总览",

    "Sites":
      "站点",

    "Sources":
      "来源",

    "Evidence Links":
      "证据关联",

    "Evidence links":
      "证据关联",

    "Corrosion":
      "腐蚀数据",

    "Corrosion Data":
      "腐蚀数据",

    "Environmental Data":
      "环境数据",

    "Manage Records":
      "记录管理",

    "Export / Publish":
      "导出 / 发布",

    "Settings":
      "设置",

    "Import":
      "导入",

    "Database":
      "数据库",

    "Available":
      "可用",

    "Migration pending":
      "待迁移",

    "Export available":
      "可导出",

    "Curator navigation":
      "管理端导航",

    "Interface language":
      "界面语言",

    "Switch language":
      "切换语言",

    "Corrosion Atlas Curator":
      "Corrosion Atlas 管理端",

    "Corrosion Atlas data infrastructure":
      "腐蚀图谱数据基础设施",

    "Manage exposure sites, source evidence, corrosion data, environmental observations, and publication workflows.":
      "管理暴露站点、来源证据、腐蚀数据、环境观测及发布流程。",

    "Loading database summary…":
      "正在加载数据库概况…",

    "Unable to load database summary.":
      "无法加载数据库概况。",

    "Curated exposure locations":
      "已整理的暴露地点",

    "Literature, reports and datasets":
      "文献、报告与数据集",

    "Site ↔ source relationships":
      "站点 ↔ 来源关联",

    "Corrosion observations":
      "腐蚀观测",

    "Measurement-level records":
      "测量级记录",

    "Environmental observations":
      "环境观测",

    "Climate and exposure context":
      "气候与暴露环境信息",

    "Register, search and edit source records and their linked sites.":
      "登记、搜索和编辑来源记录及其关联站点。",

    "Search, create and edit exposure sites and supporting evidence.":
      "搜索、创建和编辑暴露站点及其支撑证据。",

    "Bulk-link Sources to Sites and maintain Site–Source evidence metadata.":
      "批量关联来源与站点，并维护站点—来源证据元数据。",

    "Browse measurement-level corrosion observations and prepare source-first workbook entry.":
      "浏览测量级腐蚀观测，并按来源准备工作簿录入。",

    "Climatic and environmental observation records.":
      "气候与环境观测记录。",

    "Search and maintain Sites, Sources, evidence links, corrosion observations, and environmental observations.":
      "搜索和维护站点、来源、证据关联、腐蚀观测和环境观测。",

    "Preview and import bulk Site and Source datasets.":
      "预览并导入批量站点和来源数据集。",

    "Select public Sites and generate website datasets for publication.":
      "选择公开站点并生成用于发布的网站数据集。",

    "Region-classification rules and curator infrastructure status.":
      "区域分类规则与管理端基础设施状态。",

    "Browse":
      "浏览",

    "Create one":
      "单个创建",

    "Create multiple":
      "批量创建",

    "Browse existing exposure sites or create new Sites individually or in bulk.":
      "浏览现有暴露站点，或单个/批量创建新站点。",

    "Search ID, site name, country, region, or type…":
      "搜索 ID、站点名称、国家、区域或类型…",

    "Loading sites…":
      "正在加载站点…",

    "No sites match your search.":
      "没有符合搜索条件的站点。",

    "Unable to load sites from the database.":
      "无法从数据库加载站点。",

    "No location information":
      "无位置信息",

    "Create multiple Sites":
      "批量创建站点",

    "Enter one geographic search per line. Add a country, province, region, or other context when a place name could be ambiguous.":
      "每行输入一个地理位置检索词。地点名称可能有歧义时，可加入国家、省份、地区或其他上下文。",

    "Geographic searches":
      "地理位置检索",

    "One non-empty line = one independent geographic search. Maximum 50 searches per batch.":
      "每个非空行视为一次独立地理检索。每批最多 50 个检索。",

    "Analyse Sites":
      "分析站点",

    "Analysing…":
      "正在分析…",

    "Clear":
      "清除",

    "Review":
      "检查",

    "All":
      "全部",

    "Ready":
      "可创建",

    "Needs review":
      "需检查",

    "Existing":
      "已存在",

    "Select ready":
      "选择可创建项",

    "Clear selection":
      "清除选择",

    "Create selected Sites":
      "创建所选站点",

    "Ready Sites are selected by default. Existing Sites are excluded. Each selected Site is revalidated through the normal Site-creation workflow before it is saved.":
      "可创建站点默认选中，已存在站点自动排除。每个所选站点在保存前都会通过常规站点创建流程重新验证。",

    "Search query":
      "检索词",

    "Geographic match":
      "地理匹配",

    "Site label":
      "站点名称",

    "Country / location":
      "国家 / 地区",

    "Modern country / location":
      "现属国家 / 地区",

    "Modern country location":
      "现属国家 / 地区",

    "Administering country":
      "管理国家",

    "Latitude":
      "纬度",

    "Longitude":
      "经度",

    "Region":
      "区域分类",

    "Region category":
      "区域分类",

    "Site type":
      "站点类型",

    "Site ID":
      "站点 ID",

    "Former entity":
      "历史所属实体",

    "Exposure period":
      "暴露期",

    "Metal":
      "金属",

    "Metals":
      "金属",

    "Notes":
      "备注",

    "Create":
      "创建",

    "Creating…":
      "正在创建…",

    "Created":
      "已创建",

    "Merged":
      "已合并",

    "Create failed":
      "创建失败",

    "No Sites in this filter.":
      "此筛选条件下没有站点。",

    "Searching geographic locations…":
      "正在检索地理位置…",

    "No geographic matches were returned.":
      "未返回地理匹配结果。",

    "Likely existing Site":
      "可能已存在的站点",

    "Same Site label and country":
      "站点名称和国家相同",

    "Unable to create Site.":
      "无法创建站点。",

    "Unable to generate Site ID.":
      "无法生成站点 ID。",

    "Location lookup failed.":
      "位置检索失败。",

    "Region classification failed.":
      "区域分类失败。",

    "Enter at least one geographic search.":
      "请至少输入一个地理位置检索词。",

    "Loading existing Sites…":
      "正在加载现有站点…",

    "Site":
      "站点",

    "← Sites":
      "← 站点",

    "Loading site…":
      "正在加载站点…",

    "Missing site ID.":
      "缺少站点 ID。",

    "Edit":
      "编辑",

    "Cancel":
      "取消",

    "Save":
      "保存",

    "Saved.":
      "已保存。",

    "Location lookup":
      "位置检索",

    "Search OpenStreetMap, then apply a result to fill the site name, coordinates, and country.":
      "搜索 OpenStreetMap，并应用结果以填写站点名称、坐标和国家。",

    "Search":
      "搜索",

    "Searching…":
      "正在搜索…",

    "Enter a modern country / location to generate a Site ID.":
      "输入现属国家 / 地区以生成站点 ID。",

    "Automatic region classification":
      "自动区域分类",

    "Classifying…":
      "正在分类…",

    "No classification suggested.":
      "未生成分类建议。",

    "Region classification unavailable.":
      "区域分类暂不可用。",

    "Linked sources":
      "关联来源",

    "Sources associated with this exposure site.":
      "与该暴露站点关联的来源。",

    "+ Add source":
      "+ 添加来源",

    "Source":
      "来源",

    "Source order":
      "来源顺序",

    "Exposure periods":
      "暴露期",

    "Save link":
      "保存关联",

    "Loading linked sources…":
      "正在加载关联来源…",

    "No linked sources.":
      "暂无关联来源。",

    "Remove":
      "移除",

    "Delete":
      "删除",

    "e.g. Yakutsk":
      "例如：Yakutsk",

    "e.g. Yakutsk, Russia":
      "例如：Yakutsk, Russia",

    "e.g. City, Research station, Industrial site":
      "例如：City、Research station、Industrial site",

    "e.g. 62.0355":
      "例如：62.0355",

    "e.g. 129.6755":
      "例如：129.6755",

    "e.g. Russia or Antarctica":
      "例如：Russia 或 Antarctica",

    "For Antarctic IDs such as AQ-RU-001":
      "用于 AQ-RU-001 等南极站点 ID",

    "e.g. USSR":
      "例如：USSR",

    "Comma-separated region tags":
      "以逗号分隔的区域标签",

    "e.g. 1987–1991 or 1 year":
      "例如：1987–1991 或 1 year",

    "Comma-separated materials":
      "以逗号分隔的材料",

    "Optional Site notes":
      "可选站点备注",
  };


  const originalText =
    new WeakMap();

  const originalAttrs =
    new WeakMap();

  let language =
    readLanguage();

  let observer =
    null;


  function readLanguage() {
    try {
      const stored =
        localStorage.getItem(
          STORAGE_KEY
        );

      return SUPPORTED.has(
        stored
      )
        ? stored
        : "en";
    } catch {
      return "en";
    }
  }


  function clean(
    value
  ) {
    return String(
      value || ""
    )
      .trim()
      .replace(
        /\s+/g,
        " "
      );
  }


  function pattern(
    source
  ) {
    let m;


    if (
      (
        m =
          source.match(
            /^(\d+) sites?$/
          )
      )
    ) {
      return `${m[1]} 个站点`;
    }


    if (
      (
        m =
          source.match(
            /^(\d+) selected$/
          )
      )
    ) {
      return `已选择 ${m[1]} 个`;
    }


    if (
      (
        m =
          source.match(
            /^Suggested Site ID: (.+)$/
          )
      )
    ) {
      return `建议站点 ID：${m[1]}`;
    }


    if (
      (
        m =
          source.match(
            /^Looking up Site (\d+) of (\d+): (.+)$/
          )
      )
    ) {
      return (
        `正在查询站点 ${m[1]}/${m[2]}：` +
        m[3]
      );
    }


    if (
      (
        m =
          source.match(
            /^Creating (\d+) of (\d+): (.+)$/
          )
      )
    ) {
      return (
        `正在创建 ${m[1]}/${m[2]}：` +
        m[3]
      );
    }


    if (
      (
        m =
          source.match(
            /^Creating (\d+) Sites?…$/
          )
      )
    ) {
      return (
        `正在创建 ${m[1]} 个站点…`
      );
    }


    if (
      (
        m =
          source.match(
            /^(\d+) created · (\d+) merged · (\d+) failed$/
          )
      )
    ) {
      return (
        `${m[1]} 个已创建 · ` +
        `${m[2]} 个已合并 · ` +
        `${m[3]} 个失败`
      );
    }


    m =
      source.match(
        /^(\d+) searches? · (\d+) ready · (\d+) need review · (\d+) existing(?: · (\d+) searching)?(?: · (\d+) created)?(?: · (\d+) merged)?(?: · (\d+) failed)?$/
      );


    if (m) {
      const parts = [
        `${m[1]} 个检索`,
        `${m[2]} 个可创建`,
        `${m[3]} 个需检查`,
        `${m[4]} 个已存在`,
      ];


      if (m[5]) {
        parts.push(
          `${m[5]} 个正在检索`
        );
      }


      if (m[6]) {
        parts.push(
          `${m[6]} 个已创建`
        );
      }


      if (m[7]) {
        parts.push(
          `${m[7]} 个已合并`
        );
      }


      if (m[8]) {
        parts.push(
          `${m[8]} 个失败`
        );
      }


      return parts.join(
        " · "
      );
    }


    m =
      source.match(
        /^Analysis complete\.(?: (\d+) duplicate input lines? removed\.)?$/
      );


    if (m) {
      return m[1]
        ? (
            `分析完成。已移除 ` +
            `${m[1]} 个重复输入行。`
          )
        : "分析完成。";
    }


    m =
      source.match(
        /^This batch contains (\d+) unique searches\. Please limit each batch to (\d+)\.$/
      );


    if (m) {
      return (
        `本批次包含 ${m[1]} 个唯一检索。` +
        `每批请限制在 ${m[2]} 个以内。`
      );
    }


    m =
      source.match(
        /^Existing Site within (\d+) m$/
      );


    if (m) {
      return (
        `现有站点距离约 ${m[1]} m`
      );
    }


    m =
      source.match(
        /^Nearest coastline distance ≈ ([\d.]+) km\. Broad climate context suggested as (.+) using latitude\/text heuristic\.$/
      );


    if (m) {
      return (
        `最近海岸线距离约 ${m[1]} km。` +
        `根据纬度/文本启发式判断，` +
        `宽泛气候背景为 ${m[2]}。`
      );
    }


    m =
      source.match(
        /^(.+) · Corrosion Atlas Curator$/
      );


    if (m) {
      return (
        `${m[1]} · Corrosion Atlas 管理端`
      );
    }


    return null;
  }


  function translate(
    value,
    lang = language
  ) {
    const source =
      clean(
        value
      );


    if (
      !source ||
      lang === "en"
    ) {
      return source;
    }


    return Object.hasOwn(
      ZH,
      source
    )
      ? ZH[source]
      : (
          pattern(
            source
          ) ||
          source
        );
  }


  function skipText(
    node
  ) {
    const parent =
      node.parentElement;


    if (!parent) {
      return false;
    }


    if (
      [
        "SCRIPT",
        "STYLE",
        "NOSCRIPT",
        "CODE",
        "PRE",
        "TEXTAREA",
      ].includes(
        parent.tagName
      )
    ) {
      return true;
    }


    return Boolean(
      parent.closest(
        "[data-i18n-skip]"
      )
    );
  }


  function applyText(
    node
  ) {
    if (
      !node ||
      node.nodeType !==
        Node.TEXT_NODE ||
      skipText(
        node
      )
    ) {
      return;
    }


    if (
      !originalText.has(
        node
      )
    ) {
      originalText.set(
        node,
        node.nodeValue || ""
      );
    }


    const original =
      originalText.get(
        node
      );


    if (
      !String(
        original || ""
      ).trim()
    ) {
      return;
    }


    let desired =
      original;


    if (
      language !==
      "en"
    ) {
      const leading =
        original.match(
          /^\s*/
        )?.[0] || "";

      const trailing =
        original.match(
          /\s*$/
        )?.[0] || "";


      desired =
        `${leading}` +
        `${translate(original)}` +
        `${trailing}`;
    }


    if (
      node.nodeValue !==
      desired
    ) {
      node.nodeValue =
        desired;
    }
  }


  function applyAttrs(
    element
  ) {
    if (
      !element ||
      element.nodeType !==
        Node.ELEMENT_NODE ||
      element.closest(
        "[data-i18n-skip]"
      )
    ) {
      return;
    }


    if (
      !originalAttrs.has(
        element
      )
    ) {
      originalAttrs.set(
        element,
        new Map()
      );
    }


    const originals =
      originalAttrs.get(
        element
      );


    for (
      const attr
      of [
        "placeholder",
        "title",
        "aria-label",
      ]
    ) {
      if (
        !element.hasAttribute(
          attr
        )
      ) {
        continue;
      }


      if (
        !originals.has(
          attr
        )
      ) {
        originals.set(
          attr,
          element.getAttribute(
            attr
          ) || ""
        );
      }


      const original =
        originals.get(
          attr
        );


      const desired =
        language === "en"
          ? original
          : translate(
              original
            );


      if (
        element.getAttribute(
          attr
        ) !== desired
      ) {
        element.setAttribute(
          attr,
          desired
        );
      }
    }
  }


  function applyNode(
    root
  ) {
    if (!root) {
      return;
    }


    if (
      root.nodeType ===
      Node.TEXT_NODE
    ) {
      applyText(
        root
      );

      return;
    }


    if (
      root.nodeType ===
      Node.ELEMENT_NODE
    ) {
      applyAttrs(
        root
      );
    }


    const walker =
      document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT |
          NodeFilter.SHOW_TEXT
      );


    for (
      let node =
        walker.nextNode();

      node;

      node =
        walker.nextNode()
    ) {
      if (
        node.nodeType ===
        Node.TEXT_NODE
      ) {
        applyText(
          node
        );
      } else {
        applyAttrs(
          node
        );
      }
    }
  }


  function apply(
    root = document
  ) {
    document.documentElement.lang =
      language === "zh"
        ? "zh-CN"
        : "en";


    applyNode(
      root
    );
  }


  function setLanguage(
    nextLanguage
  ) {
    if (
      !SUPPORTED.has(
        nextLanguage
      )
    ) {
      return;
    }


    language =
      nextLanguage;


    try {
      localStorage.setItem(
        STORAGE_KEY,
        nextLanguage
      );
    } catch {
      // localStorage is optional.
    }


    apply(
      document
    );


    window.dispatchEvent(
      new CustomEvent(
        "curator-language-change",
        {
          detail: {
            language,
          },
        }
      )
    );
  }


  function startObserver() {
    if (
      observer ||
      !document.documentElement
    ) {
      return;
    }


    observer =
      new MutationObserver(
        (
          mutations
        ) => {
          for (
            const mutation
            of mutations
          ) {
            if (
              mutation.type ===
              "characterData"
            ) {
              applyText(
                mutation.target
              );

              continue;
            }


            for (
              const node
              of mutation.addedNodes
            ) {
              applyNode(
                node
              );
            }
          }
        }
      );


    observer.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true,
        characterData: true,
      }
    );
  }


  window.CuratorI18n = {
    apply,

    getLanguage:
      () => language,

    setLanguage,

    t:
      (value) =>
        translate(
          value
        ),
  };


  apply(
    document
  );

  startObserver();
})();