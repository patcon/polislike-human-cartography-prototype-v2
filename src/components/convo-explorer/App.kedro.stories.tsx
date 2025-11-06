import type { Meta, StoryObj } from '@storybook/react';
import { App } from './App';
import { decodeStorybookArgs, encodeStorybookParam } from '../../../.storybook/preview';

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
    kedroBaseUrl: {
      control: 'text',
      description: 'Base URL for Kedro API endpoints',
    },
    pipelineId: {
      control: 'text',
      description: 'Pipeline ID to load data from (e.g., mean_localmap_bestkmeans, mean_pca_bestkmeans)',
    },
    testAnimation: {
      control: 'boolean',
      description: 'Enable animation testing between projection sets',
    },
    pipelineFilter: {
      control: 'text',
      description: 'Filter pipelines in animation dropdown (e.g., "bestkmeans" to show only bestkmeans pipelines)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const KedroMode: Story = {
  render: (args) => {
    const decodedArgs = decodeStorybookArgs(args);
    return (
      <App
        kedroBaseUrl={decodedArgs.kedroBaseUrl}
        pipelineId={decodedArgs.pipelineId}
        testAnimation={decodedArgs.testAnimation}
      />
    );
  },
  args: {
    kedroBaseUrl: encodeStorybookParam('https://patcon.github.io/kedro-polislike-pipelines'),
    pipelineId: 'mean_localmap_bestkmeans',
    testAnimation: false,
  },
  parameters: {
    docs: {
      description: {
        story: `
This story demonstrates the App component in Kedro mode. When the \`kedroBaseUrl\` prop is provided, 
the component will:

1. Fetch pipeline data from \`{kedroBaseUrl}/api/pipelines/{pipelineId}\`
2. Find the node with name \`{pipelineId}__scatter_plot\`
3. Fetch the node data from \`{kedroBaseUrl}/api/nodes/{node_id}\`
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
//     kedroBaseUrl: 'https://patcon.github.io/kedro-polislike-pipelines',
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
    const decodedArgs = decodeStorybookArgs(args);
    return (
      <App
        kedroBaseUrl={decodedArgs.kedroBaseUrl}
        pipelineId={decodedArgs.pipelineId}
        testAnimation={decodedArgs.testAnimation}
      />
    );
  },
  args: {
    kedroBaseUrl: encodeStorybookParam('http://localhost:4141'),
    pipelineId: 'mean_localmap_bestkmeans',
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

export const KedroModeWithAnimation: Story = {
  render: (args) => {
    const decodedArgs = decodeStorybookArgs(args);
    return (
      <App
        kedroBaseUrl={decodedArgs.kedroBaseUrl}
        pipelineId={decodedArgs.pipelineId}
        testAnimation={decodedArgs.testAnimation}
        pipelineFilter={decodedArgs.pipelineFilter}
      />
    );
  },
  args: {
    kedroBaseUrl: encodeStorybookParam('https://patcon.github.io/kedro-polislike-pipelines'),
    pipelineId: 'mean_localmap_bestkmeans',
    testAnimation: true,
    pipelineFilter: 'bestkmeans',
  },
  parameters: {
    docs: {
      description: {
        story: `
Same as KedroMode but with animation testing enabled. This allows switching between
different pipeline types with smooth transitions while preserving painted groups.

The animation system will load all available pipelines and provide a dropdown selector
to switch between them. Points will smoothly animate from one projection to another
while maintaining their group assignments.
        `,
      },
    },
  },
};