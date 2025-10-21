import json
import numpy as np
from pathlib import Path


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
        labels = extract_clusters_at_lambda(
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


def extract_clusters_at_lambda(
    parents, children, lambdas, child_sizes, n_points, lambda_threshold
):
    """
    Extract cluster labels at a specific lambda threshold.

    The idea: At a given lambda threshold, we only consider splits that happen
    at or below that lambda value. Points that would be split at higher lambda
    values remain in the same cluster.
    """

    # Initialize all points as noise
    labels = [-1] * n_points

    # Find all tree nodes (splits) that happen at or below the threshold
    valid_splits = lambdas <= lambda_threshold

    # Get the valid portion of the tree
    valid_parents = parents[valid_splits]
    valid_children = children[valid_splits]
    valid_lambdas = lambdas[valid_splits]
    valid_sizes = child_sizes[valid_splits]

    if len(valid_parents) == 0:
        # No splits at this level - everything is noise
        return labels

    # Build a mapping of which points belong to which clusters
    # We'll work backwards from the leaf nodes (original points)

    # Find leaf nodes (original data points)
    leaf_nodes = valid_children[valid_children < n_points]

    if len(leaf_nodes) == 0:
        return labels

    # Group leaf nodes by their parents at this lambda level
    cluster_id = 0
    processed_parents = set()

    # Sort by lambda value to process in order
    sort_indices = np.argsort(valid_lambdas)

    for idx in sort_indices:
        parent = valid_parents[idx]
        child = valid_children[idx]

        if child < n_points:  # This is a leaf node (original point)
            if parent not in processed_parents:
                # Find all children of this parent that are leaf nodes
                siblings = valid_children[valid_parents == parent]
                leaf_siblings = siblings[siblings < n_points]

                # Assign the same cluster ID to all siblings
                for sibling in leaf_siblings:
                    labels[sibling] = cluster_id

                processed_parents.add(parent)
                cluster_id += 1

    return labels


def main():
    hierarchy_file = Path("out/hdbscan_hierarchy.json")
    output_file = Path("out/labels_by_threshold.json")

    if not hierarchy_file.exists():
        print(f"Error: {hierarchy_file} not found. Run hdbscan_export.py first.")
        return 1

    create_water_level_clusters(hierarchy_file, output_file)
    return 0


if __name__ == "__main__":
    exit(main())
