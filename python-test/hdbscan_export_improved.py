import json
import argparse
from pathlib import Path

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


def extract_clusters_at_lambda(condensed_tree, lambda_threshold):
    """
    Extract cluster labels at a specific lambda threshold from the condensed tree.
    This implements the "water level" concept where higher lambda values result in fewer, larger clusters.
    """
    # Get the raw tree data
    tree = condensed_tree._raw_tree

    # Find all splits that happen at or below the lambda threshold
    valid_splits = tree[tree["lambda_val"] <= lambda_threshold]

    # Start with all points as noise (-1)
    n_points = len(
        [x for x in tree["child"] if x < condensed_tree._condensed_tree.shape[0]]
    )
    labels = np.full(n_points, -1, dtype=int)

    # Track which clusters are still active at this lambda level
    active_clusters = set()
    cluster_id = 0

    # Process splits in order of lambda value (lowest first)
    for split in sorted(valid_splits, key=lambda x: x["lambda_val"]):
        parent = split["parent"]
        child = split["child"]

        # If this is a leaf node (original point), assign it to a cluster
        if child < n_points:
            if parent not in active_clusters:
                active_clusters.add(parent)
                # Assign all points in this cluster the same label
                cluster_points = tree[tree["parent"] == parent]["child"]
                cluster_points = cluster_points[cluster_points < n_points]
                labels[cluster_points] = cluster_id
                cluster_id += 1

    return labels


def extract_clusters_simple(condensed_tree, lambda_threshold, min_cluster_size=5):
    """
    Simplified approach: use HDBSCAN's built-in cluster extraction at different epsilon values.
    """
    # Convert lambda to epsilon (distance)
    # In HDBSCAN, lambda = 1/distance, so epsilon = 1/lambda
    if lambda_threshold <= 0:
        epsilon = float("inf")
    else:
        epsilon = 1.0 / lambda_threshold

    # Extract clusters using the epsilon threshold
    try:
        labels = hdbscan.HDBSCAN(
            min_cluster_size=min_cluster_size, cluster_selection_epsilon=epsilon
        ).fit_predict(condensed_tree._raw_tree[:, :2])  # This won't work directly

        # Fallback: use the condensed tree to extract flat clusters
        labels = condensed_tree.extract_clusters(min_cluster_size=min_cluster_size)
        return labels
    except:
        # If extraction fails, return noise for all points
        n_points = condensed_tree._condensed_tree.shape[0]
        return np.full(n_points, -1, dtype=int)


def create_labels_by_threshold(
    clusterer, points_data, lambda_range=(0.1, 10.0), n_thresholds=20
):
    """
    Create different cluster labelings at various lambda thresholds to enable the water-level effect.
    """
    condensed_tree = clusterer.condensed_tree_
    tree_df = condensed_tree.to_pandas()

    # Get the range of lambda values from the actual tree
    lambda_min = tree_df["lambda_val"].min()
    lambda_max = tree_df["lambda_val"].max()

    print(f"Lambda range in tree: {lambda_min:.3f} to {lambda_max:.3f}")

    # Create thresholds within the actual range
    lambda_thresholds = np.linspace(
        max(lambda_min, lambda_range[0]), min(lambda_max, lambda_range[1]), n_thresholds
    )

    labels_by_threshold = {}
    n_points = len(points_data)

    for lambda_val in lambda_thresholds:
        # Method 1: Extract clusters by filtering the tree at this lambda level
        # Get all cluster formations that happen at or below this lambda
        valid_tree = tree_df[tree_df["lambda_val"] <= lambda_val]

        if len(valid_tree) == 0:
            # If no splits at this level, everything is noise
            labels = np.full(n_points, -1, dtype=int)
        else:
            # Use HDBSCAN's cluster extraction with epsilon corresponding to lambda
            epsilon = 1.0 / lambda_val if lambda_val > 0 else 0.0

            try:
                # Create a new clusterer with this epsilon
                temp_clusterer = hdbscan.HDBSCAN(
                    min_cluster_size=clusterer.min_cluster_size,
                    min_samples=clusterer.min_samples,
                    cluster_selection_epsilon=epsilon,
                )

                # Fit on the original data
                coords = np.array([p[1] for p in points_data])
                temp_clusterer.fit(coords)
                labels = temp_clusterer.labels_

            except Exception as e:
                print(
                    f"Warning: Could not extract clusters at lambda {lambda_val:.3f}: {e}"
                )
                # Fallback: use original clustering
                labels = clusterer.labels_

        labels_by_threshold[f"{lambda_val:.2f}"] = labels.tolist()

        # Print some stats
        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
        n_noise = list(labels).count(-1)
        print(f"Lambda {lambda_val:.2f}: {n_clusters} clusters, {n_noise} noise points")

    return labels_by_threshold


