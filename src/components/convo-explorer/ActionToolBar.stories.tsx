import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ActionToolBar } from "./ActionToolBar";

const meta = {
  title: "Components/ActionToolBar",
  component: ActionToolBar,
} satisfies Meta<typeof ActionToolBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = useState<string>("move-map"); // start with Move Map selected
    return <ActionToolBar {...args} value={value} onValueChange={setValue} />;
  },
  args: {
    value: "move-map",
    onValueChange: () => {},
  },
};

export const PaintSelected: Story = {
  render: (args) => {
    const [value, setValue] = useState<string>("paint-groups"); // start with Paint Groups selected
    return <ActionToolBar {...args} value={value} onValueChange={setValue} />;
  },
  args: {
    value: "paint-groups",
    onValueChange: () => {},
  },
};
