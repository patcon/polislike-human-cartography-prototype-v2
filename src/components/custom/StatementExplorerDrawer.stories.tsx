// StatementExplorerDrawer.stories.tsx
import { useState, useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { StatementExplorerDrawer } from "./StatementExplorerDrawer";
import { resolveAssetPath } from "../../lib/paths";

const meta: Meta<typeof StatementExplorerDrawer> = {
  title: "Components/StatementExplorerDrawer",
  component: StatementExplorerDrawer,
};

export default meta;
type Story = StoryObj<typeof StatementExplorerDrawer>;

// Default story — drawer is closed; use telescope trigger inside drawer
export const Default: Story = {
  render: () => {
    const [statementsData, setStatementsData] = useState(null);

    useEffect(() => {
      fetch(resolveAssetPath('/statements.json'))
        .then(response => response.json())
        .then(data => setStatementsData(data));
    }, []);

    if (!statementsData) return <div>Loading...</div>;
    return (
      <div className="p-8">
        <p className="mb-4">Click the telescope button to open the drawer.</p>
        <StatementExplorerDrawer statements={statementsData} activeColors={[0, 1, 2]} />
      </div>
    );
  },
};

// Enough tabs to overflow small mobile screens.
export const SevenTabs: Story = {
  render: () => {
    const [statementsData, setStatementsData] = useState(null);

    useEffect(() => {
      fetch(resolveAssetPath('/statements.json'))
        .then(response => response.json())
        .then(data => setStatementsData(data));
    }, []);

    if (!statementsData) return <div>Loading...</div>;
    return (
      <div className="p-8">
        <p className="mb-4">Click the telescope button to open the drawer.</p>
        <StatementExplorerDrawer statements={statementsData} activeColors={[0, 1, 2, 3, 4, 5, 6]} />
      </div>
    );
  },
};

// Enough tabs to overflow small mobile screens.
export const EveryColor: Story = {
  render: () => {
    const [statementsData, setStatementsData] = useState(null);

    useEffect(() => {
      fetch(resolveAssetPath('/statements.json'))
        .then(response => response.json())
        .then(data => setStatementsData(data));
    }, []);

    if (!statementsData) return <div>Loading...</div>;
    return (
      <div className="p-8">
        <p className="mb-4">Click the telescope button to open the drawer.</p>
        <StatementExplorerDrawer statements={statementsData} activeColors={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]} />
      </div>
    );
  },
};

// External button that opens drawer to Group C
export const OpenToGroupC: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState("all");
    const [statementsData, setStatementsData] = useState(null);

    useEffect(() => {
      fetch(resolveAssetPath('/statements.json'))
        .then(response => response.json())
        .then(data => setStatementsData(data));
    }, []);

    const handleOpenGroupA = () => {
      setTab("group-2"); // target tab
      setOpen(true);      // open drawer
    };

    if (!statementsData) return <div>Loading...</div>;
    return (
      <div className="p-8">
        <StatementExplorerDrawer
          statements={statementsData}
          activeColors={[0, 1, 2]}
          open={open}
          onOpenChange={setOpen}
          tabValue={tab}
          onTabValueChange={setTab}
        />

        <button
          className="px-4 py-2 bg-blue-100 outline-1 outline-blue-300 text-black rounded m-4"
          onClick={handleOpenGroupA}
        >
          Open to Group C
        </button>
      </div>
    );
  },
};
