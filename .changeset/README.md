# Changesets

This repository uses Changesets to manage package versioning and publishing.

What I added:

- `config.json` — basic Changesets configuration so the CLI does not error when the folder is missing.

Next steps for maintainers:

1. Create a changeset for your changes. From the repo root run:

```bash
# interactive (recommended)
pnpm changeset

# or create one non-interactively
pnpm changeset add
```

2. Review the generated markdown file in `.changeset/` (it describes the packages and release type).

3. Commit the `.changeset` files to git and push.

4. Run the publish script again after building:

```bash
pnpm run publish-packages
```

If you'd like the full `changeset init` behavior (custom prompts, different defaults), you can run `pnpm changeset init` to reinitialize interactively.

更多信息见：https://github.com/changesets/changesets
