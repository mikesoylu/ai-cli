#!/usr/bin/env bun

import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

type CliOptions = {
  modelName: string | null;
  verbose: boolean;
  prompt: string;
};

function printUsage() {
  console.error(`Usage: ai [options] <prompt>
Example: ai --model anthropic/claude-haiku-4-5 --verbose Tell me a joke about programmers.
Options:
  --model <modelName>  Specify the model to use (e.g., openai/gpt-4.1, anthropic/claude-haiku-4-5)
  --verbose            Enable verbose output for executed commands`);
}

function parseArgs(argv: string[]): CliOptions {
  const promptParts: string[] = [];
  let modelName: string | null = null;
  let verbose = false;

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--verbose') {
      verbose = true;
      continue;
    }

    if (arg === '--model') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('--model requires a value');
      }
      modelName = value;
      i += 1;
      continue;
    }

    promptParts.push(arg!);
  }

  return { modelName, verbose, prompt: promptParts.join(' ') };
}

function spawnInteractive(command: string, cwd: string) {
  return new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      resolve({ code, signal });
    });
  });
}

async function runAgentLoop() {
  let options: CliOptions;
  try {
    options = parseArgs(process.argv);
  } catch (error) {
    console.error(String(error));
    printUsage();
    process.exit(1);
  }

  if (!options.prompt) {
    printUsage();
    process.exit(1);
  }

  let model = anthropic('claude-haiku-4-5');

  if (options.modelName?.startsWith('openai/')) {
    model = openai(options.modelName.replace('openai/', ''));
  }

  if (options.modelName?.startsWith('anthropic/')) {
    model = anthropic(options.modelName.replace('anthropic/', ''));
  }

  let tokens = 0;

  const result = streamText({
    model,
    system:
      'You are AI (`~/.local/bin/ai`). A helpful assistant running in a terminal. Respond concisely and directly. Use `cd` to change directories. Use `exec` for non-interactive commands that return output. Use `term` for interactive terminal apps (e.g. nvim, less, ssh) that need TTY control.',
    prompt: options.prompt,
    stopWhen: [],
    onStepFinish: (step) => {
      if (step.usage.totalTokens) {
        tokens += step.usage.totalTokens;
      }
      process.stdout.write('\x1b[0m');
      process.stdout.write('\n');
    },
    tools: {
      cd: tool({
        description: 'Change the current working directory.',
        inputSchema: z.object({
          directory: z.string().describe('The directory to change to'),
        }),
        execute: async ({ directory }) => {
          process.stdout.write('\x1b[90m');
          process.stdout.write(`\n$ cd ${directory.trim()}`);
          process.stdout.write('\x1b[0m');

          process.chdir(directory);
          return `Changed directory to ${process.cwd()}`;
        },
      }),

      exec: tool({
        description: 'Execute a shell command in the current working directory.',
        inputSchema: z.object({
          command: z.string().describe('The command to execute'),
        }),
        execute: async ({ command }) => {
          process.stdout.write('\x1b[90m');
          process.stdout.write(`\n$ ${command.trim()}`);

          const { stdout, stderr } = await execAsync(command, {
            cwd: process.cwd(),
            env: process.env,
          });

          if (options.verbose) {
            process.stdout.write('\n');
            process.stdout.write(
              stdout
                .split('\n')
                .map((line) => `  ${line}`)
                .join('\n'),
            );
          }

          process.stdout.write('\x1b[0m');
          return stderr ? `Error: ${stderr}` : stdout;
        },
      }),

      term: tool({
        description:
          'Execute an interactive terminal command (TUI) in the current working directory. Use this for commands like `nvim`, `less`, `ssh`, etc.',
        inputSchema: z.object({
          command: z.string().describe('The interactive command to run'),
        }),
        execute: async ({ command }) => {
          process.stdout.write('\x1b[90m');
          process.stdout.write(`\n$ ${command.trim()}`);
          process.stdout.write('\x1b[0m');

          const { code, signal } = await spawnInteractive(command, process.cwd());

          if (signal) {
            return `Process terminated by signal ${signal}`;
          }

          if (code !== 0) {
            return `Process exited with code ${String(code)}`;
          }

          return 'Done.';
        },
      }),
    },
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  process.stdout.write('\n');
  process.stdout.write(`${tokens}t ${process.uptime().toFixed(2)}s (${model.modelId})\n`);
}

runAgentLoop().catch(console.error);
