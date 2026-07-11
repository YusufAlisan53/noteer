import { useFileStore, selectOpenTabs, selectActiveFilePath } from '../store/useFileStore';
import { useSettingsStore } from '../store/useSettingsStore';
export default function TabBar() {
  const openTabs = useFileStore(selectOpenTabs);
  const activeFilePath = useFileStore(selectActiveFilePath);
  const setActiveTab = useFileStore((s) => s.setActiveTab);
  const closeTab = useFileStore((s) => s.closeTab);

  const viewMode = useSettingsStore(s => s.settings.ui.viewMode);
  const setUI = useSettingsStore(s => s.setUI);

  if (openTabs.length === 0) return null;

  return (
    <div className="flex h-9 bg-transparent overflow-x-auto select-none flex-shrink-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <div className="flex flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {openTabs.map((tab) => {
          const isActive = tab.path === activeFilePath;
          return (
            <div
              key={tab.path}
              onClick={() => setActiveTab(tab.path)}
              className={`
                group relative flex items-center h-full px-3 min-w-[120px] max-w-[200px] cursor-pointer border-t
                transition-colors duration-100
                ${isActive
                  ? 'text-gray-200 bg-[#121212] border-gray-600'
                  : 'text-gray-500 bg-transparent border-transparent hover:bg-[#1a1a1a]'}
              `}
            >
              <span className="flex-1 text-[11px] font-medium truncate mr-2">
                {tab.name.replace(/\.md$/i, '')}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.path);
                }}
                className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded hover:bg-gray-700/50 flex items-center justify-center transition-all duration-200 ease-out active:scale-90 outline-none focus-visible:ring-1 focus-visible:ring-gray-700 flex-shrink-0 text-text-muted hover:text-text-primary"
                title="Close tab"
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* ── View Mode Controls ── */}
      <div className="flex items-center gap-1 px-3 border-l border-[#1e1e1e]">
        {(['edit', 'split', 'preview'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setUI({ viewMode: mode })}
            className={`
              text-[10px] font-medium uppercase tracking-wider transition-all duration-200 ease-out active:scale-95 outline-none focus-visible:ring-1 focus-visible:ring-gray-700
              ${viewMode === mode ? 'text-gray-200 bg-[#1e1e1e] px-2 py-1 rounded' : 'text-gray-500 hover:text-gray-300 px-2 py-1'}
            `}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
}
