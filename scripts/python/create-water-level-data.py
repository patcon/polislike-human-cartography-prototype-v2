#!/usr/bin/env python3
"""
Complete HDBSCAN clustering and water-level data generation script.

This script combines two steps:
1. Run HDBSCAN clustering on input point data
2. Generate water-level clustering data from the HDBSCAN hierarchy

This creates proper water-level clustering data for the MagicPaintExperiment component.
It extracts different cluster configurations at various lambda thresholds.

Combined from python-test/hdbscan_export.py and python-test/create_water_level_data_fixed.py
"""

import json
import numpy as np
from pathlib import Path
import argparse

print("Loading scientific libraries (this may take a moment)...")

try:
    print("  - Loading numpy...")
    import numpy as np

    print("  - Loading pandas...")
    import pandas as pd

    print("  - Loading matplotlib...")
    import matplotlib.pyplot as plt

    print("  - Loading hdbscan (this is the slowest)...")
    import hdbscan

    print("All libraries loaded successfully!")
except ImportError as e:
    print(f"Error importing required library: {e}")
    print("Make sure all dependencies are installed with: uv sync")
    exit(1)


def run_hdbscan_clustering(points_data, min_cluster_size=5, min_samples=3):
    """
    Run HDBSCAN clustering on point data and return the clusterer and processed data.

    Args:
        points_data: List of [id, [x, y]] pairs
        min_cluster_size: Minimum cluster size for HDBSCAN
        min_samples: Minimum samples for HDBSCAN

    Returns:
        dict: Contains clusterer, ids, coords, labels, probabilities
    """
    ids = [p[0] for p in points_data]
    coords = np.array([p[1] for p in points_data])

    print("Running HDBSCAN clustering...")
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        gen_min_span_tree=True,  # Enable for better hierarchy extraction
    )
    clusterer.fit(coords)
    cluster_labels = clusterer.labels_
    probs = clusterer.probabilities_

    n_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
    n_noise = list(cluster_labels).count(-1)
    print(f"Found {n_clusters} clusters and {n_noise} noise points")

    return {
        "clusterer": clusterer,
        "ids": ids,
        "coords": coords,
        "labels": cluster_labels,
        "probabilities": probs,
        "n_clusters": n_clusters,
        "n_noise": n_noise,
    }


def extract_hierarchy_data(
    clusterer, ids, coords, cluster_labels, probs, min_cluster_size, min_samples
):
    """
    Extract hierarchy data from HDBSCAN clusterer.

    Returns:
        dict: Hierarchy data structure compatible with water-level processing
    """
    print("Extracting hierarchy tree...")
    condensed = clusterer.condensed_tree_
    tree = condensed._raw_tree

    tree_data = {
        "parent": tree["parent"].tolist(),
        "child": tree["child"].tolist(),
        "lambda_val": tree["lambda_val"].tolist(),
        "child_size": tree["child_size"].tolist(),
    }

    # Create comprehensive hierarchy data structure
    hierarchy_data = {
        "points": [
            {"id": int(id_), "x": float(coord[0]), "y": float(coord[1])}
            for id_, coord in zip(ids, coords)
        ],
        "labels": cluster_labels.tolist(),
        "probabilities": probs.tolist(),
        "tree": tree_data,
        "cluster_selection_epsilon": clusterer.cluster_selection_epsilon,
        "min_cluster_size": min_cluster_size,
        "min_samples": min_samples,
    }

    return hierarchy_data


def create_water_level_clusters(
    hierarchy_data, lambda_range=(0.1, 10.0), n_thresholds=50
):
    """
    Create proper water-level clustering data from HDBSCAN hierarchy.
    This extracts different cluster configurations at various lambda thresholds.
    """
    tree = hierarchy_data["tree"]
    points = hierarchy_data["points"]
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


def save_visualization_plots(coords, cluster_labels, clusterer, output_dir):
    """Save visualization plots for debugging."""
    print("Generating visualization plots...")

    # Cluster scatter plot
    plt.figure(figsize=(8, 6))
    plt.title("HDBSCAN Cluster Result")
    plt.scatter(coords[:, 0], coords[:, 1], c=cluster_labels, cmap="tab10", s=30)
    plt.colorbar(label="Cluster ID")
    plt.xlabel("x")
    plt.ylabel("y")
    plt.savefig(output_dir / "cluster_scatter.png", dpi=150)
    plt.close()

    # Condensed tree plot
    plt.figure(figsize=(8, 6))
    clusterer.condensed_tree_.plot(select_clusters=True)
    plt.title("Condensed Tree (Hierarchical structure)")
    plt.savefig(output_dir / "condensed_tree.png", dpi=150)
    plt.close()


