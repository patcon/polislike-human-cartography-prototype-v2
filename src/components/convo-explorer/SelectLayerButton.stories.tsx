// SelectLayerButton.stories.tsx
"use client";

import type { Meta, StoryObj } from "@storybook/react";
import { SelectLayerButton } from "./SelectLayerButton";

const meta = {
  title: "Components/SelectLayerButton",
  component: SelectLayerButton,
} satisfies Meta<typeof SelectLayerButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <SelectLayerButton {...args} />,
};

export const WithClickHandler: Story = {
  render: (args) => (
    <SelectLayerButton
      {...args}
      onClick={() => alert("Select Layer clicked!")}
    />
  ),
};

export const CustomClass: Story = {
  render: (args) => (
    <SelectLayerButton
      {...args}
      className="text-emerald-500"
    />
  ),
};
