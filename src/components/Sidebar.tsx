import { useState, useCallback, useRef, useEffect } from 'react';
import type { FileNode } from '../types';
import {
  useFileStore,
  selectTree,
  selectAllTags,
  selectSearchQuery,
  selectSearchResults,
  selectIsSearching,
  selectAllTagsData,
  selectSelectedTags,
  selectActiveFilePath,
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
  const openFile        = useFileStore((s) => s.openFile);
  const refreshTree     = useFileStore((s) => s.refreshTree);

  const searchQuery     = useFileStore(selectSearchQuery);
  const searchResults   = useFileStore(selectSearchResults);
  const isSearching     = useFileStore(selectIsSearching);
  const setSearchQuery  = useFileStore((s) => s.setSearchQuery);
  const executeSearch   = useFileStore((s) => s.executeSearch);

  const [creatingAtRoot, setCreatingAtRoot] = useState<'file' | 'folder' | null>(null);
  
  // ── View Toggle ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'files' | 'search' | 'tags'>('files');

  // ── Debounced Search ─────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'search') {
        executeSearch(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab, executeSearch]);

  // ── Tag Filter State ──────────────────────────────────────────────
  const allTagsData    = useFileStore(selectAllTagsData);
  const selectedTags   = useFileStore(selectSelectedTags);
  const toggleTagFilter = useFileStore((s) => s.toggleTagFilter);
  const clearTagFilters = useFileStore((s) => s.clearTagFilters);

  // ── Flat file list for tag filtering ─────────────────────────────
  const flatFiles = useCallback((nodes: FileNode[]): FileNode[] =>
    nodes.flatMap((n) => n.type === 'file' ? [n] : flatFiles(n.children ?? [])),
  []);

  const tagFilteredFiles = selectedTags.length > 0
    ? flatFiles(tree).filter((f) =>
        selectedTags.every((tag) =>
          (f.tags ?? []).includes(tag)
        )
      )
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
      {/* ── Header / View Toggle ────────────────────────────────────────── */}
      <div className="flex items-center px-3 py-2 border-b border-border flex-shrink-0 gap-2">
        <button
          className={`flex-1 flex items-center justify-center gap-1.5 h-7 rounded text-[11px] font-medium transition-all duration-200 ${
            activeTab === 'files' ? 'bg-overlay text-text-primary shadow-sm' : 'text-text-muted hover:bg-overlay/50 hover:text-text-secondary'
          }`}
          onClick={() => setActiveTab('files')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Files
        </button>
        <button
          className={`flex-1 flex items-center justify-center gap-1.5 h-7 rounded text-[11px] font-medium transition-all duration-200 ${
            activeTab === 'search' ? 'bg-overlay text-text-primary shadow-sm' : 'text-text-muted hover:bg-overlay/50 hover:text-text-secondary'
          }`}
          onClick={() => setActiveTab('search')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Search
        </button>
        <button
          className={`flex-1 flex items-center justify-center gap-1.5 h-7 rounded text-[11px] font-medium transition-all duration-200 ${
            activeTab === 'tags' ? 'bg-overlay text-text-primary shadow-sm' : 'text-text-muted hover:bg-overlay/50 hover:text-text-secondary'
          }`}
          onClick={() => setActiveTab('tags')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
          Tags
        </button>
      </div>

      {activeTab === 'files' && (
        <div className="px-2 py-1.5 border-b border-border flex-shrink-0 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest pl-1">
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
      )}

      {/* ── Search Input ──────────────────────────────────────────────────────── */}
      {activeTab === 'search' && (
        <div className="px-2 py-2 border-b border-border flex-shrink-0 bg-[#161616]">
          <input
            autoFocus
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in all notes..."
            className="selectable no-drag w-full bg-[#1a1a1a] border border-[#2a2a2a] text-gray-200 outline-none focus:border-gray-500 rounded px-3 py-1.5 transition-all duration-200 text-[11.5px]"
          />
        </div>
      )}

      {/* ── Tree / Search Results / Tags Pane ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-1" role="tree">
        {activeTab === 'search' ? (
          <div className="px-2 py-1">
            {isSearching ? (
              <p className="text-[10px] text-text-muted italic px-2 py-2">Searching...</p>
            ) : searchResults.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {searchResults.map((res, i) => {
                  // Basic highlight formatting for the snippet
                  const matchIdx = res.snippet.toLowerCase().indexOf(searchQuery.toLowerCase());
                  let before = res.snippet;
                  let match = '';
                  let after = '';
                  if (matchIdx !== -1 && searchQuery) {
                    before = res.snippet.substring(0, matchIdx);
                    match = res.snippet.substring(matchIdx, matchIdx + searchQuery.length);
                    after = res.snippet.substring(matchIdx + searchQuery.length);
                  }

                  return (
                    <li key={`${res.filePath}-${i}`}>
                      <button
                        className="no-drag w-full text-left p-2 rounded hover:bg-[#1a1a1a] transition-all duration-150 border border-transparent hover:border-[#2a2a2a] flex flex-col gap-1 outline-none focus-visible:bg-[#1a1a1a]"
                        onClick={() => openFile({ id: res.filePath, path: res.filePath, name: res.fileName, type: 'file' })}
                      >
                        <span className="text-[11.5px] font-medium text-gray-300 truncate w-full">
                          {res.fileName.replace(/\.md$/, '')}
                        </span>
                        <span className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">
                          {match ? (
                            <>
                              {before}
                              <span className="text-blue-400 bg-blue-900/30 rounded px-0.5">{match}</span>
                              {after}
                            </>
                          ) : (
                            res.snippet
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : searchQuery.trim() ? (
              <p className="text-[10px] text-text-muted italic px-2 py-2">No matches found.</p>
            ) : (
              <p className="text-[10px] text-text-muted px-2 py-2">Type above to search across your vault.</p>
            )}
          </div>
        ) : activeTab === 'tags' ? (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Active filter bar */}
            {selectedTags.length > 0 && (
              <div className="px-2 py-1.5 border-b border-border flex-shrink-0 flex items-center gap-1.5 flex-wrap bg-blue-950/20">
                {selectedTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTagFilter(tag)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-blue-900/30 text-blue-400 border border-blue-900/50 hover:bg-blue-900/50 transition-colors duration-150"
                  >
                    #{tag}
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                ))}
                <button
                  onClick={clearTagFilters}
                  className="ml-auto text-[9px] text-text-muted hover:text-text-secondary px-1.5 py-0.5 rounded border border-border hover:border-border/80 transition-colors duration-150"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Filtered files list */}
            {tagFilteredFiles && (
              <div className="flex-shrink-0 border-b border-border">
                <div className="px-3 py-1.5">
                  <p className="text-[9px] font-semibold text-text-muted uppercase tracking-widest mb-1.5">
                    {tagFilteredFiles.length === 0 ? 'No matches' : `${tagFilteredFiles.length} note${tagFilteredFiles.length !== 1 ? 's' : ''}`}
                  </p>
                  {tagFilteredFiles.length > 0 && (
                    <ul className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
                      {tagFilteredFiles.map((f) => (
                        <li key={f.path}>
                          <button
                            className="no-drag w-full text-left flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] text-gray-300 hover:bg-[#1a1a1a] hover:text-white transition-colors duration-100"
                            onClick={() => openFile(f)}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-text-muted">
                              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                              <polyline points="13 2 13 9 20 9" />
                            </svg>
                            <span className="truncate">{f.name.replace(/\.md$/, '')}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Tag cloud */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {allTagsData.length === 0 ? (
                <div className="px-2 py-6 text-center">
                  <p className="text-[11px] text-text-muted">No tags found.</p>
                  <p className="text-[10px] text-text-muted/60 mt-1">
                    Add <code className="px-1 bg-surface rounded text-[9px]">#tags</code> to your notes.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 p-1">
                  {allTagsData.map(({ tag, count }) => {
                    const isActive = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTagFilter(tag)}
                        className={`group flex items-center gap-1 px-2 py-1 rounded-full text-[11px] border transition-all duration-150 cursor-pointer ${
                          isActive
                            ? 'bg-blue-900/20 text-blue-400 border-blue-900/50 shadow-sm'
                            : 'bg-[#1a1a1a] text-gray-400 border-[#2a2a2a] hover:bg-[#252525] hover:text-gray-300 hover:border-[#333]'
                        }`}
                      >
                        <span>#{tag}</span>
                        <span className={`text-[9px] rounded-full px-1 py-px ${
                          isActive ? 'text-blue-300/70' : 'text-gray-600 group-hover:text-gray-500'
                        }`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Root-level creation input */}
            {creatingAtRoot && (
              <InlineInput
                placeholder={creatingAtRoot === 'file' ? 'Note name…' : 'Folder name…'}
                paddingLeft={8}
                onConfirm={handleRootCreate}
                onCancel={() => setCreatingAtRoot(null)}
              />
            )}

            {tree.length > 0 ? (
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
            )}
          </>
        )}
      </div>

      {/* ── Tags Section (Only in Files View) ────────────────────────────────── */}
      {activeTab === 'files' && allTags.length > 0 && (
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
