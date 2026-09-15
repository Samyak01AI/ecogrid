/**
 * EcoGrid AI — Color Utilities
 * Maps environmental scores and intervention types to colors.
 */

import type { MapLayer } from './types';

/** 
 * Interpolate between colors based on a 0-1 value.
 * Uses a gradient from cool (low) to hot (high) for each layer.
 */
export function getScoreColor(value: number, layer: MapLayer): string {
  const t = Math.max(0, Math.min(1, value));

  switch (layer) {
    case 'heat':
      // Blue → Yellow → Red
      if (t < 0.5) {
        const s = t * 2;
        return interpolateRGB([59, 130, 246], [250, 204, 21], s);
      } else {
        const s = (t - 0.5) * 2;
        return interpolateRGB([250, 204, 21], [239, 68, 68], s);
      }

    case 'vegetation':
      // Green → Brown/Red (higher = more deficit = worse)
      if (t < 0.5) {
        const s = t * 2;
        return interpolateRGB([34, 197, 94], [250, 204, 21], s);
      } else {
        const s = (t - 0.5) * 2;
        return interpolateRGB([250, 204, 21], [180, 83, 9], s);
      }

    case 'pedestrian':
      // Light blue → Orange → Red
      if (t < 0.5) {
        const s = t * 2;
        return interpolateRGB([147, 197, 253], [251, 146, 60], s);
      } else {
        const s = (t - 0.5) * 2;
        return interpolateRGB([251, 146, 60], [220, 38, 38], s);
      }

    case 'connectivity':
      // Gray → Purple (higher = more potential)
      if (t < 0.5) {
        const s = t * 2;
        return interpolateRGB([203, 213, 225], [167, 139, 250], s);
      } else {
        const s = (t - 0.5) * 2;
        return interpolateRGB([167, 139, 250], [109, 40, 217], s);
      }

    default:
      return `rgba(200, 200, 200, 0.6)`;
  }
}

function interpolateRGB(a: number[], b: number[], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const blue = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgba(${r}, ${g}, ${blue}, 0.75)`;
}

/** Colors for intervention types on the "plan" layer */
export const INTERVENTION_COLORS: Record<string, string> = {
  native_trees: 'rgba(22, 163, 74, 0.8)',      // Green
  pollinator_strip: 'rgba(234, 179, 8, 0.8)',   // Yellow
  shade_structure: 'rgba(249, 115, 22, 0.8)',   // Orange
  cool_surface: 'rgba(59, 130, 246, 0.8)',      // Blue
};

export const INTERVENTION_COLORS_SOLID: Record<string, string> = {
  native_trees: '#16a34a',
  pollinator_strip: '#eab308',
  shade_structure: '#f97316',
  cool_surface: '#3b82f6',
};

/** Unselected cell color on plan view */
export const UNSELECTED_COLOR = 'rgba(226, 232, 240, 0.5)';

/** Map each layer to the cell property it reads */
export const LAYER_PROPERTY_MAP: Record<string, string> = {
  heat: 'heat_score',
  vegetation: 'vegetation_deficit',
  pedestrian: 'pedestrian_exposure',
  connectivity: 'connectivity_potential',
};

export const LAYER_LABELS: Record<string, string> = {
  heat: 'Heat Intensity',
  vegetation: 'Vegetation Deficit',
  pedestrian: 'Pedestrian Exposure',
  connectivity: 'Connectivity Potential',
  plan: 'Recommended Plan',
};

export const INTERVENTION_LABELS: Record<string, string> = {
  native_trees: 'Native Trees',
  pollinator_strip: 'Pollinator Strip',
  shade_structure: 'Shade Structure',
  cool_surface: 'Cool Surface',
};

export const INTERVENTION_ICONS: Record<string, string> = {
  native_trees: '🌳',
  pollinator_strip: '🌸',
  shade_structure: '⛱️',
  cool_surface: '❄️',
};

/** Format INR currency */
export function formatINR(value: number): string {
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`;
  }
  return `₹${value.toLocaleString('en-IN')}`;
}

export function formatINRFull(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}
