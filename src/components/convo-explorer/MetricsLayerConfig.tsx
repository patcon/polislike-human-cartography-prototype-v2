// MetricsLayerConfig.tsx
"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type MetricConfig =
  | { type: "vote-count"; style: "color" | "opacity" }
  | { type: "principal-components"; component: number }
  | { type: "obs-column"; column: string };

type MetricsLayerConfigProps = {
  config?: MetricConfig;
  onConfigChange?: (config: MetricConfig) => void;
  obsColumnKeys?: string[];
  showFilteredParticipants?: boolean;
  onShowFilteredParticipantsChange?: (value: boolean) => void;
};

export function MetricsLayerConfig({
  config = { type: "vote-count", style: "color" },
  onConfigChange,
  obsColumnKeys,
  showFilteredParticipants = false,
  onShowFilteredParticipantsChange,
}: MetricsLayerConfigProps) {
  const hasObsColumns = obsColumnKeys && obsColumnKeys.length > 0;

  // Remember the last selected obs column so it persists when switching away and back
  const [lastObsColumn, setLastObsColumn] = React.useState<string | null>(
    config.type === "obs-column" ? config.column : null
  );

  // Keep lastObsColumn in sync when parent changes the config to obs-column
  React.useEffect(() => {
    if (config.type === "obs-column") {
      setLastObsColumn(config.column);
    }
  }, [config]);

  const handleMetricTypeChange = (newType: string) => {
    if (newType === "vote-count") {
      onConfigChange?.({ type: "vote-count", style: "color" });
    } else if (newType === "principal-components") {
      onConfigChange?.({ type: "principal-components", component: 3 });
    } else if (newType === "obs-column" && hasObsColumns) {
      onConfigChange?.({ type: "obs-column", column: lastObsColumn ?? obsColumnKeys[0] });
    }
  };

  const handleComponentChange = (component: number) => {
    if (config.type === "principal-components") {
      onConfigChange?.({ type: "principal-components", component });
    }
  };

  const handleStyleChange = (style: string) => {
    if (config.type === "vote-count" && (style === "color" || style === "opacity")) {
      onConfigChange?.({ type: "vote-count", style });
    }
  };

  const handleObsColumnChange = (column: string) => {
    setLastObsColumn(column);
    onConfigChange?.({ type: "obs-column", column });
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Metric radio group */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Metric</Label>
        <RadioGroup
          value={config.type}
          onValueChange={handleMetricTypeChange}
          className="space-y-1"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="vote-count" id="vote-count" />
            <Label htmlFor="vote-count" className="text-sm">
              Vote count
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <RadioGroupItem value="principal-components" id="principal-components" />
            <Label htmlFor="principal-components" className="text-sm">
              Principal components
            </Label>
            <div className="flex items-center space-x-2 ml-4">
              <Label htmlFor="component-input" className="text-xs">
                Component:
              </Label>
              <Input
                id="component-input"
                type="number"
                min="1"
                max="10"
                value={config.type === "principal-components" ? config.component : 3}
                onChange={(e) => handleComponentChange(parseInt(e.target.value) || 3)}
                disabled={config.type !== "principal-components"}
                className="w-16 h-6 text-xs"
              />
            </div>
          </div>

          {hasObsColumns && (
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="obs-column" id="obs-column" />
              <Label htmlFor="obs-column" className="text-sm">
                Other
              </Label>
              <div
                onPointerDown={() => {
                  if (config.type !== "obs-column") {
                    handleMetricTypeChange("obs-column");
                  }
                }}
              >
                <Select
                  value={config.type === "obs-column" ? config.column : (lastObsColumn ?? "")}
                  onValueChange={handleObsColumnChange}
                  disabled={config.type !== "obs-column"}
                >
                  <SelectTrigger className="ml-2 w-48 h-7 text-xs">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    {obsColumnKeys.map((key) => (
                      <SelectItem key={key} value={key}>
                        {key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </RadioGroup>
      </div>

      {/* Style toggle group */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Style</Label>
        <ToggleGroup
          type="single" // ensures only one at a time
          variant="outline"
          value={config.type === "vote-count" ? config.style : "color"}
          onValueChange={(v) => v && handleStyleChange(v)} // don't allow unselect
          className="flex"
        >
          <ToggleGroupItem value="opacity" disabled>Opacity</ToggleGroupItem>
          <ToggleGroupItem value="color">
            Color
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="flex items-center space-x-2 mt-2">
          <input
            type="checkbox"
            id="show-filtered"
            checked={showFilteredParticipants}
            onChange={(e) => onShowFilteredParticipantsChange?.(e.target.checked)}
          />
          <Label htmlFor="show-filtered" className="text-sm">
            Show filtered participants
          </Label>
        </div>
      </div>
    </div>
  );
}
