/**
 * MapView — Leaflet map rendering the 10×10 grid cells.
 * Handles cell coloring by active layer, click interactions, and tooltips.
 *
 * Uses Leaflet with explicit L.Polygon layers for each grid cell, managed
 * in a single FeatureGroup. This approach is fully deterministic across
 * development and production builds — no WebGL, Web Workers, or style
 * expression evaluation that could break during Rollup bundling.
 */

import { useRef, useEffect, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GridData, MapLayer, CellRecommendation, CellProperties } from '../types';
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

// ─── Data Layer: compute fill colors for each cell ───────────────────────────
// This function is unchanged from the original — it maps grid data + active
// layer + recommendations into a cell_id → color lookup.
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

// ─── Visualization Layer: Leaflet map + grid polygons ─────────────────────────
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
  const mapRef = useRef<L.Map | null>(null);
  const gridLayerRef = useRef<L.FeatureGroup | null>(null);

  // Use refs to avoid stale closures in Leaflet event handlers
  const activeLayerRef = useRef(activeLayer);
  const onCellClickRef = useRef(onCellClick);
  const recommendationsRef = useRef(recommendations);

  activeLayerRef.current = activeLayer;
  onCellClickRef.current = onCellClick;
  recommendationsRef.current = recommendations;

  // Build recommendation lookup
  const buildRecMap = useCallback(() => {
    const map = new Map<string, CellRecommendation>();
    for (const rec of recommendations) {
      map.set(rec.cell_id, rec);
    }
    return map;
  }, [recommendations]);

  // ── Initialize map (only once) ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    console.log('[EcoGrid] Initializing Leaflet map...');

    let resizeObserver: ResizeObserver | null = null;

    try {
      const map = L.map(mapContainerRef.current, {
        center: [18.5204, 73.8567],
        zoom: 15,
        zoomControl: false,
        attributionControl: true,
      });

      // Add zoom control to top-left (matching original position)
      L.control.zoom({ position: 'topleft' }).addTo(map);

      // Add OpenStreetMap tiles (same source as before)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Create the dedicated grid layer group (empty initially)
      const gridLayer = L.featureGroup().addTo(map);
      gridLayerRef.current = gridLayer;
      mapRef.current = map;

      // CSS Grid layout is not finalized at mount time.
      // Use double-RAF: first RAF = browser has calculated layout,
      // second RAF = browser has painted, so the container has its real px size.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize({ animate: false });
          }
        });
      });

      // Keep Leaflet in sync whenever the container element changes size
      const container = mapContainerRef.current;
      resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize({ animate: false });
        }
      });
      resizeObserver.observe(container);

      console.log('[EcoGrid] Map initialized successfully');
    } catch (err) {
      console.error('[EcoGrid] Failed to initialize map:', err);
    }

    return () => {
      // Disconnect ResizeObserver BEFORE removing the map
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        gridLayerRef.current = null;
      }
    };
  }, []);

  // ── Build/update grid polygons when data, layer, or recommendations change ──
  useEffect(() => {
    const map = mapRef.current;
    const gridLayer = gridLayerRef.current;
    if (!map || !gridLayer || !gridData) return;

    console.log(
      `[EcoGrid] Rebuilding grid: ${gridData.features.length} cells, layer="${activeLayer}"`
    );

    try {
      // Clear all existing grid polygons (safe — only affects this FeatureGroup)
      gridLayer.clearLayers();

      // Compute colors for each cell
      const recMap = buildRecMap();
      const colors = computeFillColors(gridData, activeLayer, recMap);

      let cellCount = 0;

      for (const feature of gridData.features) {
        const props = feature.properties;
        const cellId = props.cell_id;
        const fillColor = colors[cellId] || UNSELECTED_COLOR;

        // Convert GeoJSON [lng, lat] coordinates to Leaflet [lat, lng]
        const coords = feature.geometry.coordinates[0];
        if (!coords || coords.length < 4) {
          console.warn(`[EcoGrid] Skipping cell ${cellId}: invalid coordinates`);
          continue;
        }

        const latLngs: L.LatLngExpression[] = coords.map(
          (coord: number[]) => [coord[1], coord[0]] as L.LatLngTuple
        );

        // Create polygon for this cell
        const polygon = L.polygon(latLngs, {
          fillColor: fillColor,
          fillOpacity: 0.8,
          color: 'rgba(255,255,255,0.6)',
          weight: 1.5,
        });

        // ── Click handler ──
        polygon.on('click', () => {
          console.log(`[EcoGrid] Cell clicked: ${cellId}`);
          onCellClickRef.current(cellId);
        });

        // ── Hover: use Leaflet's built-in tooltip (doesn't intercept clicks) ──
        const buildTooltipContent = (): string => {
          const currentLayer = activeLayerRef.current;
          const propKey = LAYER_PROPERTY_MAP[currentLayer] || 'heat_score';
          const scoreValue = (props as unknown as Record<string, unknown>)[propKey] ?? 'N/A';

          const currentRecMap = new Map<string, CellRecommendation>();
          for (const rec of recommendationsRef.current) {
            currentRecMap.set(rec.cell_id, rec);
          }
          const rec = currentRecMap.get(cellId);

          let html = `<div class="popup-cell-id">${cellId}</div>`;
          html += `<div class="popup-land-use">${(props.land_use || '').replace('_', ' ')}</div>`;

          if (currentLayer === 'plan' && rec) {
            html += `<div style="font-size:0.8rem;font-weight:600;color:#059669">${rec.intervention_name}</div>`;
          } else {
            html += `<div class="popup-scores">`;
            html += `<div class="popup-score-row"><span class="popup-score-label">Score:</span><span class="popup-score-value">${typeof scoreValue === 'number' ? Number(scoreValue).toFixed(2) : scoreValue}</span></div>`;
            html += `</div>`;
          }
          return html;
        };

        polygon.bindTooltip(buildTooltipContent, {
          sticky: true,
          direction: 'top',
          offset: L.point(0, -12),
          className: 'ecogrid-popup',
        });

        // ── Hover highlight ──
        polygon.on('mouseover', (e: L.LeafletMouseEvent) => {
          const target = e.target as L.Polygon;
          target.setStyle({
            color: '#ffffff',
            weight: 3,
          });
          target.bringToFront();
        });

        polygon.on('mouseout', (e: L.LeafletMouseEvent) => {
          const target = e.target as L.Polygon;
          target.setStyle({
            color: 'rgba(255,255,255,0.6)',
            weight: 1.5,
          });
        });

        // Cursor styling
        polygon.on('mouseover', () => {
          if (mapContainerRef.current) {
            mapContainerRef.current.style.cursor = 'pointer';
          }
        });
        polygon.on('mouseout', () => {
          if (mapContainerRef.current) {
            mapContainerRef.current.style.cursor = '';
          }
        });

        polygon.addTo(gridLayer);
        cellCount++;
      }

      console.log(`[EcoGrid] Grid rendered: ${cellCount} cells`);

      if (cellCount !== 100) {
        console.warn(
          `[EcoGrid] Expected 100 cells but rendered ${cellCount}. ` +
            `Grid data has ${gridData.features.length} features.`
        );
      }
    } catch (err) {
      console.error('[EcoGrid] Failed to render grid:', err);
    }
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
