// MetricsLayerConfig.tsx
"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";

export type MetricConfig =
  | { type: "vote-count"; style: "color" | "opacity" }
  | { type: "principal-components"; component: number };

type MetricsLayerConfigProps = {
  config?: MetricConfig;
  onConfigChange?: (config: MetricConfig) => void;
};

export function MetricsLayerConfig({
  config = { type: "vote-count", style: "color" },
  onConfigChange,
}: MetricsLayerConfigProps) {
  const handleMetricTypeChange = (newType: string) => {
    if (newType === "vote-count") {
      onConfigChange?.({ type: "vote-count", style: "color" });
    } else if (newType === "principal-components") {
      onConfigChange?.({ type: "principal-components", component: 3 });
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

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Metric radio group */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Metric</Label>
        <RadioGroup
          value={config.type}
          onValueChange={handleMetricTypeChange}
          className="space-y-2"
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
            {config.type === "principal-components" && (
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
                  className="w-16 h-6 text-xs"
                />
              </div>
            )}
          </div>
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
      </div>
    </div>
  );
}
