#!/bin/bash

# Config
PROMPT_FILE="PROMPT.md"
MAX_ITERATIONS=${1:-10}
STALEMATE_THRESHOLD=3
ITERATION=0
STALLED_COUNT=0
REASONING_LEVEL="low" # Start at low

get_reasoning_level() {
    if [ "$STALLED_COUNT" -ge "$STALEMATE_THRESHOLD" ]; then
        echo "high"
    elif [ "$STALLED_COUNT" -gt 0 ]; then
        echo "medium"
    else
        echo "low"
    fi
}

echo "Starting Ralph Loop with Improved Stall Detection..."

if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo "Error: This script requires a git repository."
    exit 1
fi

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))

    # 1. Determine Reasoning Level
    REASONING_LEVEL=$(get_reasoning_level)

    if [ "$REASONING_LEVEL" = "high" ]; then
        COLOR="\033[1;33m" # Yellow
        echo -e "${COLOR}>>> STALL DETECTED ($STALLED_COUNT rounds)."
        echo -e "Escalating to HIGH... \033[0m"
    elif [ "$REASONING_LEVEL" = "medium" ]; then
        COLOR="\033[1;34m" # Blue
        echo -e "${COLOR}>>> Stall detected. Escalating to MEDIUM... \033[0m"
    else
        COLOR="\033[1;34m" # Blue
    fi

    echo -e "\n${COLOR}--- Iteration $ITERATION"
    echo -e "($REASONING_LEVEL reasoning) --- \033[0m"

    # 2. Capture state BEFORE the run
    # We use a hash of the porcelain status to see if anything changes
    PRE_STATE=$(git status --porcelain | sha256sum)

    # 3. Codex CLI
    # We pass the reasoning level into the config flag
    RESPONSE=$(
        codex -m gpt-5.6-luna exec --yolo \
            --config "model_reasoning_effort=\"$REASONING_LEVEL\"" \
            - < "$PROMPT_FILE"
    )
    if [ $? -ne 0 ]; then
        echo -e "\033[0;31m[!] Codex command failed."
        echo -e "Sleeping and retrying...\033[0m"
        sleep 5
        continue
    fi

    tmp_response=$(mktemp)
    
    # 4. Capture state AFTER the run
    POST_STATE=$(git status --porcelain | sha256sum)

    # 5. Stall Detection Logic
    if [ "$PRE_STATE" == "$POST_STATE" ]; then
        STALLED_COUNT=$((STALLED_COUNT + 1))
        echo -e "\033[0;31m[!] No file changes detected this round.\033[0m"
    else
        echo -e "\033[0;32m[+] Progress detected."
        echo -e "Resetting effort to LOW.\033[0m"
        STALLED_COUNT=0
        REASONING_LEVEL="low"
    fi

    # 6. Completion Signal
    if [[ "$RESPONSE" == *"<promise>COMPLETE</promise>"* ]]; then
        echo -e "\n\033[1;32m✅ SUCCESS: Mission accomplished.\033[0m"
        exit 0
    fi

    sleep 2
done

echo -e "\n\033[1;31m⚠️ Loop reached max iterations.\033[0m"
