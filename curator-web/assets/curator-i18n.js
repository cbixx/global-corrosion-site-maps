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

    /* =====================================================
       Sources
       ===================================================== */

    "Browse and search source records in the Corrosion Atlas database.":
      "浏览和搜索 Corrosion Atlas 数据库中的来源记录。",

    "+ New source":
      "+ 新建来源",

    "Search code, title, author, year, or type…":
      "搜索编号、标题、作者、年份或类型…",

    "Loading sources…":
      "正在加载来源…",

    "No sources match your search.":
      "没有符合搜索条件的来源。",

    "Unable to load sources from the database.":
      "无法从数据库加载来源。",

    "(Untitled source)":
      "（无标题来源）",

    "(Untitled Source)":
      "（无标题来源）",

    "No author information":
      "无作者信息",

    "← Sources":
      "← 来源",

    "Loading source…":
      "正在加载来源…",

    "Missing source ID.":
      "缺少来源 ID。",

    "Source code":
      "来源编号",

    "Source title":
      "来源标题",

    "Source kind":
      "来源类别",

    "Source type":
      "来源类型",

    "Authors / organization":
      "作者 / 机构",

    "Publication year":
      "出版年份",

    "Public URL":
      "公开 URL",

    "Display citation":
      "显示引用",

    "Suggested citation":
      "建议引用",

    "Public notes":
      "公开备注",

    "Programme":
      "项目 / 计划",

    "Source URL":
      "来源 URL",

    "Internal notes":
      "内部备注",

    "Private PDF":
      "私有 PDF",

    "Source document stored privately in Cloudflare R2.":
      "来源文档私有存储于 Cloudflare R2。",

    "No PDF attached":
      "未附加 PDF",

    "Upload a PDF for this Source.":
      "为该来源上传 PDF。",

    "Upload a private source document for this Source.":
      "为该来源上传私有文档。",

    "Stored in the private Corrosion Atlas R2 bucket.":
      "存储于 Corrosion Atlas 私有 R2 存储桶。",

    "Open PDF":
      "打开 PDF",

    "Upload PDF":
      "上传 PDF",

    "Replace PDF":
      "替换 PDF",

    "Remove PDF":
      "移除 PDF",

    "Linked sites":
      "关联站点",

    "Exposure sites associated with this source.":
      "与该来源关联的暴露站点。",

    "+ Add site":
      "+ 添加站点",

    "Loading linked sites…":
      "正在加载关联站点…",

    "No linked sites.":
      "暂无关联站点。",

    "Saving…":
      "正在保存…",

    "Source code must resolve to canonical sNNN format.":
      "来源编号必须符合标准 sNNN 格式。",

    "e.g. 21, S21, or s021":
      "例如：21、S21 或 s021",

    "Paper, report, dataset, or source title":
      "论文、报告、数据集或来源标题",

    "e.g. ISO, ASTM, ICP Materials, or author names":
      "例如：ISO、ASTM、ICP Materials 或作者姓名",

    "e.g. 2014":
      "例如：2014",

    "Publisher, DOI, dataset, or public landing page":
      "出版社、DOI、数据集或公开页面",

    "Leave blank to auto-generate from authors, year, and title.":
      "留空则根据作者、年份和标题自动生成。",

    "e.g. ICP/UNECE":
      "例如：ICP/UNECE",

    "Comma-separated, e.g. Carbon steel, Zinc":
      "以逗号分隔，例如：Carbon steel, Zinc",

    "Comma-separated, e.g. 1 year, 2 years":
      "以逗号分隔，例如：1 year, 2 years",

    "External source URL":
      "外部来源 URL",

    "Private PDF object key":
      "私有 PDF 对象键",

    "Internal Cloudflare R2 object key. Do not publish this value.":
      "Cloudflare R2 内部对象键，请勿公开该值。",

    "Canonical format is sNNN, for example s021.":
      "标准格式为 sNNN，例如 s021。",

    "Multiple programmes may be separated by commas.":
      "多个项目 / 计划可使用逗号分隔。",

    "Multiple metals may be separated by commas.":
      "多个金属可使用逗号分隔。",

    "Multiple periods may be separated by commas.":
      "多个周期可使用逗号分隔。",

    "Multiple values may be separated by commas.":
      "多个值可使用逗号分隔。",

    "Comma-separated tags. Known region tags are normalized when saved.":
      "使用逗号分隔标签。已知区域标签在保存时会自动标准化。",


    /* =====================================================
       Evidence Links
       ===================================================== */

    "Attach one or more Sources to one or more Sites. Existing relationships are updated rather than duplicated.":
      "将一个或多个来源关联到一个或多个站点。已有关系将被更新，而不会重复创建。",

    "Loading Sites and Sources…":
      "正在加载站点和来源…",

    "1. Sites":
      "1. 站点",

    "2. Sources":
      "2. 来源",

    "3. Relationship metadata":
      "3. 关系元数据",

    "Select all":
      "全选",

    "Deselect all":
      "全部取消选择",

    "Filter Sites…":
      "筛选站点…",

    "Filter Sources…":
      "筛选来源…",

    "Use newly added Sites":
      "使用新添加站点",

    "No programme":
      "无项目 / 计划",

    "(Unnamed Site)":
      "（未命名站点）",

    "Source order *":
      "来源顺序 *",

    "Controls Source ordering later when exported.":
      "控制后续导出时来源的排列顺序。",

    "Metal(s) for these Site–Source links":
      "这些站点—来源关联的金属",

    "Exposure period(s) for these links":
      "这些关联的暴露期",

    "Relationship notes":
      "关系备注",

    "e.g. 1 year, 2 years":
      "例如：1 year, 2 years",

    "Optional: table number, exposure series, extraction remarks…":
      "可选：表格编号、暴露系列、数据提取备注等…",

    "After linking, add missing metals and exposure periods to the Site-level summary fields.":
      "关联后，将缺失的金属和暴露期补充到站点级汇总字段。",

    "Select at least one Site and one Source.":
      "请至少选择一个站点和一个来源。",

    "Select at least one Site.":
      "请至少选择一个站点。",

    "Select at least one Source.":
      "请至少选择一个来源。",

    "Attach selected Sources":
      "关联所选来源",

    "Source order must be an integer from 1 to 99.":
      "来源顺序必须为 1 至 99 之间的整数。",

    "Unable to load Site/Source linking options.":
      "无法加载站点 / 来源关联选项。",

    "Unable to attach selected Sources.":
      "无法关联所选来源。",


    /* =====================================================
       Corrosion Data
       ===================================================== */

    "Primary measurement-level corrosion data. Each row represents one site–source–material–exposure observation.":
      "主要测量级腐蚀数据。每条记录代表一个站点—来源—材料—暴露条件组合的观测。",

    "Recommended structure: one corrosion value per observation. Do not combine multiple materials or corrosion measurements into one wide record.":
      "建议结构：每条观测对应一个腐蚀值。不要将多种材料或多项腐蚀测量合并到一条宽表记录中。",

    "Excel corrosion observation workbook":
      "Excel 腐蚀观测工作簿",

    "Select a Source with linked Sites. The completed workflow will generate one source-first macro-enabled workbook containing its linked Sites and existing observations.":
      "选择一个已关联站点的来源。系统将生成以该来源为核心的启用宏工作簿，其中包含关联站点和已有观测。",

    "Loading Sources…":
      "正在加载来源…",

    "Generate XLSM":
      "生成 XLSM",

    "Generating…":
      "正在生成…",

    "Building macro-enabled workbook…":
      "正在生成启用宏的工作簿…",

    "Unable to generate corrosion workbook.":
      "无法生成腐蚀数据工作簿。",

    "The workbook includes existing observations and one new-observation starter row per linked Site.":
      "工作簿包含已有观测，并为每个关联站点提供一条新观测起始行。",

    "Import completed workbook":
      "导入已完成工作簿",

    "Upload the completed XLSM or XLSX. Blank starter rows are ignored. Workbook formulas are not trusted; the curator independently recalculates canonical corrosion values.":
      "上传已完成的 XLSM 或 XLSX。空白起始行将被忽略。系统不会信任工作簿公式，而会独立重新计算标准腐蚀值。",

    "Choose XLSM / XLSX":
      "选择 XLSM / XLSX",

    "No file selected":
      "未选择文件",

    "Validating…":
      "正在验证…",

    "Reading workbook and independently recalculating corrosion values…":
      "正在读取工作簿并独立重新计算腐蚀值…",

    "Ready":
      "可导入",

    "Errors":
      "错误",

    "New":
      "新增",

    "Updates":
      "更新",

    "Excel row":
      "Excel 行",

    "Action":
      "操作",

    "Status":
      "状态",

    "Material":
      "材料",

    "Exposure":
      "暴露",

    "Dates":
      "日期",

    "Metric":
      "指标",

    "Reported":
      "原始报告值",

    "Canonical thickness":
      "标准厚度损失",

    "Canonical mass":
      "标准质量损失",

    "Density":
      "密度",

    "Validation":
      "验证",

    "CREATE":
      "新增",

    "UPDATE":
      "更新",

    "READY":
      "可导入",

    "ERROR":
      "错误",

    "I reviewed the validated workbook rows and want to import these corrosion observations.":
      "我已检查验证后的工作簿记录，并确认导入这些腐蚀观测。",

    "Import validated observations":
      "导入已验证观测",

    "Importing…":
      "正在导入…",

    "The workbook contains validation errors. Correct those rows in Excel and upload the workbook again.":
      "工作簿中存在验证错误。请在 Excel 中修正相关行后重新上传。",

    "The workbook contains validation errors and cannot be imported.":
      "工作簿存在验证错误，无法导入。",

    "Existing corrosion observations":
      "已有腐蚀观测",

    "Browse the authoritative database records.":
      "浏览数据库中的权威记录。",

    "Search Site, Source, material, exposure period, metric…":
      "搜索站点、来源、材料、暴露期或指标…",

    "Rows per page":
      "每页行数",

    "Loading corrosion observations…":
      "正在加载腐蚀观测…",

    "No corrosion observations match the current search.":
      "没有符合当前搜索条件的腐蚀观测。",

    "No corrosion observations have been added yet.":
      "尚未添加腐蚀观测。",

    "Corrosion observation":
      "腐蚀观测",

    "Observation details":
      "观测详情",

    "Canonical thickness-loss rate":
      "标准厚度损失速率",

    "Canonical mass-loss rate":
      "标准质量损失速率",

    "Exposure start":
      "暴露开始日期",

    "Exposure end":
      "暴露结束日期",

    "Corrosion metric":
      "腐蚀指标",

    "Reported value":
      "原始报告值",

    "Reported unit":
      "原始单位",

    "Density used":
      "采用密度",

    "Density basis":
      "密度依据",

    "Measurement method":
      "测量方法",

    "Specimen condition":
      "试样状态",

    "Exposure condition":
      "暴露条件",

    "Normalization note":
      "标准化说明",

    "Unknown Site":
      "未知站点",

    "Unknown Source":
      "未知来源",

    "← Previous":
      "← 上一页",

    "Next →":
      "下一页 →",


    /* =====================================================
       Manage Records
       ===================================================== */

    "Search and maintain records across the curator database. Results are loaded in pages so large datasets remain responsive.":
      "搜索并维护管理端数据库中的记录。结果按页加载，以保证大型数据集的响应速度。",

    "Record type":
      "记录类型",

    "Corrosion Observations":
      "腐蚀观测",

    "Environmental Observations":
      "环境观测",

    "Search records…":
      "搜索记录…",

    "Loading records…":
      "正在加载记录…",

    "Select visible":
      "选择当前显示项",

    "Review deletion":
      "检查删除影响",

    "I understand that this deletion cannot be undone.":
      "我了解此删除操作无法撤销。",

    "Delete selected records":
      "删除所选记录",

    "Deleting…":
      "正在删除…",

    "Deletion preview":
      "删除影响预览",

    "Bulk update":
      "批量编辑",

    "Replace one field for all currently selected records.":
      "统一修改当前所有已选记录的一个字段。",

    "Field to update":
      "要修改的字段",

    "New value":
      "新值",

    "Apply bulk update":
      "执行批量修改",

    "Preview classifications":
      "预览分类结果",

    "Apply selected classifications":
      "确认所选分类结果",

    "Classify selected Sites using the same geographic and semantic rules used when creating a Site.":
      "按照创建站点时使用的同一套地理与语义规则，对所选站点进行自动分类。",


    /* =====================================================
       Export / Publish
       ===================================================== */

    "Select the Sites that should appear in the public Atlas and generate the public website datasets.":
      "选择需要出现在公开 Corrosion Atlas 中的站点，并生成公开网站数据集。",

    "Loading publish state…":
      "正在加载发布状态…",

    "Curated Sites":
      "管理端站点",

    "Currently published":
      "当前已发布",

    "Selected next":
      "下次发布已选择",

    "Search Sites":
      "搜索站点",

    "Site ID, label, country, region…":
      "站点 ID、名称、国家、区域…",

    "Unpublished Sites":
      "未发布站点",

    "Present in the curator database but not in the current public sites.csv.":
      "存在于管理端数据库中，但不在当前公开 sites.csv 中。",

    "Currently published Sites":
      "当前已发布站点",

    "Selected by default. Clear a Site to remove it from the next public dataset.":
      "默认保持选中。取消选择某个站点即可在下一次公开数据集中移除它。",

    "Keep all":
      "全部保留",

    "Website data package":
      "网站数据包",

    "Sites and public Source metadata are always included. Observation datasets can be included below.":
      "站点和公开来源元数据始终包含在内。可在下方选择是否包含观测数据集。",

    "Include corrosion observations":
      "包含腐蚀观测",

    "Include environmental observations":
      "包含环境观测",

    "Download website package":
      "下载网站数据包",

    "Download only. This step does not modify GitHub or the public Atlas.":
      "仅下载。此步骤不会修改 GitHub 或公开 Corrosion Atlas。",

    "Publish to GitHub":
      "发布至 GitHub",

    "Regenerate the selected public datasets and upload them directly to the website repository.":
      "重新生成所选公开数据集，并直接上传到网站代码仓库。",

    "Checking GitHub configuration…":
      "正在检查 GitHub 配置…",

    "GitHub publishing is not configured.":
      "尚未配置 GitHub 发布。",

    "Unable to check GitHub configuration.":
      "无法检查 GitHub 配置。",

    "Commit message":
      "提交信息",

    "I reviewed the selected Sites and want to update the public website datasets on GitHub.":
      "我已检查所选站点，并确认更新 GitHub 上的公开网站数据集。",

    "Publishing updates the repository immediately. The public Atlas may take a short time to reflect the new files.":
      "发布操作会立即更新代码仓库。公开 Corrosion Atlas 可能需要短暂时间才能显示新文件。",

    "No matching unpublished Sites.":
      "没有符合条件的未发布站点。",

    "No matching published Sites.":
      "没有符合条件的已发布站点。",

    "Generating public website datasets…":
      "正在生成公开网站数据集…",

    "Unable to generate website package.":
      "无法生成网站数据包。",

    "Publishing…":
      "正在发布…",

    "Regenerating website datasets and publishing them to GitHub…":
      "正在重新生成网站数据集并发布至 GitHub…",


    /* =====================================================
       Settings
       ===================================================== */

    "Loading settings…":
      "正在加载设置…",

    "System status":
      "系统状态",

    "Configuration presence and service availability. Secret values are never displayed.":
      "显示配置和服务可用状态。任何密钥值均不会显示。",

    "Private R2 PDFs":
      "私有 R2 PDF",

    "GitHub publishing":
      "GitHub 发布",

    "Curator build":
      "管理端版本",

    "Active":
      "运行中",

    "Unavailable":
      "不可用",

    "These rules are used when automatically classifying Sites. Saving them does not modify existing Sites.":
      "这些规则用于站点自动分类。保存规则不会修改已有站点。",

    "Distance to coast":
      "距海岸距离",

    "Marine threshold, km":
      "海洋阈值，km",

    "Coastal threshold, km":
      "沿海阈值，km",

    "Near-coastal threshold, km":
      "近沿海阈值，km",

    "Latitude rules":
      "纬度规则",

    "Antarctic if latitude ≤":
      "南极：纬度 ≤",

    "Sub-Antarctic lower latitude":
      "亚南极纬度下限",

    "Sub-Antarctic upper latitude":
      "亚南极纬度上限",

    "Sub-arctic lower latitude":
      "亚北极纬度下限",

    "Sub-arctic upper latitude":
      "亚北极纬度上限",

    "Tropical if |latitude| ≤":
      "热带：|纬度| ≤",

    "Cold if |latitude| ≥":
      "寒冷：|纬度| ≥",

    "Extreme cold if |latitude| ≥":
      "极寒：|纬度| ≥",

    "Temperature rules":
      "温度规则",

    "Prefer annual mean temperature when available for Tropical / Temperate / Cold / Extreme cold.":
      "如有年平均温度数据，则优先使用其判断热带 / 温带 / 寒冷 / 极寒。",

    "Tropical mean temperature ≥":
      "热带平均温度 ≥",

    "Temperate mean temperature ≥":
      "温带平均温度 ≥",

    "Cold mean temperature ≤":
      "寒冷平均温度 ≤",

    "Extreme cold mean temperature ≤":
      "极寒平均温度 ≤",

    "Semantic rules":
      "语义规则",

    "One country hint or regular-expression pattern per line.":
      "每行输入一个国家提示词或正则表达式。",

    "Island country hints":
      "岛屿国家提示词",

    "Island text patterns":
      "岛屿文本模式",

    "Urban patterns":
      "城市模式",

    "Rural patterns":
      "乡村模式",

    "Industrial patterns":
      "工业模式",

    "Hot-arid patterns":
      "炎热干旱模式",

    "Save region rules":
      "保存区域规则",

    "Saving region-classification rules…":
      "正在保存区域分类规则…",

    "Region-classification rules saved. Future automatic classifications will use these values.":
      "区域分类规则已保存。今后的自动分类将使用这些设置。",

    "Unable to save region rules.":
      "无法保存区域规则。",

    "Reset to defaults":
      "恢复默认值",

    "Resetting…":
      "正在恢复…",

    "Region-classification rules reset to the built-in defaults.":
      "区域分类规则已恢复为内置默认值。",

    "Unable to reset region rules.":
      "无法恢复区域规则。",

    "Existing Site classifications":
      "已有站点分类",

    "Changing these rules does not silently rewrite existing records. Preview and apply bulk classification changes through Manage Records.":
      "修改这些规则不会自动重写已有记录。请通过“记录管理”预览并应用批量分类修改。",

    "Open Manage Records":
      "打开记录管理",
  };

