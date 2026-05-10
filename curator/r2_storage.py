from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import boto3
from botocore.client import Config


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


def get_r2_config() -> dict[str, str]:
    account_id = _get_secret("R2_ACCOUNT_ID")
    bucket_name = _get_secret("R2_BUCKET_NAME")
    access_key_id = _get_secret("R2_ACCESS_KEY_ID")
    secret_access_key = _get_secret("R2_SECRET_ACCESS_KEY")
    endpoint_url = _get_secret("R2_ENDPOINT_URL")

    if not endpoint_url and account_id:
        endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"

    missing = []

    for name, value in {
        "R2_ACCOUNT_ID": account_id,
        "R2_BUCKET_NAME": bucket_name,
        "R2_ACCESS_KEY_ID": access_key_id,
        "R2_SECRET_ACCESS_KEY": secret_access_key,
        "R2_ENDPOINT_URL": endpoint_url,
    }.items():
        if not value:
            missing.append(name)

    if missing:
        raise RuntimeError(
            "Missing R2 configuration: "
            + ", ".join(missing)
            + ". Add these to .streamlit/secrets.toml or environment variables."
        )

    return {
        "account_id": account_id,
        "bucket_name": bucket_name,
        "access_key_id": access_key_id,
        "secret_access_key": secret_access_key,
        "endpoint_url": endpoint_url.rstrip("/"),
    }


def get_r2_client():
    config = get_r2_config()

    return boto3.client(
        "s3",
        endpoint_url=config["endpoint_url"],
        aws_access_key_id=config["access_key_id"],
        aws_secret_access_key=config["secret_access_key"],
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def get_r2_bucket_name() -> str:
    return get_r2_config()["bucket_name"]


def build_source_pdf_object_key(source_code: str, file_name: str | None = None) -> str:
    clean_code = str(source_code or "").strip().lower()
    clean_file_name = str(file_name or "").strip()

    if not clean_file_name:
        clean_file_name = f"{clean_code}.pdf"

    return f"source_pdfs/{clean_file_name}"


def upload_file_to_r2(
    local_path: str | Path,
    object_key: str,
    content_type: str = "application/pdf",
) -> dict[str, Any]:
    local_path = Path(local_path)

    if not local_path.exists():
        raise FileNotFoundError(f"Local file does not exist: {local_path}")

    client = get_r2_client()
    bucket_name = get_r2_bucket_name()

    extra_args = {}

    if content_type:
        extra_args["ContentType"] = content_type

    client.upload_file(
        Filename=str(local_path),
        Bucket=bucket_name,
        Key=object_key,
        ExtraArgs=extra_args,
    )

    return {
        "bucket": bucket_name,
        "object_key": object_key,
        "size_bytes": local_path.stat().st_size,
    }

def upload_bytes_to_r2(
    file_bytes: bytes,
    object_key: str,
    content_type: str = "application/pdf",
) -> dict[str, Any]:
    if not file_bytes:
        raise ValueError("No file bytes were provided for R2 upload.")

    client = get_r2_client()
    bucket_name = get_r2_bucket_name()

    extra_args = {}

    if content_type:
        extra_args["ContentType"] = content_type

    client.put_object(
        Bucket=bucket_name,
        Key=object_key,
        Body=file_bytes,
        **extra_args,
    )

    return {
        "bucket": bucket_name,
        "object_key": object_key,
        "size_bytes": len(file_bytes),
    }


def object_exists_in_r2(object_key: str) -> bool:
    client = get_r2_client()
    bucket_name = get_r2_bucket_name()

    try:
        client.head_object(Bucket=bucket_name, Key=object_key)
        return True
    except client.exceptions.ClientError as exc:
        status_code = int(exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode", 0))

        if status_code == 404:
            return False

        raise


def generate_private_pdf_url(object_key: str, expires_seconds: int = 900) -> str:
    client = get_r2_client()
    bucket_name = get_r2_bucket_name()

    return client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": bucket_name,
            "Key": object_key,
        },
        ExpiresIn=int(expires_seconds),
    )


def list_r2_objects(prefix: str = "source_pdfs/") -> list[dict[str, Any]]:
    client = get_r2_client()
    bucket_name = get_r2_bucket_name()

    paginator = client.get_paginator("list_objects_v2")

    objects: list[dict[str, Any]] = []

    for page in paginator.paginate(Bucket=bucket_name, Prefix=prefix):
        for item in page.get("Contents", []):
            objects.append(
                {
                    "key": str(item.get("Key", "")),
                    "size": int(item.get("Size", 0)),
                    "last_modified": item.get("LastModified"),
                }
            )

    return objects


def get_r2_storage_usage(prefix: str = "source_pdfs/") -> dict[str, Any]:
    objects = list_r2_objects(prefix=prefix)
    total_bytes = sum(int(item["size"]) for item in objects)

    return {
        "object_count": len(objects),
        "total_bytes": total_bytes,
        "total_mb": total_bytes / (1024 * 1024),
        "total_gb": total_bytes / (1024 * 1024 * 1024),
    }
