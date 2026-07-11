import { useState, useCallback, useRef } from 'react';
import type { FileNode } from '../types';
import {
  useFileStore,
  selectTree,
  selectActiveFilePath,
  selectAllTags,
} from '../store/useFileStore';

// ─── Inline Input ─────────────────────────────────────────────────────────────

interface InlineInputProps {
  placeholder: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  paddingLeft: number;
}

function InlineInput({ placeholder, onConfirm, onCancel, paddingLeft }: InlineInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = useCallback(() => {
    const val = inputRef.current?.value.trim() ?? '';
    if (val) onConfirm(val);
    else onCancel();
  }, [onConfirm, onCancel]);

  return (
    <div
      className="flex items-center h-6 my-0.5 bg-surface border border-accent/50 rounded-sm mx-1"
      style={{ paddingLeft }}
    >
      <input
        ref={inputRef}
        autoFocus
        type="text"
        placeholder={placeholder}
        className="selectable no-drag w-full bg-transparent text-xs text-text-primary placeholder:text-text-muted outline-none px-1"
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={commit}
      />
    </div>
  );
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface ContextMenuProps {
  x: number;
  y: number;
  node: FileNode;
  onClose: () => void;
  onDelete: (node: FileNode) => void;
}

function ContextMenu({ x, y, node, onClose, onDelete }: ContextMenuProps) {
  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={onClose} />
      <div
        className="fixed z-50 w-48 bg-panel border border-border rounded-lg shadow-card overflow-hidden animate-fade-in"
        style={{ top: y, left: x }}
      >
        <div className="px-3 py-1.5 border-b border-border">
          <p className="text-2xs font-medium text-text-muted truncate">{node.name.replace(/\.md$/, '')}</p>
        </div>
        {node.type === 'folder' && (
          <>
            <button
              className="no-drag w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-overlay transition-colors duration-100"
              onMouseDown={(e) => { e.stopPropagation(); onClose(); }}
            >
              New Note Inside
            </button>
            <button
              className="no-drag w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-overlay transition-colors duration-100"
              onMouseDown={(e) => { e.stopPropagation(); onClose(); }}
            >
              New Folder Inside
            </button>
            <div className="border-t border-border" />
          </>
        )}
        <button
          className="no-drag w-full text-left px-3 py-1.5 text-xs text-danger hover:bg-overlay transition-colors duration-100"
          onMouseDown={(e) => {
            e.stopPropagation();
            onDelete(node);
            onClose();
          }}
        >
          Delete {node.type === 'folder' ? 'Folder' : 'Note'}
        </button>
      </div>
    </>
  );
}

// ─── Tree Node ────────────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: FileNode;
  depth: number;
}

