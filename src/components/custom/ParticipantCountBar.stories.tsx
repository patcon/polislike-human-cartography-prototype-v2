"use client";

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ParticipantCountBar } from "./ParticipantCountBar";

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
const samplePointGroups: (number | null)[] = [
  null, null, null, null, null, // 5 unpainted points
  0, 0, 0, 0, 0, 0, 0, 0, // 8 blue points (A)
  1, 1, 1, 1, 1, // 5 orange points (B)  
  2, 2, 2, 2, 2, 2, 2, 2, 2, 2, // 10 green points (C)
  4, 4, 4, // 3 purple points (E)
];

// Medium conversation (~250 points) with small selection (40 points)
const samplePointGroupsMed: (number | null)[] = [
  // 40 selected points across different groups
  ...Array(40).fill(0),   // 40 blue (A)
  // 210 unselected points (all null/unpainted)
  ...Array(210).fill(null),
];

// Large conversation (~3000 points) with small selection (40 points)
const samplePointGroupsLarge: (number | null)[] = [
  // 40 selected points across different groups
  ...Array(40).fill(0),   // 40 blue (A)
  // 2960 unselected points (all null/unpainted)
  ...Array(2960).fill(null),
];

// Helper function to generate random point groups
const generateRandomPointGroups = (totalPoints: number, selectedPoints: number): (number | null)[] => {
  const points: (number | null)[] = Array(totalPoints).fill(null);

  // Randomly assign selected points to different groups
  const selectedIndices = new Set<number>();
  while (selectedIndices.size < selectedPoints) {
    selectedIndices.add(Math.floor(Math.random() * totalPoints));
  }

  selectedIndices.forEach(index => {
    // Randomly assign to groups 0-4 or leave as null (unpainted)
    const groupChoice = Math.random();
    if (groupChoice < 0.2) points[index] = null;      // 20% unpainted
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
    pointGroups: [null, null, null, null, null, null, null, null, null, null],
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