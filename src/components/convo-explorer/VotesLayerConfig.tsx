"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type VotesLayerConfigProps = {
  highlightPassVotes: boolean;
  onHighlightPassVotesChange: (value: boolean) => void;
  statementId?: string;
  onStatementIdChange?: (value: string) => void;
};

export function VotesLayerConfig({
  highlightPassVotes,
  onHighlightPassVotesChange,
  statementId = "0",
  onStatementIdChange,
}: VotesLayerConfigProps) {
  return (
    <div className="space-y-4">
      {/* Statement ID input */}
      <div className="flex items-center gap-2">
        <Label htmlFor="statement-id" className="text-sm">
          Statement ID:
        </Label>
        <Input
          id="statement-id"
          type="number"
          value={statementId}
          onChange={(e) => onStatementIdChange?.(e.target.value)}
          className="w-20"
          min="0"
        />
      </div>

      {/* Highlight Pass toggle */}
      <div className="flex items-center gap-2">
        <Switch
          checked={highlightPassVotes}
          onCheckedChange={onHighlightPassVotesChange}
          id="highlight-pass-votes"
        />
        <Label htmlFor="highlight-pass-votes" className="select-none text-sm">
          Highlight pass votes
        </Label>
      </div>
    </div>
  );
}
