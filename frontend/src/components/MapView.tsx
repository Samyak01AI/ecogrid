/**
 * MapView — MapLibre GL JS map rendering the grid cells.
 * Handles cell coloring by active layer, click interactions, and tooltips.
 * 
 * Uses MapLibre v6 named exports (Map, NavigationControl, Popup).
 */

import { useRef, useEffect, useCallback } from 'react';
import { Map as MapLibreMap, NavigationControl, Popup } from 'maplibre-gl';
import type { GeoJSONSource, MapMouseEvent, MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GridData, GridFeature, MapLayer, CellRecommendation, CellProperties } from '../types';
import {
  getScoreColor,
  INTERVENTION_COLORS,
  UNSELECTED_COLOR,
  LAYER_PROPERTY_MAP,
} from '../colors';
import MapLegend from './MapLegend';
import ExplainPanel from './ExplainPanel';

interface MapViewProps {
  gridData: GridData | null;
  activeLayer: MapLayer;
  recommendations: CellRecommendation[];
  selectedCell: CellProperties | null;
  selectedRecommendation: CellRecommendation | null;
  onCellClick: (cellId: string) => void;
  onCloseExplain: () => void;
}

// Generate fill colors for each feature based on active layer and recommendations
function computeFillColors(
  gridData: GridData,
  activeLayer: MapLayer,
  recommendationMap: Map<string, CellRecommendation>
): Record<string, string> {
  const colors: Record<string, string> = {};

  for (const feature of gridData.features) {
    const props = feature.properties;
    const cellId = props.cell_id;

    if (activeLayer === 'plan') {
      const rec = recommendationMap.get(cellId);
      if (rec) {
        colors[cellId] = INTERVENTION_COLORS[rec.intervention_id] || UNSELECTED_COLOR;
      } else {
        colors[cellId] = UNSELECTED_COLOR;
      }
    } else {
      const propKey = LAYER_PROPERTY_MAP[activeLayer];
      const value = (props as unknown as Record<string, unknown>)[propKey] as number;
      colors[cellId] = getScoreColor(value, activeLayer);
    }
  }

  return colors;
}

export default function MapView({
  gridData,
  activeLayer,
  recommendations,
  selectedCell,
  selectedRecommendation,
  onCellClick,
  onCloseExplain,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  // Use refs to avoid stale closures in map event handlers
  const activeLayerRef = useRef(activeLayer);
  const onCellClickRef = useRef(onCellClick);
  const recommendationsRef = useRef(recommendations);

  activeLayerRef.current = activeLayer;
  onCellClickRef.current = onCellClick;
  recommendationsRef.current = recommendations;
  const mapLoadedRef = useRef(false);
  // Build recommendation lookup
  const buildRecMap = useCallback(() => {
    const map = new Map<string, CellRecommendation>();
    for (const rec of recommendations) {
      map.set(rec.cell_id, rec);
    }
    return map;
  }, [recommendations]);

  // Initialize map (only once)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [73.8567, 18.5204],
      zoom: 15,
      attributionControl: false,
    });

    map.addControl(new NavigationControl(), 'top-left');

    // Set up event handlers (use refs to avoid stale closures)
    map.on('load', () => {
      mapLoadedRef.current = true;
      // Click handler
      map.on('click', 'grid-fill', (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        if (e.features && e.features[0]) {
          const props = e.features[0].properties;
          if (props?.cell_id) {
            onCellClickRef.current(props.cell_id);
          }
        }
      });

      // Hover handlers
      map.on('mouseenter', 'grid-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'grid-fill', () => {
        map.getCanvas().style.cursor = '';
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
        if (map.getLayer('grid-highlight')) {
          map.setFilter('grid-highlight', ['==', 'cell_id', '']);
        }
      });

      map.on('mousemove', 'grid-fill', (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        if (e.features && e.features[0]) {
          const props = e.features[0].properties;
          if (map.getLayer('grid-highlight')) {
            map.setFilter('grid-highlight', ['==', 'cell_id', props?.cell_id || '']);
          }

          // Show tooltip popup
          if (popupRef.current) {
            popupRef.current.remove();
          }
          const popup = new Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 12,
          });

          const currentLayer = activeLayerRef.current;
          const propKey = LAYER_PROPERTY_MAP[currentLayer] || 'heat_score';
          const scoreValue = props?.[propKey] ?? 'N/A';

          // Build recommendation map from current refs
          const recMap = new Map<string, CellRecommendation>();
          for (const rec of recommendationsRef.current) {
            recMap.set(rec.cell_id, rec);
          }
          const rec = recMap.get(props?.cell_id || '');

          let html = `<div class="popup-cell-id">${props?.cell_id}</div>`;
          html += `<div class="popup-land-use">${(props?.land_use || '').replace('_', ' ')}</div>`;

          if (currentLayer === 'plan' && rec) {
            html += `<div style="font-size:0.8rem;font-weight:600;color:#059669">${rec.intervention_name}</div>`;
          } else {
            html += `<div class="popup-scores">`;
            html += `<div class="popup-score-row"><span class="popup-score-label">Score:</span><span class="popup-score-value">${typeof scoreValue === 'number' ? Number(scoreValue).toFixed(2) : scoreValue}</span></div>`;
            html += `</div>`;
          }

          popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
          popupRef.current = popup;
        }
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Add/update grid data and colors when gridData, activeLayer, or recommendations change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !gridData) return;

    const updateGrid = () => {
      // Compute colors
      const recMap = buildRecMap();
      const colors = computeFillColors(gridData, activeLayer, recMap);

      // Create GeoJSON with colors baked into properties
      const coloredData = {
        type: 'FeatureCollection' as const,
        features: gridData.features.map((f: GridFeature) => ({
          ...f,
          properties: {
            ...f.properties,
            _fillColor: colors[f.properties.cell_id] || UNSELECTED_COLOR,
          },
        })),
      };

      if (map.getSource('grid')) {
        // Update existing source
        (map.getSource('grid') as GeoJSONSource).setData(coloredData);
      } else {
        // Add source and layers for the first time
        map.addSource('grid', {
          type: 'geojson',
          data: coloredData,
        });

        map.addLayer({
          id: 'grid-fill',
          type: 'fill',
          source: 'grid',
          paint: {
            'fill-color': ['get', '_fillColor'],
            'fill-opacity': 0.8,
          },
        });

        map.addLayer({
          id: 'grid-outline',
          type: 'line',
          source: 'grid',
          paint: {
            'line-color': 'rgba(255,255,255,0.6)',
            'line-width': 1.5,
          },
        });

        map.addLayer({
          id: 'grid-highlight',
          type: 'line',
          source: 'grid',
          paint: {
            'line-color': '#ffffff',
            'line-width': 3,
          },
          filter: ['==', 'cell_id', ''],
        });
      }
    };

    const tryUpdate = () => {
      if (mapLoadedRef.current) {
        updateGrid();
      } else {
        map.once('load', updateGrid); // safe now: only attached if truly not loaded yet
      }
    };
    tryUpdate();
  }, [gridData, activeLayer, recommendations, buildRecMap]);

  return (
    <div className="map-area">
      <div ref={mapContainerRef} className="map-container" />
      <MapLegend activeLayer={activeLayer} />
      {selectedCell && (
        <ExplainPanel
          cellProps={selectedCell}
          recommendation={selectedRecommendation}
          onClose={onCloseExplain}
        />
      )}
    </div>
  );
}
