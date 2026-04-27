from __future__ import annotations

from pathlib import Path
import subprocess


REPO_ROOT = Path(__file__).resolve().parents[1]

SAFE_WEBSITE_PATHS = [
    "data/sites.csv",
    "data/publish_batches",
]

OPTIONAL_SOURCE_PDF_PATH = "source_pdfs"

BLOCKED_PATHS = [
    "curator/curation.db",
]

BLOCKED_PREFIXES = [
    "curator/geo_data/",
    ".venv/",
    "__pycache__/",
]


def _run_git(args: list[str], timeout_seconds: int = 120) -> dict[str, object]:
    command = ["git", *args]

    try:
        completed = subprocess.run(
            command,
            cwd=REPO_ROOT,
            text=True,
            capture_output=True,
            timeout=timeout_seconds,
        )
    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "returncode": -1,
            "output": f"$ {' '.join(command)}\nCommand timed out after {timeout_seconds} seconds.",
        }
    except Exception as exc:
        return {
            "ok": False,
            "returncode": -1,
            "output": f"$ {' '.join(command)}\nCommand failed before execution: {exc}",
        }

    output_parts = [f"$ {' '.join(command)}"]

    if completed.stdout.strip():
        output_parts.append(completed.stdout.strip())

    if completed.stderr.strip():
        output_parts.append(completed.stderr.strip())

    return {
        "ok": completed.returncode == 0,
        "returncode": completed.returncode,
        "output": "\n".join(output_parts),
    }


def get_git_status_text() -> str:
    result = _run_git(["status", "--short"])

    output = str(result["output"])

    if result["ok"] and output.strip() == "$ git status --short":
        return "$ git status --short\nWorking tree clean."

    return output


def _is_blocked_path(path: str) -> bool:
    normalised = path.replace("\\", "/").strip()

    if normalised in BLOCKED_PATHS:
        return True

    return any(normalised.startswith(prefix) for prefix in BLOCKED_PREFIXES)


def commit_and_push_website_dataset(
    commit_message: str,
    include_source_pdfs: bool = False,
) -> dict[str, object]:
    commit_message = commit_message.strip() or "Update corrosion map website dataset"

    output_log: list[str] = []

    paths_to_add = list(SAFE_WEBSITE_PATHS)

    if include_source_pdfs:
        paths_to_add.append(OPTIONAL_SOURCE_PDF_PATH)

    add_result = _run_git(["add", "--", *paths_to_add])
    output_log.append(str(add_result["output"]))

    if not add_result["ok"]:
        return {
            "ok": False,
            "message": "Git add failed.",
            "output": "\n\n".join(output_log),
        }

    staged_result = _run_git(["diff", "--cached", "--name-only"])
    output_log.append(str(staged_result["output"]))

    if not staged_result["ok"]:
        return {
            "ok": False,
            "message": "Could not inspect staged files.",
            "output": "\n\n".join(output_log),
        }

    staged_files = [
        line.strip().replace("\\", "/")
        for line in str(staged_result["output"]).splitlines()
        if line.strip() and not line.strip().startswith("$ ")
    ]

    blocked_files = [path for path in staged_files if _is_blocked_path(path)]

    if blocked_files:
        reset_result = _run_git(["reset", "--", *blocked_files])
        output_log.append(str(reset_result["output"]))

        return {
            "ok": False,
            "message": (
                "Blocked unsafe file(s) from being committed: "
                + ", ".join(blocked_files)
            ),
            "output": "\n\n".join(output_log),
        }

    if not staged_files:
        return {
            "ok": True,
            "message": "No website dataset changes were staged; nothing to commit.",
            "output": "\n\n".join(output_log),
        }

    commit_result = _run_git(["commit", "-m", commit_message])
    output_log.append(str(commit_result["output"]))

    if not commit_result["ok"]:
        return {
            "ok": False,
            "message": "Git commit failed.",
            "output": "\n\n".join(output_log),
        }

    push_result = _run_git(["push"], timeout_seconds=180)
    output_log.append(str(push_result["output"]))

    if not push_result["ok"]:
        return {
            "ok": False,
            "message": "Git push failed. The commit may have been created locally but not pushed.",
            "output": "\n\n".join(output_log),
        }

    return {
        "ok": True,
        "message": "Website dataset committed and pushed successfully.",
        "output": "\n\n".join(output_log),
    }