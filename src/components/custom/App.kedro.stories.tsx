import type { Meta, StoryObj } from '@storybook/react';
import { App } from './App';

const meta: Meta<typeof App> = {
  title: 'Components/App/Kedro Mode',
  component: App,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'App component in Kedro mode - loads data from Kedro API endpoints instead of local JSON files.',
      },
    },
  },
  argTypes: {
    kedro_base_url: {
      control: 'text',
      description: 'Base URL for Kedro API endpoints',
    },
    pipeline_id: {
      control: 'text',
      description: 'Pipeline ID to load data from (e.g., mean_localmap_bestkmeans, mean_pca_bestkmeans)',
    },
    testAnimation: {
      control: 'boolean',
      description: 'Enable animation testing between projection sets',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const KedroMode: Story = {
  render: (args) => {
    return (
      <App
        kedro_base_url={args.kedro_base_url}
        pipeline_id={args.pipeline_id}
        testAnimation={args.testAnimation}
      />
    );
  },
  args: {
    kedro_base_url: 'https://patcon.github.io/kedro-polislike-pipelines',
    pipeline_id: 'mean_localmap_bestkmeans',
    testAnimation: false,
  },
  parameters: {
    docs: {
      description: {
        story: `
This story demonstrates the App component in Kedro mode. When the \`kedro_base_url\` prop is provided, 
the component will:

1. Fetch pipeline data from \`{kedro_base_url}/api/pipelines/{pipeline_id}\`
2. Find the node with name \`{pipeline_id}__scatter_plot\`
3. Fetch the node data from \`{kedro_base_url}/api/nodes/{node_id}\`
4. Process the Plotly binary data to extract x,y coordinates
5. Transform the data to match the expected format: \`[participantId, [x, y]][]\`

The data loading process automatically handles the binary decoding of Plotly typed arrays 
and merges all traces into a single dataset suitable for visualization.
        `,
      },
    },
  },
};

// export const KedroModeWithAnimation: Story = {
//   args: {
//     kedro_base_url: 'https://patcon.github.io/kedro-polislike-pipelines',
//     testAnimation: true,
//   },
//   parameters: {
//     docs: {
//       description: {
//         story: `
// Same as KedroMode but with animation testing enabled. This allows switching between
// different projection types (LocalMAP, PaCMAP, UMAP) with smooth transitions.

// Note: Animation mode will try to load additional projection files from the public directory,
// which may not be available when using Kedro data.
//         `,
//       },
//     },
//   },
// };

export const LocalKedroMode: Story = {
  render: (args) => {
    return (
      <App
        kedro_base_url={args.kedro_base_url}
        pipeline_id={args.pipeline_id}
        testAnimation={args.testAnimation}
      />
    );
  },
  args: {
    kedro_base_url: 'http://localhost:4141',
    pipeline_id: 'mean_localmap_bestkmeans',
    testAnimation: false,
  },
  parameters: {
    docs: {
      description: {
        story: `
Example with a local Kedro server. Useful for development when running
a local Kedro instance with the API plugin enabled at http://localhost:4141.
        `,
      },
    },
  },
};