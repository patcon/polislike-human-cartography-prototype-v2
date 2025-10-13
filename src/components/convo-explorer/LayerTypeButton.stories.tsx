import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { LayerTypeButton } from "./LayerTypeButton";
import { Vote, Group } from "lucide-react";

const meta = {
  title: "Components/LayerTypeButton",
  component: LayerTypeButton,
} satisfies Meta<typeof LayerTypeButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: Vote,
    label: "Votes",
    selected: false,
    onClick: () => {},
  },
  render: () => {
    const [selected, setSelected] = useState<"votes" | "groups" | null>(null);

    return (
      <div className="flex gap-6">
        <LayerTypeButton
          icon={Vote}
          label="Votes"
          selected={selected === "votes"}
          onClick={() =>
            setSelected((s) => (s === "votes" ? null : "votes"))
          }
        />

        <LayerTypeButton
          icon={Group}
          label="Groups"
          selected={selected === "groups"}
          onClick={() =>
            setSelected((s) => (s === "groups" ? null : "groups"))
          }
        />
      </div>
    );
  },
};
