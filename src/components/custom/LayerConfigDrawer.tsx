"use client";

import * as React from "react";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { X } from "lucide-react";
import { LayerTypeButton } from "./LayerTypeButton";
import { Vote, Group, Ruler } from "lucide-react";
import { VotesLayerConfig } from "./VotesLayerConfig";
import { MetricsLayerConfig } from "./MetricsLayerConfig";
import "./LayerConfigDrawer.css";
import { SelectLayerButton } from "./SelectLayerButton";

  type LayerConfigDrawerProps = {
    layerMode?: "groups" | "votes";
    onLayerModeChange?: (mode: "groups" | "votes") => void;
    statementId?: string;
    onStatementIdChange?: (statementId: string) => void;
    highlightPassVotes?: boolean;
    onHighlightPassVotesChange?: (value: boolean) => void;
  };

  export function LayerConfigDrawer({
    layerMode = "groups",
    onLayerModeChange,
    statementId = "0",
    onStatementIdChange,
    highlightPassVotes = true,
    onHighlightPassVotesChange,
  }: LayerConfigDrawerProps = {}) {
    // Use controlled state if provided, otherwise use internal state
    const [internalSelected, setInternalSelected] = React.useState<string>("groups");
    const selected = onLayerModeChange ? layerMode : internalSelected;
    const setSelected = (value: string) => {
      if (onLayerModeChange && (value === "groups" || value === "votes")) {
        onLayerModeChange(value);
      } else {
        setInternalSelected(value);
      }
    };

    // Use controlled state for highlight pass votes if provided, otherwise use internal state
    const [internalHighlightPassVotes, setInternalHighlightPassVotes] = React.useState(true);
    const currentHighlightPassVotes = onHighlightPassVotesChange ? highlightPassVotes : internalHighlightPassVotes;
    const handleHighlightPassVotesChange = onHighlightPassVotesChange || setInternalHighlightPassVotes;

    return (
      <Drawer modal={false}>
        <DrawerTrigger asChild>
          <SelectLayerButton />
        </DrawerTrigger>

        <DrawerContent>
          <DrawerHeader className="relative">
            <DrawerTitle className="text-sm font-semibold text-left">Map layers</DrawerTitle>

            <DrawerClose asChild>
              <button
                aria-label="Close"
                className="absolute top-3 right-3 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </DrawerClose>
          </DrawerHeader>

          {/* Grid of layer type buttons */}
          <div className="grid grid-cols-3 gap-4 px-6 pb-2">
            <div className="flex justify-center">
              <LayerTypeButton
                icon={Group}
                label="Groups"
                selected={selected === "groups"}
                onClick={() => {
                  if (selected !== "groups") setSelected("groups");
                }}
              />
            </div>
            <div className="flex justify-center">
              <LayerTypeButton
                icon={Vote}
                label="Votes"
                selected={selected === "votes"}
                onClick={() => {
                  if (selected !== "votes") setSelected("votes");
                }}
              />
            </div>
            <div className="flex justify-center">
              <LayerTypeButton
                icon={Ruler}
                label="Metrics"
                selected={selected === "metrics"}
                disabled={true}
                onClick={() => {
                  if (selected !== "metrics") setSelected("metrics");
                }}
              />
            </div>
          </div>

          {/* Divider line */}
          <div className="border-t border-gray-200 my-2" />

          {/* VotesLayerConfig only shows when "votes" is selected */}
          <div className="px-6 py-2 min-h-[120px]">
            {selected === "votes" && (
              <VotesLayerConfig
                highlightPassVotes={currentHighlightPassVotes}
                onHighlightPassVotesChange={handleHighlightPassVotesChange}
                statementId={statementId}
                onStatementIdChange={onStatementIdChange}
              />
            )}
            {selected === "metrics" && <MetricsLayerConfig />}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }
