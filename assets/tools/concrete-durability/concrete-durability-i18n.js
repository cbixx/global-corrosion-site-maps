(() => {
  const isZh =
    location.pathname.startsWith('/zh/');

  const nav = {
    en: [
      ['durabilityNavHome', 'Home', '/'],
      ['durabilityNavMap', 'Map', '/map/'],
      ['durabilityNavTools', 'Tools', '/tools/'],
      ['durabilityNavReports', 'Reports', '/reports/'],
      [
        'durabilityNavMethodology',
        'Methodology',
        '/methodology/'
      ],
      [
        'durabilityNavPolicy',
        'Data policy',
        '/policy/'
      ],
      ['durabilityNavAbout', 'About', '/about/'],
      ['durabilityNavTeam', 'Team', '/api/team/map']
    ],

    zh: [
      ['durabilityNavHome', '首页', '/zh/'],
      ['durabilityNavMap', '地图', '/zh/map/'],
      ['durabilityNavTools', '工具', '/zh/tools/'],
      ['durabilityNavReports', '报告', '/zh/reports/'],
      [
        'durabilityNavMethodology',
        '方法学',
        '/zh/methodology/'
      ],
      [
        'durabilityNavPolicy',
        '数据政策',
        '/zh/policy/'
      ],
      ['durabilityNavAbout', '关于', '/zh/about/'],
      ['durabilityNavTeam', '团队', '/api/team/map']
    ]
  };

  (isZh ? nav.zh : nav.en).forEach(
    ([id, text, href]) => {
      const link = document.getElementById(id);

      if (!link) return;

      link.textContent = text;
      link.href = href;
    }
  );

  const languageSwitch =
    document.getElementById(
      'durabilityLanguageSwitch'
    );

  if (languageSwitch) {
    languageSwitch.textContent =
      isZh ? 'English' : '中文';

    languageSwitch.href =
      isZh
        ? '/tools/concrete-durability/'
        : '/zh/tools/concrete-durability/';
  }

  const footerText =
    document.getElementById(
      'durabilityFooterText'
    );

  if (footerText) {
    footerText.textContent =
      isZh
        ? 'Corrosion Atlas · 混凝土结构耐久性评定工具'
        : 'Corrosion Atlas · Concrete durability assessment tool';
  }

  if (isZh) return;

  document.documentElement.lang = 'en';

  document.title =
    'Concrete Durability Assessment | Corrosion Atlas';

  const title =
    document.querySelector(
      '.durability-tool-page > .container > h1'
    );

  const subtitle =
    document.querySelector(
      '.durability-tool-page > .container > h1 + p'
    );

  if (title) {
    title.textContent =
      'Concrete Structure Durability Assessment';
  }

  if (subtitle) {
    subtitle.textContent =
      'Based on GB/T 51355-2019';
  }

  const panelTitles = [
    'General environment',
    'Chloride exposure',
    'Freeze–thaw environment'
  ];

  document
    .querySelectorAll(
      '.three-columns > .panel > h2'
    )
    .forEach((element, index) => {
      if (panelTitles[index]) {
        element.textContent =
          panelTitles[index];
      }
    });

  const sectionTitles = [
    'Carbonation coefficient',
    'Member parameters'
  ];

  document
    .querySelectorAll(
      '.three-columns > .panel:first-child .section-title'
    )
    .forEach((element, index) => {
      if (sectionTitles[index]) {
        element.textContent =
          sectionTitles[index];
      }
    });

  const labels = {
    envLevel:
      'Environmental exposure class:',

    kValue:
      'Carbonation coefficient k (mm/√year):',

    carbonDepth:
      'Measured carbonation depth (mm):',

    usedYears:
      'Age at inspection (years):',

    coverStart:
      'Concrete cover depth c (mm):',

    memberType:
      'Member type:',

    fcuCr:
      'Compressive strength fcu,e (MPa):',

    diaCr:
      'Reinforcement diameter (mm):',

    tempCr:
      'Ambient temperature (°C):',

    rhCr:
      'Relative humidity (%):',

    cCl:
      'Concrete cover c (mm):',

    DCl:
      'Chloride diffusion coefficient D (m²/year):',

    Ccr:
      'Critical concentration Ccr (kg/m³):',

    CsInp:
      'Surface concentration Cs (kg/m³):',

    envLvl2:
      'Exposure class:',

    Cse:
      'Measured surface concentration Cse (kg/m³):',

    C0:
      'Initial chloride content C0 (kg/m³):',

    fcuCl:
      'Compressive strength fcu (MPa):',

    region:
      'Region:',

    t0Cl:
      'Age at inspection t0 (years):',

    clEnvType:
      'Chloride exposure type:',

    clMember:
      'Member type:',

    clCorner:
      'Reinforcement location:',

    ftMember:
      'Member type:',

    ftType:
      'Freeze–thaw exposure type:',

    alphaFT:
      'Surface scaling ratio αFT (%):',

    dFTAvg:
      'Average scaling depth dFT (mm):',

    dFTMax:
      'Maximum scaling depth dFT,max (mm):',

    cFT:
      'Concrete cover c (mm):'
  };

  Object
    .entries(labels)
    .forEach(([id, text]) => {
      const input =
        document.getElementById(id);

      const label =
        input
          ?.closest('.form-group')
          ?.querySelector('label');

      if (label) {
        label.textContent = text;
      }
    });

  const placeholders = {
    kValue:
      'Enter directly',

    carbonDepth:
      'Used to calculate k',

    usedYears:
      'Used to calculate k',

    CsInp:
      'Enter directly',

    Cse:
      'Used preferentially'
  };

  Object
    .entries(placeholders)
    .forEach(([id, text]) => {
      const element =
        document.getElementById(id);

      if (element) {
        element.placeholder = text;
      }
    });

  function setOptions(id, texts) {
    const select =
      document.getElementById(id);

    if (!select) return;

    [...select.options].forEach(
      (option, index) => {
        if (texts[index] !== undefined) {
          option.textContent =
            texts[index];
        }
      }
    );
  }

  setOptions(
    'memberType',
    [
      'Outdoor beam / column',
      'Outdoor wall / slab',
      'Indoor beam / column',
      'Indoor wall / slab'
    ]
  );

  setOptions(
    'envLvl2',
    [
      'Coastal atmosphere: 0.5–1.0 km',
      'Coastal atmosphere: 0.25–0.5 km',
      'Coastal atmosphere: 0.1–0.25 km',
      'Coastal atmosphere: d < 0.1 km',
      'Marine environment: atmospheric salt-spray zone',
      'Marine environment: tidal / splash zone'
    ]
  );

  setOptions(
    'region',
    [
      'Southern region',
      'Northern region'
    ]
  );

  setOptions(
    'clEnvType',
    [
      'Coastal atmospheric environment',
      'Marine environment (including splash zone)',
      'Deicing-salt environment'
    ]
  );

  setOptions(
    'clMember',
    [
      'Beam / column',
      'Wall / slab'
    ]
  );

  setOptions(
    'clCorner',
    [
      'Non-corner',
      'Corner'
    ]
  );

  setOptions(
    'ftMember',
    [
      'General member',
      'Thin-walled member'
    ]
  );

  setOptions(
    'ftType',
    [
      'General freeze–thaw environment',
      'Cold-region marine environment',
      'Deicing-salt environment'
    ]
  );

  const note =
    document.querySelector(
      '.three-columns > .panel:nth-child(3) .note'
    );

  if (note) {
    note.innerHTML =
      '<strong>Reinforcement-corrosion assessment under freeze–thaw exposure</strong><br>' +
      'General freeze–thaw environment → use the general-environment carbonation assessment<br>' +
      'Cold-region marine / deicing-salt environment → use the chloride-exposure assessment<br>' +
      'Surface-scaling grade is determined from the three parameters above';
  }

  const button =
    document.getElementById(
      'calculateBtn'
    );

  if (button) {
    button.textContent =
      'Run assessment';
  }

  const resultHeading =
    document.querySelector(
      '.result-area > h3'
    );

  if (resultHeading) {
    resultHeading.textContent =
      'Assessment results';
  }

  function translateResult() {
    const result =
      document.getElementById(
        'resultText'
      );

    if (!result) return;

    const replacements = [
      [
        '一般环境耐久性评定结果',
        'General Environment Durability Assessment'
      ],
      [
        '氯盐侵蚀耐久性评定结果',
        'Chloride Exposure Durability Assessment'
      ],
      [
        '冻融环境耐久性评定结果',
        'Freeze–Thaw Durability Assessment'
      ],
      [
        '钢筋开始锈蚀极限状态',
        'Reinforcement Corrosion Initiation Limit State'
      ],
      [
        '保护层锈胀开裂极限状态',
        'Cover Cracking due to Reinforcement Corrosion Limit State'
      ],
      [
        '锈胀裂缝宽度限值极限状态',
        'Corrosion-Induced Crack Width Limit State'
      ],
      [
        '掺入型氯盐侵蚀（C0 >= Ccr）',
        'Cast-in Chloride Exposure (C0 >= Ccr)'
      ],
      [
        '混凝土表面剥落耐久性',
        'Concrete Surface Scaling Durability'
      ],
      [
        '钢筋锈蚀耐久性',
        'Reinforcement Corrosion Durability'
      ],
      [
        '说明：C0已超过临界氯离子浓度，保护层锈胀开裂耐久性等级评定为c级。',
        'Note: C0 exceeds the critical chloride concentration; the cover-cracking durability grade is Grade c.'
      ],
      [
        '耐久性裕度系数',
        'Durability margin coefficient'
      ],
      [
        '剩余使用年限',
        'Remaining service life'
      ],
      [
        '目标使用年限',
        'Target service life'
      ],
      [
        '已使用年限',
        'Elapsed service life'
      ],
      [
        '建成至检测时间',
        'Age at inspection'
      ],
      [
        '裂缝发展阶段时间',
        'Crack-propagation duration'
      ],
      [
        '开裂阶段时间',
        'Cracking-stage duration'
      ],
      [
        '耐久年限',
        'Durability life'
      ],
      [
        '表面剥落耐久性等级',
        'Surface scaling durability grade'
      ],
      [
        '剥落率',
        'Scaling ratio'
      ],
      [
        '构件类型',
        'Member type'
      ],
      [
        '掺入型氯盐',
        'Cast-in chloride'
      ],
      [
        '保护层锈胀开裂',
        'Cover cracking'
      ],
      [
        '钢筋开始锈蚀',
        'Corrosion initiation'
      ],
      [
        'a级 (满足)',
        'Grade a (satisfied)'
      ],
      [
        'b级 (基本满足)',
        'Grade b (basically satisfied)'
      ],
      [
        'c级 (不满足)',
        'Grade c (not satisfied)'
      ],
      [
        '一般构件',
        'General member'
      ],
      [
        '薄壁构件',
        'Thin-walled member'
      ],
      [
        '等级:',
        'Grade:'
      ],
      [
        '计算错误:',
        'Calculation error:'
      ],
      [
        '请检查输入参数是否完整。',
        'Please check whether the input parameters are complete.'
      ]
    ];

    let text =
      result.innerText;

    replacements.forEach(
      ([from, to]) => {
        text =
          text.split(from).join(to);
      }
    );

    text =
      text.replace(
        /(\d+(?:\.\d+)?) 年/g,
        '$1 years'
      );

    result.innerText = text;
  }

  translateResult();

  button?.addEventListener(
    'click',
    () => {
      setTimeout(
        translateResult,
        0
      );
    }
  );

  window.addEventListener(
    'load',
    () => {
      setTimeout(
        translateResult,
        0
      );
    }
  );
})();