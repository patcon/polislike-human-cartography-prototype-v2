"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Statement = {
  txt: string;
  statement_id: number;
  moderated?: number;
};

export type LegendItem = { label: string; color: string };

type FloatingModalProps = {
  // Statement mode (existing)
  statement?: Statement;
  // Annotation/legend mode
  title?: string;
  legendItems?: LegendItem[];
  isVisible?: boolean;
  onClose?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
} & React.ComponentPropsWithoutRef<typeof Card>;

export const FloatingModal = React.forwardRef<HTMLDivElement, FloatingModalProps>(
  ({ statement, title, legendItems, isVisible = true, onClose, onPrev, onNext, className, ...props }, ref) => {
    if (!isVisible) return null;

    const insertBreaks = (val: string | null | undefined) => {
      if (!val) return "";
      const ZWSP = "\u200B";
      return val
        .replace(/(?<!:)\/(?!\/)/g, "/" + ZWSP)
        .replace(/,(?!\s)/g, "," + ZWSP)
        .replace(/([A-Za-z]{20})(?=[A-Za-z])/g, "$1" + ZWSP);
    };

    // Padding adjusted from the original p-4:
    //   pl-3  — small left margin so the ID can sit close to (or overlap) the ← button
    //   pr-12 — clears X and → which are both at right-3; → is 36px wide → 12+36=48px
    //   pb-5  — 20px = bottom-3(12) + p-2(8): aligns text bottom with icon bottoms
    //   pt-4  — unchanged from original
    // min-h-28 ensures X and → don't overlap on very short statements.
    const hasNav = onPrev || onNext;
    const cardPadding = hasNav ? "pt-4 pl-3 pr-12 pb-5" : "p-4";
    const cardMinH    = hasNav ? "min-h-24" : "";

    return (
      <Card
        ref={ref}
        className={`fixed bottom-22 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-screen sm:max-w-screen-sm z-40 bg-white dark:bg-gray-900 shadow-lg border border-gray-200 dark:border-gray-700 ${cardPadding} ${cardMinH} ${className ?? ""}`}
        {...props}
      >
        {/* X — top-right; directly above → */}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* ← — bottom-left; screen position fixed because card is `fixed bottom-22` */}
        {onPrev && (
          <button
            onClick={onPrev}
            aria-label="Previous statement"
            className="absolute bottom-3 left-3 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        {/* → — bottom-right, same right-3 column as X */}
        {onNext && (
          <button
            onClick={onNext}
            aria-label="Next statement"
            className="absolute bottom-3 right-3 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        {/* Content: statement mode or annotation/legend mode */}
        {statement ? (
          <div className="flex gap-2 items-start">
            {/* Statement ID */}
            <div className="flex-shrink-0 pt-0.5">
              <span className={`text-gray-400 text-[12px] font-mono inline-block text-right ${hasNav ? "min-w-[3rem]" : "w-10"}`}>
                #{statement.statement_id}
              </span>
            </div>

            {/* Statement Text */}
            <div className="flex-1 min-w-0">
              <span
                key={statement.statement_id}
                translate="yes"
                className={`text-sm leading-relaxed ${
                  statement.moderated === -1 ? "text-red-700" : ""
                } ${
                  statement.moderated === 0 ? "text-gray-500" : ""
                } ${
                  statement.moderated === 1 ? "text-gray-900 dark:text-gray-100" : ""
                } ${
                  statement.moderated === undefined ? "text-gray-900 dark:text-gray-100" : ""
                }`}
              >
                {insertBreaks(statement.txt)}
                {statement.moderated === -1 ? " (moderated)" : ""}
                {statement.moderated === 0 ? " (unmoderated)" : ""}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Annotation label */}
            {title && (
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-none">
                {title}
              </span>
            )}
            {/* Category swatches */}
            {legendItems && legendItems.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {legendItems.map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs text-gray-800 dark:text-gray-200">{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    );
  }
);

FloatingModal.displayName = "FloatingModal";
