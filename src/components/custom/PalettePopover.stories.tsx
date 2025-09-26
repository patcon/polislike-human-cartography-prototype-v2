// PalettePopover.stories.tsx
"use client";

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { PalettePopover } from "./PalettePopover";
import { ClearColorsDialog } from "./ClearColorsDialog";

const meta = {
  title: "Components/PalettePopover",
  component: PalettePopover,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    disabled: {
      control: { type: "boolean" },
      description: "Disables the palette button and popover",
      defaultValue: false,
    },
  },
} satisfies Meta<typeof PalettePopover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    activeIndex: 0,
    onSelectIndex: () => {},
    disabled: false, // control defaults here
  },
  render: (args) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [dialogOpen, setDialogOpen] = useState(false);
    
    return (
      <>
        <div className="fixed bottom-4 right-4 z-50">
          <PalettePopover
            {...args}
            activeIndex={activeIndex}
            onSelectIndex={setActiveIndex}
            onEraserReselect={() => setDialogOpen(true)}
          />
        </div>
        <ClearColorsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onConfirm={() => {
            alert("All colors erased!");
            console.log("Erase colors confirmed");
          }}
        />
      </>
    );
  },
};

export const DifferentColor: Story = {
  args: {
    activeIndex: 3,
    onSelectIndex: () => {},
    disabled: false,
  },
  render: (args) => {
    const [activeIndex, setActiveIndex] = useState(3);
    const [dialogOpen, setDialogOpen] = useState(false);
    
    return (
      <>
        <div className="fixed bottom-4 right-4 z-50">
          <PalettePopover
            {...args}
            activeIndex={activeIndex}
            onSelectIndex={setActiveIndex}
            onEraserReselect={() => setDialogOpen(true)}
          />
        </div>
        <ClearColorsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onConfirm={() => {
            alert("All colors erased!");
            console.log("Erase colors confirmed");
          }}
        />
      </>
    );
  },
};

// 👇 New story specifically showing the disabled state
export const Disabled: Story = {
  args: {
    activeIndex: 0,
    onSelectIndex: () => {},
    disabled: true,
  },
  render: (args) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [dialogOpen, setDialogOpen] = useState(false);
    
    return (
      <>
        <div className="fixed bottom-4 right-4 z-50">
          <PalettePopover
            {...args}
            activeIndex={activeIndex}
            onSelectIndex={setActiveIndex}
            onEraserReselect={() => setDialogOpen(true)}
          />
        </div>
        <ClearColorsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onConfirm={() => {
            alert("All colors erased!");
            console.log("Erase colors confirmed");
          }}
        />
      </>
    );
  },
};
