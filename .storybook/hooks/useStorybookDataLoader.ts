import { useState, useEffect } from 'react';
import { fetchAndProcessKedroData } from '../../src/lib/kedro-api';

/**
 * Custom hook for loading projection data in D3Map Storybook stories
 * Supports both local JSON files and Kedro API endpoints
 */
export function useStorybookDataLoader(kedroBaseUrl?: string) {
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
          console.log('Loading data from Kedro API:', kedroBaseUrl);
          loadedData = await fetchAndProcessKedroData(kedroBaseUrl);
        } else {
          // Fallback to local JSON if no Kedro URL provided
          console.log('Loading data from local projections.json file');
          const response = await fetch('/projections.json');
          loadedData = await response.json();
        }

        // 🔍 DEBUG: Print the full projections data for inspection
        const dataSource = kedroBaseUrl ? 'SYNTHETIC (Kedro API)' : 'LOCAL FILE';
        console.log(`📊 FULL PROJECTIONS DATA (${dataSource}):`);
        console.log(JSON.stringify(loadedData, null, 2));
        console.log(`📊 Total data points: ${loadedData.length}`);
        console.log(`📊 Participant ID range: ${Math.min(...loadedData.map(([id]) => parseInt(id)))} - ${Math.max(...loadedData.map(([id]) => parseInt(id)))}`);
        console.log(`📊 Sample data points:`, loadedData.slice(0, 10));

        setDataset(loadedData);
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [kedroBaseUrl]);

  return { dataset, loading, error };
}