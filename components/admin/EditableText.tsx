'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ElementType,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useSite } from '@/components/SiteProvider';

interface EditableTextProps {
  /** The stored value — the raw text, which for a markdown field is the
   *  source rather than the rendered output. */
  value: string;
  /** Called with the new value only when it actually changed. */
  onSave: (next: string) => void;
  /** Element to render. Must be one that can hold text. */
  as?: ElementType;
  /** Enter inserts a line break instead of committing. */
  multiline?: boolean;
  /** What to show when not editing, if it isn't just `value` — a rendered
   *  markdown subtree, say. Editing always works on the raw `value`. */
  children?: ReactNode;
  /** Shown dimmed when the value is empty. Only the owner ever sees it; a
   *  reader gets nothing rather than a hint about an unfilled field. */
  placeholder?: string;
  className?: string;
}

/**
 * A span of page text that the site owner can double-click and edit in
 * place.
 *
 * `contenteditable`, not an input swapped in on click. An input cannot
 * inherit the surrounding typography — the 8xl hero name and the 12px
 * category chip would each need their own sizing — and the moment the text
 * reflows differently in the editor than on the page, editing stops being
 * "in place" and becomes a form that happens to be positioned nearby.
 *
 * Three consequences of that choice, all handled here:
 *
 *   - `plaintext-only` keeps pasted formatting out. The value read back is
 *     `textContent`/`innerText` regardless, so markup could never be saved,
 *     but without this the user watches it appear and assumes it was.
 *   - React must not own the children while the DOM is being typed into.
 *     It renders none during an edit, and the element is remounted (via
 *     `generation`) on the way out so React's picture of the DOM and the
 *     DOM itself can never disagree.
 *   - Commit is on blur, which means clicking away saves. That is the right
 *     default for a page where the next thing you click is usually the next
 *     field; Escape is the way to not save.
 */
export default function EditableText({
  value,
  onSave,
  as,
  multiline = false,
  children,
  placeholder,
  className = '',
}: EditableTextProps) {
  const { editing } = useSite();
  /** Non-null while editing; holds the value as it was when editing began,
   *  which is what "did this actually change" is measured against. */
  const [draft, setDraft] = useState<string | null>(null);
  /** Bumped on every exit from edit mode to force a remount. */
  const [generation, setGeneration] = useState(0);
  const ref = useRef<HTMLElement>(null);

  const isEditing = draft !== null;

  // Seed the element with the raw value and put the caret in it. This runs
  // once per edit session: `draft` is set on entry and cleared on exit, and
  // never changes in between.
  useEffect(() => {
    if (draft === null) return;
    const node = ref.current;
    if (!node) return;

    node.textContent = draft;
    node.focus();

    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [draft]);

  // Leaving edit mode entirely — including when the owner switches editing
  // off mid-field — has to go through the same remount, or React appends
  // its children next to the text the user typed.
  const exit = useCallback(() => {
    setDraft(null);
    setGeneration((current) => current + 1);
  }, []);

  const commit = useCallback(() => {
    const node = ref.current;
    if (node && draft !== null) {
      // `innerText` collapses the <div>/<br> soup a contenteditable makes
      // of line breaks back into '\n'; `textContent` would run the lines
      // together. For a single-line field the reverse holds — innerText
      // would smuggle in a newline the value is not allowed to have.
      const raw = multiline ? node.innerText : (node.textContent ?? '');
      const next = multiline ? raw.replace(/\s+$/, '') : raw.replace(/\s+/g, ' ').trim();
      if (next !== draft) onSave(next);
    }
    exit();
  }, [draft, multiline, onSave, exit]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      exit();
      return;
    }
    // Cmd/Ctrl+Enter commits a multiline field, where a bare Enter is a
    // line break the user meant to type.
    if (event.key === 'Enter' && (!multiline || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      commit();
    }
  }

  const Tag = (as ?? 'span') as ElementType;

  if (!editing) {
    // A reader's DOM carries none of this: no handlers, no extra classes,
    // no placeholder. The page is exactly what it would be without an admin
    // layer at all.
    return <Tag className={className}>{children ?? value}</Tag>;
  }

  if (isEditing) {
    return (
      <Tag
        key={generation}
        ref={ref}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        role="textbox"
        aria-multiline={multiline}
        spellCheck
        onKeyDown={handleKeyDown}
        onBlur={commit}
        className={`${className} ${multiline ? 'whitespace-pre-wrap' : ''}`}
      />
    );
  }

  return (
    <Tag
      key={generation}
      onDoubleClick={() => setDraft(value)}
      title="Double-click to edit"
      className={`${className} cursor-text rounded-sm decoration-edit/50 decoration-dotted underline-offset-4 hover:underline`}
    >
      {value.length === 0 && placeholder ? (
        <span className="text-edit/60 italic">{placeholder}</span>
      ) : (
        (children ?? value)
      )}
    </Tag>
  );
}
