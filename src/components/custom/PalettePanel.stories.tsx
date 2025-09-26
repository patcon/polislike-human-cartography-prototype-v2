// PalettePanel.stories.tsx
"use client";

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { PalettePanel } from "./PalettePanel";
import { PALETTE_COLORS } from "@/constants";

const meta = {
  title: "Components/PalettePanel",
  component: PalettePanel,
} satisfies Meta<typeof PalettePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    activeIndex: 0,
    onSelectIndex: () => {},
    onEraserReselect: () => {},
  },
  render: () => {
    const [activeIndex, setActiveIndex] = useState(0); // default to first color (blue)
    return (
      <PalettePanel
        activeIndex={activeIndex}
        onSelectIndex={setActiveIndex}
        onEraserReselect={() => alert("Eraser tapped while already selected!")}
      />
    );
  },
};

export const OrangeSelected: Story = {
  args: {
    activeIndex: PALETTE_COLORS.indexOf("#ff7f0e"),
    onSelectIndex: () => {},
    onEraserReselect: () => {},
  },
  render: () => {
    const orangeIndex = PALETTE_COLORS.indexOf("#ff7f0e");
    const [activeIndex, setActiveIndex] = useState(orangeIndex);
    return (
      <PalettePanel
        activeIndex={activeIndex}
        onSelectIndex={setActiveIndex}
        onEraserReselect={() => alert("Eraser tapped while already selected!")}
      />
    );
  },
};
