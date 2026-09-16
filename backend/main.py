"""
EcoGrid AI — FastAPI Backend
==============================
Serves the grid data, intervention catalog, and optimization engine.
All data is in-memory (loaded from grid.json at startup).
"""

import json
import os
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(title="EcoGrid AI", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------
GRID_PATH = os.path.join(os.path.dirname(__file__), "grid.json")

with open(GRID_PATH, "r") as f:
    GRID_DATA: dict = json.load(f)

# Build a lookup by cell_id for fast access
CELL_LOOKUP: dict[str, dict] = {}
for feature in GRID_DATA["features"]:
    cid = feature["properties"]["cell_id"]
    CELL_LOOKUP[cid] = feature

# ---------------------------------------------------------------------------
# Intervention catalog (hardcoded for the prototype)
# ---------------------------------------------------------------------------
# Cost values in INR (Indian Rupees). Tuned so that a full 10x10 grid is
# approximately in the 5-20 lakh range, making the budget slider meaningful.
INTERVENTIONS = [
    {
        "id": "native_trees",
        "name": "Native Trees",
        "cost_per_unit": 25000,
        "min_feasibility": 0.5,
        "benefit_weights": {
            "heat": 0.8,
            "green": 0.9,
            "connectivity": 0.7,
            "pedestrian": 0.5,
        },
        "compatible_land_use": ["sidewalk", "plaza", "roadside", "open_land", "green_space"],
    },
    {
        "id": "pollinator_strip",
        "name": "Pollinator Strip",
        "cost_per_unit": 12000,
        "min_feasibility": 0.4,
        "benefit_weights": {
            "heat": 0.3,
            "green": 1.0,
            "connectivity": 0.9,
            "pedestrian": 0.2,
        },
        "compatible_land_use": ["open_land", "green_space", "roadside"],
    },
    {
        "id": "shade_structure",
        "name": "Shade Structure",
        "cost_per_unit": 45000,
        "min_feasibility": 0.6,
        "benefit_weights": {
            "heat": 0.7,
            "green": 0.1,
            "connectivity": 0.2,
            "pedestrian": 0.9,
        },
        "compatible_land_use": ["sidewalk", "plaza", "roadside"],
    },
    {
        "id": "cool_surface",
        "name": "Cool / Reflective Surface",
        "cost_per_unit": 18000,
        "min_feasibility": 0.3,
        "benefit_weights": {
            "heat": 0.9,
            "green": 0.0,
            "connectivity": 0.1,
            "pedestrian": 0.6,
        },
        "compatible_land_use": ["sidewalk", "plaza", "roadside", "open_land"],
    },
]

INTERVENTION_LOOKUP = {iv["id"]: iv for iv in INTERVENTIONS}

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class OptimizeWeights(BaseModel):
    heat: float = 0.25
    green: float = 0.25
    connectivity: float = 0.25
    pedestrian: float = 0.25


class OptimizeRequest(BaseModel):
    budget: float = 1000000  # Default 10 lakh INR
    weights: OptimizeWeights = OptimizeWeights()


class CellRecommendation(BaseModel):
    cell_id: str
    intervention_id: str
    intervention_name: str
    cost: float
    score_gain: float
    reason: str
    impact_breakdown: dict[str, float]


class OptimizeResponse(BaseModel):
    recommendations: list[CellRecommendation]
    total_cost: float
    budget: float
    total_impact: dict[str, float]
    intervention_counts: dict[str, int]


# ---------------------------------------------------------------------------
# Optimization engine (greedy knapsack — see spec §6)
# ---------------------------------------------------------------------------
def compute_benefit(
    cell_props: dict,
    intervention: dict,
    weights: OptimizeWeights,
) -> tuple[float, dict[str, float]]:
    """
    Compute the weighted benefit of placing an intervention in a cell.
    Returns (total_benefit, breakdown_by_dimension).

    benefit = sum over dim of (user_weight[dim] * cell_score[dim] * intervention_benefit[dim])
    """
    # Map dimensions to their corresponding cell scores
    dim_to_cell_score = {
        "heat": cell_props["heat_score"],
        "green": cell_props["vegetation_deficit"],
        "connectivity": cell_props["connectivity_potential"],
        "pedestrian": cell_props["pedestrian_exposure"],
    }
    user_weights = {
        "heat": weights.heat,
        "green": weights.green,
        "connectivity": weights.connectivity,
        "pedestrian": weights.pedestrian,
    }

    breakdown = {}
    total = 0.0
    for dim in ["heat", "green", "connectivity", "pedestrian"]:
        contribution = (
            user_weights[dim]
            * dim_to_cell_score[dim]
            * intervention["benefit_weights"][dim]
        )
        breakdown[dim] = round(contribution, 4)
        total += contribution

    return round(total, 4), breakdown


def is_eligible(cell_props: dict, intervention: dict) -> bool:
    """Check if an intervention can be placed in a cell."""
    if cell_props["feasibility"] < intervention["min_feasibility"]:
        return False
    if cell_props["land_use"] not in intervention["compatible_land_use"]:
        return False
    return True


def generate_reason(cell_props: dict, intervention: dict, breakdown: dict) -> str:
    """Generate a human-readable explanation for why this intervention was chosen."""
    # Find the top contributing dimension
    top_dim = max(breakdown, key=breakdown.get)
    dim_labels = {
        "heat": "high heat intensity",
        "green": "high vegetation deficit",
        "connectivity": "strong connectivity potential",
        "pedestrian": "high pedestrian exposure",
    }
    dim_scores = {
        "heat": cell_props["heat_score"],
        "green": cell_props["vegetation_deficit"],
        "connectivity": cell_props["connectivity_potential"],
        "pedestrian": cell_props["pedestrian_exposure"],
    }

    parts = []
    parts.append(
        f"Cell has {dim_labels[top_dim]} ({dim_scores[top_dim]:.2f})"
    )
    parts.append(
        f"{intervention['name']} is highly effective for this condition "
        f"(benefit weight: {intervention['benefit_weights'][top_dim]:.1f})"
    )
    parts.append(
        f"Land use '{cell_props['land_use']}' is compatible; "
        f"feasibility score {cell_props['feasibility']:.2f}"
    )
    return ". ".join(parts) + "."


def run_greedy_optimizer(
    grid_features: list[dict],
    interventions: list[dict],
    budget: float,
    weights: OptimizeWeights,
) -> OptimizeResponse:
    """
    Greedy knapsack optimizer:
    1. For each (cell, eligible intervention), compute benefit_score / cost.
    2. Sort by value_per_cost descending.
    3. Greedily assign, skipping cells already assigned, until budget exhausted.
    """
    # Step 1: Build all eligible (cell, intervention) pairs with their value
    candidates = []
    for feature in grid_features:
        props = feature["properties"]
        for iv in interventions:
            if not is_eligible(props, iv):
                continue
            benefit, breakdown = compute_benefit(props, iv, weights)
            if benefit <= 0:
                continue
            value_per_cost = benefit / iv["cost_per_unit"]
            candidates.append({
                "cell_id": props["cell_id"],
                "intervention": iv,
                "benefit": benefit,
                "breakdown": breakdown,
                "value_per_cost": value_per_cost,
                "cell_props": props,
            })

    # Step 2: Sort by value_per_cost descending
    candidates.sort(key=lambda x: x["value_per_cost"], reverse=True)

    # Step 3: Greedy selection
    assigned_cells: set[str] = set()
    recommendations: list[CellRecommendation] = []
    total_cost = 0.0
    total_impact = {"heat": 0.0, "green": 0.0, "connectivity": 0.0, "pedestrian": 0.0}
    intervention_counts: dict[str, int] = {}

    for c in candidates:
        if c["cell_id"] in assigned_cells:
            continue
        cost = c["intervention"]["cost_per_unit"]
        if total_cost + cost > budget:
            continue

        assigned_cells.add(c["cell_id"])
        total_cost += cost

        iv = c["intervention"]
        intervention_counts[iv["id"]] = intervention_counts.get(iv["id"], 0) + 1

        for dim in total_impact:
            total_impact[dim] += c["breakdown"][dim]

        reason = generate_reason(c["cell_props"], iv, c["breakdown"])

        recommendations.append(CellRecommendation(
            cell_id=c["cell_id"],
            intervention_id=iv["id"],
            intervention_name=iv["name"],
            cost=cost,
            score_gain=c["benefit"],
            reason=reason,
            impact_breakdown=c["breakdown"],
        ))

    # Round total_impact values
    for dim in total_impact:
        total_impact[dim] = round(total_impact[dim], 4)

    return OptimizeResponse(
        recommendations=recommendations,
        total_cost=total_cost,
        budget=budget,
        total_impact=total_impact,
        intervention_counts=intervention_counts,
    )


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/grid")
def get_grid():
    """Return the full grid as GeoJSON FeatureCollection."""
    return GRID_DATA


@app.get("/api/interventions")
def get_interventions():
    """Return the intervention type catalog."""
    return {"interventions": INTERVENTIONS}


@app.post("/api/optimize", response_model=OptimizeResponse)
def optimize(req: OptimizeRequest):
    """
    Run the greedy optimizer with the given budget and priority weights.
    Returns the recommended plan.
    """
    return run_greedy_optimizer(
        grid_features=GRID_DATA["features"],
        interventions=INTERVENTIONS,
        budget=req.budget,
        weights=req.weights,
    )


@app.get("/api/plan/{cell_id}")
def get_cell_detail(cell_id: str):
    """
    Return detailed info for a specific cell.
    Used by the explainability panel.
    """
    if cell_id not in CELL_LOOKUP:
        raise HTTPException(status_code=404, detail=f"Cell {cell_id} not found")
    return CELL_LOOKUP[cell_id]
