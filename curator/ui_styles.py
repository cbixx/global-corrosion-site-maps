from __future__ import annotations

import html

import streamlit as st


def escape_html(value) -> str:
    return html.escape(str(value or ""), quote=True)


def _safe_tone_class(tone: str) -> str:
    tone = str(tone or "").strip()
    if tone in {"good", "warn", "bad"}:
        return tone
    return ""


def inject_app_styles() -> None:
    st.markdown(
        """
        <style>
            .dashboard-hero {
                border: 1px solid #e5e7eb;
                border-radius: 18px;
                padding: 1.35rem 1.5rem;
                background: linear-gradient(135deg, #f8fafc 0%, #eef6ff 100%);
                margin-bottom: 1.2rem;
            }

            .dashboard-eyebrow {
                font-size: 0.78rem;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: #64748b;
                font-weight: 700;
                margin-bottom: 0.35rem;
            }

            .dashboard-title {
                font-size: 1.45rem;
                line-height: 1.2;
                font-weight: 800;
                color: #0f172a;
                margin-bottom: 0.35rem;
            }

            .dashboard-subtitle {
                font-size: 0.95rem;
                color: #64748b;
                max-width: 820px;
            }

            .dashboard-card {
                border: 1px solid #e5e7eb;
                border-radius: 16px;
                padding: 1rem 1.05rem;
                background: #ffffff;
                box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
                min-height: 112px;
                margin-bottom: 0.8rem;
            }

            .dashboard-card:hover {
                border-color: #cbd5e1;
                box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
                transition: 0.15s ease;
            }

            .dashboard-card-label {
                font-size: 0.78rem;
                color: #64748b;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.045em;
                margin-bottom: 0.45rem;
            }

            .dashboard-card-value {
                font-size: 2rem;
                line-height: 1.05;
                color: #0f172a;
                font-weight: 800;
                margin-bottom: 0.3rem;
            }

            .dashboard-card-hint {
                font-size: 0.82rem;
                color: #64748b;
            }

            .status-pill {
                display: inline-flex;
                align-items: center;
                gap: 0.38rem;
                border-radius: 999px;
                padding: 0.35rem 0.72rem;
                font-size: 0.82rem;
                font-weight: 700;
                border: 1px solid #dbeafe;
                background: #eff6ff;
                color: #1d4ed8;
                margin-right: 0.35rem;
                margin-bottom: 0.35rem;
            }

            .status-pill.good {
                border-color: #bbf7d0;
                background: #f0fdf4;
                color: #15803d;
            }

            .status-pill.warn {
                border-color: #fde68a;
                background: #fffbeb;
                color: #b45309;
            }

            .status-pill.bad {
                border-color: #fecaca;
                background: #fef2f2;
                color: #b91c1c;
            }

            .dashboard-section-title {
                font-size: 1rem;
                font-weight: 800;
                color: #0f172a;
                margin-top: 1.2rem;
                margin-bottom: 0.55rem;
            }

            .workflow-step {
                border: 1px solid #e5e7eb;
                border-radius: 14px;
                padding: 0.85rem 0.95rem;
                background: #ffffff;
                min-height: 88px;
            }

            .workflow-step-number {
                width: 1.55rem;
                height: 1.55rem;
                border-radius: 999px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                background: #eff6ff;
                color: #1d4ed8;
                font-weight: 800;
                font-size: 0.82rem;
                margin-bottom: 0.45rem;
            }

            .workflow-step-title {
                font-weight: 800;
                color: #0f172a;
                font-size: 0.9rem;
                margin-bottom: 0.15rem;
            }

            .workflow-step-caption {
                color: #64748b;
                font-size: 0.8rem;
                line-height: 1.35;
            }

            div[data-testid="stMetric"] {
                background: transparent;
            }

            div[data-testid="stMetric"] label {
                color: #64748b;
            }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_dashboard_card(label: str, value, hint: str = "") -> None:
    st.markdown(
        f"""
        <div class="dashboard-card">
            <div class="dashboard-card-label">{escape_html(label)}</div>
            <div class="dashboard-card-value">{escape_html(value)}</div>
            <div class="dashboard-card-hint">{escape_html(hint)}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_status_pill(label: str, value: str, tone: str = "") -> None:
    safe_tone = _safe_tone_class(tone)

    st.markdown(
        f"""
        <span class="status-pill {safe_tone}">
            {escape_html(label)}: {escape_html(value)}
        </span>
        """,
        unsafe_allow_html=True,
    )


def render_section_title(title: str) -> None:
    st.markdown(
        f'<div class="dashboard-section-title">{escape_html(title)}</div>',
        unsafe_allow_html=True,
    )


def render_workflow_step(number: str, title: str, caption: str) -> None:
    st.markdown(
        f"""
        <div class="workflow-step">
            <div class="workflow-step-number">{escape_html(number)}</div>
            <div class="workflow-step-title">{escape_html(title)}</div>
            <div class="workflow-step-caption">{escape_html(caption)}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )