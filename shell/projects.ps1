# projects - Navigate to a project directory
# Add to $PROFILE: . /path/to/projects.ps1

function projects {
    $selected = projects-cli
    if ($selected -and (Test-Path $selected)) {
        Set-Location $selected
    }
}
