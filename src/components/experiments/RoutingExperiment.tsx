"use client";

import * as React from "react";
import * as d3 from "d3";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { fetchAndProcessKedroData } from "@/lib/kedro-api";
import { ChevronRightIcon, SettingsIcon } from "lucide-react";

type Point = {
  id: string;
  x: number;
  y: number;
  originalX: number;
  originalY: number;
};

type RoutingAlgorithm = "bfs-path" | "dijkstra";

type NetworkType = "mst" | "knn" | "delaunay" | "delaunay-knn" | "geometric";

const ROUTING_ALGORITHMS = [
  { id: "bfs-path", name: "BFS Minimum Hops" },
  { id: "dijkstra", name: "Dijkstra Shortest Path" }
] as const;

const NETWORK_TYPES = [
  { id: "mst", name: "Minimum Spanning Tree" },
  { id: "knn", name: "K-Nearest Neighbors" },
  { id: "delaunay", name: "Delaunay Triangulation" },
  { id: "delaunay-knn", name: "Delaunay + KNN Filter" },
  { id: "geometric", name: "Random Geometric Graph" }
] as const;

type Edge = {
  source: Point;
  target: Point;
  weight: number;
  originalWeight?: number; // Store original weight before density modification
};

// Distance calculation between two points
const euclideanDistance = (p1: Point, p2: Point): number => {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
};

// Calculate local density for each point (number of neighbors within radius)
const calculateLocalDensity = (points: Point[], radius: number): Map<string, number> => {
  const densityMap = new Map<string, number>();

  for (const point of points) {
    const neighborsCount = points.filter(other =>
      other.id !== point.id && euclideanDistance(point, other) < radius
    ).length;
    densityMap.set(point.id, neighborsCount);
  }

  return densityMap;
};

// Apply density-based cost modification to edges
const applyDensityCosts = (
  edges: Edge[],
  densityMap: Map<string, number>,
  alpha: number
): Edge[] => {
  return edges.map(edge => {
    const sourceDensity = densityMap.get(edge.source.id) || 0;
    const targetDensity = densityMap.get(edge.target.id) || 0;
    const avgDensity = (sourceDensity + targetDensity) / 2;

    // Store original weight if not already stored
    const originalWeight = edge.originalWeight || edge.weight;

    // Apply density cost: cost = distance * (1 + alpha * density)
    // Positive alpha makes dense areas more expensive
    // Negative alpha makes dense areas cheaper
    const densityModifier = 1 + alpha * avgDensity;
    const newWeight = originalWeight * Math.max(0.1, densityModifier); // Prevent negative weights

    return {
      ...edge,
      originalWeight,
      weight: newWeight
    };
  });
};

// Find k nearest neighbors to a point
const findKNearestNeighbors = (point: Point, allPoints: Point[], k: number): Point[] => {
  return allPoints
    .filter(p => p.id !== point.id)
    .sort((a, b) => euclideanDistance(point, a) - euclideanDistance(point, b))
    .slice(0, k);
};

// Kruskal's algorithm for Minimal Spanning Tree
const findMinimalSpanningTree = (points: Point[]): Edge[] => {
  // Create all possible edges
  const edges: Edge[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      edges.push({
        source: points[i],
        target: points[j],
        weight: euclideanDistance(points[i], points[j])
      });
    }
  }

  // Sort edges by weight
  edges.sort((a, b) => a.weight - b.weight);

  // Union-Find data structure
  const parent = new Map<string, string>();
  const rank = new Map<string, number>();

  const find = (id: string): string => {
    if (!parent.has(id)) {
      parent.set(id, id);
      rank.set(id, 0);
    }
    if (parent.get(id) !== id) {
      parent.set(id, find(parent.get(id)!));
    }
    return parent.get(id)!;
  };

  const union = (id1: string, id2: string): boolean => {
    const root1 = find(id1);
    const root2 = find(id2);

    if (root1 === root2) return false;

    const rank1 = rank.get(root1) || 0;
    const rank2 = rank.get(root2) || 0;

    if (rank1 < rank2) {
      parent.set(root1, root2);
    } else if (rank1 > rank2) {
      parent.set(root2, root1);
    } else {
      parent.set(root2, root1);
      rank.set(root1, rank1 + 1);
    }
    return true;
  };

  // Build MST
  const mstEdges: Edge[] = [];
  for (const edge of edges) {
    if (union(edge.source.id, edge.target.id)) {
      mstEdges.push(edge);
      if (mstEdges.length === points.length - 1) break;
    }
  }

  return mstEdges;
};

// Generate KNN graph edges
const generateKNNEdges = (points: Point[], k: number = 6): Edge[] => {
  const edges: Edge[] = [];
  const edgeSet = new Set<string>(); // To avoid duplicate edges

  for (const point of points) {
    const neighbors = findKNearestNeighbors(point, points, k);

    for (const neighbor of neighbors) {
      // Create a unique edge identifier to avoid duplicates
      const edgeId = [point.id, neighbor.id].sort().join('-');

      if (!edgeSet.has(edgeId)) {
        edgeSet.add(edgeId);
        edges.push({
          source: point,
          target: neighbor,
          weight: euclideanDistance(point, neighbor)
        });
      }
    }
  }

  return edges;
};

// Generate Delaunay triangulation edges using D3's efficient implementation
const generateDelaunayEdges = (points: Point[]): Edge[] => {
  if (points.length < 3) return [];

  // Convert points to the format D3 expects: [x, y] arrays
  const coords: [number, number][] = points.map(p => [p.x, p.y]);

  // Create Delaunay triangulation using D3
  const delaunay = d3.Delaunay.from(coords);

  // Get the triangles and convert to edges
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();

  // Iterate through triangles (each triangle is 3 consecutive indices)
  for (let i = 0; i < delaunay.triangles.length; i += 3) {
    const a = delaunay.triangles[i];
    const b = delaunay.triangles[i + 1];
    const c = delaunay.triangles[i + 2];

    // Add the three edges of this triangle
    const triangleEdges = [
      [a, b],
      [b, c],
      [c, a]
    ];

    for (const [idx1, idx2] of triangleEdges) {
      const edgeId = [idx1, idx2].sort().join('-');

      if (!edgeSet.has(edgeId)) {
        edgeSet.add(edgeId);
        const point1 = points[idx1];
        const point2 = points[idx2];

        edges.push({
          source: point1,
          target: point2,
          weight: euclideanDistance(point1, point2)
        });
      }
    }
  }

  return edges;
};

