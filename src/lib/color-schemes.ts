import * as d3 from "d3";
import { PALETTE_COLORS } from "@/constants";

export type ObsColumnType = "boolean" | "categorical" | "continuous";

// Boolean: true = blue, false = light gray
export const BOOLEAN_COLORS = { true: "#1f77b4", false: "#d3d3d3" } as const;

// Null/missing points
export const NULL_COLOR = "#d3d3d3";
export const HIDE_NULL_POINTS = true; // true = opacity 0, false = light gray

// Continuous: light-to-dark blue
export function createContinuousScale() {
  return d3.scaleSequential(d3.interpolateViridis).domain([0, 1]);
}

// Categorical: reuses PALETTE_COLORS indexed by category code
export function getCategoricalColor(index: number): string {
  return PALETTE_COLORS[index % PALETTE_COLORS.length];
}
