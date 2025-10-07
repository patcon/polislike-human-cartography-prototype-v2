import * as React from "react";
import { PALETTE_COLORS, VOTE_COLORS, VOTE_COLORS_HIGHLIGHT_PASS } from "@/constants";

export type GroupVoteData = {
  groupIndex: number;
  n_agree: number;
  n_disagree: number;
  n_pass: number;
  n_trials: number; // total participants who voted on this statement
  totalGroupSize: number; // total participants in this group (for calculating unseen)
};

export type GroupVoteComparisonWidgetProps = {
  groupVotes: GroupVoteData[];
  includeMissingVotes?: boolean;
  height?: number; // height of the vertical bars in pixels
  width?: number; // width of each column in pixels
  className?: string;
  voteColors?: typeof VOTE_COLORS | typeof VOTE_COLORS_HIGHLIGHT_PASS;
  voteOrder?: string; // Order of vote types from top to bottom (U=unseen, D=disagree, P=pass, A=agree)
  highlightGroupIndex?: number; // Group index to highlight (dims other columns)
};

export const GroupVoteComparisonWidget: React.FC<GroupVoteComparisonWidgetProps> = ({
  groupVotes,
  includeMissingVotes = false,
  height = 40,
  width = 12, // Default width in pixels (w-3 = 12px)
  className = "",
  voteColors = VOTE_COLORS,
  voteOrder = "UDPA", // Default: Unseen, Disagree, Pass, Agree (top to bottom)
  highlightGroupIndex,
}) => {
  // Debug logging to see if component re-renders with new props
  console.log('🔍 GroupVoteComparisonWidget rendered with:', {
    includeMissingVotes,
    groupVotesLength: groupVotes?.length
  });

  if (!groupVotes || groupVotes.length === 0) {
    return null;
  }

  const renderGroupData = (groupData: GroupVoteData) => {
    const { groupIndex, n_agree, n_disagree, n_pass, n_trials, totalGroupSize } = groupData;

    // Calculate unseen participants (those who never voted on this statement)
    const unseen = Math.max(0, totalGroupSize - n_trials);

    // Calculate proportions based on includeMissingVotes setting
    const totalForCalculation = includeMissingVotes ? totalGroupSize : n_trials;

    // Get group color - use black for unpainted group (index -1)
    const groupColor = groupIndex === -1 ? "#000000" : (PALETTE_COLORS[groupIndex] || "#000000");

    // Determine if this column should be dimmed (dim others when highlighting is active)
    const shouldDim = highlightGroupIndex !== undefined && groupIndex !== highlightGroupIndex;

    const NON_HIGHLIGHT_GROUP_OPACITY = 0.5;

    if (totalForCalculation === 0) {
      return {
        groupIndex,
        colorIndicator: groupColor,
        barContent: (
          <div
            className="bg-gray-100"
            style={{
              height: `${height}px`,
              width: `${width}px`,
              opacity: shouldDim ? NON_HIGHLIGHT_GROUP_OPACITY : 1
            }}
          />
        )
      };
    }

    // Calculate heights for each vote type
    const agreeHeight = (n_agree / totalForCalculation) * height;
    const disagreeHeight = (n_disagree / totalForCalculation) * height;
    const passHeight = (n_pass / totalForCalculation) * height;
    const unseenHeight = includeMissingVotes ? (unseen / totalForCalculation) * height : 0;

    return {
      groupIndex,
      colorIndicator: groupColor,
      barContent: (
        <div
          className="flex flex-col overflow-hidden"
          style={{
            height: `${height}px`,
            width: `${width}px`,
            opacity: shouldDim ? NON_HIGHLIGHT_GROUP_OPACITY : 1
          }}
        >
          {voteOrder.split('').map((voteType, index) => {
            let voteHeight = 0;
            let backgroundColor = "";

            switch (voteType.toUpperCase()) {
              case 'U': // Unseen
                if (!includeMissingVotes || unseenHeight === 0) return null;
                voteHeight = unseenHeight;
                backgroundColor = "#ffffff";
                break;
              case 'D': // Disagree
                if (disagreeHeight === 0) return null;
                voteHeight = disagreeHeight;
                backgroundColor = voteColors.disagree;
                break;
              case 'P': // Pass
                if (passHeight === 0) return null;
                voteHeight = passHeight;
                backgroundColor = voteColors.pass;
                break;
              case 'A': // Agree
                if (agreeHeight === 0) return null;
                voteHeight = agreeHeight;
                backgroundColor = voteColors.agree;
                break;
              default:
                return null;
            }

            return (
              <div
                key={`${voteType}-${index}`}
                style={{
                  height: `${voteHeight}px`,
                  backgroundColor
                }}
              />
            );
          })}
        </div>
      )
    };
  };

  const renderedGroups = groupVotes.map(renderGroupData);

  // Calculate proportional indicator size based on width and height
  // Make it a rounded rectangle that scales with the column width
  const indicatorWidth = Math.max(width * 0.7, 3); // At least 3px wide, scales with column
  const indicatorHeight = Math.max(2, Math.min(width * 0.4, height * 0.15, 8)); // Height scales but has limits
  const borderRadius = Math.min(indicatorHeight * 0.5, 3); // Rounded corners
  const marginBottom = Math.max(1, Math.min(width * 0.15, height * 0.08, 6)); // Proportional margin

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      {/* Top row: Group color indicators */}
      <div className="inline-flex gap-0" style={{ marginBottom: `${marginBottom}px` }}>
        {renderedGroups.map(({ groupIndex, colorIndicator }) => (
          <div key={`indicator-${groupIndex}`} className="flex justify-center" style={{ width: `${width}px` }}>
            {colorIndicator && (
              <div
                style={{
                  backgroundColor: colorIndicator,
                  width: `${indicatorWidth}px`,
                  height: `${indicatorHeight}px`,
                  borderRadius: `${borderRadius}px`
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Bottom row: Vertical bars with no border */}
      <div className="inline-flex gap-0">
        {renderedGroups.map(({ groupIndex, barContent }) => (
          <div key={`bar-${groupIndex}`}>
            {barContent}
          </div>
        ))}
      </div>
    </div>
  );
};