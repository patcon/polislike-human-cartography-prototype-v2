// MetricsLayerConfig.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { MetricsLayerConfig } from "./MetricsLayerConfig";

const meta: Meta<typeof MetricsLayerConfig> = {
  title: "Components/MetricsLayerConfig",
  component: MetricsLayerConfig,
};

export default meta;
type Story = StoryObj<typeof MetricsLayerConfig>;

export const Default: Story = {
  render: () => <MetricsLayerConfig />,
};

