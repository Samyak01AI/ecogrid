/**
 * ControlPanel — Sidebar with budget slider, priority weights, layer toggle, and optimize button.
 */

import { useState } from 'react';
import type { MapLayer, BenefitWeights, OptimizeResponse } from '../types';
import { formatINR, formatINRFull, LAYER_LABELS, INTERVENTION_LABELS } from '../colors';

interface ControlPanelProps {
  budget: number;
  setBudget: (v: number) => void;
  weights: BenefitWeights;
  setWeights: (w: BenefitWeights) => void;
  activeLayer: MapLayer;
  setActiveLayer: (l: MapLayer) => void;
  onOptimize: () => void;
  isOptimizing: boolean;
  result: OptimizeResponse | null;
}

const LAYERS: MapLayer[] = ['heat', 'vegetation', 'pedestrian', 'connectivity', 'plan'];

export default function ControlPanel({
  budget,
  setBudget,
  weights,
  setWeights,
  activeLayer,
  setActiveLayer,
  onOptimize,
  isOptimizing,
  result,
}: ControlPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const updateWeight = (dim: keyof BenefitWeights, value: number) => {
    setWeights({ ...weights, [dim]: value });
  };

  const totalInterventions = result
    ? result.recommendations.length
    : 0;

  return (
    <div className="sidebar">
      {/* Layer Toggle */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="icon" style={{ background: '#ecfdf5' }}>🗺️</span>
            Map Layer
          </span>
        </div>
        <div className="layer-toggle">
          {LAYERS.map((layer) => (
            <button
              key={layer}
              className={`layer-btn ${activeLayer === layer ? 'active' : ''}`}
              onClick={() => setActiveLayer(layer)}
            >
              {LAYER_LABELS[layer]}
            </button>
          ))}
        </div>
      </div>

      {/* Budget Slider */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="icon budget">💰</span>
            Budget
          </span>
          <span className="slider-value budget">{formatINRFull(budget)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={2000000}
          step={10000}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>₹0</span>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>₹20,00,000</span>
        </div>
      </div>

      {/* Priority Weights */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="icon" style={{ background: '#f0fdf4' }}>⚖️</span>
            Priority Weights
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              color: '#94a3b8',
            }}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
        {expanded && (
          <div className="slider-group">
            <WeightSlider
              label="Heat Reduction"
              value={weights.heat}
              onChange={(v) => updateWeight('heat', v)}
              color="#ef4444"
              sliderClass="heat-slider"
            />
            <WeightSlider
              label="Green Coverage"
              value={weights.green}
              onChange={(v) => updateWeight('green', v)}
              color="#22c55e"
              sliderClass="green-slider"
            />
            <WeightSlider
              label="Connectivity"
              value={weights.connectivity}
              onChange={(v) => updateWeight('connectivity', v)}
              color="#8b5cf6"
              sliderClass="connect-slider"
            />
            <WeightSlider
              label="Pedestrian Comfort"
              value={weights.pedestrian}
              onChange={(v) => updateWeight('pedestrian', v)}
              color="#f59e0b"
              sliderClass="pedestrian-slider"
            />
          </div>
        )}
      </div>

      {/* Optimize Button */}
      <button
        className={`btn-optimize ${isOptimizing ? 'loading' : ''}`}
        onClick={onOptimize}
        disabled={isOptimizing}
      >
        {isOptimizing ? (
          <>
            <span className="spinner" />
            Optimizing...
          </>
        ) : (
          <>
            ⚡ Re-optimize
          </>
        )}
      </button>

      {/* Quick Summary Stats (mini dashboard in sidebar) */}
      {result && (
        <div className="card" style={{ padding: '16px' }}>
          <div className="card-header" style={{ marginBottom: 12 }}>
            <span className="card-title">
              <span className="icon" style={{ background: '#ecfdf5' }}>📊</span>
              Plan Summary
            </span>
          </div>

          {/* Budget usage bar */}
          <div className="budget-progress">
            <div className="budget-bar-track">
              <div
                className="budget-bar-fill"
                style={{ width: `${Math.min(100, (result.total_cost / result.budget) * 100)}%` }}
              />
            </div>
            <div className="budget-labels">
              <span>{formatINR(result.total_cost)} used</span>
              <span>of {formatINR(result.budget)}</span>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <div className="stat-card">
              <div className="stat-value">{totalInterventions}</div>
              <div className="stat-label">Interventions</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatINR(result.total_cost)}</div>
              <div className="stat-label">Cost</div>
            </div>
          </div>

          {/* Intervention type counts */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 8 }}>
              By Type
            </div>
            <div className="intervention-counts">
              {['native_trees', 'pollinator_strip', 'shade_structure', 'cool_surface'].map((id) => {
                const count = result.intervention_counts[id] || 0;
                const maxCount = Math.max(1, ...Object.values(result.intervention_counts));
                return (
                  <div className="int-bar-wrapper" key={id}>
                    <div className="int-bar-count">{count}</div>
                    <div
                      className={`int-bar ${id}`}
                      style={{ height: `${Math.max(4, (count / maxCount) * 36)}px` }}
                    />
                    <div className="int-bar-label">{INTERVENTION_LABELS[id]?.split(' ')[0]}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total impact */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 8 }}>
              Total Impact Score
            </div>
            <div className="impact-bars">
              {(['heat', 'green', 'connectivity', 'pedestrian'] as const).map((dim) => {
                const val = result.total_impact[dim];
                const maxImpact = Math.max(1, ...Object.values(result.total_impact));
                const labels: Record<string, string> = {
                  heat: 'Heat',
                  green: 'Green',
                  connectivity: 'Connectivity',
                  pedestrian: 'Pedestrian',
                };
                return (
                  <div className="impact-row" key={dim}>
                    <div className="impact-row-header">
                      <span className="impact-row-label">{labels[dim]}</span>
                      <span className="impact-row-value">{val.toFixed(2)}</span>
                    </div>
                    <div className="impact-bar-track">
                      <div
                        className={`impact-bar-fill ${dim}`}
                        style={{ width: `${(val / maxImpact) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Individual weight slider */
function WeightSlider({
  label,
  value,
  onChange,
  color,
  sliderClass,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
  sliderClass: string;
}) {
  return (
    <div className="slider-item">
      <div className="slider-label">
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: color,
              display: 'inline-block',
            }}
          />
          {label}
        </span>
        <span className="slider-value">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        className={sliderClass}
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
