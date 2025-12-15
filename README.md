# ai-cli

A tiny Bun-based CLI that streams responses from an LLM and can optionally run a few terminal “tools” (`cd`, `exec`, `term`) when the model decides they’re useful.

By default it uses Anthropic (`claude-haiku-4-5`) unless you pick another model with `--model`.

## Features

- Streaming responses (token-by-token)
- Model selection via `--model` (Anthropic by default; OpenAI is optional)
- A small toolset the model can call:
  - `cd`: change working directory
  - `exec`: run a non-interactive shell command and capture output
  - `term`: run interactive commands (TUI apps) with your TTY

## Requirements

- [Bun](https://bun.sh) (for development and/or building)
- An API key in your environment:
  - `ANTHROPIC_API_KEY` (for `anthropic/...` models)
  - `OPENAI_API_KEY` (for `openai/...` models)

## Installing the CLI

This repo builds a local executable called `ai`.

1) Install dependencies:

```bash
bun install
```

2) Build the executable:

```bash
bun run build
```

3) Install it somewhere on your `PATH` (example for macOS/Linux):

```bash
mkdir -p ~/.local/bin
install -m 755 ./ai ~/.local/bin/ai
```

4) Verify:

```bash
ai --model anthropic/claude-haiku-4-5 "hello"
```

If you don’t want to install globally, you can run it directly:

```bash
./ai "hello"
```

## Usage

```bash
ai [--model <provider/model>] [--verbose] <prompt>
```

Examples:

```bash
ai "Summarize the last 20 lines of my shell history"
ai --model anthropic/claude-haiku-4-5 "Explain monads in one paragraph"
```

```bash
ai --model openai/gpt-4.1-mini --verbose "List files and show git status"
```

Flags:

- `--model <modelName>`: e.g. `anthropic/claude-haiku-4-5` (and `openai/gpt-4.1` if installed)
- `--verbose`: prints stdout from tool-executed commands (the model still receives stdout/stderr either way)

## Notes / Safety

This CLI allows the model to execute commands on your machine via `exec` and `term`. Use it in a directory you trust, and consider running it in a sandboxed environment if you’re experimenting.

## Development

Run without building:

```bash
bun run start -- "your prompt here"
```

Format + lint:

```bash
bun run check
```
