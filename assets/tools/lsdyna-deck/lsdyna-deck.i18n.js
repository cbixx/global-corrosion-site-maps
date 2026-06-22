window.CorrosionAtlasLsdynaDeckI18n = {
  en: {
    status: {
      ready: "Ready to open a keyword deck.",
      reading: "Reading {name} locally…",
      loaded: "Loaded {name}.",
      unsupported: "This file does not look like a supported LS-DYNA keyword deck. You may still try opening it as plain text.",
      tooLarge: "This file is {size} MB. Large decks can make the browser slow.",
      readError: "The file could not be read as text."
    },

    confirm: {
      largeFile: "This file is {size} MB. Parsing a large deck may slow the browser. Continue?",
      reset: "Discard all in-browser edits and return to the original loaded file?"
    },

    nav: {
      overview: "Overview",
      parameters: "Parameter editor",
      raw: "Raw keyword editor",
      validation: "Basic checks & export"
    },

    view: {
      overview: {
        title: "Overview",
        subtitle: "Model map and recognised high-level inputs."
      },
      parameters: {
        title: "Parameter editor",
        subtitle: "Guided edits for selected common impact-model parameters."
      },
      raw: {
        title: "Raw keyword editor",
        subtitle: "Direct editing for one LS-DYNA keyword block at a time."
      },
      validation: {
        title: "Basic checks & export",
        subtitle: "Lightweight consistency checks, export, and guardrails."
      }
    },

    action: {
      exportDeck: "Export edited .k",
      reset: "Reset to original",
      openAnother: "Open another deck",
      apply: "Apply parameter edits",
      discard: "Discard form changes",
      applyRaw: "Apply this raw block",
      restoreRaw: "Restore this block from original",
      exportSummary: "Download edit summary",
      exportNow: "Export edited .k"
    },

    side: {
      unsaved: "Unsaved edits in memory",
      fileMeta: "{filename} · {lines} lines · {blocks} keyword blocks"
    },

    overview: {
      modelMapTitle: "Model map",
      modelMap: "A <code>PART</code> links each physical component to a <code>SECTION</code> and <code>MAT</code>; <code>NODE</code> and <code>ELEMENT</code> define geometry; motion, boundary, contact, and control cards define the analysis.",
      cards: {
        parts: "Parts",
        materials: "Materials",
        sections: "Sections",
        nodes: "Nodes",
        elements: "Elements",
        endTime: "End time",
        contacts: "Contacts",
        d3plot: "d3plot interval"
      },
      cardSub: {
        components: "Model components",
        recognised: "Recognised cards",
        forms: "Shell/solid forms",
        coordinates: "Parsed coordinates",
        elementBreakdown: "{solid} solid · {shell} shell",
        deckTime: "Deck time units",
        interaction: "Interaction cards",
        animation: "Animation output"
      },
      partMap: "Part map",
      motion: "Recognised initial motion",
      noParts: "No parts were parsed.",
      noMotion: "No supported initial-velocity card was parsed.",
      partHeaders: ["ID", "Part", "Material behaviour", "Section", "Elements"],
      motionHeaders: ["Method", "Target", "Vx", "Vy", "Vz", "Keyword"],
      rawNote: "Use the Parameter editor for common variables. Use the Raw keyword editor for any card or option the guided editor does not expose."
    },

    parameter: {
      ruleTitle: "Editing rule",
      rule: "This page updates only recognised fields and preserves every other card. Edited records are written back as comma-separated free-format values, which LS-DYNA accepts. Export a new file and run LS-PrePost / LS-DYNA checks before relying on results.",
      identity: "Deck identity",
      identityNote: "Title only. Units are documented in a comment and should be edited in the Raw keyword editor when necessary.",
      title: "Model title",
      titleHelp: "Updates the first data line under *TITLE.",
      runtime: "Run time and database output",
      runtimeNote: "Controls calculation duration and output intervals.",
      endTime: "End time",
      noEndTime: "No *CONTROL_TERMINATION card was found.",
      shellSections: "Shell sections",
      noShell: "No *SECTION_SHELL cards were parsed.",
      thickness: "t{index}",
      thicknessHelp: "Use the deck's selected length unit.",
      shellNote: "Thickness values are assigned at the shell element's four corners. Equal values create uniform thickness.",
      materials: "Materials",
      noMaterial: "No supported materials were parsed.",
      motion: "Initial motion",
      noMotion: "No supported initial-velocity card was parsed.",
      contacts: "Contact parameters",
      noContact: "No contact cards were parsed.",
      boundary: "Boundary restraints",
      noBoundary: "No *BOUNDARY_SPC_SET cards were parsed.",
      rawOnly: "Use the Raw keyword editor for this material type.",
      rawNote: "For part names, unusual materials, curves, damage, contact options, or any card not visible here, use Raw keyword editor. This split keeps common changes simple while retaining full LS-DYNA flexibility.",
      density: "Density (RO)",
      modulus: "Young's modulus (E)",
      poisson: "Poisson ratio (PR)",
      yield: "Yield stress (SIGY)",
      tangent: "Tangent modulus (ETAN)",
      failure: "Failure strain (FAIL)",
      failureHelp: "0 disables element erosion.",
      delay: "Time delay (TDEL)",
      constraintMode: "CMO",
      constraintHelp: "Rigid-body constraint mode.",
      staticFriction: "Static friction (FS)",
      dynamicFriction: "Dynamic friction (FD)",
      ssid: "SSID",
      msid: "MSID",
      sstyp: "SSTYP",
      mstyp: "MSTYP",
      restraint: "{axis} restraint",
      restraintHelp: "1 = restrained; 0 = free. These are translational and rotational boundary DOFs.",
      contactNote: "Use the Raw keyword editor for advanced contact parameters."
    },

    raw: {
      intro: "Edit this one keyword block directly. Keep comments beginning with <code>$</code> and do not place another <code>*</code> keyword line inside the editor.",
      guide: "The raw block editor is the universal escape hatch. It is powerful, so the tool requires exactly one keyword header in the edited block.",
      firstLine: "The first non-empty line must be a keyword header beginning with *.",
      oneBlock: "Edit one keyword block at a time. Do not include another * keyword line in this editor.",
      restoreError: "The original block at this position could not be found."
    },

    validation: {
      intro: "Before every serious run: export a copy, reopen it in LS-PrePost, inspect Keyword Reader Messages, and verify solver termination and energy balance. These basic checks cannot replace LS-DYNA's full keyword reader.",
      checks: "Deck checks",
      noChecks: "No checks were generated.",
      recognised: "Recognised keyword guide",
      noRecognised: "No explanatory keyword cards were recognised in this deck.",
      export: "Export",
      exportText: "Export creates a new file ending in <code>_edited.k</code>. The original loaded file remains untouched.",
      exportBlocked: "Cannot export safely: no *END card is present. Add *END before exporting.",
      summaryTitle: "LS-DYNA Deck Editor Summary",
      diagnostics: "Diagnostics"
    },

    diagnostics: {
      noKeyword: ["error", "No *KEYWORD header found", "LS-DYNA input decks normally begin with *KEYWORD."],
      noEnd: ["error", "No *END card found", "Add *END at the end of the deck before exporting."],
      noUnits: ["warning", "No units comment found", "LS-DYNA does not enforce a unit system. Add a comment such as '$ Units: kg, mm, ms, kN'."],
      units: ["good", "Units comment found: {units}", "The tool displays values exactly as stored; correct interpretation still depends on consistent units."],
      noTermination: ["warning", "No *CONTROL_TERMINATION card", "The intended analysis duration is not explicitly parsed."],
      termination: ["good", "End time: {value}", "Verify this is appropriate for the initial gap and impact duration."],
      noContact: ["warning", "No contact card found", "An impact model normally needs a contact definition or a rigid-wall formulation."],
      noMotion: ["warning", "No initial or prescribed motion parsed", "The model may be static, include driven loading elsewhere, or use an unsupported card."],
      noD3plot: ["warning", "No d3plot output request found", "You may not obtain a deformation animation."],
      include: ["warning", "*INCLUDE card detected", "Included files are not resolved by this browser tool. Inspect the include paths and linked decks manually in LS-PrePost / LS-DYNA."],
      parameter: ["warning", "*PARAMETER card detected", "Parameter substitution is not evaluated by this browser tool. Guided values may not represent the expanded solver deck."],
      missingMaterial: ["error", "Part {part} refers to missing material {material}", "{title} cannot be fully interpreted."],
      missingSection: ["error", "Part {part} refers to missing section {section}", "{title} cannot be fully interpreted."],
      missingPart: ["error", "{count} element(s) refer to missing Part {part}", "Check element part IDs and *PART cards."],
      blankRecords: ["warning", "{keyword} contains blank physical line(s)", "Blank records can be misread inside variable-length blocks. Inspect raw block at line {line}."]
    },

    material: {
      rigid: "Rigid body",
      elastic: "Linear elastic",
      plastic: "Piecewise linear plasticity (MAT_024)"
    },

    misc: {
      untitled: "(untitled part)",
      missing: "missing {value}",
      target: "Target {value}",
      part: "Part {value}",
      rigidTarget: "Part {value}",
      noValue: "—",
      line: "line {line}",
      elementCount: "{solid} solid · {shell} shell · {beam} beam",
      shell: "Shell",
      solid: "Solid",
      warning: "Warning",
      error: "Error",
      good: "Good"
    }
  },

  zh: {
    status: {
      ready: "可打开 LS-DYNA 关键字文件。",
      reading: "正在本地读取 {name}…",
      loaded: "已加载 {name}。",
      unsupported: "该文件看起来不像常见的 LS-DYNA 关键字文件，但仍可按纯文本尝试读取。",
      tooLarge: "该文件大小为 {size} MB。较大的 deck 可能使浏览器运行变慢。",
      readError: "无法将该文件按文本格式读取。"
    },

    confirm: {
      largeFile: "该文件大小为 {size} MB。解析大型 deck 可能使浏览器变慢。是否继续？",
      reset: "是否放弃当前浏览器内的所有编辑，并恢复为最初加载的文件？"
    },

    nav: {
      overview: "概览",
      parameters: "参数编辑器",
      raw: "原始关键字编辑器",
      validation: "基础检查与导出"
    },

    view: {
      overview: {
        title: "概览",
        subtitle: "模型组成及已识别的主要输入。"
      },
      parameters: {
        title: "参数编辑器",
        subtitle: "用于编辑部分常见碰撞模型参数的引导界面。"
      },
      raw: {
        title: "原始关键字编辑器",
        subtitle: "每次直接编辑一个 LS-DYNA 关键字块。"
      },
      validation: {
        title: "基础检查与导出",
        subtitle: "轻量化一致性检查、导出与使用提示。"
      }
    },

    action: {
      exportDeck: "导出编辑后的 .k",
      reset: "恢复原始文件",
      openAnother: "打开其他文件",
      apply: "应用参数修改",
      discard: "放弃表单修改",
      applyRaw: "应用当前关键字块",
      restoreRaw: "从原始文件恢复此关键字块",
      exportSummary: "下载编辑摘要",
      exportNow: "导出编辑后的 .k"
    },

    side: {
      unsaved: "浏览器内存在未导出的修改",
      fileMeta: "{filename} · {lines} 行 · {blocks} 个关键字块"
    },

    overview: {
      modelMapTitle: "模型结构说明",
      modelMap: "<code>PART</code> 将每个物理部件关联至 <code>SECTION</code> 和 <code>MAT</code>；<code>NODE</code> 与 <code>ELEMENT</code> 定义几何；运动、边界、接触和控制卡定义分析过程。",
      cards: {
        parts: "部件",
        materials: "材料",
        sections: "截面",
        nodes: "节点",
        elements: "单元",
        endTime: "终止时间",
        contacts: "接触卡",
        d3plot: "d3plot 间隔"
      },
      cardSub: {
        components: "模型构件",
        recognised: "已识别卡片",
        forms: "壳／实体形式",
        coordinates: "已解析坐标",
        elementBreakdown: "{solid} 实体 · {shell} 壳",
        deckTime: "deck 时间单位",
        interaction: "相互作用卡",
        animation: "动画输出"
      },
      partMap: "部件关系表",
      motion: "已识别的初始运动",
      noParts: "未解析到部件。",
      noMotion: "未解析到已支持的初始速度卡。",
      partHeaders: ["ID", "部件", "材料行为", "截面", "单元数"],
      motionHeaders: ["方式", "目标", "Vx", "Vy", "Vz", "关键字"],
      rawNote: "常见变量可在参数编辑器中查看；其他卡片或选项请使用原始关键字编辑器。"
    },

    parameter: {
      ruleTitle: "编辑规则",
      rule: "本页面只修改已识别字段，并保留其他卡片内容。编辑后的数据记录会被写回为 LS-DYNA 可接受的逗号分隔自由格式。导出新文件后，必须在 LS-PrePost／LS-DYNA 中复核。",
      identity: "文件标识",
      identityNote: "此处仅编辑标题。单位制通常记录在注释中，必要时应在原始关键字编辑器内修改。",
      title: "模型标题",
      titleHelp: "修改 *TITLE 下第一行数据。",
      runtime: "计算时间与数据库输出",
      runtimeNote: "控制分析终止时间及结果输出间隔。",
      endTime: "终止时间",
      noEndTime: "未找到 *CONTROL_TERMINATION 卡。",
      shellSections: "壳截面",
      noShell: "未解析到 *SECTION_SHELL 卡。",
      thickness: "t{index}",
      thicknessHelp: "使用 deck 当前采用的长度单位。",
      shellNote: "壳厚度在单元四个角点定义；四个数值相等时为均匀厚度。",
      materials: "材料",
      noMaterial: "未解析到已支持的材料类型。",
      motion: "初始运动",
      noMotion: "未解析到已支持的初始速度卡。",
      contacts: "接触参数",
      noContact: "未解析到接触卡。",
      boundary: "边界约束",
      noBoundary: "未解析到 *BOUNDARY_SPC_SET 卡。",
      rawOnly: "该材料类型请使用原始关键字编辑器。",
      rawNote: "部件名称、特殊材料、曲线、损伤、接触选项或未显示的任何卡片，请在原始关键字编辑器中处理。这样既能简化常用修改，也保留 LS-DYNA 的完整灵活性。",
      density: "密度 (RO)",
      modulus: "弹性模量 (E)",
      poisson: "泊松比 (PR)",
      yield: "屈服应力 (SIGY)",
      tangent: "切线模量 (ETAN)",
      failure: "失效应变 (FAIL)",
      failureHelp: "0 表示不启用单元侵蚀。",
      delay: "时间延迟 (TDEL)",
      constraintMode: "CMO",
      constraintHelp: "刚体约束模式。",
      staticFriction: "静摩擦系数 (FS)",
      dynamicFriction: "动摩擦系数 (FD)",
      ssid: "SSID",
      msid: "MSID",
      sstyp: "SSTYP",
      mstyp: "MSTYP",
      restraint: "{axis} 向约束",
      restraintHelp: "1 = 约束；0 = 自由。对应平动和转动自由度。",
      contactNote: "高级接触参数请使用原始关键字编辑器。"
    },

    raw: {
      intro: "可直接编辑当前关键字块。请保留以 <code>$</code> 开头的注释，并且不要在编辑器中插入另一个以 <code>*</code> 开头的关键字行。",
      guide: "原始关键字编辑器是通用入口，功能强但需谨慎：每次只能编辑一个包含一个关键字标题的块。",
      firstLine: "第一个非空行必须是以 * 开头的关键字标题。",
      oneBlock: "每次只能编辑一个关键字块。请不要在当前编辑器中加入另一个以 * 开头的关键字行。",
      restoreError: "无法在原始文件中找到此位置对应的关键字块。"
    },

    validation: {
      intro: "每次正式计算前：请导出副本，在 LS-PrePost 中重新打开，检查 Keyword Reader Messages，并核对求解器终止信息与能量平衡。本页基础检查不能替代 LS-DYNA 完整关键字读取器。",
      checks: "文件检查",
      noChecks: "未生成检查结果。",
      recognised: "已识别关键字说明",
      noRecognised: "未识别到带说明的关键字。",
      export: "导出",
      exportText: "导出会生成后缀为 <code>_edited.k</code> 的新文件；最初加载的文件不会被修改。",
      exportBlocked: "无法安全导出：未找到 *END 卡。请补充 *END 后再导出。",
      summaryTitle: "LS-DYNA Deck 编辑摘要",
      diagnostics: "检查结果"
    },

    diagnostics: {
      noKeyword: ["error", "未找到 *KEYWORD 标题", "LS-DYNA 输入文件通常以 *KEYWORD 开始。"],
      noEnd: ["error", "未找到 *END 卡", "请在 deck 末尾补充 *END 后再导出。"],
      noUnits: ["warning", "未找到单位制注释", "LS-DYNA 不会强制单位制。建议加入类似 '$ Units: kg, mm, ms, kN' 的注释。"],
      units: ["good", "已找到单位制注释：{units}", "工具按原样显示数值；正确解释仍取决于单位制是否自洽。"],
      noTermination: ["warning", "未找到 *CONTROL_TERMINATION 卡", "未能解析预定分析终止时间。"],
      termination: ["good", "终止时间：{value}", "请确认其与初始间隙和碰撞持续时间相匹配。"],
      noContact: ["warning", "未找到接触卡", "碰撞模型通常需要接触定义或刚性墙定义。"],
      noMotion: ["warning", "未解析到初始运动或规定运动", "模型可能是静力模型、在其他位置施加驱动荷载，或使用了未支持的卡片。"],
      noD3plot: ["warning", "未找到 d3plot 输出请求", "可能无法获得变形动画。"],
      include: ["warning", "检测到 *INCLUDE 卡", "本工具不会解析被包含文件。请在 LS-PrePost／LS-DYNA 中手动检查 include 路径和关联 deck。"],
      parameter: ["warning", "检测到 *PARAMETER 卡", "本工具不会执行参数替换。引导界面中的数值可能不代表求解器展开后的 deck。"],
      missingMaterial: ["error", "部件 {part} 引用了缺失材料 {material}", "{title} 无法被完整解释。"],
      missingSection: ["error", "部件 {part} 引用了缺失截面 {section}", "{title} 无法被完整解释。"],
      missingPart: ["error", "{count} 个单元引用了不存在的部件 {part}", "请检查单元中的 part ID 与 *PART 卡。"],
      blankRecords: ["warning", "{keyword} 含有空白物理行", "可变长度块中的空白记录可能被误读。请在第 {line} 行附近的原始关键字块中检查。"]
    },

    material: {
      rigid: "刚体",
      elastic: "线弹性",
      plastic: "分段线性塑性 (MAT_024)"
    },

    misc: {
      untitled: "（未命名部件）",
      missing: "缺失 {value}",
      target: "目标 {value}",
      part: "部件 {value}",
      rigidTarget: "部件 {value}",
      noValue: "—",
      line: "第 {line} 行",
      elementCount: "{solid} 实体 · {shell} 壳 · {beam} 梁",
      shell: "壳",
      solid: "实体",
      warning: "警告",
      error: "错误",
      good: "正常"
    }
  }
};
