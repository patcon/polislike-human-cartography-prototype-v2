import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { D3Map } from "./D3Map";
import { useStorybookDataLoader } from "../../../.storybook/hooks/useStorybookDataLoader";
import { usePipelineOptions } from "../../../.storybook/hooks/usePipelineOptions";
import { decodeStorybookArgs, encodeStorybookParam } from "../../../.storybook/preview";

// Extend the D3Map props to include kedroBaseUrl and pipelineId for stories
type D3MapStoryArgs = React.ComponentProps<typeof D3Map> & {
  kedroBaseUrl?: string;
  pipelineId?: string;
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
      options: ["move", "paint", "spotlight"],
      description: "Map interaction mode",
    },
    kedroBaseUrl: {
      control: "text",
      description: "Base URL for Kedro API endpoints (when provided, loads data from Kedro instead of local JSON)",
    },
    pipelineId: {
      control: "text",
      description: "Pipeline ID to load data from (e.g., mean_localmap_bestkmeans, mean_pca_bestkmeans)",
    },
    testAnimation: {
      control: "boolean",
      description: "Enable pipeline switching and animation testing",
    },
  },
};

export default meta;
type Story = StoryObj<D3MapStoryArgs>;

/** Pan/zoom only with live mode control */
export const MoveMode: Story = {
  render: (args) => {
    const decodedArgs = decodeStorybookArgs(args);
    const { kedroBaseUrl, pipelineId, ...d3MapArgs } = decodedArgs;
    const { pipelines, loading: pipelinesLoading } = usePipelineOptions(kedroBaseUrl, 'bestkmeans');
    const { dataset, loading, error } = useStorybookDataLoader(kedroBaseUrl, pipelineId);

    // Show pipeline options in console for debugging
    React.useEffect(() => {
      if (pipelines.length > 0) {
        console.log('Available pipelines:', pipelines);
      }
    }, [pipelines]);

    if (loading || pipelinesLoading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!dataset) return <div>No data available</div>;

    return <D3Map {...d3MapArgs} data={dataset} />;
  },
};
MoveMode.storyName = "Move Mode (broken)"

/** Freeform lasso select with live mode control */
export const PaintMode: Story = {
  render: (args) => {
    const decodedArgs = decodeStorybookArgs(args);
    const { kedroBaseUrl, pipelineId, ...d3MapArgs } = decodedArgs;
    const { pipelines, loading: pipelinesLoading } = usePipelineOptions(kedroBaseUrl, 'bestkmeans');
    const { dataset, loading, error } = useStorybookDataLoader(kedroBaseUrl, pipelineId);

    // Show pipeline options in console for debugging
    React.useEffect(() => {
      if (pipelines.length > 0) {
        console.log('Available pipelines:', pipelines);
      }
    }, [pipelines]);

    if (loading || pipelinesLoading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!dataset) return <div>No data available</div>;

    return <D3Map {...d3MapArgs} data={dataset} />;
  },
};
PaintMode.storyName = "Paint Mode (broken)"

