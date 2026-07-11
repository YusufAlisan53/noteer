import { useRef, useCallback, useEffect } from 'react';
import { useFileStore, selectActiveFilePath, selectActiveFileContent, selectActiveFileNode } from '../store/useFileStore';
import { useSettingsStore, selectEditor } from '../store/useSettingsStore';

// ─── Tab key interceptor ──────────────────────────────────────────────────────
// Converts Tab/Shift+Tab into soft-tab indentation instead of focus-jumping.
function handleTabKey(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  tabSize: number,
): void {
  if (e.key !== 'Tab') return;
  e.preventDefault();

  const el    = e.currentTarget;
  const start = el.selectionStart;
  const end   = el.selectionEnd;
  const value = el.value;
  const spaces = ' '.repeat(tabSize);

  if (e.shiftKey) {
    // Shift+Tab: remove leading spaces from current line
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const line      = value.slice(lineStart, end);
    if (line.startsWith(spaces)) {
      const next =
        value.slice(0, lineStart) +
        line.slice(tabSize) +
        value.slice(end);
      // Use execCommand for React-controlled undo support
      document.execCommand('selectAll', false);
      document.execCommand('insertText', false, next);
      el.setSelectionRange(start - tabSize, end - tabSize);
    }
  } else {
    // Tab: insert spaces at cursor
    const next =
      value.slice(0, start) + spaces + value.slice(end);
    document.execCommand('selectAll', false);
    document.execCommand('insertText', false, next);
    el.setSelectionRange(start + tabSize, start + tabSize);
  }
}

// ─── Editor ───────────────────────────────────────────────────────────────────

/**
 * The core writing surface. A pure, frameless textarea that:
 *  - reads content from the file store
 *  - calls updateContent (which debounces auto-save) on every change
 *  - honours all editor settings (font size, word wrap, tab size, font family)
 *  - intercepts Tab key for soft-tab indentation
 *  - re-mounts cleanly when the active file changes (key prop strategy)
 *  - applies no visible outline or border on focus (pure zen aesthetic)
 */
export default function Editor() {
  const activeNode   = useFileStore(selectActiveFileNode);
  const filePath     = useFileStore(selectActiveFilePath);
  const content      = useFileStore(selectActiveFileContent);
  const updateContent = useFileStore((s) => s.updateContent);
  const isSaving     = useFileStore((s) => s.isSaving);
  const saveError    = useFileStore((s) => s.saveError);
  const clearSaveError = useFileStore((s) => s.clearSaveError);

  const editorSettings = useSettingsStore(selectEditor);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  // Focus editor whenever a new file is opened
  useEffect(() => {
    if (activeNode && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [activeNode?.path]); // intentional: only re-run on file path change

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateContent(e.target.value);
    },
    [updateContent],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      handleTabKey(e, editorSettings.tabSize);
    },
    [editorSettings.tabSize],
  );

  // ── Empty state ─────────────────────────────────────────────────────────
  if (!activeNode) {
    return (
      <div
        id="editor-empty"
        className="flex flex-col flex-1 min-w-0 items-center justify-center gap-4 bg-surface opacity-20 select-none"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <polyline points="13 2 13 9 20 9" />
        </svg>
        <p className="text-xs text-text-muted font-medium tracking-wide">Open a note to start writing</p>
      </div>
    );
  }

  return (
    <div id="editor-container" className="flex flex-col w-full h-full bg-[#121212] relative overflow-hidden">
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div
        id="editor-toolbar"
        className="flex items-center justify-between px-4 h-9 border-b border-border flex-shrink-0 bg-surface"
      >
        <span className="text-xs font-medium text-text-secondary truncate">
          {activeNode.name.replace(/\.md$/, '')}
        </span>
        <div className="flex items-center gap-2">
          {/* Save indicator */}
          {isSaving && (
            <span className="text-2xs text-text-muted animate-pulse">saving…</span>
          )}
          {saveError && (
            <span
              className="text-2xs text-danger cursor-pointer hover:underline"
              title={saveError}
              onClick={clearSaveError}
            >
              save failed ✗
            </span>
          )}
          {!isSaving && !saveError && filePath && (
            <span className="text-2xs text-text-muted opacity-40">saved</span>
          )}
          <span className="badge">MD</span>
        </div>
      </div>

      {/* ── Textarea ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 w-full h-full overflow-hidden p-8 box-border max-w-3xl mx-auto">
        <textarea
          ref={textareaRef}
          id="editor-textarea"
          // key forces a full remount when the file changes so scroll position
          // and undo history reset cleanly
          key={filePath ?? '__empty__'}
          aria-label={`Editing ${activeNode.name}`}
          className={[
            'selectable no-drag',
            'flex-1 w-full h-full resize-none outline-none bg-transparent overflow-y-auto',
            'border-none',
              'text-gray-300',
              'leading-loose',
              'caret-gray-400',
              // Padding
              'py-4',
              editorSettings.wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre overflow-x-auto',
            ].join(' ')}
            style={{
              fontSize:   `${editorSettings.fontSize}px`,
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              tabSize:     editorSettings.tabSize,
            }}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Start writing…"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
      </div>
    </div>
  );
}
