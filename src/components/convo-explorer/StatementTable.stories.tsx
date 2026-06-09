import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatementTable } from "./StatementTable";
import type { Statement } from "./StatementExplorerDrawer";
import type { GroupVoteData } from "./GroupVoteComparisonWidget";

const meta: Meta<typeof StatementTable> = {
  title: "Components/StatementTable",
  component: StatementTable,
};

export default meta;

type Story = StoryObj<typeof StatementTable>;

// Default sample statements
const defaultStatements: Statement[] = [
  { statement_id: 1, txt: "This is a normal statement.", moderated: 1 },
  { statement_id: 2, txt: "This statement was moderated out.", moderated: -1 },
  {
    statement_id: 3,
    txt: "This statement is unmoderated, and without knowing strict moderation setting for conversation, we're not sure its status.",
    moderated: 0,
  },
];

// Statement that demonstrates break after slash but not protocol
const slashStatement: Statement[] = [
  {
    statement_id: 5,
    txt: "Visit mysite.com/path/to/resource or https://example.com/path/should/notbreak",
    moderated: 1,
  },
];

// Statement that demonstrates break after comma without space
const commaStatement: Statement[] = [
  {
    statement_id: 6,
    txt: "Apples,Oranges,Bananas,Mangoes.Apples,Oranges,Bananas,Mangoes",
    moderated: 1,
  },
];

// Statement that demonstrates breaking every 20 letters
const longLettersStatement: Statement[] = [
  {
    statement_id: 7,
    txt: "AverylongstatementwithoutspaceswhichshouldbreakproperlyintoZWSPsSoWeCanSeeIfItWrapsCorrectlyInTheTableCell",
    moderated: 1,
  },
];

// Sample group vote data for statements
const sampleGroupVoteData: Record<number, GroupVoteData[]> = {
  1: [
    {
      groupIndex: 3, // Blue
      n_agree: 15,
      n_disagree: 5,
      n_pass: 8,
      n_trials: 28,
      totalGroupSize: 35,
    },
    {
      groupIndex: 4, // Orange
      n_agree: 8,
      n_disagree: 18,
      n_pass: 4,
      n_trials: 30,
      totalGroupSize: 32,
    },
    {
      groupIndex: 6, // Pink
      n_agree: 12,
      n_disagree: 12,
      n_pass: 6,
      n_trials: 30,
      totalGroupSize: 30,
    },
  ],
  2: [
    {
      groupIndex: 3, // Blue
      n_agree: 5,
      n_disagree: 20,
      n_pass: 3,
      n_trials: 28,
      totalGroupSize: 35,
    },
    {
      groupIndex: 4, // Orange
      n_agree: 3,
      n_disagree: 22,
      n_pass: 5,
      n_trials: 30,
      totalGroupSize: 32,
    },
    {
      groupIndex: 6, // Pink
      n_agree: 8,
      n_disagree: 18,
      n_pass: 4,
      n_trials: 30,
      totalGroupSize: 30,
    },
  ],
  3: [
    {
      groupIndex: 3, // Blue
      n_agree: 2,
      n_disagree: 3,
      n_pass: 18,
      n_trials: 23,
      totalGroupSize: 35,
    },
    {
      groupIndex: 4, // Orange
      n_agree: 4,
      n_disagree: 5,
      n_pass: 16,
      n_trials: 25,
      totalGroupSize: 32,
    },
    {
      groupIndex: 6, // Pink
      n_agree: 3,
      n_disagree: 4,
      n_pass: 20,
      n_trials: 27,
      totalGroupSize: 30,
    },
  ],
};

export const Default: Story = {
  args: {
    statements: defaultStatements,
  },
};

export const WithGroupVotes: Story = {
  args: {
    statements: defaultStatements,
    showGroupVotes: true,
    groupVoteData: sampleGroupVoteData,
    includeMissingVotes: false,
  },
};

export const WithGroupVotesAndMissing: Story = {
  args: {
    statements: defaultStatements,
    showGroupVotes: true,
    groupVoteData: sampleGroupVoteData,
    includeMissingVotes: true,
  },
};

export const LineBreaks: Story = {
  args: {
    statements: [
      ...defaultStatements,
      ...slashStatement,
      ...commaStatement,
      ...longLettersStatement,
    ],
  },
};

export const LineBreaksWithGroupVotes: Story = {
  args: {
    statements: [
      ...defaultStatements,
      ...slashStatement,
      ...commaStatement,
      ...longLettersStatement,
    ],
    showGroupVotes: true,
    groupVoteData: {
      ...sampleGroupVoteData,
      5: [
        {
          groupIndex: 0,
          n_agree: 20,
          n_disagree: 8,
          n_pass: 2,
          n_trials: 30,
          totalGroupSize: 35,
        },
        {
          groupIndex: 1,
          n_agree: 18,
          n_disagree: 10,
          n_pass: 4,
          n_trials: 32,
          totalGroupSize: 35,
        },
      ],
      6: [
        {
          groupIndex: 2,
          n_agree: 5,
          n_disagree: 25,
          n_pass: 5,
          n_trials: 35,
          totalGroupSize: 40,
        },
      ],
      7: [
        {
          groupIndex: 7,
          n_agree: 8,
          n_disagree: 8,
          n_pass: 14,
          n_trials: 30,
          totalGroupSize: 35,
        },
        {
          groupIndex: 8,
          n_agree: 12,
          n_disagree: 6,
          n_pass: 12,
          n_trials: 30,
          totalGroupSize: 32,
        },
      ],
    },
    includeMissingVotes: true,
  },
};
