// Console output + the pipeline's error type.
//
// Every stage reports through here so a long run reads as one coherent
// transcript rather than a pile of ad-hoc console.log calls.

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (useColor ? `[${code}m${s}[0m` : String(s));

export const dim = c('2');
export const bold = c('1');
export const red = c('31');
export const green = c('32');
export const yellow = c('33');
export const blue = c('36');

let currentStage = null;
let stageStartedAt = 0;

export function stageStart(name, detail = '') {
  currentStage = name;
  stageStartedAt = Date.now();
  process.stdout.write(`\n${bold(blue(`▶ ${name}`))}${detail ? ` ${dim(detail)}` : ''}\n`);
}

export function stageEnd(name, detail = '') {
  const secs = ((Date.now() - stageStartedAt) / 1000).toFixed(1);
  process.stdout.write(`${green('✔')} ${name} ${dim(`(${secs}s)`)}${detail ? ` ${dim(detail)}` : ''}\n`);
  currentStage = null;
}

export const info = (msg) => process.stdout.write(`  ${msg}\n`);
export const step = (msg) => process.stdout.write(`  ${dim('·')} ${msg}\n`);
export const warn = (msg) => process.stdout.write(`  ${yellow('!')} ${msg}\n`);
export const fail = (msg) => process.stderr.write(`  ${red('✖')} ${msg}\n`);
export const cached = (msg) => process.stdout.write(`  ${dim(`↺ cached — ${msg}`)}\n`);

/**
 * An error the user is meant to read and act on, as opposed to a crash.
 * The CLI prints `message` plus `hint` without a stack trace.
 */
export class PipelineError extends Error {
  constructor(message, hint = null) {
    super(message);
    this.name = 'PipelineError';
    this.hint = hint;
    this.isPipelineError = true;
  }
}

export function reportFatal(err) {
  if (err?.isPipelineError) {
    process.stderr.write(`\n${red(bold('Pipeline stopped.'))}\n${err.message}\n`);
    if (err.hint) process.stderr.write(`\n${dim(err.hint)}\n`);
    process.stderr.write('\n');
  } else {
    process.stderr.write(`\n${red(bold('Unexpected error.'))}\n`);
    process.stderr.write(`${err?.stack ?? err}\n\n`);
  }
}
