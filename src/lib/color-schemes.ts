import * as d3 from "d3";
import { PALETTE_COLORS } from "@/constants";

export type ObsColumnType = "boolean" | "categorical" | "continuous";

// Boolean: true = blue, false = light gray
export const BOOLEAN_COLORS = { true: "#1f77b4", false: "#d3d3d3" } as const;

// Null/missing points
export const NULL_COLOR = "#d3d3d3";

// Continuous: light-to-dark blue
export function createContinuousScale() {
  return d3.scaleSequential(d3.interpolateViridis).domain([0, 1]);
}

// Categorical: reuses PALETTE_COLORS indexed by category code
export function getCategoricalColor(index: number): string {
  return PALETTE_COLORS[index % PALETTE_COLORS.length];
}

// Annotation categorical palette — Tableau 20 (the standard 10 + their lighter paired variants).
// Gives more range for obs-column annotation layers without touching the painting palette.
export const ANNOTATION_PALETTE_COLORS: string[] = [
  "#1f77b4", "#aec7e8", // blue
  "#ff7f0e", "#ffbb78", // orange
  "#2ca02c", "#98df8a", // green
  "#d62728", "#ff9896", // red
  "#9467bd", "#c5b0d5", // purple
  "#8c564b", "#c49c94", // brown
  "#e377c2", "#f7b6d2", // pink
  "#7f7f7f", "#c7c7c7", // gray
  "#bcbd22", "#dbdb8d", // lime
  "#17becf", "#9edae5", // teal
];

export function getAnnotationCategoricalColor(index: number): string {
  return ANNOTATION_PALETTE_COLORS[index % ANNOTATION_PALETTE_COLORS.length];
}
