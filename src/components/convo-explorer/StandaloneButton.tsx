"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { SVGProps } from "react";

// Only the icon has a numeric size; drop Button's 'size' from the inherited props
export type StandaloneButtonProps = {
  icon: React.ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  size?: number; // icon size in px
} & Omit<React.ComponentProps<typeof Button>, "size">;

export const StandaloneButton = React.forwardRef<HTMLButtonElement, StandaloneButtonProps>(
  ({ icon: Icon, label, size = 20, className, ...props }, ref) => (
    <Button
      ref={ref}
      {...props}
      variant="outline"
      className={`p-2 ${className ?? ""}`}
      aria-label={label}
    >
      <Icon width={size} height={size} />
    </Button>
  )
);

StandaloneButton.displayName = "StandaloneButton";
