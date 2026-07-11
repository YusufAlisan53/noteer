import { create } from 'zustand';
import type { FileStore, FileStoreState } from '../types/settings';
import type { FileNode } from '../types';
import { useToastStore } from './useToastStore';

// ─── Auto-save debounce ───────────────────────────────────────────────────────
const AUTO_SAVE_DELAY_MS = 1500;
let _autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let _isSavingPromise: Promise<void> | null = null;

function scheduleAutoSave(
  filePath: string,
  content:  string,
  onSaving: (v: boolean) => void,
  onError:  (msg: string | null) => void,
): void {
  if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(async () => {
    // Wait for any existing save to finish before starting a new one
    if (_isSavingPromise) await _isSavingPromise;
    
    let resolveSave: () => void;
    _isSavingPromise = new Promise(r => resolveSave = r);

    onSaving(true);
    try {
      const result = await window.electronAPI.saveFile({ path: filePath, content });
      if (result.success) {
        onError(null);
      } else {
        onError(result.error ?? 'Auto-save failed.');
        useToastStore.getState().addToast('Save failed', 'error');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Auto-save error.';
      onError(msg);
      useToastStore.getState().addToast('Save failed', 'error');
    } finally {
      onSaving(false);
      resolveSave!();
      _isSavingPromise = null;
    }
  }, AUTO_SAVE_DELAY_MS);
}

// ─── Flat tree search ─────────────────────────────────────────────────────────
function findNodeByPath(nodes: FileNode[], targetPath: string): FileNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Case-insensitive search by basename (with or without .md extension).
 * Returns the first matching FileNode or null.
 */
function findNodeByName(nodes: FileNode[], name: string): FileNode | null {
  const needle = name.toLowerCase().replace(/\.md$/i, '');
  function walk(list: FileNode[]): FileNode | null {
    for (const node of list) {
      if (node.type === 'file') {
        const base = node.name.toLowerCase().replace(/\.md$/i, '');
        if (base === needle) return node;
      } else if (node.children) {
        const found = walk(node.children);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(nodes);
}

/**
 * Returns the absolute path of the vault root by climbing from the first
 * top-level node. Works regardless of nesting depth.
 */
function deriveVaultRoot(tree: FileNode[]): string | null {
  if (tree.length === 0) return null;
  // All top-level nodes share the same parent
  const firstPath = tree[0].path;
  return firstPath.substring(0, firstPath.lastIndexOf('/') !== -1
    ? firstPath.lastIndexOf('/')
    : firstPath.lastIndexOf('\\'));
}

// ─── Initial state ────────────────────────────────────────────────────────────
const INITIAL_STATE: FileStoreState = {
  tree:               [],
  activeFilePath:     null,
  activeFileContent:  '',
  isTreeLoading:      true,
  isFileLoading:      false,
  isSaving:           false,
  saveError:          null,
  error:              null,
  activeFileBacklinks: [],
  recentFiles:        [],
  allTags:            [],
  isGraphOpen:        false,
  graphData:          null,
  openTabs:           [],
  searchQuery:        '',
  searchResults:      [],
  isSearching:        false,
};

// ─── Store ────────────────────────────────────────────────────────────────────
export const useFileStore = create<FileStore>((set, get) => ({
  ...INITIAL_STATE,

  // ── refreshTree ────────────────────────────────────────────────────────
  refreshTree: async () => {
    try {
      set({ error: null });
      const nodes = await window.electronAPI.getFileTree();
      
      // Compute all tags
      const tagsSet = new Set<string>();
      const traverse = (nodeList: FileNode[]) => {
        for (const node of nodeList) {
          if (node.type === 'file' && node.tags) {
            node.tags.forEach(t => tagsSet.add(t));
          } else if (node.type === 'folder' && node.children) {
            traverse(node.children);
          }
        }
      };
      traverse(nodes);
      const allTags = Array.from(tagsSet).sort();

      set({ tree: nodes, isTreeLoading: false, allTags });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load file tree.';
      console.error('[FileStore] refreshTree:', message);
      set({ error: message, isTreeLoading: false });
    }
  },

  // ── fetchBacklinks ─────────────────────────────────────────────────────
  fetchBacklinks: async (fileName: string) => {
    try {
      const links = await window.electronAPI.getBacklinks({ targetName: fileName });
      set({ activeFileBacklinks: links });
    } catch (err) {
      console.error('[FileStore] fetchBacklinks:', err);
      set({ activeFileBacklinks: [] });
    }
  },

  // ── openFile ───────────────────────────────────────────────────────────
  openFile: async (node: FileNode) => {
    if (node.type !== 'file') return;

    // Cancel any pending auto-save for the previous file
    if (_autoSaveTimer) { clearTimeout(_autoSaveTimer); _autoSaveTimer = null; }

    const { recentFiles, openTabs } = get();
    // Move node.path to the front, keep only the latest 5
    const nextRecent = [node.path, ...recentFiles.filter(p => p !== node.path)].slice(0, 5);
    
    // Add to openTabs if not present
    const nextOpenTabs = openTabs.some(t => t.path === node.path)
      ? openTabs
      : [...openTabs, { path: node.path, name: node.name }];

    set({
      activeFilePath:      node.path,
      isFileLoading:       true,
      error:               null,
      saveError:           null,
      activeFileBacklinks: [],
      recentFiles:         nextRecent,
      openTabs:            nextOpenTabs,
    });

    try {
      const result = await window.electronAPI.readFile({ path: node.path });
      if (!result.success || result.content === undefined) {
        set({ error: result.error ?? 'Failed to read file.', isFileLoading: false, activeFileContent: '' });
        return;
      }
      set({ activeFileContent: result.content, isFileLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error reading file.';
      set({ error: message, isFileLoading: false, activeFileContent: '' });
      return;
    }

    // Fetch backlinks after content is loaded (non-blocking — fire and update)
    get().fetchBacklinks(node.name.replace(/\.md$/i, ''));
  },

  // ── openOrCreateFile ───────────────────────────────────────────────────
  openOrCreateFile: async (fileName: string) => {
    const { tree, refreshTree, openFile } = get();

    // 1. Check if the file already exists in the tree
    const existing = findNodeByName(tree, fileName);
    if (existing) {
      await openFile(existing);
      return;
    }

    // 2. File doesn't exist — create it at vault root
    const vaultRoot = deriveVaultRoot(tree);
    if (!vaultRoot) {
      console.error('[FileStore] openOrCreateFile: cannot derive vault root');
      return;
    }

    const name       = fileName.replace(/\.md$/i, '');
    const createResult = await window.electronAPI.createItem({
      parentPath: vaultRoot,
      name,
      type: 'file',
    });

    if (!createResult.success) {
      console.error('[FileStore] openOrCreateFile create failed:', createResult.error);
      set({ error: createResult.error ?? 'Failed to create note.' });
      return;
    }

    // 3. Refresh tree so the new node appears, then open the file
    await refreshTree();

    // Re-search the freshly updated tree
    const { tree: updatedTree } = get();
    const newNode = findNodeByName(updatedTree, name);
    if (newNode) await openFile(newNode);
  },

  // ── Phase 10: Multi-Tab Actions ────────────────────────────────────────
  setActiveTab: async (path: string) => {
    const node = findNodeByPath(get().tree, path);
    if (node) await get().openFile(node);
  },

  closeTab: (path: string) => {
    const { openTabs, activeFilePath } = get();
    const newTabs = openTabs.filter(t => t.path !== path);
    
    if (path === activeFilePath) {
      if (newTabs.length > 0) {
        const closedIndex = openTabs.findIndex(t => t.path === path);
        const nextActiveIndex = Math.max(0, closedIndex - 1);
        const nextActivePath = newTabs[nextActiveIndex].path;
        
        set({ openTabs: newTabs });
        get().setActiveTab(nextActivePath);
        return;
      } else {
        get().clearActiveFile();
      }
    }
    
    set({ openTabs: newTabs });
  },

  // ── Phase 11: Daily Notes ──────────────────────────────────────────────
  triggerDailyNote: async () => {
    try {
      const notePath = await window.electronAPI.openDailyNote();
      await get().refreshTree();
      const node = findNodeByPath(get().tree, notePath);
      if (node) {
        await get().openFile(node);
      } else {
        console.warn('[FileStore] triggerDailyNote: node not found after refresh', notePath);
      }
    } catch (err) {
      console.error('[FileStore] triggerDailyNote error:', err);
      set({ error: 'Failed to open daily note.' });
    }
  },

  // ── updateContent ──────────────────────────────────────────────────────
  updateContent: (content: string) => {
    set({ activeFileContent: content });
    const { activeFilePath } = get();
    if (!activeFilePath) return;
    scheduleAutoSave(
      activeFilePath,
      content,
      (isSaving) => set({ isSaving }),
      (saveError) => set({ saveError }),
    );
  },

  /** @deprecated Use updateContent instead. */
  setEditorContent: (content: string) => set({ activeFileContent: content }),

  clearActiveFile: () => {
    if (_autoSaveTimer) { clearTimeout(_autoSaveTimer); _autoSaveTimer = null; }
    set({
      activeFilePath:      null,
      activeFileContent:   '',
      isFileLoading:       false,
      isSaving:            false,
      activeFileBacklinks: [],
    });
  },

  clearError:     () => set({ error: null }),
  clearSaveError: () => set({ saveError: null }),

  // ── Phase 9: Graph View ────────────────────────────────────────────────
  toggleGraphView: (open?: boolean) => {
    const isGraphOpen = open ?? !get().isGraphOpen;
    set({ isGraphOpen });
    if (isGraphOpen) {
      get().fetchGraphData();
    }
  },

  fetchGraphData: async () => {
    try {
      const data = await window.electronAPI.getGraphData();
      set({ graphData: data });
    } catch (err) {
      console.error('[FileStore] fetchGraphData:', err);
    }
  },

  // ── Phase 13: Full-Text Search ─────────────────────────────────────────
  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  executeSearch: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [], isSearching: false });
      return;
    }
    set({ isSearching: true });
    try {
      const results = await window.electronAPI.searchVault(query);
      set({ searchResults: results, isSearching: false });
    } catch (err) {
      console.error('[FileStore] executeSearch error:', err);
      set({ searchResults: [], isSearching: false });
    }
  },
}));

// ─── Selector helpers ─────────────────────────────────────────────────────────
export const selectTree               = (s: FileStore) => s.tree;
export const selectActiveFilePath     = (s: FileStore) => s.activeFilePath;
export const selectActiveFileContent  = (s: FileStore) => s.activeFileContent;
export const selectIsTreeLoading      = (s: FileStore) => s.isTreeLoading;
export const selectIsFileLoading      = (s: FileStore) => s.isFileLoading;
export const selectIsSaving           = (s: FileStore) => s.isSaving;
export const selectSaveError          = (s: FileStore) => s.saveError;
export const selectError              = (s: FileStore) => s.error;
export const selectActiveFileBacklinks = (s: FileStore) => s.activeFileBacklinks;
export const selectRecentFiles        = (s: FileStore) => s.recentFiles;
export const selectIsGraphOpen        = (s: FileStore) => s.isGraphOpen;
export const selectGraphData          = (s: FileStore) => s.graphData;
export const selectOpenTabs           = (s: FileStore) => s.openTabs;
export const selectSearchQuery        = (s: FileStore) => s.searchQuery;
export const selectSearchResults      = (s: FileStore) => s.searchResults;
export const selectIsSearching        = (s: FileStore) => s.isSearching;

export const selectActiveFileNode = (s: FileStore): FileNode | null => {
  if (!s.activeFilePath) return null;
  return findNodeByPath(s.tree, s.activeFilePath);
};

export const selectAllTags            = (s: FileStore) => s.allTags;

// ─── Fast Search Helper ───────────────────────────────────────────────────────
/**
 * Recursively searches the vault tree for markdown files matching the query string.
 * This is used heavily by the Command Palette. Matches by basename.
 */
export function searchFiles(tree: FileNode[], query: string): FileNode[] {
  if (!query.trim()) return [];
  const needle = query.toLowerCase();
  const results: FileNode[] = [];

  function walk(nodes: FileNode[]) {
    for (const node of nodes) {
      if (node.type === 'file') {
        if (node.name.toLowerCase().includes(needle)) {
          results.push(node);
        }
      } else if (node.children) {
        walk(node.children);
      }
    }
  }

  walk(tree);
  // Sort shortest matches first (often what the user intended)
  return results.sort((a, b) => a.name.length - b.name.length);
}
