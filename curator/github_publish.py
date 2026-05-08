from __future__ import annotations

import base64
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests


REPO_ROOT = Path(__file__).resolve().parents[1]
GITHUB_API_BASE_URL = "https://api.github.com"


@dataclass(frozen=True)
class GitHubPublishConfig:
    token: str
    owner: str
    repo: str
    branch: str


def _get_streamlit_secret(name: str) -> str:
    try:
        import streamlit as st

        value = st.secrets.get(name, "")
        return str(value).strip()
    except Exception:
        return ""


def _get_secret(name: str, default: str = "") -> str:
    return (
        os.environ.get(name, "").strip()
        or _get_streamlit_secret(name)
        or default
    ).strip()


def get_github_publish_config() -> GitHubPublishConfig:
    token = _get_secret("GITHUB_TOKEN")
    owner = _get_secret("GITHUB_REPO_OWNER")
    repo = _get_secret("GITHUB_REPO_NAME")
    branch = _get_secret("GITHUB_BRANCH", "main")

    missing = []

    if not token:
        missing.append("GITHUB_TOKEN")

    if not owner:
        missing.append("GITHUB_REPO_OWNER")

    if not repo:
        missing.append("GITHUB_REPO_NAME")

    if missing:
        raise RuntimeError(
            "Missing GitHub publish configuration: "
            + ", ".join(missing)
            + ". Set them as environment variables or Streamlit secrets."
        )

    return GitHubPublishConfig(
        token=token,
        owner=owner,
        repo=repo,
        branch=branch or "main",
    )


def get_github_config_summary() -> str:
    token_present = bool(_get_secret("GITHUB_TOKEN"))
    owner = _get_secret("GITHUB_REPO_OWNER")
    repo = _get_secret("GITHUB_REPO_NAME")
    branch = _get_secret("GITHUB_BRANCH", "main")

    return "\n".join(
        [
            f"GITHUB_TOKEN present: {token_present}",
            f"GITHUB_REPO_OWNER: {owner or '[missing]'}",
            f"GITHUB_REPO_NAME: {repo or '[missing]'}",
            f"GITHUB_BRANCH: {branch or '[missing]'}",
        ]
    )


