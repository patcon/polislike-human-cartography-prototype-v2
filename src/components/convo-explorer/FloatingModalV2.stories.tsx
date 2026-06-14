"use client";

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
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

type VariantKey = "agree" | "pass" | "disagree";
const STACK_VARIANTS: VariantKey[] = ["agree", "pass", "disagree"];

const ALL_ITEMS = [
  { id: "s1", variant: "agree"    as VariantKey, statement: { txt: "We should invest more in renewable energy infrastructure.", statement_id: 10, moderated: 1 } },
  { id: "s2", variant: "pass"     as VariantKey, statement: { txt: "It is unclear whether this policy would have a net positive effect.", statement_id: 12, moderated: 1 } },
  { id: "s3", variant: "disagree" as VariantKey, statement: { txt: "Carbon taxes unfairly burden working-class families.", statement_id: 11, moderated: 1 } },
];

export const Stack: StoryObj = {
  render: () => {
    const [activeIds, setActiveIds] = useState<string[]>(["s1", "s2", "s3"]);
    const [variants, setVariants] = useState<Record<string, VariantKey>>(
      { s1: "agree", s2: "pass", s3: "disagree" }
    );

    const toggleItem = (id: string) =>
      setActiveIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const cycleVariant = (id: string) =>
      setVariants(prev => {
        const cur = STACK_VARIANTS.indexOf(prev[id]);
        return { ...prev, [id]: STACK_VARIANTS[(cur + 1) % STACK_VARIANTS.length] };
      });

    const moveUp = (id: string) =>
      setActiveIds(prev => {
        const i = prev.indexOf(id);
        if (i <= 0) return prev;
        const next = [...prev];
        [next[i - 1], next[i]] = [next[i], next[i - 1]];
        return next;
      });

    const moveDown = (id: string) =>
      setActiveIds(prev => {
        const i = prev.indexOf(id);
        if (i < 0 || i >= prev.length - 1) return prev;
        const next = [...prev];
        [next[i], next[i + 1]] = [next[i + 1], next[i]];
        return next;
      });

    const items = activeIds.map(id => {
      const base = ALL_ITEMS.find(i => i.id === id)!;
      return { ...base, variant: variants[id] };
    });

    return (
      <div className="relative w-full h-screen bg-gray-100 dark:bg-gray-800">
        <div className="p-4 flex flex-col gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            Toggle, reorder, or cycle variants to see animations:
          </p>
          <div className="flex flex-col gap-1.5">
            {ALL_ITEMS.map(({ id }) => {
              const active = activeIds.includes(id);
              const pos = activeIds.indexOf(id);
              return (
                <div key={id} className="flex items-center gap-2 text-sm">
                  <button
                    onClick={() => toggleItem(id)}
                    className={`px-3 py-1 rounded border text-sm ${active ? "bg-gray-800 text-white border-gray-800" : "bg-white border-gray-300 text-gray-500"}`}
                  >
                    {id}: {active ? "visible" : "hidden"}
                  </button>
                  {active && (
                    <>
                      <button onClick={() => cycleVariant(id)} className="px-2 py-1 bg-white border border-gray-300 rounded text-xs">
                        variant: <strong>{variants[id]}</strong>
                      </button>
                      <button onClick={() => moveUp(id)} disabled={pos === 0} className="px-2 py-1 bg-white border border-gray-300 rounded text-xs disabled:opacity-30">↑</button>
                      <button onClick={() => moveDown(id)} disabled={pos === activeIds.length - 1} className="px-2 py-1 bg-white border border-gray-300 rounded text-xs disabled:opacity-30">↓</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <FloatingModalV2Stack items={items} />
      </div>
    );
  },
};
