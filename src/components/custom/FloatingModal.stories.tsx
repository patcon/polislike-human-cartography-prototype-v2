"use client";

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { FloatingModal } from "./FloatingModal";

const meta = {
  title: "Components/FloatingModal",
  component: FloatingModal,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof FloatingModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    statement: {
      txt: "This is a sample statement displayed in the floating modal.",
      statement_id: 123,
      moderated: 1,
    },
    isVisible: true,
  },
  render: (args) => {
    const [isVisible, setIsVisible] = useState(args.isVisible);

    return (
      <div className="relative w-full h-screen bg-gray-100 dark:bg-gray-800">
        <div className="p-4">
          <button
            onClick={() => setIsVisible(!isVisible)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {isVisible ? "Hide Modal" : "Show Modal"}
          </button>
        </div>
        <FloatingModal
          {...args}
          isVisible={isVisible}
          onClose={() => setIsVisible(false)}
        />
      </div>
    );
  },
};

export const LongStatement: Story = {
  args: {
    statement: {
      txt: "This is a much longer statement that demonstrates how the floating modal handles text wrapping and maintains readability even with extended content. The modal should gracefully accommodate various text lengths while maintaining its compact appearance.",
      statement_id: 456,
      moderated: 1,
    },
    isVisible: true,
  },
  render: (args) => {
    return (
      <div className="relative w-full h-screen bg-gray-100 dark:bg-gray-800">
        <div className="p-4">
          <p className="text-gray-600 dark:text-gray-400">
            Example of a long statement in the floating modal.
          </p>
        </div>
        <FloatingModal {...args} onClose={() => alert("Close clicked - would switch to groups mode")} />
      </div>
    );
  },
};

export const ModerationStates: Story = {
  args: {
    statement: {
      txt: "Example statement",
      statement_id: 999,
      moderated: 1,
    },
    isVisible: true,
  },
  render: () => {
    const [currentState, setCurrentState] = useState(0);
    
    const states = [
      { txt: "This statement is approved and shows in normal text.", statement_id: 100, moderated: 1 },
      { txt: "This statement is unmoderated and shows in gray text.", statement_id: 101, moderated: 0 },
      { txt: "This statement was moderated and appears in red.", statement_id: 102, moderated: -1 },
    ];

    return (
      <div className="relative w-full h-screen bg-gray-100 dark:bg-gray-800">
        <div className="p-4">
          <button
            onClick={() => setCurrentState((prev) => (prev + 1) % states.length)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Cycle Moderation States
          </button>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Current: {currentState === 0 ? "Approved" : currentState === 1 ? "Unmoderated" : "Moderated"}
          </p>
        </div>
        
        <FloatingModal
          statement={states[currentState]}
          isVisible={true}
          onClose={() => alert("Close clicked - would switch to groups mode")}
        />
      </div>
    );
  },
};