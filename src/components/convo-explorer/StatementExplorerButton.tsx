"use client";

import * as React from "react";
import { Telescope, MessageSquareText } from "lucide-react";
import { StandaloneButton } from "./StandaloneButton";

type IconVariant = "telescope" | "message";

const iconMap: Record<IconVariant, typeof Telescope | typeof MessageSquareText> = {
  telescope: Telescope,
  message: MessageSquareText,
};

export type StatementExplorerButtonProps = Omit<
  React.ComponentProps<typeof StandaloneButton>,
  "icon"
> & {
  iconVariant?: IconVariant; // renamed from "variant"
};

export const StatementExplorerButton = React.forwardRef<
  HTMLButtonElement,
  StatementExplorerButtonProps
>(({ iconVariant = "telescope", ...props }, ref) => {
  const Icon = iconMap[iconVariant];
  return <StandaloneButton ref={ref} {...props} icon={Icon} />;
});

StatementExplorerButton.displayName = "StatementExplorerButton";
