import type { Meta, StoryObj } from "@storybook/react";
import { LayerConfigDrawer } from "./LayerConfigDrawer";

const meta = {
  title: "Components/LayerConfigDrawer",
  component: LayerConfigDrawer,
} satisfies Meta<typeof LayerConfigDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="h-screen w-screen relative">
      <div className="fixed bottom-4 left-4 z-50">
        <LayerConfigDrawer />
      </div>
    </div>
  ),
};
