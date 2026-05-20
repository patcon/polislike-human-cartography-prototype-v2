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
  REDUCER_LABELS,
  REDUCER_PARAM_DEFS,
  defaultParamsFor,
  type ReducerAlgorithm,
} from "@/lib/druid-reducer";
import type { DruidWorkerState } from "@/hooks/useDruidWorker";

const ALGORITHMS: ReducerAlgorithm[] = ["umap", "pacmap", "localmap"];

type RecomputeProjectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dense layer matrices available as the input vote matrix. */
  layers: Record<string, LayerMatrix>;
  status: DruidWorkerState["status"];
  error: string | null;
  progress: DruidWorkerState["progress"];
  onRun: (
    layerKey: string,
    algorithm: ReducerAlgorithm,
    params: Record<string, number>
  ) => void;
};

export const RecomputeProjectionDialog: React.FC<RecomputeProjectionDialogProps> = ({
  open,
  onOpenChange,
  layers,
  status,
  error,
  progress,
  onRun,
}) => {
  const layerKeys = React.useMemo(() => Object.keys(layers), [layers]);

  const [layerKey, setLayerKey] = React.useState<string>("");
  const [algorithm, setAlgorithm] = React.useState<ReducerAlgorithm>("umap");
  const [paramsByAlgorithm, setParamsByAlgorithm] = React.useState<
    Record<ReducerAlgorithm, Record<string, number>>
  >(() => ({
    umap: defaultParamsFor("umap"),
    pacmap: defaultParamsFor("pacmap"),
    localmap: defaultParamsFor("localmap"),
  }));

  // Default the layer selection to the first available layer.
  React.useEffect(() => {
    if (!layerKey && layerKeys.length > 0) {
      setLayerKey(layerKeys[0]);
    }
  }, [layerKey, layerKeys]);

  const params = paramsByAlgorithm[algorithm];
  const isRunning = status === "running";

  const setParam = (key: string, value: number) => {
    setParamsByAlgorithm((prev) => ({
      ...prev,
      [algorithm]: { ...prev[algorithm], [key]: value },
    }));
  };

  const handleRun = () => {
    if (!layerKey || isRunning) return;
    onRun(layerKey, algorithm, params);
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
              <Label>Vote matrix layer</Label>
              <Select value={layerKey} onValueChange={setLayerKey} disabled={isRunning}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a layer..." />
                </SelectTrigger>
                <SelectContent>
                  {layerKeys.map((key) => {
                    const [rows, cols] = layers[key].shape;
                    return (
                      <SelectItem key={key} value={key}>
                        {key} ({rows}&times;{cols})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Algorithm */}
            <div className="flex flex-col gap-1.5">
              <Label>Algorithm</Label>
              <Select
                value={algorithm}
                onValueChange={(value) => setAlgorithm(value as ReducerAlgorithm)}
                disabled={isRunning}
              >
                <SelectTrigger>
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

            {/* Parameters */}
            <div className="flex flex-col gap-3">
              {Object.entries(REDUCER_PARAM_DEFS[algorithm]).map(([key, def]) => (
                <div key={key} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`param-${key}`} className="text-sm">
                      {def.label}
                    </Label>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {params[key]}
                    </span>
                  </div>
                  <input
                    id={`param-${key}`}
                    type="range"
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    value={params[key]}
                    disabled={isRunning}
                    onChange={(e) => setParam(key, Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
              ))}
            </div>

            {isRunning && (
              <div className="flex flex-col gap-1">
                {progress === null ? (
                  <p className="text-xs text-muted-foreground animate-pulse">
                    Building KNN graph…
                  </p>
                ) : (
                  <>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-right">
                      {Math.round(progress * 100)}%
                    </p>
                  </>
                )}
              </div>
            )}

            {error && status === "error" && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>
        )}

        <DialogFooter>
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