function TreeNode({ node, depth }: TreeNodeProps) {
  const [isOpen, setIsOpen]       = useState(depth === 0);
  const [creating, setCreating]   = useState<'file' | 'folder' | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Read from store — no prop drilling
  const activeFilePath = useFileStore(selectActiveFilePath);
  const openFile       = useFileStore((s) => s.openFile);
  const refreshTree    = useFileStore((s) => s.refreshTree);

  const indent   = 8 + depth * 12;
  const isFolder = node.type === 'folder';
  const isActive = !isFolder && node.path === activeFilePath;

  // ── Click ────────────────────────────────────────────────────────────────
  const handleClick = useCallback(() => {
    if (isFolder) setIsOpen((p) => !p);
    else openFile(node);
  }, [isFolder, node, openFile]);

  // ── Context menu ─────────────────────────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  // ── Create ───────────────────────────────────────────────────────────────
  const handleCreate = useCallback(
    async (name: string) => {
      if (!creating) return;
      const parentPath = isFolder
        ? node.path
        : node.path.replace(/[/\\][^/\\]+$/, '');
      const result = await window.electronAPI.createItem({ parentPath, name, type: creating });
      if (result.success) { setIsOpen(true); refreshTree(); }
      else console.error('[Sidebar] create failed:', result.error);
      setCreating(null);
    },
    [creating, isFolder, node.path, refreshTree],
  );

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (target: FileNode) => {
      const label = target.type === 'folder'
        ? `Permanently delete folder "${target.name}" and ALL its notes?`
        : `Permanently delete "${target.name.replace(/\.md$/, '')}"?`;
      if (!window.confirm(label)) return;
      const result = await window.electronAPI.deleteItem({ path: target.path });
      if (result.success) refreshTree();
      else console.error('[Sidebar] delete failed:', result.error);
    },
    [refreshTree],
  );

  // ── Chevron / dot indicator ──────────────────────────────────────────────
  const Indicator = isFolder ? (
    <svg
      width="7" height="7" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
      className={`flex-shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ) : (
    <span className="w-2 flex-shrink-0 flex items-center justify-center">
      <span className={`block w-[5px] h-[5px] rounded-full transition-colors duration-150 ${
        isActive ? 'bg-accent' : 'bg-border'
      }`} />
    </span>
  );

  return (
    <li id={`tree-node-${node.id.replace(/[^a-zA-Z0-9]/g, '-')}`}>
      {/* ── Row ──────────────────────────────────────────────────────────── */}
      <div
        role={isFolder ? 'button' : 'option'}
        aria-selected={isActive}
        className={`
          group relative flex items-center h-[28px] cursor-pointer select-none
          transition-all duration-200 ease-out
          ${isActive
            ? 'bg-[#1e1e1e]'
            : 'hover:bg-[#1a1a1a]'}
        `}
        style={{ paddingLeft: indent }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Indicator */}
        <span className="mr-1.5 text-text-muted">{Indicator}</span>

        {/* Label */}
        <span className={`
          flex-1 truncate text-[13px] leading-none tracking-wide
          ${isFolder
            ? 'font-medium text-gray-500'
            : isActive
              ? 'font-medium text-gray-200'
              : 'font-normal text-gray-600'}
        `}>
          {isFolder ? node.name : node.name.replace(/\.md$/, '')}
        </span>

        {/* Hover actions — only for folders */}
        {isFolder && (
          <div className="no-drag flex items-center gap-0.5 mr-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
            <button
              title="New Note"
              className="w-[18px] h-[18px] rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-overlay transition-all duration-200 ease-out active:scale-90 outline-none focus-visible:ring-1 focus-visible:ring-gray-700 text-sm leading-none"
              onClick={(e) => { e.stopPropagation(); setIsOpen(true); setCreating('file'); }}
            >
              +
            </button>
            <button
              title="New Folder"
              className="w-[18px] h-[18px] rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-overlay transition-all duration-200 ease-out active:scale-90 outline-none focus-visible:ring-1 focus-visible:ring-gray-700"
              onClick={(e) => { e.stopPropagation(); setIsOpen(true); setCreating('folder'); }}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y} node={node}
          onClose={() => setContextMenu(null)}
          onDelete={handleDelete}
        />
      )}

      {/* Children */}
      {isFolder && isOpen && (
        <ul>
          {creating && (
            <li>
              <InlineInput
                placeholder={creating === 'file' ? 'Note name…' : 'Folder name…'}
                paddingLeft={indent + 12}
                onConfirm={handleCreate}
                onCancel={() => setCreating(null)}
              />
            </li>
          )}
          {node.children && node.children.length > 0 ? (
            node.children.map((child) => (
              <TreeNode key={child.id} node={child} depth={depth + 1} />
            ))
          ) : !creating ? (
            <li>
              <span
                className="block text-[10px] text-text-muted italic py-0.5"
                style={{ paddingLeft: indent + 16 }}
              >
                empty
              </span>
            </li>
          ) : null}
        </ul>
      )}
    </li>
  );
}

// ─── Sidebar Root ─────────────────────────────────────────────────────────────

export default function Sidebar() {
  // All data comes from the store — zero prop drilling
  const tree            = useFileStore(selectTree);
  const allTags         = useFileStore(selectAllTags);
  const activeFilePath  = useFileStore(selectActiveFilePath);
  const openFile        = useFileStore((s) => s.openFile);
  const refreshTree     = useFileStore((s) => s.refreshTree);
  const triggerDailyNote = useFileStore((s) => s.triggerDailyNote);

  const [creatingAtRoot, setCreatingAtRoot] = useState<'file' | 'folder' | null>(null);
  const [searchQuery, setSearchQuery]       = useState('');

  // ── Flat search ──────────────────────────────────────────────────────────
  const flatFiles = useCallback((nodes: FileNode[]): FileNode[] =>
    nodes.flatMap((n) => n.type === 'file' ? [n] : flatFiles(n.children ?? [])),
  []);

  const filteredFiles = searchQuery.trim()
    ? flatFiles(tree).filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  // ── Root-level creation ──────────────────────────────────────────────────
  const handleRootCreate = useCallback(async (name: string) => {
    if (!creatingAtRoot) return;
    const first = tree[0];
    if (!first) return;
    const vaultRoot = first.path.replace(/[/\\][^/\\]+$/, '');
    await window.electronAPI.createItem({ parentPath: vaultRoot, name, type: creatingAtRoot });
    refreshTree();
    setCreatingAtRoot(null);
  }, [creatingAtRoot, tree, refreshTree]);

  return (
    <aside
      id="sidebar"
      className="flex flex-col bg-panel border-r border-border flex-shrink-0 overflow-hidden"
      style={{ width: '100%' }} // width is controlled by the parent flex container in App.tsx
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">
          Vault
        </span>
        <div className="no-drag flex items-center gap-1">
          <button
            id="btn-new-note-root"
            title="New Note"
            className="w-5 h-5 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-overlay transition-all duration-200 ease-out active:scale-95 outline-none focus-visible:ring-1 focus-visible:ring-gray-700 text-base leading-none"
            onClick={() => setCreatingAtRoot('file')}
          >
            +
          </button>
          <button
            id="btn-new-folder-root"
            title="New Folder"
            className="w-5 h-5 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-overlay transition-all duration-200 ease-out active:scale-95 outline-none focus-visible:ring-1 focus-visible:ring-gray-700"
            onClick={() => setCreatingAtRoot('folder')}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div className="px-2 py-1.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-1.5 px-2 h-6 bg-surface rounded border border-border focus-within:border-accent/50 transition-all duration-200 ease-out">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted flex-shrink-0">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="sidebar-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes…"
            className="selectable no-drag flex-1 min-w-0 bg-transparent text-xs text-text-primary placeholder:text-text-muted outline-none"
          />
          {searchQuery && (
            <button
              className="no-drag text-text-muted hover:text-text-secondary transition-all duration-200 ease-out active:scale-90 outline-none focus-visible:ring-1 focus-visible:ring-gray-700"
              onClick={() => setSearchQuery('')}
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Daily Note ────────────────────────────────────────────────── */}
      <div className="px-2 py-1 border-b border-border flex-shrink-0">
        <button
          onClick={triggerDailyNote}
          className="w-full flex items-center justify-center gap-2 h-6 rounded text-xs font-medium text-text-muted hover:text-text-primary hover:bg-overlay/50 transition-all duration-200 ease-out active:scale-95 outline-none focus-visible:ring-1 focus-visible:ring-gray-700"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Today
        </button>
      </div>

      {/* ── Tree / Search Results ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-1" role="tree">
        {/* Root-level creation input */}
        {creatingAtRoot && (
          <InlineInput
            placeholder={creatingAtRoot === 'file' ? 'Note name…' : 'Folder name…'}
            paddingLeft={8}
            onConfirm={handleRootCreate}
            onCancel={() => setCreatingAtRoot(null)}
          />
        )}

        {filteredFiles ? (
          filteredFiles.length > 0 ? (
            <ul>
              {filteredFiles.map((file) => (
                <li key={file.id}>
                  <button
                    className={`
                      no-drag w-full text-left flex items-center h-[26px] px-3 gap-2
                      transition-colors duration-100
                      ${file.path === activeFilePath
                        ? 'bg-overlay/80 border-l-2 border-accent text-text-primary'
                        : 'border-l-2 border-transparent hover:bg-overlay/40 text-text-secondary/70'}
                    `}
                    onClick={() => openFile(file)}
                  >
                    <span className={`block w-[5px] h-[5px] rounded-full flex-shrink-0 ${
                      file.path === activeFilePath ? 'bg-accent' : 'bg-border'
                    }`} />
                    <span className="text-[11.5px] truncate">
                      {file.name.replace(/\.md$/, '')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[10px] text-text-muted italic px-3 py-2">No results.</p>
          )
        ) : (
          tree.length > 0 ? (
            <ul>
              {tree.map((node) => (
                <TreeNode key={node.id} node={node} depth={0} />
              ))}
            </ul>
          ) : (
            <div className="px-3 py-6 text-center">
              <p className="text-[11px] text-text-muted">Your vault is empty.</p>
              <p className="text-[10px] text-text-muted mt-1 opacity-60">
                Press <kbd className="px-1 rounded bg-surface border border-border font-mono">+</kbd> to add a note.
              </p>
            </div>
          )
        )}
      </div>

      {/* ── Tags Section ────────────────────────────────────────────────── */}
      {!filteredFiles && allTags.length > 0 && (
        <div className="px-3 py-2 border-t border-border flex-shrink-0 max-h-32 overflow-y-auto">
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2">Tags</div>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-overlay text-text-secondary rounded text-[10px] truncate max-w-full">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer: vault path ──────────────────────────────────────────── */}
      <div className="px-3 py-1.5 border-t border-border flex-shrink-0">
        <p className="text-[10px] text-text-muted truncate opacity-40">
          {tree[0]?.path.replace(/[/\\][^/\\]+$/, '') ?? 'Noteer_Notes'}
        </p>
      </div>
    </aside>
  );
}
