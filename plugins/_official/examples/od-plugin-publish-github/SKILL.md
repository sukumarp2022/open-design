---
name: od-plugin-publish-github
description: Publish a local Open Design plugin to a new public GitHub repository using gh CLI.
triggers:
  - publish plugin
  - github repo
  - open source plugin
od:
  mode: utility
  platform: desktop
  scenario: plugin-sharing
---

# Publish Plugin to GitHub

Use this workflow when the active project contains a copied plugin folder and the user wants it published as a new public GitHub repository.

## Workflow

1. Read the active plugin inputs. `plugin_context_path` is the copied plugin folder relative to the project working directory.
2. Inspect `open-design.json`, `SKILL.md`, and any compatibility metadata in the copied folder.
3. Verify `gh auth status --hostname github.com`. If authentication is missing, stop with the exact command the user needs to run.
4. Create a clean temporary git repository from the copied plugin folder. Do not include project wrapper files or unrelated artifacts.
5. Commit with a concise message such as `Publish <plugin title> plugin`.
6. Create a public repository with `gh repo create <repo-name> --public --source <temp-repo> --push`.
7. Report the final repository URL, commit hash, and any validation performed.

Prefer the manifest `name` as the repository slug. If that repository already exists, choose the next clear slug and mention the rename.
