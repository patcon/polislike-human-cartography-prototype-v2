"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { PALETTE_COLORS, PALETTE_COLOR_NAMES, UNPAINTED_INDEX } from "@/constants";
import { Eraser } from "lucide-react";

type PalettePanelProps = {
  activeIndex: number; // UNPAINTED_INDEX means eraser is selected
  onSelectIndex?: (index: number) => void;
  onEraserReselect?: () => void;
} & React.ComponentPropsWithoutRef<typeof Card>; // allow extra props

export const PalettePanel = React.forwardRef<HTMLDivElement, PalettePanelProps>(
  ({ activeIndex, onSelectIndex, onEraserReselect, className, ...props }, ref) => {
    const isEraserSelected = activeIndex === UNPAINTED_INDEX;

    const handleEraserClick = () => {
      // If eraser is already selected, trigger the callback
      if (isEraserSelected) {
        onEraserReselect?.();
      } else {
        onSelectIndex?.(UNPAINTED_INDEX);
      }
    };

    return (
      <Card ref={ref} className={`p-1 inline-block ${className ?? ""}`} {...props}>
        <div className="grid grid-cols-2 gap-1">
          {/* Create visual order: 1,2,3,4,5,6,7,8,9,0 (but keep original indices) */}
          {PALETTE_COLORS.slice(1).concat(PALETTE_COLORS.slice(0, 1)).map((color, visualIndex) => {
            // Map visual index back to actual index: visual 0-8 = actual 1-9, visual 9 = actual 0
            const actualIndex = visualIndex < PALETTE_COLORS.length - 1 ? visualIndex + 1 : 0;
            const isSelected = actualIndex === activeIndex;
            const keyNumber = actualIndex === 0 ? '0' : actualIndex.toString();
            const colorName = PALETTE_COLOR_NAMES[color] || color;
            
            return (
              <button
                key={color}
                onClick={() => onSelectIndex?.(actualIndex)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white"
                title={`${colorName} (${keyNumber})`}
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
            onClick={handleEraserClick}
            className="col-span-2 h-8 flex items-center justify-center rounded-lg bg-white group"
            title="Eraser - Reset to unpainted (Delete)"
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
                <Eraser
                  size={18}
                  className={`text-unpainted ${
                    isEraserSelected ? "group-hover:text-red-500 transition-colors" : ""
                  }`}
                />
              </div>
            </div>
          </button>
        </div>
      </Card>
    );
  }
);

PalettePanel.displayName = "PalettePanel";
