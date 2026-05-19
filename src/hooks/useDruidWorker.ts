import { useCallback, useEffect, useRef, useState } from "react";
import DruidWorker from "@/lib/druid-reducer.worker?worker";
import type { ReducerAlgorithm, ReducerRequest, ReducerResponse } from "@/lib/druid-reducer";

export type DruidWorkerStatus = "idle" | "running" | "done" | "error";

export type DruidWorkerState = {
  status: DruidWorkerStatus;
  /** 2D coordinates from the last successful run, in input-row order. */
  result: [number, number][] | null;
  error: string | null;
  runReduction: (
    matrix: number[][],
    algorithm: ReducerAlgorithm,
    params: Record<string, number>
  ) => void;
  reset: () => void;
};

/**
 * Drives the DruidJS reducer worker. The worker is created lazily on first run
 * and terminated on unmount.
 */
export function useDruidWorker(): DruidWorkerState {
  const [status, setStatus] = useState<DruidWorkerStatus>("idle");
  const [result, setResult] = useState<[number, number][] | null>(null);
  const [error, setError] = useState<string | null>(null);
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
          setResult(msg.coords);
          setStatus("done");
        } else {
          setError(msg.message);
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
    (matrix: number[][], algorithm: ReducerAlgorithm, params: Record<string, number>) => {
      setStatus("running");
      setResult(null);
      setError(null);
      const request: ReducerRequest = { type: "reduce", matrix, algorithm, params };
      getWorker().postMessage(request);
    },
    [getWorker]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return { status, result, error, runReduction, reset };
}
