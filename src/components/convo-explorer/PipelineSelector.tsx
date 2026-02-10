import * as React from "react";
import { Combobox, type ComboboxOption } from "../ui/combobox";
import { Button } from "../ui/button";
import { Repeat1, Repeat } from "lucide-react";

interface PipelineOption {
  id: string;
  name: string;
}

interface PipelineSelectorProps {
  /** Available pipelines for selection */
  availablePipelines: PipelineOption[];
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
}

export const PipelineSelector: React.FC<PipelineSelectorProps> = ({
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
}) => {
  // Measure the longest pipeline label to set a stable combobox width
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
          <Combobox
            value={selectedPipeline}
            onValueChange={onPipelineChange}
            disabled={isAnimating}
            options={availablePipelines.map((pipeline): ComboboxOption => ({
              value: pipeline.id,
              label: `${pipeline.name}${pipelineLoadingStates[pipeline.id] ? " (Loading...)" : ""}`,
              disabled: pipelineLoadingStates[pipeline.id]
            }))}
            placeholder="Select pipeline..."
            searchPlaceholder="Search pipelines..."
            emptyMessage="No pipeline found."
          />
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
    </div>
  );
};