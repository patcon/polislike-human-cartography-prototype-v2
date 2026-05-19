import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { FileDown, Import, Repeat1, Repeat, RefreshCw } from "lucide-react";

interface ProjectionOption {
  id: string;
  name: string;
}

interface MapProjectionSelectorProps {
  /** Available pipelines for selection */
  availablePipelines: ProjectionOption[];
  /** Currently selected pipeline ID */
  selectedPipeline: string;
  /** Callback when pipeline selection changes */
  onPipelineChange: (pipelineId: string) => void;
  /** Whether animation/cycling is enabled */
  enableAnimation?: boolean;
  /** Previous pipeline for toggle functionality */
  previousPipeline?: string;
  /** Callback to toggle between current and previous pipeline */
  onTogglePipeline?: () => void;
  /** Whether auto-cycling is active */
  isAutoCycling?: boolean;
  /** Callback to toggle auto-cycling */
  onToggleAutoCycle?: () => void;
  /** Whether any animation is currently in progress */
  isAnimating?: boolean;
  /** Loading states for each pipeline */
  pipelineLoadingStates?: Record<string, boolean>;
  /** Custom positioning - top coordinate */
  top?: number | string;
  /** Custom positioning - left coordinate */
  left?: number | string;
  /** Custom positioning - right coordinate */
  right?: number | string;
  /** Custom positioning - bottom coordinate */
  bottom?: number | string;
  /** Callback to trigger loading a new file */
  onLoadFile?: () => void;
  /** Callback to trigger downloading participant data as CSV */
  onDownloadObsCsv?: () => void;
  /** Callback to open the recompute-projection dialog */
  onRecomputeProjection?: () => void;
}

export const MapProjectionSelector: React.FC<MapProjectionSelectorProps> = ({
  availablePipelines,
  selectedPipeline,
  onPipelineChange,
  enableAnimation = false,
  previousPipeline,
  onTogglePipeline,
  isAutoCycling = false,
  onToggleAutoCycle,
  isAnimating = false,
  pipelineLoadingStates = {},
  top = "1rem",
  left = "1rem",
  right,
  bottom,
  onLoadFile,
  onDownloadObsCsv,
  onRecomputeProjection,
}) => {
  // Measure the longest pipeline label to set a stable select width
  const longestLabel = React.useMemo(() => {
    return availablePipelines.reduce((longest, p) => {
      const label = `${p.name}${pipelineLoadingStates[p.id] ? " (Loading...)" : ""}`;
      return label.length > longest.length ? label : longest;
    }, "");
  }, [availablePipelines, pipelineLoadingStates]);

  if (!enableAnimation || availablePipelines.length === 0) {
    return null;
  }

  const positionStyle: React.CSSProperties = {
    top,
    left,
    right,
    bottom,
  };

  return (
    <div className="absolute bg-white p-4 rounded-lg shadow-lg border" style={positionStyle}>
      <div className="mb-2">
        <h3 className="text-sm font-medium mb-2">
          Pipeline {isAnimating && "(Animating...)"}
        </h3>
        <div className="flex items-center gap-2">
          <div style={{ minWidth: `${longestLabel.length + 4}ch` }}>
            <Select
              value={selectedPipeline}
              onValueChange={onPipelineChange}
              disabled={isAnimating}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select projection..." />
              </SelectTrigger>
              <SelectContent>
                {availablePipelines.map((pipeline) => (
                  <SelectItem
                    key={pipeline.id}
                    value={pipeline.id}
                    disabled={pipelineLoadingStates[pipeline.id]}
                  >
                    {pipeline.name}{pipelineLoadingStates[pipeline.id] ? " (Loading...)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onTogglePipeline}
            disabled={isAnimating || !previousPipeline || (previousPipeline ? !!pipelineLoadingStates[previousPipeline] : false)}
            title={previousPipeline ? `Toggle to ${availablePipelines.find(p => p.id === previousPipeline)?.name || previousPipeline}` : 'No previous pipeline'}
          >
            <Repeat1 className="h-4 w-4" />
          </Button>
          <Button
            variant={isAutoCycling ? "default" : "outline"}
            size="sm"
            onClick={onToggleAutoCycle}
            disabled={!previousPipeline || (previousPipeline ? !!pipelineLoadingStates[previousPipeline] : false)}
            title={isAutoCycling ? 'Stop auto-cycling' : 'Start auto-cycling between last two pipelines'}
            className={isAutoCycling ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            <Repeat className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {(onLoadFile || onDownloadObsCsv || onRecomputeProjection) && (
        <div className="flex items-center gap-1 mt-3">
          {onRecomputeProjection && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRecomputeProjection}
              disabled={isAnimating}
              title="Recompute projection in-browser"
              className="flex-1"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Recompute
            </Button>
          )}
          {onLoadFile && (
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadFile}
              disabled={isAnimating}
              title="Import .h5ad file"
              className="flex-1"
            >
              <Import className="h-4 w-4 mr-1" />
              Import .h5ad
            </Button>
          )}
          {onDownloadObsCsv && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDownloadObsCsv}
              title="Download participant data as CSV"
              className="flex-1"
            >
              <FileDown className="h-4 w-4 mr-1" />
              Download Data
            </Button>
          )}
        </div>
      )}
    </div>
  );
};