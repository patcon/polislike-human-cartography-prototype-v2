import type { Meta, StoryObj } from '@storybook/react';
import { RoutingExperiment } from './RoutingExperiment';
import { decodeStorybookArgs, encodeStorybookParam } from '../../../.storybook/preview';

const meta: Meta<typeof RoutingExperiment> = {
  title: 'Routing Experiment/RoutingExperiment',
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