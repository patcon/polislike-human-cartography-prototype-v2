// src/AppWithSheet.tsx
import React, { useState } from "react";
import ConfigSheetContent, { getInitialSelections } from "./ConfigSheetContent";
import type { Selections } from "./ConfigSheetContent";
import MainContent from "./MainContent";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MessageSquareText } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerTrigger,
} from "@/components/ui/drawer"; // ShadCN drawer

const AppWithSheet: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [currentPlot, setCurrentPlot] = useState<number | null>(null);

  const numPlots = 3;
  const [selections, setSelections] = useState<{ [plot: number]: Selections }>(() => {
    const initial = getInitialSelections();
    const all: { [plot: number]: Selections } = {};
    for (let i = 0; i < numPlots; i++) {
      all[i] = JSON.parse(JSON.stringify(initial));
    }
    return all;
  });

  const [pendingSelections, setPendingSelections] = useState<{
    [plot: number]: Selections;
  }>({});

  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleEdit = (plotIndex: number) => {
    setCurrentPlot(plotIndex);
    setPendingSelections((prev) => ({
      ...prev,
      [plotIndex]: JSON.parse(JSON.stringify(selections[plotIndex])),
    }));
    setOpen(true);
  };

  return (
    <div className="relative min-h-screen">
      <MainContent onEdit={handleEdit} plotSelections={selections} />

      {/* View Statements Drawer Trigger */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>
          <Button
            className="fixed bottom-4 right-4 z-10 flex items-center gap-2"
            variant="default"
          >
            <MessageSquareText className="w-4 h-4" /> View Statements
          </Button>
        </DrawerTrigger>
        <DrawerContent
          className="h-[200px] sm:h-[400px] md:h-[600px] max-w-full"
        >
          <DrawerHeader>
            <DrawerTitle>Statements</DrawerTitle>
            <DrawerDescription>
              View the statements for this plot.
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 overflow-y-auto flex-1">
            {/* Replace with your statements content */}
            <p>Statement content goes here...</p>
          </div>
          <DrawerFooter>
            <Button onClick={() => setDrawerOpen(false)}>Close</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Sheet for editing plot */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-full min-[540px]:w-[540px] min-[540px]:max-w-[540px] sm:w-[540px] sm:max-w-[540px] gap-0"
        >
          <SheetHeader>
            <SheetTitle>
              {currentPlot !== null
                ? `Configure Map ${currentPlot + 1} Pipeline`
                : "Pipeline Parameter Chooser"}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <ConfigSheetContent
              selections={pendingSelections[currentPlot!]!}
              setSelections={(newSel) =>
                setPendingSelections((prev) => ({
                  ...prev,
                  [currentPlot!]:
                    typeof newSel === "function"
                      ? newSel(prev[currentPlot!]!)
                      : newSel,
                }))
              }
            />
          </div>

          <div className="sticky bottom-0 bg-background border-t p-4 flex gap-2 justify-end shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <Button
              variant="default"
              className="flex-1"
              onClick={() => {
                if (currentPlot !== null) {
                  setSelections((prev) => ({
                    ...prev,
                    [currentPlot]: pendingSelections[currentPlot]!,
                  }));
                  setOpen(false);
                }
              }}
            >
              Update
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AppWithSheet;
