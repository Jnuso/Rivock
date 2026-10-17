export type MarkdownAction = "bold" | "italic" | "list" | "quote" | "link";
export type MarkdownEdit = { value: string; start: number; end: number };

export function formatMarkdown(
  value: string,
  selection: { start: number; end: number },
  action: MarkdownAction,
): MarkdownEdit {
  const start = Math.max(0, Math.min(selection.start, value.length));
  const end = Math.max(start, Math.min(selection.end, value.length));
  const before = value.slice(0, start);
  const selected = value.slice(start, end);
  const after = value.slice(end);

  if (action === "bold" || action === "italic") {
    const marker = action === "bold" ? "**" : "*";
    const precedingStars = before.match(/\*+$/)?.[0].length ?? 0;
    const followingStars = after.match(/^\*+/)?.[0].length ?? 0;
    const alreadyFormatted =
      action === "bold"
        ? precedingStars >= 2 && followingStars >= 2
        : precedingStars % 2 === 1 && followingStars % 2 === 1;
    if (alreadyFormatted) {
      return {
        value:
          before.slice(0, -marker.length) +
          selected +
          after.slice(marker.length),
        start: start - marker.length,
        end: end - marker.length,
      };
    }
    const leading = selected.match(/^\s*/)?.[0] ?? "";
    const content = selected.trim() || "text";
    const trailing = selected.slice(leading.length).match(/\s*$/)?.[0] ?? "";
    return {
      value: before + leading + marker + content + marker + trailing + after,
      start: start + leading.length + marker.length,
      end: start + leading.length + marker.length + content.length,
    };
  }

  if (action === "link") {
    const label = (selected || "link text")
      .replace(/\r?\n/g, " ")
      .replace(/[\\[\]]/g, (character) => `\\${character}`);
    const prefix = `[${label}](`;
    return {
      value: before + prefix + "https://)" + after,
      start: start + prefix.length,
      end: start + prefix.length + "https://".length,
    };
  }

  const marker = action === "list" ? "- " : "> ";
  const lineStart = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
  const lastSelected = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const nextBreak = value.indexOf("\n", lastSelected);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const remove = lines.every((line) => line.startsWith(marker));
  const formatted = lines
    .map((line) => (remove ? line.slice(marker.length) : marker + line))
    .join("\n");
  const lineStarts: number[] = [];
  let offset = lineStart;
  for (const line of lines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }
  const move = (position: number) =>
    position +
    lineStarts.reduce((shift, line) => {
      if (position < line) return shift;
      return (
        shift +
        (remove ? -Math.min(marker.length, position - line) : marker.length)
      );
    }, 0);
  return {
    value: value.slice(0, lineStart) + formatted + value.slice(lineEnd),
    start: move(start),
    end: move(end),
  };
}
