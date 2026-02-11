export function stripUtf8Bom(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return text;
  }
  if (text.charCodeAt(0) === 0xFEFF) {
    return text.slice(1);
  }
  return text;
}

export function normalizeLuaQuotedNewlines(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return text;
  }

  let out = '';
  let inSingle = false;
  let inDouble = false;
  let escape = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (escape) {
      out += ch;
      escape = false;
      continue;
    }

    if (ch === '\\') {
      out += ch;
      escape = inSingle || inDouble;
      continue;
    }

    if (!inDouble && ch === '\'') {
      inSingle = !inSingle;
      out += ch;
      continue;
    }

    if (!inSingle && ch === '"') {
      inDouble = !inDouble;
      out += ch;
      continue;
    }

    if ((inSingle || inDouble) && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      out += '\\n';
      continue;
    }

    out += ch;
  }

  return out;
}