// Generate Delaunay triangulation with KNN filter - combines geometric efficiency with cost awareness
const generateDelaunayKNNEdges = (points: Point[], k: number = 6): Edge[] => {
  if (points.length < 3) return [];

  // First, generate the full Delaunay triangulation
  const delaunayEdges = generateDelaunayEdges(points);

  // Create a map to quickly find edges for each point
  const pointEdges = new Map<string, Edge[]>();

  for (const edge of delaunayEdges) {
    if (!pointEdges.has(edge.source.id)) {
      pointEdges.set(edge.source.id, []);
    }
    if (!pointEdges.has(edge.target.id)) {
      pointEdges.set(edge.target.id, []);
    }

    pointEdges.get(edge.source.id)!.push(edge);
    pointEdges.get(edge.target.id)!.push(edge);
  }

  // Filter edges: for each point, keep only the k shortest edges
  const filteredEdges: Edge[] = [];
  const edgeSet = new Set<string>();

  for (const point of points) {
    const edges = pointEdges.get(point.id) || [];

    // Sort edges by distance (weight) and take the k shortest
    const sortedEdges = edges
      .map(edge => ({
        edge,
        // Calculate distance from current point to the other endpoint
        distance: edge.source.id === point.id
          ? euclideanDistance(point, edge.target)
          : euclideanDistance(point, edge.source)
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, k);

    // Add the k shortest edges to our filtered set
    for (const { edge } of sortedEdges) {
      const edgeId = [edge.source.id, edge.target.id].sort().join('-');

      if (!edgeSet.has(edgeId)) {
        edgeSet.add(edgeId);
        filteredEdges.push(edge);
      }
    }
  }

  return filteredEdges;
};

// Generate Random Geometric Graph edges
const generateGeometricEdges = (points: Point[], radius: number): Edge[] => {
  const edges: Edge[] = [];

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const distance = euclideanDistance(points[i], points[j]);
      if (distance < radius) {
        edges.push({
          source: points[i],
          target: points[j],
          weight: distance
        });
      }
    }
  }

  return edges;
};

// Build adjacency list from edges
const buildGraph = (edges: Edge[]): Map<string, Point[]> => {
  const graph = new Map<string, Point[]>();

  for (const edge of edges) {
    if (!graph.has(edge.source.id)) graph.set(edge.source.id, []);
    if (!graph.has(edge.target.id)) graph.set(edge.target.id, []);

    graph.get(edge.source.id)!.push(edge.target);
    graph.get(edge.target.id)!.push(edge.source);
  }

  return graph;
};

// Build adjacency list with edge weights for Dijkstra
const buildWeightedGraph = (edges: Edge[]): Map<string, Map<string, number>> => {
  const graph = new Map<string, Map<string, number>>();

  for (const edge of edges) {
    if (!graph.has(edge.source.id)) graph.set(edge.source.id, new Map());
    if (!graph.has(edge.target.id)) graph.set(edge.target.id, new Map());

    graph.get(edge.source.id)!.set(edge.target.id, edge.weight);
    graph.get(edge.target.id)!.set(edge.source.id, edge.weight);
  }

  return graph;
};



// Dijkstra's algorithm that works with weighted network graph
const findDijkstraNetworkPath = (
  source: Point,
  destination: Point,
  networkGraph: Map<string, Point[]>,
  weightedGraph: Map<string, Map<string, number>>
): Point[] => {
  console.log(`🔍 Starting Dijkstra path from ${source.id} to ${destination.id}`);
  console.log(`📊 Network graph has ${networkGraph.size} nodes`);

  // Create a lookup map for all points by ID
  const pointLookup = new Map<string, Point>();
  pointLookup.set(source.id, source);
  pointLookup.set(destination.id, destination);

  for (const neighbors of networkGraph.values()) {
    for (const point of neighbors) {
      pointLookup.set(point.id, point);
    }
  }

  const distances = new Map<string, number>();
  const previous = new Map<string, Point | null>();
  const unvisited = new Set<string>();

  // Initialize distances - only for nodes that exist in the network graph
  for (const nodeId of networkGraph.keys()) {
    distances.set(nodeId, nodeId === source.id ? 0 : Infinity);
    previous.set(nodeId, null);
    unvisited.add(nodeId);
  }

  // If source or destination not in network, return direct path
  if (!networkGraph.has(source.id) || !networkGraph.has(destination.id)) {
    console.log(`❌ Source or destination not in network graph`);
    return [source, destination];
  }

  while (unvisited.size > 0) {
    // Find unvisited node with minimum distance
    let current: string | null = null;
    let minDistance = Infinity;

    for (const nodeId of unvisited) {
      const distance = distances.get(nodeId)!;
      if (distance < minDistance) {
        minDistance = distance;
        current = nodeId;
      }
    }

    if (!current || minDistance === Infinity) {
      console.log(`❌ No path found - disconnected graph`);
      break;
    }

    unvisited.delete(current);

    // If we reached the destination, reconstruct path
    if (current === destination.id) {
      console.log(`🎯 Found path to destination!`);
      const path: Point[] = [];
      let nodeId: string | null = current;

      while (nodeId) {
        const point = pointLookup.get(nodeId);
        if (point) path.unshift(point);

        const prevPoint = previous.get(nodeId);
        nodeId = prevPoint?.id || null;
      }

      console.log(`🏁 Dijkstra path:`, path.map(p => p.id));
      return path;
    }

    // Check all neighbors of current node
    const neighbors = networkGraph.get(current) || [];
    console.log(`🔄 Processing ${current} with ${neighbors.length} neighbors`);

    const currentPoint = pointLookup.get(current);
    if (!currentPoint) continue;

    for (const neighbor of neighbors) {
      if (!unvisited.has(neighbor.id)) continue;

      // Use the precomputed edge weight from the weighted graph (includes density modifications)
      const edgeWeight = weightedGraph.get(current)?.get(neighbor.id) || euclideanDistance(currentPoint, neighbor);
      const newDistance = distances.get(current)! + edgeWeight;

      if (newDistance < distances.get(neighbor.id)!) {
        distances.set(neighbor.id, newDistance);
        previous.set(neighbor.id, currentPoint);
      }
    }
  }

  // If no path found through network, return direct path
  console.log(`❌ No network path found, using direct path`);
  return [source, destination];
};


// Find path with minimum hops using BFS (works with any network graph)
const findBFSPath = (source: Point, destination: Point, networkGraph: Map<string, Point[]>): Point[] => {
  const queue: Point[] = [source];
  const visited = new Set<string>([source.id]);
  const parent = new Map<string, Point | null>();
  parent.set(source.id, null);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.id === destination.id) {
      // Reconstruct path
      const path: Point[] = [];
      let node: Point | null = current;
      while (node) {
        path.unshift(node);
        node = parent.get(node.id)!;
      }
      return path;
    }

    const neighbors = networkGraph.get(current.id) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.id)) {
        visited.add(neighbor.id);
        parent.set(neighbor.id, current);
        queue.push(neighbor);
      }
    }
  }

  // If no path found, return direct path
  return [source, destination];
};


