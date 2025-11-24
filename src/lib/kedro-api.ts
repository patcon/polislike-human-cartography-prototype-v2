/**
 * Utility functions for fetching and processing data from Kedro API endpoints
 */

interface KedroNode {
  id: string;
  name: string;
  tags: string[];
  pipelines: string[];
  type: string;
  modular_pipelines: string[] | null;
  layer: string;
  dataset_type: string;
  stats: any;
}

interface KedroApiResponse {
  nodes: KedroNode[];
}

interface PlotlyTypedArray {
  bdata: string;
  dtype: string;
}

interface PlotlyTrace {
  x: PlotlyTypedArray;
  y: PlotlyTypedArray;
  hovertext: PlotlyTypedArray;
  [key: string]: any;
}

interface KedroNodeDataResponse {
  preview: {
    data: PlotlyTrace[];
  };
}

/**
 * Decode Plotly typed array from base64 binary data
 * Browser-compatible version using atob instead of Buffer
 */
function decodePlotlyTypedArray({ bdata, dtype }: PlotlyTypedArray): number[] {
  // Convert base64 to binary string using browser's atob
  const binaryString = atob(bdata);

  // Convert binary string to Uint8Array
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Create ArrayBuffer from the bytes
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

  // Decode based on data type
  switch (dtype) {
    case 'f4':
      return Array.from(new Float32Array(arrayBuffer));
    case 'f8':
      return Array.from(new Float64Array(arrayBuffer));
    case 'i4':
      return Array.from(new Int32Array(arrayBuffer));
    default:
      throw new Error(`Unsupported dtype ${dtype}`);
  }
}

/**
 * Check if v2 branching pipeline exists
 */
