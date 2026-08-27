from __future__ import annotations

import json
from pathlib import Path

import shapefile

from db_supabase import get_connection


BASE_DIR = Path(__file__).resolve().parent

GEO_DIR = BASE_DIR / "geo_data" / "natural_earth"

LAND_SHP = GEO_DIR / "ne_10m_land.shp"
COASTLINE_SHP = GEO_DIR / "ne_10m_coastline.shp"

BATCH_SIZE = 50


def read_geometries(shp_path: Path):
    if not shp_path.exists():
        raise FileNotFoundError(
            f"Missing shapefile: {shp_path}"
        )

    reader = shapefile.Reader(str(shp_path))

    for shape in reader.shapes():
        geometry = getattr(
            shape,
            "__geo_interface__",
            None,
        )

        if geometry:
            yield geometry


def chunks(values, size: int):
    batch = []

    for value in values:
        batch.append(value)

        if len(batch) >= size:
            yield batch
            batch = []

    if batch:
        yield batch


def import_dataset(
    conn,
    *,
    table_name: str,
    shp_path: Path,
) -> int:
    if table_name not in {
        "land",
        "coastline",
    }:
        raise ValueError(
            "Unexpected geographic table."
        )

    inserted = 0

    print(f"Reading {shp_path.name}...")

    for batch_number, batch in enumerate(
        chunks(
            read_geometries(shp_path),
            BATCH_SIZE,
        ),
        start=1,
    ):
        payload = json.dumps(
            batch,
            separators=(",", ":"),
        )

        cursor = conn.execute(
            f"""
            insert into curator_geo.{table_name} (
                geom
            )
            select
                gis.ST_Force2D(
                    gis.ST_SetSRID(
                        gis.ST_GeomFromGeoJSON(
                            value::text
                        ),
                        4326
                    )
                )
            from jsonb_array_elements(
                ?::jsonb
            )
            """,
            (payload,),
        )

        if cursor.rowcount > 0:
            inserted += cursor.rowcount

        print(
            f"  batch {batch_number}: "
            f"{inserted} features"
        )

    return inserted


def main() -> None:
    print("Natural Earth -> Supabase PostGIS")
    print(f"Land: {LAND_SHP}")
    print(f"Coastline: {COASTLINE_SHP}")

    with get_connection() as conn:
        conn.execute(
            """
            truncate table
                curator_geo.land,
                curator_geo.coastline
            restart identity
            """
        )

        land_count = import_dataset(
            conn,
            table_name="land",
            shp_path=LAND_SHP,
        )

        coastline_count = import_dataset(
            conn,
            table_name="coastline",
            shp_path=COASTLINE_SHP,
        )

        conn.execute(
            "analyze curator_geo.land"
        )

        conn.execute(
            "analyze curator_geo.coastline"
        )

        conn.commit()

    print()
    print("Import complete.")
    print(f"Land features: {land_count}")
    print(
        f"Coastline features: {coastline_count}"
    )


if __name__ == "__main__":
    main()