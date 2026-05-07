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