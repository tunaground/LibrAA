import type { ParsedResponse, ParsedThread } from "../types";

/**
 * Parse 2ch/5ch style thread text into structured data.
 *
 * Expected format:
 *   1 名前：◆xxx[] 投稿日：2023/01/01(日) 00:00:00.00 ID:XXXXXXXX0
 *   (body content)
 *
 *   2 名前：以下、名無し...
 *   (body content)
 */
export function parseThreadText(rawText: string): ParsedThread {
  const lines = rawText.split("\n");
  const responses: ParsedResponse[] = [];

  // Pattern to match response headers
  // Matches: number, optional name field, optional date field, optional ID field
  const headerPattern =
    /^(\d+)\s+(?:名前|Name)\s*[：:](.+?)(?:\[.*?\])?\s*(?:投稿日|Date)\s*[：:]\s*(\d{4}\/\d{2}\/\d{2}[^\n]*?)\s*(?:ID\s*[：:]?\s*(\S+))?$/;

  // Simpler pattern for when format doesn't have explicit field labels
  const simpleHeaderPattern =
    /^(\d+)\s*[：:]\s*(.+?)\s*[：:]\s*(\d{4}\/\d{2}\/\d{2}[^\n]*?)\s*(?:ID\s*[：:]?\s*(\S+))?$/;

  let currentResponse: ParsedResponse | null = null;
  let bodyLines: string[] = [];

  const finalizeResponse = () => {
    if (currentResponse) {
      // Strip leading/trailing blank lines but preserve whitespace within lines
      let start = 0;
      let end = bodyLines.length - 1;
      while (start <= end && bodyLines[start].trim() === "") start++;
      while (end >= start && bodyLines[end].trim() === "") end--;
      currentResponse.body = bodyLines.slice(start, end + 1).join("\n");
      if (currentResponse.body || currentResponse.sequence) {
        responses.push(currentResponse);
      }
    }
  };

  for (const line of lines) {
    let match = headerPattern.exec(line.trim());
    if (!match) {
      match = simpleHeaderPattern.exec(line.trim());
    }

    if (match) {
      finalizeResponse();
      currentResponse = {
        sequence: parseInt(match[1], 10),
        authorName: match[2]?.trim() || undefined,
        postedAt: match[3]?.trim() || undefined,
        authorId: match[4]?.trim() || undefined,
        body: "",
      };
      bodyLines = [];
    } else if (currentResponse) {
      bodyLines.push(line);
    }
  }

  finalizeResponse();

  // If no structured responses found, treat entire text as a single response
  if (responses.length === 0 && rawText.trim()) {
    responses.push({
      sequence: 1,
      body: rawText.trim(),
    });
  }

  return {
    responses,
  };
}
