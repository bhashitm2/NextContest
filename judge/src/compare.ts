/** Canonicalize program output for comparison: normalize CRLF, strip trailing
 * whitespace on every line, drop trailing blank lines. The standard lenient
 * judge comparison — spacing WITHIN a line still matters. */
export function normalizeOutput(s: string): string {
  const lines = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) lines[i] = lines[i].replace(/[ \t]+$/, "");
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

export function outputsMatch(actual: string, expected: string): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}