// Routing algorithm implementations
const pointsToSvgPath = (
  points: Point[],
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  pathStyle: 'sharp' | 'smooth' = 'sharp'
): string | null => {
  if (points.length < 2) return null;
  const scaled = points.map(p => ({ x: xScale(p.x), y: yScale(p.y) }));
  if (pathStyle === 'smooth' && scaled.length >= 3) {
    let s = `M ${scaled[0].x} ${scaled[0].y}`;
    for (let i = 1; i < scaled.length - 1; i++) {
      const cur = scaled[i], nxt = scaled[i + 1];
      s += ` Q ${cur.x} ${cur.y} ${cur.x + (nxt.x - cur.x) * 0.5} ${cur.y + (nxt.y - cur.y) * 0.5}`;
    }
    const last = scaled[scaled.length - 1];
    s += ` T ${last.x} ${last.y}`;
    return s;
  }
  let s = `M ${scaled[0].x} ${scaled[0].y}`;
  for (let i = 1; i < scaled.length; i++) s += ` L ${scaled[i].x} ${scaled[i].y}`;
  return s;
};

const generatePath = (
  source: Point,
  destination: Point,
  algorithm: RoutingAlgorithm,
  networkGraph: Map<string, Point[]>,
  weightedGraph: Map<string, Map<string, number>>,
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  pathStyle: 'sharp' | 'smooth' = 'sharp'
): string | null => {
  let pathPoints: Point[] = [];

  switch (algorithm) {
    case "bfs-path":
      pathPoints = findBFSPath(source, destination, networkGraph);
      break;

    case "dijkstra":
      // Dijkstra's algorithm that respects the selected network graph
      pathPoints = findDijkstraNetworkPath(source, destination, networkGraph, weightedGraph);
      break;

    default:
      pathPoints = findBFSPath(source, destination, networkGraph);
  }

  // Convert points to SVG path
  if (pathPoints.length < 2) return null;

  const scaledPoints = pathPoints.map(p => ({
    x: xScale(p.x),
    y: yScale(p.y)
  }));

  if (pathStyle === "smooth" && scaledPoints.length >= 3) {
    // Create smooth bezier curve through points
    let pathString = `M ${scaledPoints[0].x} ${scaledPoints[0].y}`;

    for (let i = 1; i < scaledPoints.length - 1; i++) {
      const current = scaledPoints[i];
      const next = scaledPoints[i + 1];
      const controlX = current.x + (next.x - current.x) * 0.5;
      const controlY = current.y + (next.y - current.y) * 0.5;
      pathString += ` Q ${current.x} ${current.y} ${controlX} ${controlY}`;
    }

    const last = scaledPoints[scaledPoints.length - 1];
    pathString += ` T ${last.x} ${last.y}`;

    return pathString;
  } else {
    // Create straight line segments through points
    let pathString = `M ${scaledPoints[0].x} ${scaledPoints[0].y}`;
    for (let i = 1; i < scaledPoints.length; i++) {
      pathString += ` L ${scaledPoints[i].x} ${scaledPoints[i].y}`;
    }
    return pathString;
  }
};

type DisplaySettings = {
  showEdges?: 'none' | 'all' | 'only path';
  showNodes?: 'none' | 'all' | 'only path';
  pathStyle?: 'sharp' | 'smooth';
  kedroBaseUrl?: string;
  pipelineId?: string;
  navigationMode?: boolean;
  waypointDensity?: number;
  waypointDistribution?: 'hops' | 'distance';
  includeAvatars?: boolean;
};

