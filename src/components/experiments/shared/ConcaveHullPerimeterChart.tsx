import React from 'react';
import type { HullPerimeterData } from './hullPerimeterUtils';

interface ConcaveHullPerimeterChartProps {
  data: HullPerimeterData[];
  maxHeight?: number;
}

export const ConcaveHullPerimeterChart: React.FC<ConcaveHullPerimeterChartProps> = ({
  data,
  maxHeight = 120
}) => {
  if (!data.length) {
    return (
      <div className="text-xs text-gray-500 text-center py-4">
        No hull data available
      </div>
    );
  }

  // Find the maximum perimeter for scaling
  const maxPerimeter = Math.max(...data.map(d => d.perimeter));

  // Calculate bar width and spacing - spacing gets very small or zero as count increases
  const availableWidth = 240; // Total available width for all bars
  const barSpacing = data.length > 10 ? 0 : Math.max(0, Math.min(2, 20 / data.length)); // No spacing for many clusters
  const barWidth = Math.max(1, (availableWidth - (data.length - 1) * barSpacing) / data.length);

  // Calculate font size based on number of clusters and bar width
  const labelFontSize = data.length > 20 ? 'text-[8px]' : data.length > 10 ? 'text-[10px]' : 'text-xs';

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">Hull Perimeters</h4>

      <div className="flex items-end justify-center" style={{ height: maxHeight + 20, gap: `${barSpacing}px` }}>
        {data.map((item) => {
          const barHeight = (item.perimeter / maxPerimeter) * maxHeight;

          return (
            <div key={item.clusterId} className="flex flex-col items-center space-y-1">
              {/* Bar */}
              <div
                className={`rounded-t transition-all duration-200 hover:opacity-80 ${
                  item.hasSelectedPoints ? 'ring-2 ring-black ring-inset' : ''
                }`}
                style={{
                  width: barWidth,
                  height: barHeight,
                  backgroundColor: item.color,
                  minHeight: 2 // Ensure very small bars are still visible
                }}
                title={`Cluster ${item.clusterId}: ${item.perimeter.toFixed(2)}${item.hasSelectedPoints ? ' (selected)' : ''}`}
              />

              {/* Cluster ID label - angled to prevent overflow affecting width */}
              <div
                className={`${labelFontSize} font-mono transform -rotate-70 whitespace-nowrap ${
                  item.hasSelectedPoints ? 'text-gray-800 font-bold' : 'text-gray-600'
                }`}
                style={{
                  transformOrigin: 'top right',
                  marginTop: '2px',
                  marginLeft: `-${Math.max(18, barWidth * 0.7)}px`
                }}
              >
                {item.clusterId}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend/Info */}
      <div className="text-xs text-gray-500 space-y-1">
        <div className="flex justify-between">
          <span>Clusters: {data.length}</span>
          <span>Max: {maxPerimeter.toFixed(1)}</span>
        </div>
        <div className="text-center">
          Hover bars for exact values
        </div>
      </div>
    </div>
  );
};