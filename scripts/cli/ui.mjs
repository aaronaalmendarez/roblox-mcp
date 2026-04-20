// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  studio-cli UI Layer — A Work of Art                                     ║
// ║  Zero-dependency ANSI terminal primitives                                 ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import process from 'node:process';

const ESC = '\x1b[';

export const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',

  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
};

export function style(text, ...styles) {
  const prefix = styles.join('');
  return `${prefix}${text}${c.reset}`;
}

export function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

export function pad(str, width) {
  const visible = stripAnsi(str).length;
  return str + ' '.repeat(Math.max(0, width - visible));
}

export function truncate(str, max) {
  const visible = stripAnsi(str);
  if (visible.length <= max) return str;
  return str.slice(0, max - 3) + '...';
}

export const box = {
  tl: '╭', t: '─', tr: '╮',
  l: '│', r: '│',
  bl: '╰', b: '─', br: '╯',
  h: '─', v: '│',
  cross: '┼', tDiv: '┬', bDiv: '┴', lDiv: '├', rDiv: '┤',
};

export function drawBox(lines, opts = {}) {
  const { width = 0, padding = 1, color = c.cyan, title = '' } = opts;
  const maxLine = Math.max(...lines.map((l) => stripAnsi(l).length), width);
  const inner = maxLine + padding * 2;
  const out = [];

  let top = color + box.tl + box.t.repeat(inner) + box.tr + c.reset;
  if (title) {
    const t = ` ${title} `;
    const left = Math.floor((inner - t.length) / 2);
    const right = inner - t.length - left;
    top = color + box.tl + box.t.repeat(left) + c.bold + t + color + box.t.repeat(right) + box.tr + c.reset;
  }
  out.push(top);

  for (const line of lines) {
    const padRight = inner - stripAnsi(line).length;
    out.push(color + box.l + c.reset + ' '.repeat(padding) + line + ' '.repeat(padRight - padding) + color + box.r + c.reset);
  }

  out.push(color + box.bl + box.b.repeat(inner) + box.br + c.reset);
  return out.join('\n');
}

export function drawTable(rows, opts = {}) {
  const { headers = [], color = c.cyan, widths = [] } = opts;
  const allRows = headers.length ? [headers, ...rows] : rows;
  if (allRows.length === 0) return '';

  const colCount = Math.max(...allRows.map((r) => r.length));
  const computedWidths = [];
  for (let i = 0; i < colCount; i++) {
    const w = widths[i] || Math.max(...allRows.map((r) => stripAnsi(r[i] || '').length), 1);
    computedWidths.push(w);
  }

  const totalWidth = computedWidths.reduce((a, b) => a + b, 0) + (colCount - 1) * 3;
  const out = [];

  function rowLine(cells, isHeader = false) {
    const parts = cells.map((cell, i) => pad(truncate(cell || '', computedWidths[i]), computedWidths[i]));
    const styled = isHeader ? parts.map((p) => c.bold + p + c.reset) : parts;
    return color + box.l + c.reset + ' ' + styled.join(' ' + color + box.v + c.reset + ' ') + ' ' + color + box.r + c.reset;
  }

  function sepLine(left, mid, right) {
    const parts = computedWidths.map((w) => box.h.repeat(w + 2));
    return color + left + parts.join(mid) + right + c.reset;
  }

  out.push(sepLine(box.tl, box.tDiv, box.tr));

  if (headers.length) {
    out.push(rowLine(headers, true));
    out.push(sepLine(box.lDiv, box.cross, box.rDiv));
  }

  for (const row of rows) {
    out.push(rowLine(row));
  }

  out.push(sepLine(box.bl, box.bDiv, box.br));
  return out.join('\n');
}

export function header(text, color = c.brightCyan) {
  const w = Math.min(64, process.stdout.columns || 64);
  const padLen = Math.max(0, w - text.length - 4);
  return color + '━━ ' + c.bold + text + color + ' ' + '━'.repeat(padLen) + c.reset;
}

export function section(text) {
  return '\n' + c.dim + '  ┃ ' + c.reset + c.brightBlue + text + c.reset;
}

export function bullet(text, color = c.brightWhite) {
  return '  ' + color + '•' + c.reset + ' ' + text;
}

export function ok(text) {
  return c.brightGreen + '✓' + c.reset + ' ' + text;
}

export function err(text) {
  return c.brightRed + '✗' + c.reset + ' ' + text;
}

export function warn(text) {
  return c.brightYellow + '⚠' + c.reset + ' ' + text;
}

export function info(text) {
  return c.brightBlue + 'ℹ' + c.reset + ' ' + text;
}

export function running(text) {
  return c.brightGreen + '●' + c.reset + ' ' + text;
}

export function stopped(text) {
  return c.gray + '○' + c.reset + ' ' + text;
}

export class Spinner {
  constructor(message) {
    this.message = message;
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.idx = 0;
    this.timer = null;
    this.done = false;
  }

  start() {
    this.timer = setInterval(() => {
      if (this.done) return;
      const frame = c.brightCyan + this.frames[this.idx] + c.reset;
      process.stdout.write(`\r${frame} ${this.message}`);
      this.idx = (this.idx + 1) % this.frames.length;
    }, 80);
    return this;
  }

  succeed(msg) {
    this.stop();
    console.log(`\r${ok(msg || this.message)}`);
  }

  fail(msg) {
    this.stop();
    console.log(`\r${err(msg || this.message)}`);
  }

  warn(msg) {
    this.stop();
    console.log(`\r${warn(msg || this.message)}`);
  }

  stop() {
    this.done = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export function progressBar(current, total, width = 30) {
  const pct = total > 0 ? current / total : 0;
  const filled = Math.round(width * pct);
  const empty = width - filled;
  const bar = c.brightCyan + '█'.repeat(filled) + c.dim + '░'.repeat(empty) + c.reset;
  const pctStr = `${Math.round(pct * 100)}%`.padStart(4);
  return `[${bar}] ${pctStr}`;
}

export function banner() {
  const lines = [
    c.brightCyan + '    ╔═══════════════════════════════════════════════╗' + c.reset,
    c.brightCyan + '    ║  ' + c.bold + c.brightWhite + '  ROBLOX STUDIO CLI' + c.reset + c.brightCyan + '                      ║' + c.reset,
    c.brightCyan + '    ║  ' + c.dim + '  MCP · Rojo · Blueprint V1' + c.reset + c.brightCyan + '              ║' + c.reset,
    c.brightCyan + '    ╚═══════════════════════════════════════════════╝' + c.reset,
  ];
  return lines.join('\n');
}

export function logo() {
  return [
    c.brightCyan + '    ____  ____  ____________  ______________  _____' + c.reset,
    c.brightCyan + '   / __ \\/ __ )/ ____/ __ \\/  _/ ____/ __ \\/ ___/' + c.reset,
    c.brightCyan + '  / /_/ / __  / /   / / / // // /   / / / /\\__ \\' + c.reset,
    c.brightCyan + ' / _, _/ /_/ / /___/ /_/ // // /___/ /_/ /___/ / ' + c.reset,
    c.brightCyan + '/_/ |_/_____/\\____/_____/___/\\____/_____//____/  ' + c.reset,
    c.dim + '              MCP · Rojo · Blueprint V1' + c.reset,
  ].join('\n');
}
