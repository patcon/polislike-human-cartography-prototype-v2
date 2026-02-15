// Color definitions with human-readable names
export const PALETTE_COLOR_DEFINITIONS = [
    { name: "Blue", hex: "#1f77b4" },
    { name: "Orange", hex: "#ff7f0e" },
    { name: "Green", hex: "#2ca02c" },
    { name: "Red", hex: "#d62728" },
    { name: "Purple", hex: "#9467bd" },
    { name: "Brown", hex: "#8c564b" },
    { name: "Pink", hex: "#e377c2" },
    { name: "Gray", hex: "#7f7f7f" },
    { name: "Lime", hex: "#bcbd22" },
    { name: "Teal", hex: "#17becf" },
];

// Generate the palette colors array from definitions
export const PALETTE_COLORS = PALETTE_COLOR_DEFINITIONS.map(color => color.hex);

// Generate color name mapping for easy lookup
export const PALETTE_COLOR_NAMES: Record<string, string> = Object.fromEntries(
    PALETTE_COLOR_DEFINITIONS.map(color => [color.hex, color.name])
);

// Color for unpainted points (matches the default black color in D3Map)
export const UNPAINTED_COLOR = "#000000";

// Value representing unpainted/eraser selection
export const UNPAINTED_VALUE = -1;

/**
 * Type representing a point group assignment.
 * - number (0-9): Colored group index corresponding to PALETTE_COLORS
 * - UNPAINTED_VALUE (-1): Unpainted points
 */
export type PointGroupAssignment = number;

export const INITIAL_ACTION = "paint-groups";

// Chart colors for vote visualization
export const VOTE_COLORS = {
    agree: "#2ecc71",
    disagree: "#e74c3c",
    pass: "#e6e6e6",
};

// Alternative vote colors with highlighted pass votes
export const VOTE_COLORS_HIGHLIGHT_PASS = {
    agree: "#2ecc71",
    disagree: "#e74c3c",
    pass: "#f1c40f", // Yellow for highlighted pass votes
};

// When true, null/missing metric points get opacity 0 (hidden) instead of constant 0.9.
// This causes per-element opacity computation which can hurt animation performance.
export const FEATURE_HIDE_NULL_METRICS = true;

// Outline applied to the SVG point cluster group (uses feMorphology dilate, not blur)
export const OUTLINE_RADIUS = 0; // feMorphology dilate radius in px
export const OUTLINE_OPACITY = 1; // alpha of the outline fill
export const OUTLINE_SUSPEND_DURING_ANIMATION = true; // disable filter during projection animation for performance
