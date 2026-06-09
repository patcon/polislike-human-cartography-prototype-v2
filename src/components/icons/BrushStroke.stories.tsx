import type { Meta, StoryObj } from "@storybook/react-vite";
import { BrushStroke } from "./BrushStroke";

type Story = StoryObj<typeof BrushStroke>;

const meta: Meta<typeof BrushStroke> = {
  title: "Icons/BrushStroke",
  component: BrushStroke,
  argTypes: {
    className: { control: "text" },
  },
};

export default meta;

export const Default: Story = {
  render: (args) => <BrushStroke {...args} />,
};
