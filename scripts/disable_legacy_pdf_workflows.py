from __future__ import annotations

from pathlib import Path

APP_PATH = Path("curator/app.py")
BACKUP_PATH = Path("curator/app_backup_before_disabling_pdf_workflows_20260508.py")

text = APP_PATH.read_text(encoding="utf-8")

if not BACKUP_PATH.exists():
    BACKUP_PATH.write_text(text, encoding="utf-8")

def replace_required(old: str, new: str, label: str) -> None:
    global text

    if old not in text:
        raise RuntimeError(f"Could not find required block: {label}")

    text = text.replace(old, new, 1)

def replace_optional(old: str, new: str) -> None:
    global text

    if old in text:
        text = text.replace(old, new, 1)

# ---------------------------------------------------------------------
# 1. Add feature flags
# ---------------------------------------------------------------------

if "LEGACY_LOCAL_PDF_WORKFLOW_ENABLED" not in text:
    replace_required(
        'SOURCE_PDF_RELATIVE_DIR = "source_pdfs"\n',
        'SOURCE_PDF_RELATIVE_DIR = "source_pdfs"\n\n'
        '# Legacy PDF workflows are disabled until private Cloudflare R2 storage is integrated.\n'
        'LEGACY_LOCAL_PDF_WORKFLOW_ENABLED = False\n'
        'GITHUB_PDF_UPLOAD_ENABLED = False\n',
        "source PDF feature flags",
    )

# ---------------------------------------------------------------------
# 2. Add Sources-page warning
# ---------------------------------------------------------------------

sources_page_header = (
    '    st.subheader(t("sources_title", ui_language))\n'
    '    st.caption(t("sources_caption", ui_language))\n'
)

sources_page_header_new = (
    '    st.subheader(t("sources_title", ui_language))\n'
    '    st.caption(t("sources_caption", ui_language))\n\n'
    '    if not LEGACY_LOCAL_PDF_WORKFLOW_ENABLED:\n'
    '        st.info(\n'
    '            "PDF upload/registration is temporarily disabled while private Cloudflare R2 storage is being prepared. "\n'
    '            "For now, enter source citation metadata, DOI/public URL, programme, metals, and exposure periods only."\n'
    '        )\n'
)

if (
    sources_page_header in text
    and "PDF upload/registration is temporarily disabled while private Cloudflare R2 storage is being prepared" not in text
):
    replace_required(
        sources_page_header,
        sources_page_header_new,
        "Sources page disabled-PDF warning",
    )

# ---------------------------------------------------------------------
# 3. Disable registration from local source_pdfs folder
# ---------------------------------------------------------------------

old_register_button = (
    '            if st.button(t("sources_register_missing_pdfs", ui_language)):\n'
)

new_register_button = (
    '            st.warning(\n'
    '                "Legacy local PDF registration is disabled while private PDF storage is being prepared."\n'
    '            )\n\n'
    '            if st.button(\n'
    '                t("sources_register_missing_pdfs", ui_language),\n'
    '                disabled=not LEGACY_LOCAL_PDF_WORKFLOW_ENABLED,\n'
    '                help="Legacy local PDF registration is disabled until private R2 storage is integrated.",\n'
    '            ):\n'
)

if old_register_button in text and "Legacy local PDF registration is disabled" not in text:
    replace_required(
        old_register_button,
        new_register_button,
        "disable register missing PDFs button",
    )

# ---------------------------------------------------------------------
# 4. Disable GitHub PDF upload button
# ---------------------------------------------------------------------

old_github_pdf_button = (
    '            if st.button(\n'
    '                t("sources_upload_selected_pdfs_github", ui_language),\n'
    '                key="upload_selected_source_pdfs_to_github",\n'
    '            ):\n'
)

new_github_pdf_button = (
    '            if st.button(\n'
    '                t("sources_upload_selected_pdfs_github", ui_language),\n'
    '                key="upload_selected_source_pdfs_to_github",\n'
    '                disabled=not GITHUB_PDF_UPLOAD_ENABLED,\n'
    '                help="Legacy GitHub PDF upload is disabled. Use private R2 storage after it is integrated.",\n'
    '            ):\n'
)

