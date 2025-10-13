import React from "react";

export const PathasLogo: React.FC<{ forceBlack?: boolean }> = ({ forceBlack = true }) => {
  return (
    <div
      className="absolute top-2 left-3 z-10 pointer-events-none select-none flex items-center space-x-0"
      style={{ lineHeight: 1.2 }}
    >
      <span
        className="text-black-700"
        style={{
          fontFamily: `"Arial Rounded MT Bold", "Trebuchet MS", sans-serif`,
          fontWeight: 900,
          fontSize: "1.2rem",
          color: forceBlack ? "#000000" : "#5C3A21", // more earthy brown
          letterSpacing: "-0.03em",
          textShadow: "1px 1px 0px rgba(255,255,255,1)",
        }}
      >
        pathas
      </span>
      <span
        style={{
          fontFamily: `"Arial Rounded MT Bold", "Trebuchet MS", sans-serif`,
          fontWeight: 700,
          fontSize: "1.2rem",
          background: "linear-gradient(90deg, #4CAF50, #66BB6A)",
          WebkitBackgroundClip: "text",
          color: forceBlack ? "#000000" : "transparent",
          letterSpacing: "-0.03em",
          textShadow: "1px 1px 0px rgba(255,255,255,1)",
        }}
      >
        .garden
      </span>
    </div>
  );
};
