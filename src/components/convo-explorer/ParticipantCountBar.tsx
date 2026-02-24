"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PALETTE_COLORS, type PointGroupAssignment, UNPAINTED_VALUE } from "@/constants";
import { cn } from "@/lib/utils";
import { SquaresSubtract as ExcludesUnpainted, SquaresUnite as IncludesUnpainted } from "lucide-react";

type PointGroupData = {
  label: string;
  count: number;
  colorIndex: number; // UNPAINTED_VALUE for unpainted group
};

type ParticipantCountBarProps = {
  pointGroups: PointGroupAssignment[];
  isUnpaintedGrouped?: boolean;
  onUnpaintedGroupedChange?: (isGrouped: boolean) => void;
  isProportional?: boolean;
  className?: string;
  /** Display mask parallel to pointGroups: true = visible, false = hidden. When undefined, all points counted. */
  displayMask?: boolean[];
};

export const ParticipantCountBar: React.FC<ParticipantCountBarProps> = ({
  pointGroups,
  isUnpaintedGrouped: controlledIsUnpaintedGrouped,
  onUnpaintedGroupedChange,
  isProportional = true,
  className,
  displayMask,
}) => {
  // Internal state for uncontrolled mode
  const [internalIsUnpaintedGrouped, setInternalIsUnpaintedGrouped] = React.useState(false);

  // Determine if we're in controlled mode
  const isControlled = controlledIsUnpaintedGrouped !== undefined;
  const isUnpaintedGrouped = isControlled ? controlledIsUnpaintedGrouped : internalIsUnpaintedGrouped;

  // Calculate group data from pointGroups
  const groupData = React.useMemo(() => {
    const coloredGroups: PointGroupData[] = [];
    let unpaintedGroup: PointGroupData | null = null;
    const groupCounts = new Map<number, number>();

    // Count occurrences of each group (skip masked participants)
    pointGroups.forEach((group, i) => {
      if (displayMask && !displayMask[i]) return;
      groupCounts.set(group, (groupCounts.get(group) || 0) + 1);
    });

    // Handle unpainted group separately
    let unpaintedCount = 0;
    pointGroups.forEach((group, i) => {
      if (displayMask && !displayMask[i]) return;
      if (group === UNPAINTED_VALUE) {
        unpaintedCount++;
      }
    });

    if (unpaintedCount > 0) {
      unpaintedGroup = {
        label: unpaintedCount.toString(),
        count: unpaintedCount,
        colorIndex: UNPAINTED_VALUE,
      };
    }

    // Add other groups in order (just show numbers)
    for (let i = 0; i < PALETTE_COLORS.length; i++) {
      const count = groupCounts.get(i) || 0;
      if (count > 0) {
        coloredGroups.push({
          label: count.toString(),
          count,
          colorIndex: i,
        });
      }
    }

    return { coloredGroups, unpaintedGroup };
  }, [pointGroups, displayMask]);

  // Calculate group data from pointGroups (kept for compatibility; widthPercent unused in proportional render)
  const proportionalData = React.useMemo(() => {
    if (!isProportional) return null;

    const totalPoints = displayMask
      ? displayMask.filter(Boolean).length
      : pointGroups.length;
    if (totalPoints === 0) return null;

    return {
      coloredGroups: groupData.coloredGroups,
      unpaintedGroup: groupData.unpaintedGroup,
    };
  }, [groupData, isProportional, pointGroups, displayMask]);

  const handleUnpaintedClick = () => {
    const newValue = !isUnpaintedGrouped;

    if (isControlled) {
      onUnpaintedGroupedChange?.(newValue);
    } else {
      setInternalIsUnpaintedGrouped(newValue);
    }
  };

  if (groupData.coloredGroups.length === 0 && !groupData.unpaintedGroup) {
    return null;
  }

  if (isProportional && proportionalData) {
    // Proportional layout.
    //
    // The colored badge wrapper and the unpainted button are siblings in an outer flex row.
    // When the button is inactive (gray): wrapper takes all remaining space (flex: 1 1 0),
    //   button is fixed at content size (flex-shrink: 0) — always visible.
    // When the button is active (black): both wrapper and button use flex-grow proportional
    //   to their participant counts, so the button expands to its fair share. The button
    //   still has minWidth: fit-content as a floor so it is never pushed off-screen even
    //   when the container is very narrow.
    const hasColoredGroups = proportionalData.coloredGroups.length > 0;
    const totalColoredCount = proportionalData.coloredGroups.reduce((sum, g) => sum + g.count, 0);
    const unpaintedCount = proportionalData.unpaintedGroup?.count ?? 0;

    const coloredBadges = proportionalData.coloredGroups.map((group, index) => {
      const color = PALETTE_COLORS[group.colorIndex!];
      const isFirst = index === 0;
      const isLast = index === proportionalData.coloredGroups.length - 1;

      // Determine border radius override classes and margin for continuous appearance
      let borderRadiusOverride = '';
      let marginClass = '';
      if (isFirst && isLast) {
        borderRadiusOverride = ''; // Single badge keeps default rounding
      } else if (isFirst) {
        borderRadiusOverride = 'rounded-r-none'; // First badge: remove right rounding
      } else if (isLast) {
        borderRadiusOverride = 'rounded-l-none'; // Last badge: remove left rounding
      } else {
        borderRadiusOverride = 'rounded-none'; // Middle badges: remove all rounding
      }
      if (!isFirst) {
        marginClass = '-ml-1'; // Pull non-first badges left to close gaps
      }

      return (
        <Badge
          key={group.colorIndex}
          className={cn(
            "text-white border-0 text-xs py-0.5 h-6 pl-2 pr-2 overflow-hidden",
            borderRadiusOverride,
            marginClass
          )}
          style={{
            backgroundColor: color,
            flexGrow: group.count,  // proportional to participant count within wrapper
            flexShrink: 1,
            flexBasis: 0,
            minWidth: 0,            // allow shrinking below label width at narrow sizes
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            textAlign: 'right',
            transition: 'width 300ms ease-in-out, background-color 300ms ease-in-out',
          }}
        >
          {group.label}
        </Badge>
      );
    });

    // When active, wrapper and button share total width by participant count ratio.
    // When inactive, wrapper takes all remaining space; button is fixed at content size.
    const wrapperStyle: React.CSSProperties = isUnpaintedGrouped && unpaintedCount > 0
      ? { flexGrow: totalColoredCount, flexShrink: 1, flexBasis: 0, minWidth: 0, display: 'flex' }
      : { flex: '1 1 0', minWidth: 0, display: 'flex' };

    const buttonFlexStyle: React.CSSProperties = isUnpaintedGrouped && unpaintedCount > 0
      ? { flexGrow: unpaintedCount, flexShrink: 1, flexBasis: 0, minWidth: 'fit-content' }
      : { flexShrink: 0, minWidth: 'fit-content' };

    return (
      <div className={cn(
        "flex gap-1 items-center w-full",
        !hasColoredGroups ? "justify-end" : "",
        className
      )}>
        {/* Colored groups in a sub-container */}
        {hasColoredGroups && (
          <div style={wrapperStyle}>
            {coloredBadges}
          </div>
        )}

        {/* Unpainted button */}
        {proportionalData.unpaintedGroup && (
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "text-xs py-0.5 h-6 pl-2 pr-2 border-2",
              "transition-none", // Disable all transitions to prevent hopping/movement
              isUnpaintedGrouped
                ? "bg-unpainted text-white border-unpainted hover:bg-unpainted-800 hover:text-white"
                : "bg-white text-unpainted-600 border-unpainted-300 hover:bg-unpainted-200 hover:border-unpainted-400",
            )}
            onClick={handleUnpaintedClick}
            style={{
              ...buttonFlexStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              textAlign: 'right',
            }}
          >
            <div className="flex items-center gap-1">
              {isUnpaintedGrouped ? (
                <IncludesUnpainted className="h-3 w-3" strokeWidth={3} />
              ) : (
                <ExcludesUnpainted className="h-3 w-3" strokeWidth={3} />
              )}
              {proportionalData.unpaintedGroup.label}
            </div>
          </Button>
        )}
      </div>
    );
  }

  // Non-proportional layout (original)
  return (
    <div className={cn("flex gap-1 flex-wrap items-center justify-between", className)}>
      {/* Colored groups container - continuous design using styled badges */}
      <div className="flex gap-1 flex-wrap">
        {groupData.coloredGroups.map((group, index) => {
          const color = PALETTE_COLORS[group.colorIndex!];
          const isFirst = index === 0;
          const isLast = index === groupData.coloredGroups.length - 1;

          // Determine border radius override classes and margin for continuous appearance
          let borderRadiusOverride = '';
          let marginClass = '';
          if (isFirst && isLast) {
            borderRadiusOverride = ''; // Single badge keeps default rounding
          } else if (isFirst) {
            borderRadiusOverride = 'rounded-r-none'; // First badge: remove right rounding
          } else if (isLast) {
            borderRadiusOverride = 'rounded-l-none'; // Last badge: remove left rounding
          } else {
            borderRadiusOverride = 'rounded-none'; // Middle badges: remove all rounding
          }
          if (!isFirst) {
            marginClass = '-ml-1'; // Pull non-first badges left to close gaps
          }

          return (
            <Badge
              key={group.colorIndex}
              className={cn(
                "text-white border-0 text-xs py-0.5 h-6 pl-2 pr-2",
                borderRadiusOverride,
                marginClass
              )}
              style={{
                backgroundColor: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                textAlign: 'right',
              }}
            >
              {group.label}
            </Badge>
          );
        })}
      </div>

      {/* Unpainted group on the right */}
      {groupData.unpaintedGroup && (
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "text-xs py-0.5 h-6 pl-2 pr-2 border-2",
            "transition-none", // Disable all transitions to prevent hopping/movement
            isUnpaintedGrouped
              ? "bg-unpainted text-white border-unpainted hover:bg-unpainted-800 hover:text-white"
              : "bg-white text-unpainted-600 border-unpainted-300 hover:bg-unpainted-200 hover:border-unpainted-400"
          )}
          onClick={handleUnpaintedClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            textAlign: 'right',
          }}
        >
          <div className="flex items-center gap-1">
            {isUnpaintedGrouped ? (
              <IncludesUnpainted className="h-3 w-3" strokeWidth={3} />
            ) : (
              <ExcludesUnpainted className="h-3 w-3" strokeWidth={3} />
            )}
            {groupData.unpaintedGroup.label}
          </div>
        </Button>
      )}
    </div>
  );
};
