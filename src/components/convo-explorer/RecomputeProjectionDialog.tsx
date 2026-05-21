"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import type { LayerMatrix } from "@/lib/h5ad-loader";
import {
  KNN_BACKENDS,
  KNN_BACKEND_ALGORITHMS,
  KNN_PARAM_DEFS,
  REDUCER_ADVANCED_PARAM_DEFS,
  REDUCER_LABELS,
  REDUCER_PARAM_DEFS,
  defaultAdvancedParamsFor,
  defaultKnnParamsFor,
  defaultParamsFor,
  type KnnBackend,
  type ReducerAlgorithm,
} from "@/lib/druid-reducer";
import type { DruidWorkerState } from "@/hooks/useDruidWorker";

const ALGORITHMS: ReducerAlgorithm[] = ["umap", "pacmap", "localmap"];

export type MaskOption = { value: string; label: string };

type RecomputeProjectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dense layer matrices available as the input vote matrix. */
  layers: Record<string, LayerMatrix>;
  /** Available column mask options (e.g. moderation columns from var metadata). */
  maskOptions: MaskOption[];
  status: DruidWorkerState["status"];
  error: string | null;
  progress: DruidWorkerState["progress"];
  onRun: (
    layerKey: string,
    algorithm: ReducerAlgorithm,
    params: Record<string, number>,
    knnBackend: KnnBackend | undefined,
    maskColumn: string | null,
    knnParams: Record<string, number> | undefined
  ) => void;
};

