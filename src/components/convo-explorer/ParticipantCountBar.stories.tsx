"use client";

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ParticipantCountBar } from "./ParticipantCountBar";
import { UNPAINTED_VALUE } from "@/constants";

const meta = {
  title: "Components/ParticipantCountBar",
  component: ParticipantCountBar,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ParticipantCountBar>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sample data representing different point group scenarios
const samplePointGroups: number[] = [
  UNPAINTED_VALUE, UNPAINTED_VALUE, UNPAINTED_VALUE, UNPAINTED_VALUE, UNPAINTED_VALUE, // 5 unpainted points
  0, 0, 0, 0, 0, 0, 0, 0, // 8 blue points (A)
  1, 1, 1, 1, 1, // 5 orange points (B)
  2, 2, 2, 2, 2, 2, 2, 2, 2, 2, // 10 green points (C)
  4, 4, 4, // 3 purple points (E)
];

// Medium conversation (~250 points) with small selection (40 points)
const samplePointGroupsMed: number[] = [
  // 40 selected points across different groups
  ...Array(40).fill(0),   // 40 blue (A)
  // 210 unselected points (all unpainted)
  ...Array(210).fill(UNPAINTED_VALUE),
];

// Large conversation (~3000 points) with small selection (40 points)
const samplePointGroupsLarge: number[] = [
  // 40 selected points across different groups
  ...Array(40).fill(0),   // 40 blue (A)
  // 2960 unselected points (all unpainted)
  ...Array(2960).fill(UNPAINTED_VALUE),
];

// Helper function to generate random point groups
const generateRandomPointGroups = (totalPoints: number, selectedPoints: number): number[] => {
  const points: number[] = Array(totalPoints).fill(UNPAINTED_VALUE);

  // Randomly assign selected points to different groups
  const selectedIndices = new Set<number>();
  while (selectedIndices.size < selectedPoints) {
    selectedIndices.add(Math.floor(Math.random() * totalPoints));
  }

  selectedIndices.forEach(index => {
    // Randomly assign to groups 0-4 or leave as UNPAINTED_VALUE (unpainted)
    const groupChoice = Math.random();
    if (groupChoice < 0.2) points[index] = UNPAINTED_VALUE; // 20% unpainted
    else if (groupChoice < 0.4) points[index] = 0;    // 20% blue
    else if (groupChoice < 0.6) points[index] = 1;    // 20% orange
    else if (groupChoice < 0.75) points[index] = 2;   // 15% green
    else if (groupChoice < 0.9) points[index] = 3;    // 15% red
    else points[index] = 4;                           // 10% purple
  });

  return points;
};

export const Default: Story = {
  args: {
    pointGroups: samplePointGroups,
  },
  render: (args) => {
    const [isUnpaintedGrouped, setIsUnpaintedGrouped] = useState(false);

    return (
      <div className="w-full">
        <ParticipantCountBar
          {...args}
          isUnpaintedGrouped={isUnpaintedGrouped}
          onUnpaintedGroupedChange={setIsUnpaintedGrouped}
        />
      </div>
    );
  },
};

export const UncontrolledState: Story = {
  args: {
    pointGroups: samplePointGroups,
  },
  render: (args) => {
    return (
      <div className="w-full">
        <ParticipantCountBar {...args} />
      </div>
    );
  },
};

export const OnlyUnpainted: Story = {
  args: {
    pointGroups: [UNPAINTED_VALUE, UNPAINTED_VALUE, UNPAINTED_VALUE, UNPAINTED_VALUE, UNPAINTED_VALUE, UNPAINTED_VALUE, UNPAINTED_VALUE, UNPAINTED_VALUE, UNPAINTED_VALUE, UNPAINTED_VALUE],
  },
  render: (args) => {
    return (
      <div className="w-full">
        <ParticipantCountBar {...args} />
      </div>
    );
  },
};

export const NoUnpainted: Story = {
  args: {
    pointGroups: [
      0, 0, 0, 0, 0, // 5 blue points (A)
      1, 1, 1, // 3 orange points (B)
      3, 3, 3, 3, 3, 3, 3, // 7 red points (D)
    ],
  },
  render: (args) => {
    return (
      <div className="w-full">
        <ParticipantCountBar {...args} />
      </div>
    );
  },
};

export const NotProportional: Story = {
  args: {
    pointGroups: samplePointGroups,
    isProportional: false,
  },
  render: (args) => {
    const [isUnpaintedGrouped, setIsUnpaintedGrouped] = useState(false);

    return (
      <div className="w-full">
        <ParticipantCountBar
          {...args}
          isUnpaintedGrouped={isUnpaintedGrouped}
          onUnpaintedGroupedChange={setIsUnpaintedGrouped}
        />
      </div>
    );
  },
};

export const EmptyGroups: Story = {
  args: {
    pointGroups: [],
  },
  render: (args) => {
    return (
      <div className="w-full">
        <ParticipantCountBar {...args} />
      </div>
    );
  },
};

export const SmallSelectionMediumConvo: Story = {
  args: {
    pointGroups: samplePointGroupsMed,
  },
  render: (args) => {
    const [isUnpaintedGrouped, setIsUnpaintedGrouped] = useState(false);

    return (
      <div className="w-full">
        <ParticipantCountBar
          {...args}
          isUnpaintedGrouped={isUnpaintedGrouped}
          onUnpaintedGroupedChange={setIsUnpaintedGrouped}
        />
      </div>
    );
  },
};

export const SmallSelectionLargeConvo: Story = {
  args: {
    pointGroups: samplePointGroupsLarge,
  },
  render: (args) => {
    const [isUnpaintedGrouped, setIsUnpaintedGrouped] = useState(false);

    return (
      <div className="w-full">
        <ParticipantCountBar
          {...args}
          isUnpaintedGrouped={isUnpaintedGrouped}
          onUnpaintedGroupedChange={setIsUnpaintedGrouped}
        />
      </div>
    );
  },
};

export const RandomMediumConvo: Story = {
  args: {
    pointGroups: generateRandomPointGroups(250, 40),
  },
  render: (args) => {
    const [isUnpaintedGrouped, setIsUnpaintedGrouped] = useState(false);
    const [pointGroups, setPointGroups] = useState(args.pointGroups);

    const regenerate = () => {
      setPointGroups(generateRandomPointGroups(250, 40));
    };

    return (
      <div className="w-full space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">
            Medium conversation (~250 points, 40 selected) - Refresh to see different patterns
          </span>
          <button
            onClick={regenerate}
            className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
          >
            Regenerate
          </button>
        </div>
        <ParticipantCountBar
          pointGroups={pointGroups}
          isUnpaintedGrouped={isUnpaintedGrouped}
          onUnpaintedGroupedChange={setIsUnpaintedGrouped}
        />
      </div>
    );
  },
};

// Exact participant counts from the screenshot in issue #12.
// Painted groups: [5, 104, 146, 393, 212, 187, 288, 143, 37, 18]; unpainted: 209.
const issueReproductionPointGroups: number[] = [
  ...Array(5).fill(0),    // 5 Blue (A)
  ...Array(104).fill(1),  // 104 Orange (B)
  ...Array(146).fill(2),  // 146 Green (C)
  ...Array(393).fill(3),  // 393 Red (D)
  ...Array(212).fill(4),  // 212 Purple (E)
  ...Array(187).fill(5),  // 187 Brown (F)
  ...Array(288).fill(6),  // 288 Pink (G)
  ...Array(143).fill(7),  // 143 Gray (H)
  ...Array(37).fill(8),   // 37 Lime (I)
  ...Array(18).fill(9),   // 18 Teal (J)
  ...Array(209).fill(UNPAINTED_VALUE), // 209 unpainted
];

export const CrowdedUnpaintedButton: Story = {
  args: {
    pointGroups: issueReproductionPointGroups,
  },
  render: (args) => {
    const [isUnpaintedGrouped, setIsUnpaintedGrouped] = useState(false);

    return (
      <div className="space-y-6 p-4">
        <p className="text-sm text-gray-500">
          Exact counts from issue #12 screenshot: painted [5, 104, 146, 393, 212, 187, 288, 143, 37, 18], unpainted 209.
          The unpainted button should remain visible at all widths.
        </p>
        <div>
          <p className="text-xs text-gray-400 mb-1">Full width</p>
          <ParticipantCountBar
            {...args}
            isUnpaintedGrouped={isUnpaintedGrouped}
            onUnpaintedGroupedChange={setIsUnpaintedGrouped}
          />
        </div>
        <div className="w-[500px]">
          <p className="text-xs text-gray-400 mb-1">500px</p>
          <ParticipantCountBar
            {...args}
            isUnpaintedGrouped={isUnpaintedGrouped}
            onUnpaintedGroupedChange={setIsUnpaintedGrouped}
          />
        </div>
        <div className="w-[300px]">
          <p className="text-xs text-gray-400 mb-1">300px</p>
          <ParticipantCountBar
            {...args}
            isUnpaintedGrouped={isUnpaintedGrouped}
            onUnpaintedGroupedChange={setIsUnpaintedGrouped}
          />
        </div>
      </div>
    );
  },
};

export const RandomLargeConvo: Story = {
  args: {
    pointGroups: generateRandomPointGroups(3000, 40),
  },
  render: (args) => {
    const [isUnpaintedGrouped, setIsUnpaintedGrouped] = useState(false);
    const [pointGroups, setPointGroups] = useState(args.pointGroups);

    const regenerate = () => {
      setPointGroups(generateRandomPointGroups(3000, 40));
    };

    return (
      <div className="w-full space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">
            Large conversation (~3000 points, 40 selected) - Refresh to see different patterns
          </span>
          <button
            onClick={regenerate}
            className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
          >
            Regenerate
          </button>
        </div>
        <ParticipantCountBar
          pointGroups={pointGroups}
          isUnpaintedGrouped={isUnpaintedGrouped}
          onUnpaintedGroupedChange={setIsUnpaintedGrouped}
        />
      </div>
    );
  },
};