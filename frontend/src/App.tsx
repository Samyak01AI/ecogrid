/**
 * EcoGrid AI — Main Application
 * Orchestrates the map, sidebar controls, and explainability panel.
 */

import { useState, useEffect, useCallback } from 'react';
import type { GridData, MapLayer, BenefitWeights, OptimizeResponse, CellProperties, CellRecommendation } from './types';
import { fetchGrid, fetchInterventions, optimize } from './api';
import ControlPanel from './components/ControlPanel';
import MapView from './components/MapView';
import './App.css';

function App() {
  // --- Data State ---
  const [gridData, setGridData] = useState<GridData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Control State ---
  const [budget, setBudget] = useState(1000000); // ₹10L default
  const [weights, setWeights] = useState<BenefitWeights>({
    heat: 0.25,
    green: 0.25,
    connectivity: 0.25,
    pedestrian: 0.25,
  });
  const [activeLayer, setActiveLayer] = useState<MapLayer>('heat');

  // --- Optimization State ---
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResponse | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // --- Explainability State ---
  const [selectedCell, setSelectedCell] = useState<CellProperties | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState<CellRecommendation | null>(null);

  // Cell lookup for quick access
  const [cellLookup, setCellLookup] = useState<Map<string, CellProperties>>(new Map());

  // --- Load initial data ---
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [grid] = await Promise.all([
          fetchGrid(),
          fetchInterventions(), // Preload, not directly used but warms the cache
        ]);
        setGridData(grid);

        // Build lookup
        const lookup = new Map<string, CellProperties>();
        for (const feature of grid.features) {
          lookup.set(feature.properties.cell_id, feature.properties);
        }
        setCellLookup(lookup);

        setError(null);
      } catch (err) {
        setError(`Failed to load data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // --- Run initial optimization once data is loaded ---
  useEffect(() => {
    if (gridData && !optimizeResult) {
      handleOptimize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridData]);

  // --- Optimization handler ---
  const handleOptimize = useCallback(async () => {
    try {
      setIsOptimizing(true);
      const result = await optimize({ budget, weights });
      setOptimizeResult(result);

      // Auto-switch to plan view after optimization
      setActiveLayer('plan');
    } catch (err) {
      setError(`Optimization failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsOptimizing(false);
    }
  }, [budget, weights]);

  // --- Cell click handler ---
  const handleCellClick = useCallback((cellId: string) => {
    const props = cellLookup.get(cellId);
    if (!props) return;

    setSelectedCell(props);

    // Find recommendation for this cell
    const rec = optimizeResult?.recommendations.find((r) => r.cell_id === cellId) || null;
    setSelectedRecommendation(rec);
  }, [cellLookup, optimizeResult]);

  const handleCloseExplain = useCallback(() => {
    setSelectedCell(null);
    setSelectedRecommendation(null);
  }, []);

  // --- Render ---
  if (loading) {
    return (
      <div className="app-layout">
        <header className="app-header">
          <h1>
            <span className="logo-icon">🌿</span>
            EcoGrid AI
            <span className="subtitle">Smart Urban Green Planner</span>
          </h1>
        </header>
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="loading-content">
            <div className="loading-spinner" />
            <div className="loading-text">Loading grid data...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !gridData) {
    return (
      <div className="app-layout">
        <header className="app-header">
          <h1>
            <span className="logo-icon">🌿</span>
            EcoGrid AI
          </h1>
        </header>
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div className="error-banner">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <h1>
          <span className="logo-icon">🌿</span>
          EcoGrid AI
          <span className="subtitle">Smart Urban Green Planner</span>
        </h1>
        <span className="header-badge">
          Pune, India · 10×10 Grid · {gridData?.features.length || 0} cells
        </span>
      </header>

      {/* Sidebar Controls */}
      <ControlPanel
        budget={budget}
        setBudget={setBudget}
        weights={weights}
        setWeights={setWeights}
        activeLayer={activeLayer}
        setActiveLayer={setActiveLayer}
        onOptimize={handleOptimize}
        isOptimizing={isOptimizing}
        result={optimizeResult}
      />

      {/* Map Area */}
      <MapView
        gridData={gridData}
        activeLayer={activeLayer}
        recommendations={optimizeResult?.recommendations || []}
        selectedCell={selectedCell}
        selectedRecommendation={selectedRecommendation}
        onCellClick={handleCellClick}
        onCloseExplain={handleCloseExplain}
      />

      {/* Error overlay */}
      {error && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
          <div className="error-banner">{error}</div>
        </div>
      )}
    </div>
  );
}

export default App;
