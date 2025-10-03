"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { X } from "lucide-react";

type Statement = {
  txt: string;
  statement_id: number;
  moderated?: number;
};

type FloatingModalProps = {
  statement: Statement;
  isVisible?: boolean;
  onClose?: () => void;
} & React.ComponentPropsWithoutRef<typeof Card>;

export const FloatingModal = React.forwardRef<HTMLDivElement, FloatingModalProps>(
  ({ statement, isVisible = true, onClose, className, ...props }, ref) => {
    if (!isVisible) return null;

    const insertBreaks = (val: string | null | undefined) => {
      if (!val) return "";
      const ZWSP = "\u200B";
      return val
        .replace(/(?<!:)\/(?!\/)/g, "/" + ZWSP)
        .replace(/,(?!\s)/g, "," + ZWSP)
        .replace(/([A-Za-z]{20})(?=[A-Za-z])/g, "$1" + ZWSP);
    };

    return (
      <Card
        ref={ref}
        className={`fixed bottom-22 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-screen sm:max-w-screen-sm z-40 p-4 bg-white dark:bg-gray-900 shadow-lg border border-gray-200 dark:border-gray-700 ${className ?? ""}`}
        {...props}
      >
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Statement content */}
        <div className={`flex items-start gap-3 ${onClose ? 'pr-8' : ''}`}>
          {/* Statement ID */}
          <div className="flex-shrink-0 pt-0.5">
            <span className="text-gray-400 text-[12px] font-mono w-10 inline-block text-right">
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
      </Card>
    );
  }
);

FloatingModal.displayName = "FloatingModal";