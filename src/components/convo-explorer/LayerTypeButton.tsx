import React from "react";
import type { SVGProps } from "react";

type Props = {
  icon: React.ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  selected?: boolean;
  onClick?: () => void;
  size?: number; // optional square size in px, defaults to 80
  disabled?: boolean;
};

export function LayerTypeButton({
  icon: Icon,
  label,
  selected = false,
  onClick,
  size = 80,
  disabled = false,
}: Props) {
  // Tailwind cannot read dynamic inline px, so we set width/height inline but
  // still use utility classes for everything else.
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-pressed={selected}
      disabled={disabled}
      className={`flex flex-col items-center gap-2 focus:outline-sky-600 ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center rounded-xl inset-ring-4 inset-ring-white
        ${selected ? "ring-4 ring-sky-600 bg-gray-100" : "bg-gray-100"}
        ${disabled ? "bg-gray-50" : ""}`}
      >
        <Icon
          className={`w-[${Math.round(size * 0.4)}px] h-[${Math.round(
            size * 0.4
          )}px] ${
            selected ? "text-sky-600" : disabled ? "text-gray-400" : "text-gray-700"
          }`}
        />
      </div>
      <span
        className={`text-sm font-medium ${
          selected ? "text-sky-600" : disabled ? "text-gray-400" : "text-gray-700"
        }`}
      >
        {label}
      </span>
    </button>
  );
}
