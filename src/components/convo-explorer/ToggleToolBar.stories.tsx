import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ToggleToolBar } from "./ToggleToolBar";

const meta = {
  title: "Components/ToggleToolBar",
  component: ToggleToolBar,
  // optionally add tags, decorators, etc.
} satisfies Meta<typeof ToggleToolBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [values, setValues] = useState<string[]>([]);
    return (
      <ToggleToolBar
        {...args}
        value={values}
        onValueChange={(newVals) => {
          setValues(newVals);
        }}
      />
    );
  },
  args: {
    // initial args: you could set initial toggles on
    value: [],  // none toggled
    onValueChange: () => {},
  },
};

export const AllOn: Story = {
  render: (args) => {
    const [values, setValues] = useState<string[]>(["flip-horizontal", "flip-vertical", "show-named-labels", "colors-to-front"]);
    return (
      <ToggleToolBar
        {...args}
        value={values}
        onValueChange={(newVals) => {
          setValues(newVals);
        }}
      />
    );
  },
  args: {
    value: ["flip-horizontal", "flip-vertical", "show-named-labels", "colors-to-front"],
    onValueChange: () => {},
  },
};

export const FlipOnly: Story = {
  render: (args) => {
    const [values, setValues] = useState<string[]>(["flip-horizontal"]);
    return (
      <ToggleToolBar
        {...args}
        value={values}
        onValueChange={(newVals) => {
          setValues(newVals);
        }}
      />
    );
  },
  args: {
    value: ["flip-horizontal"],
    onValueChange: () => {},
  },
};
