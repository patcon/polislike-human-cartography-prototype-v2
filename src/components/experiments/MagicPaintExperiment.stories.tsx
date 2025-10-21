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
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};