/*
 * Polished Chinese UI copy.
 *
 * This layer intentionally overrides the original
 * literal translations without requiring us to
 * rewrite the entire first-pass dictionary.
 */
const ZH_POLISH = {
  /* =====================================================
     Shared / Dashboard
     ===================================================== */

  "Private curator":
    "内部管理端",

  "Corrosion Atlas data infrastructure":
    "Corrosion Atlas 数据管理",

  "Manage exposure sites, source evidence, corrosion data, environmental observations, and publication workflows.":
    "管理暴露站点、来源证据、腐蚀数据、环境观测及数据发布。",

  "Curated exposure locations":
    "已收录的暴露站点",

  "Literature, reports and datasets":
    "文献、报告与数据集",

  "Site ↔ source relationships":
    "站点 ↔ 来源关联",

  "Measurement-level records":
    "测量级数据记录",

  "Climate and exposure context":
    "气候与暴露环境信息",

  "Register, search and edit source records and their linked sites.":
    "管理来源记录及其关联站点。",

  "Search, create and edit exposure sites and supporting evidence.":
    "管理暴露站点及相关证据。",

  "Bulk-link Sources to Sites and maintain Site–Source evidence metadata.":
    "批量建立站点与来源之间的证据关联，并维护关联信息。",

  "Browse measurement-level corrosion observations and prepare source-first workbook entry.":
    "浏览腐蚀观测记录，并按来源生成数据录入工作簿。",

  "Migration pending":
    "尚未迁移",

  "Preview and import bulk Site and Source datasets.":
    "预览并导入批量站点和来源数据。",

  "Select public Sites and generate website datasets for publication.":
    "选择公开站点并生成网站发布数据。",

  "Region-classification rules and curator infrastructure status.":
    "设置区域分类规则并查看管理端运行状态。",


  /* =====================================================
     Sites
     ===================================================== */

  "Create one":
    "单个新建",

  "Create multiple":
    "批量新建",

  "Browse existing exposure sites or create new Sites individually or in bulk.":
    "浏览现有暴露站点，或单个、批量新增站点。",

  "Create multiple Sites":
    "批量新建站点",

  "Enter one geographic search per line. Add a country, province, region, or other context when a place name could be ambiguous.":
    "每行输入一个地点。名称可能有歧义时，请补充国家、省份、地区等信息。",

  "Geographic searches":
    "地点列表",

  "One non-empty line = one independent geographic search. Maximum 50 searches per batch.":
    "每个非空行作为一个独立地点进行检索，每批最多 50 个。",

  "Analyse Sites":
    "开始识别",

  "Analysing…":
    "正在识别…",

  "Review":
    "核对",

  "Needs review":
    "需要确认",

  "Existing":
    "已有",

  "Select ready":
    "选择可创建项",

  "Clear selection":
    "取消全部选择",

  "Create selected Sites":
    "创建所选站点",

  "Ready Sites are selected by default. Existing Sites are excluded. Each selected Site is revalidated through the normal Site-creation workflow before it is saved.":
    "可创建的站点默认选中，已有站点自动排除。保存前会再次检查每个所选站点。",

  "Search query":
    "搜索地点",

  "Geographic match":
    "匹配地点",

  "Site label":
    "站点名称",

  "Country / location":
    "国家 / 地区",

  "Modern country / location":
    "现属国家 / 地区",

  "Modern country location":
    "现属国家 / 地区",

  "Administering country":
    "管理国",

  "Region":
    "区域分类",

  "Region category":
    "区域分类",

  "Likely existing Site":
    "可能已有该站点",

  "Same Site label and country":
    "站点名称和国家一致",

  "Location lookup":
    "地点检索",

  "Search OpenStreetMap, then apply a result to fill the site name, coordinates, and country.":
    "在 OpenStreetMap 中搜索地点，并使用匹配结果填写站点名称、坐标和国家。",

  "Automatic region classification":
    "自动区域分类",

  "No classification suggested.":
    "未获得分类建议。",

  "Region classification unavailable.":
    "暂时无法进行区域分类。",

  "Sources associated with this exposure site.":
    "与该站点关联的来源。",

  "Source order":
    "来源排序",

  "Save link":
    "保存关联",


  /* =====================================================
     Sources
     ===================================================== */

  "Browse and search source records in the Corrosion Atlas database.":
    "浏览和搜索 Corrosion Atlas 中的来源记录。",

  "+ New source":
    "+ 新建来源",

  "Source code":
    "来源编号",

  "Source title":
    "来源标题",

  "Source kind":
    "来源类别",

  "Source type":
    "来源类型",

  "Authors / organization":
    "作者 / 机构",

  "Publication year":
    "年份",

  "Public URL":
    "公开链接",

  "Display citation":
    "展示引用格式",

  "Suggested citation":
    "建议引用格式",

  "Public notes":
    "公开备注",

  "Programme":
    "项目 / 计划",

  "Source URL":
    "来源链接",

  "Private PDF":
    "私有 PDF",

  "Source document stored privately in Cloudflare R2.":
    "来源文件存储于 Cloudflare R2 私有存储桶。",

  "No PDF attached":
    "未附加 PDF",

  "Upload a PDF for this Source.":
    "为该来源上传 PDF。",

  "Upload a private source document for this Source.":
    "为该来源上传私有 PDF。",

  "Stored in the private Corrosion Atlas R2 bucket.":
    "文件已存储在 Corrosion Atlas 私有 R2 存储桶中。",

  "Linked sites":
    "关联站点",

  "Exposure sites associated with this source.":
    "与该来源关联的暴露站点。",

  "No author information":
    "未填写作者 / 机构",

  "No programme":
    "未填写项目 / 计划",

  "Paper, report, dataset, or source title":
    "论文、报告、数据集或其他来源的标题",

  "Publisher, DOI, dataset, or public landing page":
    "出版页面、DOI、数据集或其他公开访问链接",

  "Leave blank to auto-generate from authors, year, and title.":
    "留空时将根据作者、年份和标题自动生成。",

  "Private PDF object key":
    "私有 PDF 对象键",

  "Internal Cloudflare R2 object key. Do not publish this value.":
    "Cloudflare R2 内部对象键，请勿公开。",

  "Select a PDF file.":
    "请选择 PDF 文件。",

  "Uploading…":
    "正在上传…",

  "Replacing…":
    "正在替换…",

  "Private PDF uploaded.":
    "PDF 已上传。",

  "Private PDF removed.":
    "PDF 已移除。",

  "Unable to upload private PDF.":
    "PDF 上传失败。",

  "Unable to remove private PDF.":
    "PDF 移除失败。",


  /* =====================================================
     Evidence Links
     ===================================================== */

  "Attach one or more Sources to one or more Sites. Existing relationships are updated rather than duplicated.":
    "批量将来源关联到站点。已有关系会直接更新，不会重复创建。",

  "3. Relationship metadata":
    "3. 关联信息",

  "Deselect all":
    "取消全选",

  "Use newly added Sites":
    "使用新添加的站点",

  "Controls Source ordering later when exported.":
    "控制导出时来源的显示顺序。",

  "Metal(s) for these Site–Source links":
    "这些关联对应的金属",

  "Exposure period(s) for these links":
    "这些关联对应的暴露期",

  "Relationship notes":
    "关联备注",

  "After linking, add missing metals and exposure periods to the Site-level summary fields.":
    "建立关联后，将缺失的金属和暴露期同步到站点汇总字段。",

  "Attach selected Sources":
    "建立所选关联",

  "Source order must be an integer from 1 to 99.":
    "来源排序必须为 1–99 之间的整数。",


  /* =====================================================
     Corrosion
     ===================================================== */

  "Primary measurement-level corrosion data. Each row represents one site–source–material–exposure observation.":
    "腐蚀观测数据库。每条记录对应一个站点—来源—材料—暴露条件组合。",

  "Recommended structure: one corrosion value per observation. Do not combine multiple materials or corrosion measurements into one wide record.":
    "建议每条观测只记录一个腐蚀值，不要将多种材料或多项腐蚀测量合并为一条记录。",

  "Excel corrosion observation workbook":
    "腐蚀观测 Excel 工作簿",

  "Select a Source with linked Sites. The completed workflow will generate one source-first macro-enabled workbook containing its linked Sites and existing observations.":
    "选择一个已关联站点的来源，生成以该来源为单位的 XLSM 工作簿，其中包含关联站点及已有观测。",

  "The workbook includes existing observations and one new-observation starter row per linked Site.":
    "工作簿包含已有观测，并为每个关联站点预留一条新观测录入行。",

  "Import completed workbook":
    "导入填写后的工作簿",

  "Upload the completed XLSM or XLSX. Blank starter rows are ignored. Workbook formulas are not trusted; the curator independently recalculates canonical corrosion values.":
    "上传填写完成的 XLSM 或 XLSX。空白模板行会自动忽略；系统会独立重新计算标准腐蚀值，不直接采用工作簿公式结果。",

  "Reported":
    "报告值",

  "Canonical thickness":
    "标准厚度损失",

  "Canonical mass":
    "标准质量损失",

  "Validation":
    "校验结果",

  "I reviewed the validated workbook rows and want to import these corrosion observations.":
    "我已核对验证结果，并确认导入这些腐蚀观测。",

  "Import validated observations":
    "导入已验证数据",

  "Existing corrosion observations":
    "已有腐蚀观测",

  "Browse the authoritative database records.":
    "浏览数据库中的正式记录。",

  "Rows per page":
    "每页条数",

  "Observation details":
    "观测详情",

  "Reported value":
    "报告值",

  "Reported unit":
    "报告单位",

  "Density used":
    "采用密度",

  "Normalization note":
    "标准化说明",


  /* =====================================================
     Manage Records
     ===================================================== */

  "Search and maintain records across the curator database. Results are loaded in pages so large datasets remain responsive.":
    "搜索、编辑和维护管理端中的各类记录。结果采用分页加载，以保证大型数据集操作流畅。",

  "Select visible":
    "选择当前页",

  "Review deletion":
    "查看删除影响",

  "I understand that this deletion cannot be undone.":
    "我已了解删除后无法恢复。",

  "Delete selected records":
    "删除所选记录",

  "Deletion preview":
    "删除影响预览",

  "Bulk update":
    "批量编辑",

  "Replace one field for all currently selected records.":
    "统一修改当前所有已选记录的一个字段。",

  "Field to update":
    "修改字段",

  "Apply bulk update":
    "执行批量修改",

  "Classify selected Sites using the same geographic and semantic rules used when creating a Site.":
    "按照创建站点时使用的同一套地理与语义规则，对所选站点进行自动分类。",

  "Preview classifications":
    "预览分类结果",

  "Apply selected classifications":
    "应用所选结果",

  "Clear preview":
    "清除预览",


  /* =====================================================
     Export / Publish
     ===================================================== */

  "Select the Sites that should appear in the public Atlas and generate the public website datasets.":
    "选择要发布到公开 Corrosion Atlas 的站点，并生成网站数据文件。",

  "Curated Sites":
    "数据库站点",

  "Currently published":
    "当前已发布",

  "Selected next":
    "本次选中",

  "Search Sites":
    "搜索站点",

  "Unpublished Sites":
    "未发布站点",

  "Present in the curator database but not in the current public sites.csv.":
    "已存在于管理端数据库中，但尚未包含在当前公开 sites.csv 中。",

  "Currently published Sites":
    "已发布站点",

  "Selected by default. Clear a Site to remove it from the next public dataset.":
    "默认全部选中。取消勾选即可在下一次发布中移除对应站点。",

  "Keep all":
    "全部保留",

  "Sites and public Source metadata are always included. Observation datasets can be included below.":
    "站点和公开来源元数据始终包含在内，可在下方选择是否包含观测数据。",

  "Download only. This step does not modify GitHub or the public Atlas.":
    "仅生成下载文件，不会修改 GitHub 或公开网站。",

  "Publish to GitHub":
    "发布到 GitHub",

  "Regenerate the selected public datasets and upload them directly to the website repository.":
    "重新生成所选公开数据，并直接提交到网站代码仓库。",

  "Commit message":
    "提交说明",

  "I reviewed the selected Sites and want to update the public website datasets on GitHub.":
    "我已核对所选站点，并确认更新 GitHub 上的公开网站数据。",

  "Publishing updates the repository immediately. The public Atlas may take a short time to reflect the new files.":
    "发布后代码仓库会立即更新，公开网站可能需要短暂时间才能同步新文件。",


  /* =====================================================
     Settings
     ===================================================== */

  "Configuration presence and service availability. Secret values are never displayed.":
    "显示各项服务的配置和可用状态；任何密钥内容均不会显示。",

  "Private R2 PDFs":
    "R2 私有 PDF",

  "GitHub publishing":
    "GitHub 发布",

  "Curator build":
    "管理端版本",

  "Active":
    "运行中",

  "These rules are used when automatically classifying Sites. Saving them does not modify existing Sites.":
    "自动分类站点时使用以下规则。保存设置不会修改已有站点。",

  "Distance to coast":
    "海岸距离规则",

  "Marine threshold, km":
    "海洋环境阈值（km）",

  "Coastal threshold, km":
    "沿海环境阈值（km）",

  "Near-coastal threshold, km":
    "近沿海环境阈值（km）",

  "Temperature rules":
    "温度判定规则",

  "Prefer annual mean temperature when available for Tropical / Temperate / Cold / Extreme cold.":
    "如有年平均温度数据，则优先使用其判定热带 / 温带 / 寒冷 / 极寒。",

  "Semantic rules":
    "语义识别规则",

  "One country hint or regular-expression pattern per line.":
    "每行填写一个国家提示词或正则表达式。",

  "Island country hints":
    "岛屿国家提示词",

  "Island text patterns":
    "岛屿匹配规则",

  "Urban patterns":
    "城市匹配规则",

  "Rural patterns":
    "乡村匹配规则",

  "Industrial patterns":
    "工业区匹配规则",

  "Hot-arid patterns":
    "炎热干旱地区匹配规则",

  "Save region rules":
    "保存分类规则",

  "Reset to defaults":
    "恢复默认设置",

  "Existing Site classifications":
    "现有站点分类",

  "Changing these rules does not silently rewrite existing records. Preview and apply bulk classification changes through Manage Records.":
    "修改规则不会自动改写已有记录。可在“记录管理”中预览并批量应用新的分类结果。",

  "Open Manage Records":
    "打开记录管理",
};

