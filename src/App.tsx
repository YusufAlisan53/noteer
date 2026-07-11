import { useEffect, useCallback, useState, useRef, useMemo, Suspense, lazy } from 'react';
import Sidebar from './components/Sidebar';
import Editor  from './components/Editor';
import Preview from './components/Preview';
import CommandPalette from './components/CommandPalette';
import ToastContainer from './components/Toast';
import { useKeybinds } from './hooks/useKeybinds';
import { useSettingsStore, selectUI, selectEditor } from './store/useSettingsStore';
import {
  useFileStore,
  selectIsTreeLoading,
  selectError,
  selectActiveFileNode,
  selectIsGraphOpen,
} from './store/useFileStore';
import TitleBar from './components/TitleBar';
const GraphView = lazy(() => import('./components/GraphView'));
import TabBar from './components/TabBar';
import Outline from './components/Outline';
import StatusBar from './components/StatusBar';

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconSidebarToggle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="9" y1="3" x2="9" y2="21"></line>
  </svg>
);

const IconSettingsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconFiles = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <polyline points="13 2 13 9 20 9" />
  </svg>
);

const IconClose = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconZap = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const IconLoader = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

// ─── ActivityBar ──────────────────────────────────────────────────────────────

type PanelId = 'files' | 'search' | 'settings';

