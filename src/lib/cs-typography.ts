const ONE_LETTER = /(^|\s)([kKsSvVzZoOuUaAiI]) (?=\S)/;

/** Czech typography: en dash, and a non-breaking space after one-letter prepositions. */
export function csCopy(input: string): string {
  let out = input.replace(/—/g, "–");
  // Repeat so "a k čemu" becomes "a\u00A0k\u00A0čemu". One pass consumes the space
  // between two single-letter words and misses the second.
  let prev = "";
  while (out !== prev) {
    prev = out;
    out = out.replace(ONE_LETTER, (_match, lead: string, letter: string) => `${lead}${letter}\u00A0`);
  }
  return out;
}
