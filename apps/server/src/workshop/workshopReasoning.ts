const OPEN_REASONING_TAGS = ["<think>", "<thinking>"];
const CLOSE_REASONING_TAGS = ["</think>", "</thinking>"];

export interface ParsedReasoningContent {
  content: string;
  reasoningContent: string;
}

export interface ReasoningDelta {
  type: "delta" | "reasoning-delta";
  text: string;
}

function findFirstTag(buffer: string, tags: string[]): { index: number; tag: string } | null {
  const lower = buffer.toLocaleLowerCase("und");
  let found: { index: number; tag: string } | null = null;
  for (const tag of tags) {
    const index = lower.indexOf(tag);
    if (index === -1) continue;
    if (!found || index < found.index) found = { index, tag };
  }
  return found;
}

function suffixPrefixLength(buffer: string, tags: string[]): number {
  const lower = buffer.toLocaleLowerCase("und");
  const maxLength = Math.min(lower.length, Math.max(...tags.map((tag) => tag.length)) - 1);
  for (let length = maxLength; length > 0; length -= 1) {
    const suffix = lower.slice(-length);
    if (tags.some((tag) => tag.startsWith(suffix))) return length;
  }
  return 0;
}

export function createReasoningParser() {
  let buffer = "";
  let inReasoning = false;

  function drain(): ReasoningDelta[] {
    const events: ReasoningDelta[] = [];
    while (buffer.length > 0) {
      if (!inReasoning) {
        const tag = findFirstTag(buffer, OPEN_REASONING_TAGS);
        if (tag) {
          if (tag.index > 0) events.push({ type: "delta", text: buffer.slice(0, tag.index) });
          buffer = buffer.slice(tag.index + tag.tag.length);
          inReasoning = true;
          continue;
        }
        const holdLength = suffixPrefixLength(buffer, OPEN_REASONING_TAGS);
        const visible = buffer.slice(0, buffer.length - holdLength);
        if (visible) events.push({ type: "delta", text: visible });
        buffer = buffer.slice(buffer.length - holdLength);
        break;
      }

      const tag = findFirstTag(buffer, CLOSE_REASONING_TAGS);
      if (tag) {
        if (tag.index > 0) events.push({ type: "reasoning-delta", text: buffer.slice(0, tag.index) });
        buffer = buffer.slice(tag.index + tag.tag.length);
        inReasoning = false;
        continue;
      }
      const holdLength = suffixPrefixLength(buffer, CLOSE_REASONING_TAGS);
      const reasoning = buffer.slice(0, buffer.length - holdLength);
      if (reasoning) events.push({ type: "reasoning-delta", text: reasoning });
      buffer = buffer.slice(buffer.length - holdLength);
      break;
    }
    return events;
  }

  return {
    push(chunk: string): ReasoningDelta[] {
      buffer += chunk;
      return drain();
    },
    finish(): ReasoningDelta[] {
      const leftover = buffer;
      buffer = "";
      return leftover ? [{ type: inReasoning ? "reasoning-delta" : "delta", text: leftover }] : [];
    },
  };
}

export function splitReasoningContent(raw: string): ParsedReasoningContent {
  const parser = createReasoningParser();
  let content = "";
  let reasoningContent = "";
  for (const event of [...parser.push(raw), ...parser.finish()]) {
    if (event.type === "reasoning-delta") reasoningContent += event.text;
    else content += event.text;
  }
  return { content, reasoningContent };
}
