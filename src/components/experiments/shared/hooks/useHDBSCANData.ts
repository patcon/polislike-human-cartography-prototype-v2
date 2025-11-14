import * as React from "react";
import type { Point, LabelsByThreshold } from '../types';

export interface HDBSCANDataState {
  points: Point[];
  labelsByThreshold: LabelsByThreshold;
  isLoading: boolean;
  error: string | null;
}

export const useHDBSCANData = () => {
  const [points, setPoints] = React.useState<Point[]>([]);
  const [labelsByThreshold, setLabelsByThreshold] = React.useState<LabelsByThreshold>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log('🔄 Starting to load data...');

        const [pointsResponse, labelsResponse] = await Promise.all([
          fetch('/projections.json'),
          fetch('/projection_labels_by_threshold.json')
        ]);

        console.log('📡 Responses received:', {
          pointsStatus: pointsResponse.status,
          labelsStatus: labelsResponse.status
        });

        if (!pointsResponse.ok) {
          throw new Error(`Failed to fetch projections.json: ${pointsResponse.status}`);
        }
        if (!labelsResponse.ok) {
          throw new Error(`Failed to fetch projection_labels_by_threshold.json: ${labelsResponse.status}`);
        }

        const pointsData: [string, [number, number]][] = await pointsResponse.json();
        const labelsData: LabelsByThreshold = await labelsResponse.json();

        console.log('📊 Data loaded:', {
          pointsCount: pointsData.length,
          labelsThresholds: Object.keys(labelsData).length,
          samplePoint: pointsData[0],
          sampleThreshold: Object.keys(labelsData)[0]
        });

        // Convert points data
        const processedPoints: Point[] = pointsData.map(([id, [x, y]]) => ({
          id,
          x,
          y
        }));

        console.log('✅ Processed points:', processedPoints.length);

        setPoints(processedPoints);
        setLabelsByThreshold(labelsData);
        setIsLoading(false);
      } catch (error) {
        console.error('❌ Failed to load data:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  return {
    points,
    labelsByThreshold,
    isLoading,
    error
  };
};