def main():
    parser = argparse.ArgumentParser(
        description="Run HDBSCAN clustering and create water-level clustering data"
    )
    parser.add_argument(
        "input_file",
        help="Path to the input JSON file containing point data (format: [[id, [x, y]], ...])",
    )
    parser.add_argument(
        "--min-cluster-size",
        type=int,
        default=5,
        help="Minimum cluster size for HDBSCAN (default: 5)",
    )
    parser.add_argument(
        "--min-samples",
        type=int,
        default=3,
        help="Minimum samples for HDBSCAN (default: 3)",
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
        help="Minimum lambda value for water-level (default: 0.1)",
    )
    parser.add_argument(
        "--lambda-max",
        type=float,
        default=10.0,
        help="Maximum lambda value for water-level (default: 10.0)",
    )
    parser.add_argument(
        "--n-thresholds",
        type=int,
        default=50,
        help="Number of lambda thresholds for water-level (default: 50)",
    )
    parser.add_argument(
        "--save-hierarchy",
        action="store_true",
        help="Save intermediate hierarchy data file",
    )
    parser.add_argument(
        "--save-points",
        action="store_true",
        help="Save points with labels file",
    )
    parser.add_argument(
        "--save-plots",
        action="store_true",
        help="Save visualization plots",
    )

    args = parser.parse_args()

    # Validate input file exists
    input_path = Path(args.input_file)
    if not input_path.exists():
        print(f"Error: Input file '{args.input_file}' does not exist")
        return 1

    # Load input data
    try:
        with open(input_path, "r") as f:
            points_data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in file '{args.input_file}': {e}")
        return 1
    except Exception as e:
        print(f"Error reading file '{args.input_file}': {e}")
        return 1

    print(f"Loaded {len(points_data)} points from {input_path}")

    # Step 1: Run HDBSCAN clustering
    clustering_result = run_hdbscan_clustering(
        points_data,
        min_cluster_size=args.min_cluster_size,
        min_samples=args.min_samples,
    )

    # Step 2: Extract hierarchy data
    hierarchy_data = extract_hierarchy_data(
        clustering_result["clusterer"],
        clustering_result["ids"],
        clustering_result["coords"],
        clustering_result["labels"],
        clustering_result["probabilities"],
        args.min_cluster_size,
        args.min_samples,
    )

    # Step 3: Create water-level clusters
    print("\n" + "=" * 50)
    print("CREATING WATER-LEVEL DATA")
    print("=" * 50)

    labels_by_threshold = create_water_level_clusters(
        hierarchy_data,
        lambda_range=(args.lambda_min, args.lambda_max),
        n_thresholds=args.n_thresholds,
    )

    # Step 4: Save main output
    output_file = Path(args.output_file)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w") as f:
        json.dump(labels_by_threshold, f, indent=2)

    print(f"✓ Water-level data saved to {output_file}")

    # Step 5: Save optional intermediate files if requested
    output_dir = output_file.parent

    if args.save_hierarchy:
        hierarchy_file = output_dir / "hdbscan_hierarchy.json"
        with open(hierarchy_file, "w") as f:
            json.dump(hierarchy_data, f, indent=2)
        print(f"✓ Hierarchy data saved to {hierarchy_file}")

    if args.save_points:
        points_out = [
            {
                "id": int(i),
                "x": float(x),
                "y": float(y),
                "label": int(lbl),
                "prob": float(prob),
            }
            for i, (x, y, lbl, prob) in zip(
                clustering_result["ids"],
                np.c_[
                    clustering_result["coords"],
                    clustering_result["labels"],
                    clustering_result["probabilities"],
                ],
            )
        ]
        points_file = output_dir / "points_with_labels.json"
        with open(points_file, "w") as f:
            json.dump(points_out, f, indent=2)
        print(f"✓ Points with labels saved to {points_file}")

    if args.save_plots:
        save_visualization_plots(
            clustering_result["coords"],
            clustering_result["labels"],
            clustering_result["clusterer"],
            output_dir,
        )
        print(f"✓ Visualization plots saved to {output_dir}")

    print(
        f"🎯 Complete! Processed {len(points_data)} points with {clustering_result['n_clusters']} clusters and {clustering_result['n_noise']} noise points"
    )

    return 0


if __name__ == "__main__":
    exit(main())
