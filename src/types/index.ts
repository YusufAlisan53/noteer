// ─── File Tree ────────────────────────────────────────────────────────────────

/**
 * A single node in the recursive vault file tree.
 *
 * - `type: 'file'`   → a Markdown (.md) file on disk
 * - `type: 'folder'` → a directory that may contain children
 *
 * `id` is the absolute OS path, which is guaranteed to be unique
 * within a single vault scan.
 */
export interface FileNode {
  /** Absolute path on disk — used as a stable, unique key. */
  id: string;
  /** Basename of the file or directory (no leading path). */
  name: string;
  /** Whether this node represents a directory or a Markdown file. */
  type: 'file' | 'folder';
  /** Absolute path on disk (same as `id`; kept explicit for clarity). */
  path: string;
  /** Last-modified time as an ISO 8601 string. Undefined for folders. */
  modifiedAt?: string;
  /**
   * Recursive child nodes. Present (possibly empty array) on folders;
   * always `undefined` on files.
   */
  children?: FileNode[];
  /** Optional array of tags parsed from YAML frontmatter (for files). */
  tags?: string[];
}

// ─── IPC Payloads ─────────────────────────────────────────────────────────────

/** Payload for the `create-item` IPC channel. */
export interface CreateItemPayload {
  /** Absolute path of the parent directory to create the item inside. */
  parentPath: string;
  /** The desired name for the new item (without extension for files). */
  name: string;
  /** Whether to create a `.md` file or a subdirectory. */
  type: 'file' | 'folder';
}

/** Payload for the `delete-item` IPC channel. */
export interface DeleteItemPayload {
  /** Absolute path of the file or folder to delete. */
  path: string;
}

/** Generic IPC operation result returned for mutating operations. */
export interface IpcResult {
  success: boolean;
  /** Human-readable error message when `success` is false. */
  error?: string;
}

// ─── Ping (Phase 1 — kept for regression testing) ────────────────────────────

export interface PingPayload {
  message: string;
}

export interface PongResponse {
  message: string;
  timestamp: number;
  echoedPayload: PingPayload;
}

// ─── Phase 3 Payloads ─────────────────────────────────────────────────────────

/** Payload for the `read-file` IPC channel. */
export interface ReadFilePayload {
  /** Absolute path of the .md file to read. */
  path: string;
}

/** Response shape for `read-file`. */
export interface ReadFileResult {
  success: boolean;
  content?: string;
  error?: string;
}

// ─── Phase 4 Payloads ─────────────────────────────────────────────────────────

/** Payload for the `save-file` IPC channel. */
export interface SaveFilePayload {
  /** Absolute path of the .md file to write. */
  path: string;
  /** Full UTF-8 text content to persist. */
  content: string;
}

// ─── Electron API Surface ─────────────────────────────────────────────────────

/**
 * The complete type of `window.electronAPI` exposed through the preload
 * contextBridge. All renderer code should reference this type.
 */
export interface ElectronAPI {
  // ── Phase 1 ──────────────────────────────────────────────────────────────
  ping: (payload: PingPayload) => Promise<PongResponse>;

  // ── Phase 2: Vault & File Tree ───────────────────────────────────────────
  /**
   * Returns the full recursive FileNode tree of the user's vault directory.
   * Folders are sorted before files; both groups are sorted alphabetically.
   */
  getFileTree: () => Promise<FileNode[]>;

  /**
   * Creates a new .md file or directory inside `parentPath`.
   * For files, a ".md" extension is automatically appended if absent.
   */
  createItem: (payload: CreateItemPayload) => Promise<IpcResult>;

  /**
   * Permanently deletes the file or folder at `path`.
   * Folder deletion is recursive.
   */
  deleteItem: (payload: DeleteItemPayload) => Promise<IpcResult>;

  // ── Phase 3: File Content & Settings ─────────────────────────────────────
  /**
   * Reads the UTF-8 text content of a single .md file from disk.
   * Path must be inside the vault; returns an error result otherwise.
   */
  readFile: (payload: ReadFilePayload) => Promise<ReadFileResult>;

  /**
   * Returns the current `NoteerSettings` object from `.noteer/settings.json`.
   * Guaranteed to return a fully-populated object (defaults applied server-side).
   */
  getSettings: () => Promise<import('./settings').NoteerSettings>;

  /**
   * Persists the given settings object to `.noteer/settings.json`.
   * Called automatically by the settings store whenever state changes.
   */
  saveSettings: (settings: import('./settings').NoteerSettings) => Promise<IpcResult>;

  // ── Phase 4: File Write ───────────────────────────────────────────────────
  /**
   * Asynchronously writes `content` to the .md file at `path`.
   * Path must be inside the vault. Called by the auto-save debounce in the store.
   * Also triggers an incremental backlink index update for the saved file.
   */
  saveFile: (payload: SaveFilePayload) => Promise<IpcResult>;

  // ── Phase 5: Backlinks ────────────────────────────────────────────────────
  /**
   * Returns an array of absolute paths of files that link to `targetName`
   * via [[Wiki Link]] syntax. `targetName` is the note basename (no .md).
   * Backed by the in-memory backlink index built at startup.
   */
  getBacklinks: (payload: { targetName: string }) => Promise<string[]>;

  // ── Phase 8: Window Controls ──────────────────────────────────────────────
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;

  // ── Phase 9: Graph View ───────────────────────────────────────────────────
  getGraphData: () => Promise<GraphData>;

  // ── Phase 11: Daily Notes ─────────────────────────────────────────────────
  /**
   * Generates or opens today's daily note in `Daily/YYYY-MM-DD.md`.
   * Returns the absolute path of the note.
   */
  openDailyNote: () => Promise<string>;

  // ── Phase 13: Full-Text Search ────────────────────────────────────────────
  /**
   * Searches the vault for the given query and returns a list of results.
   */
  searchVault: (query: string) => Promise<SearchResult[]>;
}

export interface GraphNode {
  id: string;
  name: string;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface SearchResult {
  filePath: string;
  fileName: string;
  snippet: string;
}
