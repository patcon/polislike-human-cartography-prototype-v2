import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { D3Map } from "./D3Map";
import { FloatingModalV2Stack } from "./FloatingModalV2Stack";
import { useStorybookDataLoader } from "../../../.storybook/hooks/useStorybookDataLoader";
import {
  calculateRepresentativeStatements,
  createStatementTextMap,
  type FinalizedCommentStats,
} from "@/lib/representative-statements";
import { initializeDuckDB } from "@/lib/duckdb";

type Statement = { statement_id: number; txt: string; moderated?: number };

const meta: Meta = {
  title: "Components/D3Map",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj;

function SpotlightRepStatementsDemo() {
  const { dataset, loading: dataLoading, error: dataError } = useStorybookDataLoader();
  const [statements, setStatements] = useState<Statement[]>([]);
  const [dbReady, setDbReady] = useState(false);
  const [stackItems, setStackItems] = useState<
    { id: string | number; statement: Statement; variant: "agree" | "disagree" }[]
  >([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [selectionCount, setSelectionCount] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestIdsRef = useRef<(string | number)[]>([]);

  useEffect(() => {
    fetch("/statements.json")
      .then((r) => r.json())
      .then(setStatements)
      .catch(console.error);

    initializeDuckDB()
      .then(() => setDbReady(true))
      .catch(console.error);
  }, []);

  const runCalculation = useCallback(
    async (selectedIds: (string | number)[]) => {
      if (!dataset || !dbReady || selectedIds.length < 2) {
        setStackItems([]);
        return;
      }

      setIsCalculating(true);
      try {
        const participants = dataset.map(([id]) => id);
        const selectedSet = new Set(selectedIds.map(String));
        const labelArray = participants.map((id) => (selectedSet.has(id) ? "0" : null));
        const commentTextMap = createStatementTextMap(statements);

        const result = await calculateRepresentativeStatements(
          labelArray,
          participants,
          commentTextMap,
          { maxStatementsCount: 10 }
        );

        const top3: FinalizedCommentStats[] = result.repComments["0"]?.slice(0, 3) ?? [];
        setStackItems(
          top3.map((stat) => ({
            id: stat.tid,
            statement: {
              statement_id: Number(stat.tid),
              txt: String(commentTextMap[stat.tid] ?? ""),
            },
            variant: stat.repful_for === "agree" ? "agree" : "disagree",
          }))
        );
      } catch (err) {
        console.error("Rep statements error:", err);
        setStackItems([]);
      } finally {
        setIsCalculating(false);
      }
    },
    [dataset, dbReady, statements]
  );

  const handleSelectionChange = useCallback(
    (ids: (string | number)[]) => {
      latestIdsRef.current = ids;
      setSelectionCount(ids.length);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        runCalculation(latestIdsRef.current);
      }, 400);
    },
    [runCalculation]
  );

  if (dataLoading) return <div className="flex items-center justify-center h-screen text-sm text-gray-500">Loading data…</div>;
  if (dataError) return <div className="flex items-center justify-center h-screen text-sm text-red-500">Error: {dataError}</div>;
  if (!dataset) return null;

  return (
    <div style={{ position: "relative", width: "100dvw", height: "100dvh" }}>
      <D3Map
        data={dataset}
        mode="spotlight"
        spotlightPersist={true}
        onSelectionChange={handleSelectionChange}
      />

      {/* Status overlay */}
      <div
        style={{
          position: "absolute",
          top: "1rem",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.6)",
          color: "white",
          borderRadius: "0.5rem",
          padding: "0.4rem 0.8rem",
          fontSize: "0.75rem",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        {!dbReady
          ? "Initialising database…"
          : isCalculating
          ? `Calculating… (${selectionCount} selected)`
          : selectionCount < 2
          ? "Move the spotlight over participants"
          : `${selectionCount} selected — ${stackItems.length} rep statements`}
      </div>

      <FloatingModalV2Stack items={stackItems} isVisible={stackItems.length > 0} />
    </div>
  );
}

export const SpotlightRepresentativeStatements: Story = {
  render: () => <SpotlightRepStatementsDemo />,
};
