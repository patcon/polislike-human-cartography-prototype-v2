// D3Map.metrics.stories.tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { D3Map } from "./D3Map";

const meta: Meta<typeof D3Map> = {
  title: "Components/D3Map/Metrics",
  component: D3Map,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof D3Map>;

// Sample data for testing
const sampleData: [string, [number, number]][] = [
  ["1", [0.1, 0.2]],
  ["2", [0.3, 0.4]],
  ["3", [0.5, 0.6]],
  ["4", [0.7, 0.8]],
  ["5", [0.2, 0.9]],
  ["6", [0.8, 0.1]],
  ["7", [0.4, 0.7]],
  ["8", [0.9, 0.3]],
  ["9", [0.6, 0.5]],
  ["10", [0.1, 0.8]],
];

// Sample metrics values (0-1 for gradient)
const sampleMetrics = [0.1, 0.3, 0.5, 0.7, 0.9, 0.2, 0.4, 0.6, 0.8, 1.0];

export const MetricsGoldDarkRed: Story = {
  args: {
    data: sampleData,
    pointColors: sampleMetrics,
    layerMode: "metrics",
    mode: "move",
  },
};

export const MetricsViridis: Story = {
  args: {
    data: sampleData,
    pointColors: sampleMetrics,
    layerMode: "metrics",
    mode: "move",
  },
  parameters: {
    docs: {
      description: {
        story: 'To use Viridis color scheme, change the line in D3Map.tsx: `return createColorScale("viridis", false);`'
      }
    }
  }
};

export const MetricsViridisInverse: Story = {
  args: {
    data: sampleData,
    pointColors: sampleMetrics,
    layerMode: "metrics",
    mode: "move",
  },
  parameters: {
    docs: {
      description: {
        story: 'To use inverted Viridis color scheme, change the line in D3Map.tsx: `return createColorScale("viridis", true);`'
      }
    }
  }
};

export const MetricsWithNulls: Story = {
  args: {
    data: sampleData,
    pointColors: [0.1, null, 0.5, null, 0.9, 0.2, null, 0.6, 0.8, null],
    layerMode: "metrics",
    mode: "move",
  },
};

export const CompareWithGroups: Story = {
  args: {
    data: sampleData,
    pointColors: [0, 1, 2, 3, 4, 0, 1, 2, 3, 4],
    layerMode: "groups",
    mode: "move",
  },
};