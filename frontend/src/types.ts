/**
 * EcoGrid AI — Shared Type Definitions
 * Matches the backend data model from the spec.
 */

export interface CellProperties {
  cell_id: string;
  row: number;
  col: number;
  heat_score: number;
  vegetation_deficit: number;
  pedestrian_exposure: number;
  connectivity_potential: number;
  feasibility: number;
  land_use: 'sidewalk' | 'plaza' | 'roadside' | 'open_land' | 'building' | 'green_space';
}

export interface GridFeature {
  type: 'Feature';
  geometry: GeoJSON.Polygon;
  properties: CellProperties;
}

export interface GridData {
  type: 'FeatureCollection';
  features: GridFeature[];
}

export interface BenefitWeights {
  heat: number;
  green: number;
  connectivity: number;
  pedestrian: number;
}

export interface Intervention {
  id: string;
  name: string;
  cost_per_unit: number;
  min_feasibility: number;
  benefit_weights: BenefitWeights;
  compatible_land_use: string[];
}

export interface OptimizeRequest {
  budget: number;
  weights: BenefitWeights;
}

export interface CellRecommendation {
  cell_id: string;
  intervention_id: string;
  intervention_name: string;
  cost: number;
  score_gain: number;
  reason: string;
  impact_breakdown: BenefitWeights;
}

export interface OptimizeResponse {
  recommendations: CellRecommendation[];
  total_cost: number;
  budget: number;
  total_impact: BenefitWeights;
  intervention_counts: Record<string, number>;
}

/** Layer toggle options for the map */
export type MapLayer = 'heat' | 'vegetation' | 'pedestrian' | 'connectivity' | 'plan';
