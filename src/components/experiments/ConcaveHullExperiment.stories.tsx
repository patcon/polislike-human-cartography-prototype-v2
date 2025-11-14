import type { Meta, StoryObj } from '@storybook/react';
import { ConcaveHullExperiment } from './ConcaveHullExperiment';

const meta: Meta<typeof ConcaveHullExperiment> = {
  title: 'Experiments/ConcaveHullExperiment',
  component: ConcaveHullExperiment,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
# HDBSCAN Concave Hull Explorer

An interactive visualization component for exploring HDBSCAN clustering results with adjustable water level (λ threshold) and concave hull visualization around clusters.

## Features

- **Interactive Water Level Control**: Adjust the λ threshold to see how clusters form and merge
- **Auto-select Mode**: Click points to automatically find optimal λ levels
- **Expand Selection Mode**: Drill deeper into clusters by clicking selected points
- **Cluster Styling**: Toggle between cluster colors and selection highlighting
- **Concave Hull Visualization**: Show concave hulls around each cluster group (excluding unclustered points)
- **Zoom & Pan**: Navigate the visualization with mouse interactions

## Data Requirements

The component expects two JSON files in the public directory:
- \`projections.json\`: Array of \`[id, [x, y]]\` point coordinates
- \`projection_labels_by_threshold.json\`: Object with threshold keys and cluster label arrays

## Usage

Click points to select clusters, adjust the water level slider to see clustering at different scales,
use the checkboxes to control interaction modes and visual styling, and enable concave hulls to see
cluster boundaries visualized as polygonal shapes around each group.

## Concave Hull Feature

The concave hull feature draws semi-transparent polygonal boundaries around each cluster group,
making it easier to visualize cluster shapes and boundaries. This is particularly useful for:
- Understanding cluster topology
- Identifying cluster overlap regions
- Visualizing cluster density and spread
- Comparing cluster shapes across different λ thresholds

Note: The current implementation uses convex hulls as a placeholder. In a production environment,
you would implement a proper concave hull algorithm for more accurate cluster boundary representation.
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};