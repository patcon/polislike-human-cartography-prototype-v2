import { useState, useEffect } from 'react';

interface PipelineOption {
  id: string;
  name: string;
}

interface PipelineApiResponse {
  pipelines: PipelineOption[];
}

/**
 * Custom hook for fetching available pipeline options from Kedro API
 */
export function usePipelineOptions(kedroBaseUrl?: string) {
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

        const response = await fetch(`${kedroBaseUrl}/api/main`);
        if (!response.ok) {
          throw new Error(`Failed to fetch pipelines: ${response.status} ${response.statusText}`);
        }

        const data: PipelineApiResponse = await response.json();
        // Filter out polis_classic as it has a different structure and won't work with our expectations
        const filteredPipelines = (data.pipelines || []).filter(pipeline => pipeline.id !== 'polis_classic');
        setPipelines(filteredPipelines);
      } catch (err) {
        console.error('Error fetching pipeline options:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch pipeline options');
        setPipelines([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPipelines();
  }, [kedroBaseUrl]);

  return { pipelines, loading, error };
}