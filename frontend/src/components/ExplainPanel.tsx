/**
 * ExplainPanel — Shows WHAT/WHERE/HOW MUCH/WHY/IMPACT for a clicked cell.
 * If the cell is part of the plan, shows the intervention details.
 * Otherwise shows the raw cell scores.
 */

import type { CellProperties, CellRecommendation } from '../types';
import { INTERVENTION_ICONS, formatINRFull } from '../colors';

interface ExplainPanelProps {
  cellProps: CellProperties;
  recommendation: CellRecommendation | null;
  onClose: () => void;
}

export default function ExplainPanel({ cellProps, recommendation, onClose }: ExplainPanelProps) {
  return (
    <div className="explain-panel">
      <div className="explain-header">
        <h3>
          {recommendation ? '🎯 Recommended' : '📍 Cell Details'}
        </h3>
        <button className="explain-close" onClick={onClose}>✕</button>
      </div>

      <div className="explain-body">
        {/* WHERE */}
        <div className="explain-section">
          <span className="explain-label">Where</span>
          <span className="explain-value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem' }}>
            Cell {cellProps.cell_id}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'capitalize' }}>
            Land use: {cellProps.land_use.replace('_', ' ')}
          </span>
        </div>

        {recommendation ? (
          <>
            {/* WHAT */}
            <div className="explain-section">
              <span className="explain-label">What</span>
              <span className={`explain-value intervention-badge ${recommendation.intervention_id}`}>
                {INTERVENTION_ICONS[recommendation.intervention_id]} {recommendation.intervention_name}
              </span>
            </div>

            {/* HOW MUCH */}
            <div className="explain-section">
              <span className="explain-label">Cost</span>
              <span className="explain-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: '#047857' }}>
                {formatINRFull(recommendation.cost)}
              </span>
            </div>

            {/* WHY */}
            <div className="explain-section">
              <span className="explain-label">Why This Intervention?</span>
              <div className="explain-reason">
                {recommendation.reason}
              </div>
            </div>

            {/* EXPECTED IMPACT */}
            <div className="explain-section">
              <span className="explain-label">Expected Impact</span>
              <div className="impact-bars">
                {([
                  { key: 'heat', label: 'Heat Reduction' },
                  { key: 'green', label: 'Green Coverage' },
                  { key: 'connectivity', label: 'Connectivity' },
                  { key: 'pedestrian', label: 'Pedestrian Comfort' },
                ] as const).map(({ key, label }) => {
                  const val = recommendation.impact_breakdown[key];
                  return (
                    <div className="impact-row" key={key}>
                      <div className="impact-row-header">
                        <span className="impact-row-label">{label}</span>
                        <span className="impact-row-value">{val.toFixed(4)}</span>
                      </div>
                      <div className="impact-bar-track">
                        <div
                          className={`impact-bar-fill ${key}`}
                          style={{ width: `${Math.min(100, val * 400)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weighted score gain */}
            <div className="explain-section">
              <span className="explain-label">Total Weighted Benefit</span>
              <span className="explain-value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem', color: '#059669' }}>
                {recommendation.score_gain.toFixed(4)}
              </span>
            </div>
          </>
        ) : (
          <>
            {/* Raw scores for non-recommended cells */}
            <div className="explain-section">
              <span className="explain-label">Environmental Scores</span>
              <div className="score-grid">
                <ScorePill label="Heat" value={cellProps.heat_score} color="#ef4444" />
                <ScorePill label="Veg. Deficit" value={cellProps.vegetation_deficit} color="#b45309" />
                <ScorePill label="Pedestrian" value={cellProps.pedestrian_exposure} color="#f59e0b" />
                <ScorePill label="Connectivity" value={cellProps.connectivity_potential} color="#8b5cf6" />
              </div>
            </div>

            <div className="explain-section">
              <span className="explain-label">Feasibility</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="impact-bar-track" style={{ flex: 1 }}>
                  <div
                    className="impact-bar-fill green"
                    style={{ width: `${cellProps.feasibility * 100}%` }}
                  />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600, color: '#047857' }}>
                  {cellProps.feasibility.toFixed(2)}
                </span>
              </div>
            </div>

            {cellProps.feasibility === 0 && (
              <div className="error-banner">
                ⚠️ This cell is not feasible for interventions (likely a building).
              </div>
            )}

            {cellProps.feasibility > 0 && (
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic', padding: '8px 12px', background: '#f8fafc', borderRadius: 8 }}>
                This cell wasn't selected in the current plan. Adjust budget or priorities and re-optimize to potentially include it.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ScorePill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="score-pill">
      <span className="score-pill-label">{label}</span>
      <span className="score-pill-value" style={{ color }}>{value.toFixed(2)}</span>
    </div>
  );
}
