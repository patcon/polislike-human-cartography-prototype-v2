import React from 'react';

interface ClusterGroup {
  clusterId: number;
  count: number;
  percentage: number;
}

interface ClusterProportionsBarProps {
  clusteredCount: number;
  unclusteredCount: number;
  clustered: number;
  unclustered: number;
  clusterGroups: ClusterGroup[];
  selectedClusterId: number | null;
  segmentClustered?: boolean;
}

export const ClusterProportionsBar: React.FC<ClusterProportionsBarProps> = ({
  clusteredCount,
  unclusteredCount,
  clustered,
  unclustered,
  clusterGroups,
  selectedClusterId,
  segmentClustered = true
}) => {
  return (
    <div className="relative w-full mt-2 h-6 bg-gray-200 rounded-md overflow-hidden">
      {/* Bar segments */}
      <div className="flex h-full">
        {segmentClustered ? (
          // Segmented view - show each cluster group with alternating colors
          <>
            {clusterGroups.map((group, index) => (
              <div
                key={group.clusterId}
                className="h-full transition-all duration-300 ease-in-out"
                style={{
                  backgroundColor: index % 2 === 0 ? "#1d4ed8" : "#3b82f6", // Alternating blue shades
                  width: `${group.percentage}%`,
                  boxShadow: selectedClusterId === group.clusterId ? "inset 0 0 0 2px black" : "none",
                }}
              />
            ))}
            {/* Unclustered segment */}
            {unclusteredCount > 0 && (
              <div
                className="h-full transition-all duration-300 ease-in-out"
                style={{
                  backgroundColor: "#d1d5db", // Light gray for unclustered
                  width: `${unclustered}%`,
                }}
              />
            )}
          </>
        ) : (
          // Original view - single clustered segment
          <>
            {/* Clustered segment */}
            {clusteredCount > 0 && (
              <div
                className="h-full transition-all duration-300 ease-in-out"
                style={{
                  backgroundColor: "#1d4ed8", // Darker blue for better contrast
                  width: `${clustered}%`,
                }}
              />
            )}

            {/* Unclustered segment */}
            {unclusteredCount > 0 && (
              <div
                className="h-full transition-all duration-300 ease-in-out"
                style={{
                  backgroundColor: "#d1d5db", // Original light gray
                  width: `${unclustered}%`,
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Text overlays for both segmented and original views */}
      {/* Light text layer (visible on dark backgrounds) */}
      <div className="absolute inset-0 flex items-center pointer-events-none">
        {/* Clustered count - light text clipped to clustered area */}
        {clusteredCount > 0 && (
          <div
            className="flex items-center justify-start pl-2 text-xs font-semibold text-white h-full transition-all duration-300 ease-in-out"
            style={{
              width: `${clustered}%`,
              clipPath: `inset(0 ${100 - clustered}% 0 0)`,
            }}
          >
            {clusteredCount}
          </div>
        )}

        {/* Unclustered count - light text for clustered area, spans full width but right-aligned */}
        {unclusteredCount > 0 && (
          <div
            className="flex items-center justify-end pr-2 text-xs font-semibold text-white h-full absolute inset-0 transition-all duration-300 ease-in-out"
            style={{
              clipPath: `inset(0 ${100 - clustered}% 0 0)`,
            }}
          >
            {unclusteredCount}
          </div>
        )}
      </div>

      {/* Dark text layer (visible on light background) */}
      <div className="absolute inset-0 flex items-center pointer-events-none">
        {/* Clustered count - dark text clipped away from clustered area */}
        {clusteredCount > 0 && (
          <div
            className="flex items-center justify-start pl-2 text-xs font-semibold text-gray-800 h-full transition-all duration-300 ease-in-out"
            style={{
              width: `${clustered}%`,
              clipPath: `inset(0 0 0 ${clustered}%)`,
            }}
          >
            {clusteredCount}
          </div>
        )}

        {/* Unclustered count - dark text for light gray area, spans full width but right-aligned */}
        {unclusteredCount > 0 && (
          <div
            className="flex items-center justify-end pr-2 text-xs font-semibold text-gray-800 h-full absolute inset-0 transition-all duration-300 ease-in-out"
            style={{
              clipPath: `inset(0 0 0 ${clustered}%)`,
            }}
          >
            {unclusteredCount}
          </div>
        )}
      </div>
    </div>
  );
};