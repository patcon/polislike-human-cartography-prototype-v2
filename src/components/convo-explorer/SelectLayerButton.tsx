"use client";

import * as React from "react";
import { Layers } from "lucide-react";
import { StandaloneButton } from "./StandaloneButton";

// Make label and icon optional since we provide defaults
type ButtonProps = Omit<React.ComponentProps<typeof StandaloneButton>, 'label' | 'icon'> & {
  label?: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

export const SelectLayerButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ label = "Select layers", icon = Layers, ...props }, ref) => (
    <StandaloneButton ref={ref} {...props} label={label} icon={icon} />
  )
);

SelectLayerButton.displayName = "SelectLayerButton";
