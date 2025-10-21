# Python Scripts for HDBSCAN Data Generation

This directory contains Python scripts for generating HDBSCAN clustering data used by the MagicPaintExperiment component.

## Setup

The scripts use `uv` for Python package management. Install dependencies:

```bash
cd scripts/python
uv sync
```

## Scripts

### `create-water-level-data.py`

**Complete HDBSCAN clustering and water-level data generation script.**

This script combines two steps in one process:

1. Run HDBSCAN clustering on input point data
2. Generate water-level clustering data from the HDBSCAN hierarchy

This creates the complete dataset needed by the MagicPaintExperiment component.

**Usage:**

```bash
# Basic usage - only generates the required JSON file
python create-water-level-data.py input_points.json

# With custom HDBSCAN parameters
python create-water-level-data.py input_points.json \
  --min-cluster-size 10 \
  --min-samples 5

# With custom water-level parameters
python create-water-level-data.py input_points.json \
  --lambda-min 0.5 \
  --lambda-max 15.0 \
  --n-thresholds 100

# Custom output location
python create-water-level-data.py input_points.json \
  --output-file custom/output.json

# Save optional intermediate files for debugging
python create-water-level-data.py input_points.json \
  --save-hierarchy \
  --save-points \
  --save-plots
```

**Input format:**

The input file should contain point data in `[[id, [x, y]], ...]` format:

```json
[
  [0, [-0.5, 0.5]],
  [1, [0.5, 0.5]],
  [2, [1.2, -0.3]],
  ...
]
```

**Default behavior:**

- **Input**: Requires input file as first argument
- **Output**: `public/projection_labels_by_threshold.json`
- **HDBSCAN**: min_cluster_size=5, min_samples=3
- **Water-level**: Lambda range 0.1 to 10.0, 50 thresholds
- **Files**: Only generates the required JSON file (no plots or intermediate files)

**Optional flags:**

- `--save-hierarchy`: Save HDBSCAN hierarchy data to `hdbscan_hierarchy.json`
- `--save-points`: Save points with cluster labels and probabilities
- `--save-plots`: Save visualization plots (scatter plot and condensed tree)

**Parameters:**

- `--min-cluster-size`: Minimum cluster size for HDBSCAN (default: 5)
- `--min-samples`: Minimum samples for HDBSCAN (default: 3)
- `--lambda-min`: Minimum lambda value for water-level (default: 0.1)
- `--lambda-max`: Maximum lambda value for water-level (default: 10.0)
- `--n-thresholds`: Number of lambda thresholds (default: 50)

## Data Format

The script generates data in the format expected by the MagicPaintExperiment React component:

### Input: Point Data

```json
[
  [0, [-0.5, 0.5]],
  [1, [0.5, 0.5]],
  [2, [1.2, -0.3]],
  ...
]
```

### Output: `projection_labels_by_threshold.json`

```json
{
  "0.10": [0, 0, 1, 1, -1, ...],
  "0.20": [0, 0, 0, 1, -1, ...],
  "0.31": [0, 1, 2, 3, -1, ...],
  ...
}
```

Where:

- **Keys**: Lambda threshold values (formatted as strings with 2 decimal places)
- **Values**: Arrays of cluster labels (-1 for noise, 0+ for cluster IDs)
- **Array indices**: Correspond to point IDs in the input data
- **Water-level effect**: Lower lambda values (high water) show fewer, stronger clusters; higher lambda values (low water) show more, smaller clusters

## Algorithm Details

**HDBSCAN Clustering:**

- Uses density-based clustering to find clusters of varying densities
- Builds a hierarchy of clusters at different density levels
- Extracts the most stable clusters based on cluster persistence

**Water-Level Processing:**

- Simulates "water level" rising and falling through the cluster hierarchy
- At each lambda threshold, only connections stronger than the threshold survive
- Creates different cluster configurations showing how clusters merge/split
- Provides smooth transitions between clustering granularities for interactive exploration

## Dependencies

- `numpy` - Numerical computations and array operations
- `pandas` - Data manipulation (used by HDBSCAN)
- `matplotlib` - Visualization plots (optional, only when using --save-plots)
- `hdbscan` - HDBSCAN clustering algorithm

See `pyproject.toml` for complete dependency list and versions.

## Example Workflow

1. **Prepare your point data** in the required JSON format
2. **Run the script** with your input file:
   ```bash
   python create-water-level-data.py my_points.json
   ```
3. **Use the output** `public/projection_labels_by_threshold.json` in your MagicPaintExperiment component
4. **Optional**: Add debugging flags to inspect intermediate results:
   ```bash
   python create-water-level-data.py my_points.json --save-plots --save-hierarchy
   ```
