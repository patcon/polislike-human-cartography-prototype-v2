import type { Meta, StoryObj } from "@storybook/react";
import { PaletteButton } from "./PaletteButton";

const meta = {
  title: "Components/PaletteButton",
  component: PaletteButton,
} satisfies Meta<typeof PaletteButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BlueSelected: Story = {
  render: () => (
    <PaletteButton
      disabled={false}
      color="#0ea5e9" // sky-500
      onClick={() => alert("Open palette")}
    />
  ),
};

export const PinkSelected: Story = {
  render: () => (
    <PaletteButton
      disabled={false}
      color="#ec4899" // pink-500
      onClick={() => alert("Open palette")}
    />
  ),
};

export const Disabled: Story = {
  render: () => <PaletteButton disabled onClick={() => alert("Should not fire")} />,
};