function ActivityBar({
  activePanel,
  onPanelChange,
  isSidebarOpen,
  onToggleSidebar,
}: {
  activePanel: PanelId;
  onPanelChange: (id: PanelId) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const items: { id: PanelId; icon: JSX.Element; title: string }[] = [
    { id: 'files',    icon: <IconFiles />,        title: 'Files' },
    { id: 'settings', icon: <IconSettingsIcon />, title: 'Settings' },
  ];

  return (
    <nav
      id="activity-bar"
      className="flex flex-col items-center gap-1 py-2 w-11 bg-canvas border-r border-border flex-shrink-0"
    >
      <button
        title="Toggle Sidebar"
        onClick={onToggleSidebar}
        className={`w-8 h-8 mb-2 rounded-md flex items-center justify-center transition-all duration-150 ${isSidebarOpen ? 'text-text-primary bg-overlay' : 'text-text-muted hover:bg-overlay hover:text-text-secondary'}`}
      >
        <IconSidebarToggle />
      </button>

      {items.map((item) => (
        <button
          key={item.id}
          id={`activity-${item.id}`}
          title={item.title}
          onClick={() => onPanelChange(item.id)}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-all duration-150
            ${activePanel === item.id
              ? 'bg-overlay text-text-primary'
              : 'text-text-muted hover:bg-overlay hover:text-text-secondary'
            }`}
        >
          {item.icon}
        </button>
      ))}
    </nav>
  );
}

// ─── ResizeHandle ─────────────────────────────────────────────────────────────

function ResizeHandle({ onResize }: { onResize: (dx: number) => void }) {
  const dragging = useRef(false);
  const lastX    = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastX.current    = e.clientX;
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      onResize(e.clientX - lastX.current);
      lastX.current = e.clientX;
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [onResize]);

  return (
    <div
      id="sidebar-resize-handle"
      className="w-[3px] flex-shrink-0 cursor-col-resize hover:bg-accent/30 active:bg-accent/60 transition-colors duration-100"
      onMouseDown={onMouseDown}
    />
  );
}

// ─── SettingsPanel ────────────────────────────────────────────────────────────

function SettingsPanel() {
  const ui        = useSettingsStore(selectUI);
  const editor    = useSettingsStore(selectEditor);
  const setUI       = useSettingsStore((s) => s.setUI);
  const setEditor   = useSettingsStore((s) => s.setEditor);
  const reset       = useSettingsStore((s) => s.resetSettings);

  const Toggle = ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: () => void;
  }) => (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`no-drag relative w-8 h-4 rounded-full transition-colors duration-200 ${checked ? 'bg-accent' : 'bg-border'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );

  return (
    <aside id="settings-panel" className="flex flex-col w-56 bg-panel border-r border-border flex-shrink-0 overflow-y-auto">
      <div className="px-3 py-2 border-b border-border flex-shrink-0">
        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">Settings</span>
      </div>

      <div className="flex-1 px-3 py-3 space-y-5">
        {/* ── Interface ── */}
        <section>
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2.5">Interface</p>
          <label className="flex items-center justify-between mb-2.5">
            <span className="text-xs text-text-secondary">Show Preview</span>
            <Toggle checked={ui.showPreview} onChange={() => setUI({ showPreview: !ui.showPreview })} />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Zen Mode</span>
            <Toggle checked={ui.zenMode} onChange={() => setUI({ zenMode: !ui.zenMode })} />
          </label>
        </section>

        {/* ── Editor ── */}
        <section>
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2.5">Editor</p>
          <label className="flex items-center justify-between mb-2.5">
            <span className="text-xs text-text-secondary">Font Size</span>
            <div className="no-drag flex items-center gap-1.5">
              <button className="w-5 h-5 rounded bg-surface border border-border text-text-muted hover:text-text-primary hover:bg-overlay text-xs transition-colors"
                onClick={() => setEditor({ fontSize: Math.max(12, editor.fontSize - 1) })}>−</button>
              <span className="text-xs text-text-primary w-5 text-center tabular-nums">{editor.fontSize}</span>
              <button className="w-5 h-5 rounded bg-surface border border-border text-text-muted hover:text-text-primary hover:bg-overlay text-xs transition-colors"
                onClick={() => setEditor({ fontSize: Math.min(24, editor.fontSize + 1) })}>+</button>
            </div>
          </label>
          <label className="flex items-center justify-between mb-2.5">
            <span className="text-xs text-text-secondary">Word Wrap</span>
            <Toggle checked={editor.wordWrap} onChange={() => setEditor({ wordWrap: !editor.wordWrap })} />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Tab Size</span>
            <div className="no-drag flex items-center gap-1">
              {([2, 4] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setEditor({ tabSize: n })}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${editor.tabSize === n ? 'bg-accent text-white' : 'bg-surface border border-border text-text-muted hover:bg-overlay'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </label>
        </section>

        {/* ── Reset ── */}
        <button
          onClick={reset}
          className="no-drag w-full text-xs text-text-muted hover:text-danger border border-border hover:border-danger/50 rounded-md py-1.5 transition-colors duration-150"
        >
          Reset to Defaults
        </button>
      </div>
    </aside>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const loadSettings   = useSettingsStore((s) => s.loadSettings);
  const settingsReady  = !useSettingsStore((s) => s.isLoading);
  const ui             = useSettingsStore(selectUI);
  const setUI          = useSettingsStore((s) => s.setUI);

  // Destructure UI settings
  const { zenMode, showOutline } = ui;

  const refreshTree    = useFileStore((s) => s.refreshTree);
  const isTreeLoading  = useFileStore(selectIsTreeLoading);
  const error          = useFileStore(selectError);
  const clearError     = useFileStore((s) => s.clearError);
  const activeNode     = useFileStore(selectActiveFileNode);
  const isGraphOpen    = useFileStore(selectIsGraphOpen);

  const [activePanel, setActivePanel] = useState<PanelId>(
    (ui.activePanel as PanelId) ?? 'files',
  );

  const handlePanelChange = useCallback((id: PanelId) => {
    setActivePanel(id);
    setUI({ activePanel: id });
  }, [setUI]);

  // Derive title from active file
  const titleBarTitle = useMemo(() => activeNode
    ? activeNode.name.replace(/\.md$/, '')
    : 'Noteer', [activeNode]);

  // ── Bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => {
    loadSettings();
    refreshTree();
  }, [loadSettings, refreshTree]);

  // ── Command Palette & Keybinds ───────────────────────────────────────────
  useKeybinds();

  // ── Global keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === '1') { e.preventDefault(); handlePanelChange('files'); }
      if (mod && e.key === ',') { e.preventDefault(); handlePanelChange('settings'); }
      if (mod && e.key === 'f') { e.preventDefault(); handlePanelChange('search'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlePanelChange]);

  // ── Sidebar resize & toggle ───────────────────────────────────────────────
  const handleSidebarResize = useCallback((dx: number) => {
    const next = ui.sidebarWidth + dx;
    if (next < 100) {
      setUI({ sidebarWidth: 0 }); // Snap closed
    } else {
      setUI({ sidebarWidth: Math.max(160, Math.min(480, next)) });
    }
  }, [ui.sidebarWidth, setUI]);

  const handleToggleSidebar = useCallback(() => {
    if (activePanel !== 'files') {
      handlePanelChange('files');
      if (ui.sidebarWidth === 0) setUI({ sidebarWidth: 260 });
    } else {
      setUI({ sidebarWidth: ui.sidebarWidth > 0 ? 0 : 260 });
    }
  }, [activePanel, handlePanelChange, ui.sidebarWidth, setUI]);

  // Allow ESC to exit Zen Mode
  useEffect(() => {
    if (!zenMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUI({ zenMode: false });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zenMode, setUI]);

  // ── Loading screen ────────────────────────────────────────────────────────
  if (!settingsReady || isTreeLoading) {
    return (
      <div className="flex flex-col w-screen h-screen bg-canvas text-text-primary overflow-hidden">
        <TitleBar title="Noteer" />
        <div className="flex-1 flex items-center justify-center gap-2.5 text-text-muted">
          <IconLoader />
          <span className="text-sm">{!settingsReady ? 'Loading settings…' : 'Opening vault…'}</span>
        </div>
      </div>
    );
  }

  // ── Main Layout ───────────────────────────────────────────────────────────
  return (
    <div
      id="app-root"
      className="flex flex-col w-screen h-screen bg-canvas text-text-primary overflow-hidden"
    >
      <CommandPalette />
      <ToastContainer />
      <TitleBar title={titleBarTitle} />

      {isGraphOpen && (
        <Suspense fallback={<div className="absolute inset-0 z-40 bg-canvas flex items-center justify-center text-text-muted text-xs">Loading map...</div>}>
          <GraphView />
        </Suspense>
      )}

      {/* Error banner */}
      {error && (
        <div
          className="absolute top-10 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-danger/10 border border-danger/30 rounded-lg text-xs text-danger animate-fade-in cursor-pointer select-none"
          onClick={clearError}
        >
          {error} <span className="opacity-60 ml-2">(click to dismiss)</span>
        </div>
      )}

      {/* Main workspace */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Only show ActivityBar, Sidebar, Settings if not in Zen Mode */}
        {!zenMode && (
          <>
            <ActivityBar 
              activePanel={activePanel} 
              onPanelChange={handlePanelChange} 
              isSidebarOpen={ui.sidebarWidth > 0 && activePanel === 'files'}
              onToggleSidebar={handleToggleSidebar}
            />
            {activePanel === 'files' && ui.sidebarWidth > 0 && (
              <>
                <div style={{ width: ui.sidebarWidth, flexShrink: 0, display: 'flex' }}>
                  <Sidebar />
                </div>
                <ResizeHandle onResize={handleSidebarResize} />
              </>
            )}
            {activePanel === 'settings' && <SettingsPanel />}
          </>
        )}

        {/* ── Main Editor/Preview Area ── */}
        <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
          {!zenMode && <TabBar />}
          <div className="flex flex-row flex-1 min-h-0 h-full overflow-hidden relative">
            {/* ── Editor ── */}
            {ui.viewMode !== 'preview' && (
              <div className={`flex flex-col h-full overflow-hidden ${ui.viewMode === 'split' ? 'w-1/2' : 'flex-1 w-full'}`}>
                <div className={`flex flex-col w-full h-full min-h-0 ${zenMode ? 'max-w-3xl mx-auto' : ''}`}>
                  {zenMode && activeNode && (
                    <div className="px-8 pt-6 pb-2 flex-shrink-0 animate-fade-in">
                      <p className="text-sm font-medium text-text-muted opacity-40 select-none text-center">
                        {activeNode.name.replace(/\.md$/, '')}
                      </p>
                      <p className="text-xs text-text-muted/30 text-center mt-1">Press ESC to exit Zen Mode</p>
                    </div>
                  )}
                  <div className="flex-1 h-full overflow-hidden relative">
                    <Editor />
                  </div>
                </div>
              </div>
            )}

            {/* ── Divider ── */}
            {ui.viewMode === 'split' && !zenMode && (
              <div className="w-[1px] bg-gray-800 h-full flex-shrink-0" />
            )}

            {/* ── Preview ── */}
            {ui.viewMode !== 'edit' && !zenMode && (
              <div className={`flex flex-col h-full overflow-hidden ${ui.viewMode === 'split' ? 'w-1/2' : 'flex-1 w-full'}`}>
                <Preview />
              </div>
            )}
          </div>
        </div>

        {/* ── Outline Sidebar ── */}
        {!zenMode && showOutline && <Outline />}

      </div>

      {/* ── Status Bar ── */}
      <StatusBar />
    </div>
  );
}
