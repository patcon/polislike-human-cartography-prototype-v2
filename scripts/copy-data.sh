#!/bin/bash

# Script to copy Kedro pipeline data files to public directory
# This copies projections.json, statements.json, and votes.parquet
# from the specified Kedro pipeline data directory
#
# Usage: ./copy-data.sh [PIPELINE_NAME[,PIPELINE_NAME2,...]]
# If no pipeline name is provided, defaults to interactive selection
# Supports multiple pipelines (comma-separated), file selection, and optional suffixes
# For multiple pipelines, provide comma-separated suffixes in the same order

# Function to show interactive conversation selection
select_conversation_interactive() {
    local data_dir="$HOME/repos/kedro-polis-pipelines/data"
    local conversations=()
    local count=0

    echo "Available conversations:" >&2

    if [ -d "$data_dir" ]; then
        for conv_dir in "$data_dir"/*; do
            if [ -d "$conv_dir" ]; then
                local conv_name=$(basename "$conv_dir")
                # Check if directory name starts with a number
                if [[ "$conv_name" =~ ^[0-9] ]]; then
                    # Check if this conversation has any valid pipelines
                    local has_pipelines=false
                    for pipeline in "$conv_dir"/*; do
                        if [ -d "$pipeline" ]; then
                            local primary_dir="$pipeline/03_primary"
                            local projections_file="$primary_dir/projections.json"
                            if [ -d "$primary_dir" ] && [ -f "$projections_file" ]; then
                                has_pipelines=true
                                break
                            fi
                        fi
                    done

                    if [ "$has_pipelines" = true ]; then
                        count=$((count + 1))
                        printf "%3d. %s\n" "$count" "$conv_name" >&2
                        conversations+=("$conv_name")
                    fi
                fi
            fi
        done
    fi

    if [ $count -eq 0 ]; then
        echo "No valid conversations found with pipeline data files." >&2
        exit 1
    fi

    echo "" >&2
    echo "Enter conversation number (1-$count) or press Enter to quit:" >&2

    read -r choice

    # If empty input (just Enter), quit
    if [ -z "$choice" ]; then
        echo "Exiting." >&2
        exit 0
    fi

    # Validate numeric input
    if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt $count ]; then
        echo "Invalid selection. Please enter a number between 1 and $count." >&2
        exit 1
    fi

    # Return selected conversation name (only this goes to stdout)
    echo "${conversations[$((choice-1))]}"
}

# Function to show interactive pipeline selection within a conversation
select_pipeline_interactive() {
    local conversation="$1"
    local data_dir="$HOME/repos/kedro-polis-pipelines/data"
    local conv_dir="$data_dir/$conversation"
    local pipelines=()
    local count=0

    echo "Available pipelines in conversation '$conversation':" >&2

    if [ -d "$conv_dir" ]; then
        for pipeline in "$conv_dir"/*; do
            if [ -d "$pipeline" ]; then
                local pipeline_name=$(basename "$pipeline")
                local primary_dir="$pipeline/03_primary"
                local projections_file="$primary_dir/projections.json"

                if [ -d "$primary_dir" ] && [ -f "$projections_file" ]; then
                    count=$((count + 1))
                    printf "%3d. %s\n" "$count" "$pipeline_name" >&2
                    pipelines+=("$pipeline_name")
                fi
            fi
        done
    fi

    if [ $count -eq 0 ]; then
        echo "No valid pipelines found in conversation '$conversation' with required data files." >&2
        exit 1
    fi

    echo "" >&2
    echo "Enter pipeline numbers (1-$count) separated by commas, or press Enter to quit:" >&2
    echo "Example: 1,3,5 to select pipelines 1, 3, and 5" >&2

    read -r choice

    # If empty input (just Enter), quit
    if [ -z "$choice" ]; then
        echo "Exiting." >&2
        exit 0
    fi

    # Parse comma-separated input
    local selected_pipelines=()
    IFS=',' read -ra PIPELINE_NUMS <<< "$choice"

    for num in "${PIPELINE_NUMS[@]}"; do
        # Trim whitespace
        num=$(echo "$num" | xargs)

        # Validate numeric input
        if ! [[ "$num" =~ ^[0-9]+$ ]] || [ "$num" -lt 1 ] || [ "$num" -gt $count ]; then
            echo "Invalid selection: $num. Please enter numbers between 1 and $count." >&2
            exit 1
        fi

        # Add selected pipeline
        selected_pipelines+=("${pipelines[$((num-1))]}")
    done

    # Remove duplicates
    local unique_pipelines=()
    for pipeline in "${selected_pipelines[@]}"; do
        if [[ ! " ${unique_pipelines[@]} " =~ " ${pipeline} " ]]; then
            unique_pipelines+=("$pipeline")
        fi
    done

    # Return selected pipeline names (one per line)
    printf '%s\n' "${unique_pipelines[@]}"
}

# Function to get available conversations and pipelines (for error messages)
get_available_pipelines() {
    local data_dir="$HOME/repos/kedro-polis-pipelines/data"

    if [ -d "$data_dir" ]; then
        for conv_dir in "$data_dir"/*; do
            if [ -d "$conv_dir" ]; then
                local conv_name=$(basename "$conv_dir")
                # Check if directory name starts with a number
                if [[ "$conv_name" =~ ^[0-9] ]]; then
                    for pipeline in "$conv_dir"/*; do
                        if [ -d "$pipeline" ]; then
                            local pipeline_name=$(basename "$pipeline")
                            local primary_dir="$pipeline/03_primary"
                            local projections_file="$primary_dir/projections.json"

                            if [ -d "$primary_dir" ] && [ -f "$projections_file" ]; then
                                echo "$conv_name/$pipeline_name"
                            fi
                        fi
                    done
                fi
            fi
        done
    fi
}

# Function to select files interactively
select_files_interactive() {
    local files=("projections.json" "statements.json" "votes.parquet")
    local selected_files=()

    echo "Available files to copy:" >&2
    for i in "${!files[@]}"; do
        printf "%3d. %s\n" "$((i+1))" "${files[$i]}" >&2
    done
    echo "  4. All files" >&2
    echo "" >&2
    echo "Enter file numbers (1-4) separated by spaces, or press Enter for all files:" >&2

    read -r choice

    # If empty input (just Enter), select all files
    if [ -z "$choice" ]; then
        selected_files=("${files[@]}")
    else
        # Parse the input
        for num in $choice; do
            if [[ "$num" =~ ^[0-9]+$ ]]; then
                if [ "$num" -eq 4 ]; then
                    # Select all files
                    selected_files=("${files[@]}")
                    break
                elif [ "$num" -ge 1 ] && [ "$num" -le 3 ]; then
                    # Add individual file
                    selected_files+=("${files[$((num-1))]}")
                else
                    echo "Invalid selection: $num. Please enter numbers between 1 and 4." >&2
                    exit 1
                fi
            else
                echo "Invalid input: $num. Please enter numbers only." >&2
                exit 1
            fi
        done
    fi

    # Remove duplicates
    local unique_files=()
    for file in "${selected_files[@]}"; do
        if [[ ! " ${unique_files[@]} " =~ " ${file} " ]]; then
            unique_files+=("$file")
        fi
    done

    # Return selected files (one per line)
    printf '%s\n' "${unique_files[@]}"
}

# Function to get suffixes interactively for multiple pipelines
get_suffixes_interactive() {
    local pipeline_count="$1"
    shift
    local pipelines=("$@")

    if [ "$pipeline_count" -eq 1 ]; then
        echo "Enter optional suffix for filenames (e.g., 'foo' will create projections.foo.json):" >&2
        echo "Press Enter for no suffix:" >&2

        read -r suffix
        echo "$suffix"
    else
        echo "Enter comma-separated suffixes for the $pipeline_count selected pipelines:" >&2
        echo "Pipelines: ${pipelines[*]}" >&2
        echo "Example: 'baseline,,experiment' (empty string for no suffix on 2nd pipeline)" >&2
        echo "Press Enter to use no suffixes for any pipeline:" >&2

        read -r suffixes_input

        if [ -z "$suffixes_input" ]; then
            # Return empty suffixes for all pipelines
            for ((i=0; i<pipeline_count; i++)); do
                echo ""
            done
        else
            # Parse comma-separated suffixes
            IFS=',' read -ra SUFFIX_ARRAY <<< "$suffixes_input"

            # Ensure we have the right number of suffixes
            local provided_count=${#SUFFIX_ARRAY[@]}
            if [ "$provided_count" -ne "$pipeline_count" ]; then
                echo "Error: Expected $pipeline_count suffixes but got $provided_count." >&2
                echo "Please provide exactly $pipeline_count comma-separated suffixes." >&2
                exit 1
            fi

            # Return suffixes (one per line)
            for suffix in "${SUFFIX_ARRAY[@]}"; do
                # Trim whitespace and return (empty string is valid)
                echo "$(echo "$suffix" | xargs)"
            done
        fi
    fi
}

# If no argument provided, show interactive selection
if [ $# -eq 0 ]; then
    CONVERSATION_NAME=$(select_conversation_interactive)
    PIPELINE_NAMES_OUTPUT=$(select_pipeline_interactive "$CONVERSATION_NAME")
    PIPELINE_NAMES=()
    while IFS= read -r line; do
        if [ -n "$line" ]; then
            PIPELINE_NAMES+=("$line")
        fi
    done <<< "$PIPELINE_NAMES_OUTPUT"

    FULL_PIPELINE_PATHS=()
    for pipeline_name in "${PIPELINE_NAMES[@]}"; do
        FULL_PIPELINE_PATHS+=("$CONVERSATION_NAME/$pipeline_name")
    done
else
    # Argument provided - expect format "conversation/pipeline" or comma-separated list
    if [[ "$1" == *","* ]]; then
        # Comma-separated list of pipelines
        IFS=',' read -ra PIPELINE_LIST <<< "$1"
        FULL_PIPELINE_PATHS=()

        for pipeline_spec in "${PIPELINE_LIST[@]}"; do
            pipeline_spec=$(echo "$pipeline_spec" | xargs)  # Trim whitespace

            if [[ "$pipeline_spec" == *"/"* ]]; then
                FULL_PIPELINE_PATHS+=("$pipeline_spec")
            else
                # Legacy format - try to find the pipeline in any conversation
                PIPELINE_NAME="$pipeline_spec"
                FOUND_PATH=""
                data_dir="$HOME/repos/kedro-polis-pipelines/data"

                for conv_dir in "$data_dir"/*; do
                    if [ -d "$conv_dir" ]; then
                        local conv_name=$(basename "$conv_dir")
                        if [[ "$conv_name" =~ ^[0-9] ]] && [ -d "$conv_dir/$PIPELINE_NAME/03_primary" ]; then
                            FOUND_PATH="$conv_name/$PIPELINE_NAME"
                            break
                        fi
                    fi
                done

                if [ -z "$FOUND_PATH" ]; then
                    echo "Error: Pipeline '$PIPELINE_NAME' not found in any conversation directory."
                    echo "Please use format 'conversation/pipeline' or run without arguments for interactive selection."
                    exit 1
                fi

                FULL_PIPELINE_PATHS+=("$FOUND_PATH")
            fi
        done
    else
        # Single pipeline
        if [[ "$1" == *"/"* ]]; then
            FULL_PIPELINE_PATHS=("$1")
        else
            # Legacy format - try to find the pipeline in any conversation
            PIPELINE_NAME="$1"
            FOUND_PATH=""
            data_dir="$HOME/repos/kedro-polis-pipelines/data"

            for conv_dir in "$data_dir"/*; do
                if [ -d "$conv_dir" ]; then
                    local conv_name=$(basename "$conv_dir")
                    if [[ "$conv_name" =~ ^[0-9] ]] && [ -d "$conv_dir/$PIPELINE_NAME/03_primary" ]; then
                        FOUND_PATH="$conv_name/$PIPELINE_NAME"
                        break
                    fi
                fi
            done

            if [ -z "$FOUND_PATH" ]; then
                echo "Error: Pipeline '$PIPELINE_NAME' not found in any conversation directory."
                echo "Please use format 'conversation/pipeline' or run without arguments for interactive selection."
                exit 1
            fi

            FULL_PIPELINE_PATHS=("$FOUND_PATH")
        fi
    fi
fi

TARGET_DIR="public"

echo "Selected pipelines for copying:"
for path in "${FULL_PIPELINE_PATHS[@]}"; do
    echo "  - $path"
done
echo ""

# Validate all source directories exist
for FULL_PIPELINE_PATH in "${FULL_PIPELINE_PATHS[@]}"; do
    SOURCE_DIR="$HOME/repos/kedro-polis-pipelines/data/$FULL_PIPELINE_PATH/03_primary"

    if [ ! -d "$SOURCE_DIR" ]; then
        echo "Error: Source directory does not exist: $SOURCE_DIR"
        echo ""
        echo "Available pipelines:"
        get_available_pipelines | sed 's/^/  /'
        exit 1
    fi
done

# Check if target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Target directory does not exist: $TARGET_DIR"
    exit 1
fi

# Get file selection
echo ""
SELECTED_FILES_OUTPUT=$(select_files_interactive)
SELECTED_FILES=()
while IFS= read -r line; do
    if [ -n "$line" ]; then
        SELECTED_FILES+=("$line")
    fi
done <<< "$SELECTED_FILES_OUTPUT"

# Get suffixes for multiple pipelines
echo ""
PIPELINE_COUNT=${#FULL_PIPELINE_PATHS[@]}
SUFFIXES_OUTPUT=$(get_suffixes_interactive "$PIPELINE_COUNT" "${FULL_PIPELINE_PATHS[@]}")
SUFFIXES=()
while IFS= read -r line; do
    SUFFIXES+=("$line")
done <<< "$SUFFIXES_OUTPUT"

# Build target filename function
get_target_filename() {
    local source_file="$1"
    local suffix="$2"

    if [ -z "$suffix" ]; then
        echo "$source_file"
    else
        # Extract filename and extension
        local filename="${source_file%.*}"
        local extension="${source_file##*.}"
        echo "${filename}.${suffix}.${extension}"
    fi
}

# Copy the selected files from all pipelines
echo ""
echo "Copying files..."
success_count=0
total_count=$((${#SELECTED_FILES[@]} * ${#FULL_PIPELINE_PATHS[@]}))

for i in "${!FULL_PIPELINE_PATHS[@]}"; do
    FULL_PIPELINE_PATH="${FULL_PIPELINE_PATHS[$i]}"
    SUFFIX="${SUFFIXES[$i]}"
    SOURCE_DIR="$HOME/repos/kedro-polis-pipelines/data/$FULL_PIPELINE_PATH/03_primary"

    echo ""
    echo "Processing pipeline: $FULL_PIPELINE_PATH"
    if [ -n "$SUFFIX" ]; then
        echo "Using suffix: '$SUFFIX'"
    else
        echo "No suffix applied"
    fi

    for file in "${SELECTED_FILES[@]}"; do
        source_path="$SOURCE_DIR/$file"
        target_filename=$(get_target_filename "$file" "$SUFFIX")
        target_path="$TARGET_DIR/$target_filename"

        if [ -f "$source_path" ]; then
            if cp "$source_path" "$target_path"; then
                echo "✓ $file → $target_filename"
                success_count=$((success_count + 1))
            else
                echo "✗ Failed to copy $file"
            fi
        else
            echo "✗ Source file not found: $file"
        fi
    done
done

echo ""
if [ $success_count -eq $total_count ]; then
    echo "Data copy completed successfully! ($success_count/$total_count files copied)"
else
    echo "Data copy completed with errors. ($success_count/$total_count files copied)"
    exit 1
fi