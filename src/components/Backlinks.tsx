import { useCallback } from 'react';
import {
  useFileStore,
  selectActiveFileBacklinks,
  selectActiveFileNode,
} from '../store/useFileStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extracts the display name (basename without .md) from an absolute path. */
function displayName(absolutePath: string): string {
  const base = absolutePath.replace(/\\/g, '/').split('/').pop() ?? absolutePath;
  return base.replace(/\.md$/i, '');
}

// ─── Backlinks ────────────────────────────────────────────────────────────────

/**
 * Renders a list of files that link to the currently active note via [[...]].
 *
 * Design principles:
 *  - Unobtrusive: light typography, subtle border, no background pop
 *  - Zero visual noise when there are no backlinks
 *  - Each entry is clickable → opens that source note
 *  - Always rendered inside the Preview scroll container so it scrolls
 *    naturally with the rest of the content
 */
export default function Backlinks() {
  const backlinks  = useFileStore(selectActiveFileBacklinks);
  const activeNode = useFileStore(selectActiveFileNode);
  const openFile   = useFileStore((s) => s.openFile);
  const tree       = useFileStore((s) => s.tree);

  // Find the FileNode matching a backlink path so we can open it
  const handleClick = useCallback(
    (sourcePath: string) => {
      function findInTree(nodes: typeof tree): typeof tree[number] | null {
        for (const n of nodes) {
          if (n.path === sourcePath) return n;
          if (n.children) {
            const found = findInTree(n.children);
            if (found) return found;
          }
        }
        return null;
      }
      const node = findInTree(tree);
      if (node) openFile(node);
    },
    [tree, openFile],
  );

  // Don't render anything if there's no active file
  if (!activeNode) return null;

  return (
    <div
      id="backlinks-panel"
      className="flex-shrink-0 border-t border-border/50 px-8 py-5"
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        {/* Link-chain icon */}
        <svg
          width="11" height="11" viewBox="0 0 24 24"
          fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="text-text-muted flex-shrink-0"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest select-none">
          Backlinks
        </span>
        {backlinks.length > 0 && (
          <span className="ml-auto text-[10px] font-mono text-text-muted opacity-50 select-none">
            {backlinks.length}
          </span>
        )}
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {backlinks.length === 0 ? (
        <p className="text-[11px] text-text-muted opacity-40 italic leading-relaxed">
          No notes link to <span className="not-italic opacity-70">"{activeNode.name.replace(/\.md$/i, '')}"</span> yet.
          <br />
          Use <code className="font-mono text-[10px] not-italic bg-overlay/50 px-1 rounded">
            [[{activeNode.name.replace(/\.md$/i, '')}]]
          </code> in another note to create a connection.
        </p>
      ) : (
        /* ── Link list ──────────────────────────────────────────────────── */
        <ul className="space-y-0.5">
          {backlinks.map((sourcePath) => {
            const name = displayName(sourcePath);
            return (
              <li key={sourcePath}>
                <button
                  className="
                    group no-drag w-full text-left
                    flex items-center gap-2
                    py-1 rounded
                    text-[11.5px] text-text-muted
                    hover:text-text-secondary
                    transition-colors duration-100
                  "
                  onClick={() => handleClick(sourcePath)}
                  title={sourcePath}
                >
                  {/* Subtle dot indicator */}
                  <span className="
                    w-1 h-1 rounded-full flex-shrink-0
                    bg-text-muted group-hover:bg-accent
                    transition-colors duration-150
                  " />
                  <span className="truncate">{name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
