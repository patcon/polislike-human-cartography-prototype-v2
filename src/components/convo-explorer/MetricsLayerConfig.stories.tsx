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

export const WithObsColumns: Story = {
  render: () => (
    <MetricsLayerConfig
      config={{ type: "obs-column", column: "cluster_label" }}
      obsColumnKeys={["cluster_label", "n_votes", "confidence_score", "age_group"]}
    />
  ),
};

export const WithoutObsColumns: Story = {
  render: () => <MetricsLayerConfig />,
};
