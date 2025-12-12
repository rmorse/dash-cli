# projects-cli: Navigate to projects
# This file is auto-generated. Use 'projects-cli --setup bash' for automatic setup.

projects() {
    projects-cli
    local selected
    selected=$(cat ~/.projects-cli/last-selection 2>/dev/null)
    if [ -n "$selected" ] && [ -d "$selected" ]; then
        cd "$selected" || return 1
    fi
}
