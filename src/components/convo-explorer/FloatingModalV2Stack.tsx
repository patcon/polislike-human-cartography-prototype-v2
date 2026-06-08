"use client";

import { FloatingModalV2 } from "./FloatingModalV2";
import type { FloatingModalV2Variant, LegendItem } from "./FloatingModalV2";

type Statement = {
  txt: string;
  statement_id: number;
  moderated?: number;
};

export type StackItem = {
  id: string | number;
  statement?: Statement;
  title?: string;
  legendItems?: LegendItem[];
  variant?: FloatingModalV2Variant;
  onClose?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
};

type FloatingModalV2StackProps = {
  items: StackItem[];
  isVisible?: boolean;
};

const getTranslateX = (variant: FloatingModalV2Variant = "unstyled"): string => {
  if (variant === "agree")    return "calc(50dvw - 50% - 1rem)";
  if (variant === "disagree") return "calc(-50dvw + 50% + 1rem)";
  return "0";
};

export const FloatingModalV2Stack = ({ items, isVisible = true }: FloatingModalV2StackProps) => {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-22 left-0 right-0 z-40 flex flex-col gap-2 pointer-events-none">
      {items.map(({ id, variant = "unstyled", onClose, onPrev, onNext, ...rest }) => (
        <div
          key={id}
          className="pointer-events-auto w-4/5 mx-auto transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(${getTranslateX(variant)})` }}
        >
          <FloatingModalV2
            variant={variant}
            onClose={onClose}
            onPrev={onPrev}
            onNext={onNext}
            {...rest}
          />
        </div>
      ))}
    </div>
  );
};

FloatingModalV2Stack.displayName = "FloatingModalV2Stack";
