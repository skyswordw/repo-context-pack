# Repo Context Pack

Generate a compact, safe context pack for coding agents entering an unfamiliar repository.

`repo-context-pack` scans a local repo without running project commands, then writes agent-ready Markdown:

- `AGENTS.md` - working rules, first files to inspect, and safety notes
- `agent-brief.md` - repo summary and suggested first agent prompt
- `commands.md` - discovered package scripts grouped by purpose and risk
- `repo-map.md` - languages, entrypoints, config, docs, and top-level shape
- `risk-report.md` - conservative findings that need human attention

## Why This Exists

Vibe coding gets fast once an agent has the right context. It gets expensive when every agent starts cold, guesses the package manager, misses the tests, runs unsafe scripts, or reads secrets. This tool builds a small handoff pack before the agent starts editing.

## Quick Start

```bash
npx github:skyswordw/repo-context-pack --repo /path/to/repo --out ./agent-context
```

Local development:

```bash
npm install
npm run build
node dist/cli.js --repo fixtures/example-repo --out tmp/demo-context --force
```

After cloning from GitHub, you can also run:

```bash
npm link
repo-context-pack --repo /path/to/repo --out ./agent-context
```

## CLI

```bash
repo-context-pack [repo] [options]

Options:
  -r, --repo <path>       Repository to scan. Defaults to current directory.
  -o, --out <path>        Output directory. Defaults to ./agent-context.
      --json              Write repo-context.json instead of Markdown files.
      --max-files <n>     Maximum files to scan. Defaults to 7000.
      --force             Allow writing into a non-empty output directory.
  -h, --help              Show help.
```

## Safety Model

- It reads file names, sizes, and selected metadata files such as `package.json`.
- It does not execute repository scripts.
- It ignores common generated directories like `.git`, `node_modules`, `dist`, `coverage`, `.venv`, and build caches.
- It flags `.env`-style files by path but does not print their contents.
- It marks commands containing patterns such as `rm -rf`, `sudo`, `curl | bash`, database reset, deployment, or infrastructure mutation as approval-gated.

## Ten Useful Vibe-Coding Project Ideas

This repo is the implemented pick from a shortlist of practical projects:

| # | Idea | Useful MVP |
|---|---|---|
| 1 | Repo Context Pack | Generate agent-ready repo maps, commands, and safety rules before coding starts. |
| 2 | MCP Guard | Audit local MCP configs for risky env exposure, mutable tools, and unpinned servers. |
| 3 | Agent Handoff Inbox | Collect questions from parallel agents in one local approval inbox. |
| 4 | PR Evidence Pack | Turn diffs and test output into reviewer-friendly evidence notes. |
| 5 | Vibe Spec Recorder | Convert prompts, commits, and decisions into a living `SPEC.md`. |
| 6 | Local SMB Quote Agent | Help one service business create quotes, follow-ups, and work orders locally. |
| 7 | Inbox-to-SOP Builder | Turn repeated customer emails or chats into SOPs and reply templates. |
| 8 | MCP Mini Server Generator | Generate a read-only MCP server for a local folder, CSV, or SQLite database. |
| 9 | Agent Runbook Checker | Identify safe and dangerous operational commands before agents run them. |
| 10 | Issue Triage Agent Lite | Summarize GitHub issues, missing reproduction info, labels, and reply drafts. |

The first project was chosen because it is immediately useful to developers, requires no external API, fits a one-night build, and improves every later coding-agent run.

## Example Output

```bash
npm run build
node dist/cli.js --repo fixtures/example-repo --out tmp/demo-context --force
```

Then read:

```bash
ls tmp/demo-context
```

## Development

```bash
npm install
npm run check
npm run build
npm test
```

## License

MIT
