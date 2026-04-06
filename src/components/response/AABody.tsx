import { useCallback } from "react";

import { isJaBlock, SPLIT_RE } from "../../lib/ja-blocks";

interface AABodyProps {
  body: string;
  responseId: string;
  shiftHeld: boolean;
  translatingBlock: string | null;
  onTranslateBlock: (responseId: string, text: string) => void;
}

export function AABody({ body, responseId, shiftHeld, translatingBlock, onTranslateBlock }: AABodyProps) {
  const handleClick = useCallback(
    (text: string) => {
      if (shiftHeld) {
        onTranslateBlock(responseId, text);
      }
    },
    [shiftHeld, responseId, onTranslateBlock],
  );

  // Split preserving whitespace and newlines as separators
  const parts: Array<{ text: string; isJa: boolean }> = [];
  const tokens = body.split(SPLIT_RE);
  for (const token of tokens) {
    if (!token) continue;
    if (SPLIT_RE.test(token)) {
      parts.push({ text: token, isJa: false });
    } else {
      parts.push({ text: token, isJa: isJaBlock(token) });
    }
  }

  if (parts.every((p) => !p.isJa)) {
    return <>{body}</>;
  }

  return (
    <>
      {parts.map((part, i) =>
        part.isJa ? (
          <span
            key={i}
            className={shiftHeld ? "ja-block" : undefined}
            onClick={() => handleClick(part.text)}
            onMouseDown={shiftHeld ? (e) => e.preventDefault() : undefined}
            style={{
              cursor: shiftHeld ? "pointer" : undefined,
              backgroundColor: translatingBlock === part.text ? "var(--color-primary-subtle)" : undefined,
            }}
          >
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
