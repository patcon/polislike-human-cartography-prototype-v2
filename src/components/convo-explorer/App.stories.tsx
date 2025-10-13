import type { Meta, StoryObj } from "@storybook/react";
import { App } from "./App";

const meta: Meta<typeof App> = {
  title: "Components/App",
  component: App,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <App />,
};

export const WithAnimationTesting: Story = {
  render: () => <App testAnimation={true} />,
};
