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

export type FloatingModalV2Variant = "unstyled" | "agree" | "disagree" | "pass";

type FloatingModalV2Props = {
  statement?: Statement;
  title?: string;
  legendItems?: LegendItem[];
  isVisible?: boolean;
  variant?: FloatingModalV2Variant;
  onClose?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
} & React.ComponentPropsWithoutRef<typeof Card>;

const variantBorder: Record<FloatingModalV2Variant, string> = {
  unstyled:  "border-gray-200 dark:border-gray-700",
  agree:     "border-green-400 dark:border-green-600",
  disagree:  "border-red-400 dark:border-red-600",
  pass:      "border-yellow-400 dark:border-yellow-600",
};

const variantIdText: Record<FloatingModalV2Variant, string> = {
  unstyled:  "text-gray-400",
  agree:     "text-green-600 dark:text-green-400",
  disagree:  "text-red-600 dark:text-red-400",
  pass:      "text-yellow-600 dark:text-yellow-400",
};

export const FloatingModalV2 = React.forwardRef<HTMLDivElement, FloatingModalV2Props>(
  ({ statement, title, legendItems, isVisible = true, variant = "unstyled", onClose, onPrev, onNext, className, ...props }, ref) => {
    if (!isVisible) return null;

    const insertBreaks = (val: string | null | undefined) => {
      if (!val) return "";
      const ZWSP = "​";
      return val
        .replace(/(?<!:)\/(?!\/)/g, "/" + ZWSP)
        .replace(/,(?!\s)/g, "," + ZWSP)
        .replace(/([A-Za-z]{20})(?=[A-Za-z])/g, "$1" + ZWSP);
    };

    const hasNav = onPrev || onNext;
    const cardPadding = hasNav ? "pt-4 pl-3 pr-12 pb-5" : "p-4";
    const cardMinH    = hasNav ? "min-h-24" : "";

    return (
      <Card
        ref={ref}
        className={`bg-white dark:bg-gray-900 shadow-lg ${variantBorder[variant]} ${cardPadding} ${cardMinH} ${className ?? ""}`}
        {...props}
      >
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {onPrev && (
          <button
            onClick={onPrev}
            aria-label="Previous statement"
            className="absolute bottom-3 left-3 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        {onNext && (
          <button
            onClick={onNext}
            aria-label="Next statement"
            className="absolute bottom-3 right-3 rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        {statement ? (
          <div className="flex gap-2 items-start">
            <div className="flex-shrink-0 pt-0.5">
              <span className={`text-[12px] font-mono inline-block text-right ${variantIdText[variant]} ${hasNav ? "min-w-[3rem]" : "w-10"}`}>
                #{statement.statement_id}
              </span>
            </div>

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
          <div className="flex flex-col gap-2 pl-10">
            {title && (
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-none text-center w-full block">
                {title}
              </span>
            )}
            {legendItems && legendItems.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {legendItems.map(({ label, color }) => {
                  const isBlank = label.trim() === "";
                  const displayLabel = isBlank ? "N/A" : label;
                  return (
                    <div key={label} className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs text-gray-800 dark:text-gray-200">
                        {displayLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>
    );
  }
);

FloatingModalV2.displayName = "FloatingModalV2";
