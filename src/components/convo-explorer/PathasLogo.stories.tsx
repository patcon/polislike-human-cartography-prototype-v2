import type { Meta, StoryObj } from "@storybook/react";
import { PathasLogo } from "./PathasLogo";

const meta = {
  title: "Components/PathasLogo",
  component: PathasLogo,
} satisfies Meta<typeof PathasLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <PathasLogo {...args} />,
  args: {},
};
