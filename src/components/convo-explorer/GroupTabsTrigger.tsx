import * as React from "react"
import { TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export type GroupTabsStyle = "underline" | "small-dot" | "big-dot" | "enclosure"

interface GroupTabsTriggerProps extends React.ComponentProps<typeof TabsTrigger> {
  tabStyle?: GroupTabsStyle
  color?: string
  children: React.ReactNode
}

export function GroupTabsTrigger({
  className,
  tabStyle = "enclosure",
  color,
  children,
  ...props
}: GroupTabsTriggerProps) {
  // Helper function to determine if text should be dark based on background color
  const getTextColor = (backgroundColor: string): string => {
    // For colored backgrounds, use dark text for better readability
    // Only use white text for very dark colors
    const darkColors = ['black', '#000', '#000000'];
    if (darkColors.includes(backgroundColor.toLowerCase())) {
      return 'white';
    }
    return '#1f2937'; // dark gray for better readability
  };

  if (tabStyle === "enclosure" && color) {
    return (
      <TabsTrigger
        className={cn(
          "relative transition-all duration-200 px-1 py-1",
          "data-[state=active]:shadow-md data-[state=active]:scale-105",
          className
        )}
        {...props}
      >
        <span
          className="inline-block px-1 py-0 rounded border-2 transition-all duration-200"
          style={{
            backgroundColor: color,
            borderColor: color,
            color: getTextColor(color),
          }}
        >
          {children}
        </span>
      </TabsTrigger>
    );
  }

  return (
    <TabsTrigger
      className={cn("relative px-1 py-1", className)}
      {...props}
    >
      {(tabStyle === "small-dot" || tabStyle === "big-dot") && color && (
        <div
          className={cn(
            "rounded-full mr-1.5 flex-shrink-0",
            tabStyle === "small-dot" ? "w-2 h-2" : "w-3 h-3"
          )}
          style={{ backgroundColor: color }}
        />
      )}
      {children}
      {tabStyle === "underline" && color && (
        <div
          className="absolute bottom-0 left-2 right-2 h-1 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
    </TabsTrigger>
  )
}