'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
} from 'react';
import {
  MERGE_TAG_REGEX,
  getLabel,
  isKnownField,
} from '@/lib/sms/merge-tags';
import { cn } from '@/lib/utils';

export interface MergeTagComposerHandle {
  insertTag: (key: string) => void;
  focus: () => void;
}

interface MergeTagComposerProps {
  value: string;
  onChange: (raw: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

const CHIP_CLASS =
  'inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md bg-accent/20 text-accent border border-accent/30 text-xs font-medium align-middle select-none';

function freshRegex(): RegExp {
  return new RegExp(MERGE_TAG_REGEX.source, 'g');
}

function isChip(node: Node): node is HTMLElement {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as HTMLElement).dataset?.field !== undefined
  );
}

function extractRaw(container: HTMLElement): string {
  let raw = '';
  container.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      raw += node.textContent ?? '';
    } else if (isChip(node)) {
      raw += `{{${(node as HTMLElement).dataset.field}}}`;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === 'BR') {
        raw += '\n';
      } else {
        raw += extractRaw(el);
      }
    }
  });
  return raw;
}

function buildChip(key: string): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.contentEditable = 'false';
  chip.setAttribute('data-field', key);
  chip.className = CHIP_CLASS;
  chip.textContent = getLabel(key);
  return chip;
}

const MergeTagComposer = forwardRef<MergeTagComposerHandle, MergeTagComposerProps>(
  function MergeTagComposer(
    {
      value,
      onChange,
      placeholder = 'Enter message content here...',
      id,
      className,
      'aria-label': ariaLabel,
    },
    ref
  ) {
    const editorRef = useRef<HTMLDivElement>(null);
    const lastValueRef = useRef<string | null>(null);
    const [isFocused, setIsFocused] = useState(false);

    const renderContent = useCallback((raw: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.innerHTML = '';
      let last = 0;
      const re = freshRegex();
      let m: RegExpExecArray | null;
      while ((m = re.exec(raw)) !== null) {
        if (m.index > last) {
          editor.appendChild(document.createTextNode(raw.slice(last, m.index)));
        }
        const key = m[1];
        if (isKnownField(key)) {
          editor.appendChild(buildChip(key));
        } else {
          editor.appendChild(document.createTextNode(m[0]));
        }
        last = re.lastIndex;
      }
      if (last < raw.length) {
        editor.appendChild(document.createTextNode(raw.slice(last)));
      }
    }, []);

    useEffect(() => {
      if (value !== lastValueRef.current) {
        renderContent(value);
        lastValueRef.current = value;
      }
    }, [value, renderContent]);

    const emit = useCallback(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const raw = extractRaw(editor);
      lastValueRef.current = raw;
      onChange(raw);
    }, [onChange]);

    const handleInput = useCallback(() => {
      emit();
    }, [emit]);

    const handlePaste = useCallback(
      (e: ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();
        const text = e.clipboardData?.getData('text/plain') ?? '';
        if (!text) return;
        const editor = editorRef.current;
        const sel = window.getSelection();
        if (!editor || !sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        if (!editor.contains(range.endContainer)) return;
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        emit();
      },
      [emit]
    );

    const insertTag = useCallback(
      (key: string) => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        const sel = window.getSelection();
        let range: Range;
        if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
          range = sel.getRangeAt(0);
          range.deleteContents();
        } else {
          range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
        }
        const chip = buildChip(key);
        const trailing = document.createTextNode(' ');
        const frag = document.createDocumentFragment();
        frag.appendChild(chip);
        frag.appendChild(trailing);
        range.insertNode(frag);
        const newRange = document.createRange();
        newRange.setStartAfter(trailing);
        newRange.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(newRange);
        lastValueRef.current = extractRaw(editor);
        onChange(lastValueRef.current);
      },
      [onChange]
    );

    useImperativeHandle(
      ref,
      () => ({
        insertTag,
        focus: () => editorRef.current?.focus(),
      }),
      [insertTag]
    );

    const showPlaceholder = !value.trim() && !isFocused;

    return (
      <div className="relative">
        <div
          ref={editorRef}
          id={id}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel ?? 'Message content'}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          onInput={handleInput}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn(
            'w-full min-h-[120px] max-h-[240px] overflow-y-auto rounded-xl bg-black/20 border border-white/10 text-sm text-white px-3 py-2 outline-none focus:border-accent/50 transition-colors whitespace-pre-wrap break-words',
            className
          )}
        />
        {showPlaceholder && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-2 text-sm text-text-muted/65"
          >
            {placeholder}
          </span>
        )}
      </div>
    );
  }
);

MergeTagComposer.displayName = 'MergeTagComposer';

export { MergeTagComposer };
