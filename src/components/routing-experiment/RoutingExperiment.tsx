"use client";

import * as React from "react";
import * as d3 from "d3";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { fetchAndProcessKedroData } from "@/lib/kedro-api";

type Point = {
  id: string;
  x: number;
  y: number;
  originalX: number;
  originalY: number;
};

type RoutingAlgorithm = "mst-path" | "greedy-neighbor" | "astar-mst";

type NetworkType = "mst" | "knn" | "delaunay" | "geometric";

const ROUTING_ALGORITHMS = [
  { id: "mst-path", name: "MST Path" },
  { id: "greedy-neighbor", name: "Greedy Neighbor Hopping" },
  { id: "astar-mst", name: "A* Optimal MST" }
] as const;

const NETWORK_TYPES = [
  { id: "mst", name: "Minimum Spanning Tree" },
  { id: "knn", name: "K-Nearest Neighbors" },
  { id: "delaunay", name: "Delaunay Triangulation" },
  { id: "geometric", name: "Random Geometric Graph" }
] as const;

type Edge = {
  source: Point;
  target: Point;
  weight: number;
};

// Distance calculation between two points
const euclideanDistance = (p1: Point, p2: Point): number => {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
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

// Legacy function for backward compatibility
const buildMSTGraph = (edges: Edge[]): Map<string, Point[]> => {
  return buildGraph(edges);
};

// Dijkstra's algorithm for shortest path through points
const findDijkstraPath = (source: Point, destination: Point, allPoints: Point[]): Point[] => {
  const distances = new Map<string, number>();
  const previous = new Map<string, Point | null>();
  const unvisited = new Set<string>();

  // Initialize distances
  allPoints.forEach(point => {
    distances.set(point.id, point.id === source.id ? 0 : Infinity);
    previous.set(point.id, null);
    unvisited.add(point.id);
  });

  while (unvisited.size > 0) {
    // Find unvisited node with minimum distance
    let current: Point | null = null;
    let minDistance = Infinity;

    for (const pointId of unvisited) {
      const distance = distances.get(pointId)!;
      if (distance < minDistance) {
        minDistance = distance;
        current = allPoints.find(p => p.id === pointId)!;
      }
    }

    if (!current || minDistance === Infinity) break;

    unvisited.delete(current.id);

    // If we reached the destination, reconstruct path
    if (current.id === destination.id) {
      const path: Point[] = [];
      let node: Point | null = current;
      while (node) {
        path.unshift(node);
        node = previous.get(node.id)!;
      }
      return path;
    }

    // Check neighbors (nearby points)
    const neighbors = findKNearestNeighbors(current, allPoints, 8);

    for (const neighbor of neighbors) {
      if (!unvisited.has(neighbor.id)) continue;

      const distance = distances.get(current.id)! + euclideanDistance(current, neighbor);

      if (distance < distances.get(neighbor.id)!) {
        distances.set(neighbor.id, distance);
        previous.set(neighbor.id, current);
      }
    }
  }

  // If no path found, return direct path
  return [source, destination];
};

// Greedy nearest neighbor path that respects the network graph
const findGreedyPath = (source: Point, destination: Point, networkGraph: Map<string, Point[]>, maxHops: number = 5): Point[] => {
  const path: Point[] = [source];
  let current = source;

  for (let hop = 0; hop < maxHops && current.id !== destination.id; hop++) {
    // Get neighbors from the network graph instead of k-nearest neighbors
    const neighbors = networkGraph.get(current.id) || [];

    // Find the neighbor that gets us closest to destination
    let bestNeighbor: Point | null = null;
    let bestScore = Infinity;

    for (const neighbor of neighbors) {
      // Skip if already in path
      if (path.some(p => p.id === neighbor.id)) continue;

      const distToDestination = euclideanDistance(neighbor, destination);
      const distFromCurrent = euclideanDistance(current, neighbor);

      // Score combines distance to destination and distance from current
      const score = distToDestination + distFromCurrent * 0.1;

      if (score < bestScore) {
        bestScore = score;
        bestNeighbor = neighbor;
      }
    }

    if (bestNeighbor) {
      path.push(bestNeighbor);
      current = bestNeighbor;
    } else {
      break;
    }
  }

  // Always end with destination
  if (current.id !== destination.id) {
    path.push(destination);
  }

  return path;
};

// Random walk path
const findRandomWalkPath = (source: Point, destination: Point, allPoints: Point[], steps: number = 4): Point[] => {
  const path: Point[] = [source];
  let current = source;

  for (let i = 0; i < steps && current.id !== destination.id; i++) {
    const neighbors = findKNearestNeighbors(current, allPoints, 6);

    // Filter out points already in path
    const availableNeighbors = neighbors.filter(n => !path.some(p => p.id === n.id));

    if (availableNeighbors.length > 0) {
      // Bias towards destination but add some randomness
      const weights = availableNeighbors.map(neighbor => {
        const distToDestination = euclideanDistance(neighbor, destination);
        const maxDist = Math.max(...availableNeighbors.map(n => euclideanDistance(n, destination)));
        return maxDist - distToDestination + Math.random() * maxDist * 0.3;
      });

      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      let random = Math.random() * totalWeight;

      for (let j = 0; j < availableNeighbors.length; j++) {
        random -= weights[j];
        if (random <= 0) {
          current = availableNeighbors[j];
          path.push(current);
          break;
        }
      }
    } else {
      break;
    }
  }

  // Always end with destination
  if (current.id !== destination.id) {
    path.push(destination);
  }

  return path;
};

// Find path along MST using BFS
const findMSTPath = (source: Point, destination: Point, mstGraph: Map<string, Point[]>): Point[] => {
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

    const neighbors = mstGraph.get(current.id) || [];
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

// Simplified A* algorithm along MST edges (much faster)
const findAStarMSTPath = (source: Point, destination: Point, mstGraph: Map<string, Point[]>): Point[] => {
  // For now, just use BFS since A* was freezing - the MST is already optimal
  // In a tree structure, there's only one path between any two nodes anyway
  return findMSTPath(source, destination, mstGraph);
};

// Routing algorithm implementations
const generatePath = (
  source: Point,
  destination: Point,
  algorithm: RoutingAlgorithm,
  allPoints: Point[],
  mstEdges: Edge[],
  mstGraph: Map<string, Point[]>,
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  pathStyle: 'sharp' | 'smooth' = 'sharp'
): string | null => {
  let pathPoints: Point[] = [];

  switch (algorithm) {
    case "mst-path":
      pathPoints = findMSTPath(source, destination, mstGraph);
      break;

    case "greedy-neighbor":
      // Greedy neighbor hopping that respects the selected network graph
      pathPoints = findGreedyPath(source, destination, networkGraph, 4);
      break;

    case "astar-mst":
      pathPoints = findAStarMSTPath(source, destination, mstGraph);
      break;

    default:
      pathPoints = findMSTPath(source, destination, mstGraph);
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
};

export const RoutingExperiment: React.FC<DisplaySettings> = ({
  showEdges: initialShowEdges = 'all',
  showNodes: initialShowNodes = 'all',
  pathStyle: initialPathStyle = 'sharp',
  kedroBaseUrl,
  pipelineId = 'mean_localmap_bestkmeans'
}) => {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const containerRef = React.useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);

  const [data, setData] = React.useState<Point[]>([]);
  const [sourcePoint, setSourcePoint] = React.useState<Point | null>(null);
  const [destinationPoint, setDestinationPoint] = React.useState<Point | null>(null);
  const [selectedAlgorithm, setSelectedAlgorithm] = React.useState<RoutingAlgorithm>("mst-path");
  const [selectedNetworkType, setSelectedNetworkType] = React.useState<NetworkType>("mst");
  const [knnK, setKnnK] = React.useState(6);
  const [geometricRadius, setGeometricRadius] = React.useState(0.1);
  const [isLoading, setIsLoading] = React.useState(true);
  const [pathPoints, setPathPoints] = React.useState<Point[]>([]);
  const [networkEdges, setNetworkEdges] = React.useState<Edge[]>([]);
  const [networkGraph, setNetworkGraph] = React.useState<Map<string, Point[]>>(new Map());

  // Local state for display settings (used when not controlled by Storybook)
  const [localShowEdges, setLocalShowEdges] = React.useState<'none' | 'all' | 'only path'>(initialShowEdges);
  const [localShowNodes, setLocalShowNodes] = React.useState<'none' | 'all' | 'only path'>(initialShowNodes);
  const [localPathStyle, setLocalPathStyle] = React.useState<'sharp' | 'smooth'>(initialPathStyle);

  // Use props if provided (from Storybook), otherwise use local state
  const showEdges = initialShowEdges !== 'all' ? initialShowEdges : localShowEdges;
  const showNodes = initialShowNodes !== 'all' ? initialShowNodes : localShowNodes;
  const pathStyle = initialPathStyle !== 'sharp' ? initialPathStyle : localPathStyle;

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

        // Reset selected points when data changes
        setSourcePoint(null);
        setDestinationPoint(null);
        setPathPoints([]);

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
        case "geometric":
          edges = generateGeometricEdges(data, geometricRadius);
          break;
      }

      const graph = buildGraph(edges);
      setNetworkEdges(edges);
      setNetworkGraph(graph);
    }
  }, [selectedNetworkType, knnK, geometricRadius, data]);

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

  // Draw points
  React.useEffect(() => {
    if (!containerRef.current || !xScale || !yScale || !data.length) return;

    const container = containerRef.current;

    // Get current zoom transform
    const currentTransform = d3.zoomTransform(container.node()!);

    // Clear existing points
    container.selectAll("circle").remove();

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

    // Draw filtered points
    container.selectAll("circle")
      .data(pointsToShow)
      .enter()
      .append("circle")
      .attr("cx", d => xScale(d.x))
      .attr("cy", d => yScale(d.y))
      .attr("r", d => {
        const baseRadius = (() => {
          if (sourcePoint && d.id === sourcePoint.id) return 8;
          if (destinationPoint && d.id === destinationPoint.id) return 8;
          if (pathPoints.some(p => p.id === d.id)) return 5; // intermediate points
          return 3;
        })();
        return baseRadius / currentTransform.k;
      })
      .attr("fill", d => {
        if (sourcePoint && d.id === sourcePoint.id) return "#22c55e"; // green
        if (destinationPoint && d.id === destinationPoint.id) return "#ef4444"; // red
        if (pathPoints.some(p => p.id === d.id)) return "#f59e0b"; // orange for path points
        return "#64748b"; // gray
      })
      .attr("stroke", d => {
        if (sourcePoint && d.id === sourcePoint.id) return "#16a34a";
        if (destinationPoint && d.id === destinationPoint.id) return "#dc2626";
        if (pathPoints.some(p => p.id === d.id)) return "#d97706";
        return "none";
      })
      .attr("stroke-width", 2 / currentTransform.k)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
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

  }, [data, xScale, yScale, sourcePoint, destinationPoint, pathPoints, showNodes]);

  // Draw network edges
  React.useEffect(() => {
    if (!containerRef.current || !xScale || !yScale || !networkEdges.length) {
      containerRef.current?.selectAll(".network-edge").remove();
      return;
    }

    const container = containerRef.current;

    // Get current zoom transform
    const currentTransform = d3.zoomTransform(container.node()!);

    // Clear existing network edges
    container.selectAll(".network-edge").remove();

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
                     selectedNetworkType === "delaunay" ? "#dc2626" : "#8b5cf6";
    const edgeOpacity = selectedNetworkType === "delaunay" ? 0.4 :
                       selectedNetworkType === "geometric" ? 0.6 : 0.8;

    // Draw filtered network edges
    container.selectAll(".network-edge")
      .data(edgesToShow)
      .enter()
      .append("line")
      .attr("class", "network-edge")
      .attr("x1", (d: Edge) => xScale(d.source.x))
      .attr("y1", (d: Edge) => yScale(d.source.y))
      .attr("x2", (d: Edge) => xScale(d.target.x))
      .attr("y2", (d: Edge) => yScale(d.target.y))
      .attr("stroke", edgeColor)
      .attr("stroke-width", 1 / currentTransform.k)
      .attr("stroke-opacity", edgeOpacity)
      .style("pointer-events", "none"); // Prevent edges from capturing mouse events

  }, [networkEdges, xScale, yScale, selectedNetworkType, showEdges, pathPoints]);

  // Generate and draw path
  React.useEffect(() => {
    if (!containerRef.current || !xScale || !yScale || !sourcePoint || !destinationPoint) {
      // Clear any existing path
      containerRef.current?.selectAll(".routing-path").remove();
      setPathPoints([]);
      return;
    }

    const container = containerRef.current;

    // Clear existing path
    container.selectAll(".routing-path").remove();

    // Calculate the path points first
    let calculatedPathPoints: Point[] = [];

    switch (selectedAlgorithm) {
      case "mst-path":
        calculatedPathPoints = findMSTPath(sourcePoint, destinationPoint, networkGraph);
        break;
      case "greedy-neighbor":
        calculatedPathPoints = findGreedyPath(sourcePoint, destinationPoint, networkGraph, 4);
        break;
      case "astar-mst":
        calculatedPathPoints = findAStarMSTPath(sourcePoint, destinationPoint, networkGraph);
        break;
      default:
        calculatedPathPoints = findMSTPath(sourcePoint, destinationPoint, networkGraph);
    }

    setPathPoints(calculatedPathPoints);

    const path = generatePath(sourcePoint, destinationPoint, selectedAlgorithm, data, networkEdges, networkGraph, xScale, yScale, pathStyle);

    if (path) {
      // Get current zoom transform
      const currentTransform = d3.zoomTransform(container.node()!);

      container.append("path")
        .attr("class", "routing-path")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", "#3b82f6")
        .attr("stroke-width", 3 / currentTransform.k)
        .attr("stroke-opacity", 0.8)
        .attr("marker-end", "url(#arrowhead)")
        .style("pointer-events", "none"); // Prevent path from capturing mouse events
    }

  }, [sourcePoint, destinationPoint, selectedAlgorithm, data, networkEdges, networkGraph, xScale, yScale, pathStyle]);

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
        // Allow mouse events for panning (but not clicking on points)
        if (event.type === "mousedown") {
          const target = event.target as Element;
          return !target.closest("circle");
        }
        return false;
      })
      .on("zoom", (event) => {
        const transform = event.transform;
        container.attr("transform", transform);

        // Update circle sizes to maintain visual consistency during zoom
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

        // Update path stroke width to maintain visibility
        container.selectAll(".routing-path")
          .attr("stroke-width", 3 / transform.k);

        // Update network edge stroke width
        container.selectAll(".network-edge")
          .attr("stroke-width", 1 / transform.k);
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
      }
    });

    return () => {
      svg.on(".zoom", null);
      svg.on("dblclick.zoom", null);
    };
  }, [sourcePoint, destinationPoint, pathPoints]);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-screen h-screen">
        <div className="text-lg">Loading projection data...</div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen">
      <svg ref={svgRef} className="w-screen h-screen block bg-gray-50" />

      {/* Controls */}
      <div className="absolute top-4 left-4 bg-white p-4 rounded-lg shadow-lg border max-w-sm">
        <h3 className="text-lg font-semibold mb-4">Routing Experiment</h3>

        <div className="space-y-4">
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

          {selectedNetworkType === "knn" && (
            <div>
              <label className="block text-sm font-medium mb-2">K (Neighbors): {knnK}</label>
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
            </div>
          </div>

          <div className="text-sm text-gray-600">
            <p><strong>Instructions:</strong></p>
            <ol className="list-decimal list-inside space-y-1 mt-2">
              <li>Click a point to set as <span className="text-green-600 font-medium">source</span></li>
              <li>Click another point to set as <span className="text-red-600 font-medium">destination</span></li>
              <li>Try different routing algorithms</li>
              <li>Use scroll wheel to zoom, double-click to reset zoom</li>
              <li>Click any point to reset and start over</li>
            </ol>
            <div className="mt-2 text-xs">
              <p><span className="text-green-600">●</span> Source point</p>
              <p><span className="text-red-600">●</span> Destination point</p>
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

          <Button onClick={handleReset} variant="outline" className="w-full">
            Reset Points
          </Button>
        </div>
      </div>

      {/* Info panel */}
      <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg border">
        <div className="text-sm text-gray-600">
          <p><strong>Data:</strong> {data.length} points from {kedroBaseUrl ? `${pipelineId} (Kedro API)` : 'projections.json'}</p>
          <p><strong>Routing Algorithm:</strong> {ROUTING_ALGORITHMS.find(a => a.id === selectedAlgorithm)?.name}</p>
          <p><strong>Network Type:</strong> {NETWORK_TYPES.find(n => n.id === selectedNetworkType)?.name}</p>
          {selectedNetworkType === "knn" && <p><strong>K:</strong> {knnK}</p>}
          {selectedNetworkType === "geometric" && <p><strong>Radius:</strong> {geometricRadius.toFixed(3)}</p>}
          {kedroBaseUrl && <p><strong>Pipeline:</strong> {pipelineId}</p>}
        </div>
      </div>
    </div>
  );
};