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
 * Fetch pipeline data from Kedro API
 */
export async function fetchKedroApiData(kedroBaseUrl: string, pipelineId: string = 'mean_localmap_bestkmeans'): Promise<KedroApiResponse> {
  const pipelineUrl = `${kedroBaseUrl}/api/pipelines/${pipelineId}`;

  const response = await fetch(pipelineUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch pipeline data: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Find the scatter plot node in the pipeline data
 */
export function findScatterPlotNode(apiResponse: KedroApiResponse, pipelineId: string = 'mean_localmap_bestkmeans'): KedroNode | null {
  return apiResponse.nodes.find(node =>
    node.name === `${pipelineId}__scatter_plot`
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