export const RecomputeProjectionDialog: React.FC<RecomputeProjectionDialogProps> = ({
  open,
  onOpenChange,
  layers,
  maskOptions,
  status,
  error,
  progress,
  onRun,
}) => {
  const layerKeys = React.useMemo(() => Object.keys(layers), [layers]);

  const [layerKey, setLayerKey] = React.useState<string>("");
  const [algorithm, setAlgorithm] = React.useState<ReducerAlgorithm>("umap");
  const [maskColumn, setMaskColumn] = React.useState<string>("none");
  const [knnBackend, setKnnBackend] = React.useState<KnnBackend>("annoy");
  const [knnParamsByBackend, setKnnParamsByBackend] = React.useState<Record<KnnBackend, Record<string, number>>>(() => ({
    annoy: defaultKnnParamsFor("annoy"),
    hnsw: defaultKnnParamsFor("hnsw"),
  }));
  const [paramsByAlgorithm, setParamsByAlgorithm] = React.useState<
    Record<ReducerAlgorithm, Record<string, number>>
  >(() => ({
    umap: defaultParamsFor("umap"),
    pacmap: defaultParamsFor("pacmap"),
    localmap: defaultParamsFor("localmap"),
  }));
  const [advancedParamsByAlgorithm, setAdvancedParamsByAlgorithm] = React.useState<
    Record<ReducerAlgorithm, Record<string, number>>
  >(() => ({
    umap: defaultAdvancedParamsFor("umap"),
    pacmap: defaultAdvancedParamsFor("pacmap"),
    localmap: defaultAdvancedParamsFor("localmap"),
  }));

  // Default the layer selection to the first available layer.
  React.useEffect(() => {
    if (!layerKey && layerKeys.length > 0) {
      setLayerKey(layerKeys[0]);
    }
  }, [layerKey, layerKeys]);

  const params = paramsByAlgorithm[algorithm];
  const advancedParams = advancedParamsByAlgorithm[algorithm];
  const isRunning = status === "running";
  const hasKnnBackend = KNN_BACKEND_ALGORITHMS.includes(algorithm);

  const setParam = (key: string, value: number) => {
    setParamsByAlgorithm((prev) => ({
      ...prev,
      [algorithm]: { ...prev[algorithm], [key]: value },
    }));
  };

  const setAdvancedParam = (key: string, value: number) => {
    setAdvancedParamsByAlgorithm((prev) => ({
      ...prev,
      [algorithm]: { ...prev[algorithm], [key]: value },
    }));
  };

  const setKnnParam = (key: string, value: number) => {
    setKnnParamsByBackend((prev) => ({ ...prev, [knnBackend]: { ...prev[knnBackend], [key]: value } }));
  };

  const handleRun = () => {
    if (!layerKey || isRunning) return;
    const allParams = { ...params, ...advancedParams };
    onRun(
      layerKey,
      algorithm,
      allParams,
      hasKnnBackend ? knnBackend : undefined,
      maskColumn === "none" ? null : maskColumn,
      hasKnnBackend ? knnParamsByBackend[knnBackend] : undefined
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw size={18} />
            Recompute Projection
          </DialogTitle>
          <DialogDescription>
            Run dimensional reduction in the browser on a vote matrix layer. The result
            is added as a new selectable projection.
          </DialogDescription>
        </DialogHeader>

        {layerKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This file has no dense <code>layers/</code> matrices to use as input.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Layer (vote matrix) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <Label>Vote matrix layer</Label>
                {layerKey && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {layers[layerKey].shape[0]}&times;{layers[layerKey].shape[1]}
                  </span>
                )}
              </div>
              <Select value={layerKey} onValueChange={setLayerKey} disabled={isRunning}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a layer..." />
                </SelectTrigger>
                <SelectContent>
                  {layerKeys.map((key) => (
                    <SelectItem key={key} value={key}>{key}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Column mask + Algorithm (same row) */}
            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <Label>Column mask</Label>
                <Select value={maskColumn} onValueChange={setMaskColumn} disabled={isRunning}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {maskOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <Label>Algorithm</Label>
                <Select
                  value={algorithm}
                  onValueChange={(value) => setAlgorithm(value as ReducerAlgorithm)}
                  disabled={isRunning}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALGORITHMS.map((algo) => (
                      <SelectItem key={algo} value={algo}>
                        {REDUCER_LABELS[algo]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Parameters */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {Object.entries(REDUCER_PARAM_DEFS[algorithm]).map(([key, def]) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <Label htmlFor={`param-${key}`} className="text-sm whitespace-nowrap">
                    {def.label}
                  </Label>
                  <input
                    id={`param-${key}`}
                    type="number"
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    value={params[key]}
                    disabled={isRunning}
                    onChange={(e) => setParam(key, Number(e.target.value))}
                    className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm tabular-nums text-right disabled:opacity-50"
                  />
                </div>
              ))}
            </div>

            {/* Advanced */}
            <details className="group">
              <summary className="cursor-pointer select-none text-sm text-muted-foreground hover:text-foreground list-none flex items-center gap-1">
                <span className="transition-transform group-open:rotate-90">›</span>
                Advanced
              </summary>
              <div className="mt-2 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {Object.entries(REDUCER_ADVANCED_PARAM_DEFS[algorithm]).map(([key, def]) => (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <Label htmlFor={`adv-${key}`} className="text-sm whitespace-nowrap">
                        {def.label}
                      </Label>
                      <input
                        id={`adv-${key}`}
                        type="number"
                        min={def.min}
                        max={def.max}
                        step={def.step}
                        value={advancedParams[key]}
                        disabled={isRunning}
                        onChange={(e) => setAdvancedParam(key, Number(e.target.value))}
                        className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm tabular-nums text-right disabled:opacity-50"
                      />
                    </div>
                  ))}
                </div>

                {hasKnnBackend && (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm">KNN backend</Label>
                      <Select
                        value={knnBackend}
                        onValueChange={(v) => setKnnBackend(v as KnnBackend)}
                        disabled={isRunning}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {KNN_BACKENDS.map((b) => (
                            <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                      {Object.entries(KNN_PARAM_DEFS[knnBackend]).map(([key, def]) => (
                        <div key={key} className="flex items-center justify-between gap-2">
                          <Label htmlFor={`knn-${key}`} className="text-sm whitespace-nowrap">
                            {def.label}
                          </Label>
                          <input
                            id={`knn-${key}`}
                            type="number"
                            min={def.min}
                            max={def.max}
                            step={def.step}
                            value={knnParamsByBackend[knnBackend][key]}
                            disabled={isRunning}
                            onChange={(e) => setKnnParam(key, Number(e.target.value))}
                            className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm tabular-nums text-right disabled:opacity-50"
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </details>

            {error && status === "error" && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>
        )}

        <DialogFooter className="items-center">
          <div className="flex-1 min-w-0">
            {isRunning && (
              progress === null ? (
                <p className="text-xs text-muted-foreground animate-pulse">
                  Building KNN graph…
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums w-8 text-right shrink-0">
                    {Math.round(progress * 100)}%
                  </span>
                </div>
              )
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isRunning}>
            Cancel
          </Button>
          <Button
            onClick={handleRun}
            disabled={isRunning || layerKeys.length === 0 || !layerKey}
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <Spinner size="sm" />
                Computing...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                Run
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
