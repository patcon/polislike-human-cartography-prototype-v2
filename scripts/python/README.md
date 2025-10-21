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

Creates water-level clustering data from HDBSCAN hierarchy. This is the main script adapted from `python-test/create_water_level_data_fixed.py`.

**Usage:**

```bash
# Use defaults (reads from python-test/out/, writes to public/)
./create-water-level-data.py

# Custom paths
./create-water-level-data.py --hierarchy-file path/to/hierarchy.json --output-file path/to/output.json

# Custom lambda range and thresholds
./create-water-level-data.py --lambda-min 0.5 --lambda-max 5.0 --n-thresholds 30
```

**Default behavior:**

- Reads from: `python-test/out/hdbscan_hierarchy.json`
- Writes to: `public/projection_labels_by_threshold.json`
- Lambda range: 0.1 to 10.0
- Number of thresholds: 50

### `generate-hdbscan-data.py`

Generates complete HDBSCAN data from scratch using sample data. Creates both point coordinates and clustering labels.

**Usage:**

```bash
# Generate sample data with defaults
uv run generate-hdbscan-data.py

# Custom parameters
uv run generate-hdbscan-data.py --n-samples 1500 --n-centers 7 --output-dir public
```

**Output files:**

- `projections.json` - Point coordinates in `[id, [x, y]]` format
- `projection_labels_by_threshold.json` - Cluster labels at different lambda thresholds

## Data Format

The scripts generate data in the format expected by the MagicPaintExperiment React component:

### `projections.json`

```json
[
  ["0", [-0.5, 0.5]],
  ["1", [0.5, 0.5]],
  ...
]
```

### `projection_labels_by_threshold.json`

```json
{
  "0.10": [0, 0, 1, 1, -1, ...],
  "0.20": [0, 0, 0, 1, -1, ...],
  ...
}
```

Where:

- Keys are lambda threshold values (formatted as strings)
- Values are arrays of cluster labels (-1 for noise, 0+ for cluster IDs)
- Array indices correspond to point IDs in `projections.json`

## Dependencies

- `numpy` - Numerical computations
- `scikit-learn` - Sample data generation
- `hdbscan` - HDBSCAN clustering algorithm

See `pyproject.toml` for complete dependency list.
