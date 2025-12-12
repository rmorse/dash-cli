# projects - Navigate to a project directory
# Add to ~/.bashrc: source /path/to/projects.sh

projects() {
    local selected
    selected=$(projects-cli)
    if [ -n "$selected" ] && [ -d "$selected" ]; then
        cd "$selected" || return 1
    fi
}
