/**
 * ExcalidrawCanvas.tsx  —  Phase 20: Freeform Canvas Mode
 *
 * Lazy-loads the Excalidraw library to keep the initial bundle lean.
 * Persists canvas data as `<note-stem>.excalidraw.json` next to the active note.
 * Keyboard shortcuts (Ctrl+S, Ctrl+F, Ctrl+P) are intercepted and re-dispatched
 * so Noteer global handlers remain in control.
 */

import { lazy, Suspense, useEffect, useRef, useCallback, useState } from 'react';

type ExcalidrawElement = any;
type AppState = any;
type BinaryFiles = any;
type ExcalidrawImperativeAPI = any;
import {
  useFileStore,
  selectActiveFilePath,
  selectActiveFileNode,
} from '../store/useFileStore';
import { useSettingsStore } from '../store/useSettingsStore';

// ── Lazy import to keep initial bundle lean ───────────────────────────────────
const Excalidraw = lazy(async () => {
  const m = await import('@excalidraw/excalidraw');
  return { default: m.Excalidraw };
});

// ── Debounce helper ───────────────────────────────────────────────────────────
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

// ── Canvas path helper ────────────────────────────────────────────────────────
/** Derives the .excalidraw.json sibling path from the current .md path */
function canvasPath(mdPath: string): string {
  return mdPath.replace(/\.md$/i, '.excalidraw.json');
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function CanvasLoader() {
  return (
    <div className="flex flex-col flex-1 h-full w-full bg-[#121212] items-center justify-center gap-3">
      <svg
        className="animate-spin text-gray-600"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <span className="text-[11px] text-gray-600 tracking-wider">Loading canvas…</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ExcalidrawCanvas() {
  const activeFilePath = useFileStore(selectActiveFilePath);
  const activeNode     = useFileStore(selectActiveFileNode);
  const setUI          = useSettingsStore((s) => s.setUI);

  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [initialData, setInitialData] = useState<{
    elements: readonly ExcalidrawElement[];
    appState: Partial<AppState>;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const currentCanvasPath = useRef<string | null>(null);

  // ── Load saved canvas on file change ───────────────────────────────────────
  useEffect(() => {
    if (!activeFilePath) {
      setInitialData({ elements: [], appState: {} });
      return;
    }

    const cp = canvasPath(activeFilePath);
    currentCanvasPath.current = cp;
    setInitialData(null); // trigger re-mount with fresh data
    setLoadError(null);

    (async () => {
      try {
        const result = await window.electronAPI.readFile({ path: cp });
        if (result.success && result.content) {
          const parsed = JSON.parse(result.content);
          setInitialData({
            elements: parsed.elements ?? [],
            appState: {
              ...(parsed.appState ?? {}),
              // Always force dark theme regardless of saved state
              theme: 'dark',
              viewBackgroundColor: '#121212',
            },
          });
        } else {
          // New canvas for this note
          setInitialData({
            elements: [],
            appState: { theme: 'dark', viewBackgroundColor: '#121212' },
          });
        }
      } catch {
        setInitialData({
          elements: [],
          appState: { theme: 'dark', viewBackgroundColor: '#121212' },
        });
      }
    })();
  }, [activeFilePath]);

  // ── Auto-save on change (debounced 1.5 s) ──────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saveCanvas = useCallback(
    debounce(async (elements: readonly ExcalidrawElement[], appState: AppState, _files: BinaryFiles) => {
      const cp = currentCanvasPath.current;
      if (!cp) return;
      const data = JSON.stringify({ elements, appState }, null, 2);
      try {
        await window.electronAPI.saveFile({ path: cp, content: data });
      } catch {
        // Non-critical: silently skip if save fails
      }
    }, 1500) as unknown as (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => void,
    [],
  );

  // ── Keyboard shield: let Noteer keep Ctrl+S, Ctrl+F, Ctrl+P ───────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (['s', 'f', 'p', 'k'].includes(key)) {
          // Don't preventDefault — let the event bubble up to global keybind handlers
          e.stopImmediatePropagation();
          // Re-dispatch on document so Noteer's window-level handlers fire
          const clone = new KeyboardEvent('keydown', e);
          document.dispatchEvent(clone);
        }
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  // ── Empty state when no file open ─────────────────────────────────────────
  if (!activeFilePath || !activeNode) {
    return (
      <div className="flex flex-col flex-1 h-full w-full bg-[#121212] items-center justify-center gap-3">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3f3f46" strokeWidth="1.5" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
        <p className="text-[12px] text-gray-600">Open a note to start sketching</p>
        <button
          onClick={() => setUI({ viewMode: 'edit' })}
          className="text-[11px] text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors"
        >
          Back to editor
        </button>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col flex-1 h-full w-full bg-[#121212] items-center justify-center gap-2">
        <p className="text-[12px] text-red-400">Canvas load error: {loadError}</p>
        <button onClick={() => setUI({ viewMode: 'edit' })} className="text-[11px] text-gray-500 underline">
          Back to editor
        </button>
      </div>
    );
  }

  // Wait until initial data is ready before mounting Excalidraw
  // (prevents a flash of empty canvas that would overwrite saved data)
  if (!initialData) {
    return <CanvasLoader />;
  }

  return (
    <div
      className="flex flex-col flex-1 h-full w-full overflow-hidden"
      style={{ background: '#121212' }}
    >
      {/* ── Canvas header bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between h-9 px-4 border-b border-[#1e1e1e] flex-shrink-0 bg-[#0e0e0e]">
        <div className="flex items-center gap-2">
          {/* Pencil icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
          <span className="text-[11px] text-gray-500 font-medium truncate max-w-[200px]">
            {activeNode.name.replace(/\.md$/i, '')}
          </span>
          <span className="text-[9px] text-gray-700 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-1.5 py-0.5 uppercase tracking-widest">
            Canvas
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-gray-700 hidden sm:block">
            Auto-saved · {activeNode.name.replace(/\.md$/i, '')}.excalidraw.json
          </span>
          <button
            onClick={() => setUI({ viewMode: 'edit' })}
            className="flex items-center gap-1.5 text-[10px] text-gray-600 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-[#1a1a1a] border border-transparent hover:border-[#2a2a2a]"
            title="Back to editor"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Editor
          </button>
        </div>
      </div>

      {/* ── Excalidraw ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative" style={{ background: '#121212' }}>
        <Suspense fallback={<CanvasLoader />}>
          <Excalidraw
            excalidrawAPI={(api) => { apiRef.current = api; }}
            initialData={initialData}
            theme="dark"
            onChange={saveCanvas}
            UIOptions={{
              canvasActions: {
                saveToActiveFile: false,
                loadScene: false,
                export: { saveFileToDisk: true },
              },
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
