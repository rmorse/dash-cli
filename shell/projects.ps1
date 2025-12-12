# projects-cli: Navigate to projects
# This file is auto-generated. Use 'projects-cli --setup powershell' for automatic setup.

function projects {
    projects-cli
    $selectionFile = "$env:USERPROFILE\.projects-cli\last-selection"
    if (Test-Path $selectionFile) {
        $selected = Get-Content $selectionFile -Raw
        if ($selected -and (Test-Path $selected.Trim())) {
            Set-Location $selected.Trim()
        }
    }
}
