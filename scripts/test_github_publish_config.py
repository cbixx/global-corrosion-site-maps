from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "curator"))

from github_publish import get_github_config_summary  # noqa: E402


def main() -> None:
    print(get_github_config_summary())


if __name__ == "__main__":
    main()