export const RoutingExperiment: React.FC<DisplaySettings> = ({
  showEdges: initialShowEdges = 'all',
  showNodes: initialShowNodes = 'all',
  pathStyle: initialPathStyle = 'sharp',
  kedroBaseUrl,
  pipelineId = 'mean_localmap_bestkmeans',
  navigationMode = false,
  waypointDensity: initialWaypointDensity = 1.0,
  waypointDistribution: initialWaypointDistribution = 'hops' as 'hops' | 'distance',
  includeAvatars: initialIncludeAvatars = false,
}) => {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const containerRef = React.useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const [navZoomTransform, setNavZoomTransform] = React.useState<d3.ZoomTransform>(d3.zoomIdentity);

  const [data, setData] = React.useState<Point[]>([]);
  const [sourcePoint, setSourcePoint] = React.useState<Point | null>(null);
  const [destinationPoint, setDestinationPoint] = React.useState<Point | null>(null);
  const [selectedAlgorithm, setSelectedAlgorithm] = React.useState<RoutingAlgorithm>("dijkstra");
  const [selectedNetworkType, setSelectedNetworkType] = React.useState<NetworkType>("delaunay-knn");
  const [knnK, setKnnK] = React.useState(6);
  const [geometricRadius, setGeometricRadius] = React.useState(0.1);
  const [isLoading, setIsLoading] = React.useState(true);
  const [pathPoints, setPathPoints] = React.useState<Point[]>([]);
  const [networkEdges, setNetworkEdges] = React.useState<Edge[]>([]);
  const [networkGraph, setNetworkGraph] = React.useState<Map<string, Point[]>>(new Map());
  const [weightedGraph, setWeightedGraph] = React.useState<Map<string, Map<string, number>>>(new Map());

  // Density field parameters
  const [densityRadius, setDensityRadius] = React.useState(0.05);
  const [densityAlpha, setDensityAlpha] = React.useState(1.00);
  const [densityMap, setDensityMap] = React.useState<Map<string, number>>(new Map());

  // Navigation mode state (3D tilt/heading)
  const [navTilt, setNavTilt] = React.useState(0);      // 0–80 degrees
  const [navHeading, setNavHeading] = React.useState(0); // 0–360 degrees

  // Local state for display settings (used when not controlled by Storybook)
  const [localShowEdges, setLocalShowEdges] = React.useState<'none' | 'all' | 'only path'>('none');
  const [localShowNodes, setLocalShowNodes] = React.useState<'none' | 'all' | 'only path'>('all');
  const [localPathStyle, setLocalPathStyle] = React.useState<'sharp' | 'smooth'>('smooth');
  const [localWaypointDensity, setLocalWaypointDensity] = React.useState(1.0);
  const [localWaypointDistribution, setLocalWaypointDistribution] = React.useState<'hops' | 'distance'>('hops');
  const [localIncludeAvatars, setLocalIncludeAvatars] = React.useState(false);

  // Use props if provided (from Storybook), otherwise use local state
  const showEdges = initialShowEdges !== 'all' ? initialShowEdges : localShowEdges;
  const showNodes = initialShowNodes !== 'all' ? initialShowNodes : localShowNodes;
  const pathStyle = initialPathStyle !== 'sharp' ? initialPathStyle : localPathStyle;
  const waypointDensity = initialWaypointDensity !== 1.0 ? initialWaypointDensity : localWaypointDensity;
  const waypointDistribution = initialWaypointDistribution !== 'hops' ? initialWaypointDistribution : localWaypointDistribution;
  const includeAvatars = initialIncludeAvatars || localIncludeAvatars;

  // Derive highlighted path points by sampling intermediates according to waypointDensity + waypointDistribution
  const visiblePathPoints = React.useMemo(() => {
    if (pathPoints.length <= 2 || waypointDensity >= 1.0) return pathPoints;
    const intermediates = pathPoints.slice(1, -1);
    const count = Math.round(intermediates.length * waypointDensity);
    if (count === 0) return [pathPoints[0], pathPoints[pathPoints.length - 1]];

    let selected: Point[];

    if (waypointDistribution === 'distance') {
      // Compute cumulative Euclidean distances along the intermediates
      const cumDist: number[] = [0];
      for (let i = 1; i < intermediates.length; i++) {
        const prev = intermediates[i - 1], cur = intermediates[i];
        cumDist.push(cumDist[i - 1] + Math.sqrt((cur.x - prev.x) ** 2 + (cur.y - prev.y) ** 2));
      }
      const totalDist = cumDist[cumDist.length - 1];
      selected = [];
      for (let i = 0; i < count; i++) {
        const target = count === 1 ? totalDist / 2 : (i / (count - 1)) * totalDist;
        // Find intermediate whose cumulative distance is closest to target
        let best = 0;
        let bestDiff = Math.abs(cumDist[0] - target);
        for (let j = 1; j < cumDist.length; j++) {
          const diff = Math.abs(cumDist[j] - target);
          if (diff < bestDiff) { bestDiff = diff; best = j; }
        }
        selected.push(intermediates[best]);
      }
    } else {
      // Hops: evenly spaced by index
      selected = [];
      for (let i = 0; i < count; i++) {
        const idx = count === 1 ? 0 : Math.round(i * (intermediates.length - 1) / (count - 1));
        selected.push(intermediates[idx]);
      }
    }

    return [pathPoints[0], ...selected, pathPoints[pathPoints.length - 1]];
  }, [pathPoints, waypointDensity, waypointDistribution]);

  // Load and process the projection data
  React.useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        let rawData: [string, [number, number]][];

        if (kedroBaseUrl) {
          // Load from Kedro API
          rawData = await fetchAndProcessKedroData(kedroBaseUrl, pipelineId);
        } else {
          // Load from local file
          const response = await fetch('/projections.json');
          rawData = await response.json();
        }

        // Convert to our Point format
        const points: Point[] = rawData.map(([id, [x, y]]) => ({
          id,
          x,
          y,
          originalX: x,
          originalY: y
        }));

        setData(points);

        // Select two random points to start with
        if (points.length >= 2) {
          const shuffled = [...points].sort(() => 0.5 - Math.random());
          const randomSource = shuffled[0];
          const randomDestination = shuffled[1];

          setSourcePoint(randomSource);
          setDestinationPoint(randomDestination);
          setPathPoints([]);
        } else {
          // Reset selected points when data changes
          setSourcePoint(null);
          setDestinationPoint(null);
          setPathPoints([]);
        }

        // Calculate initial network (will be recalculated when network type changes)
        const mst = findMinimalSpanningTree(points);
        const graph = buildGraph(mst);
        setNetworkEdges(mst);
        setNetworkGraph(graph);

        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load projection data:', error);
        setIsLoading(false);
      }
    };

    loadData();
  }, [kedroBaseUrl, pipelineId]);

  // Calculate density map when data or density parameters change
  React.useEffect(() => {
    if (data.length > 0) {
      const newDensityMap = calculateLocalDensity(data, densityRadius);
      setDensityMap(newDensityMap);
    }
  }, [data, densityRadius]);

  // Recalculate network when type or parameters change
  React.useEffect(() => {
    if (data.length > 0) {
      let edges: Edge[] = [];

      switch (selectedNetworkType) {
        case "mst":
          edges = findMinimalSpanningTree(data);
          break;
        case "knn":
          edges = generateKNNEdges(data, knnK);
          break;
        case "delaunay":
          edges = generateDelaunayEdges(data);
          break;
        case "delaunay-knn":
          edges = generateDelaunayKNNEdges(data, knnK);
          break;
        case "geometric":
          edges = generateGeometricEdges(data, geometricRadius);
          break;
      }

      // Apply density costs if alpha is not zero
      if (densityAlpha !== 0 && densityMap.size > 0) {
        edges = applyDensityCosts(edges, densityMap, densityAlpha);
      }

      const graph = buildGraph(edges);
      const wGraph = buildWeightedGraph(edges);
      setNetworkEdges(edges);
      setNetworkGraph(graph);
      setWeightedGraph(wGraph);
    }
  }, [selectedNetworkType, knnK, geometricRadius, data, densityAlpha, densityMap]);

  // Calculate scales and setup SVG
  const { xScale, yScale } = React.useMemo(() => {
    if (!data.length) return { xScale: null, yScale: null };

    const width = window.innerWidth;
    const height = window.innerHeight;
    const margin = 40;

    const xExtent = d3.extent(data, d => d.x) as [number, number];
    const yExtent = d3.extent(data, d => d.y) as [number, number];

    const xScale = d3.scaleLinear()
      .domain(xExtent)
      .range([margin, width - margin]);

    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .range([height - margin, margin]);

    return { xScale, yScale };
  }, [data]);

  // Initialize SVG immediately when ref is available
  React.useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.attr("width", window.innerWidth).attr("height", window.innerHeight);

    if (!containerRef.current) {
      containerRef.current = svg.append("g");
    }
  });

  // Update SVG dimensions when scales change
  React.useEffect(() => {
    if (!svgRef.current || !xScale || !yScale) return;

    const svg = d3.select(svgRef.current);
    svg.attr("width", window.innerWidth).attr("height", window.innerHeight);
  }, [xScale, yScale]);

  // Draw all SVG elements in proper z-order
  React.useEffect(() => {
    if (!containerRef.current || !xScale || !yScale || !data.length) return;

    const container = containerRef.current;

    // Get current zoom transform
    const currentTransform = navigationMode ? navZoomTransform : d3.zoomTransform(container.node()!);


    // In nav mode: bake zoom + 3D perspective into coordinates directly (no CSS transform on SVG).
    // In normal mode: D3 zoom applies its transform to the <g> container; we just use xScale/yScale.
    if (navigationMode) container.attr("transform", null);

    const W = svgRef.current?.clientWidth ?? window.innerWidth;
    const H = svgRef.current?.clientHeight ?? window.innerHeight;
    const headingRad = navHeading * Math.PI / 180;
    const tiltRad = navTilt * Math.PI / 180;
    const cosH = Math.cos(headingRad), sinH = Math.sin(headingRad);
    const cosT = Math.cos(tiltRad), sinT = Math.sin(tiltRad);
    const focal = 1200;

    const project = (dataX: number, dataY: number) => {
      if (!navigationMode) return { x: xScale(dataX), y: yScale(dataY) };
      const sx = xScale(dataX) * navZoomTransform.k + navZoomTransform.x;
      const sy = yScale(dataY) * navZoomTransform.k + navZoomTransform.y;
      const cx = sx - W / 2, cy = sy - H / 2;
      const rx = cx * cosH - cy * sinH;
      const ry = cx * sinH + cy * cosH;
      const tz = -ry * sinT;
      const s = focal / (focal + tz);
      return { x: rx * s + W / 2, y: ry * cosT * s + H / 2 };
    };

    // Clear all existing elements
    container.selectAll("*").remove();

    // 0. Draw perspective grid in navigation mode (below everything)
    if (navigationMode) {
      const [xMin, xMax] = xScale.domain();
      const [yMin, yMax] = yScale.domain();
      const gridCount = 10;

      for (let i = 0; i <= gridCount; i++) {
        const tx = xMin + (xMax - xMin) * i / gridCount;
        const p1 = project(tx, yMin), p2 = project(tx, yMax);
        container.append("line")
          .attr("x1", p1.x).attr("y1", p1.y)
          .attr("x2", p2.x).attr("y2", p2.y)
          .attr("stroke", "#d1d5db").attr("stroke-width", 1)
          .style("pointer-events", "none");

        const ty = yMin + (yMax - yMin) * i / gridCount;
        const p3 = project(xMin, ty), p4 = project(xMax, ty);
        container.append("line")
          .attr("x1", p3.x).attr("y1", p3.y)
          .attr("x2", p4.x).attr("y2", p4.y)
          .attr("stroke", "#d1d5db").attr("stroke-width", 1)
          .style("pointer-events", "none");
      }
    }

    // 1. Draw network edges first (bottom layer)
    if (networkEdges.length > 0) {
      // Filter edges based on showEdges setting
      let edgesToShow = networkEdges;
      if (showEdges === 'none') {
        edgesToShow = [];
      } else if (showEdges === 'only path' && pathPoints.length > 1) {
        // Only show edges that are part of the current path
        const pathEdgeSet = new Set<string>();
        for (let i = 0; i < pathPoints.length - 1; i++) {
          const edgeId1 = `${pathPoints[i].id}-${pathPoints[i + 1].id}`;
          const edgeId2 = `${pathPoints[i + 1].id}-${pathPoints[i].id}`;
          pathEdgeSet.add(edgeId1);
          pathEdgeSet.add(edgeId2);
        }

        edgesToShow = networkEdges.filter(edge => {
          const edgeId1 = `${edge.source.id}-${edge.target.id}`;
          const edgeId2 = `${edge.target.id}-${edge.source.id}`;
          return pathEdgeSet.has(edgeId1) || pathEdgeSet.has(edgeId2);
        });
      }

      // Choose color based on network type
      const edgeColor = selectedNetworkType === "mst" ? "#374151" :
                       selectedNetworkType === "knn" ? "#059669" :
                       selectedNetworkType === "delaunay" ? "#dc2626" :
                       selectedNetworkType === "delaunay-knn" ? "#7c3aed" : "#8b5cf6";
      const edgeOpacity = selectedNetworkType === "delaunay" ? 0.4 :
                         selectedNetworkType === "delaunay-knn" ? 0.7 :
                         selectedNetworkType === "geometric" ? 0.6 : 0.8;

      // Draw filtered network edges
      container.selectAll(".network-edge")
        .data(edgesToShow)
        .enter()
        .append("line")
        .attr("class", "network-edge")
        .attr("x1", (d: Edge) => project(d.source.x, d.source.y).x)
        .attr("y1", (d: Edge) => project(d.source.x, d.source.y).y)
        .attr("x2", (d: Edge) => project(d.target.x, d.target.y).x)
        .attr("y2", (d: Edge) => project(d.target.x, d.target.y).y)
        .attr("stroke", edgeColor)
        .attr("stroke-width", 1 / currentTransform.k)
        .attr("stroke-opacity", edgeOpacity)
        .style("pointer-events", "none"); // Prevent edges from capturing mouse events
    }

    // 2. Draw path (middle layer) — always traverses all waypoints
    if (sourcePoint && destinationPoint && pathPoints.length > 0) {
      let pathD: string | null = null;
      if (navigationMode) {
        const pts = pathPoints.map(p => project(p.x, p.y));
        if (pathStyle === 'smooth' && pts.length >= 3) {
          pathD = `M ${pts[0].x} ${pts[0].y}`;
          for (let i = 1; i < pts.length - 1; i++) {
            const cur = pts[i], nxt = pts[i + 1];
            pathD += ` Q ${cur.x} ${cur.y} ${cur.x + (nxt.x - cur.x) * 0.5} ${cur.y + (nxt.y - cur.y) * 0.5}`;
          }
          pathD += ` T ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
        } else {
          pathD = `M ${pts[0].x} ${pts[0].y}` + pts.slice(1).map(p => ` L ${p.x} ${p.y}`).join('');
        }
      } else {
        pathD = generatePath(sourcePoint, destinationPoint, selectedAlgorithm, networkGraph, weightedGraph, xScale, yScale, pathStyle);
      }

      if (pathD) {
        container.append("path")
          .attr("class", "routing-path")
          .attr("d", pathD)
          .attr("fill", "none")
          .attr("stroke", "#3b82f6")
          .attr("stroke-width", navigationMode ? 3 : 3 / currentTransform.k)
          .attr("stroke-opacity", 0.8)
          .attr("marker-end", "url(#arrowhead)")
          .style("pointer-events", "none");
      }
    }

    // 3. Draw nodes in proper order (top layer)
    // Filter points based on showNodes setting
    let pointsToShow = data;
    if (showNodes === 'none') {
      pointsToShow = [];
    } else if (showNodes === 'only path') {
      pointsToShow = data.filter(d =>
        (sourcePoint && d.id === sourcePoint.id) ||
        (destinationPoint && d.id === destinationPoint.id) ||
        pathPoints.some(p => p.id === d.id)
      );
    }

    // Separate points by type for proper z-order
    const inactivePoints = pointsToShow.filter(d =>
      (!sourcePoint || d.id !== sourcePoint.id) &&
      (!destinationPoint || d.id !== destinationPoint.id) &&
      !pathPoints.some(p => p.id === d.id)
    );

    const intermediatePoints = pointsToShow.filter(d =>
      pathPoints.some(p => p.id === d.id) &&
      (!sourcePoint || d.id !== sourcePoint.id) &&
      (!destinationPoint || d.id !== destinationPoint.id)
    );

    const activeWaypointIds = new Set(visiblePathPoints.map(p => p.id));

    const startEndPoints = pointsToShow.filter(d =>
      (sourcePoint && d.id === sourcePoint.id) ||
      (destinationPoint && d.id === destinationPoint.id)
    );

    // Create drag behavior for source and destination points
    const dragBehavior = d3.drag<SVGCircleElement, Point>()
      .on("start", function(_, d) {
        // Only allow dragging of source and destination points
        if (!sourcePoint || !destinationPoint) return;
        if (d.id !== sourcePoint.id && d.id !== destinationPoint.id) return;

        d3.select(this).style("cursor", "grabbing");
      })
      .on("drag", function(event, d) {
        // Only allow dragging of source and destination points
        if (!sourcePoint || !destinationPoint) return;

        // Determine which point we're dragging based on the original point's ID
        // Store the original ID to avoid confusion during dragging
        const isDraggingSource = d.id === sourcePoint.id;
        const isDraggingDestination = d.id === destinationPoint.id;

        if (!isDraggingSource && !isDraggingDestination) return;

        // Get the current zoom transform
        const transform = d3.zoomTransform(container.node()!);

        // Use the mouse position directly from the event
        // Convert screen coordinates to data coordinates accounting for zoom/pan
        const mouseX = event.sourceEvent.clientX;
        const mouseY = event.sourceEvent.clientY;

        // Get SVG bounding rect to convert client coordinates to SVG coordinates
        const svgRect = svgRef.current!.getBoundingClientRect();
        const svgX = mouseX - svgRect.left;
        const svgY = mouseY - svgRect.top;

        // Convert SVG coordinates to data coordinates accounting for zoom/pan
        const dataX = xScale.invert((svgX - transform.x) / transform.k);
        const dataY = yScale.invert((svgY - transform.y) / transform.k);

        // Find the nearest point to snap to
        let nearestPoint = data[0];
        let minDistance = euclideanDistance({ x: dataX, y: dataY, id: '', originalX: 0, originalY: 0 }, nearestPoint);

        for (const point of data) {
          const distance = euclideanDistance({ x: dataX, y: dataY, id: '', originalX: 0, originalY: 0 }, point);
          if (distance < minDistance) {
            minDistance = distance;
            nearestPoint = point;
          }
        }

        // Update the circle position immediately for visual feedback
        d3.select(this)
          .attr("cx", xScale(nearestPoint.x))
          .attr("cy", yScale(nearestPoint.y));

        // Update the corresponding state based on which point we're dragging
        if (isDraggingSource) {
          setSourcePoint({ ...nearestPoint });
        } else if (isDraggingDestination) {
          setDestinationPoint({ ...nearestPoint });
        }
      })
      .on("end", function() {
        d3.select(this).style("cursor", "grab");
      });

    // Helper function to draw circles
    const drawCircles = (points: Point[], className: string) => {
      const circles = container.selectAll(`.${className}`)
        .data(points)
        .enter()
        .append("circle")
        .attr("class", className)
        .attr("cx", d => project(d.x, d.y).x)
        .attr("cy", d => project(d.x, d.y).y)
        .attr("r", d => {
          const baseRadius = (() => {
            if (sourcePoint && d.id === sourcePoint.id) return 8;
            if (destinationPoint && d.id === destinationPoint.id) return 8;
            if (pathPoints.some(p => p.id === d.id)) return 5;
            return 3;
          })();
          return navigationMode ? baseRadius : baseRadius / currentTransform.k;
        })
        .attr("fill", d => {
          if (sourcePoint && d.id === sourcePoint.id) return "#22c55e"; // green
          if (destinationPoint && d.id === destinationPoint.id) return "#ef4444"; // red
          if (activeWaypointIds.has(d.id)) return "#f59e0b"; // orange — active waypoint
          if (pathPoints.some(p => p.id === d.id)) return "#ffffff"; // white — inactive waypoint

          // Color by density if density alpha is not zero
          if (densityAlpha !== 0 && densityMap.size > 0) {
            const density = densityMap.get(d.id) || 0;
            const maxDensity = Math.max(...Array.from(densityMap.values()));
            if (maxDensity > 0) {
              const normalizedDensity = density / maxDensity;
              // Use a color scale from light blue (low density) to dark blue (high density)
              const intensity = Math.floor(normalizedDensity * 200 + 55); // 55-255 range
              return `rgb(${255 - intensity}, ${255 - intensity}, 255)`;
            }
          }

          return "#64748b"; // gray
        })
        .attr("stroke", d => {
          if (sourcePoint && d.id === sourcePoint.id) return "#16a34a";
          if (destinationPoint && d.id === destinationPoint.id) return "#dc2626";
          if (activeWaypointIds.has(d.id)) return "#d97706";
          if (pathPoints.some(p => p.id === d.id)) return "#94a3b8"; // slate border for inactive
          return "none";
        })
        .attr("stroke-width", navigationMode ? 2 : 2 / currentTransform.k)
        .style("cursor", d => {
          // Show different cursor for draggable points
          if (sourcePoint && destinationPoint && (d.id === sourcePoint.id || d.id === destinationPoint.id)) {
            return "grab";
          }
          return "pointer";
        })
        .on("click", (_, d) => {
          if (!sourcePoint) {
            setSourcePoint(d);
            setDestinationPoint(null); // Clear destination when setting new source
            setPathPoints([]);
          } else if (!destinationPoint) {
            setDestinationPoint(d);
          } else {
            // Reset and start over
            setSourcePoint(d);
            setDestinationPoint(null);
            setPathPoints([]);
          }
        });

      return circles;
    };

    // Draw nodes in proper z-order: inactive -> inactive waypoints -> active waypoints -> start/end
    const inactiveWaypoints = intermediatePoints.filter(d => !activeWaypointIds.has(d.id));
    const activeWaypoints = intermediatePoints.filter(d => activeWaypointIds.has(d.id));
    drawCircles(inactivePoints, "inactive-node");
    drawCircles(inactiveWaypoints, "inactive-waypoint");
    drawCircles(activeWaypoints, "active-waypoint");

    if (navigationMode) {
      // Upright pin: tip anchored to projected position, body extends straight up in screen space.
      const drawPin = (point: Point, fill: string, stroke: string, r = 10, stemH = 20) => {
        const { x: px, y: py } = project(point.x, point.y);
        const pathD = `M ${px} ${py} L ${px - r} ${py - stemH} A ${r} ${r} 0 1 1 ${px + r} ${py - stemH} Z`;
        container.append("path")
          .attr("d", pathD)
          .attr("fill", fill)
          .attr("stroke", stroke)
          .attr("stroke-width", 1.5)
          .attr("stroke-linejoin", "round")
          .style("cursor", "pointer")
          .on("click", () => {
            setSourcePoint(point);
            setDestinationPoint(null);
            setPathPoints([]);
          });

        if (includeAvatars) {
          const avatarR = r * 0.9;
          const avatarUrl = `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(String(point.id))}&radius=50`;
          container.append("image")
            .attr("href", avatarUrl)
            .attr("x", px - avatarR).attr("y", py - stemH - avatarR)
            .attr("width", avatarR * 2).attr("height", avatarR * 2)
            .style("pointer-events", "none");
        } else {
          container.append("circle")
            .attr("cx", px).attr("cy", py - stemH).attr("r", r * 0.38)
            .attr("fill", "white")
            .style("pointer-events", "none");
        }
      };

      // Active waypoints as smaller upright pins
      drawCircles(inactiveWaypoints, "inactive-waypoint");
      activeWaypoints.forEach(p => drawPin(p, "#f59e0b", "#d97706", 8, 16));
      if (sourcePoint) drawPin(sourcePoint, "#22c55e", "#16a34a");
      if (destinationPoint) drawPin(destinationPoint, "#ef4444", "#dc2626");
    } else {
      const startEndCircles = drawCircles(startEndPoints, "start-end-node");
      startEndCircles
        .filter(d => {
          if (!sourcePoint || !destinationPoint) return false;
          return d.id === sourcePoint.id || d.id === destinationPoint.id;
        })
        .call(dragBehavior);
    }

  }, [data, xScale, yScale, sourcePoint, destinationPoint, pathPoints, visiblePathPoints, showNodes, densityAlpha, densityMap, networkEdges, selectedNetworkType, showEdges, selectedAlgorithm, networkGraph, weightedGraph, pathStyle, navigationMode, navZoomTransform, navTilt, navHeading, includeAvatars]);

  // Calculate path points separately to avoid infinite loops
  React.useEffect(() => {
    if (!sourcePoint || !destinationPoint) {
      setPathPoints([]);
      return;
    }

    let calculatedPathPoints: Point[] = [];

    switch (selectedAlgorithm) {
      case "bfs-path":
        calculatedPathPoints = findBFSPath(sourcePoint, destinationPoint, networkGraph);
        break;
      case "dijkstra":
        calculatedPathPoints = findDijkstraNetworkPath(sourcePoint, destinationPoint, networkGraph, weightedGraph);
        break;
      default:
        calculatedPathPoints = findBFSPath(sourcePoint, destinationPoint, networkGraph);
    }

    setPathPoints(calculatedPathPoints);
  }, [sourcePoint, destinationPoint, selectedAlgorithm, networkGraph, weightedGraph]);


  // Shift-drag for 3D navigation (tilt + heading), matching Google Maps convention
  React.useEffect(() => {
    if (!navigationMode || !svgRef.current) return;
    const svgEl = svgRef.current;

    let dragging = false;
    let lastX = 0, lastY = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || !e.shiftKey) return;
      e.preventDefault();
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      setNavHeading(h => (h - dx * 0.3 + 360) % 360);
      setNavTilt(t => Math.max(0, Math.min(80, t - dy * 0.3)));
    };
    const onMouseUp = (e: MouseEvent) => { if (e.button === 0) dragging = false; };

    svgEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      svgEl.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [navigationMode, isLoading]);

  // Add zoom behavior
  React.useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 20])
      .filter((event) => {
        // Allow wheel events for zooming
        if (event.type === "wheel") return true;
        // Allow touch events for multi-touch zoom and pan on mobile
        if (event.type === "touchstart" || event.type === "touchmove" || event.type === "touchend") {
          return true;
        }
        // Allow mouse events for panning (but not clicking on points, and not shift-drag in navigation mode)
        if (event.type === "mousedown") {
          if (navigationMode && event.shiftKey) return false;
          const target = event.target as Element;
          return !target.closest("circle");
        }
        return false;
      })
      .on("zoom", (event) => {
        const transform = event.transform;

        if (navigationMode) {
          // In nav mode, zoom is baked into the JS projection — don't touch the <g> transform
          setNavZoomTransform(transform);
          return;
        }

        container.attr("transform", transform);

        // Update circle/path/edge sizes to maintain visual consistency during zoom
        container.selectAll("circle")
          .attr("r", (d: any) => {
            const baseRadius = (() => {
              if (sourcePoint && d.id === sourcePoint.id) return 8;
              if (destinationPoint && d.id === destinationPoint.id) return 8;
              if (pathPoints.some(p => p.id === d.id)) return 5;
              return 3;
            })();
            return baseRadius / transform.k;
          })
          .attr("stroke-width", 2 / transform.k);
        container.selectAll(".routing-path").attr("stroke-width", 3 / transform.k);
        container.selectAll(".network-edge").attr("stroke-width", 1 / transform.k);
      });

    svg.call(zoom);

    // Reset zoom on double-click (but not on circles)
    svg.on("dblclick.zoom", (event) => {
      const target = event.target as Element;
      if (!target.closest("circle")) {
        svg.transition().duration(750).call(
          zoom.transform,
          d3.zoomIdentity
        );
        if (navigationMode) {
          setNavTilt(0);
          setNavHeading(0);
        }
      }
    });

    return () => {
      svg.on(".zoom", null);
      svg.on("dblclick.zoom", null);
    };
  }, [sourcePoint, destinationPoint, pathPoints, navigationMode]);

  // Add arrow marker definition
  React.useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);

    // Remove existing defs
    svg.select("defs").remove();

    const defs = svg.append("defs");

    defs.append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 8)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#3b82f6");

  }, []);

  const handleReset = () => {
    setSourcePoint(null);
    setDestinationPoint(null);
    setPathPoints([]);
  };

  const handleRandomPoints = () => {
    if (data.length >= 2) {
      const shuffled = [...data].sort(() => 0.5 - Math.random());
      const randomSource = shuffled[0];
      const randomDestination = shuffled[1];

      setSourcePoint(randomSource);
      setDestinationPoint(randomDestination);
      setPathPoints([]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-screen h-screen">
        <div className="text-lg">Loading projection data...</div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen">
      <svg
        ref={svgRef}
        className="w-screen h-screen block bg-gray-50"
        style={{ touchAction: 'none' }}
      />
      {navigationMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full pointer-events-none">
          Tilt: {Math.round(navTilt)}° · Heading: {Math.round(navHeading)}° · Shift-drag to orbit
        </div>
      )}

      {/* Collapsible Controls Sheet */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="default"
            size="sm"
            className="absolute top-4 left-4 z-10 shadow-lg"
          >
            <SettingsIcon className="w-4 h-4 mr-2" />
            Controls
            <ChevronRightIcon className="w-4 h-4 ml-2" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-full sm:w-[540px] overflow-hidden p-6">
          <SheetHeader className="pb-4">
            <SheetTitle>Routing Experiment Controls</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto max-h-[calc(100vh-120px)]">
            <div className="space-y-4 pb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Routing Algorithm</label>
                <Select value={selectedAlgorithm} onValueChange={(value: RoutingAlgorithm) => setSelectedAlgorithm(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUTING_ALGORITHMS.map((algo) => (
                      <SelectItem key={algo.id} value={algo.id}>
                        {algo.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Network Type</label>
                <Select value={selectedNetworkType} onValueChange={(value: NetworkType) => setSelectedNetworkType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NETWORK_TYPES.map((network) => (
                      <SelectItem key={network.id} value={network.id}>
                        {network.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(selectedNetworkType === "knn" || selectedNetworkType === "delaunay-knn") && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    K ({selectedNetworkType === "delaunay-knn" ? "Max edges per node" : "Neighbors"}): {knnK}
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="15"
                    value={knnK}
                    onChange={(e) => setKnnK(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}

              {selectedNetworkType === "geometric" && (
                <div>
                  <label className="block text-sm font-medium mb-2">Radius: {geometricRadius.toFixed(3)}</label>
                  <input
                    type="range"
                    min="0.05"
                    max="0.5"
                    step="0.01"
                    value={geometricRadius}
                    onChange={(e) => setGeometricRadius(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}

              <div className="space-y-3 border-t pt-3">
                <h4 className="text-sm font-medium">Density Field</h4>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Density Radius: {densityRadius.toFixed(3)}
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="0.5"
                    step="0.01"
                    value={densityRadius}
                    onChange={(e) => setDensityRadius(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Radius for counting nearby points
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Density Cost: {densityAlpha.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="-1.0"
                    max="1.0"
                    step="0.05"
                    value={densityAlpha}
                    onChange={(e) => setDensityAlpha(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {densityAlpha > 0 ? "Positive: avoid dense areas" :
                     densityAlpha < 0 ? "Negative: prefer dense areas" :
                     "Zero: no density effect"}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium">Display Settings</h4>

                <div className="space-y-2">
                  <div>
                    <Label className="text-xs font-medium mb-1 block">Edges</Label>
                    <RadioGroup
                      value={showEdges}
                      onValueChange={(value: 'none' | 'all' | 'only path') => setLocalShowEdges(value)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="none" id="edges-none" className="w-3 h-3" />
                        <Label htmlFor="edges-none" className="text-xs">None</Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="all" id="edges-all" className="w-3 h-3" />
                        <Label htmlFor="edges-all" className="text-xs">All</Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="only path" id="edges-path" className="w-3 h-3" />
                        <Label htmlFor="edges-path" className="text-xs">Path</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-xs font-medium mb-1 block">Nodes</Label>
                    <RadioGroup
                      value={showNodes}
                      onValueChange={(value: 'none' | 'all' | 'only path') => setLocalShowNodes(value)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="none" id="nodes-none" className="w-3 h-3" />
                        <Label htmlFor="nodes-none" className="text-xs">None</Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="all" id="nodes-all" className="w-3 h-3" />
                        <Label htmlFor="nodes-all" className="text-xs">All</Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="only path" id="nodes-path" className="w-3 h-3" />
                        <Label htmlFor="nodes-path" className="text-xs">Path</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-xs font-medium mb-1 block">Path</Label>
                    <RadioGroup
                      value={pathStyle}
                      onValueChange={(value: 'sharp' | 'smooth') => setLocalPathStyle(value)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="sharp" id="path-sharp" className="w-3 h-3" />
                        <Label htmlFor="path-sharp" className="text-xs">Sharp</Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="smooth" id="path-smooth" className="w-3 h-3" />
                        <Label htmlFor="path-smooth" className="text-xs">Smooth</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-2">
                      Waypoints: {waypointDensity >= 1.0 ? 'All' : `${Math.round(waypointDensity * 100)}%`}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={localWaypointDensity}
                      onChange={(e) => setLocalWaypointDensity(parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Fraction of intermediate waypoints to highlight
                    </p>
                  </div>

                  <div>
                    <Label className="text-xs font-medium mb-1 block">Waypoint Distribution</Label>
                    <RadioGroup
                      value={waypointDistribution}
                      onValueChange={(value: 'hops' | 'distance') => setLocalWaypointDistribution(value)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="hops" id="wp-hops" className="w-3 h-3" />
                        <Label htmlFor="wp-hops" className="text-xs">Hops</Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="distance" id="wp-distance" className="w-3 h-3" />
                        <Label htmlFor="wp-distance" className="text-xs">Distance</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {navigationMode && (
                    <div className="flex items-center justify-between">
                      <Label htmlFor="include-avatars" className="text-xs font-medium">Avatar Pins</Label>
                      <Switch
                        id="include-avatars"
                        checked={includeAvatars}
                        onCheckedChange={setLocalIncludeAvatars}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <p><strong>Instructions:</strong></p>
                <ol className="list-decimal list-inside space-y-1 mt-2">
                  <li>Two random points are selected automatically on load</li>
                  <li>Click "Random Points" to select new random points</li>
                  <li>Click any point to manually set <span className="text-green-600 font-medium">source</span> and <span className="text-red-600 font-medium">destination</span></li>
                  <li><strong>Drag</strong> source and destination points to move them around</li>
                  <li>Try different routing algorithms and network types</li>
                  <li>Use scroll wheel to zoom (desktop) or pinch to zoom (mobile), double-click to reset zoom</li>
                </ol>
                <div className="mt-2 text-xs">
                  <p><span className="text-green-600">●</span> Source point (draggable)</p>
                  <p><span className="text-red-600">●</span> Destination point (draggable)</p>
                  <p><span className="text-orange-500">●</span> Intermediate path points</p>
                </div>
              </div>

              {sourcePoint && (
                <div className="text-sm">
                  <p><span className="text-green-600 font-medium">Source:</span> Point {sourcePoint.id}</p>
                </div>
              )}

              {destinationPoint && (
                <div className="text-sm">
                  <p><span className="text-red-600 font-medium">Destination:</span> Point {destinationPoint.id}</p>
                </div>
              )}

              {sourcePoint && destinationPoint && pathPoints.length > 0 && (
                <div className="text-sm">
                  <p><span className="text-orange-500 font-medium">Path:</span> {pathPoints.length} points</p>
                  <p><span className="text-blue-600 font-medium">Hops:</span> {pathPoints.length - 1}</p>
                  {pathPoints.length > 2 && (
                    <p className="text-xs text-gray-500">
                      Route: {pathPoints.slice(1, -1).map(p => p.id).join(' → ')}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleReset} variant="outline" className="flex-1">
                  Reset Points
                </Button>
                <Button onClick={handleRandomPoints} variant="default" className="flex-1">
                  Random Points
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Info panel */}
      <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg border">
        <div className="text-sm text-gray-600">
          <p><strong>Data:</strong> {data.length} points from {kedroBaseUrl ? `${pipelineId} (Kedro API)` : 'projections.json'}</p>
          <p><strong>Routing Algorithm:</strong> {ROUTING_ALGORITHMS.find(a => a.id === selectedAlgorithm)?.name}</p>
          <p><strong>Network Type:</strong> {NETWORK_TYPES.find(n => n.id === selectedNetworkType)?.name}</p>
          {(selectedNetworkType === "knn" || selectedNetworkType === "delaunay-knn") && <p><strong>K:</strong> {knnK}</p>}
          {selectedNetworkType === "geometric" && <p><strong>Radius:</strong> {geometricRadius.toFixed(3)}</p>}
          <p><strong>Density Radius:</strong> {densityRadius.toFixed(3)}</p>
          <p><strong>Density Cost:</strong> {densityAlpha.toFixed(2)} {densityAlpha > 0 ? "(avoid dense)" : densityAlpha < 0 ? "(prefer dense)" : "(disabled)"}</p>
          {densityMap.size > 0 && (
            <p><strong>Max Density:</strong> {Math.max(...Array.from(densityMap.values()))} neighbors</p>
          )}
          {kedroBaseUrl && <p><strong>Pipeline:</strong> {pipelineId}</p>}
        </div>
      </div>
    </div>
  );
};

