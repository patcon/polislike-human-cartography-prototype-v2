// BringToFrontSolid.tsx
import React from "react";
import { BringToFront } from "lucide-react";
import type { LucideProps } from "lucide-react";
import "./BringToFrontSolid.css";

export const BringToFrontSolid: React.FC<LucideProps> = ({ className: _className, ...props }) => {
  return <BringToFront className="bring-to-front-solid" {...props} />;
};
