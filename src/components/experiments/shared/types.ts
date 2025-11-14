import * as d3 from "d3";

export type Point = {
  id: string;
  x: number;
  y: number;
  label?: number;
};

export type LabelsByThreshold = {
  [threshold: string]: number[];
};

export interface ClusterGroup {
  clusterId: number;
  count: number;
  percentage: number;
}

export interface ClusterProportions {
  clustered: number;
  unclustered: number;
  clusteredCount: number;
  unclusteredCount: number;
  clusterGroups: ClusterGroup[];
  selectedClusterId: number | null;
}

export interface MapCallbacks {
  onPointClick: (pointId: string, pointIndex: number) => void;
  onBackgroundClick: () => void;
}

export interface MapRenderContext {
  container: d3.Selection<SVGGElement, unknown, null, undefined>;
  xScale: d3.ScaleLinear<number, number>;
  yScale: d3.ScaleLinear<number, number>;
  points: Point[];
  labels: number[];
  selectedPoints: Set<string>;
  currentTransform: d3.ZoomTransform;
  color: d3.ScaleOrdinal<string, string>;
}

export interface MapVisualizationProps {
  points: Point[];
  labelsByThreshold: LabelsByThreshold;
  currentLambda: number;
  selectedPoints: Set<string>;
  displayGroupColors: boolean;
  callbacks: MapCallbacks;
  onRenderBelowPoints?: (context: MapRenderContext) => void;
  onRenderAbovePoints?: (context: MapRenderContext) => void;
}