// Widths belong to this render/font only. Never share manuscript text across jobs.
export function createPrintWidthMeasure(font) {
  const cache = new Map();
  const maxEntries = 16384, maxCharacters = 1048576;
  let characters = 0;
  return (text, size) => {
    if (cache.has(text)) return cache.get(text) * size;
    const value = font.widthOfTextAtSize(text, 1);
    if (text.length <= maxCharacters) {
      // FIFO is sufficient here: eviction only repeats an exact measurement.
      // Bound both many short keys and a smaller number of long text keys.
      while (cache.size >= maxEntries || characters + text.length > maxCharacters) {
        const oldest = cache.keys().next().value;
        characters -= oldest.length;
        cache.delete(oldest);
      }
      cache.set(text, value);
      characters += text.length;
    }
    return value * size;
  };
}

export function wrapPrintText(text, width, size, widthOf) {
  const words = text.normalize('NFC').replace(/\s+/gu, ' ').trim().split(' ');
  const wordWidths = words.map(word => {
    const value = widthOf(word, size);
    if (value > width + 0.01) throw new Error('print_unbreakable_token');
    return value;
  });
  const space = widthOf(' ', size), epsilon = 1e-7;

  // Keep the established algorithm for a font whose word boundaries reshape.
  // This path deliberately favors correctness over the optimized work budget.
  const exact = () => {
    const lines = [];
    let line = '', measured = 0;
    const flush = () => {if (line) lines.push({text: line, width: widthOf(line, size)}); line = ''; measured = 0;};
    for (const [index, word] of words.entries()) {
      if (line && measured + space + wordWidths[index] > width) flush();
      line = line ? `${line} ${word}` : word;
      measured = widthOf(line, size);
    }
    flush();
    return lines;
  };

  const lines = [];
  let line = '', estimated = 0;
  const flush = () => {
    if (line) {
      const actual = widthOf(line, size);
      if (Math.abs(actual - estimated) > epsilon) return false;
      lines.push({text: line, width: actual});
    }
    line = ''; estimated = 0;
    return true;
  };
  for (const [index, word] of words.entries()) {
    const wordWidth = wordWidths[index];
    if (index && Math.abs(widthOf(`${words[index - 1]} ${word}`, size) -
        (wordWidths[index - 1] + space + wordWidth)) > epsilon) return exact();
    let nextWidth = estimated + (line ? space : 0) + wordWidth;
    // Near the boundary, reproduce the previous measured-prefix decision rather
    // than allowing floating-point addition to choose another physical line.
    if (line && Math.abs(nextWidth - width) <= epsilon) {
      const actual = widthOf(line, size);
      if (Math.abs(actual - estimated) > epsilon) return exact();
      nextWidth = actual + space + wordWidth;
    }
    if (line && nextWidth > width) {
      if (!flush()) return exact();
      nextWidth = wordWidth;
    }
    line = line ? `${line} ${word}` : word;
    estimated = nextWidth;
  }
  if (!flush()) return exact();
  return lines;
}
