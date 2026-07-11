import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import matter from 'gray-matter';

// ─── Mirrored Types ───────────────────────────────────────────────────────────
interface FileNode {
  id: string; name: string; type: 'file' | 'folder';
  path: string; modifiedAt?: string; children?: FileNode[]; tags?: string[];
}
interface CreateItemPayload { parentPath: string; name: string; type: 'file' | 'folder'; }
interface DeleteItemPayload { path: string; }
interface ReadFilePayload   { path: string; }
interface IpcResult         { success: boolean; error?: string; }
interface ReadFileResult    { success: boolean; content?: string; error?: string; }

interface NoteerSettings {
  ui:       { sidebarWidth: number; showPreview: boolean; zenMode: boolean; activePanel: string; };
  editor:   { fontSize: number; tabSize: number; wordWrap: boolean; lineNumbers: boolean; autoSaveDelay: number; };
  behavior: { theme: string; confirmDelete: boolean; restoreLastFile: boolean; lastOpenedFilePath: string | null; };
}
const DEFAULT_SETTINGS: NoteerSettings = {
  ui:       { sidebarWidth: 240, showPreview: true, zenMode: false, activePanel: 'files' },
  editor:   { fontSize: 14, tabSize: 2, wordWrap: true, lineNumbers: false, autoSaveDelay: 1500 },
  behavior: { theme: 'graphite', confirmDelete: true, restoreLastFile: true, lastOpenedFilePath: null },
};

// ─── Environment ──────────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// ─── Constants ────────────────────────────────────────────────────────────────
const VAULT_NAME    = 'Noteer_Notes';
const SETTINGS_DIR  = '.noteer';
const SETTINGS_FILE = 'settings.json';

// ─── Backlink Index ───────────────────────────────────────────────────────────
/**
 * In-memory global backlink index.
 *
 * Structure:  targetBasename (lowercase, no .md) → Set of absolute source paths
 *
 * Example: if "Project Ideas.md" contains [[Inbox]], then:
 *   index.get("inbox") === Set { "/vault/Project Ideas.md" }
 *
 * Using a Map<string, Set<string>> for O(1) lookup and automatic deduplication.
 */
const backlinkIndex = new Map<string, Set<string>>();

/** Regex that matches [[Note Name]] wiki-link syntax (non-greedy). */
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

/**
 * Extracts all [[wikilink]] targets from a file's content and registers
 * the source file in the backlink index.
 *
 * Called on:
 *   1. Full vault scan at startup (buildFullIndex)
 *   2. Every save-file call (incremental update for that file only)
 */
function indexFile(sourcePath: string, content: string): void {
  // First, remove all existing forward-references FROM this source file
  // so we don't accumulate stale entries across saves.
  for (const [target, sources] of backlinkIndex) {
    sources.delete(sourcePath);
    if (sources.size === 0) backlinkIndex.delete(target);
  }

  // Now (re-)add fresh references from the current content
  let match: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0; // reset stateful regex
  while ((match = WIKILINK_RE.exec(content)) !== null) {
    // Normalise: lowercase, strip leading/trailing whitespace
    const target = match[1].trim().toLowerCase();
    if (!target) continue;
    if (!backlinkIndex.has(target)) backlinkIndex.set(target, new Set());
    backlinkIndex.get(target)!.add(sourcePath);
  }
}

/**
 * Walks the entire vault and builds the initial backlink index.
 * Runs once at startup after the vault is ready.
 */
async function buildFullIndex(vaultPath: string): Promise<void> {
  backlinkIndex.clear();

  async function walk(dir: string): Promise<void> {
    let entries: fs.Dirent[];
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) { await walk(abs); }
      else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const content = await fs.promises.readFile(abs, 'utf-8');
          indexFile(abs, content);
        } catch { /* skip unreadable files */ }
      }
    }
  }

  await walk(vaultPath);
  console.log(`[Main] Backlink index built — ${backlinkIndex.size} unique targets tracked.`);
}

/**
 * Returns an array of absolute source paths that link to `targetName`.
 * `targetName` should be the file basename without .md extension.
 */
function getBacklinks(targetName: string): string[] {
  const key = targetName.trim().toLowerCase().replace(/\.md$/i, '');
  const sources = backlinkIndex.get(key);
  return sources ? Array.from(sources) : [];
}

// ─── Settings Management ──────────────────────────────────────────────────────
function deepMerge(target: NoteerSettings, src: Partial<NoteerSettings>): NoteerSettings {
  return {
    ui:       { ...target.ui,       ...(src.ui       ?? {}) },
    editor:   { ...target.editor,   ...(src.editor   ?? {}) },
    behavior: { ...target.behavior, ...(src.behavior ?? {}) },
  };
}

