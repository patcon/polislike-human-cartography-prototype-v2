import { UMAP, PaCMAP, LocalMAP, type ParametersUMAP, type ParametersPaCMAP, type ParametersLocalMAP, type ParametersAnnoy, type ParametersHNSW } from "@saehrimnir/druidjs";

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

export const REDUCER_PARAM_DEFS: Record<ReducerAlgorithm, Record<string, ParamDef>> = {
  umap: {
    n_neighbors: { label: "Neighbors", min: 2, max: 200, step: 1, default: 15 },
    min_dist: { label: "Min dist", min: 0, max: 1, step: 0.01, default: 0.1 },
    _spread: { label: "Spread", min: 0.1, max: 10, step: 0.1, default: 1.0 },
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

export const REDUCER_ADVANCED_PARAM_DEFS: Record<ReducerAlgorithm, Record<string, ParamDef>> = {
  umap: {
    _n_epochs:              { label: "Epochs",               min: 50,    max: 2000,  step: 10,    default: 350  },
    seed:                   { label: "Seed",                 min: 0,     max: 99999, step: 1,     default: 1212 },
    local_connectivity:     { label: "Local connectivity",   min: 1,     max: 20,    step: 1,     default: 1    },
    _initial_alpha:         { label: "Initial LR",           min: 0.01,  max: 5,     step: 0.01,  default: 1    },
    _repulsion_strength:    { label: "Repulsion strength",   min: 0,     max: 5,     step: 0.1,   default: 1    },
    _negative_sample_rate:  { label: "Neg. sample rate",     min: 1,     max: 20,    step: 1,     default: 5    },
    _set_op_mix_ratio:      { label: "Set-op mix ratio",     min: 0,     max: 1,     step: 0.01,  default: 1    },
  },
  pacmap: {
    seed: { label: "Seed",          min: 0,     max: 99999, step: 1,     default: 1212 },
    lr:   { label: "Learning rate", min: 0.001, max: 10,    step: 0.001, default: 1.0  },
  },
  localmap: {
    seed: { label: "Seed",          min: 0,     max: 99999, step: 1,     default: 1212 },
    lr:   { label: "Learning rate", min: 0.001, max: 10,    step: 0.001, default: 1.0  },
  },
};

export const KNN_BACKEND_ALGORITHMS: ReducerAlgorithm[] = ["pacmap", "localmap"];
export type KnnBackend = "annoy" | "hnsw";
export const KNN_BACKENDS: { value: KnnBackend; label: string }[] = [
  { value: "annoy", label: "Annoy" },
  { value: "hnsw",  label: "HNSW (broken?)"  },
];

export function defaultParamsFor(algorithm: ReducerAlgorithm): Record<string, number> {
  return Object.fromEntries(
    Object.entries(REDUCER_PARAM_DEFS[algorithm]).map(([key, def]) => [key, def.default])
  );
}

export function defaultAdvancedParamsFor(algorithm: ReducerAlgorithm): Record<string, number> {
  return Object.fromEntries(
    Object.entries(REDUCER_ADVANCED_PARAM_DEFS[algorithm]).map(([key, def]) => [key, def.default])
  );
}

export const KNN_PARAM_DEFS: Record<KnnBackend, Record<string, ParamDef>> = {
  annoy: {
    numTrees:         { label: "Num trees",     min: 1,   max: 200,  step: 1,  default: 10  },
    maxPointsPerLeaf: { label: "Max pts/leaf",  min: 1,   max: 200,  step: 1,  default: 10  },
    seed:             { label: "Seed",          min: 0,   max: 99999, step: 1, default: 1212 },
  },
  // Defaults match the voyager (Spotify) HNSW library used by pacmap-python:
  // https://github.com/spotify/voyager/blob/main/cpp/src/TypedIndex.h#L127
  // https://spotify.github.io/voyager/python/reference.html#voyager.Index
  hnsw: {
    ef:               { label: "ef (search)",   min: 10,  max: 1000, step: 10,  default: 10  },
    ef_construction:  { label: "ef_construct",  min: 10,  max: 2000, step: 10,  default: 200 },
    m:                { label: "m",             min: 2,   max: 100,  step: 1,   default: 12  },
    seed:             { label: "Seed",          min: 0,   max: 99999, step: 1,  default: 1212 },
  },
};

export function defaultKnnParamsFor(backend: KnnBackend): Record<string, number> {
  return Object.fromEntries(
    Object.entries(KNN_PARAM_DEFS[backend]).map(([key, def]) => [key, def.default])
  );
}

/** @deprecated Use KNN_PARAM_DEFS["hnsw"] */
export const HNSW_PARAM_DEFS = KNN_PARAM_DEFS["hnsw"];
/** @deprecated Use defaultKnnParamsFor("hnsw") */
export function defaultHnswParams(): Record<string, number> { return defaultKnnParamsFor("hnsw"); }

export type { ParametersAnnoy, ParametersHNSW };

export type ReducerRequest = {
  type: "reduce";
  matrix: number[][];
  algorithm: ReducerAlgorithm;
  params: Record<string, number>;
  knnBackend?: KnnBackend;
  knnParams?: Record<string, number>;
};

export type ReducerResponse =
  | { type: "done"; coords: [number, number][] }
  | { type: "progress"; iteration: number; total: number; coords: [number, number][] }
  | { type: "error"; message: string };

export const REDUCER_DEFAULT_ITERATIONS: Record<ReducerAlgorithm, number> = {
  umap: 350,
  pacmap: 450,
  localmap: 450,
};

export const PROGRESS_INTERVAL = 10;

/** Zeroes out columns in-place at indices where mask[j] is true. */
export function zeroMaskedColumns(matrix: number[][], mask: boolean[]): void {
  const nObs = matrix.length;
  for (let j = 0; j < mask.length; j++) {
    if (!mask[j]) continue;
    for (let i = 0; i < nObs; i++) matrix[i][j] = 0;
  }
}

/** Replaces NaN cells in-place with the column mean of observed values. Falls back to 0 for all-NaN columns. */
export function imputeColumnMeans(matrix: number[][]): void {
  const nObs = matrix.length;
  const nVars = matrix[0]?.length ?? 0;
  for (let j = 0; j < nVars; j++) {
    let sum = 0, count = 0;
    for (let i = 0; i < nObs; i++) {
      if (!isNaN(matrix[i][j])) { sum += matrix[i][j]; count++; }
    }
    const colMean = count > 0 ? sum / count : 0;
    for (let i = 0; i < nObs; i++) {
      if (isNaN(matrix[i][j])) matrix[i][j] = colMean;
    }
  }
}

/** Pure generator — yields progress ticks then a final done event. Usable in a web worker or directly in Node.js. */
export function* runReducer(req: ReducerRequest): Generator<ReducerResponse> {
  const { matrix, algorithm, params, knnBackend, knnParams } = req;
  const n = matrix.length;
  if (n < 3) {
    throw new Error(`Need at least 3 rows to run dimensional reduction (got ${n}).`);
  }
  const nNeighbors = Math.max(2, Math.min(Math.round(params.n_neighbors), n - 1));
  const total = params._n_epochs ?? REDUCER_DEFAULT_ITERATIONS[algorithm];

  let gen: Generator<unknown, unknown, unknown>;
  if (algorithm === "umap") {
    const dr = new UMAP(matrix, {
      d: 2,
      ...(params as Partial<ParametersUMAP>),
      n_neighbors: nNeighbors,
      _n_epochs: total,
    });
    gen = dr.generator(total);
  } else if (algorithm === "localmap") {
    const dr = new LocalMAP(matrix, {
      d: 2,
      ...(params as Partial<ParametersLocalMAP>),
      n_neighbors: nNeighbors,
      // knn_backend/knn_params are not in DruidJS types but accepted at runtime
      knn_backend: knnBackend ?? "annoy",
      knn_params: (knnParams ?? defaultKnnParamsFor(knnBackend ?? "annoy")) as Partial<ParametersAnnoy> | Partial<ParametersHNSW>,
    } as Partial<ParametersLocalMAP>);
    gen = dr.generator();
  } else {
    const dr = new PaCMAP(matrix, {
      d: 2,
      ...(params as Partial<ParametersPaCMAP>),
      n_neighbors: nNeighbors,
      // knn_backend/knn_params are not in DruidJS types but accepted at runtime
      knn_backend: knnBackend ?? "annoy",
      knn_params: (knnParams ?? defaultKnnParamsFor(knnBackend ?? "annoy")) as Partial<ParametersAnnoy> | Partial<ParametersHNSW>,
    } as Partial<ParametersPaCMAP>);
    gen = dr.generator();
  }

  let iteration = 0;
  let lastProjection: number[][] = [];
  for (const projection of gen) {
    iteration++;
    lastProjection = projection as number[][];
    if (iteration % PROGRESS_INTERVAL === 0) {
      const coords = lastProjection.map((row) => [row[0], row[1]] as [number, number]);
      yield { type: "progress", iteration, total, coords };
    }
  }

  const coords = lastProjection.map((row) => [row[0], row[1]] as [number, number]);
  yield { type: "done", coords };
}
