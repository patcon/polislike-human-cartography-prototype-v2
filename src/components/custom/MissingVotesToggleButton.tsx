import * as React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Grid2x2Plus, Grid2x2X } from "lucide-react";

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
            <Grid2x2Plus className="h-4 w-4 group-hover:hidden" />
          ) : (
            <Grid2x2X className="h-4 w-4 group-hover:hidden" />
          )}

          {/* Show opposite state on hover only */}
          {includeMissingVotes ? (
            <Grid2x2X className="h-4 w-4 hidden group-hover:block" />
          ) : (
          <Grid2x2Plus className="h-4 w-4 hidden group-hover:block" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {includeMissingVotes ? "Exclude missing votes" : "Include missing votes"}
      </TooltipContent>
    </Tooltip>
  );
};