---
name: deploy
description: Build and deploy the site to GitHub Pages at sharonkwong.com. Ensures all changes are committed and pushed first.
disable-model-invocation: true
allowed-tools: Bash(git *), Bash(npm run build), Bash(npm run deploy)
---

Deploy the site to GitHub Pages. Follow these steps in order, stopping if any step fails:

1. **Check for uncommitted changes**: Run `git status`. If there are staged or unstaged changes (modified/added/deleted files), ask the user for a commit message, then stage and commit them. If there are only untracked files, ask the user if they should be included.

2. **Push to main**: Run `git push origin main` to make sure the source code is up to date on the remote.

3. **Build and deploy**: Run `npm run deploy` which will build the site and push the `dist/` folder to the `gh-pages` branch.

4. **Verify**: Confirm the deploy succeeded and let the user know the site should be live at https://sharonkwong.com shortly (GitHub Pages can take a minute or two to update).