/** Lasso select with selection state and live mode control */
export const PaintModeWithSelection: Story = {
  render: (args) => {
    const decodedArgs = decodeStorybookArgs(args);
    const { kedroBaseUrl, pipelineId, ...d3MapArgs } = decodedArgs;
    const { pipelines, loading: pipelinesLoading } = usePipelineOptions(kedroBaseUrl, 'bestkmeans');
    const { dataset, loading, error } = useStorybookDataLoader(kedroBaseUrl, pipelineId);
    const [selectedIds, setSelectedIds] = React.useState<number[]>([]);

    // Show pipeline options in console for debugging
    React.useEffect(() => {
      if (pipelines.length > 0) {
        console.log('Available pipelines:', pipelines);
      }
    }, [pipelines]);

    if (loading || pipelinesLoading) return <div>Loading...</div>;
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

/** Circle-follows-cursor selection: hover to select, pinch to resize on touch */
export const SpotlightModeSelection: Story = {
  render: (args) => {
    const decodedArgs = decodeStorybookArgs(args);
    const { kedroBaseUrl, pipelineId, ...d3MapArgs } = decodedArgs;
    const { pipelines, loading: pipelinesLoading } = usePipelineOptions(kedroBaseUrl, 'bestkmeans');
    const { dataset, loading, error } = useStorybookDataLoader(kedroBaseUrl, pipelineId);
    const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
    const [radius, setRadius] = React.useState(60);
    const [persist, setPersist] = React.useState(false);
    type DebugEntry = {
      event: string;
      touchCount: number;
      currentRadius: number;
      cx: number;
      cy: number;
      grabOffsetX: number;
      grabOffsetY: number;
    };
    const [debugState, setDebugState] = React.useState<DebugEntry | null>(null);
    const [debugLog, setDebugLog] = React.useState<string[]>([]);
    const [copied, setCopied] = React.useState(false);

    const handleDebug = React.useCallback((state: DebugEntry) => {
      setDebugState(state);
      const line = `${state.event} | touches:${state.touchCount} r:${state.currentRadius.toFixed(1)} cx:${state.cx.toFixed(1)} cy:${state.cy.toFixed(1)} grabX:${state.grabOffsetX.toFixed(1)} grabY:${state.grabOffsetY.toFixed(1)}`;
      setDebugLog(prev => [...prev.slice(-199), line]);
    }, []);

    React.useEffect(() => {
      if (pipelines.length > 0) {
        console.log('Available pipelines:', pipelines);
      }
    }, [pipelines]);

    function fallbackCopy(text: string) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;top:-9999px;left:-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }

    if (loading || pipelinesLoading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!dataset) return <div>No data available</div>;

    return (
      <>
        <D3Map
          {...d3MapArgs}
          data={dataset}
          mode="spotlight"
          spotlightRadius={radius}
          spotlightPersist={persist}
          onSelectionChange={(ids: (string | number)[]) => setSelectedIds(ids as number[])}
          onSpotlightRadiusChange={setRadius}
          onSpotlightDebug={handleDebug}
        />
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 10,
            background: "rgba(255,255,255,0.9)",
            padding: 8,
            fontSize: 11,
            fontFamily: "monospace",
            display: "flex",
            flexDirection: "column",
            gap: 3,
            borderRadius: 4,
            minWidth: 220,
            maxWidth: 320,
            userSelect: "none",
          }}
        >
          <details>
            <summary style={{ cursor: "pointer" }}>
              Selected: {selectedIds.length} points
            </summary>
            <div style={{ marginTop: 4, wordBreak: "break-all", color: "#555" }}>
              {selectedIds.join(", ") || "none"}
            </div>
          </details>
          <hr style={{ margin: "2px 0", border: "none", borderTop: "1px solid #ccc" }} />
          {debugState ? (
            <>
              <div>event: <b>{debugState.event}</b></div>
              <div>touches: <b>{debugState.touchCount}</b></div>
              <div>radius: <b>{debugState.currentRadius.toFixed(1)}</b></div>
              <div>cx/cy: <b>{debugState.cx.toFixed(1)}, {debugState.cy.toFixed(1)}</b></div>
              <div>grabOffset: <b>{debugState.grabOffsetX.toFixed(1)}, {debugState.grabOffsetY.toFixed(1)}</b></div>
            </>
          ) : (
            <div style={{ color: "#999" }}>no touch events yet</div>
          )}
          <hr style={{ margin: "2px 0", border: "none", borderTop: "1px solid #ccc" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
            <span>Event log ({debugLog.length})</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={() => {
                  const text = debugLog.join("\n");
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
                  } else {
                    fallbackCopy(text);
                  }
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                style={{ fontSize: 10, padding: "1px 6px", cursor: "pointer" }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={() => setDebugLog([])}
                style={{ fontSize: 10, padding: "1px 6px", cursor: "pointer" }}
              >
                Clear
              </button>
            </div>
          </div>
          <div style={{
            maxHeight: 120,
            overflowY: "auto",
            fontSize: 10,
            color: "#444",
            lineHeight: 1.4,
            wordBreak: "break-all",
          }}>
            {debugLog.length === 0
              ? <span style={{ color: "#999" }}>—</span>
              : [...debugLog].reverse().map((line, i) => <div key={i}>{line}</div>)
            }
          </div>
          <hr style={{ margin: "2px 0", border: "none", borderTop: "1px solid #ccc" }} />
          <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span>Radius: {Math.round(radius)}px</span>
            <input
              type="range"
              min={10}
              max={500}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              style={{ width: 180 }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={persist}
              onChange={(e) => setPersist(e.target.checked)}
            />
            Persist circle between touches
          </label>
        </div>
      </>
    );
  },
};

export const QuickSelectDemo: Story = {
  render: (args) => {
    const decodedArgs = decodeStorybookArgs(args);
    const { kedroBaseUrl, pipelineId, ...d3MapArgs } = decodedArgs;
    const { pipelines, loading: pipelinesLoading } = usePipelineOptions(kedroBaseUrl, 'bestkmeans');
    const { dataset, loading, error } = useStorybookDataLoader(kedroBaseUrl, pipelineId);
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

    // Show pipeline options in console for debugging
    React.useEffect(() => {
      if (pipelines.length > 0) {
        console.log('Available pipelines:', pipelines);
      }
    }, [pipelines]);

    if (loading || pipelinesLoading) return <div>Loading...</div>;
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
    // Extract kedroBaseUrl and pipelineId from args and remove them before passing to D3Map
    const decodedArgs = decodeStorybookArgs(args as Record<string, unknown>);
    const { kedroBaseUrl, pipelineId, ...d3MapArgs } = decodedArgs;
    const { pipelines, loading: pipelinesLoading } = usePipelineOptions(kedroBaseUrl, 'bestkmeans');
    const { dataset, loading, error } = useStorybookDataLoader(kedroBaseUrl, pipelineId);

    // Show pipeline options in console for debugging
    React.useEffect(() => {
      if (pipelines.length > 0) {
        console.log('Available pipelines:', pipelines);
      }
    }, [pipelines]);

    if (loading || pipelinesLoading) return <div>Loading data...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!dataset) return <div>No data available</div>;

    return (
      <D3Map
        {...d3MapArgs}
        data={dataset}
        testAnimation={args.testAnimation || false}
        kedroBaseUrl={kedroBaseUrl}
        availablePipelines={pipelines}
      />
    );
  },
  args: {
    kedroBaseUrl: encodeStorybookParam('https://patcon.github.io/kedro-polislike-pipelines'),
    pipelineId: 'mean_localmap_bestkmeans',
    mode: 'move' as const,
    testAnimation: false,
  },
};
KedroMode.storyName = "Kedro Mode";

/** Local Kedro endpoint mode - for development */
export const LocalKedroMode: Story = {
  render: (args) => {
    // Extract kedroBaseUrl and pipelineId from args and remove them before passing to D3Map
    const decodedArgs = decodeStorybookArgs(args as Record<string, unknown>);
    const { kedroBaseUrl, pipelineId, ...d3MapArgs } = decodedArgs;
    const { pipelines, loading: pipelinesLoading } = usePipelineOptions(kedroBaseUrl, 'bestkmeans');
    const { dataset, loading, error } = useStorybookDataLoader(kedroBaseUrl, pipelineId);

    // Show pipeline options in console for debugging
    React.useEffect(() => {
      if (pipelines.length > 0) {
        console.log('Available pipelines:', pipelines);
      }
    }, [pipelines]);

    if (loading || pipelinesLoading) return <div>Loading data...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!dataset) return <div>No data available</div>;

    return (
      <D3Map
        {...d3MapArgs}
        data={dataset}
        testAnimation={args.testAnimation || false}
        kedroBaseUrl={kedroBaseUrl}
        availablePipelines={pipelines}
      />
    );
  },
  args: {
    kedroBaseUrl: encodeStorybookParam('http://localhost:4141'),
    pipelineId: 'mean_localmap_bestkmeans',
    mode: 'move' as const,
    testAnimation: false,
  },
};
LocalKedroMode.storyName = "Local Kedro Mode";
