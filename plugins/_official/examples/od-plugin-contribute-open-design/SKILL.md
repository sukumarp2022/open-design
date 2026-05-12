---
name: od-plugin-contribute-open-design
description: Open a pull request adding a local Open Design plugin to the Open Design community catalog using gh CLI.
triggers:
  - contribute plugin
  - open design pr
  - github pull request
od:
  mode: utility
  platform: desktop
  scenario: plugin-sharing
---

# Contribute Plugin to Open Design

Use this workflow when the active project contains a copied plugin folder and the user wants to propose it for the Open Design community catalog.

## Workflow

1. Read the active plugin inputs. `plugin_context_path` is the copied plugin folder relative to the project working directory.
2. Inspect the copied plugin's manifest, skill instructions, examples, and compatibility metadata.
3. Verify `gh auth status --hostname github.com`. If authentication is missing, stop with the exact command the user needs to run.
4. Fork or reuse a fork of `nexu-io/open-design`, then clone a clean working copy.
5. Create a branch named like `plugin/<source_plugin_id>`.
6. Copy the staged plugin folder into `plugins/community/<source_plugin_id>` in that working copy. Create parent directories when needed.
7. Commit only that plugin folder, push the branch to the user's fork, and run `gh pr create --repo nexu-io/open-design --base main`.
8. Report the PR URL, branch name, and any validation performed.

Keep the pull request focused. Do not modify unrelated Open Design files unless a manifest validation issue requires a tiny supporting change.
