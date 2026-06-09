import type { Meta, StoryObj } from "@storybook/react-vite";
import { BringToFrontSolid } from "./BringToFrontSolid";

type Story = StoryObj<typeof BringToFrontSolid>;

const meta: Meta<typeof BringToFrontSolid> = {
  title: "Icons/BringToFrontSolid",
  component: BringToFrontSolid,
  argTypes: {},
};

export default meta;

export const Default: Story = {
  render: (args) => <BringToFrontSolid {...args} />,
};
