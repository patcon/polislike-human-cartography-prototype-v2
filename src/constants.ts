export const PALETTE_COLORS = [
    "#1f77b4", // blue
    "#ff7f0e", // orange
    "#2ca02c", // green
    "#d62728", // red
    "#9467bd", // purple
    "#8c564b", // brown
    "#e377c2", // pink
    "#7f7f7f", // gray
    "#bcbd22", // lime
    "#17becf", // teal
];

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
