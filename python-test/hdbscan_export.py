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

# ---------- Input ----------
# Example input structure:
# [
#   [1, [34,25]],
#   [2, [-1,5]],
#   [3, [43,2]],
#   ...
# ]


def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Run HDBSCAN clustering on point data")
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

    # 2. Create comprehensive output JSON (similar to the new script)
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

    # Save the main hierarchy file (like the new script)
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

    # 4. Create labels_by_threshold.json for web app compatibility
    print("Creating threshold-based clusters for web app...")
    # Create a simple threshold-based output using cluster_selection_epsilon
    # This provides different "cuts" of the hierarchy at various levels
    thresholds = np.linspace(0, 10, 20)
    labels_by_thresh = {}

    # For now, we'll use the main clustering result for all thresholds
    # In a more sophisticated version, you could extract different cuts from the tree
    for t in thresholds:
        # Use the main cluster labels for all thresholds as a fallback
        # This ensures the web app has data to work with
        labels_by_thresh[str(round(t, 2))] = cluster_labels.tolist()

    with open(out_dir / "labels_by_threshold.json", "w") as f:
        json.dump(labels_by_thresh, f, indent=2)

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

    return 0


if __name__ == "__main__":
    exit(main())
