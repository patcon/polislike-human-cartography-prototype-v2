import React from "react";
import { useModelState, createRender } from "@anywidget/react";
import { D3Map } from "../components/convo-explorer/D3Map";

function D3MapWrapper() {
    // Read/write state synced with Python
    const [data] = useModelState<[string, [number, number]][]>("data");
    const [mode] = useModelState<"move" | "paint">("mode");
    const [selection, setSelection] = useModelState<number[]>("selection");
  
    if (!data) return <div>Loading data...</div>;
  
    return (
        <D3Map
            data={data}
            mode={mode || "paint"}
            onSelectionChange={(ids: (string | number)[]) => {
            // Sync back to Python automatically
            setSelection(ids.map(Number));
            }}
        />
    );
  }
  

// Export AFM-compatible render for AnyWidget
export default {
  render: createRender(D3MapWrapper),
};