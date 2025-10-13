// ClearColorsDialog.stories.tsx
"use client";

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ClearColorsDialog } from "./ClearColorsDialog";
import { Button } from "@/components/ui/button";

const meta = {
  title: "Components/ClearColorsDialog",
  component: ClearColorsDialog,
} satisfies Meta<typeof ClearColorsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: false,
    onOpenChange: () => {},
    onConfirm: () => {},
  },
  render: () => {
    const [open, setOpen] = useState(false);

    return (
      <div className="p-4">
        <Button onClick={() => setOpen(true)}>
          Open Erase Colors Dialog
        </Button>
        <ClearColorsDialog
          open={open}
          onOpenChange={setOpen}
          onConfirm={() => {
            alert("All colors erased!");
            console.log("Erase colors confirmed");
          }}
        />
      </div>
    );
  },
};

export const AlwaysOpen: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    onConfirm: () => alert("All colors erased!"),
  },
  render: (args) => {
    return (
      <div className="p-4">
        <p className="mb-4 text-sm text-gray-600">
          This story shows the dialog in an always-open state for design review.
        </p>
        <ClearColorsDialog {...args} />
      </div>
    );
  },
};