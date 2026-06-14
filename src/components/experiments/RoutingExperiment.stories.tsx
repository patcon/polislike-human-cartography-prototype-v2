import type { Meta, StoryObj } from '@storybook/react-vite';
import { RoutingExperiment } from './RoutingExperiment';
import { decodeStorybookArgs, encodeStorybookParam } from '../../../.storybook/preview';

const meta: Meta<typeof RoutingExperiment> = {
  title: 'Experiments/RoutingExperiment',
  component: RoutingExperiment,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    // Display Settings
    showEdges: {
      control: { type: 'select' },
      options: ['none', 'all', 'only path'],
      description: 'Control edge visibility',
      defaultValue: 'all',
    },
    showNodes: {
      control: { type: 'select' },
      options: ['none', 'all', 'only path'],
      description: 'Control node visibility',
      defaultValue: 'all',
    },
    pathStyle: {
      control: { type: 'select' },
      options: ['sharp', 'smooth'],
      description: 'Path rendering style',
      defaultValue: 'sharp',
    },
    navigationMode: {
      control: 'boolean',
      description: 'Enable Google Maps-style 3D navigation (tilt + orbit)',
      defaultValue: false,
    },
    waypointDensity: {
      control: { type: 'range', min: 0, max: 1, step: 0.1 },
      description: 'Fraction of intermediate waypoints to highlight along the path (1.0 = all)',
      defaultValue: 1.0,
    },
    waypointDistribution: {
      control: { type: 'radio' },
      options: ['hops', 'distance'],
      description: 'How to distribute highlighted waypoints: evenly by hop count, or evenly by path length',
      defaultValue: 'hops',
    },
    includeAvatars: {
      control: 'boolean',
      description: 'Show DiceBear adventurer-neutral avatars in pin heads (navigation mode only)',
      defaultValue: false,
    },
    // Kedro API Settings
    kedroBaseUrl: {
      control: 'text',
      description: 'Base URL for Kedro API (optional)',
    },
    pipelineId: {
      control: 'text',
      description: 'Pipeline ID to load from Kedro API',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    showEdges: 'all',
    showNodes: 'all',
    pathStyle: 'sharp',
  },
};

export const WithRandomStartPoints: Story = {
  args: {
    showEdges: 'all',
    showNodes: 'all',
    pathStyle: 'smooth',
  },
  parameters: {
    docs: {
      description: {
        story: `
This story demonstrates the RoutingExperiment component with automatic random point selection.
When the data loads, two random points are automatically selected as source and destination,
immediately showing a routing path. This provides a better initial user experience by
demonstrating the functionality right away.

Users can click "Random Points" to select new random points or manually click on points
to set custom source and destination locations.
        `,
      },
    },
  },
};

export const MinimalDisplay: Story = {
  args: {
    showEdges: 'only path',
    showNodes: 'only path',
    pathStyle: 'smooth',
  },
};

export const NoNetwork: Story = {
  args: {
    showEdges: 'none',
    showNodes: 'all',
    pathStyle: 'sharp',
  },
};

export const KedroApiGitHubPages: Story = {
  render: (args) => {
    const decodedArgs = decodeStorybookArgs(args);
    return <RoutingExperiment {...decodedArgs} />;
  },
  args: {
    showEdges: 'all',
    showNodes: 'all',
    pathStyle: 'sharp',
    kedroBaseUrl: encodeStorybookParam('https://patcon.github.io/kedro-polislike-pipelines'),
    pipelineId: 'mean_localmap_bestkmeans',
  },
  parameters: {
    docs: {
      description: {
        story: `
This story demonstrates the RoutingExperiment component loading data from a Kedro API endpoint.
When \`kedroBaseUrl\` is provided, the component will:

1. Fetch available pipelines from \`{kedroBaseUrl}/api/main\`
2. Allow selection of different pipelines via dropdown
3. Load projection data from the selected pipeline's scatter plot node
4. Display routing experiments on the pipeline data

The pipeline selector will appear in the controls when a Kedro base URL is provided.
        `,
      },
    },
  },
};

export const KedroApiLocalhost: Story = {
  render: (args) => {
    const decodedArgs = decodeStorybookArgs(args);
    return <RoutingExperiment {...decodedArgs} />;
  },
  args: {
    showEdges: 'all',
    showNodes: 'all',
    pathStyle: 'sharp',
    kedroBaseUrl: encodeStorybookParam('http://localhost:4141'),
    pipelineId: 'mean_localmap_bestkmeans',
  },
  parameters: {
    docs: {
      description: {
        story: `
This story demonstrates the RoutingExperiment component connecting to a local Kedro server.
Useful for development when running a local Kedro instance.

To use this story:
1. Start your local Kedro server on port 4141
2. The component will automatically fetch available pipelines
3. Select different pipelines to see routing experiments on different datasets
        `,
      },
    },
  },
};

export const NavigationMode: Story = {
  args: {
    showEdges: 'all',
    showNodes: 'all',
    pathStyle: 'smooth',
    navigationMode: true,
    includeAvatars: true,
    waypointDensity: 0.3,
    waypointDistribution: 'distance',
  },
  parameters: {
    docs: {
      description: {
        story: `
Google Maps-style 3D navigation mode.
- **Scroll** to zoom
- **Left-drag** to pan
- **Shift-drag** to orbit (horizontal = rotate heading, vertical = tilt)
- **Double-click** empty space to reset view
        `,
      },
    },
  },
};