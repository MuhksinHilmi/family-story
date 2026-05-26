import React from 'react';

// Render plain text with @mentions highlighted as styled spans
// Matches @ followed by words/spaces/dot/dash until next punctuation or linebreak
// match only the immediate token after @ (no spaces) e.g. @Avida
const MENTION_REGEX = /@[\w\.\-]+/g;

export function renderWithMentions(text?: string | null, onClickMention?: (name: string) => void) {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    const idx = match.index;
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx));
    }

    const mentionText = match[0]; // includes @
    const display = mentionText;
    const name = mentionText.replace(/^@/, '').trim();

    if (onClickMention) {
      parts.push(
        <button
          key={`${mentionText}-${idx}`}
          onClick={() => onClickMention(name)}
          className="inline-block bg-[#D6EAD9] text-[#2E5239] rounded px-1 hover:bg-[#BEE6C6] transition"
          title={mentionText}
        >
          {display}
        </button>
      );
    } else {
      parts.push(
        <span
          key={`${mentionText}-${idx}`}
          className="inline-block bg-[#D6EAD9] text-[#2E5239] rounded px-1"
          title={mentionText}
        >
          {display}
        </span>
      );
    }

    lastIndex = idx + mentionText.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : text;
}
