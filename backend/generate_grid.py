"""
Synthetic Grid Generator for EcoGrid AI
========================================
Generates an N×N grid of square cells over a bounding box centered on Pune, India (~18.52°N, 73.85°E).
Each cell has environmental scores (heat, vegetation deficit, pedestrian exposure, connectivity potential)
generated with Gaussian-smoothed random noise for spatial correlation, plus land_use and feasibility.

Outputs: grid.json (GeoJSON FeatureCollection)
"""

import json
import random
import math
import os

# --- Configuration ---
N = 10  # Grid size (N×N)
CENTER_LAT = 18.5204
CENTER_LNG = 73.8567
CELL_SIZE_DEG = 0.001  # ~111m per cell at this latitude

# Bounding box
HALF = N / 2
MIN_LNG = CENTER_LNG - HALF * CELL_SIZE_DEG
MIN_LAT = CENTER_LAT - HALF * CELL_SIZE_DEG

random.seed(42)  # Reproducible results


def generate_raw_noise(n: int) -> list[list[float]]:
    """Generate n×n grid of random values in [0, 1]."""
    return [[random.random() for _ in range(n)] for _ in range(n)]


def gaussian_smooth(grid: list[list[float]], sigma: float = 1.5) -> list[list[float]]:
    """
    Apply a simple Gaussian blur to make neighboring cells correlated.
    This avoids the need for a Perlin noise library.
    """
    n = len(grid)
    kernel_radius = int(math.ceil(sigma * 2))
    # Build kernel
    kernel = {}
    total = 0.0
    for dy in range(-kernel_radius, kernel_radius + 1):
        for dx in range(-kernel_radius, kernel_radius + 1):
            w = math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))
            kernel[(dx, dy)] = w
            total += w
    for k in kernel:
        kernel[k] /= total

    result = [[0.0] * n for _ in range(n)]
    for r in range(n):
        for c in range(n):
            val = 0.0
            for (dx, dy), w in kernel.items():
                nr, nc = r + dy, c + dx
                if 0 <= nr < n and 0 <= nc < n:
                    val += grid[nr][nc] * w
                else:
                    # Mirror boundary
                    nr = max(0, min(n - 1, nr))
                    nc = max(0, min(n - 1, nc))
                    val += grid[nr][nc] * w
            result[r][c] = val
    return result


def normalize_grid(grid: list[list[float]]) -> list[list[float]]:
    """Normalize values to [0, 1] range."""
    flat = [v for row in grid for v in row]
    lo, hi = min(flat), max(flat)
    rng = hi - lo if hi > lo else 1.0
    return [[(v - lo) / rng for v in row] for row in grid]


def assign_land_use(row: int, col: int, n: int) -> str:
    """
    Assign land_use by simple zoning rules:
    - Edges → roadside
    - Center cluster (3×3 around center) → plaza
    - Scattered buildings (deterministic pattern)
    - Some green_space patches
    - Rest → sidewalk or open_land
    """
    center = n // 2
    # Edge cells
    if row == 0 or row == n - 1 or col == 0 or col == n - 1:
        return "roadside"
    # Center plaza cluster
    if abs(row - center) <= 1 and abs(col - center) <= 1:
        return "plaza"
    # Deterministic "buildings" — use a hash-like pattern
    hash_val = (row * 7 + col * 13) % 17
    if hash_val < 3:
        return "building"
    if hash_val < 5:
        return "green_space"
    if hash_val < 8:
        return "open_land"
    if hash_val < 11:
        return "sidewalk"
    return "open_land"


def cell_id(row: int, col: int) -> str:
    """Generate a human-readable cell ID like A01, B05, etc."""
    letter = chr(65 + row)  # A-J for 10 rows
    return f"{letter}{col + 1:02d}"


