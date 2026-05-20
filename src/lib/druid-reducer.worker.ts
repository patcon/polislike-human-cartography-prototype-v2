/**
 * Web worker that runs dimensional reduction off the main thread via DruidJS.
 * Receives a dense matrix (rows = participants) and posts back 2D coordinates.
 */
import { UMAP, PaCMAP, LocalMAP } from "@saehrimnir/druidjs";
import type { ReducerRequest, ReducerResponse } from "./druid-reducer";
import { REDUCER_DEFAULT_ITERATIONS } from "./druid-reducer";

const PROGRESS_INTERVAL = 10;

function reduce(req: ReducerRequest): void {
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
      n_neighbors: nNeighbors,
      min_dist: params.min_dist,
      _spread: params.spread,
      seed: params.seed,
      local_connectivity: params.local_connectivity,
      _initial_alpha: params._initial_alpha,
      _repulsion_strength: params._repulsion_strength,
      _negative_sample_rate: params._negative_sample_rate,
      _set_op_mix_ratio: params._set_op_mix_ratio,
      _n_epochs: total,
    });
    gen = dr.generator(total);
  } else if (algorithm === "localmap") {
    const dr = new LocalMAP(matrix, {
      d: 2,
      n_neighbors: nNeighbors,
      MN_ratio: params.MN_ratio,
      FP_ratio: params.FP_ratio,
      low_dist_thres: params.low_dist_thres,
      seed: params.seed,
      lr: params.lr,
      knn_backend: knnBackend ?? "annoy",
      knn_params: knnParams ?? {},
    });
    gen = dr.generator();
  } else {
    const dr = new PaCMAP(matrix, {
      d: 2,
      n_neighbors: nNeighbors,
      MN_ratio: params.MN_ratio,
      FP_ratio: params.FP_ratio,
      seed: params.seed,
      lr: params.lr,
      knn_backend: knnBackend ?? "annoy",
      knn_params: knnParams ?? {},
    });
    gen = dr.generator();
  }

  let iteration = 0;
  let lastProjection: number[][] = [];
  for (const projection of gen) {
    iteration++;
    lastProjection = projection as number[][];
    if (iteration % PROGRESS_INTERVAL === 0) {
      const progress: ReducerResponse = { type: "progress", iteration, total };
      self.postMessage(progress);
    }
  }

  const coords = lastProjection.map((row) => [row[0], row[1]] as [number, number]);
  const done: ReducerResponse = { type: "done", coords };
  self.postMessage(done);
}

self.onmessage = (e: MessageEvent<ReducerRequest>) => {
  const req = e.data;
  if (req?.type !== "reduce") return;
  try {
    reduce(req);
  } catch (err) {
    const response: ReducerResponse = {
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
