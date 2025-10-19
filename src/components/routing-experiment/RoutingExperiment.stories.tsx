import type { Meta, StoryObj } from '@storybook/react';
import { RoutingExperiment } from './RoutingExperiment';

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