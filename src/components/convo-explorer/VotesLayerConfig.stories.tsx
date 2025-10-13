import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { VotesLayerConfig } from "./VotesLayerConfig";

const meta = {
  title: "Components/VotesLayerConfig",
  component: VotesLayerConfig,
} satisfies Meta<typeof VotesLayerConfig>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    highlightPassVotes: false,
    onHighlightPassVotesChange: () => {},
  },
  render: () => {
    const [highlight, setHighlight] = useState(false);
    return (
      <VotesLayerConfig
        highlightPassVotes={highlight}
        onHighlightPassVotesChange={setHighlight}
      />
    );
  },
};
