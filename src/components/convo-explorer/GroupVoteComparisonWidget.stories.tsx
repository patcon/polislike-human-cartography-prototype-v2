import type { Meta, StoryObj } from "@storybook/react-vite";
import { GroupVoteComparisonWidget } from "./GroupVoteComparisonWidget";
import { VOTE_COLORS, VOTE_COLORS_HIGHLIGHT_PASS } from "@/constants";

const meta: Meta<typeof GroupVoteComparisonWidget> = {
  title: "Components/GroupVoteComparisonWidget",
  component: GroupVoteComparisonWidget,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    includeMissingVotes: {
      control: "boolean",
      description: "Whether to include unseen participants in the visualization",
    },
    height: {
      control: { type: "range", min: 5, max: 100, step: 1 },
      description: "Height of the vertical bars in pixels",
    },
    width: {
      control: { type: "range", min: 3, max: 50, step: 1 },
      description: "Width of each column in pixels",
    },
    voteColors: {
      control: "select",
      options: ["VOTE_COLORS", "VOTE_COLORS_HIGHLIGHT_PASS"],
      mapping: {
        VOTE_COLORS: VOTE_COLORS,
        VOTE_COLORS_HIGHLIGHT_PASS: VOTE_COLORS_HIGHLIGHT_PASS,
      },
      description: "Vote color palette to use",
    },
    voteOrder: {
      control: "text",
      description: "Order of vote types from top to bottom (U=unseen, D=disagree, P=pass, A=agree)",
    },
    highlightGroupIndex: {
      control: { type: "number", min: -1, max: 9, step: 1 },
      description: "Group index to highlight (dims other columns)",
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Sample data for 4 groups with different voting patterns
const sampleGroupVotes = [
  {
    groupIndex: 3, // Blue group
    n_agree: 15,
    n_disagree: 5,
    n_pass: 8,
    n_trials: 28,
    totalGroupSize: 35, // 7 people didn't vote on this statement
  },
  {
    groupIndex: 4, // Orange group
    n_agree: 8,
    n_disagree: 18,
    n_pass: 4,
    n_trials: 30,
    totalGroupSize: 32, // 2 people didn't vote
  },
  {
    groupIndex: 6, // Pink group
    n_agree: 12,
    n_disagree: 12,
    n_pass: 6,
    n_trials: 30,
    totalGroupSize: 30, // Everyone voted
  },
  {
    groupIndex: 7, // Gray group
    n_agree: 3,
    n_disagree: 2,
    n_pass: 15,
    n_trials: 20,
    totalGroupSize: 25, // 5 people didn't vote
  },
];

export const Default: Story = {
  args: {
    groupVotes: sampleGroupVotes,
    includeMissingVotes: false,
    height: 40,
    width: 12,
    highlightGroupIndex: 3, // Highlight the first group (blue)
  },
};

export const WithMissingVotes: Story = {
  args: {
    groupVotes: sampleGroupVotes,
    includeMissingVotes: true,
    height: 40,
  },
};

export const TallBars: Story = {
  args: {
    groupVotes: sampleGroupVotes,
    includeMissingVotes: false,
    height: 60,
  },
};

export const ShortBars: Story = {
  args: {
    groupVotes: sampleGroupVotes,
    includeMissingVotes: false,
    height: 25,
  },
};

// Example with strong consensus (mostly agree)
const strongAgreeVotes = [
  {
    groupIndex: 0, // First color
    n_agree: 25,
    n_disagree: 2,
    n_pass: 3,
    n_trials: 30,
    totalGroupSize: 35,
  },
  {
    groupIndex: 1, // Second color
    n_agree: 22,
    n_disagree: 1,
    n_pass: 4,
    n_trials: 27,
    totalGroupSize: 30,
  },
  {
    groupIndex: 2, // Third color
    n_agree: 18,
    n_disagree: 3,
    n_pass: 2,
    n_trials: 23,
    totalGroupSize: 25,
  },
];

export const StrongConsensusAgree: Story = {
  args: {
    groupVotes: strongAgreeVotes,
    includeMissingVotes: false,
    height: 40,
  },
};

// Example with polarized voting (strong disagreement between groups)
const polarizedVotes = [
  {
    groupIndex: 2, // Green
    n_agree: 28,
    n_disagree: 2,
    n_pass: 5,
    n_trials: 35,
    totalGroupSize: 40,
  },
  {
    groupIndex: 3, // Red
    n_agree: 3,
    n_disagree: 25,
    n_pass: 7,
    n_trials: 35,
    totalGroupSize: 38,
  },
];

export const PolarizedVoting: Story = {
  args: {
    groupVotes: polarizedVotes,
    includeMissingVotes: true,
    height: 50,
  },
};

// Example with mostly pass votes
const mostlyPassVotes = [
  {
    groupIndex: 5, // Brown
    n_agree: 3,
    n_disagree: 4,
    n_pass: 18,
    n_trials: 25,
    totalGroupSize: 30,
  },
  {
    groupIndex: 8, // Lime
    n_agree: 2,
    n_disagree: 3,
    n_pass: 20,
    n_trials: 25,
    totalGroupSize: 28,
  },
];

export const MostlyPassVotes: Story = {
  args: {
    groupVotes: mostlyPassVotes,
    includeMissingVotes: true,
    height: 40,
  },
};

// Single group example
export const SingleGroup: Story = {
  args: {
    groupVotes: [sampleGroupVotes[0]],
    includeMissingVotes: false,
    height: 40,
  },
};

// Empty data
export const EmptyData: Story = {
  args: {
    groupVotes: [],
    includeMissingVotes: false,
    height: 40,
  },
};

// Example showing all 10 palette colors
const allColorsVotes = Array.from({ length: 10 }, (_, i) => ({
  groupIndex: i,
  n_agree: Math.floor(Math.random() * 20) + 5,
  n_disagree: Math.floor(Math.random() * 15) + 3,
  n_pass: Math.floor(Math.random() * 10) + 2,
  n_trials: 0,
  totalGroupSize: Math.floor(Math.random() * 10) + 25,
})).map(vote => ({
  ...vote,
  n_trials: vote.n_agree + vote.n_disagree + vote.n_pass,
}));

export const AllPaletteColors: Story = {
  args: {
    groupVotes: allColorsVotes,
    includeMissingVotes: true,
    height: 35,
  },
};

// Example with very low vote counts
const lowVoteCountData = [
  {
    groupIndex: 2, // Green
    n_agree: 1,
    n_disagree: 0,
    n_pass: 1,
    n_trials: 2,
    totalGroupSize: 25,
  },
  {
    groupIndex: 3, // Red
    n_agree: 0,
    n_disagree: 1,
    n_pass: 0,
    n_trials: 1,
    totalGroupSize: 30,
  },
  {
    groupIndex: 5, // Brown
    n_agree: 0,
    n_disagree: 0,
    n_pass: 2,
    n_trials: 2,
    totalGroupSize: 20,
  },
  {
    groupIndex: 7, // Gray
    n_agree: 1,
    n_disagree: 1,
    n_pass: 1,
    n_trials: 3,
    totalGroupSize: 35,
  },
];

export const LowVoteCounts: Story = {
  args: {
    groupVotes: lowVoteCountData,
    includeMissingVotes: false,
    height: 40,
  },
};

export const LowVoteCountsWithMissing: Story = {
  args: {
    groupVotes: lowVoteCountData,
    includeMissingVotes: true,
    height: 40,
  },
};

// Example with some groups having zero votes
const zeroVoteData = [
  {
    groupIndex: 1, // Orange
    n_agree: 0,
    n_disagree: 0,
    n_pass: 0,
    n_trials: 0,
    totalGroupSize: 25,
  },
  {
    groupIndex: 4, // Purple
    n_agree: 2,
    n_disagree: 1,
    n_pass: 0,
    n_trials: 3,
    totalGroupSize: 20,
  },
  {
    groupIndex: 8, // Lime
    n_agree: 0,
    n_disagree: 0,
    n_pass: 0,
    n_trials: 0,
    totalGroupSize: 30,
  },
];

export const ZeroVoteCounts: Story = {
  args: {
    groupVotes: zeroVoteData,
    includeMissingVotes: true,
    height: 40,
  },
};

// Example with highlighted pass votes (yellow)
export const HighlightedPassVotes: Story = {
  args: {
    groupVotes: [
      {
        groupIndex: 0,
        n_agree: 5,
        n_disagree: 3,
        n_pass: 12,
        n_trials: 20,
        totalGroupSize: 25,
      },
      {
        groupIndex: 2,
        n_agree: 8,
        n_disagree: 4,
        n_pass: 15,
        n_trials: 27,
        totalGroupSize: 30,
      },
    ],
    includeMissingVotes: false,
    height: 40,
    voteColors: VOTE_COLORS_HIGHLIGHT_PASS,
  },
};

// Example with single vote per group
const singleVoteData = [
  {
    groupIndex: 6, // Pink
    n_agree: 1,
    n_disagree: 0,
    n_pass: 0,
    n_trials: 1,
    totalGroupSize: 40,
  },
  {
    groupIndex: 9, // Teal
    n_agree: 0,
    n_disagree: 1,
    n_pass: 0,
    n_trials: 1,
    totalGroupSize: 35,
  },
  {
    groupIndex: 4, // Purple
    n_agree: 0,
    n_disagree: 0,
    n_pass: 1,
    n_trials: 1,
    totalGroupSize: 28,
  },
];

export const SingleVotePerGroup: Story = {
  args: {
    groupVotes: singleVoteData,
    includeMissingVotes: true,
    height: 50,
  },
};

// Example with custom vote order (Agree at top, then Pass, Disagree, Unseen)
export const CustomVoteOrder: Story = {
  args: {
    groupVotes: sampleGroupVotes,
    includeMissingVotes: true,
    height: 40,
    voteOrder: "APDU",
  },
};

// Example with another custom order (Pass at top for highlighting)
export const PassAtTop: Story = {
  args: {
    groupVotes: mostlyPassVotes,
    includeMissingVotes: true,
    height: 40,
    voteOrder: "PADU",
    voteColors: VOTE_COLORS_HIGHLIGHT_PASS,
  },
};

// Example with very small dimensions
export const VerySmall: Story = {
  args: {
    groupVotes: sampleGroupVotes.slice(0, 3), // Just 3 groups
    includeMissingVotes: false,
    height: 8,
    width: 4,
  },
};

// Example with very narrow columns
export const VeryNarrow: Story = {
  args: {
    groupVotes: sampleGroupVotes,
    includeMissingVotes: true,
    height: 30,
    width: 3,
  },
};

// Example with very short bars
export const VeryShort: Story = {
  args: {
    groupVotes: sampleGroupVotes,
    includeMissingVotes: false,
    height: 6,
    width: 8,
  },
};

// Example with highlighting feature
export const HighlightedGroup: Story = {
  args: {
    groupVotes: sampleGroupVotes,
    includeMissingVotes: false,
    height: 40,
    width: 12,
    highlightGroupIndex: 4, // Highlight the orange group
  },
};

// Example with highlighting and missing votes
export const HighlightedGroupWithMissing: Story = {
  args: {
    groupVotes: sampleGroupVotes,
    includeMissingVotes: true,
    height: 40,
    width: 12,
    highlightGroupIndex: 6, // Highlight the pink group
  },
};

// Example with no highlighting (all columns normal opacity)
export const NoHighlighting: Story = {
  args: {
    groupVotes: sampleGroupVotes,
    includeMissingVotes: false,
    height: 40,
    width: 12,
    // highlightGroupIndex is undefined, so no dimming occurs
  },
};