if old_github_pdf_button in text:
    replace_required(
        old_github_pdf_button,
        new_github_pdf_button,
        "disable GitHub PDF upload button",
    )

# ---------------------------------------------------------------------
# 5. Disable PDF upload in Add Source form
# ---------------------------------------------------------------------

old_add_source_pdf_block = (
    '        uploaded_pdf = st.file_uploader(\n'
    '            source_optional_label("sources_upload_source_pdf"),\n'
    '            type=["pdf"],\n'
    '            help=t("sources_upload_source_pdf_help", ui_language),\n'
    '            key="add_source_uploaded_pdf",\n'
    '        )\n\n'
    '        upload_source_pdf_to_github = st.checkbox(\n'
    '            source_optional_label("sources_upload_pdf_github_after_add"),\n'
    '            value=False,\n'
    '            help=t("sources_upload_pdf_github_after_add_help", ui_language),\n'
    '            key="upload_source_pdf_to_github_after_add",\n'
    '        )\n'
)

new_add_source_pdf_block = (
    '        uploaded_pdf = None\n'
    '        upload_source_pdf_to_github = False\n\n'
    '        st.info(\n'
    '            "PDF upload is temporarily disabled until private Cloudflare R2 storage is integrated. "\n'
    '            "Please add source metadata and public DOI/URL fields only for now."\n'
    '        )\n'
)

if old_add_source_pdf_block in text:
    replace_required(
        old_add_source_pdf_block,
        new_add_source_pdf_block,
        "disable Add Source PDF upload block",
    )

# ---------------------------------------------------------------------
# 6. Update English manual language
# ---------------------------------------------------------------------

replace_optional(
    "- PDF path or external URL;\n- notes.",
    "- public URL, DOI, and public citation metadata;\n- internal notes where needed.",
)

replace_optional(
    "- register existing PDFs from the `source_pdfs/` folder;",
    "- enter source citation metadata, DOI/public URLs, programme, metals, and exposure periods;",
)

replace_optional(
    "- PDF path or URL where available.",
    "- public URL or DOI landing page where available.",
)

replace_optional(
    "Important: in the online version, uploaded PDFs may not be permanently stored unless they are later committed to GitHub or moved to persistent storage. The database metadata is persistent, but the hosted file system should not be treated as permanent PDF storage.",
    "Important: PDF upload is temporarily disabled until private Cloudflare R2 storage is integrated. For now, store source citation metadata and public URLs in the database, and keep real PDFs in a private local archive.",
)

replace_optional(
    "- do not assume uploaded PDFs are permanently stored in the online app;",
    "- do not upload real PDFs until private Cloudflare R2 storage is enabled;",
)

# ---------------------------------------------------------------------
# 7. Update Chinese manual language
# ---------------------------------------------------------------------

replace_optional(
    "- PDF 路径或外部链接；",
    "- 公开 URL、DOI 和公开引用元数据；",
)

replace_optional(
    "- 注册 `source_pdfs/` 文件夹中已有的 PDF；",
    "- 输入资料来源的引用元数据、DOI/公开 URL、研究计划、金属材料和暴露时间；",
)

replace_optional(
    "- PDF 路径或外部链接，如有。",
    "- 公开 URL 或 DOI 页面，如有。",
)

replace_optional(
    "重要提示：在线版本中的 PDF 上传不一定是永久存储，除非之后将 PDF 提交到 GitHub 或转移到其他持久化存储。数据库中的文字元数据是持久的，但在线托管环境中的文件系统不应被视为永久 PDF 存储位置。",
    "重要提示：在 Cloudflare R2 等私有存储集成完成前，PDF 上传功能暂时禁用。目前请只在数据库中保存资料来源的引用元数据和公开 URL，并将真实 PDF 保存在私有本地档案中。",
)

replace_optional(
    "- 不要假设在线上传的 PDF 会永久保存；",
    "- 在 Cloudflare R2 等私有存储启用之前，不要上传真实 PDF；",
)

APP_PATH.write_text(text, encoding="utf-8")

print(f"Patched {APP_PATH}")
print(f"Backup saved to {BACKUP_PATH}")
