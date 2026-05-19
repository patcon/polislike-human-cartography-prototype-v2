/**
 * Shared types and configuration for in-browser dimensional reduction via DruidJS.
 * Used by both the reducer web worker and the UI that drives it.
 */

export type ReducerAlgorithm = "umap" | "pacmap" | "localmap";

export const REDUCER_LABELS: Record<ReducerAlgorithm, string> = {
  umap: "UMAP",
  pacmap: "PaCMAP",
  localmap: "LocalMAP",
};

export type ParamDef = {
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
};

/**
 * Tunable parameters per algorithm. Defaults mirror the sibling repo
 * (polislike-partykit-reaction-canvas) so behavior stays consistent.
 */
export const REDUCER_PARAM_DEFS: Record<ReducerAlgorithm, Record<string, ParamDef>> = {
  umap: {
    n_neighbors: { label: "Neighbors", min: 2, max: 200, step: 1, default: 15 },
    min_dist: { label: "Min dist", min: 0, max: 1, step: 0.01, default: 0.1 },
    spread: { label: "Spread", min: 0.1, max: 10, step: 0.1, default: 1.0 },
  },
  pacmap: {
    n_neighbors: { label: "Neighbors", min: 2, max: 200, step: 1, default: 10 },
    MN_ratio: { label: "MN ratio", min: 0.1, max: 5, step: 0.1, default: 0.5 },
    FP_ratio: { label: "FP ratio", min: 0.5, max: 10, step: 0.5, default: 2.0 },
  },
  localmap: {
    n_neighbors: { label: "Neighbors", min: 2, max: 200, step: 1, default: 10 },
    MN_ratio: { label: "MN ratio", min: 0.1, max: 5, step: 0.1, default: 0.5 },
    FP_ratio: { label: "FP ratio", min: 0.5, max: 10, step: 0.5, default: 2.0 },
    low_dist_thres: { label: "Low dist thresh", min: 1, max: 50, step: 1, default: 10 },
  },
};

/** Build a fresh params object for an algorithm using the defined defaults. */
export function defaultParamsFor(algorithm: ReducerAlgorithm): Record<string, number> {
  return Object.fromEntries(
    Object.entries(REDUCER_PARAM_DEFS[algorithm]).map(([key, def]) => [key, def.default])
  );
}

/** Message sent from the main thread to the reducer worker. */
export type ReducerRequest = {
  type: "reduce";
  matrix: number[][];
  algorithm: ReducerAlgorithm;
  params: Record<string, number>;
};

/** Message sent from the reducer worker back to the main thread. */
export type ReducerResponse =
  | { type: "done"; coords: [number, number][] }
  | { type: "error"; message: string };
