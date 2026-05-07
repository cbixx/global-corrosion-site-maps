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