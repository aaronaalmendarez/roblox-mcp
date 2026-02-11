export function stripUtf8Bom(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return text;
  }
  if (text.charCodeAt(0) === 0xFEFF) {
    return text.slice(1);
  }
  return text;
}

