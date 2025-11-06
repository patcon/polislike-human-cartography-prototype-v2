import { useState, useEffect } from 'react';

interface PipelineOption {
  id: string;
  name: string;
}

/**
 * Custom hook for fetching available pipeline options from Kedro API
 * Automatically detects v1 vs v2 format and returns appropriate pipeline options
 */
export function usePipelineOptions(kedroBaseUrl?: string, pipelineFilter?: string) {
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!kedroBaseUrl) {
      setPipelines([]);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchPipelines = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('🔍 usePipelineOptions: Starting fetch for', kedroBaseUrl);

        // Use the new getAvailablePipelineIds function that handles both v1 and v2
        const { getAvailablePipelineIds } = await import('../../src/lib/kedro-api');
        const availablePipelines = await getAvailablePipelineIds(kedroBaseUrl, pipelineFilter);

        console.log('🔍 usePipelineOptions: Received pipelines:', availablePipelines.map(p => p.id));
        setPipelines(availablePipelines);
      } catch (err) {
        console.error('Error fetching pipeline options:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch pipeline options');
        setPipelines([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPipelines();
  }, [kedroBaseUrl, pipelineFilter]);

  return { pipelines, loading, error };
}