window.COLOR_REPAIR_I18N = {
  en: {
    page: {
      back: "← Back to research tools",
      kicker: "Research tool",
      title: "Color-Compatible Repair Calculator",
      intro:
        "This tool estimates pigment combinations for MPC-based repair mortar using target concrete L*, a*, and b* color values.",
      scopeTitle: "Model scope:",
      scope:
        "This calculator is based on a fixed 28 d MPC mortar baseline and an empirical linear color-response model. Results are intended for preliminary formulation guidance and should be verified experimentally before practical use.",
      inputTitle: "Input data",
      inputIntro: "Enter the target concrete surface color values.",
      resultTitle: "Calculation results",
      resultIntro: "Recommended solutions are ranked by the minimum color difference.",
    },

    pills: {
      baseline: "MPC baseline color:",
      constraint: "Constraint:",
      colorDifference: "Color difference:",
    },

    inputs: {
      L: "Lightness channel.",
      a: "Red–green channel.",
      b: "Yellow–blue channel.",
      LPlaceholder: "e.g. 45.00",
      aPlaceholder: "e.g. 2.50",
      bPlaceholder: "e.g. 10.00",
    },

    buttons: {
      calculate: "Calculate recommendation",
      reset: "Clear",
      copy: "Copy result",
    },

    status: {
      waiting: "Waiting for input",
      calculating: "Calculating…",
      completed: "Completed",
      noSolution: "No feasible solution",
    },

    messages: {
      initial: "Enter target concrete L*, a*, and b* values, then click “Calculate recommendation”.",
      missingLab: "Please enter valid numerical values for target concrete L*, a*, and b*.",
      noSolution:
        "No feasible solution was found under the constraints n ≤ 3 and 0 ≤ D < 12%.",
      noSolutionToast:
        "No feasible solution was found. Try adjusting the target color or model constraints.",
      completed: "Calculation completed. Recommended pigment dosage has been generated.",
      cleared: "Inputs cleared.",
      nothingToCopy: "No result to copy. Please calculate first.",
      copied: "Result copied to clipboard.",
    },

    result: {
      target: "Target concrete color",
      predicted: "Predicted repair color",
      pigmentCount: "Number of pigments used",
      deltaE: "Color difference ΔE*ab(76)",
      dosageTitle: "Recommended dosage, non-zero pigments only",
      pigmentHeader: "Pigment",
      dosageHeader: "Dosage (%)",
      none: "No feasible solution was found. The target color may be outside the model range or the constraints may need adjustment.",
      species: "pigment(s)",
      baseline: "MPC baseline color",
      targetLine: "Target concrete",
      recommendation: "Recommended solution",
      predictedLine: "Predicted repair color",
      dosageLine: "Dosage (%)",
      noneShort: "none",
    },

    pigments: {
      white: "Titanium white",
      black: "Iron oxide black",
      yellow: "Iron oxide yellow",
      blue: "Iron oxide blue",
      red: "Iron oxide red",
      green: "Iron oxide green",
    },
  },

  zh: {
    page: {
      back: "← 返回研究工具",
      kicker: "中文研究工具",
      title: "颜色相容性修补计算器",
      intro:
        "本工具基于目标混凝土的 L*、a*、b* 颜色值，计算 MPC 修补砂浆的推荐颜料组合与掺量。",
      scopeTitle: "模型适用范围：",
      scope:
        "本工具基于固定的 28 d MPC 砂浆基准色及经验线性调色模型。计算结果仅用于初步配方参考，实际工程或试验使用前应进行实验验证。",
      inputTitle: "输入数据",
      inputIntro: "请输入目标混凝土表面的 L*、a*、b* 值。",
      resultTitle: "计算结果",
      resultIntro: "推荐方案按最小色差排序。",
    },

    pills: {
      baseline: "MPC 基准色：",
      constraint: "约束：",
      colorDifference: "色差：",
    },

    inputs: {
      L: "亮度通道。",
      a: "红绿通道。",
      b: "黄蓝通道。",
      LPlaceholder: "例如 45.00",
      aPlaceholder: "例如 2.50",
      bPlaceholder: "例如 10.00",
    },

    buttons: {
      calculate: "计算推荐方案",
      reset: "清空",
      copy: "复制结果",
    },

    status: {
      waiting: "等待输入",
      calculating: "计算中…",
      completed: "已完成",
      noSolution: "无可行解",
    },

    messages: {
      initial: "请输入目标混凝土 L*、a*、b* 后点击“计算推荐方案”。",
      missingLab: "请完整输入目标混凝土的 L*、a*、b* 数值。",
      noSolution: "未找到满足约束 n ≤ 3、0 ≤ D < 12% 的可行解。",
      noSolutionToast: "未找到可行解。可尝试调整目标颜色或模型约束。",
      completed: "计算完成：已输出推荐掺量。",
      cleared: "已清空。",
      nothingToCopy: "暂无可复制的结果，请先计算。",
      copied: "已复制结果到剪贴板。",
    },

    result: {
      target: "目标混凝土颜色",
      predicted: "预测修补色",
      pigmentCount: "使用颜料种数",
      deltaE: "色差 ΔE*ab(76)",
      dosageTitle: "推荐掺量，仅列出非零项",
      pigmentHeader: "颜料",
      dosageHeader: "掺量（%）",
      none: "未找到可行解。目标颜色可能超出该模型可达范围，或需调整约束。",
      species: "种",
      baseline: "MPC 基准色",
      targetLine: "目标混凝土",
      recommendation: "推荐方案",
      predictedLine: "预测修补色",
      dosageLine: "掺量（%）",
      noneShort: "无",
    },

    pigments: {
      white: "钛白（Titanium white）",
      black: "氧化铁黑（Iron oxide black）",
      yellow: "氧化铁黄（Iron oxide yellow）",
      blue: "氧化铁蓝（Iron oxide blue）",
      red: "氧化铁红（Iron oxide red）",
      green: "氧化铁绿（Iron oxide green）",
    },
  },
};