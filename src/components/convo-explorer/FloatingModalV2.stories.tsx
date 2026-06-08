"use client";

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { FloatingModalV2 } from "./FloatingModalV2";
import { FloatingModalV2Stack } from "./FloatingModalV2Stack";

const meta = {
  title: "Components/FloatingModalV2",
  component: FloatingModalV2,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof FloatingModalV2>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleStatement = {
  txt: "This is a sample statement displayed in the floating modal.",
  statement_id: 123,
  moderated: 1,
};

export const Default: Story = {
  args: {
    statement: sampleStatement,
    isVisible: true,
    variant: "unstyled",
  },
  render: (args) => (
    <div className="relative w-full h-screen bg-gray-100 dark:bg-gray-800">
      <FloatingModalV2 {...args} className="fixed bottom-22 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-screen sm:max-w-screen-sm" />
    </div>
  ),
};

export const AgreeVariant: Story = {
  args: {
    statement: { ...sampleStatement, txt: "We should invest more in renewable energy infrastructure.", statement_id: 10 },
    isVisible: true,
    variant: "agree",
  },
  render: (args) => (
    <div className="relative w-full h-screen bg-gray-100 dark:bg-gray-800">
      <FloatingModalV2 {...args} className="fixed bottom-22 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-screen sm:max-w-screen-sm" />
    </div>
  ),
};

export const DisagreeVariant: Story = {
  args: {
    statement: { ...sampleStatement, txt: "Carbon taxes unfairly burden working-class families.", statement_id: 11 },
    isVisible: true,
    variant: "disagree",
  },
  render: (args) => (
    <div className="relative w-full h-screen bg-gray-100 dark:bg-gray-800">
      <FloatingModalV2 {...args} className="fixed bottom-22 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-screen sm:max-w-screen-sm" />
    </div>
  ),
};

export const PassVariant: Story = {
  args: {
    statement: { ...sampleStatement, txt: "It is unclear whether this policy would have a net positive effect.", statement_id: 12 },
    isVisible: true,
    variant: "pass",
  },
  render: (args) => (
    <div className="relative w-full h-screen bg-gray-100 dark:bg-gray-800">
      <FloatingModalV2 {...args} className="fixed bottom-22 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-screen sm:max-w-screen-sm" />
    </div>
  ),
};

const STACK_VARIANTS = ["agree", "pass", "disagree"] as const;

export const Stack: StoryObj = {
  render: () => {
    const [variants, setVariants] = useState<["agree" | "pass" | "disagree", "agree" | "pass" | "disagree", "agree" | "pass" | "disagree"]>(
      ["agree", "pass", "disagree"]
    );

    const cycleVariant = (index: number) => {
      setVariants((prev) => {
        const next = [...prev] as typeof prev;
        const current = STACK_VARIANTS.indexOf(next[index]);
        next[index] = STACK_VARIANTS[(current + 1) % STACK_VARIANTS.length];
        return next;
      });
    };

    return (
      <div className="relative w-full h-screen bg-gray-100 dark:bg-gray-800">
        <div className="p-4 flex flex-col gap-2">
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Click a button to cycle that item's variant:</p>
          <div className="flex gap-2">
            {variants.map((v, i) => (
              <button
                key={i}
                onClick={() => cycleVariant(i)}
                className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm"
              >
                Item {i + 1}: <strong>{v}</strong>
              </button>
            ))}
          </div>
        </div>

        <FloatingModalV2Stack
          items={[
            {
              id: "s1",
              variant: variants[0],
              statement: { txt: "We should invest more in renewable energy infrastructure.", statement_id: 10, moderated: 1 },
            },
            {
              id: "s2",
              variant: variants[1],
              statement: { txt: "It is unclear whether this policy would have a net positive effect.", statement_id: 12, moderated: 1 },
            },
            {
              id: "s3",
              variant: variants[2],
              statement: { txt: "Carbon taxes unfairly burden working-class families.", statement_id: 11, moderated: 1 },
            },
          ]}
        />
      </div>
    );
  },
};
