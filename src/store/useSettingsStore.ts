import { create } from 'zustand';
import { DEFAULT_SETTINGS } from '../types/settings';
import type {
  SettingsStore,
  UISettings,
  EditorSettings,
  BehaviorSettings,
  NoteerSettings,
} from '../types/settings';

// ─── Persist helper ───────────────────────────────────────────────────────────
// Debounce saves by 300 ms so rapid sequential mutations (e.g., dragging
// a slider) only result in one disk write.
let _saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(settings: NoteerSettings): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    try {
      await window.electronAPI.saveSettings(settings);
    } catch (err) {
      console.error('[SettingsStore] auto-persist failed:', err);
    }
  }, 300);
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useSettingsStore = create<SettingsStore>((set, get) => ({
  // ── State (queries) ─────────────────────────────────────────────────────
  settings:     { ...DEFAULT_SETTINGS },
  isLoading:    true,
  persistError: null,

  // ── Actions (commands) ──────────────────────────────────────────────────

  loadSettings: async () => {
    try {
      const persisted = await window.electronAPI.getSettings();
      set({ settings: persisted, isLoading: false, persistError: null });
    } catch (err) {
      console.error('[SettingsStore] loadSettings failed:', err);
      set({
        settings:     { ...DEFAULT_SETTINGS },
        isLoading:    false,
        persistError: err instanceof Error ? err.message : 'Failed to load settings.',
      });
    }
  },

  setUI: (patch: Partial<UISettings>) => {
    const current = get().settings;
    const next: NoteerSettings = {
      ...current,
      ui: { ...current.ui, ...patch },
    };
    set({ settings: next });
    scheduleSave(next);
  },

  setEditor: (patch: Partial<EditorSettings>) => {
    const current = get().settings;
    const next: NoteerSettings = {
      ...current,
      editor: { ...current.editor, ...patch },
    };
    set({ settings: next });
    scheduleSave(next);
  },

  setBehavior: (patch: Partial<BehaviorSettings>) => {
    const current = get().settings;
    const next: NoteerSettings = {
      ...current,
      behavior: { ...current.behavior, ...patch },
    };
    set({ settings: next });
    scheduleSave(next);
  },

  resetSettings: () => {
    const next = { ...DEFAULT_SETTINGS };
    set({ settings: next });
    scheduleSave(next);
  },
}));

// ─── Selector helpers (memoisation-friendly) ──────────────────────────────────
// Usage: const sidebarWidth = useSettingsStore(selectSidebarWidth);
export const selectUI       = (s: SettingsStore) => s.settings.ui;
export const selectEditor   = (s: SettingsStore) => s.settings.editor;
export const selectBehavior = (s: SettingsStore) => s.settings.behavior;
