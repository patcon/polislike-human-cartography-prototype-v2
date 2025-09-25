import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { D3Map } from "./D3Map";
import { useStorybookDataLoader } from "../../../.storybook/hooks/useStorybookDataLoader";

// Extend the D3Map props to include kedro_base_url for stories
type D3MapStoryArgs = React.ComponentProps<typeof D3Map> & {
  kedro_base_url?: string;
};

const meta: Meta<D3MapStoryArgs> = {
  title: "Components/D3Map",
  component: D3Map,
  parameters: {
    layout: "fullscreen", // full viewport, no padding
  },
  argTypes: {
    mode: {
      control: { type: "radio" },
      options: ["move", "paint"],
      description: "Map interaction mode",
    },
    kedro_base_url: {
      control: "text",
      description: "Base URL for Kedro API endpoints (when provided, loads data from Kedro instead of local JSON)",
    },
  },
};

export default meta;
type Story = StoryObj<D3MapStoryArgs>;

/** Pan/zoom only with live mode control */
export const MoveMode: Story = {
  render: (args) => {
    const { kedro_base_url, ...d3MapArgs } = args;
    const { dataset, loading, error } = useStorybookDataLoader(kedro_base_url);
    
    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!dataset) return <div>No data available</div>;
    
    return <D3Map {...d3MapArgs} data={dataset} />;
  },
};
MoveMode.storyName = "Move Mode (broken)"

/** Freeform lasso select with live mode control */
export const PaintMode: Story = {
  render: (args) => {
    const { kedro_base_url, ...d3MapArgs } = args;
    const { dataset, loading, error } = useStorybookDataLoader(kedro_base_url);
    
    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!dataset) return <div>No data available</div>;
    
    return <D3Map {...d3MapArgs} data={dataset} />;
  },
};
PaintMode.storyName = "Paint Mode (broken)"

/** Lasso select with selection state and live mode control */
export const PaintModeWithSelection: Story = {
  render: (args) => {
    const { kedro_base_url, ...d3MapArgs } = args;
    const { dataset, loading, error } = useStorybookDataLoader(kedro_base_url);
    const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
    
    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!dataset) return <div>No data available</div>;
    
    return (
      <>
        <D3Map
          {...d3MapArgs}
          data={dataset}
          onSelectionChange={(ids: (string | number)[]) => setSelectedIds(ids as number[])}
        />
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 10,
            background: "rgba(255,255,255,0.8)",
            padding: 4,
            fontSize: 12,
          }}
        >
          Selected IDs: {selectedIds.join(", ")}
        </div>
      </>
    );
  },
};

export const QuickSelectDemo: Story = {
  render: (args) => {
    const { kedro_base_url, ...d3MapArgs } = args;
    const { dataset, loading, error } = useStorybookDataLoader(kedro_base_url);
    const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
    const [quickId, setQuickId] = React.useState<string | null>(null);

    const handleSelectionChange = (ids: (string | number)[]) => {
      setSelectedIds(ids as number[]);
      // if (ids.length === 1) {
      //   setQuickId(ids[0]);
      // } else {
      //   setQuickId(null);
      // }
    };

    const handleQuickSelect = (id: string) => {
      setQuickId(id)
    }

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!dataset) return <div>No data available</div>;
    
    return (
      <>
        <D3Map
          {...d3MapArgs}
          data={dataset}
          onSelectionChange={handleSelectionChange}
          onQuickSelect={handleQuickSelect}
        />
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 10,
            background: "rgba(255,255,255,0.8)",
            padding: 4,
            fontSize: 12,
          }}
        >
          <div>Selected IDs: {selectedIds.join(", ")}</div>
          <div>QuickSelect ID: {quickId ?? "none"}</div>
        </div>
      </>
    );
  },
};

/** Kedro endpoint mode - loads data from Kedro API */
export const KedroMode: Story = {
  render: (args) => {
    // Extract kedro_base_url from args and remove it before passing to D3Map
    const { kedro_base_url, ...d3MapArgs } = args as any;
    const { dataset, loading, error } = useStorybookDataLoader(kedro_base_url);
    
    if (loading) return <div>Loading data...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!dataset) return <div>No data available</div>;
    
    return <D3Map {...d3MapArgs} data={dataset} />;
  },
  args: {
    kedro_base_url: 'https://patcon.github.io/kedro-polislike-pipelines',
    mode: 'move' as const,
  },
};
KedroMode.storyName = "Kedro Mode";

/** Local Kedro endpoint mode - for development */
export const LocalKedroMode: Story = {
  render: (args) => {
    // Extract kedro_base_url from args and remove it before passing to D3Map
    const { kedro_base_url, ...d3MapArgs } = args as any;
    const { dataset, loading, error } = useStorybookDataLoader(kedro_base_url);
    
    if (loading) return <div>Loading data...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!dataset) return <div>No data available</div>;
    
    return <D3Map {...d3MapArgs} data={dataset} />;
  },
  args: {
    kedro_base_url: 'http://localhost:4141',
    mode: 'move' as const,
  },
};
LocalKedroMode.storyName = "Local Kedro Mode";
