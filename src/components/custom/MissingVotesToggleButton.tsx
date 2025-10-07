import * as React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TextAlignJustify, TextAlignStart } from "lucide-react";

type MissingVotesToggleButtonProps = {
  includeMissingVotes: boolean;
  onToggle: () => void;
  className?: string;
};

export const MissingVotesToggleButton: React.FC<MissingVotesToggleButtonProps> = ({
  includeMissingVotes,
  onToggle,
  className = "",
}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-6 w-6 group ${className}`}
          onClick={onToggle}
          aria-label={includeMissingVotes ? "Exclude missing votes" : "Include missing votes"}
        >
          {/* Show active state by default, hide on hover */}
          {includeMissingVotes ? (
            <TextAlignStart className="h-4 w-4 group-hover:hidden -rotate-90 stroke-4 scale-y-75" />
          ) : (
            <TextAlignJustify className="h-4 w-4 group-hover:hidden -rotate-90 stroke-4 scale-y-75" />
          )}

          {/* Show opposite state on hover only */}
          {includeMissingVotes ? (
            <TextAlignJustify className="h-4 w-4 hidden group-hover:block -rotate-90 stroke-4 scale-y-75" />
          ) : (
            <TextAlignStart className="h-4 w-4 hidden group-hover:block -rotate-90 stroke-4 scale-y-75" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {includeMissingVotes ? "Exclude missing votes" : "Include missing votes"}
      </TooltipContent>
    </Tooltip>
  );
};