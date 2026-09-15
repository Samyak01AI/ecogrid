/**
 * MapLegend — Shows color scale for the current layer or intervention colors for plan view.
 */

import type { MapLayer } from '../types';
import { LAYER_LABELS, INTERVENTION_COLORS_SOLID, INTERVENTION_LABELS, INTERVENTION_ICONS } from '../colors';

interface MapLegendProps {
  activeLayer: MapLayer;
}

const LAYER_GRADIENTS: Record<string, string> = {
  heat: 'linear-gradient(90deg, rgba(59,130,246,0.8), rgba(250,204,21,0.8), rgba(239,68,68,0.8))',
  vegetation: 'linear-gradient(90deg, rgba(34,197,94,0.8), rgba(250,204,21,0.8), rgba(180,83,9,0.8))',
  pedestrian: 'linear-gradient(90deg, rgba(147,197,253,0.8), rgba(251,146,60,0.8), rgba(220,38,38,0.8))',
  connectivity: 'linear-gradient(90deg, rgba(203,213,225,0.8), rgba(167,139,250,0.8), rgba(109,40,217,0.8))',
};

const LAYER_LOW_LABELS: Record<string, string> = {
  heat: 'Cool',
  vegetation: 'Green',
  pedestrian: 'Low Exposure',
  connectivity: 'Low Potential',
};

const LAYER_HIGH_LABELS: Record<string, string> = {
  heat: 'Hot',
  vegetation: 'Deficit',
  pedestrian: 'High Exposure',
  connectivity: 'High Potential',
};

export default function MapLegend({ activeLayer }: MapLegendProps) {
  if (activeLayer === 'plan') {
    return (
      <div className="map-legend">
        <h4>Recommended Plan</h4>
        {Object.entries(INTERVENTION_LABELS).map(([id, label]) => (
          <div className="legend-item" key={id}>
            <div
              className="legend-color"
              style={{ background: INTERVENTION_COLORS_SOLID[id] }}
            />
            <span>{INTERVENTION_ICONS[id]} {label}</span>
          </div>
        ))}
        <div className="legend-item" style={{ marginTop: 4 }}>
          <div
            className="legend-color"
            style={{ background: 'rgba(226, 232, 240, 0.6)' }}
          />
          <span>No intervention</span>
        </div>
      </div>
    );
  }

  return (
    <div className="map-legend">
      <h4>{LAYER_LABELS[activeLayer]}</h4>
      <div
        className="legend-gradient"
        style={{ background: LAYER_GRADIENTS[activeLayer] }}
      />
      <div className="legend-labels">
        <span>{LAYER_LOW_LABELS[activeLayer]}</span>
        <span>{LAYER_HIGH_LABELS[activeLayer]}</span>
      </div>
    </div>
  );
}