async function initSettings(vaultPath: string): Promise<string> {
  const settingsDir  = path.join(vaultPath, SETTINGS_DIR);
  const settingsPath = path.join(settingsDir, SETTINGS_FILE);
  if (!(await fs.promises.stat(settingsDir).then(() => true).catch(() => false))) await fs.promises.mkdir(settingsDir, { recursive: true });
  if (!(await fs.promises.stat(settingsPath).then(() => true).catch(() => false))) {
    await fs.promises.writeFile(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf-8');
    console.log('[Main] Settings created at:', settingsPath);
  } else {
    console.log('[Main] Settings found at:', settingsPath);
  }
  return settingsPath;
}

async function readSettings(settingsPath: string): Promise<NoteerSettings> {
  try {
    return deepMerge(DEFAULT_SETTINGS, JSON.parse(await fs.promises.readFile(settingsPath, 'utf-8')));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// ─── Vault Initialization ─────────────────────────────────────────────────────
async function initVault(): Promise<string> {
  const vaultPath = path.join(app.getPath('documents'), VAULT_NAME);
  if (!(await fs.promises.stat(vaultPath).then(() => true).catch(() => false))) {
    await fs.promises.mkdir(vaultPath, { recursive: true });
    const welcome = [
      '# Welcome to Noteer', '',
      'Your local-first, minimalist Markdown vault is ready.', '',
      '## Getting Started', '',
      '- Create a new note with the **+** button in the sidebar',
      '- Organise notes into folders',
      '- Link notes using **[[Wiki Links]]** syntax',
      '- Everything is stored as plain `.md` files in:',
      `  \`${vaultPath}\``, '',
      '> Noteer never uploads your data anywhere.',
    ].join('\n');
    await fs.promises.writeFile(path.join(vaultPath, 'Welcome to Noteer.md'), welcome, 'utf-8');
    console.log('[Main] Vault created at:', vaultPath);
  } else {
    console.log('[Main] Vault found at:', vaultPath);
  }
  return vaultPath;
}

// ─── File Tree Scanner ────────────────────────────────────────────────────────
async function scanDirectory(dirPath: string): Promise<FileNode[]> {
  let entries: fs.Dirent[];
  try { entries = await fs.promises.readdir(dirPath, { withFileTypes: true }); } catch { return []; }

  const nodes: FileNode[] = [];
  await Promise.all(entries.map(async (entry) => {
    if (entry.name.startsWith('.')) return;
    const abs = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      nodes.push({ id: abs, name: entry.name, type: 'folder', path: abs, children: await scanDirectory(abs) });
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      let modifiedAt: string | undefined;
      let tags: string[] | undefined;
      try { 
        const stat = await fs.promises.stat(abs);
        modifiedAt = stat.mtime.toISOString(); 
        const content = await fs.promises.readFile(abs, 'utf-8');
        const parsed = matter(content);
        if (parsed.data && Array.isArray(parsed.data.tags)) {
          tags = parsed.data.tags.filter((t: any) => typeof t === 'string');
        }
      } catch { /* ignore */ }
      nodes.push({ id: abs, name: entry.name, type: 'file', path: abs, modifiedAt, tags });
    }
  }));
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  return nodes;
}

// ─── Window Creation ──────────────────────────────────────────────────────────
function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 800, minHeight: 600,
    frame: false, titleBarStyle: 'hidden', transparent: false,
    backgroundColor: '#121212', show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  });
  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  return win;
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
function registerIpcHandlers(vaultPath: string, settingsPath: string): void {

  // ── Phase 1: ping ────────────────────────────────────────────────────────
  ipcMain.handle('ping', async (_e, payload: unknown) => ({
    message: 'pong', timestamp: Date.now(), echoedPayload: payload,
  }));

  // ── Phase 8: Window Controls ─────────────────────────────────────────────
  ipcMain.on('window-minimize', () => BrowserWindow.getFocusedWindow()?.minimize());
  ipcMain.on('window-maximize', () => { 
    const w = BrowserWindow.getFocusedWindow(); 
    w?.isMaximized() ? w.restore() : w?.maximize(); 
  });
  ipcMain.on('window-close', () => BrowserWindow.getFocusedWindow()?.close());

  // ── Phase 2: File Tree ───────────────────────────────────────────────────
  ipcMain.handle('get-file-tree', async (): Promise<FileNode[]> => await scanDirectory(vaultPath));

  ipcMain.handle('create-item', async (_e, payload: CreateItemPayload): Promise<IpcResult> => {
    try {
      const { parentPath, name, type } = payload;
      const resolved = path.resolve(parentPath);
      if (!resolved.startsWith(path.resolve(vaultPath)))
        return { success: false, error: 'Path is outside the vault.' };
      if (type === 'folder') {
        await fs.promises.mkdir(path.join(resolved, name), { recursive: true });
      } else {
        const fileName = name.endsWith('.md') ? name : `${name}.md`;
        const target   = path.join(resolved, fileName);
        if ((await fs.promises.stat(target).then(() => true).catch(() => false))) return { success: false, error: `"${fileName}" already exists.` };
        // Seed with a heading and index in the backlink map (empty, but ready)
        const content = `# ${name.replace(/\.md$/i, '')}\n`;
        await fs.promises.writeFile(target, content, 'utf-8');
        indexFile(target, content);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('delete-item', async (_e, payload: DeleteItemPayload): Promise<IpcResult> => {
    try {
      const resolved = path.resolve(payload.path);
      if (!resolved.startsWith(path.resolve(vaultPath)) || resolved === path.resolve(vaultPath))
        return { success: false, error: 'Cannot delete vault root or external paths.' };
      const stat = await fs.promises.stat(resolved);
      if (stat.isDirectory()) await fs.promises.rm(resolved, { recursive: true, force: true });
      else {
        // Remove from index before deleting
        indexFile(resolved, ''); // clears all outbound links from this file
        await fs.promises.unlink(resolved);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ── Phase 3: File Content ────────────────────────────────────────────────
  ipcMain.handle('read-file', async (_e, payload: ReadFilePayload): Promise<ReadFileResult> => {
    try {
      const resolved = path.resolve(payload.path);
      if (!resolved.startsWith(path.resolve(vaultPath)))
        return { success: false, error: 'Path is outside the vault.' };
      if (!resolved.endsWith('.md'))
        return { success: false, error: 'Only .md files can be read.' };
      return { success: true, content: await fs.promises.readFile(resolved, 'utf-8') };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ── Phase 3: Settings ────────────────────────────────────────────────────
  ipcMain.handle('get-settings', async (): Promise<NoteerSettings> => await readSettings(settingsPath));

  ipcMain.handle('save-settings', async (_e, settings: NoteerSettings): Promise<IpcResult> => {
    try {
      const merged  = deepMerge(DEFAULT_SETTINGS, settings);
      const tmpPath = `${settingsPath}.tmp`;
      await fs.promises.writeFile(tmpPath, JSON.stringify(merged, null, 2), 'utf-8');
      await fs.promises.rename(tmpPath, settingsPath);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ── Phase 4: File Write ──────────────────────────────────────────────────
  /**
   * Writes content to disk AND incrementally updates the backlink index
   * for the saved file. No full re-scan needed.
   */
  ipcMain.handle('save-file', async (_e, payload: { path: string; content: string }): Promise<IpcResult> => {
    try {
      const resolved = path.resolve(payload.path);
      if (!resolved.startsWith(path.resolve(vaultPath)))
        return { success: false, error: 'Path is outside the vault.' };
      if (!resolved.endsWith('.md'))
        return { success: false, error: 'Only .md files can be saved.' };

      await fs.promises.writeFile(resolved, payload.content, 'utf-8');

      // ← Phase 5: incremental index update on every save
      indexFile(resolved, payload.content);

      return { success: true };
    } catch (err) {
      console.error('[Main] save-file error:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ── Phase 5: Backlinks ───────────────────────────────────────────────────
  /**
   * Returns an array of absolute paths of files that contain [[targetName]].
   * `targetName` should be the note basename (with or without .md).
   */
  ipcMain.handle('get-backlinks', async (_e, payload: { targetName: string }): Promise<string[]> => {
    return getBacklinks(payload.targetName);
  });

  // ── Phase 9: Graph View ──────────────────────────────────────────────────
  ipcMain.handle('get-graph-data', async () => {
    const nodes: { id: string; name: string }[] = [];
    const links: { source: string; target: string }[] = [];
    const nodeIds = new Set<string>();

    const flattenNodes = (nodesArr: FileNode[]) => {
      for (const node of nodesArr) {
        if (node.type === 'file') {
          const baseName = node.name.replace(/\.md$/i, '');
          const id = baseName.toLowerCase();
          if (!nodeIds.has(id)) {
            nodeIds.add(id);
            nodes.push({ id, name: baseName });
          }
        } else if (node.type === 'folder' && node.children) {
          flattenNodes(node.children);
        }
      }
    };

    flattenNodes(await scanDirectory(vaultPath));

    for (const [target, sources] of backlinkIndex.entries()) {
      for (const sourcePath of sources) {
        const sourceBaseName = path.basename(sourcePath).replace(/\.md$/i, '');
        const sourceId = sourceBaseName.toLowerCase();
        
        if (!nodeIds.has(target)) {
          nodeIds.add(target);
          nodes.push({ id: target, name: target }); // Placeholder for missing target
        }
        if (!nodeIds.has(sourceId)) {
          nodeIds.add(sourceId);
          nodes.push({ id: sourceId, name: sourceBaseName });
        }
        links.push({ source: sourceId, target });
      }
    }

    return { nodes, links };
  });

  // ── Phase 11: Daily Notes ────────────────────────────────────────────────
  ipcMain.handle('open-daily-note', async () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    const dailyDir = path.join(vaultPath, 'Daily');
    if (!(await fs.promises.stat(dailyDir).then(() => true).catch(() => false))) {
      await fs.promises.mkdir(dailyDir, { recursive: true });
    }
    
    const notePath = path.join(dailyDir, `${dateStr}.md`);
    if (!(await fs.promises.stat(notePath).then(() => true).catch(() => false))) {
      const content = `---\ntags: ["daily"]\n---\n# ${dateStr}\n\n`;
      await fs.promises.writeFile(notePath, content, 'utf-8');
      indexFile(notePath, content);
    }
    
    return notePath;
  });
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  const vaultPath    = await initVault();
  const settingsPath = await initSettings(vaultPath);

  // Build the full backlink index before registering IPC handlers
  await buildFullIndex(vaultPath);
  registerIpcHandlers(vaultPath, settingsPath);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
