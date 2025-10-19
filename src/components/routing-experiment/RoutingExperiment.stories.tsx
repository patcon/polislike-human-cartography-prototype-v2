import type { Meta, StoryObj } from '@storybook/react';
import { RoutingExperiment } from './RoutingExperiment';

const meta: Meta<typeof RoutingExperiment> = {
  title: 'Routing Experiment/RoutingExperiment',
  component: RoutingExperiment,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};