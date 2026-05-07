from __future__ import annotations


LANGUAGE_LABEL_TO_CODE = {
    "English": "en",
    "中文": "zh",
}


TRANSLATIONS = {
    "en": {
        "app_title": "Corrosion Map Curator",
        "app_caption": "Local curation app for managing sites, sources, and site-source links.",
        "language_label": "Language / 语言",
        "user_manual_button": "📘 User Manual",
        "manual_language": "Manual language",
        "logout": "Log out",
        "navigation": "Navigation",

        "nav_dashboard": "Dashboard",
        "nav_sources": "Sources",
        "nav_sites": "Sites",
        "nav_corrosion_data": "Corrosion Data",
        "nav_environmental_data": "Environmental Data",
        "nav_manage_records": "Manage Records",
        "nav_import": "Import",
        "nav_export_publish": "Export / Publish",
        "nav_settings": "Settings",

        "common_add_source": "Add source",
        "common_add_site": "Add site",
        "common_import_csv": "Import CSV",
        "common_open_public_map": "Open public map",
        "common_set_public_map_url": "Set public map URL",
        
        "dashboard_hero_eyebrow": "Curator overview",
        "dashboard_hero_title": "Corrosion Map data infrastructure",
        "dashboard_hero_subtitle": "Monitor the database, source documents, publication readiness, and corrosion/environmental observation layers from one control panel.",

        "dashboard_status_backend": "Backend",
        "dashboard_status_github": "GitHub",
        "dashboard_status_public_map": "Public map",
        "dashboard_status_import_draft": "Import draft",

        "dashboard_section_database_records": "Database records",
        "dashboard_section_source_documents": "Source documents",
        "dashboard_section_system_status": "System status",
        "dashboard_section_workflow": "Workflow",

        "dashboard_card_sites": "Sites",
        "dashboard_card_sites_hint": "Curated exposure locations",
        "dashboard_card_sources": "Sources",
        "dashboard_card_sources_hint": "Registered papers/reports",
        "dashboard_card_evidence_links": "Evidence links",
        "dashboard_card_evidence_links_hint": "Site-source relationships",
        "dashboard_card_corrosion_observations": "Corrosion observations",
        "dashboard_card_corrosion_observations_hint": "Measurement-level rows",
        "dashboard_card_environmental_observations": "Environmental observations",
        "dashboard_card_environmental_observations_hint": "Climate/context rows",

        "dashboard_card_pdf_files": "PDF files",
        "dashboard_card_pdf_files_hint": "Detected in source_pdfs/",
        "dashboard_card_unregistered_pdfs": "Unregistered PDFs",
        "dashboard_card_unregistered_pdfs_hint": "Canonical files not yet in sources table",
        "dashboard_card_pdf_folder": "PDF folder",
        "dashboard_card_pdf_folder_hint": "Local/public source-document directory",

        "dashboard_warning_noncanonical_pdfs": "Some PDF filenames are not in canonical `sNNN.pdf` format. Rename them before registration.",
        "dashboard_expander_show_pdf_renames": "Show PDF files that will be renamed",
        "dashboard_button_rename_pdfs": "Rename PDFs to canonical source-code filenames",
        "dashboard_warning_missing_pdfs": "{count} canonical PDF file(s) in `source_pdfs/` are not registered yet. Go to the Sources tab to register them.",
        "dashboard_success_all_pdfs_registered": "All detected canonical PDFs are registered as sources.",
        "dashboard_info_no_pdfs": "No PDFs found in `source_pdfs/` yet.",

        "dashboard_card_backend": "Backend",
        "dashboard_card_backend_hint": "Current database mode",
        "dashboard_card_github_publish": "GitHub publish",
        "dashboard_card_github_publish_hint": "Dataset upload readiness",
        "dashboard_card_public_map_url": "Public map URL",
        "dashboard_card_import_draft": "Import draft",
        "dashboard_card_import_draft_hint": "Unsaved import-preview recovery",
        "dashboard_public_map_missing": "No URL configured",

        "dashboard_workflow_register_sources_title": "Register sources",
        "dashboard_workflow_register_sources_caption": "Add PDFs, titles, programmes, metals, and exposure periods.",
        "dashboard_workflow_add_sites_title": "Add sites",
        "dashboard_workflow_add_sites_caption": "Create or merge exposure-site records with coordinates.",
        "dashboard_workflow_link_evidence_title": "Link evidence",
        "dashboard_workflow_link_evidence_caption": "Attach source records to sites and preserve metadata.",
        "dashboard_workflow_publish_title": "Publish",
        "dashboard_workflow_publish_caption": "Export curated rows to the public website dataset.",

        "status_ready": "Ready",
        "status_missing": "Missing",
        "status_not_configured": "Not configured",
        "status_unknown": "Unknown",
        "status_available": "Available",
        "status_none": "None",
        "status_set": "Set",

        "settings_title": "Settings",
        "settings_caption": "Maintenance tools and database safety controls.",

        "settings_section_paths": "Paths",
        "settings_database_backend": "Database backend",
        "settings_database_backend_supabase": "SUPABASE",
        "settings_database_backend_sqlite": "Local SQLite",
        "settings_database_file": "Database file",
        "settings_source_pdf_folder": "Source PDF folder",

        "settings_section_app_controls": "App controls",
        "settings_button_refresh_app": "Refresh app",

        "settings_section_region_rules": "Region classification rules",
        "settings_region_rules_caption": "These rules control automatic region-category suggestions for future imports and for the Manage Records auto-classification preview.",

        "settings_distance_thresholds": "Distance-to-coast thresholds",
        "settings_marine_threshold_km": "Marine threshold, km",
        "settings_coastal_threshold_km": "Coastal threshold, km",
        "settings_near_coastal_threshold_km": "Near-coastal threshold, km",

        "settings_latitude_rules": "Latitude-based polar and broad-climate rules",
        "settings_antarctic_latitude_max": "Antarctic if latitude ≤",
        "settings_sub_antarctic_latitude_min": "Sub-Antarctic lower latitude",
        "settings_sub_antarctic_latitude_max": "Sub-Antarctic upper latitude",
        "settings_sub_arctic_latitude_min": "Sub-arctic if latitude ≥",
        "settings_sub_arctic_latitude_max": "Sub-arctic upper latitude",
        "settings_tropical_abs_latitude_max": "Tropical if |latitude| ≤",
        "settings_cold_abs_latitude_min": "Cold if |latitude| ≥",
        "settings_extreme_cold_abs_latitude_min": "Extreme cold if |latitude| ≥",

        "settings_semantic_rules": "Semantic tag rules",
        "settings_semantic_rules_caption": "Enter one regular-expression pattern or one country hint per line. These rules explain how non-distance tags such as Island, Industrial, Urban, and Rural are inferred.",
        "settings_island_country_hints": "Island country hints",
        "settings_island_text_patterns": "Island text patterns",
        "settings_industrial_text_patterns": "Industrial text patterns",
        "settings_urban_text_patterns": "Urban text patterns",
        "settings_rural_text_patterns": "Rural text patterns",
        "settings_hot_arid_text_patterns": "Hot-arid text patterns",

        "settings_save_region_rules": "Save rules for future classifications",
        "settings_reset_region_rules": "Reset to default rules",
        "settings_region_rules_saved": "Region classification rules saved for future automatic classifications.",
        "settings_region_rules_reset": "Region classification rules reset to defaults.",

        "settings_apply_rules_existing": "Apply rules to existing sites",
        "settings_apply_rules_existing_warning": "Recommended workflow: preview first, then apply selected rows. The safest bulk action is to fill only sites whose region_category is currently empty.",
        "settings_existing_preview_mode": "Existing-site preview mode",
        "settings_preview_mode_empty_only": "Only sites with empty region_category",
        "settings_preview_mode_all_sites": "All sites, preserving manual tags outside replaced dimensions",
        "settings_preview_existing_sites": "Preview effect on existing sites",
        "settings_preview_build_error": "Could not build region-classification preview: {error}",

        "settings_editor_apply": "Apply",
        "settings_editor_apply_help": "Tick rows to update.",
        "settings_editor_suggested_region": "Suggested region category",
        "settings_editor_suggested_region_help": "You can edit the suggestion before applying.",

        "settings_apply_selected_preview_rows": "Apply selected preview rows",
        "settings_clear_preview": "Clear preview",
        "settings_confirm_existing_region_apply": "I reviewed the preview and want to update existing site region categories",
        "settings_confirm_existing_region_apply_error": "Tick the confirmation checkbox before updating existing sites.",
        "settings_existing_sites_updated": "Updated region_category for {count} existing site row(s).",
        "settings_no_existing_sites_matched": "No existing sites matched the current preview mode.",

        "settings_section_database_maintenance": "Database maintenance",
        "settings_database_reset_warning": "Resetting the database deletes the local curation tables and recreates them. Use this only for testing or if you have a backup.",
        "settings_confirm_database_reset": "I understand this will reset the local curation database.",
        "settings_button_initialize_reset_database": "Initialize / reset database",
        "settings_database_reset_confirm_error": "Tick the confirmation checkbox before resetting the database.",
        "settings_database_initialized": "Database initialized successfully.",
    },
    "zh": {
        "app_title": "腐蚀地图数据管理工具",
        "app_caption": "用于管理腐蚀暴露站点、资料来源以及站点-资料关联的数据管理程序。",
        "language_label": "语言 / Language",
        "user_manual_button": "📘 使用手册",
        "manual_language": "手册语言",
        "logout": "退出登录",
        "navigation": "导航",

        "nav_dashboard": "数据看板",
        "nav_sources": "资料来源",
        "nav_sites": "暴露站点",
        "nav_corrosion_data": "腐蚀数据",
        "nav_environmental_data": "环境数据",
        "nav_manage_records": "数据管理",
        "nav_import": "导入",
        "nav_export_publish": "导出 / 发布",
        "nav_settings": "设置",

        "common_add_source": "添加资料来源",
        "common_add_site": "添加站点",
        "common_import_csv": "导入CSV文件",
        "common_open_public_map": "打开地图",
        "common_set_public_map_url": "设置公开地图网址",

        "dashboard_hero_eyebrow": "数据管理概览",
        "dashboard_hero_title": "腐蚀地图数据基础设施",
        "dashboard_hero_subtitle": "在一个数据总览面板中查看数据库、资料文件、发布状态以及腐蚀/环境观测数据图层。",

        "dashboard_status_backend": "数据库后端",
        "dashboard_status_github": "GitHub",
        "dashboard_status_public_map": "公开地图",
        "dashboard_status_import_draft": "导入CSV草稿",

        "dashboard_section_database_records": "数据库记录",
        "dashboard_section_source_documents": "资料文件",
        "dashboard_section_system_status": "系统状态",
        "dashboard_section_workflow": "工作流程",

        "dashboard_card_sites": "暴露站点",
        "dashboard_card_sites_hint": "已整理的暴露站点",
        "dashboard_card_sources": "资料来源",
        "dashboard_card_sources_hint": "已注册的资料来源文件",
        "dashboard_card_evidence_links": "站点数据支撑关联",
        "dashboard_card_evidence_links_hint": "站点-资料来源关系",
        "dashboard_card_corrosion_observations": "腐蚀观测数据",
        "dashboard_card_corrosion_observations_hint": "测量层级数据行",
        "dashboard_card_environmental_observations": "环境观测数据",
        "dashboard_card_environmental_observations_hint": "气候/环境数据行",

        "dashboard_card_pdf_files": "PDF 文件",
        "dashboard_card_pdf_files_hint": "在 source_pdfs/ 中检测到",
        "dashboard_card_unregistered_pdfs": "未注册 PDF",
        "dashboard_card_unregistered_pdfs_hint": "尚未写入 sources 表的文件",
        "dashboard_card_pdf_folder": "PDF 文件夹",
        "dashboard_card_pdf_folder_hint": "本地/公开资料文件目录",

        "dashboard_warning_noncanonical_pdfs": "部分 PDF 文件名不是规范的 `sNNN.pdf` 格式。注册前请先重命名。",
        "dashboard_expander_show_pdf_renames": "显示将被重命名的 PDF 文件",
        "dashboard_button_rename_pdfs": "将 PDF 重命名为规范 source-code 文件名",
        "dashboard_warning_missing_pdfs": "`source_pdfs/` 中有 {count} 个规范 PDF 文件尚未注册。请前往 Sources 页面注册。",
        "dashboard_success_all_pdfs_registered": "所有检测到的规范 PDF 均已注册为资料来源。",
        "dashboard_info_no_pdfs": "`source_pdfs/` 中暂未发现 PDF 文件。",

        "dashboard_card_backend": "数据库后端",
        "dashboard_card_backend_hint": "当前数据库状态",
        "dashboard_card_github_publish": "GitHub 发布",
        "dashboard_card_github_publish_hint": "数据集上传准备状态",
        "dashboard_card_public_map_url": "公开地图网址",
        "dashboard_card_import_draft": "导入CSV草稿",
        "dashboard_card_import_draft_hint": "未保存导入CSV预览的恢复状态",
        "dashboard_public_map_missing": "尚未配置网址",

        "dashboard_workflow_register_sources_title": "注册资料来源",
        "dashboard_workflow_register_sources_caption": "添加 PDF、标题、研究项目、金属材料和暴露时间。",
        "dashboard_workflow_add_sites_title": "添加暴露站点",
        "dashboard_workflow_add_sites_caption": "创建或合并带有坐标的暴露站点记录。",
        "dashboard_workflow_link_evidence_title": "站点数据支撑关联",
        "dashboard_workflow_link_evidence_caption": "将资料来源附加到某个站点，并保留对应元数据。",
        "dashboard_workflow_publish_title": "发布",
        "dashboard_workflow_publish_caption": "将已整理的数据导出并发布到公开网站数据集。",

        "status_ready": "就绪",
        "status_missing": "缺失",
        "status_not_configured": "未配置",
        "status_unknown": "未知",
        "status_available": "可用",
        "status_none": "无",
        "status_set": "已设置",

        "settings_title": "设置",
        "settings_caption": "数据库管理系统维护工具",

        "settings_section_paths": "路径",
        "settings_database_backend": "数据库后端",
        "settings_database_backend_supabase": "SUPABASE",
        "settings_database_backend_sqlite": "本地 SQLite",
        "settings_database_file": "数据库文件",
        "settings_source_pdf_folder": "资料来源 PDF 文件夹",

        "settings_section_app_controls": "程序控制",
        "settings_button_refresh_app": "刷新程序",

        "settings_section_region_rules": "区域分类规则",
        "settings_region_rules_caption": "用于调整导入数据和数据管理页面中自动区域分类的设置。",

        "settings_distance_thresholds": "距海岸线距离阈值",
        "settings_marine_threshold_km": "Marine 阈值，km",
        "settings_coastal_threshold_km": "Coastal 阈值，km",
        "settings_near_coastal_threshold_km": "Near-coastal 阈值，km",

        "settings_latitude_rules": "基于纬度的极地与气候带规则",
        "settings_antarctic_latitude_max": "Antarctic：纬度 ≤",
        "settings_sub_antarctic_latitude_min": "Sub-Antarctic 下限纬度",
        "settings_sub_antarctic_latitude_max": "Sub-Antarctic 上限纬度",
        "settings_sub_arctic_latitude_min": "Sub-arctic：纬度 ≥",
        "settings_sub_arctic_latitude_max": "Sub-arctic 上限纬度",
        "settings_tropical_abs_latitude_max": "Tropical：|纬度| ≤",
        "settings_cold_abs_latitude_min": "Cold：|纬度| ≥",
        "settings_extreme_cold_abs_latitude_min": "Extreme cold：|纬度| ≥",

        "settings_semantic_rules": "语义标签规则",
        "settings_semantic_rules_caption": "每行输入一个正则表达式规则或国家/地区提示词。这些规则用于归类 Island、Industrial、Urban 和 Rural 等非距离标签是如何自动分类。",
        "settings_island_country_hints": "Island 国家/地区提示词",
        "settings_island_text_patterns": "Island 文本规则",
        "settings_industrial_text_patterns": "Industrial 文本规则",
        "settings_urban_text_patterns": "Urban 文本规则",
        "settings_rural_text_patterns": "Rural 文本规则",
        "settings_hot_arid_text_patterns": "Hot-arid 文本规则",

        "settings_save_region_rules": "保存规则，用于未来自动分类",
        "settings_reset_region_rules": "恢复默认规则",
        "settings_region_rules_saved": "区域分类规则已保存，并将用于未来自动分类。",
        "settings_region_rules_reset": "区域分类规则已恢复为默认值。",

        "settings_apply_rules_existing": "将规则应用到已有暴露站点",
        "settings_apply_rules_existing_warning": "建议流程：先预览，再应用到选定行。最安全的批量操作是只填充 region_category 为空的站点。",
        "settings_existing_preview_mode": "已有站点预览模式",
        "settings_preview_mode_empty_only": "仅 region_category 为空的站点",
        "settings_preview_mode_all_sites": "所有站点，并保留未被替换维度中的人工标签",
        "settings_preview_existing_sites": "预览对已有站点的影响",
        "settings_preview_build_error": "无法生成区域分类预览：{error}",

        "settings_editor_apply": "应用",
        "settings_editor_apply_help": "勾选需要更新的行。",
        "settings_editor_suggested_region": "建议区域分类",
        "settings_editor_suggested_region_help": "应用前可以手动修改建议结果。",

        "settings_apply_selected_preview_rows": "应用选定预览行",
        "settings_clear_preview": "清除预览",
        "settings_confirm_existing_region_apply": "我已检查预览结果，并确认要更新已有站点的区域分类",
        "settings_confirm_existing_region_apply_error": "更新已有站点前，请先勾选确认框。",
        "settings_existing_sites_updated": "已更新 {count} 个已有站点的 region_category。",
        "settings_no_existing_sites_matched": "当前预览模式下没有匹配的已有站点。",

        "settings_section_database_maintenance": "数据库维护",
        "settings_database_reset_warning": "重置数据库会删除本地数据整理表，并重新创建表结构。仅在测试或已有备份时使用。",
        "settings_confirm_database_reset": "我理解此操作将重置本地数据整理数据库。",
        "settings_button_initialize_reset_database": "初始化 / 重置数据库",
        "settings_database_reset_confirm_error": "重置数据库前，请先勾选确认框。",
        "settings_database_initialized": "数据库已成功重置。",
    },
}


def language_code(language_label: str | None) -> str:
    return LANGUAGE_LABEL_TO_CODE.get(str(language_label or "").strip(), "en")


def t(key: str, language: str = "en", **kwargs) -> str:
    text = TRANSLATIONS.get(language, {}).get(
        key,
        TRANSLATIONS["en"].get(key, key),
    )

    if kwargs:
        return text.format(**kwargs)

    return text