async function checkForV2BranchingPipeline(kedroBaseUrl: string): Promise<boolean> {
  try {
    const branchingUrl = `${kedroBaseUrl}/api/pipelines/branching`;
    const response = await fetch(branchingUrl);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch pipeline data from Kedro API
 * Automatically detects v1 vs v2 format:
 * - v1: Individual pipelines with their own nodes
 * - v2: "branching" pipeline containing all pipeline nodes
 */
export async function fetchKedroApiData(kedroBaseUrl: string, pipelineId: string = 'mean_localmap_bestkmeans'): Promise<KedroApiResponse> {
  // First, check if v2 branching pipeline exists
  const hasV2 = await checkForV2BranchingPipeline(kedroBaseUrl);

  if (hasV2) {
    console.log('🔄 Detected v2 format - using branching pipeline');
    const pipelineUrl = `${kedroBaseUrl}/api/pipelines/branching`;

    const response = await fetch(pipelineUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch v2 branching pipeline data: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } else {
    console.log('🔄 Using v1 format - individual pipeline');
    const pipelineUrl = `${kedroBaseUrl}/api/pipelines/${pipelineId}`;

    const response = await fetch(pipelineUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch v1 pipeline data: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

/**
 * Find the scatter plot node in the pipeline data
 * Supports both v1 and v2 formats:
 * - v1: looks for `${pipelineId}__scatter_plot` in individual pipeline
 * - v2: looks for `${pipelineId}__scatter_plot` in branching pipeline
 */
export function findScatterPlotNode(apiResponse: KedroApiResponse, pipelineId: string = 'mean_localmap_bestkmeans'): KedroNode | null {
  return apiResponse.nodes.find(node =>
    node.name === `${pipelineId}__scatter_plot`
  ) || null;
}

/**
 * Find the votes parquet node in the pipeline data
 * Supports both v1 and v2 formats:
 * - v1: looks for `${pipelineId}__votes_parquet` in individual pipeline
 * - v2: looks for shared `votes_parquet` node (without pipeline prefix) in branching pipeline
 */
export function findVotesParquetNode(apiResponse: KedroApiResponse, pipelineId: string = 'mean_localmap_bestkmeans'): KedroNode | null {
  // First try v1 format (with pipeline prefix)
  const v1Node = apiResponse.nodes.find(node =>
    node.name === `${pipelineId}__votes_parquet`
  );

  if (v1Node) {
    return v1Node;
  }

  // Then try v2 format (shared node without prefix)
  return apiResponse.nodes.find(node =>
    node.name === 'votes_parquet'
  ) || null;
}

/**
 * Find the statements JSON node in the pipeline data
 * Supports both v1 and v2 formats:
 * - v1: looks for `${pipelineId}__statements_json` in individual pipeline
 * - v2: looks for shared `statements_json` node (without pipeline prefix) in branching pipeline
 */
export function findStatementsJsonNode(apiResponse: KedroApiResponse, pipelineId: string = 'mean_localmap_bestkmeans'): KedroNode | null {
  // First try v1 format (with pipeline prefix)
  const v1Node = apiResponse.nodes.find(node =>
    node.name === `${pipelineId}__statements_json`
  );

  if (v1Node) {
    return v1Node;
  }

  // Then try v2 format (shared node without prefix)
  return apiResponse.nodes.find(node =>
    node.name === 'statements_json'
  ) || null;
}

/**
 * Fetch node data from Kedro API
 */
export async function fetchKedroNodeData(kedroBaseUrl: string, nodeId: string): Promise<KedroNodeDataResponse> {
  const nodeUrl = `${kedroBaseUrl}/api/nodes/${nodeId}`;

  const response = await fetch(nodeUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch node data: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Extract participant ID from hovertext string
 * Expected format: "Participant {pid}"
 */
function extractParticipantId(hovertext: string): number {
  const match = hovertext.match(/Participant (\d+)/);
  if (!match) {
    throw new Error(`Could not extract participant ID from hovertext: "${hovertext}"`);
  }
  return parseInt(match[1], 10);
}

/**
 * Process Kedro node data to match projections.json format
 * Returns data in format: [participantId, [x, y]][]
 */
export function processKedroNodeData(nodeData: KedroNodeDataResponse): [string, [number, number]][] {
  // Merge all x, y, and hovertext arrays into one long array
  let allX: number[] = [];
  let allY: number[] = [];
  let allHovertext: string[] = [];

  nodeData.preview.data.forEach(trace => {
    const x = decodePlotlyTypedArray(trace.x);
    const y = decodePlotlyTypedArray(trace.y);

    // Handle hovertext - it might be a typed array or regular array of strings
    let hovertext: string[];
    if (trace.hovertext && typeof trace.hovertext === 'object' && 'bdata' in trace.hovertext) {
      // If hovertext is a typed array, decode it
      const decodedHovertext = decodePlotlyTypedArray(trace.hovertext);
      hovertext = decodedHovertext.map(String);
    } else if (Array.isArray(trace.hovertext)) {
      // If hovertext is already an array of strings
      hovertext = trace.hovertext;
    } else {
      throw new Error('Unexpected hovertext format in trace data');
    }

    allX = allX.concat(x);
    allY = allY.concat(y);
    allHovertext = allHovertext.concat(hovertext);
  });

  // Extract actual participant IDs from hovertext and create the merged dataset
  const merged: [string, [number, number]][] = allX.map((xVal, i) => {
    // Extract the actual participant ID from hovertext
    const participantId = extractParticipantId(allHovertext[i]);
    return [participantId.toString(), [xVal, allY[i]]];
  });

  // Debug output to understand the data structure
  console.log('🔍 Kedro Data Processing Debug:');
  console.log(`  - Total traces processed: ${nodeData.preview.data.length}`);
  console.log(`  - Total points: ${merged.length}`);
  console.log(`  - Sample hovertext values:`, allHovertext.slice(0, 5));
  console.log(`  - Extracted participant IDs:`, allHovertext.slice(0, 5).map(h => extractParticipantId(h)));
  console.log(`  - Using extracted participant IDs:`, merged.slice(0, 5).map(([id]) => id));
  console.log(`  - Sample coordinates:`, merged.slice(0, 5).map(([, coords]) => coords));
  console.log(`  - Participant ID range: ${Math.min(...merged.map(([id]) => parseInt(id)))} - ${Math.max(...merged.map(([id]) => parseInt(id)))}`);

  console.log('✅ Using actual participant IDs extracted from hovertext for proper vote alignment.');

  // Sort by participant ID to ensure consistent ordering across pipelines
  merged.sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

  return merged;
}

/**
 * Complete workflow to fetch and process Kedro data
 */
export async function fetchAndProcessKedroData(kedroBaseUrl: string, pipelineId: string = 'mean_localmap_bestkmeans'): Promise<[string, [number, number]][]> {
  try {
    console.log('Fetching Kedro pipeline data...');
    const apiResponse = await fetchKedroApiData(kedroBaseUrl, pipelineId);

    console.log('Finding scatter plot node...');
    const scatterPlotNode = findScatterPlotNode(apiResponse, pipelineId);

    if (!scatterPlotNode) {
      throw new Error(`Could not find scatter plot node with name "${pipelineId}__scatter_plot"`);
    }

    console.log(`Found scatter plot node with ID: ${scatterPlotNode.id}`);

    console.log('Fetching node data...');
    const nodeData = await fetchKedroNodeData(kedroBaseUrl, scatterPlotNode.id);

    console.log('Processing node data...');
    const processedData = processKedroNodeData(nodeData);

    console.log(`Processed ${processedData.length} data points from Kedro API`);
    return processedData;

  } catch (error) {
    console.error('Error in Kedro data workflow:', error);
    throw error;
  }
}

/**
 * Get the votes parquet file path from Kedro API
 */
export async function getVotesParquetPath(kedroBaseUrl: string, pipelineId: string = 'mean_localmap_bestkmeans'): Promise<string> {
  try {
    console.log('🔄 Fetching Kedro pipeline data for votes parquet...', { kedroBaseUrl, pipelineId });
    const apiResponse = await fetchKedroApiData(kedroBaseUrl, pipelineId);

    console.log('🔍 Finding votes parquet node...');
    const votesParquetNode = findVotesParquetNode(apiResponse, pipelineId);

    if (!votesParquetNode) {
      throw new Error(`Could not find votes parquet node with name "${pipelineId}__votes_parquet"`);
    }

    console.log(`✅ Found votes parquet node with ID: ${votesParquetNode.id}`);

    console.log('📡 Fetching node data for votes parquet...');
    const nodeData = await fetchKedroNodeData(kedroBaseUrl, votesParquetNode.id);

    // The node data should contain a filepath key with the relative path
    if (!nodeData || !('filepath' in nodeData) || typeof nodeData.filepath !== 'string') {
      throw new Error(`Node data does not contain a valid filepath key. Available keys: ${Object.keys(nodeData || {}).join(', ')}`);
    }

    const filepath = nodeData.filepath as string;
    console.log(`📄 Found votes parquet file path: ${filepath}`);
    return filepath;

  } catch (error) {
    console.error('❌ Error getting votes parquet path:', error);
    throw error;
  }
}

/**
 * Get the statements JSON file path from Kedro API
 */
export async function getStatementsJsonPath(kedroBaseUrl: string, pipelineId: string = 'mean_localmap_bestkmeans'): Promise<string> {
  try {
    console.log('Fetching Kedro pipeline data for statements JSON...');
    const apiResponse = await fetchKedroApiData(kedroBaseUrl, pipelineId);

    console.log('Finding statements JSON node...');
    const statementsJsonNode = findStatementsJsonNode(apiResponse, pipelineId);

    if (!statementsJsonNode) {
      throw new Error(`Could not find statements JSON node with name "${pipelineId}__statements_json"`);
    }

    console.log(`Found statements JSON node with ID: ${statementsJsonNode.id}`);

    console.log('Fetching node data for statements JSON...');
    const nodeData = await fetchKedroNodeData(kedroBaseUrl, statementsJsonNode.id);

    // Debug: log the actual node data structure
    console.log('Statements node data structure:', JSON.stringify(nodeData, null, 2));

    // The node data should contain a filepath key with the relative path
    if (!nodeData || !('filepath' in nodeData) || typeof nodeData.filepath !== 'string') {
      throw new Error(`Node data does not contain a valid filepath key. Available keys: ${Object.keys(nodeData || {}).join(', ')}`);
    }

    const filepath = nodeData.filepath as string;
    console.log(`Found statements JSON file path: ${filepath}`);
    return filepath;

  } catch (error) {
    console.error('Error getting statements JSON path:', error);
    throw error;
  }
}

/**
 * Find the projections JSON node in the pipeline data
 * Supports both v1 and v2 formats:
 * - v1: looks for `${pipelineId}__projections_json` in individual pipeline
 * - v2: looks for `${pipelineId}__projections_json` in branching pipeline
 */
export function findProjectionsJsonNode(apiResponse: KedroApiResponse, pipelineId: string = 'mean_pca_bestkmeans'): KedroNode | null {
  return apiResponse.nodes.find(node =>
    node.name === `${pipelineId}__projections_json`
  ) || null;
}

/**
 * Get the projections JSON file path from Kedro API
 */
export async function getProjectionsJsonPath(kedroBaseUrl: string, pipelineId: string = 'mean_pca_bestkmeans'): Promise<string> {
  try {
    console.log('🔄 Fetching Kedro pipeline data for projections JSON...', { kedroBaseUrl, pipelineId });
    const apiResponse = await fetchKedroApiData(kedroBaseUrl, pipelineId);

    console.log('🔍 Finding projections JSON node...');
    const projectionsJsonNode = findProjectionsJsonNode(apiResponse, pipelineId);

    if (!projectionsJsonNode) {
      throw new Error(`Could not find projections JSON node with name "${pipelineId}__projections_json"`);
    }

    console.log(`✅ Found projections JSON node with ID: ${projectionsJsonNode.id}`);

    console.log('📡 Fetching node data for projections JSON...');
    const nodeData = await fetchKedroNodeData(kedroBaseUrl, projectionsJsonNode.id);

    // The node data should contain a filepath key with the relative path
    if (!nodeData || !('filepath' in nodeData) || typeof nodeData.filepath !== 'string') {
      throw new Error(`Node data does not contain a valid filepath key. Available keys: ${Object.keys(nodeData || {}).join(', ')}`);
    }

    const filepath = nodeData.filepath as string;
    console.log(`📄 Found projections JSON file path: ${filepath}`);
    return filepath;

  } catch (error) {
    console.error('❌ Error getting projections JSON path:', error);
    throw error;
  }
}

/**
 * Get available pipeline IDs from the branching pipeline (v2 format)
 * Extracts pipeline IDs from scatter plot node names like "mean_localmap_bestkmeans__scatter_plot"
 * When v2 is available, only returns v2 pipeline IDs and ignores v1 pipeline names
 */
export async function getAvailablePipelineIds(kedroBaseUrl: string, pipelineFilter?: string): Promise<Array<{id: string, name: string}>> {
  try {
    console.log('🔍 getAvailablePipelineIds: Starting for', kedroBaseUrl);
    const hasV2 = await checkForV2BranchingPipeline(kedroBaseUrl);
    console.log('🔍 getAvailablePipelineIds: hasV2 =', hasV2);

    if (hasV2) {
      console.log('🔄 Detected v2 format - fetching pipeline IDs from branching pipeline only...');
      const branchingUrl = `${kedroBaseUrl}/api/pipelines/branching`;
      const response = await fetch(branchingUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch v2 branching pipeline data: ${response.status} ${response.statusText}`);
      }

      const apiResponse = await response.json();

      // Find all scatter plot nodes and extract pipeline IDs
      const scatterPlotNodes = apiResponse.nodes.filter((node: any) =>
        node.name.endsWith('__scatter_plot')
      );

      const pipelineIds = scatterPlotNodes.map((node: any) => {
        const pipelineId = node.name.replace('__scatter_plot', '');
        return {
          id: pipelineId,
          name: pipelineId // Keep the same format as v1 (with underscores)
        };
      });

      // Apply filter if provided
      const filteredPipelineIds = pipelineFilter
        ? pipelineIds.filter((p: {id: string, name: string}) => p.id.includes(pipelineFilter))
        : pipelineIds;

      console.log('✅ Found pipeline IDs in v2 branching pipeline (ignoring v1):', filteredPipelineIds.map((p: {id: string, name: string}) => p.id));
      if (pipelineFilter) {
        console.log(`🔍 Applied filter "${pipelineFilter}": ${filteredPipelineIds.length}/${pipelineIds.length} pipelines`);
      }
      return filteredPipelineIds;
    } else {
      // Only use v1 format when v2 is not available
      console.log('🔄 No v2 detected - using v1 format from /api/main...');
      const response = await fetch(`${kedroBaseUrl}/api/main`);
      if (!response.ok) {
        throw new Error(`Failed to fetch pipelines: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      // Filter out polis_classic as it has a different structure
      let filteredPipelines = (data.pipelines || []).filter((pipeline: any) => pipeline.id !== 'polis_classic');

      // Apply additional filter if provided
      if (pipelineFilter) {
        filteredPipelines = filteredPipelines.filter((pipeline: any) => pipeline.id.includes(pipelineFilter));
        console.log(`🔍 Applied filter "${pipelineFilter}": ${filteredPipelines.length} pipelines`);
      }

      console.log('✅ Found pipelines in v1 format:', filteredPipelines.map((p: any) => p.id));
      return filteredPipelines;
    }
  } catch (error) {
    console.error('❌ Error fetching available pipeline IDs:', error);
    return [];
  }
}

/**
 * Load statements JSON data with optional Kedro API support
 * Falls back to local file if Kedro parameters are not provided
 */
export async function loadStatementsData(kedroBaseUrl?: string, pipelineId?: string): Promise<any> {
  try {
    if (kedroBaseUrl) {
      // Use Kedro API to get the statements JSON file path
      console.log('🔄 Loading statements from Kedro API...', { kedroBaseUrl, pipelineId });
      const relativePath = await getStatementsJsonPath(kedroBaseUrl, pipelineId);
      const statementsUrl = `${kedroBaseUrl}/${relativePath}`;
      console.log('📄 Loading statements from:', statementsUrl);

      // Add cache-busting parameter to ensure fresh data
      const cacheBustUrl = `${statementsUrl}?t=${Date.now()}`;
      const response = await fetch(cacheBustUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch statements: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Successfully loaded statements from Kedro API, count:', data?.length || 'unknown');
      return data;
    } else {
      // Fallback to local file
      console.log('📁 Loading statements from local file...');
      const response = await fetch('/statements.json');

      if (!response.ok) {
        throw new Error(`Failed to fetch local statements: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Successfully loaded statements from local file, count:', data?.length || 'unknown');
      return data;
    }
  } catch (error) {
    console.error('❌ Error loading statements data:', error);
    throw error;
  }
}

/**
 * Load projections data from JSON file
 */
export async function loadProjections(): Promise<Map<string, [number, number]>> {
  try {
    const { resolveAssetPath } = await import('./paths');
    const projectionsUrl = resolveAssetPath('/projections.json');
    const response = await fetch(projectionsUrl);
    const projectionsArray = await response.json();

    const projections = new Map<string, [number, number]>();

    // Convert array format to Map
    projectionsArray.forEach(([participantId, coordinates]: [string, [number, number]]) => {
      projections.set(participantId, coordinates);
    });

    console.log(`Loaded ${projections.size} projections`);
    return projections;
  } catch (error) {
    console.error('Failed to load projections:', error);
    throw error;
  }
}

/**
 * Load full projections data with all components from JSON file or Kedro API
 */
export async function loadFullProjections(kedroBaseUrl?: string, pipelineId?: string): Promise<Map<string, number[]>> {
  try {
    let projectionsArray: [string, number[]][];

    if (kedroBaseUrl) {
      // Load from Kedro API by fetching the projections JSON file
      console.log('🔄 Loading full projections from Kedro API...', { kedroBaseUrl, pipelineId });
      const relativePath = await getProjectionsJsonPath(kedroBaseUrl, pipelineId);
      const projectionsUrl = `${kedroBaseUrl}/${relativePath}`;
      console.log('📄 Loading projections from:', projectionsUrl);

      // Add cache-busting parameter to ensure fresh data
      const cacheBustUrl = `${projectionsUrl}?t=${Date.now()}`;
      const response = await fetch(cacheBustUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch projections: ${response.status} ${response.statusText}`);
      }

      projectionsArray = await response.json();
      console.log('✅ Successfully loaded projections from Kedro API');
    } else {
      // Load from static file
      console.log('📁 Loading full projections from static file...');
      const { resolveAssetPath } = await import('./paths');
      const projectionsUrl = resolveAssetPath('/projections.json');
      const response = await fetch(projectionsUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch local projections: ${response.status} ${response.statusText}`);
      }
      
      projectionsArray = await response.json();
      console.log('✅ Successfully loaded projections from local file');
    }

    const projections = new Map<string, number[]>();

    // Convert array format to Map
    projectionsArray.forEach(([participantId, coordinates]: [string, number[]]) => {
      projections.set(participantId, coordinates);
    });

    console.log(`Loaded ${projections.size} full projections with ${projectionsArray[0]?.[1]?.length || 0} components each`);
    return projections;
  } catch (error) {
    console.error('Failed to load full projections:', error);
    throw error;
  }
}

/**
 * Get principal component values for all participants (normalized 0-1 for metrics visualization)
 * @param componentIndex - The component index to extract (0-based, so component 3 = index 2)
 * @param options - Configuration options
 * @returns Map of participant IDs to normalized component values (0-1)
 */
export async function getPrincipalComponentValues(
  componentIndex: number,
  options: {
    kedroBaseUrl?: string;
    pipelineId?: string;
  } = {}
): Promise<Map<string, number>> {
  const { kedroBaseUrl, pipelineId } = options;

  try {
    // Load full projections data
    const fullProjections = await loadFullProjections(kedroBaseUrl, pipelineId);
    
    const componentValues = new Map<string, number>();
    let minValue = Infinity;
    let maxValue = -Infinity;

    // First pass: collect all component values and find min/max
    fullProjections.forEach((coordinates, participantId) => {
      if (coordinates.length > componentIndex) {
        const value = coordinates[componentIndex];
        componentValues.set(participantId, value);
        minValue = Math.min(minValue, value);
        maxValue = Math.max(maxValue, value);
      }
    });

    // Second pass: normalize values to 0-1 range
    const normalizedValues = new Map<string, number>();
    const range = maxValue - minValue;
    
    if (range > 0) {
      componentValues.forEach((value, participantId) => {
        normalizedValues.set(participantId, (value - minValue) / range);
      });
    } else {
      // If all values are the same, set them all to 0.5
      componentValues.forEach((_, participantId) => {
        normalizedValues.set(participantId, 0.5);
      });
    }

    console.log(`Calculated principal component ${componentIndex + 1} values for ${normalizedValues.size} participants (range: ${minValue.toFixed(3)} - ${maxValue.toFixed(3)})`);
    return normalizedValues;
  } catch (error) {
    console.error(`Failed to get principal component ${componentIndex + 1} values:`, error);
    // Return empty map instead of throwing in development
    const isDev = import.meta.env?.DEV;
    if (isDev) {
      console.warn('Returning empty component values map due to error in development environment');
      return new Map<string, number>();
    }
    throw error;
  }
}