import { useCallback, useEffect, useRef, useState } from "react";
import DruidWorker from "../druid-reducer.worker?worker";
import type { KnnBackend, ReducerAlgorithm, ReducerRequest, ReducerResponse } from "../druid-reducer";

export type DruidWorkerStatus = "idle" | "running" | "done" | "error";

export type DruidWorkerState = {
  status: DruidWorkerStatus;
  /** Current 2D coordinates — updated every PROGRESS_INTERVAL iterations while running, holds the final result when done. */
  coords: [number, number][] | null;
  error: string | null;
  /** 0–1 progress fraction while running, null otherwise. */
  progress: number | null;
  runReduction: (
    matrix: number[][],
    algorithm: ReducerAlgorithm,
    params: Record<string, number>,
    knnBackend?: KnnBackend,
    knnParams?: Record<string, number>
  ) => void;
  reset: () => void;
};

/**
 * Drives the DruidJS reducer worker. The worker is created lazily on first run
 * and terminated on unmount.
 */
export function useDruidWorker(): DruidWorkerState {
  const [status, setStatus] = useState<DruidWorkerStatus>("idle");
  const [coords, setCoords] = useState<[number, number][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const worker = new DruidWorker();
      worker.onmessage = (e: MessageEvent<ReducerResponse>) => {
        const msg = e.data;
        if (msg.type === "done") {
          setCoords(msg.coords);
          setProgress(null);
          setStatus("done");
        } else if (msg.type === "progress") {
          setProgress(msg.iteration / msg.total);
          setCoords(msg.coords);
        } else {
          setError(msg.message);
          setCoords(null);
          setProgress(null);
          setStatus("error");
        }
      };
      worker.onerror = (e: ErrorEvent) => {
        console.error("[druid-reducer worker] error", e);
        setError(e.message || "Worker error (see console)");
        setStatus("error");
      };
      workerRef.current = worker;
    }
    return workerRef.current;
  }, []);

  const runReduction = useCallback(
    (matrix: number[][], algorithm: ReducerAlgorithm, params: Record<string, number>, knnBackend?: KnnBackend, knnParams?: Record<string, number>) => {
      setStatus("running");
      setCoords(null);
      setError(null);
      const request: ReducerRequest = { type: "reduce", matrix, algorithm, params, knnBackend, knnParams };
      getWorker().postMessage(request);
    },
    [getWorker]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setCoords(null);
    setError(null);
    setProgress(null);
  }, []);

  return { status, coords, error, progress, runReduction, reset };
}
