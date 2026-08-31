# Issue tracker: GitHub

Issues and planning maps for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, including labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments` with suitable label and state filters.
- **Comment**: `gh issue comment <number> --body "..."`.
- **Apply or remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`.
- **Close**: `gh issue close <number> --comment "..."`.

Infer the repository from the current clone. External pull requests are not a triage request surface.

## Publishing and fetching

- When a skill says to publish to the issue tracker, create a GitHub issue.
- When a skill says to fetch a ticket, run `gh issue view <number> --comments`.

## Wayfinding operations

The map is one issue labelled `wayfinder:map`; its tickets are child issues.

- **Map**: create with `gh issue create --label wayfinder:map`.
- **Child ticket**: link an issue as a GitHub sub-issue using the sub-issues API. If unavailable, add it to a task list in the map and put `Part of #<map>` at the top of its body. Apply one of `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- **Blocking**: use GitHub's native issue dependencies. POST to `repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by` with the blocker's numeric database `issue_id`. If dependencies are unavailable, use a `Blocked by: #<n>` line in the child body.
- **Frontier**: among the map's open children, keep only unassigned tickets with no open blocker. The first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me` before doing any work.
- **Resolve**: comment with the answer, close the ticket, then append a one-line named link and gist to the map's Decisions so far.
