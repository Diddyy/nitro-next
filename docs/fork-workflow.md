# Fork contribution workflow

## Where changes belong

| Repository | Upstream PR target | Personal integration branch |
| --- | --- | --- |
| Turbo Cloud | `nitrodevco/turbo-cloud:main` | `Diddyy/turbo-cloud:dev` |
| Nitro client | `nitrodevco/nitro-next:pixi-render` | `Diddyy/nitro-next:dev` |

`origin` is upstream; `fork` is the personal fork and normal push destination.
Fork `main` mirrors upstream `main`. The client also mirrors upstream `pixi-render`.
Mirrors contain no personal commits. The canonical checkout stays on personal `dev`;
focused feature worktrees are siblings of that checkout.

Personal `dev` lets completed features run together before their upstream PRs merge.
It is not an upstream PR source or an upstream staging branch. Do not push a `dev`
branch to upstream unless the maintainers explicitly adopt a shared integration and
release process. Today Turbo accepts changes directly into `main`; Nitro uses
`pixi-render`. Promoting the client's entire Pixi migration into `main` is separate work.

These rules apply to sibling feature worktrees even when their upstream base does not
contain this document. Read the target repository's `AGENTS.md` for implementation
and verification contracts. Keep commits, publishing and upstream merges within the
user's authorized scope; access permissions alone do not authorize an upstream merge.

## One change from start to finish

From the canonical checkout, even when it has unrelated local work:

```sh
git new-feature fix/chat-input
```

The local alias fetches upstream and creates `fix/chat-input` in `../nitro-fix-chat-input`,
based on `origin/pixi-render`. Work in that new directory. Existing branch or directory names
fail safely; inspect them rather than deleting them. Use one branch argument without spaces.

Implement and run the repository's relevant checks. Stage only the feature files,
then publish the focused branch and open a PR directly to the upstream integration target:

```sh
git add <feature-files>
git commit -m "Fix chat input"
git publish
gh pr create --repo nitrodevco/nitro-next --head Diddyy:fix/chat-input --base pixi-render
```

`git publish` is `git push -u fork HEAD`. Check the head, base and diff before creating
the PR. Replace the example branch with the actual feature branch. Never submit `dev`.

When the feature is ready for personal use, return to the canonical checkout:

```sh
git switch dev
git merge --no-ff fix/chat-input
git push fork dev
```

Preserve local work first if it overlaps the merge. Integrating into personal `dev`
does not merge or approve the upstream PR. Verify the combined behavior when integration
changes inputs or introduces interactions not covered by the feature checks.

## Independent changes and dependencies

Start each independent feature from `origin/pixi-render`, even if `dev` has other features.
Keep related changes together and unrelated changes in separate worktrees and PRs.

Default to PRs directly against the upstream integration target. Do not target another
feature branch just to make a stack: a PR marked merged into that branch has not reached
upstream's integration target. This previously left accepted Turbo changes outside `main`.

For a real dependency, either keep tightly related work in one focused PR or wait for
the prerequisite to land before preparing the next PR. Work can continue privately on a
dependent branch, but do not submit personal `dev` or its unrelated changes. Exceptional
stacked PRs must state their prerequisite and merge order; merging into a feature branch
is not completion. Do not silently retarget or rewrite published branches.

## After upstream merges

From a clean canonical `dev` checkout:

```sh
git sync-dev
```

This local alias refuses another current branch or tracked edits. It fetches upstream,
fast-forwards fork mirrors, merges `origin/pixi-render` into personal `dev`, then pushes `dev`
to the fork. It does not switch or reset branches, delete worktrees, or rewrite history.
If it stops on divergence or conflict, inspect and preserve both intended behaviors.

For read-only refresh or mirror-only synchronization:

```sh
git upstream-fetch
git sync-mirrors
```

`upstream-fetch` fetches `origin`. `sync-mirrors` fetches upstream and fast-forwards fork
mirrors; it rejects divergence rather than force-pushing. These two aliases do not update
`dev`, feature branches or local mirror branches. Local mirror branches can be advanced
separately after checking they contain no unique work.

After a squash merge, merge the actual upstream target into `dev`; do not assume the
original feature commit became an upstream ancestor. Start the next feature from the
updated upstream target. Do not repeatedly merge an already-landed feature branch.

Once the PR is merged, verify its current branch tip has no newer unpublished work and
that its changes are present in the intended upstream target, then delete its fork feature
branch. Check open PR dependencies first. Branch ancestry alone is insufficient after a
squash merge. Keep active features, open PR branches, archives and unrelated older work.
Remove a local feature worktree only after checking it is clean and no longer needed;
remote branch deletion does not authorize deleting local work. Never bulk-delete branches
because their names look old.

## Agent handoff and local configuration

Report the branch and worktree, actual checks, remaining local edits, personal `dev`
integration and PR status. Distinguish "in personal dev", "merged into another feature
branch" and "landed in upstream integration". Never claim an upstream merge from PR status
without checking its base and the actual target contents.

The aliases are local Git configuration shared by this repository's worktrees. A new clone
must recreate them or use explicit commands: fetch `origin`, create a worktree from
`origin/pixi-render`, push the feature to `fork`, and create the PR with explicit head and base.
Use Turbo for development and live checks. Keep local configuration, dependency-install
state, credentials and unrelated WIP out of feature and workflow commits.
