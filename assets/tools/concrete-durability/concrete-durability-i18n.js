(() => {
  const isEnglish =
    document.documentElement.lang
      .toLowerCase()
      .startsWith('en');

  if (!isEnglish) {
    return;
  }

  function setText(selector, text) {
    const el = document.querySelector(selector);

    if (el) {
      el.textContent = text;
    }
  }

  function setHTML(selector, html) {
    const el = document.querySelector(selector);

    if (el) {
      el.innerHTML = html;
    }
  }

  function setLabel(id, html) {
    const el = document.getElementById(id);

    const label =
      el
        ?.closest('.field')
        ?.querySelector('label');

    if (label) {
      label.innerHTML = html;
    }
  }

  function setCheckText(id, html) {
    const el = document.getElementById(id);

    const span =
      el
        ?.closest('.check-wrap')
        ?.querySelector('span');

    if (span) {
      span.innerHTML = html;
    }
  }

  function setOptionText(id, translations) {
    const select =
      document.getElementById(id);

    if (!select) {
      return;
    }

    [...select.options].forEach(option => {
      if (translations[option.value]) {
        option.textContent =
          translations[option.value];
      }
    });
  }

  /* ---------------- Navigation ---------------- */

  const brand =
    document.getElementById('toolBrand');

  if (brand) {
    brand.href = '/';
  }

  const nav = {
    toolNavHome: ['Home', '/'],
    toolNavMap: ['Map', '/map/'],
    toolNavTools: ['Tools', '/tools/'],
    toolNavReports: ['Reports', '/reports/'],
    toolNavMethodology: [
      'Methodology',
      '/methodology/'
    ],
    toolNavPolicy: [
      'Data policy',
      '/policy/'
    ],
    toolNavAbout: [
      'About',
      '/about/'
    ],
    toolNavTeam: [
      'Team',
      '/api/team/map'
    ]
  };

  Object.entries(nav).forEach(
    ([id, [text, href]]) => {
      const link =
        document.getElementById(id);

      if (!link) {
        return;
      }

      link.textContent = text;
      link.href = href;
    }
  );

  const langSwitch =
    document.getElementById(
      'toolLangSwitch'
    );

  if (langSwitch) {
    langSwitch.textContent = '中文';

    langSwitch.href =
      '/zh/tools/concrete-durability/';
  }

  /* ---------------- Hero ---------------- */

  setText(
    '.durability-kicker',
    'Engineering tool'
  );

  setText(
    '.durability-hero h1',
    'Durability Assessment of Existing Concrete Structures'
  );

  setText(
    '.durability-hero p',
    'Assess the durability of existing concrete structures under general, chloride, and freeze–thaw environments in accordance with GB/T 51355-2019. Continuous tabulated parameters are evaluated using linear interpolation, with all calculations performed locally in the browser.'
  );

  setText(
    '.durability-standard-badge',
    'GB/T 51355-2019 · Chapters 5–7 · Appendices B and D'
  );

  /* ---------------- Tabs ---------------- */

  const tabs = {
    basic: 'Basic information',
    general: 'General environment',
    chloride: 'Chloride environment',
    freeze: 'Freeze–thaw environment',
    result: 'Results'
  };

  document
    .querySelectorAll('.tab-btn')
    .forEach(button => {
      const text =
        tabs[button.dataset.tab];

      if (text) {
        button.textContent = text;
      }
    });

  /* ---------------- Panel headings ---------------- */

  setText(
    '#tab-basic h2',
    'Basic Information and Common Parameters'
  );

  setText(
    '#tab-general h2',
    'General Environment Parameters'
  );

  setText(
    '#tab-chloride h2',
    'Chloride Environment Parameters'
  );

  setText(
    '#tab-freeze h2',
    'Freeze–Thaw Environment Parameters'
  );

  setText(
    '#tab-result h2',
    'Assessment Results'
  );

  /* ---------------- Basic labels ---------------- */

  setLabel(
    'projectName',
    'Project name'
  );

  setLabel(
    'memberName',
    'Member name'
  );

  setLabel(
    'builtYear',
    'Year of construction'
  );

  setLabel(
    'detectYear',
    'Year of inspection'
  );

  setLabel(
    'targetLife',
    'Total service life T<sub>total</sub> (a)'
  );

  setLabel(
    'remainingLifeDisplay',
    'Remaining target service life t<sub>e</sub> (a) (automatic)'
  );

  setLabel(
    'gamma0',
    'Durability importance factor γ<sub>0</sub>'
  );

  setLabel(
    'region',
    'Region'
  );

  setLabel(
    'cover',
    'Concrete cover c (mm)'
  );

  setLabel(
    'fcu',
    'Estimated concrete compressive strength f<sub>cu,e</sub> (MPa)'
  );

  setLabel(
    'diameter',
    'Reinforcement diameter d (mm)'
  );

  setLabel(
    'temperature',
    'Environmental temperature T (°C)'
  );

  setLabel(
    'humidity',
    'Relative humidity RH (%)'
  );

  /* ---------------- General labels ---------------- */

  setLabel(
    'xc',
    'Measured carbonation depth x<sub>c</sub> (mm)'
  );

  setLabel(
    'carbonNeedCornerCorrection',
    'Carbonation measurement is not at a corner and requires a 1.4× corner correction'
  );

  setCheckText(
    'carbonNeedCornerCorrection',
    'Yes, use x<sub>c</sub> × 1.4'
  );

  setLabel(
    'generalMemberEnv',
    'Member exposure classification'
  );

  setLabel(
    'general_m',
    'Local environmental factor m'
  );

  setLabel(
    'k_manual',
    'Direct input of carbonation coefficient k (mm/√a)'
  );

  setLabel(
    'useAppendixB',
    'Use Appendix B when measured k is unavailable'
  );

  setCheckText(
    'useAppendixB',
    'Use Appendix B'
  );

  setLabel(
    'CO2_percent',
    'Carbon dioxide concentration C<sub>CO2</sub> (%)'
  );

  setLabel(
    'KCO2_manual',
    'Direct input K<sub>CO2</sub> (takes priority when > 0)'
  );

  setLabel(
    'KCO2_autoType',
    'If K<sub>CO2</sub> is not entered, use the midpoint from Table B.0.3'
  );

  setLabel(
    'isCornerZone',
    'Reinforcement located at a corner'
  );

  setCheckText(
    'isCornerZone',
    'Yes'
  );

  setLabel(
    'isCastingFace',
    'Casting face'
  );

  setCheckText(
    'isCastingFace',
    'Yes'
  );

  setLabel(
    'stressState',
    'Stress state'
  );

  setLabel(
    'flyAshPercent',
    'Fly ash content (%)'
  );

  setLabel(
    'appendixB_envMultiplier',
    'Appendix B environmental multiplier (acid rain / freeze–thaw correction)'
  );

  /* ---------------- Chloride labels ---------------- */

  setLabel(
    'Cs_meas',
    'Measured surface chloride concentration C<sub>se</sub> or C<sub>s</sub> (kg/m³)'
  );

  setLabel(
    'Cx_meas',
    'Measured chloride concentration at depth C(x,t<sub>0</sub>) (kg/m³)'
  );

  setLabel(
    'x_depth',
    'Chloride diffusion depth x (mm)'
  );

  setLabel(
    'C0',
    'Initial chloride concentration C<sub>0</sub> (kg/m³)'
  );

  setLabel(
    'ch_grade',
    'Environmental exposure class'
  );

  setLabel(
    'ch_zoneType',
    'Exposure environment'
  );

  setLabel(
    'ch_memberType',
    'Member type'
  );

  setLabel(
    'ch_isCornerBar',
    'Corner reinforcement'
  );

  setCheckText(
    'ch_isCornerBar',
    'Yes (β₂ = 1.2)'
  );

  setLabel(
    'ch_D_manual',
    'Direct input D (m²/a)'
  );

  setLabel(
    'ch_ignoreTimeDependence',
    'Ignore time dependence (D = D₀)'
  );

  setCheckText(
    'ch_ignoreTimeDependence',
    'Yes'
  );

  setLabel(
    'ch_D0_fromMeasured',
    'Back-calculate D₀ from measured chloride profile'
  );

  setCheckText(
    'ch_D0_fromMeasured',
    'Enable'
  );

  setLabel(
    'ch_D0_fromWC',
    'Calculate D₀ using empirical equation'
  );

  setCheckText(
    'ch_D0_fromWC',
    'Enable'
  );

  setLabel(
    'ch_wb',
    'Water-to-binder ratio w/c'
  );

  setLabel(
    'ch_Fb',
    'Fly ash proportion of binder F<sub>b</sub> (%)'
  );

  setLabel(
    'ch_Sb',
    'Slag proportion of binder S<sub>b</sub> (%)'
  );

  setLabel(
    'ch_freezeAmp',
    'Freeze–thaw amplification factor'
  );

  setLabel(
    'ch_t1_manual',
    'Direct input t₁ (0 = automatic)'
  );

  setLabel(
    'ch_Cs_manual',
    'Direct input C<sub>s</sub> (0 = automatic)'
  );

  setLabel(
    'ch_Ccr_manual',
    'Direct input C<sub>cr</sub> (0 = automatic)'
  );

  setLabel(
    'ch_beta1_env',
    'β₁ exposure environment'
  );

  /* ---------------- Freeze labels ---------------- */

  setLabel(
    'alphaFT',
    'Freeze–thaw surface scaling ratio α<sub>FT</sub> (%)'
  );

  setLabel(
    'dFT',
    'Average scaling depth d<sub>FT</sub> (mm)'
  );

  setLabel(
    'dFTmax',
    'Maximum scaling depth d<sub>FT,max</sub> (mm)'
  );

  setLabel(
    'freeze_memberClass',
    'Freeze–thaw member class'
  );

  setLabel(
    'freeze_corrosionRoute',
    'Reinforcement corrosion assessment route'
  );

  setLabel(
    'freeze_m_general',
    'Local environmental factor m for general freeze–thaw exposure'
  );

  setLabel(
    'freeze_k_mult',
    'Freeze–thaw multiplier for carbonation coefficient'
  );

  /* ---------------- Select options ---------------- */

  setOptionText(
    'region',
    {
      '南方': 'Southern region',
      '北方': 'Northern region'
    }
  );

  setOptionText(
    'generalMemberEnv',
    {
      '室外-梁柱': 'Outdoor — beam / column',
      '室外-墙板': 'Outdoor — wall / slab',
      '室内-梁柱': 'Indoor — beam / column',
      '室内-墙板': 'Indoor — wall / slab'
    }
  );

  setOptionText(
    'KCO2_autoType',
    {
      '工业建筑室外-城镇':
        'Industrial building, outdoor — town',

      '工业建筑室外-大中城市市区':
        'Industrial building, outdoor — urban area of medium/large city',

      '民用建筑室内-人群稀少':
        'Civil building, indoor — low occupancy',

      '民用建筑室内-一般':
        'Civil building, indoor — normal occupancy',

      '民用建筑室内-较密集':
        'Civil building, indoor — relatively high occupancy',

      '民用建筑室内-密集':
        'Civil building, indoor — high occupancy'
    }
  );

  setOptionText(
    'stressState',
    {
      '受压': 'Compression',
      '受拉': 'Tension'
    }
  );

  setOptionText(
    'ch_zoneType',
    {
      '近海大气环境':
        'Coastal atmospheric environment',

      '海洋环境':
        'Marine environment',

      '除冰盐环境':
        'Deicing-salt environment'
    }
  );

  setOptionText(
    'ch_memberType',
    {
      '梁柱': 'Beam / column',
      '墙板': 'Wall / slab'
    }
  );

  setOptionText(
    'ch_beta1_env',
    {
      '近海大气环境':
        'Coastal atmospheric environment',

      '海洋环境、除冰盐环境':
        'Marine / deicing-salt environment'
    }
  );

  setOptionText(
    'freeze_memberClass',
    {
      '一般构件': 'General member',
      '薄壁构件': 'Thin-walled member'
    }
  );

  setOptionText(
    'freeze_corrosionRoute',
    {
      '一般冻融环境':
        'General freeze–thaw environment',

      '寒冷地区海洋环境':
        'Cold-region marine environment',

      '除冰盐环境':
        'Deicing-salt environment'
    }
  );

  /* ---------------- Hints ---------------- */

  setHTML(
    '#tab-basic .hint',
    '<strong>Note:</strong> This page contains common parameters only. The total service life T<sub>total</sub> is entered by the user. The remaining target service life t<sub>e</sub> is calculated automatically as t<sub>e</sub> = T<sub>total</sub> − (inspection year − construction year). Parameters specific to general, chloride, and freeze–thaw environments are entered in their respective tabs.'
  );

  setHTML(
    '#tab-general .hint',
    '<strong>Assessment:</strong> reinforcement corrosion initiation, corrosion-induced cover cracking, and crack-width limit state. The carbonation coefficient k is obtained in the following order: direct input, back-calculation from measured carbonation depth, or Appendix B.'
  );

  setHTML(
    '#tab-chloride .hint',
    '<strong>Assessment:</strong> reinforcement corrosion initiation and corrosion-induced cover cracking. If measured D, C<sub>s</sub>, and C<sub>cr</sub> are available, direct input is recommended.'
  );

  setHTML(
    '#tab-freeze .hint',
    '<strong>Assessment:</strong> surface scaling is graded according to Table 7.2.1. Reinforcement corrosion is assessed through either Chapter 5 or Chapter 6 according to the selected route.'
  );

  /* ---------------- Buttons ---------------- */

  setText(
    '#saveBtn',
    'Save current inputs'
  );

  setText(
    '#calcBtn',
    'Run assessment'
  );

  setText(
    '#exportBtn',
    'Export TXT'
  );

  setText(
    '#resetBtn',
    'Restore defaults'
  );

  setText(
    '#resultBox',
    'Select “Run assessment” to generate results.'
  );

  setText(
    '#toolFooterText',
    'Corrosion Atlas · Existing concrete structure durability assessment tool'
  );

  /* ---------------- English defaults ---------------- */

  function applyEnglishDefaults() {
    const project =
      document.getElementById(
        'projectName'
      );

    const member =
      document.getElementById(
        'memberName'
      );

    if (
      project &&
      project.value === '测试工程'
    ) {
      project.value = 'Test project';
    }

    if (
      member &&
      member.value === '一般构件'
    ) {
      member.value = 'General member';
    }
  }

  applyEnglishDefaults();

  /* ---------------- Result translation ---------------- */

  const replacements = [
    [
      '========== GB/T 51355-2019 耐久性评定结果 ==========',
      '========== GB/T 51355-2019 Durability Assessment Results =========='
    ],
    [
      '计算完成。综合评定等级（按最不利模块）',
      'Assessment completed. Overall grade (governed by the most unfavorable module)'
    ],
    [
      '综合评定等级（按最不利模块）',
      'Overall grade (governed by the most unfavorable module)'
    ],
    [
      '基本信息',
      'Basic information'
    ],
    [
      '一般环境（第5章）',
      'General environment (Chapter 5)'
    ],
    [
      '氯盐环境（第6章）',
      'Chloride environment (Chapter 6)'
    ],
    [
      '冻融环境（第7章）',
      'Freeze–thaw environment (Chapter 7)'
    ],
    [
      '工程名称',
      'Project name'
    ],
    [
      '构件名称',
      'Member name'
    ],
    [
      '建成至检测时间',
      'Service age at inspection'
    ],
    [
      '整体使用年限',
      'Total service life'
    ],
    [
      '剩余目标使用年限',
      'Remaining target service life'
    ],
    [
      '参与评定模块',
      'Assessment modules'
    ],
    [
      '钢筋开始锈蚀',
      'Reinforcement corrosion initiation'
    ],
    [
      '保护层锈胀开裂',
      'Corrosion-induced cover cracking'
    ],
    [
      '裂缝宽度限值',
      'Crack-width limit state'
    ],
    [
      '模块最不利等级',
      'Governing module grade'
    ],
    [
      '表面剥落等级',
      'Surface scaling grade'
    ],
    [
      '钢筋锈蚀相关等级',
      'Reinforcement corrosion grade'
    ],
    [
      '中间系数',
      'Intermediate coefficients'
    ],
    [
      '锈胀开裂系数',
      'Cover-cracking coefficients'
    ],
    [
      '裂缝宽度系数',
      'Crack-width coefficients'
    ],
    [
      'tc0原始',
      'original tc0'
    ],
    [
      '近海修正',
      'coastal correction'
    ],
    [
      '等级',
      'Grade'
    ],
    [
      '一般环境',
      'General environment'
    ],
    [
      '氯盐环境',
      'Chloride environment'
    ],
    [
      '冻融环境',
      'Freeze–thaw environment'
    ],
    [
      '直接输入 k',
      'direct input k'
    ],
    [
      '按 5.2.3 实测反算 k',
      'k back-calculated from measurements according to 5.2.3'
    ],
    [
      '按附录B计算 k',
      'k calculated according to Appendix B'
    ],
    [
      '一般构件：',
      'General member: '
    ],
    [
      '薄壁构件：',
      'Thin-walled member: '
    ],
    [
      '按 7.3.1 调用第5章（一般环境）进行钢筋开始锈蚀与保护层开裂评定。',
      'Chapter 5 (general environment) is applied according to 7.3.1 for reinforcement corrosion initiation and cover-cracking assessment.'
    ],
    [
      '按 7.3.2/7.3.3 调用第6章（氯盐环境）进行钢筋开始锈蚀与保护层开裂评定。',
      'Chapter 6 (chloride environment) is applied according to 7.3.2/7.3.3 for reinforcement corrosion initiation and cover-cracking assessment.'
    ],
    [
      '说明',
      'Notes'
    ],
    [
      '1) 构件耐久性等级按最不利极限状态确定。',
      '1) The durability grade of the member is governed by the most unfavorable limit state.'
    ],
    [
      '2) 局部环境系数 m、冻融放大系数等需结合现场调查合理取值。',
      '2) Local environmental factors and freeze–thaw amplification factors should be selected with reference to site investigation.'
    ],
    [
      '3) 本网页为单机版计算工具，可直接保存并在浏览器中打开。',
      '3) Calculations are performed locally in the browser.'
    ]
  ];

  const errorReplacements = [
    [
      '工程名称不能为空。',
      'Project name cannot be empty.'
    ],
    [
      '建成年份/检测年份填写不合理。',
      'The construction year or inspection year is invalid.'
    ],
    [
      '整体使用年限必须大于0。',
      'Total service life must be greater than zero.'
    ],
    [
      '剩余目标使用年限 te = 整体使用年限 - 建成至检测时间，计算结果必须大于0。请检查整体使用年限、建成年份和检测年份。',
      'The remaining target service life te must be greater than zero. Check the total service life, construction year, and inspection year.'
    ],
    [
      '保护层厚度、混凝土强度、钢筋直径必须大于0。',
      'Concrete cover, concrete strength, and reinforcement diameter must be greater than zero.'
    ],
    [
      '未检测到可参与计算的模块参数。请至少在“一般环境”“氯盐环境”或“冻融环境”页填写一组有效参数。',
      'No valid assessment module was detected. Enter valid parameters for at least one of the general, chloride, or freeze–thaw modules.'
    ],
    [
      '一般环境模块：缺少碳化系数 k。请直接输入 k，或输入实测碳化深度，或勾选附录B。',
      'General environment module: carbonation coefficient k is unavailable. Enter k directly, provide measured carbonation depth, or enable Appendix B.'
    ],
    [
      '附录B计算 k 时，(58/f_cu,e - 0.76) <= 0，请检查强度取值。',
      'Appendix B calculation of k produced (58/f_cu,e - 0.76) <= 0. Check the concrete strength.'
    ],
    [
      '氯盐环境模块：C_s 或 C_cr 无法确定。',
      'Chloride environment module: C_s or C_cr could not be determined.'
    ],
    [
      '要按实测反推 D0，请填写 x、C(x,t0)、C_s。',
      'To back-calculate D0 from measurements, enter x, C(x,t0), and C_s.'
    ],
    [
      '实测数据导致 erf^{-1}(1-C/Cs) 接近0，无法反推 D0。',
      'The measured data produce erf⁻¹(1-C/Cs) close to zero, so D0 cannot be back-calculated.'
    ],
    [
      '按经验式计算 D0 <= 0，请检查水胶比/温度。',
      'The empirical equation produced D0 <= 0. Check the water-to-binder ratio and temperature.'
    ],
    [
      '氯盐环境模块：请直接输入 D，或勾选“由实测反推 D0”，或勾选“由经验式计算 D0”。',
      'Chloride environment module: enter D directly, enable back-calculation of D0 from measurements, or enable the empirical D0 calculation.'
    ],
    [
      '未知环境等级。',
      'Unknown environmental exposure class.'
    ],
    [
      '插值表至少需要两个点。',
      'The interpolation table requires at least two points.'
    ]
  ];

  function translateString(input) {
    let output =
      String(input);

    [
      ...errorReplacements,
      ...replacements
    ].forEach(([zh, en]) => {
      output =
        output.split(zh).join(en);
    });

    return output;
  }

  const originalRenderResult =
    window.renderResult;

  if (
    typeof originalRenderResult ===
    'function'
  ) {
    window.renderResult =
      function translatedRenderResult(result) {
        return translateString(
          originalRenderResult(result)
        );
      };
  }

  const originalFormatResultText =
    window.formatResultText;

  if (
    typeof originalFormatResultText ===
    'function'
  ) {
    window.formatResultText =
      function translatedFormatResultText(result) {
        return translateString(
          originalFormatResultText(result)
        );
      };
  }

  const originalSetStatus =
    window.setStatus;

  if (
    typeof originalSetStatus ===
    'function'
  ) {
    window.setStatus =
      function translatedSetStatus(html) {
        originalSetStatus(
          translateString(html)
        );
      };
  }

  function translateCurrentResult() {
    const resultBox =
      document.getElementById(
        'resultBox'
      );

    const status =
      document.getElementById(
        'status'
      );

    if (resultBox) {
      resultBox.innerHTML =
        translateString(
          resultBox.innerHTML
        );
    }

    if (status) {
      status.innerHTML =
        translateString(
          status.innerHTML
        );
    }
  }

  document
    .getElementById('calcBtn')
    ?.addEventListener(
      'click',
      translateCurrentResult
    );

  document
    .getElementById('saveBtn')
    ?.addEventListener(
      'click',
      translateCurrentResult
    );

  document
    .getElementById('resetBtn')
    ?.addEventListener(
      'click',
      () => {
        applyEnglishDefaults();

        const resultBox =
          document.getElementById(
            'resultBox'
          );

        if (resultBox) {
          resultBox.textContent =
            'Default values restored.';
        }
      }
    );
})();