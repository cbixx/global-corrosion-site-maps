from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CURATOR_DIR = REPO_ROOT / "curator"

if str(CURATOR_DIR) not in sys.path:
    sys.path.insert(0, str(CURATOR_DIR))

from r2_storage import (
    build_source_pdf_object_key,
    generate_private_pdf_url,
    get_r2_config,
    get_r2_storage_usage,
    object_exists_in_r2,
    upload_file_to_r2,
)


def main() -> None:
    config = get_r2_config()

    print("R2 configuration loaded.")
    print(f"Bucket: {config['bucket_name']}")
    print(f"Endpoint: {config['endpoint_url']}")

    local_pdf = REPO_ROOT / "source_pdfs" / "s001.pdf"

    if not local_pdf.exists():
        raise FileNotFoundError(
            f"Test file not found: {local_pdf}. Choose another existing local PDF."
        )

    object_key = build_source_pdf_object_key("s001", local_pdf.name)

    print(f"Uploading: {local_pdf}")
    print(f"Object key: {object_key}")

    result = upload_file_to_r2(
        local_path=local_pdf,
        object_key=object_key,
    )

    print(f"Uploaded: {result}")

    exists = object_exists_in_r2(object_key)
    print(f"Object exists after upload: {exists}")

    signed_url = generate_private_pdf_url(object_key, expires_seconds=300)

    print("Generated 5-minute signed URL:")
    print(signed_url)

    usage = get_r2_storage_usage()
    print("Current source_pdfs/ usage:")
    print(usage)


if __name__ == "__main__":
    main()