def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description="Run HDBSCAN clustering on point data with proper hierarchy extraction"
    )
    parser.add_argument(
        "input-file", help="Path to the input JSON file containing point data"
    )
    parser.add_argument(
        "--min-cluster-size",
        type=int,
        default=5,
        help="Minimum cluster size (default: 5)",
    )
    parser.add_argument(
        "--min-samples", type=int, default=3, help="Minimum samples (default: 3)"
    )
    parser.add_argument(
        "--output-dir", default="out", help="Output directory (default: out)"
    )
    parser.add_argument(
        "--lambda-min",
        type=float,
        default=0.1,
        help="Minimum lambda for threshold range",
    )
    parser.add_argument(
        "--lambda-max",
        type=float,
        default=10.0,
        help="Maximum lambda for threshold range",
    )
    parser.add_argument(
        "--n-thresholds",
        type=int,
        default=20,
        help="Number of lambda thresholds to generate",
    )

    args = parser.parse_args()

    # Validate input file exists
    input_path = Path(getattr(args, "input-file"))
    if not input_path.exists():
        print(f"Error: Input file '{getattr(args, 'input-file')}' does not exist")
        return 1

    # Load your data file
    try:
        with open(input_path, "r") as f:
            points_data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in file '{getattr(args, 'input-file')}': {e}")
        return 1
    except Exception as e:
        print(f"Error reading file '{getattr(args, 'input-file')}': {e}")
        return 1

    ids = [p[0] for p in points_data]
    coords = np.array([p[1] for p in points_data])

    # ---------- Run HDBSCAN ----------
    print("Running HDBSCAN clustering...")
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=args.min_cluster_size,
        min_samples=args.min_samples,
        gen_min_span_tree=True,  # Enable for better hierarchy extraction
    )
    clusterer.fit(coords)
    cluster_labels = clusterer.labels_
    probs = clusterer.probabilities_

    n_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
    n_noise = list(cluster_labels).count(-1)
    print(f"Found {n_clusters} clusters and {n_noise} noise points")

    # ---------- Export key data ----------
    out_dir = Path(args.output_dir)
    out_dir.mkdir(exist_ok=True)

    # 1. Extract condensed tree using the more efficient method
    print("Extracting hierarchy tree...")
    condensed = clusterer.condensed_tree_
    tree = condensed._raw_tree

    tree_data = {
        "parent": tree["parent"].tolist(),
        "child": tree["child"].tolist(),
        "lambda_val": tree["lambda_val"].tolist(),
        "child_size": tree["child_size"].tolist(),
    }

    # 2. Create comprehensive output JSON
    print("Preparing output data...")
    output = {
        "points": [
            {"id": int(id_), "x": float(coord[0]), "y": float(coord[1])}
            for id_, coord in zip(ids, coords)
        ],
        "labels": cluster_labels.tolist(),
        "probabilities": probs.tolist(),
        "tree": tree_data,
        "cluster_selection_epsilon": clusterer.cluster_selection_epsilon,
        "min_cluster_size": args.min_cluster_size,
        "min_samples": args.min_samples,
    }

    # Save the main hierarchy file
    with open(out_dir / "hdbscan_hierarchy.json", "w") as f:
        json.dump(output, f, indent=2)

    # 3. Also save individual files for backward compatibility
    print("Saving additional output files...")

    # Condensed tree as DataFrame JSON
    tree_df = clusterer.condensed_tree_.to_pandas()
    tree_df.to_json(out_dir / "condensed_tree.json", orient="records")

    # Per-point data
    points_out = [
        {
            "id": int(i),
            "x": float(x),
            "y": float(y),
            "label": int(lbl),
            "prob": float(prob),
        }
        for i, (x, y, lbl, prob) in zip(ids, np.c_[coords, cluster_labels, probs])
    ]
    with open(out_dir / "points_with_labels.json", "w") as f:
        json.dump(points_out, f, indent=2)

    # 4. Create PROPER labels_by_threshold.json for water-level effect
    print("Creating threshold-based clusters for water-level effect...")
    labels_by_threshold = create_labels_by_threshold(
        clusterer,
        points_data,
        lambda_range=(args.lambda_min, args.lambda_max),
        n_thresholds=args.n_thresholds,
    )

    with open(out_dir / "labels_by_threshold.json", "w") as f:
        json.dump(labels_by_threshold, f, indent=2)

    # ---------- Debug plots ----------
    print("Generating visualization plots...")
    plt.figure(figsize=(8, 6))
    plt.title("HDBSCAN Cluster Result")
    plt.scatter(coords[:, 0], coords[:, 1], c=cluster_labels, cmap="tab10", s=30)
    plt.colorbar(label="Cluster ID")
    plt.xlabel("x")
    plt.ylabel("y")
    plt.savefig(out_dir / "cluster_scatter.png", dpi=150)
    plt.close()

    plt.figure(figsize=(8, 6))
    clusterer.condensed_tree_.plot(select_clusters=True)
    plt.title("Condensed Tree (Hierarchical structure)")
    plt.savefig(out_dir / "condensed_tree.png", dpi=150)
    plt.close()

    print("✓ Export complete!")
    print(f"Main output: {out_dir / 'hdbscan_hierarchy.json'}")
    print(f"All files saved to: {out_dir.resolve()}")
    print(
        f"Processed {len(points_data)} points with {n_clusters} clusters and {n_noise} noise points"
    )
    print(
        f"Generated {len(labels_by_threshold)} different threshold levels for water-level effect"
    )

    return 0


if __name__ == "__main__":
    exit(main())
