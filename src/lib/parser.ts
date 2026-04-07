import type { ParsedResponse, ParsedThread } from "../types";

/**
 * Parse thread text into structured data using regex pattern matching.
 * Supports both single-line and multi-line header patterns.
 */

// Default patterns (single-line, with ^ and $ for line boundaries)
export const DEFAULT_HEADER_PATTERN =
  String.raw`^(\d+)\s*[：:]\s*(.+?)\s*[：:]\s*(\d{4}\/\d{2}\/\d{2}[^\n]*?)\s*(?:ID\s*[：:]?\s*(\S+))?$`;

export const LABELED_HEADER_PATTERN =
  String.raw`^(\d+)\s+(?:名前|Name)\s*[：:](.+?)(?:\[.*?\])?\s*(?:投稿日|Date)\s*[：:]\s*(\d{4}\/\d{2}\/\d{2}[^\n]*?)\s*(?:ID\s*[：:]?\s*(\S+))?$`;

export const DEFAULT_GROUP_MAP: GroupMap = {
  sequence: 1,
  authorName: 2,
  postedAt: 3,
  authorId: 4,
};

export interface GroupMap {
  sequence: number;
  authorName: number;
  postedAt: number;
  authorId: number;
}

/** Count capture groups in a regex pattern string */
export function countCaptureGroups(pattern: string): number {
  try {
    const re = new RegExp(pattern);
    const m = new RegExp(re.source + "|").exec("");
    return m ? m.length - 1 : 0;
  } catch {
    return 0;
  }
}

export interface HeaderMatch {
  match: string[];
  startOffset: number;  // char offset in full text where match starts
  endOffset: number;    // char offset in full text where match ends
  groupOffsets: { start: number; end: number }[]; // char offsets for each capture group
}

/** Find all header matches in text using global regex */
function findAllMatches(text: string, pattern: string, fallbackPattern?: string): { matches: HeaderMatch[]; error: string | null } {
  try {
    const re = new RegExp(pattern, "gm");
    const matches: HeaderMatch[] = [];

    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      matches.push(buildHeaderMatch(m, text));
      if (m[0].length === 0) re.lastIndex++; // prevent infinite loop
    }

    // Try fallback pattern if provided
    if (fallbackPattern) {
      const fbRe = new RegExp(fallbackPattern, "gm");
      while ((m = fbRe.exec(text)) !== null) {
        // Only add if not overlapping with existing matches
        const startOff = m.index;
        const endOff = m.index + m[0].length;
        const overlaps = matches.some((em) => startOff < em.endOffset && endOff > em.startOffset);
        if (!overlaps) {
          matches.push(buildHeaderMatch(m, text));
        }
        if (m[0].length === 0) fbRe.lastIndex++;
      }
      matches.sort((a, b) => a.startOffset - b.startOffset);
    }

    return { matches, error: null };
  } catch (e) {
    return { matches: [], error: (e as Error).message };
  }
}

function buildHeaderMatch(m: RegExpExecArray, text: string): HeaderMatch {
  const startOffset = m.index;
  const endOffset = m.index + m[0].length;
  const groupOffsets: { start: number; end: number }[] = [];

  let searchFrom = startOffset;
  for (let g = 1; g < m.length; g++) {
    if (m[g] == null) {
      groupOffsets.push({ start: -1, end: -1 });
      continue;
    }
    const idx = text.indexOf(m[g], searchFrom);
    if (idx >= 0 && idx < endOffset) {
      groupOffsets.push({ start: idx, end: idx + m[g].length });
      searchFrom = idx + m[g].length;
    } else {
      groupOffsets.push({ start: -1, end: -1 });
    }
  }

  return { match: [...m], startOffset, endOffset, groupOffsets };
}