/*
 * Some short English labels mean different things
 * depending on where they appear.
 */
const ZH_CONTEXT = {
  "Ready": [
    {
      selector:
        ".sites-bulk-state, .sites-bulk-filter",
      value:
        "可创建",
    },

    {
      selector:
        ".corrosion-preview-metric",
      value:
        "可导入",
    },

    {
      selector:
        ".settings-status-card",
      value:
        "正常",
    },
  ],

  "Existing": [
    {
      selector:
        "#sites-bulk-results-section",
      value:
        "已有",
    },
  ],

  "Review": [
    {
      selector:
        "#sites-bulk-results-section",
      value:
        "核对",
    },
  ],

  "New": [
    {
      selector:
        ".corrosion-preview-metric",
      value:
        "新增",
    },
  ],

  "Updates": [
    {
      selector:
        ".corrosion-preview-metric",
      value:
        "更新",
    },
  ],
};


function contextTranslation(
  source,
  element
) {
  if (
    !element ||
    !ZH_CONTEXT[source]
  ) {
    return null;
  }


  for (
    const rule
    of ZH_CONTEXT[source]
  ) {
    try {
      if (
        element.matches(
          rule.selector
        ) ||
        element.closest(
          rule.selector
        )
      ) {
        return rule.value;
      }
    } catch {
      // Ignore an invalid selector.
    }
  }


  return null;
}


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

    m =
      source.match(
        /^(All|Ready|Needs review|Existing) \((\d+)\)$/
      );


    if (m) {
      const labels = {
        "All":
          "全部",

        "Ready":
          "可创建",

        "Needs review":
          "需要确认",

        "Existing":
          "已有",
      };


      return (
        `${labels[m[1]]} ` +
        `(${m[2]})`
      );
    }

    m =
      source.match(
        /^0 (Sites|Sources|Evidence Links|Corrosion Observations|Environmental Observations)$/
      );


    if (m) {
      const labels = {
        "Sites":
          "个站点",

        "Sources":
          "个来源",

        "Evidence Links":
          "条证据关联",

        "Corrosion Observations":
          "条腐蚀观测",

        "Environmental Observations":
          "条环境观测",
      };


      return (
        `0 ${labels[m[1]]}`
      );
    }

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


    /* Source list counts */
    m =
      source.match(
        /^(\d+) sources?$/
      );


    if (m) {
      return `${m[1]} 个来源`;
    }


    /* Page labels */
    m =
      source.match(
        /^Page ([\d,]+) of ([\d,]+)$/
      );


    if (m) {
      return (
        `第 ${m[1]} 页 / ` +
        `共 ${m[2]} 页`
      );
    }


    /* Generic paged record summaries */
    m =
      source.match(
        /^Showing ([\d,]+)–([\d,]+) of ([\d,]+) records$/
      );


    if (m) {
      return (
        `显示第 ${m[1]}–${m[2]} 条，` +
        `共 ${m[3]} 条记录`
      );
    }


    m =
      source.match(
        /^Showing ([\d,]+)–([\d,]+) of ([\d,]+) observations$/
      );


    if (m) {
      return (
        `显示第 ${m[1]}–${m[2]} 条，` +
        `共 ${m[3]} 条观测`
      );
    }


    m =
      source.match(
        /^0 corrosion observations$/
      );


    if (m) {
      return "0 条腐蚀观测";
    }


    /* Evidence-link preview */
    m =
      source.match(
        /^This will create or update (\d+) Site–Source relationships?\.$/
      );


    if (m) {
      return (
        `将创建或更新 ${m[1]} 条` +
        `站点—来源关联。`
      );
    }


    m =
      source.match(
        /^Saving (\d+) links?…$/
      );


    if (m) {
      return (
        `正在保存 ${m[1]} 条关联…`
      );
    }


    m =
      source.match(
        /^Created or updated (\d+) Site–Source links?\.$/
      );


    if (m) {
      return (
        `已创建或更新 ${m[1]} 条` +
        `站点—来源关联。`
      );
    }


    m =
      source.match(
        /^(\d+) newly added Sites? found since the last successful evidence link\.$/
      );


    if (m) {
      return (
        `自上次成功建立证据关联后，` +
        `发现 ${m[1]} 个新添加站点。`
      );
    }


    m =
      source.match(
        /^Suggested from selected Source\(s\): Metals: (.+) · Exposure periods: (.+)$/
      );


    if (m) {
      return (
        `根据所选来源建议：` +
        `金属：${m[1]} · ` +
        `暴露期：${m[2]}`
      );
    }


    /* Required-field messages */
    m =
      source.match(
        /^Required: (.+)\.$/
      );


    if (m) {
      const translated =
        m[1]
          .split(", ")
          .map(
            (label) =>
              ZH[label] ||
              label
          )
          .join("、");


      return `必填：${translated}。`;
    }


    /* Corrosion observations */
    m =
      source.match(
        /^Observation #(\d+)$/
      );


    if (m) {
      return `观测 #${m[1]}`;
    }


    m =
      source.match(
        /^From (.+)$/
      );


    if (m) {
      return `自 ${m[1]}`;
    }


    m =
      source.match(
        /^Until (.+)$/
      );


    if (m) {
      return `至 ${m[1]}`;
    }


    m =
      source.match(
        /^Imported (\d+) corrosion observations?\. (\d+) created, (\d+) updated\.$/
      );


    if (m) {
      return (
        `已导入 ${m[1]} 条腐蚀观测。` +
        `${m[2]} 条新增，` +
        `${m[3]} 条更新。`
      );
    }


    /* Manage Records */
    m =
      source.match(
        /^Deleted (\d+) records?\.$/
      );


    if (m) {
      return `已删除 ${m[1]} 条记录。`;
    }


    m =
      source.match(
        /^Updated (\d+) records?\.$/
      );


    if (m) {
      return `已更新 ${m[1]} 条记录。`;
    }


    m =
      source.match(
        /^Updated region classification for (\d+) Sites?\.$/
      );


    if (m) {
      return (
        `已更新 ${m[1]} 个站点的` +
        `区域分类。`
      );
    }


    m =
      source.match(
        /^Edit Site (.+)$/
      );


    if (m) {
      return `编辑站点 ${m[1]}`;
    }


    m =
      source.match(
        /^Edit Source (.+)$/
      );


    if (m) {
      return `编辑来源 ${m[1]}`;
    }


    /* Publish page */
    if (
      /\d+ source\(s\)/.test(
        source
      )
    ) {
      return source.replace(
        /(\d+) source\(s\)/g,
        "$1 个来源"
      );
    }


    m =
      source.match(
        /^Duplicate site_id values must be fixed before export: (.+)$/
      );


    if (m) {
      return (
        `导出前必须修复重复的 site_id：` +
        m[1]
      );
    }


    m =
      source.match(
        /^Exported (\d+) Site\(s\), (\d+) public Source\(s\), (\d+) corrosion observation\(s\), and (\d+) environmental observation\(s\)\.$/
      );


    if (m) {
      return (
        `已导出 ${m[1]} 个站点、` +
        `${m[2]} 个公开来源、` +
        `${m[3]} 条腐蚀观测和 ` +
        `${m[4]} 条环境观测。`
      );
    }


    m =
      source.match(
        /^Published (\d+) Site\(s\), (\d+) Source\(s\), (\d+) corrosion observation\(s\), and (\d+) environmental observation\(s\)\. (\d+) GitHub file\(s\) changed; (\d+) unchanged file\(s\) skipped\.$/
      );


    if (m) {
      return (
        `已发布 ${m[1]} 个站点、` +
        `${m[2]} 个来源、` +
        `${m[3]} 条腐蚀观测和 ` +
        `${m[4]} 条环境观测。` +
        `GitHub 中 ${m[5]} 个文件已更改，` +
        `${m[6]} 个未变化文件已跳过。`
      );
    }


    /* Settings R2 count */
    m =
      source.match(
        /^(\d+) PDF object\(s\) · (.+)$/
      );


    if (m) {
      return (
        `${m[1]} 个 PDF 对象 · ` +
        `${m[2]}`
      );
    }


    /* Confirmation dialogs */
    m =
      source.match(
        /^Create (\d+) selected Sites?\? Each Site will be validated and saved sequentially\.$/
      );


    if (m) {
      return (
        `创建所选 ${m[1]} 个站点？` +
        `每个站点都会依次验证并保存。`
      );
    }


    m =
      source.match(
        /^Remove (.+) from this source\?$/
      );


    if (m) {
      return (
        `从该来源中移除 ${m[1]}？`
      );
    }


    if (
      source ===
      "Remove this private PDF from the Source?"
    ) {
      return (
        "从该来源中移除此私有 PDF？"
      );
    }


    if (
      source ===
      "Reset all automatic region-classification rules to the built-in defaults?"
    ) {
      return (
        "将所有自动区域分类规则恢复为内置默认值？"
      );
    }


    /* Page/document titles */
    m =
      source.match(
        /^(.+) · Corrosion Atlas Curator$/
      );


    if (m) {
      const prefix =
        ZH[m[1]] ||
        m[1];


      return (
        `${prefix} · ` +
        `Corrosion Atlas 管理端`
      );
    }


    m =
      source.match(
        /^(.+) — Corrosion Atlas Curator$/
      );


    if (m) {
      const prefix =
        ZH[m[1]] ||
        m[1];


      return (
        `${prefix} — ` +
        `Corrosion Atlas 管理端`
      );
    }


    return null;
  }


  function translate(
    value,
    lang = language,
    element = null
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


    const contextual =
      contextTranslation(
        source,
        element
      );


    if (contextual) {
      return contextual;
    }


    if (
      Object.hasOwn(
        ZH_POLISH,
        source
      )
    ) {
      return ZH_POLISH[
        source
      ];
    }


    if (
      Object.hasOwn(
        ZH,
        source
      )
    ) {
      return ZH[
        source
      ];
    }


    return (
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
        `${translate(
          original,
          language,
          node.parentElement
        )}` +
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
              original,
              language,
              element
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

  /*
   * Translate native browser dialogs too.
   * This avoids editing every page that calls
   * window.confirm().
   */
  const nativeConfirm =
    window.confirm.bind(
      window
    );


  const nativeAlert =
    window.alert.bind(
      window
    );


  window.confirm =
    (message) =>
      nativeConfirm(
        translate(
          message
        )
      );


  window.alert =
    (message) =>
      nativeAlert(
        translate(
          message
        )
      );

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