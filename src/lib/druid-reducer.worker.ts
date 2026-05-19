/**
 * Web worker that runs dimensional reduction off the main thread via DruidJS.
 * Receives a dense matrix (rows = participants) and posts back 2D coordinates.
 */
import { UMAP, PaCMAP, LocalMAP } from "@saehrimnir/druidjs";
import type { ReducerRequest, ReducerResponse } from "./druid-reducer";

function reduce(req: ReducerRequest): [number, number][] {
  const { matrix, algorithm, params } = req;
  const n = matrix.length;
  if (n < 3) {
    throw new Error(`Need at least 3 rows to run dimensional reduction (got ${n}).`);
  }
  // DruidJS requires n_neighbors < n; clamp to a sane range.
  const nNeighbors = Math.max(2, Math.min(Math.round(params.n_neighbors), n - 1));

  let projection: number[][];
  if (algorithm === "umap") {
    const umap = new UMAP(matrix, {
      d: 2,
      n_neighbors: nNeighbors,
      min_dist: params.min_dist,
      _spread: params.spread,
    });
    projection = umap.transform() as number[][];
  } else if (algorithm === "localmap") {
    const localmap = new LocalMAP(matrix, {
      d: 2,
      n_neighbors: nNeighbors,
      MN_ratio: params.MN_ratio,
      FP_ratio: params.FP_ratio,
      low_dist_thres: params.low_dist_thres,
    });
    projection = localmap.transform() as number[][];
  } else {
    const pacmap = new PaCMAP(matrix, {
      d: 2,
      n_neighbors: nNeighbors,
      MN_ratio: params.MN_ratio,
      FP_ratio: params.FP_ratio,
    });
    projection = pacmap.transform() as number[][];
  }

  return projection.map((row) => [row[0], row[1]] as [number, number]);
}

self.onmessage = (e: MessageEvent<ReducerRequest>) => {
  const req = e.data;
  if (req?.type !== "reduce") return;
  try {
    const response: ReducerResponse = { type: "done", coords: reduce(req) };
    self.postMessage(response);
  } catch (err) {
    const response: ReducerResponse = {
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
