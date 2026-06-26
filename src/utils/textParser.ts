export interface ParsedLine {
  text: string; // Clean text
  rawText: string; // Original text line
  indent: number; // Raw indent character count
  lineNumber: number; // 0-indexed line number in editor
  emoji?: string;
  hasCheckbox?: boolean;
  checked?: boolean;
  link?: string;
  tags?: string[];
  notes?: string;
}

// Extract emojis (Unicode range or simple regex)
const EMOJI_REGEX = /^([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2B50}\u{2B06}\u{2194}\u{2195}\u{25C0}\u{25B6}\u{21A2}\u{21A3}\u{2934}\u{2935}\u{2B1B}\u{2B1C}\u{2B05}\u{2196}\u{2197}\u{2198}\u{2199}\u{21AA}\u{21AB}\u{2192}\u{2190}\u{2191}\u{2193}])\s*/u;

// Portuguese accent support for tags
const TAG_REGEX = /#([\w\u00C0-\u017F-]+)/g;

// URL Regex
const URL_REGEX = /(https?:\/\/[^\s)]+)/;

// Note parentheses at the end or inside brackets/quotes
const NOTE_PARENT_REGEX = /\(([^)]+)\)$/;
const NOTE_COMMENT_REGEX = /\/\/\s*(.+)$/;

export function parseTextToLines(text: string): ParsedLine[] {
  const lines = text.split("\n");
  const parsed: ParsedLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    
    // Calculate indentation
    const leadingWhitespaceMatch = rawLine.match(/^([ \t]*)/);
    const indentStr = leadingWhitespaceMatch ? leadingWhitespaceMatch[1] : "";
    
    // Calculate indentation weight: tabs weigh more (e.g. 4 spaces)
    let indentWeight = 0;
    for (const char of indentStr) {
      if (char === "\t") {
        indentWeight += 4;
      } else {
        indentWeight += 1;
      }
    }

    const trimmed = rawLine.trim();
    if (trimmed === "") {
      // Keep empty lines as spacers or skip them, skipping is better for mapping,
      // but we still want to keep the line number alignment!
      // To keep line alignment, we can add a placeholder or skip it.
      // Skipping empty lines is best for layout, but we must track the real lineNumber.
      continue;
    }

    let workingText = trimmed;

    // 1. Parse Checkbox: [ ] or [x] or [X]
    let hasCheckbox = false;
    let checked = false;
    const checkboxMatch = workingText.match(/^\[([ xX])\]\s*/);
    if (checkboxMatch) {
      hasCheckbox = true;
      checked = checkboxMatch[1].toLowerCase() === "x";
      workingText = workingText.replace(/^\[([ xX])\]\s*/, "");
    }

    // 2. Parse Emoji at start
    let emoji: string | undefined;
    const emojiMatch = workingText.match(EMOJI_REGEX);
    if (emojiMatch) {
      emoji = emojiMatch[1];
      workingText = workingText.replace(EMOJI_REGEX, "");
    }

    // 3. Parse Notes (parentheses at the end of the line, or comments)
    let notes: string | undefined;
    const noteParentMatch = workingText.match(NOTE_PARENT_REGEX);
    if (noteParentMatch) {
      notes = noteParentMatch[1].trim();
      workingText = workingText.replace(NOTE_PARENT_REGEX, "").trim();
    } else {
      const commentMatch = workingText.match(NOTE_COMMENT_REGEX);
      if (commentMatch) {
        notes = commentMatch[1].trim();
        workingText = workingText.replace(NOTE_COMMENT_REGEX, "").trim();
      }
    }

    // 4. Parse Links
    let link: string | undefined;
    const urlMatch = workingText.match(URL_REGEX);
    if (urlMatch) {
      link = urlMatch[1];
      workingText = workingText.replace(URL_REGEX, "").trim();
    }

    // 5. Parse Tags (#tag)
    const tags: string[] = [];
    let tagMatch;
    // We clone tag regex to reset state
    const currentTagRegex = new RegExp(TAG_REGEX);
    while ((tagMatch = currentTagRegex.exec(workingText)) !== null) {
      tags.push(tagMatch[1]);
    }
    // Clean up tags from display text
    workingText = workingText.replace(TAG_REGEX, "").trim();

    // Clean up double spaces or trailing dashes
    workingText = workingText.replace(/\s+/g, " ").trim();

    parsed.push({
      text: workingText || "Nó",
      rawText: rawLine,
      indent: indentWeight,
      lineNumber: i,
      emoji,
      hasCheckbox,
      checked,
      link,
      tags: tags.length > 0 ? tags : undefined,
      notes
    });
  }

  return parsed;
}

export interface TempNode {
  tempId: string;
  text: string;
  rawText: string;
  lineNumber: number;
  indent: number;
  level: number;
  parentId: string | null;
  childrenIds: string[];
  emoji?: string;
  hasCheckbox?: boolean;
  checked?: boolean;
  link?: string;
  tags?: string[];
  notes?: string;
}

export function buildTreeStructure(parsedLines: ParsedLine[]): TempNode[] {
  const nodes: TempNode[] = [];
  
  interface StackItem {
    tempId: string;
    indent: number;
    level: number;
  }
  
  const stack: StackItem[] = [];

  parsedLines.forEach((line, index) => {
    const tempId = `temp_${index}`;
    
    // Pop from stack until we find a parent with strictly less indentation
    while (stack.length > 0 && stack[stack.length - 1].indent >= line.indent) {
      stack.pop();
    }

    const parent = stack.length > 0 ? stack[stack.length - 1] : null;
    const level = parent ? parent.level + 1 : 0;
    const parentId = parent ? parent.tempId : null;

    const node: TempNode = {
      tempId,
      text: line.text,
      rawText: line.rawText,
      lineNumber: line.lineNumber,
      indent: line.indent,
      level,
      parentId,
      childrenIds: [],
      emoji: line.emoji,
      hasCheckbox: line.hasCheckbox,
      checked: line.checked,
      link: line.link,
      tags: line.tags,
      notes: line.notes
    };

    nodes.push(node);

    if (parent) {
      const parentNode = nodes.find(n => n.tempId === parent.tempId);
      if (parentNode) {
        parentNode.childrenIds.push(tempId);
      }
    }

    stack.push({
      tempId,
      indent: line.indent,
      level
    });
  });

  return nodes;
}
