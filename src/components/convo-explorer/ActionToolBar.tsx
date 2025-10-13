"use client";

import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Hand, Paintbrush } from "lucide-react";

type ActionToolBarProps = {
  value: string; // always selected (controlled)
  onValueChange: (value: string) => void;
};

export function ActionToolBar({ value, onValueChange }: ActionToolBarProps) {
  // 1) Guard against Radix emitting empty string for "no selection"
  const handleValueChange = (next?: string) => {
    if (!next) return; // ignore '', null, undefined
    onValueChange(next);
  };

  // 2) Prevent the user action that would toggle-off the currently selected item
  //    - pointer events (mouse/touch)
  //    - keyboard space/enter (accessibility)
  const makePointerDownHandler =
    (itemValue: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
      if (value === itemValue) {
        // prevent the "press" from being processed by Radix -> no visual flicker
        e.preventDefault();
      }
    };

  const makeKeyDownHandler =
    (itemValue: string) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
      // space or enter would toggle; prevent when it's the active item
      if (value === itemValue && (e.key === " " || e.key === "Spacebar" || e.key === "Enter")) {
        e.preventDefault();
      }
    };

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      onValueChange={handleValueChange}
      className="flex bg-white"
      aria-label="Action toolbar: move map, paint groups"
    >
      <ToggleGroupItem
        value="paint-groups"
        aria-label="Paint groups"
        onPointerDown={makePointerDownHandler("paint-groups")}
        onKeyDown={makeKeyDownHandler("paint-groups")}
        className="data-[state=on]:bg-sky-600 data-[state=on]:text-white"
      >
        <Paintbrush className="h-5 w-5" />
      </ToggleGroupItem>

      <ToggleGroupItem
        value="move-map"
        aria-label="Move map"
        onPointerDown={makePointerDownHandler("move-map")}
        onKeyDown={makeKeyDownHandler("move-map")}
        className="data-[state=on]:bg-sky-600 data-[state=on]:text-white"
      >
        <Hand className="h-5 w-5" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}