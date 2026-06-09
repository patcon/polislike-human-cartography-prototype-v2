import type { Meta, StoryObj } from "@storybook/react-vite";
import { PaintbrushSparkles } from "./PaintbrushSparkles";

type Story = StoryObj<typeof PaintbrushSparkles>;

const meta: Meta<typeof PaintbrushSparkles> = {
  title: "Icons/PaintbrushSparkles",
  component: PaintbrushSparkles,
  argTypes: {
    size: { control: "number" },
    className: { control: "text" },
  },
};

export default meta;

export const Default: Story = {
  render: (args) => <PaintbrushSparkles {...args} />,
};
