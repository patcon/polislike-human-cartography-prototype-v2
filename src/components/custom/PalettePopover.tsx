"use client";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { PalettePanel } from "./PalettePanel";
import { PaletteButton } from "./PaletteButton";
import { PALETTE_COLORS, UNPAINTED_COLOR, UNPAINTED_INDEX } from "@/constants";

type PalettePopoverProps = {
  activeIndex: number;
  onSelectIndex: (index: number) => void;
  onEraserReselect?: () => void;
  disabled?: boolean; // 👈 add this
};

export function PalettePopover({ activeIndex, onSelectIndex, onEraserReselect, disabled = false }: PalettePopoverProps) {
  // Use UNPAINTED_COLOR when eraser is selected (activeIndex === UNPAINTED_INDEX)
  const displayColor = activeIndex === UNPAINTED_INDEX ? UNPAINTED_COLOR : PALETTE_COLORS[activeIndex];

  return (
    <Popover>
      <PopoverContent align="end" className="w-auto p-1 mb-2" asChild>
        <PalettePanel activeIndex={activeIndex} onSelectIndex={onSelectIndex} onEraserReselect={onEraserReselect} />
      </PopoverContent>

      <PopoverTrigger asChild disabled={disabled}>
        <PaletteButton color={displayColor} disabled={disabled} />
      </PopoverTrigger>
    </Popover>
  );
}