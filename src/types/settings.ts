// ─── Core Settings Shape ──────────────────────────────────────────────────────

/** UI presentation preferences. */
export interface UISettings {
  /** Width of the file-tree sidebar panel in pixels. Range: [160, 480]. */
  sidebarWidth: number;
  /** Whether the preview pane is visible alongside the editor. */
  showPreview: boolean;
  /** Whether the outline (Table of Contents) sidebar is visible. */
  showOutline: boolean;
  /** Zen Mode hides all chrome and focuses on the editor only. */
  zenMode: boolean;
  /** Which activity bar panel was last active. */
  activePanel: 'files' | 'search' | 'settings';
  /** The current view mode of the main workspace */
  viewMode: 'edit' | 'split' | 'preview' | 'canvas';
}

/** Editor behaviour preferences. */
export interface EditorSettings {
  /** Base font size for the editor textarea, in pixels. Range: [12, 24]. */
  fontSize: number;
  /** Number of spaces a Tab keypress inserts. */
  tabSize: 2 | 4;
  /** Whether to wrap long lines inside the editor. */
  wordWrap: boolean;
  /** Show line numbers in the gutter (Phase 4+). */
  lineNumbers: boolean;
  /** Auto-save delay in milliseconds. 0 means disabled. */
  autoSaveDelay: number;
}

/** Application-level behaviour preferences. */
export interface BehaviorSettings {
  /** Color theme. 'graphite' is the default. */
  theme: 'graphite' | 'midnight' | 'warm';
  /** Whether to confirm before deleting a file or folder. */
  confirmDelete: boolean;
  /** Whether to restore the last open file on startup. */
  restoreLastFile: boolean;
  /** Absolute path of the last open file, for restore-on-startup. */
  lastOpenedFilePath: string | null;
}

/**
 * The complete, flat settings object persisted to `.noteer/settings.json`
 * inside the vault directory. All fields must have defaults defined in
 * `DEFAULT_SETTINGS`.
 */
export interface NoteerSettings {
  ui: UISettings;
  editor: EditorSettings;
  behavior: BehaviorSettings;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

/** The canonical default configuration. Used on first launch and for resets. */
export const DEFAULT_SETTINGS: NoteerSettings = {
  ui: {
    sidebarWidth: 260,
    showPreview:  false,
    showOutline:  true,
    zenMode:      false,
    activePanel:  'files',
    viewMode:     'split',
  },
  editor: {
    fontSize: 14,
    tabSize: 2,
    wordWrap: true,
    lineNumbers: false,
    autoSaveDelay: 1500,
  },
  behavior: {
    theme: 'graphite',
    confirmDelete: true,
    restoreLastFile: true,
    lastOpenedFilePath: null,
  },
};

// ─── Zustand Store Interfaces (CQRS-separated) ────────────────────────────────

/** Read-side (queries) — plain serialisable state. */
export interface SettingsStoreState {
  /** The live settings object. Mirrors what is on disk. */
  settings: NoteerSettings;
  /** True while the initial `get-settings` IPC call is in flight. */
  isLoading: boolean;
  /** Non-null when the last persist operation failed. */
  persistError: string | null;
}

/** Write-side (commands) — actions that mutate state and trigger side-effects. */
export interface SettingsStoreActions {
  /**
   * Loads settings from disk via IPC on app startup.
   * Merges the persisted values over `DEFAULT_SETTINGS` to handle
   * schema additions across versions.
   */
  loadSettings: () => Promise<void>;

  /**
   * Deep-merges a partial UI settings patch and persists immediately.
   */
  setUI: (patch: Partial<UISettings>) => void;

  /**
   * Deep-merges a partial editor settings patch and persists immediately.
   */
  setEditor: (patch: Partial<EditorSettings>) => void;

  /**
   * Deep-merges a partial behavior settings patch and persists immediately.
   */
  setBehavior: (patch: Partial<BehaviorSettings>) => void;

