"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

type DisplayItem = StackItem & { status: "entering" | "visible" | "exiting" };

const TRANSITION_MS = 300;

const getTranslateX = (variant: FloatingModalV2Variant = "unstyled"): string => {
  if (variant === "agree")    return "calc(50dvw - 50% - 1rem)";
  if (variant === "disagree") return "calc(-50dvw + 50% + 1rem)";
  return "0";
};

export const FloatingModalV2Stack = ({ items, isVisible = true }: FloatingModalV2StackProps) => {
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>(
    () => items.map(item => ({ ...item, status: "visible" as const }))
  );

  // Refs to outer wrapper divs — used for FLIP vertical position tracking
  const outerRefs = useRef<Map<string | number, HTMLDivElement>>(new Map());
  // Last known offsetTop for each item (layout position, unaffected by CSS transform)
  const lastTops = useRef<Map<string | number, number>>(new Map());

  // Sync displayItems with incoming items prop
  useEffect(() => {
    setDisplayItems(prev => {
      const nextMap = new Map(items.map(i => [i.id, i]));

      const result: DisplayItem[] = [];

      // Add items in new order, carrying over animation status
      items.forEach(item => {
        const prevItem = prev.find(p => p.id === item.id);
        result.push({
          ...item,
          status: prevItem
            ? (prevItem.status === "exiting" ? "visible" : prevItem.status)
            : "entering",
        });
      });

      // Append items being removed (keep them visible in DOM so they can fade out)
      prev.forEach(item => {
        if (!nextMap.has(item.id)) {
          result.push({ ...item, status: "exiting" });
        }
      });

      return result;
    });
  }, [items]);

  // Advance entering → visible on the next animation frame (lets the browser paint
  // the initial opacity-0 state before starting the fade-in transition)
  useEffect(() => {
    if (!displayItems.some(i => i.status === "entering")) return;
    const raf = requestAnimationFrame(() => {
      setDisplayItems(prev =>
        prev.map(i => (i.status === "entering" ? { ...i, status: "visible" } : i))
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [displayItems]);

  // Remove exiting items from state after the CSS transition finishes
  useEffect(() => {
    if (!displayItems.some(i => i.status === "exiting")) return;
    const timer = setTimeout(() => {
      setDisplayItems(prev => prev.filter(i => i.status !== "exiting"));
    }, TRANSITION_MS + 50);
    return () => clearTimeout(timer);
  }, [displayItems]);

  // FLIP: detect vertical position changes and animate items to their new positions.
  // Runs after React updates the DOM but before the browser paints.
  useLayoutEffect(() => {
    const currentIds = new Set(displayItems.map(i => i.id));

    displayItems.forEach(item => {
      if (item.status === "exiting") return;
      const el = outerRefs.current.get(item.id);
      if (!el) return;

      // offsetTop is layout-based and unaffected by CSS transforms
      const newTop = el.offsetTop;
      const prevTop = lastTops.current.get(item.id);

      if (prevTop !== undefined && Math.abs(prevTop - newTop) > 1) {
        const delta = prevTop - newTop;
        // Snap to old position instantly, then animate to new position
        el.style.transition = "none";
        el.style.transform = `translateY(${delta}px)`;
        el.getBoundingClientRect(); // force reflow so the browser registers the snap
        el.style.transition = `transform ${TRANSITION_MS}ms ease-in-out`;
        el.style.transform = "translateY(0)";
      }

      lastTops.current.set(item.id, newTop);
    });

    // Clean up entries for items that have fully left the DOM
    lastTops.current.forEach((_, id) => {
      if (!currentIds.has(id)) lastTops.current.delete(id);
    });
  }, [displayItems]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-22 left-0 right-0 z-40 flex flex-col gap-2 pointer-events-none">
      {displayItems.map(({ status, id, variant = "unstyled", onClose, onPrev, onNext, ...rest }) => (
        <div
          key={id}
          ref={el => {
            if (el) outerRefs.current.set(id, el);
            else outerRefs.current.delete(id);
          }}
        >
          <div
            className="pointer-events-auto w-4/5 mx-auto"
            style={{
              transform: `translateX(${getTranslateX(variant)})`,
              opacity: status === "visible" ? 1 : 0,
              transition: `transform ${TRANSITION_MS}ms ease-in-out, opacity ${TRANSITION_MS}ms ease-in-out`,
            }}
          >
            <FloatingModalV2
              variant={variant}
              onClose={onClose}
              onPrev={onPrev}
              onNext={onNext}
              {...rest}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

FloatingModalV2Stack.displayName = "FloatingModalV2Stack";
