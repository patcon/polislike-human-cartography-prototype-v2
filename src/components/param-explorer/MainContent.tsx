// src/MainSection.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Square, Columns2, Columns3, SlidersHorizontal } from "lucide-react";
import { Grid2x2Plus, Shrink, Group } from "lucide-react";
import type { Selections } from "./ConfigSheetContent";

const sectionIcons: Record<string, React.FC<any>> = {
  imputer: Grid2x2Plus,
  reducer: Shrink,
  clusterer: Group,
};

interface BadgeInfo {
  text: string;
  section: string;
}

function selectionSummary(selections: Selections): BadgeInfo[] {
  const badges: BadgeInfo[] = [];

  const sections: { key: keyof Selections; showParam?: boolean }[] = [
    { key: "imputer", showParam: true },
    { key: "reducer" },
    { key: "clusterer" },
  ];

  sections.forEach(({ key, showParam }) => {
    const section = selections[key];
    if (!section) return;

    const entries = Object.entries(section);
    if (entries.length === 0) return;

    const [algo, params] = entries[0];

    if (showParam && params && Object.keys(params).length > 0) {
      const firstParam = Object.keys(params)[0];
      badges.push({
        section: String(key),
        text: `${String(algo)}:${String(params[firstParam])}`,
      });
    } else {
      badges.push({ section: String(key), text: String(algo) });
    }
  });

  return badges;
}

interface MainSectionProps {
  onEdit: (plotIndex: number) => void;
  plotSelections: { [plot: number]: Selections };
}

const MainSection: React.FC<MainSectionProps> = ({ onEdit, plotSelections }) => {
  const [layout, setLayout] = useState<1 | 2 | 3>(1);
  const plots = Array.from({ length: layout });

  return (
    <div className="p-4">
      {/* layout selector */}
      <div className="pt-8 flex items-center justify-end gap-2 mb-4">
        <span className="text-sm font-medium">Layout</span>
        <div className="flex gap-2">
          <Button
            variant={layout === 1 ? "default" : "outline"}
            onClick={() => setLayout(1)}
            aria-label="Single column layout"
          >
            <Square className="w-4 h-4" />
          </Button>
          <Button
            variant={layout === 2 ? "default" : "outline"}
            onClick={() => setLayout(2)}
            aria-label="Two column layout"
          >
            <Columns2 className="w-4 h-4" />
          </Button>
          <Button
            variant={layout === 3 ? "default" : "outline"}
            onClick={() => setLayout(3)}
            aria-label="Three column layout"
          >
            <Columns3 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* grid */}
      <div
        className={`grid gap-4 ${
          layout === 1
            ? "grid-cols-1"
            : layout === 2
            ? "grid-cols-2"
            : "grid-cols-3"
        }`}
      >
        {plots.map((_, i) => {
          const summary = selectionSummary(plotSelections[i] ?? {});

          return (
            <div key={i} className="relative">
              {/* badges */}
              <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                {summary.map((s, idx) => {
                  const Icon = sectionIcons[s.section];
                  return (
                    <Badge key={idx} variant="secondary" className="text-xs flex items-center gap-1">
                      <Icon className="w-3 h-3" /> {s.text}
                    </Badge>
                  );
                })}
              </div>

              <Card className="h-124 flex items-center justify-center text-muted-foreground">
                Map {i + 1}
              </Card>

              <Button
                size="icon"
                variant="secondary"
                className="absolute bottom-2 right-2 rounded-full shadow-md hover:bg-secondary/80 hover:scale-105 transition-transform"
                onClick={() => onEdit(i)}
                aria-label={`Configure Map ${i + 1}`}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  );
};

export default MainSection;