def generate_grid():
    # Generate smoothed noise for each score dimension
    heat_raw = normalize_grid(gaussian_smooth(generate_raw_noise(N), sigma=1.8))
    veg_raw = normalize_grid(gaussian_smooth(generate_raw_noise(N), sigma=1.5))
    ped_raw = normalize_grid(gaussian_smooth(generate_raw_noise(N), sigma=1.2))
    conn_raw = normalize_grid(gaussian_smooth(generate_raw_noise(N), sigma=2.0))

    features = []

    for row in range(N):
        for col in range(N):
            # Cell polygon (GeoJSON uses [lng, lat] order)
            sw_lng = MIN_LNG + col * CELL_SIZE_DEG
            sw_lat = MIN_LAT + row * CELL_SIZE_DEG
            ne_lng = sw_lng + CELL_SIZE_DEG
            ne_lat = sw_lat + CELL_SIZE_DEG

            polygon = {
                "type": "Polygon",
                "coordinates": [[
                    [sw_lng, sw_lat],
                    [ne_lng, sw_lat],
                    [ne_lng, ne_lat],
                    [sw_lng, ne_lat],
                    [sw_lng, sw_lat],  # Close the ring
                ]]
            }

            land_use = assign_land_use(row, col, N)

            # Feasibility: 0 for buildings, 0.6-1.0 otherwise
            if land_use == "building":
                feasibility = 0.0
            elif land_use == "green_space":
                feasibility = round(random.uniform(0.7, 1.0), 2)
            elif land_use == "plaza":
                feasibility = round(random.uniform(0.8, 1.0), 2)
            else:
                feasibility = round(random.uniform(0.6, 1.0), 2)

            # Boost heat score near center (urban heat island effect)
            dist_to_center = math.sqrt((row - N / 2) ** 2 + (col - N / 2) ** 2) / (N / 2)
            heat_boost = max(0, 0.3 * (1 - dist_to_center))
            heat_score = min(1.0, round(heat_raw[row][col] + heat_boost, 2))

            # Vegetation deficit: higher near roads, lower in green_space
            veg_adjust = 0.2 if land_use == "roadside" else (-0.3 if land_use == "green_space" else 0)
            vegetation_deficit = max(0.0, min(1.0, round(veg_raw[row][col] + veg_adjust, 2)))

            # Pedestrian exposure: higher near plazas, sidewalks
            ped_adjust = 0.25 if land_use in ("plaza", "sidewalk") else (-0.1 if land_use == "building" else 0)
            pedestrian_exposure = max(0.0, min(1.0, round(ped_raw[row][col] + ped_adjust, 2)))

            # Connectivity potential: higher near existing green_space
            conn_adjust = 0.3 if land_use == "green_space" else 0
            connectivity_potential = max(0.0, min(1.0, round(conn_raw[row][col] + conn_adjust, 2)))

            feature = {
                "type": "Feature",
                "geometry": polygon,
                "properties": {
                    "cell_id": cell_id(row, col),
                    "row": row,
                    "col": col,
                    "heat_score": heat_score,
                    "vegetation_deficit": vegetation_deficit,
                    "pedestrian_exposure": pedestrian_exposure,
                    "connectivity_potential": connectivity_potential,
                    "feasibility": feasibility,
                    "land_use": land_use,
                }
            }
            features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "features": features
    }

    return geojson


if __name__ == "__main__":
    grid = generate_grid()

    output_path = os.path.join(os.path.dirname(__file__), "grid.json")
    with open(output_path, "w") as f:
        json.dump(grid, f, indent=2)

    # Summary
    features = grid["features"]
    land_uses = {}
    for feat in features:
        lu = feat["properties"]["land_use"]
        land_uses[lu] = land_uses.get(lu, 0) + 1

    print(f"[OK] Generated {len(features)} cells ({N}x{N} grid)")
    print(f"   Center: {CENTER_LAT}N, {CENTER_LNG}E")
    print(f"   Cell size: ~{CELL_SIZE_DEG * 111_000:.0f}m x {CELL_SIZE_DEG * 111_000:.0f}m")
    print(f"\n   Land use distribution:")
    for lu, count in sorted(land_uses.items()):
        print(f"     {lu}: {count}")

    # Score ranges
    for score_key in ["heat_score", "vegetation_deficit", "pedestrian_exposure", "connectivity_potential", "feasibility"]:
        vals = [f["properties"][score_key] for f in features]
        print(f"   {score_key}: min={min(vals):.2f}, max={max(vals):.2f}, avg={sum(vals)/len(vals):.2f}")

    print(f"\n   Output: {output_path}")
