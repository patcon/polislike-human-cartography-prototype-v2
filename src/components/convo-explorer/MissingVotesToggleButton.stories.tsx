import type { Meta, StoryObj } from '@storybook/react';
import { MissingVotesToggleButton } from './MissingVotesToggleButton';
import { useState } from 'react';

const meta: Meta<typeof MissingVotesToggleButton> = {
  title: 'Components/MissingVotesToggleButton',
  component: MissingVotesToggleButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Interactive story that shows both states
export const Interactive: Story = {
  render: () => {
    const [includeMissingVotes, setIncludeMissingVotes] = useState(false);

    return (
      <div className="p-4">
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            Current state: {includeMissingVotes ? 'Included' : 'Excluded'}
          </p>
          <MissingVotesToggleButton
            includeMissingVotes={includeMissingVotes}
            onToggle={() => setIncludeMissingVotes(!includeMissingVotes)}
          />
        </div>
      </div>
    );
  },
};

// Static states for visual testing
export const IncludingMissingVotes: Story = {
  args: {
    includeMissingVotes: true,
    onToggle: () => console.log('Toggle clicked'),
  },
};

export const ExcludingMissingVotes: Story = {
  args: {
    includeMissingVotes: false,
    onToggle: () => console.log('Toggle clicked'),
  },
};

// In table header context
export const InTableHeader: Story = {
  render: () => {
    const [includeMissingVotes, setIncludeMissingVotes] = useState(false);

    return (
      <div className="p-4">
        <table className="border-collapse border border-gray-300">
          <thead>
            <tr>
              <th className="border border-gray-300 px-4 py-2 text-right text-[12px] text-gray-400">#</th>
              <th className="border border-gray-300 w-8 text-center">
                <MissingVotesToggleButton
                  includeMissingVotes={includeMissingVotes}
                  onToggle={() => setIncludeMissingVotes(!includeMissingVotes)}
                />
              </th>
              <th className="border border-gray-300 px-4 py-2">Statement</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-4 py-2 text-right">1</td>
              <td className="border border-gray-300 px-4 py-2 text-center">📊</td>
              <td className="border border-gray-300 px-4 py-2">Sample statement text</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  },
};