// MetricsLayerConfig.tsx
"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function MetricsLayerConfig() {
  // radio group: always "vote-count"
  const [metric, setMetric] = React.useState("vote-count");

  // toggle group: always one selected
  const [style, setStyle] = React.useState("color");

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Metric radio group */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Metric</Label>
        <RadioGroup
          value={metric}
          onValueChange={setMetric}
          className="space-y-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="vote-count" id="vote-count" />
            <Label htmlFor="vote-count" className="text-sm">
              Vote count
            </Label>
          </div>

          <div className="flex items-center space-x-2 opacity-50">
            <p className="text-sm">More to come.</p>
          </div>
        </RadioGroup>
      </div>

      {/* Style toggle group */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Style</Label>
        <ToggleGroup
          type="single" // ensures only one at a time
          variant="outline"
          value={style}
          onValueChange={(v) => v && setStyle(v)} // don't allow unselect
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