  /**
   * Resets all settings to `DEFAULT_SETTINGS` and persists.
   */
  resetSettings: () => void;
}

export type SettingsStore = SettingsStoreState & SettingsStoreActions;

// ─── File Store Interfaces ────────────────────────────────────────────────────

import type { FileNode, GraphData, SearchResult } from './index';

/** Read-side (queries) for the file/vault state. */
export interface FileStoreState {
  /** The recursive vault tree from the last `get-file-tree` call. */
  tree: FileNode[];
  /** Absolute path of the currently open file, or null. */
  activeFilePath: string | null;
  /** UTF-8 text content of the active file as loaded from disk. */
  activeFileContent: string;
  /** True while the initial tree load is in flight. */
  isTreeLoading: boolean;
  /** True while a file's content is being read. */
  isFileLoading: boolean;
  /** True while a debounced auto-save is in-flight. */
  isSaving: boolean;
  /** Non-null if the last save operation failed. */
  saveError: string | null;
  /** Non-null if the last tree or file operation failed. */
  error: string | null;
  /**
   * Absolute paths of files that contain a [[wiki-link]] pointing to the
   * currently active file. Empty array when no file is open or no references
   * exist. Refreshed on every `openFile` / `openOrCreateFile` call.
   */
  activeFileBacklinks: string[];
  /** 
   * Absolute paths of the 5 most recently opened files.
   * Used primarily by the Command Palette for empty-state suggestions.
   */
  recentFiles: string[];
  /** Pre-computed array of all tags found in the current vault tree. */
  allTags: string[];
  /** Whether the global Graph View overlay is currently visible. */
  isGraphOpen: boolean;
  /** Cached graph data containing all nodes and links. Null if not yet fetched. */
  graphData: GraphData | null;
  /**
   * Phase 10: Multi-Tab Workspace
   * List of currently open tabs.
   */
  openTabs: { path: string; name: string }[];
  /** Phase 13: The current search query in the sidebar. */
  searchQuery: string;
  /** Phase 13: Results from the latest full-text search. */
  searchResults: SearchResult[];
  /** Phase 13: True while the search IPC call is in flight. */
  isSearching: boolean;
  /** Phase 14: All unique tags in the vault with counts. */
  allTagsData: import('./index').TagInfo[];
  /** Phase 14: Currently active tag filters. */
  selectedTags: string[];
}

/** Write-side (commands) for the file/vault state. */
export interface FileStoreActions {
  /** (Re-)fetches the vault file tree via `window.electronAPI.getFileTree()`. */
  refreshTree: () => Promise<void>;

  /** Opens a file: sets `activeFilePath`, fetches content, then fetches backlinks. */
  openFile: (node: FileNode) => Promise<void>;

  /**
   * Checks if a file with `fileName` exists in the current tree.
   * If yes, opens it. If no, creates it at the vault root via `create-item`,
   * refreshes the tree, then opens it.
   *
   * Used when the user clicks a [[wiki-link]] in the preview pane.
   */
  openOrCreateFile: (fileName: string) => Promise<void>;

  /**
   * Phase 10: Set an already opened tab as the active one.
   */
  setActiveTab: (path: string) => Promise<void>;

  /**
   * Phase 10: Close a tab. If the active tab is closed, gracefully falls back
   * to an adjacent tab or null.
   */
  closeTab: (path: string) => void;

  /**
   * Phase 11: Generate or open today's daily note.
   */
  triggerDailyNote: () => Promise<void>;

  /**
   * Fetches the backlinks for the given file name from the main-process index
   * and stores them in `activeFileBacklinks`.
   */
  fetchBacklinks: (fileName: string) => Promise<void>;

  /**
   * Updates `activeFileContent` in-store and schedules a debounced
   * auto-save via `window.electronAPI.saveFile()`.
   */
  updateContent: (content: string) => void;

  /** @deprecated Use `updateContent` instead. */
  setEditorContent: (content: string) => void;

  /** Clears the active file selection. */
  clearActiveFile: () => void;

  /** Clears any error flag. */
  clearError: () => void;

  /** Clears a save error. */
  clearSaveError: () => void;

  /** ── Phase 9: Graph View ────────────────────────────────────────────────── */
  /**
   * Toggles the global graph view on or off. 
   * If toggled ON, automatically fetches the latest graph data.
   */
  toggleGraphView: (open?: boolean) => void;

  /**
   * Fetches the full node/link dataset for the entire vault via IPC,
   * updating `graphData` in state.
   */
  fetchGraphData: () => Promise<void>;

  // ── Phase 13: Full-Text Search ────────────────────────────────────────────────
  /** Triggers the IPC search and updates searchResults. */
  executeSearch: (query: string) => Promise<void>;
  /** Sets the search query input value without immediately executing the search. */
  setSearchQuery: (query: string) => void;

  // ── Phase 14: Tags ─────────────────────────────────────────────────────
  /** Fetches the full tag list from the main process and updates allTagsData. */
  fetchAllTags: () => Promise<void>;
  /** Toggles a tag in the selectedTags filter. */
  toggleTagFilter: (tag: string) => void;
  /** Clears all active tag filters. */
  clearTagFilters: () => void;
}

export type FileStore = FileStoreState & FileStoreActions;
