import type { Meta, StoryObj } from '@storybook/react';
import { MagicPaintExperiment } from './MagicPaintExperiment';

const meta: Meta<typeof MagicPaintExperiment> = {
  title: 'Experiments/MagicPaintExperiment',
  component: MagicPaintExperiment,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
# HDBSCAN Cluster Explorer (Magic Paint Experiment)

An interactive visualization component for exploring HDBSCAN clustering results with adjustable water level (λ threshold).

## Features

- **Interactive Water Level Control**: Adjust the λ threshold to see how clusters form and merge
- **Auto-select Mode**: Click points to automatically find optimal λ levels
- **Expand Selection Mode**: Drill deeper into clusters by clicking selected points
- **Cluster Styling**: Toggle between cluster colors and selection highlighting
- **Zoom & Pan**: Navigate the visualization with mouse interactions

## Data Requirements

The component expects two JSON files in the public directory:
- \`projections.json\`: Array of \`[id, [x, y]]\` point coordinates
- \`projection_labels_by_threshold.json\`: Object with threshold keys and cluster label arrays

## Usage

Click points to select clusters, adjust the water level slider to see clustering at different scales,
and use the checkboxes to control interaction modes and visual styling.
        `,
      },
    },
  },
  argTypes: {
    width: {
      control: { type: 'number', min: 400, max: 1200, step: 50 },
      description: 'Width of the visualization canvas',
      defaultValue: 600,
    },
    height: {
      control: { type: 'number', min: 300, max: 800, step: 50 },
      description: 'Height of the visualization canvas',
      defaultValue: 400,
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    width: 600,
    height: 400,
  },
};

export const LargeCanvas: Story = {
  args: {
    width: 800,
    height: 600,
  },
  parameters: {
    docs: {
      description: {
        story: `
A larger canvas size for better exploration of dense datasets. The larger size provides
more space for detailed cluster analysis and makes it easier to interact with individual points.
        `,
      },
    },
  },
};

export const CompactView: Story = {
  args: {
    width: 500,
    height: 350,
  },
  parameters: {
    docs: {
      description: {
        story: `
A more compact view suitable for embedding in dashboards or smaller screen spaces.
All functionality remains available in the reduced size.
        `,
      },
    },
  },
};

export const WideScreen: Story = {
  args: {
    width: 900,
    height: 500,
  },
  parameters: {
    docs: {
      description: {
        story: `
A wide-screen format that provides extra horizontal space for exploring datasets
with wide coordinate ranges or for side-by-side comparison workflows.
        `,
      },
    },
  },
};