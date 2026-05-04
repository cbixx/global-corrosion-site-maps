from __future__ import annotations

import argparse
import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path
from statistics import mean


OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

DAILY_VARIABLES = [
    "temperature_2m_mean",
    "relative_humidity_2m_mean",
    "precipitation_sum",
    "wind_speed_10m_mean",
]

LAYER_DEFINITIONS = {
    "air_temperature": {
        "output": "air_temperature_annual_mean.json",
        "label": "Air temperature",
        "variable": "temperature_2m_mean",
        "aggregation": "annual_mean",
        "unit": "°C",
        "method": "mean",
    },
    "relative_humidity": {
        "output": "relative_humidity_annual_mean.json",
        "label": "Relative humidity",
        "variable": "relative_humidity_2m_mean",
        "aggregation": "annual_mean",
        "unit": "%",
        "method": "mean",
    },
    "precipitation": {
        "output": "precipitation_annual_sum.json",
        "label": "Precipitation",
        "variable": "precipitation_sum",
        "aggregation": "annual_sum",
        "unit": "mm/year",
        "method": "sum",
    },
    "wind_speed": {
        "output": "wind_speed_annual_mean.json",
        "label": "Wind speed",
        "variable": "wind_speed_10m_mean",
        "aggregation": "annual_mean",
        "unit": "m/s",
        "method": "mean",
    },
}


def build_grid(step: int) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []

    latitudes = list(range(-80, 81, step))
    longitudes = list(range(-180, 180, step))

    for lat in latitudes:
        for lon in longitudes:
            points.append((float(lat), float(lon)))

    return points


def fetch_daily_data(latitude: float, longitude: float, year: int) -> dict:
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": f"{year}-01-01",
        "end_date": f"{year}-12-31",
        "daily": ",".join(DAILY_VARIABLES),
        "temperature_unit": "celsius",
        "wind_speed_unit": "ms",
        "precipitation_unit": "mm",
        "timezone": "UTC",
    }

    url = f"{OPEN_METEO_ARCHIVE_URL}?{urllib.parse.urlencode(params)}"

    with urllib.request.urlopen(url, timeout=45) as response:
        return json.loads(response.read().decode("utf-8"))


def clean_numbers(values) -> list[float]:
    clean: list[float] = []

    for value in values or []:
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue

        if math.isfinite(number):
            clean.append(number)

    return clean


def aggregate_values(values: list[float], method: str) -> float | None:
    if not values:
        return None

    if method == "sum":
        return float(sum(values))

    return float(mean(values))


def write_layer(
    output_dir: Path,
    layer_key: str,
    layer_definition: dict,
    points: list[dict],
    year: int,
    grid_step: int,
) -> None:
    values = [point["value"] for point in points]

    layer_payload = {
        "metadata": {
            "layer_key": layer_key,
            "label": layer_definition["label"],
            "variable": layer_definition["variable"],
            "unit": layer_definition["unit"],
            "aggregation": layer_definition["aggregation"],
            "period": str(year),
            "period_start": f"{year}-01-01",
            "period_end": f"{year}-12-31",
            "source": "Open-Meteo Historical Weather API",
            "grid_step_degrees": grid_step,
            "note": (
                "Generated as a coarse gridded website layer. "
                "Use as environmental context, not as measured station data."
            ),
        },
        "min": min(values) if values else None,
        "max": max(values) if values else None,
        "values": points,
    }

    output_path = output_dir / layer_definition["output"]
    output_path.write_text(
        json.dumps(layer_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Wrote {output_path} with {len(points)} points.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=2025)
    parser.add_argument("--step", type=int, default=15)
    parser.add_argument("--sleep", type=float, default=0.15)
    parser.add_argument("--output-dir", default="data/map_layers")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    grid_points = build_grid(args.step)

    layer_points: dict[str, list[dict]] = {
        key: []
        for key in LAYER_DEFINITIONS
    }

    print(
        f"Generating climate layers for {args.year} "
        f"using {len(grid_points)} grid point(s), step={args.step}°."
    )

    for index, (lat, lon) in enumerate(grid_points, start=1):
        print(f"[{index}/{len(grid_points)}] lat={lat}, lon={lon}")

        try:
            data = fetch_daily_data(lat, lon, args.year)
        except Exception as exc:
            print(f"  skipped: request failed: {exc}")
            time.sleep(args.sleep)
            continue

        daily = data.get("daily", {})

        for layer_key, definition in LAYER_DEFINITIONS.items():
            variable = definition["variable"]
            method = definition["method"]

            values = clean_numbers(daily.get(variable, []))
            aggregated = aggregate_values(values, method)

            if aggregated is None:
                continue

            layer_points[layer_key].append(
                {
                    "lat": lat,
                    "lon": lon,
                    "value": round(aggregated, 3),
                }
            )

        time.sleep(args.sleep)

    for layer_key, definition in LAYER_DEFINITIONS.items():
        write_layer(
            output_dir=output_dir,
            layer_key=layer_key,
            layer_definition=definition,
            points=layer_points[layer_key],
            year=args.year,
            grid_step=args.step,
        )


if __name__ == "__main__":
    main()