/**
 * EcoGrid AI — API Client
 * Communicates with the FastAPI backend.
 */

import type { GridData, Intervention, OptimizeRequest, OptimizeResponse } from './types';

const API_BASE = 'https://ecogrid-api-x64q.onrender.com';

export async function fetchGrid(): Promise<GridData> {
  const res = await fetch(`${API_BASE}/api/grid`);
  if (!res.ok) throw new Error(`Failed to fetch grid: ${res.statusText}`);
  return res.json();
}

export async function fetchInterventions(): Promise<Intervention[]> {
  const res = await fetch(`${API_BASE}/api/interventions`);
  if (!res.ok) throw new Error(`Failed to fetch interventions: ${res.statusText}`);
  const data = await res.json();
  return data.interventions;
}

export async function optimize(request: OptimizeRequest): Promise<OptimizeResponse> {
  const res = await fetch(`${API_BASE}/api/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`Optimization failed: ${res.statusText}`);
  return res.json();
}
