import json
import numpy as np
from pathlib import Path


def main():
    # Load the original points
    with open("points.json", "r") as f:
        points_data = json.load(f)

    coords = np.array([p[1] for p in points_data])

    # Import hdbscan
    try:
        import hdbscan
    except ImportError:
        print("hdbscan not available")
        return 1

    # Create different clusterings by varying parameters
    # This simulates the water-level effect by creating different granularities
    lambda_thresholds = np.linspace(0.1, 10.0, 20)
    labels_by_threshold = {}

    print("Creating water-level effect by varying cluster parameters...")

    for i, lambda_val in enumerate(lambda_thresholds):
        # Use lambda value to determine clustering parameters
        # Higher lambda = fewer, larger clusters (like raising water level)
        min_cluster_size = max(
            3, int(5 + lambda_val * 2)
        )  # Increase min cluster size with lambda
        min_samples = max(
            1, int(2 + lambda_val * 0.5)
        )  # Increase min samples with lambda

        # Create clusterer with these parameters
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=min_cluster_size,
            min_samples=min_samples,
            cluster_selection_epsilon=0.0,  # Let HDBSCAN choose
        )

        # Fit and get labels
        labels = clusterer.fit_predict(coords)

        # Count clusters and noise
        unique_labels = set(labels)
        n_clusters = len(unique_labels) - (1 if -1 in unique_labels else 0)
        n_noise = list(labels).count(-1)

        labels_by_threshold[f"{lambda_val:.2f}"] = labels.tolist()
        print(
            f"Lambda {lambda_val:.2f}: {n_clusters} clusters, {n_noise} noise points (min_size={min_cluster_size})"
        )

    # Save the results
    output_dir = Path("out")
    output_dir.mkdir(exist_ok=True)

    with open(output_dir / "labels_by_threshold.json", "w") as f:
        json.dump(labels_by_threshold, f, indent=2)

    print(
        f"✓ Water-level clustering data saved to {output_dir / 'labels_by_threshold.json'}"
    )
    print("Now your HTML slider should show different cluster configurations!")

    return 0


if __name__ == "__main__":
    exit(main())
