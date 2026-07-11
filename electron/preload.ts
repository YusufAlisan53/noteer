import { contextBridge, ipcRenderer } from 'electron';
import type {
  ElectronAPI,
  FileNode,
  CreateItemPayload,
  DeleteItemPayload,
  ReadFilePayload,
  ReadFileResult,
  SaveFilePayload,
  IpcResult,
  PingPayload,
  PongResponse,
} from '../src/types';
import type { NoteerSettings } from '../src/types/settings';

// ─── Context Bridge Exposure ──────────────────────────────────────────────────
// Only explicitly whitelisted functions are exposed. The renderer process
// has ZERO direct access to ipcRenderer, Node.js, or any Electron API.
contextBridge.exposeInMainWorld('electronAPI', {

  // ── Phase 1 ─────────────────────────────────────────────────────────────
  ping: (payload: PingPayload): Promise<PongResponse> =>
    ipcRenderer.invoke('ping', payload),

  // ── Phase 2 ─────────────────────────────────────────────────────────────
  getFileTree: (): Promise<FileNode[]> =>
    ipcRenderer.invoke('get-file-tree'),

  createItem: (payload: CreateItemPayload): Promise<IpcResult> =>
    ipcRenderer.invoke('create-item', payload),

  deleteItem: (payload: DeleteItemPayload): Promise<IpcResult> =>
    ipcRenderer.invoke('delete-item', payload),

  // ── Phase 3 ─────────────────────────────────────────────────────────────
  readFile: (payload: ReadFilePayload): Promise<ReadFileResult> =>
    ipcRenderer.invoke('read-file', payload),

  getSettings: (): Promise<NoteerSettings> =>
    ipcRenderer.invoke('get-settings'),

  saveSettings: (settings: NoteerSettings): Promise<IpcResult> =>
    ipcRenderer.invoke('save-settings', settings),

  // ── Phase 4 ─────────────────────────────────────────────────────────────
  saveFile: (payload: SaveFilePayload): Promise<IpcResult> =>
    ipcRenderer.invoke('save-file', payload),

  // ── Phase 5 ─────────────────────────────────────────────────────────────
  getBacklinks: (payload: { targetName: string }): Promise<string[]> =>
    ipcRenderer.invoke('get-backlinks', payload),

  // ── Phase 8: Window Controls ──────────────────────────────────────────────
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),

  // ── Phase 9: Graph View ───────────────────────────────────────────────────
  getGraphData: () => ipcRenderer.invoke('get-graph-data'),

  // ── Phase 11: Daily Notes ─────────────────────────────────────────────────
  openDailyNote: () => ipcRenderer.invoke('open-daily-note'),

} satisfies ElectronAPI);

// ─── Global Type Augmentation ─────────────────────────────────────────────────
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
