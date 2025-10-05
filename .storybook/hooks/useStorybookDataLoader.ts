import { useState, useEffect } from 'react';
import { fetchAndProcessKedroData } from '../../src/lib/kedro-api';

/**
 * Custom hook for loading projection data in D3Map Storybook stories
 * Supports both local JSON files and Kedro API endpoints
 */
export function useStorybookDataLoader(kedroBaseUrl?: string, pipelineId?: string) {
  const [dataset, setDataset] = useState<[string, [number, number]][] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        let loadedData: [string, [number, number]][];

        if (kedroBaseUrl) {
          loadedData = await fetchAndProcessKedroData(kedroBaseUrl, pipelineId);
        } else {
          // Fallback to local JSON if no Kedro URL provided
          const response = await fetch('/projections.json');
          loadedData = await response.json();
        }

        setDataset(loadedData);
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [kedroBaseUrl, pipelineId]);

  return { dataset, loading, error };
}