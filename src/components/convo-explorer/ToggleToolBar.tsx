"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FlipHorizontal, FlipVertical, Tags } from "lucide-react";
import { BringToFrontSolid } from "../icons/BringToFrontSolid";

type ToggleToolBarProps = {
  value: string[];
  onValueChange: (values: string[]) => void;
  // maybe accept size / variant etc if needed
};

export function ToggleToolBar({
  value,
  onValueChange,
}: ToggleToolBarProps) {
  return (
    <ToggleGroup
      type="multiple"
      variant="outline"
      value={value}
      onValueChange={onValueChange}
      className="flex bg-white"
      aria-label="Icon toggle group: flip horizontal, flip vertical, show named labels"
    >
      <ToggleGroupItem value="flip-horizontal" aria-label="Flip horizontally" className="data-[state=on]:bg-gray-200">
        <FlipHorizontal className="h-5 w-5" />
      </ToggleGroupItem>
      <ToggleGroupItem value="flip-vertical" aria-label="Flip vertically" className="data-[state=on]:bg-gray-200">
        <FlipVertical className="h-5 w-5" />
      </ToggleGroupItem>
      <ToggleGroupItem disabled value="show-named-labels" aria-label="Show named labels" className="data-[state=on]:bg-gray-200">
        <Tags className="h-5 w-5" />
      </ToggleGroupItem>
      <ToggleGroupItem value="colors-to-front" aria-label="Bring colors to front" className="data-[state=on]:bg-gray-200">
        <BringToFrontSolid className="h-5 w-5" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