/** Convert char offset to line number */
function offsetToLine(text: string, offset: number): number {
  let line = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

export interface LineHighlight {
  groupRanges: { start: number; end: number; group: number }[]; // ranges within this line
}

/** Test pattern and return per-line highlight info */
export function testPattern(text: string, pattern: string, fallbackPattern?: string): {
  matchedLines: Map<number, LineHighlight>;
  firstMatch: string[] | null;
  matchCount: number;
  error: string | null;
} {
  if (!text) return { matchedLines: new Map(), firstMatch: null, matchCount: 0, error: null };

  const { matches, error } = findAllMatches(text, pattern, fallbackPattern);
  if (error) return { matchedLines: new Map(), firstMatch: null, matchCount: 0, error };

  const lineStarts: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") lineStarts.push(i + 1);
  }

  const matchedLines = new Map<number, LineHighlight>();

  for (const hm of matches) {
    // Mark all lines covered by this match
    const startLine = offsetToLine(text, hm.startOffset);
    const endLine = offsetToLine(text, Math.max(hm.startOffset, hm.endOffset - 1));

    for (let line = startLine; line <= endLine; line++) {
      if (!matchedLines.has(line)) {
        matchedLines.set(line, { groupRanges: [] });
      }
    }

    // Add group ranges relative to their line
    for (let g = 0; g < hm.groupOffsets.length; g++) {
      const go = hm.groupOffsets[g];
      if (go.start < 0) continue;
      const gStartLine = offsetToLine(text, go.start);
      const lineStart = lineStarts[gStartLine] ?? 0;
      const highlight = matchedLines.get(gStartLine);
      if (highlight) {
        highlight.groupRanges.push({
          start: go.start - lineStart,
          end: go.end - lineStart,
          group: g,
        });
      }
    }
  }

  return {
    matchedLines,
    firstMatch: matches.length > 0 ? matches[0].match : null,
    matchCount: matches.length,
    error: null,
  };
}

export function parseThreadText(rawText: string, customPattern?: string, groupMap?: GroupMap): ParsedThread {
  const gm = groupMap ?? DEFAULT_GROUP_MAP;
  let pattern: string;
  let fallbackPattern: string | undefined;

  if (customPattern) {
    pattern = customPattern;
  } else {
    pattern = DEFAULT_HEADER_PATTERN;
    fallbackPattern = LABELED_HEADER_PATTERN;
  }

  const { matches, error } = findAllMatches(rawText, pattern, fallbackPattern);
  if (error || matches.length === 0) {
    if (rawText.trim()) {
      return { responses: [{ sequence: 1, body: rawText.trim() }] };
    }
    return { responses: [] };
  }

  const responses: ParsedResponse[] = [];

  for (let i = 0; i < matches.length; i++) {
    const hm = matches[i];
    const m = hm.match;

    // Body is text between end of this header and start of next header (or end of text)
    const bodyStart = hm.endOffset;
    const bodyEnd = i + 1 < matches.length ? matches[i + 1].startOffset : rawText.length;
    let body = rawText.slice(bodyStart, bodyEnd);

    // Strip leading/trailing blank lines
    const bodyLines = body.split("\n");
    let start = 0;
    let end = bodyLines.length - 1;
    while (start <= end && bodyLines[start].trim() === "") start++;
    while (end >= start && bodyLines[end].trim() === "") end--;
    body = bodyLines.slice(start, end + 1).join("\n");

    const response: ParsedResponse = {
      sequence: gm.sequence > 0 ? parseInt(m[gm.sequence] ?? "0", 10) : 0,
      authorName: gm.authorName > 0 ? m[gm.authorName]?.trim() || undefined : undefined,
      postedAt: gm.postedAt > 0 ? m[gm.postedAt]?.trim() || undefined : undefined,
      authorId: gm.authorId > 0 ? m[gm.authorId]?.trim() || undefined : undefined,
      body,
    };

    if (response.body || response.sequence) {
      responses.push(response);
    }
  }

  if (responses.length === 0 && rawText.trim()) {
    responses.push({ sequence: 1, body: rawText.trim() });
  }

  return { responses };
}
