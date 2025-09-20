"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { PALETTE_COLORS, UNPAINTED_COLOR } from "@/constants";
import { cn } from "@/lib/utils";
import { SquaresSubtract as ExcludesUnpainted, SquaresUnite as IncludesUnpainted } from "lucide-react";

type PointGroupData = {
  label: string;
  count: number;
  colorIndex: number | null; // null for unpainted group
};

type ParticipantCountBarProps = {
  pointGroups: (number | null)[];
  isUnpaintedGrouped?: boolean;
  onUnpaintedGroupedChange?: (isGrouped: boolean) => void;
  isProportional?: boolean;
  className?: string;
};

export const ParticipantCountBar: React.FC<ParticipantCountBarProps> = ({
  pointGroups,
  isUnpaintedGrouped: controlledIsUnpaintedGrouped,
  onUnpaintedGroupedChange,
  isProportional = true,
  className,
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
    const groupCounts = new Map<number | null, number>();

    // Count occurrences of each group
    pointGroups.forEach(group => {
      groupCounts.set(group, (groupCounts.get(group) || 0) + 1);
    });

    // Handle unpainted group separately
    const unpaintedCount = groupCounts.get(null) || 0;
    if (unpaintedCount > 0) {
      unpaintedGroup = {
        label: unpaintedCount.toString(),
        count: unpaintedCount,
        colorIndex: null,
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
  }, [pointGroups]);

  // Calculate proportional widths if needed
  const proportionalData = React.useMemo(() => {
    if (!isProportional) return null;

    const totalPoints = pointGroups.length;
    if (totalPoints === 0) return null;

    // Calculate total number of badges to account for gaps
    const totalBadges = groupData.coloredGroups.length + (groupData.unpaintedGroup ? 1 : 0);
    const gapWidth = 4; // gap-1 = 4px in Tailwind
    
    // When unpainted is not grouped, it takes minimal space, colored badges divide the rest
    let coloredPointsTotal: number;
    let availableWidthPercent: number;
    
    if (groupData.unpaintedGroup && !isUnpaintedGrouped) {
      // Unpainted badge takes minimal space, colored badges get proportional share of remaining space
      coloredPointsTotal = groupData.coloredGroups.reduce((sum, group) => sum + group.count, 0);
      availableWidthPercent = 100; // Colored badges will use flex-grow to fill remaining space
    } else {
      // All badges (including unpainted if grouped) share space proportionally
      coloredPointsTotal = totalPoints - (groupData.unpaintedGroup && !isUnpaintedGrouped ? groupData.unpaintedGroup.count : 0);
      availableWidthPercent = 100;
    }

    const coloredGroupsWithWidth = groupData.coloredGroups.map(group => ({
      ...group,
      widthPercent: coloredPointsTotal > 0 ? (group.count / coloredPointsTotal) * availableWidthPercent : 0,
      useFlexGrow: groupData.unpaintedGroup && !isUnpaintedGrouped, // Use flex-grow when unpainted is minimal
    }));

    const unpaintedGroupWithWidth = groupData.unpaintedGroup ? {
      ...groupData.unpaintedGroup,
      widthPercent: isUnpaintedGrouped ? (groupData.unpaintedGroup.count / totalPoints) * availableWidthPercent : 0,
      useMinimalWidth: !isUnpaintedGrouped,
    } : null;

    return {
      coloredGroups: coloredGroupsWithWidth,
      unpaintedGroup: unpaintedGroupWithWidth,
      totalBadges,
      gapWidth
    };
  }, [groupData, isProportional, pointGroups.length, isUnpaintedGrouped]);

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
    // Proportional layout
    const hasColoredGroups = proportionalData.coloredGroups.length > 0;
    
    return (
      <div className={cn(
        "flex gap-1 items-center w-full",
        !hasColoredGroups ? "justify-end" : "",
        className
      )}>
        {/* Colored groups taking proportional space */}
        {proportionalData.coloredGroups.map((group) => {
          const color = PALETTE_COLORS[group.colorIndex!];
          
          if (group.useFlexGrow) {
            // When unpainted is minimal, use flex-grow for colored badges
            return (
              <Badge
                key={group.colorIndex}
                className="text-white border-0 text-xs py-0.5 h-6 pl-2 pr-2"
                style={{
                  backgroundColor: color,
                  flexGrow: group.count, // Flex-grow proportional to count
                  minWidth: 'fit-content',
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
          } else {
            // When unpainted is grouped and large, use min-width approach for colored badges
            const isUnpaintedGroupedAndLarge = proportionalData.unpaintedGroup &&
              !proportionalData.unpaintedGroup.useMinimalWidth &&
              proportionalData.unpaintedGroup.widthPercent > 80; // Large unpainted group threshold
            
            if (isUnpaintedGroupedAndLarge) {
              // Use min-width based on actual proportion, but allow shrinking
              return (
                <Badge
                  key={group.colorIndex}
                  className="text-white border-0 text-xs py-0.5 h-6 pl-2 pr-2"
                  style={{
                    backgroundColor: color,
                    minWidth: `${group.widthPercent}%`, // Use actual proportion as min-width
                    width: 'auto',
                    flexShrink: 1,
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
            } else {
              // Standard proportional width calculation
              const totalGapWidth = (proportionalData.totalBadges - 1) * proportionalData.gapWidth;
              return (
                <Badge
                  key={group.colorIndex}
                  className="text-white border-0 text-xs py-0.5 h-6 flex-shrink-0 pl-2 pr-2"
                  style={{
                    backgroundColor: color,
                    width: `calc(${group.widthPercent}% - ${totalGapWidth * (group.widthPercent / 100)}px)`,
                    minWidth: 'fit-content',
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
            }
          }
        })}

        {/* Unpainted group - proportional if grouped, minimal if not */}
        {proportionalData.unpaintedGroup && (
          <Badge
            variant="outline"
            className={cn(
              "cursor-pointer border text-xs py-0.5 h-6 pl-2 pr-2 border-2",
              isUnpaintedGrouped
                ? "bg-black text-white border-black hover:bg-gray-800"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-200 hover:border-gray-400",
              // Make unpainted group flexible when it's large and grouped
              proportionalData.unpaintedGroup.widthPercent > 80 && !proportionalData.unpaintedGroup.useMinimalWidth
                ? "flex-shrink-1"
                : "flex-shrink-0"
            )}
            onClick={handleUnpaintedClick}
            style={{
              ...(proportionalData.unpaintedGroup.useMinimalWidth
                ? { width: 'fit-content' }
                : proportionalData.unpaintedGroup.widthPercent > 80
                  ? {
                      width: 'auto',
                      flex: '1 1 auto', // Allow it to grow and shrink, taking remaining space
                    }
                  : {
                      width: `calc(${proportionalData.unpaintedGroup.widthPercent}% - ${(proportionalData.totalBadges - 1) * proportionalData.gapWidth * (proportionalData.unpaintedGroup.widthPercent / 100)}px)`,
                    }
              ),
              minWidth: 'fit-content',
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
          </Badge>
        )}
      </div>
    );
  }

  // Non-proportional layout (original)
  return (
    <div className={cn("flex gap-1 flex-wrap items-center justify-between", className)}>
      {/* Colored groups container - always present for consistent layout */}
      <div className="flex gap-1 flex-wrap">
        {groupData.coloredGroups.map((group) => {
          const color = PALETTE_COLORS[group.colorIndex!];
          return (
            <Badge
              key={group.colorIndex}
              className="text-white border-0 text-xs py-0.5 h-6 pl-2 pr-2"
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
        <Badge
          variant="outline"
          className={cn(
            "cursor-pointer border text-xs py-0.5 h-6 pl-2 pr-2 border-2",
            isUnpaintedGrouped
              ? "bg-black text-white border-black hover:bg-gray-800"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-200 hover:border-gray-400"
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
        </Badge>
      )}
    </div>
  );
};