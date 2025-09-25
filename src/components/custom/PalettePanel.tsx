"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { PALETTE_COLORS, UNPAINTED_INDEX } from "@/constants";
import { Eraser } from "lucide-react";

type PalettePanelProps = {
  activeIndex: number; // UNPAINTED_INDEX means eraser is selected
  onSelectIndex?: (index: number) => void;
} & React.ComponentPropsWithoutRef<typeof Card>; // allow extra props

export const PalettePanel = React.forwardRef<HTMLDivElement, PalettePanelProps>(
  ({ activeIndex, onSelectIndex, className, ...props }, ref) => {
    const isEraserSelected = activeIndex === UNPAINTED_INDEX;

    return (
      <Card ref={ref} className={`p-1 inline-block ${className ?? ""}`} {...props}>
        <div className="grid grid-cols-2 gap-1">
          {PALETTE_COLORS.map((color, index) => {
            const isSelected = index === activeIndex;
            return (
              <button
                key={color}
                onClick={() => onSelectIndex?.(index)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white"
                title={color}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isSelected ? "bg-gray-200" : "hover:bg-gray-200"
                  }`}
                >
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                </div>
              </button>
            );
          })}
          {/* Eraser button spanning two columns */}
          <button
            onClick={() => onSelectIndex?.(UNPAINTED_INDEX)}
            className="col-span-2 h-8 flex items-center justify-center rounded-lg bg-white"
            title="Eraser - Reset to unpainted"
          >
            <div
              className={`w-full h-8 rounded-lg flex items-center justify-between px-2 ${
                isEraserSelected ? "bg-gray-200" : "hover:bg-gray-200"
              }`}
            >
              {/* Small black dot on the left, same size as other color dots */}
              <div className="w-4 h-4 rounded-full bg-unpainted" />

              {/* Large eraser icon on the right */}
              <div className="flex items-center justify-center pr-0">
                <Eraser size={18} className="text-unpainted" />
              </div>
            </div>
          </button>
        </div>
      </Card>
    );
  }
);

PalettePanel.displayName = "PalettePanel";