class GitHubContentsClient:
    def __init__(self, config: GitHubPublishConfig):
        self.config = config

    @property
    def headers(self) -> dict[str, str]:
        return {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {self.config.token}",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    def _contents_url(self, repo_path: str) -> str:
        clean_path = repo_path.strip().lstrip("/")
        return (
            f"{GITHUB_API_BASE_URL}/repos/"
            f"{self.config.owner}/{self.config.repo}/contents/{clean_path}"
        )

    def get_file_info(self, repo_path: str) -> dict[str, Any] | None:
        response = requests.get(
            self._contents_url(repo_path),
            headers=self.headers,
            params={"ref": self.config.branch},
            timeout=30,
        )

        if response.status_code == 404:
            return None

        if not response.ok:
            raise RuntimeError(
                f"GitHub GET failed for {repo_path}: "
                f"{response.status_code} {response.text[:500]}"
            )

        payload = response.json()

        if payload.get("type") != "file":
            raise RuntimeError(f"GitHub path exists but is not a file: {repo_path}")

        return payload

    def get_existing_file_bytes(self, file_info: dict[str, Any]) -> bytes | None:
        content = str(file_info.get("content", "") or "")
        encoding = str(file_info.get("encoding", "") or "")

        if not content or encoding != "base64":
            return None

        compact_content = content.replace("\n", "")
        return base64.b64decode(compact_content.encode("utf-8"))

    def put_file(
        self,
        local_path: Path,
        repo_path: str,
        commit_message: str,
    ) -> dict[str, Any]:
        local_path = Path(local_path)

        if not local_path.exists():
            raise FileNotFoundError(f"Local file does not exist: {local_path}")

        file_bytes = local_path.read_bytes()
        file_info = self.get_file_info(repo_path)

        sha = None
        action = "created"

        if file_info is not None:
            sha = str(file_info.get("sha", "") or "")
            existing_bytes = self.get_existing_file_bytes(file_info)

            if existing_bytes == file_bytes:
                return {
                    "ok": True,
                    "path": repo_path,
                    "action": "skipped",
                    "message": f"No GitHub update needed for {repo_path}; content is unchanged.",
                    "html_url": str(file_info.get("html_url", "") or ""),
                }

            action = "updated"

        encoded_content = base64.b64encode(file_bytes).decode("utf-8")

        payload: dict[str, Any] = {
            "message": commit_message,
            "content": encoded_content,
            "branch": self.config.branch,
        }

        if sha:
            payload["sha"] = sha

        response = requests.put(
            self._contents_url(repo_path),
            headers=self.headers,
            json=payload,
            timeout=30,
        )

        if not response.ok:
            raise RuntimeError(
                f"GitHub PUT failed for {repo_path}: "
                f"{response.status_code} {response.text[:1000]}"
            )

        result = response.json()

        return {
            "ok": True,
            "path": repo_path,
            "action": action,
            "message": f"{repo_path} {action} on GitHub.",
            "html_url": str(result.get("content", {}).get("html_url", "") or ""),
            "commit_sha": str(result.get("commit", {}).get("sha", "") or ""),
        }


def repo_path_from_local_path(local_path: Path) -> str:
    local_path = Path(local_path).resolve()

    try:
        return local_path.relative_to(REPO_ROOT).as_posix()
    except ValueError as exc:
        raise ValueError(
            f"File must be inside repository root. File: {local_path}; repo root: {REPO_ROOT}"
        ) from exc


def publish_files_to_github(
    live_path: str | Path,
    batch_path: str | Path,
    commit_message: str,
    extra_paths: list[str | Path] | None = None,
) -> dict[str, Any]:
    config = get_github_publish_config()
    client = GitHubContentsClient(config)

    publish_paths = [
        Path(live_path),
        Path(batch_path),
    ]

    if extra_paths:
        for extra_path in extra_paths:
            publish_paths.append(Path(extra_path))

    # Avoid duplicate uploads while preserving order.
    unique_publish_paths: list[Path] = []
    seen_paths: set[str] = set()

    for path in publish_paths:
        resolved_key = str(path.resolve()).lower()

        if resolved_key in seen_paths:
            continue

        seen_paths.add(resolved_key)
        unique_publish_paths.append(path)

    uploads = []

    for local_path in unique_publish_paths:
        repo_path = repo_path_from_local_path(local_path)

        upload_result = client.put_file(
            local_path=local_path,
            repo_path=repo_path,
            commit_message=commit_message,
        )

        uploads.append(upload_result)

    output_lines = [
        f"Repository: {config.owner}/{config.repo}",
        f"Branch: {config.branch}",
        "",
    ]

    for upload in uploads:
        output_lines.append(
            f"- {upload['path']}: {upload['action']}"
        )

        if upload.get("html_url"):
            output_lines.append(f"  {upload['html_url']}")

        if upload.get("commit_sha"):
            output_lines.append(f"  commit: {upload['commit_sha']}")

    changed_count = sum(
        1 for upload in uploads
        if upload.get("action") in {"created", "updated"}
    )

    skipped_count = sum(
        1 for upload in uploads
        if upload.get("action") == "skipped"
    )

    return {
        "ok": True,
        "changed_count": changed_count,
        "skipped_count": skipped_count,
        "uploads": uploads,
        "message": (
            f"GitHub API publish completed. "
            f"Changed files: {changed_count}; unchanged files skipped: {skipped_count}."
        ),
        "output": "\n".join(output_lines),
    }

def publish_file_to_github(
    local_path: str | Path,
    commit_message: str | None = None,
    repo_path: str | None = None,
) -> dict[str, Any]:
    config = get_github_publish_config()
    client = GitHubContentsClient(config)

    local_path = Path(local_path)

    if repo_path is None:
        repo_path = repo_path_from_local_path(local_path)

    if commit_message is None:
        commit_message = f"Upload {repo_path}"

    upload_result = client.put_file(
        local_path=local_path,
        repo_path=repo_path,
        commit_message=commit_message,
    )

    output_lines = [
        f"Repository: {config.owner}/{config.repo}",
        f"Branch: {config.branch}",
        "",
        f"- {upload_result['path']}: {upload_result['action']}",
    ]

    if upload_result.get("html_url"):
        output_lines.append(f"  {upload_result['html_url']}")

    if upload_result.get("commit_sha"):
        output_lines.append(f"  commit: {upload_result['commit_sha']}")

    return {
        "ok": True,
        "changed_count": 0 if upload_result.get("action") == "skipped" else 1,
        "upload": upload_result,
        "message": f"GitHub PDF upload completed: {repo_path} {upload_result['action']}.",
        "output": "\n".join(output_lines),
    }