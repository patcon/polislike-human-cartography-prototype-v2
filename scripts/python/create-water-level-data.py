#!/usr/bin/env python3
"""
Create HDBSCAN water level data for the MagicPaintExperiment component.

This script creates proper water-level clustering data from HDBSCAN hierarchy.
It extracts different cluster configurations at various lambda thresholds.

Adapted from python-test/create_water_level_data_fixed.py with defaults
that point to the right files and directories.
"""

import json
import numpy as np
from pathlib import Path
import argparse


def create_water_level_clusters(
    hierarchy_file, output_file, lambda_range=(0.1, 10.0), n_thresholds=50
):
    """
    Create proper water-level clustering data from HDBSCAN hierarchy.
    This extracts different cluster configurations at various lambda thresholds.
    """

    # Load the hierarchy data
    with open(hierarchy_file, "r") as f:
        data = json.load(f)

    tree = data["tree"]
    points = data["points"]
    n_points = len(points)

    # Convert tree data to numpy arrays for easier processing
    parents = np.array(tree["parent"])
    children = np.array(tree["child"])
    lambdas = np.array(tree["lambda_val"])
    child_sizes = np.array(tree["child_size"])

    # Create lambda thresholds
    lambda_min = max(lambdas.min(), lambda_range[0])
    lambda_max = min(lambdas.max(), lambda_range[1])
    lambda_thresholds = np.linspace(lambda_min, lambda_max, n_thresholds)

    print(
        f"Creating water-level data for lambda range {lambda_min:.3f} to {lambda_max:.3f}"
    )

    labels_by_threshold = {}

    for lambda_threshold in lambda_thresholds:
        # Extract clusters at this lambda level
        labels = extract_clusters_at_lambda_fixed(
            parents, children, lambdas, child_sizes, n_points, lambda_threshold
        )

        # Count clusters and noise
        unique_labels = set(labels)
        n_clusters = len(unique_labels) - (1 if -1 in unique_labels else 0)
        n_noise = labels.count(-1)

        labels_by_threshold[f"{lambda_threshold:.2f}"] = labels
        print(
            f"Lambda {lambda_threshold:.2f}: {n_clusters} clusters, {n_noise} noise points"
        )

    # Save the results
    with open(output_file, "w") as f:
        json.dump(labels_by_threshold, f, indent=2)

    print(f"✓ Water-level data saved to {output_file}")
    return labels_by_threshold


def extract_clusters_at_lambda_fixed(
    parents, children, lambdas, child_sizes, n_points, lambda_threshold
):
    """
    Extract cluster labels at a specific lambda threshold - CORRECT WATER LEVEL EFFECT.

    The water-level metaphor:
    - LOW lambda (high water): Most things are submerged (noise = -1), only strong clusters visible
    - HIGH lambda (low water): More clusters emerge as separate islands

    In HDBSCAN: Higher lambda values correspond to splits that happen later (stronger connections).
    At a given lambda threshold, we only consider splits that have lambda >= threshold.
    """

    # Initialize all points as noise (everything underwater initially)
    labels = [-1] * n_points

    # Find splits that happen at or above the lambda threshold
    # These are the "strong" connections that survive at this water level
    strong_splits = lambdas >= lambda_threshold

    if not np.any(strong_splits):
        # No strong splits at this level - everything remains noise
        return labels

    # Get the strong portion of the tree
    strong_parents = parents[strong_splits]
    strong_children = children[strong_splits]
    strong_lambdas = lambdas[strong_splits]

    # Build connected components using Union-Find
    # Points connected through strong splits should be in the same cluster
    parent_map = list(range(n_points))  # Each point is its own parent initially

    def find_root(x):
        if parent_map[x] != x:
            parent_map[x] = find_root(parent_map[x])
        return parent_map[x]

    def union(x, y):
        root_x = find_root(x)
        root_y = find_root(y)
        if root_x != root_y:
            parent_map[root_y] = root_x

    # We need to trace from tree nodes down to actual data points
    # Build a mapping from tree nodes to the data points they contain
    node_descendants = {}

    # Initialize leaf nodes (data points)
    for i in range(n_points):
        node_descendants[i] = [i]

    # Build the descendant mapping by processing all tree edges
    # Sort by lambda in descending order to process stronger connections first
    all_indices = np.argsort(-lambdas)  # Descending order

    for idx in all_indices:
        parent = parents[idx]
        child = children[idx]

        # Ensure parent node exists in mapping
        if parent not in node_descendants:
            node_descendants[parent] = []

        # If child is a data point, add it to parent's descendants
        if child < n_points:
            node_descendants[parent].append(child)
        # If child is an internal node, add all its descendants to parent
        elif child in node_descendants:
            node_descendants[parent].extend(node_descendants[child])

    # Now process only the strong splits to create clusters
    for i, (parent, child) in enumerate(zip(strong_parents, strong_children)):
        # Get all data points that are descendants of this parent and child
        parent_points = node_descendants.get(parent, [])
        child_points = node_descendants.get(child, [])

        # Union all points that are connected through this strong split
        all_connected_points = list(set(parent_points + child_points))
        all_connected_points = [p for p in all_connected_points if p < n_points]

        # Connect all these points
        if len(all_connected_points) > 1:
            for j in range(1, len(all_connected_points)):
                union(all_connected_points[0], all_connected_points[j])

    # Assign cluster IDs based on connected components
    root_to_cluster = {}
    cluster_id = 0

    for point in range(n_points):
        root = find_root(point)
        if root not in root_to_cluster:
            root_to_cluster[root] = cluster_id
            cluster_id += 1
        labels[point] = root_to_cluster[root]

    # Apply minimum cluster size filter
    cluster_counts = {}
    for label in labels:
        cluster_counts[label] = cluster_counts.get(label, 0) + 1

    # Convert small clusters back to noise
    min_cluster_size = 3
    for i in range(len(labels)):
        if cluster_counts[labels[i]] < min_cluster_size:
            labels[i] = -1

    return labels


def main():
    parser = argparse.ArgumentParser(
        description="Create water-level clustering data from HDBSCAN hierarchy"
    )
    parser.add_argument(
        "--hierarchy-file",
        default="python-test/out/hdbscan_hierarchy.json",
        help="Input hierarchy file (default: python-test/out/hdbscan_hierarchy.json)",
    )
    parser.add_argument(
        "--output-file",
        default="public/projection_labels_by_threshold.json",
        help="Output labels file (default: public/projection_labels_by_threshold.json)",
    )
    parser.add_argument(
        "--lambda-min",
        type=float,
        default=0.1,
        help="Minimum lambda value (default: 0.1)",
    )
    parser.add_argument(
        "--lambda-max",
        type=float,
        default=10.0,
        help="Maximum lambda value (default: 10.0)",
    )
    parser.add_argument(
        "--n-thresholds",
        type=int,
        default=50,
        help="Number of lambda thresholds (default: 50)",
    )

    args = parser.parse_args()

    hierarchy_file = Path(args.hierarchy_file)
    output_file = Path(args.output_file)

    # Create output directory if it doesn't exist
    output_file.parent.mkdir(exist_ok=True)

    if not hierarchy_file.exists():
        print(f"Error: {hierarchy_file} not found. Run hdbscan_export.py first.")
        return 1

    try:
        create_water_level_clusters(
            hierarchy_file,
            output_file,
            lambda_range=(args.lambda_min, args.lambda_max),
            n_thresholds=args.n_thresholds,
        )
        print(f"\n🎯 Water-level data ready for MagicPaintExperiment component!")
        return 0
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1


if __name__ == "__main__":
    exit(main())
