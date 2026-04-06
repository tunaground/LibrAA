const JA_CORE_RE = /[\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF]/g;

// Brackets, delimiters, circled numbers, special symbols that should split blocks
// 【】「」『』（）〈〉《》[]()、circled numbers ①-⑳、※＊、and whitespace/newlines
const SPLIT_RE = /([\u0020\u3000\t\n\r]+|[\u3010\u3011\u300C\u300D\u300E\u300F\uFF08\uFF09\u3008\u3009\u300A\u300B\[\]\(\)\u2460-\u2473\u2474-\u2487\u2488-\u249B\u24EA-\u24FF\u203B\uFF0A])/;

function isJaBlock(token: string): boolean {
  const matches = token.match(JA_CORE_RE);
  return matches !== null && matches.length >= 2;
}

/**
 * Extract Japanese text blocks from a body string.
 * Splits on whitespace, newlines, and bracket characters.
 * Returns tokens that contain 2+ Japanese core chars.
 */
export function extractJaBlocks(body: string): string[] {
  const tokens = body.split(SPLIT_RE);
  return tokens.filter((t) => t && isJaBlock(t));
}

/**
 * Mark Japanese text blocks in body with [[...]] markers for LLM hints.
 * Returns the marked body string.
 */
export function markJaBlocks(body: string): string {
  const tokens = body.split(SPLIT_RE);
  return tokens
    .map((token) => {
      if (!token || SPLIT_RE.test(token)) return token;
      return isJaBlock(token) ? `[[${token}]]` : token;
    })
    .join("");
}

export { isJaBlock, JA_CORE_RE, SPLIT_RE };
