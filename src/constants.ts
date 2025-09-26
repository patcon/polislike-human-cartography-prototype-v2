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

// Index value representing unpainted/eraser selection
export const UNPAINTED_INDEX = -1;

/**
 * Type representing a point group assignment.
 * - number (0-9): Colored group index corresponding to PALETTE_COLORS
 * - null: Unpainted (legacy representation)
 * - -1: Unpainted (UNPAINTED_INDEX constant)
 *
 * Note: Both null and -1 are treated as unpainted for backward compatibility.
 */
export type PointGroupAssignment = number | null;

/**
 * Helper function to check if a point group assignment represents an unpainted point.
 * Returns true for both null and -1 (UNPAINTED_INDEX).
 */
export function isUnpainted(assignment: PointGroupAssignment): boolean {
  return assignment === null || assignment === UNPAINTED_INDEX;
}

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
