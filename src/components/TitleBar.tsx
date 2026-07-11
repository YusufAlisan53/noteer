// TitleBar component
import { useFileStore } from '../store/useFileStore';

const IconClose = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconMinus = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconMaximize = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="1" />
  </svg>
);

export default function TitleBar({ title }: { title: string }) {
  return (
    <div
      className="flex items-center justify-between w-full h-8 px-3 bg-panel border-b border-border flex-shrink-0"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Left side actions */}
      <div className="w-16 flex items-center" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button
          onClick={() => useFileStore.getState().toggleGraphView()}
          className="text-[10px] uppercase tracking-wider text-text-muted hover:text-text-primary px-2 py-0.5 rounded bg-overlay/50 hover:bg-overlay transition-all duration-200 ease-out active:scale-95 outline-none focus-visible:ring-1 focus-visible:ring-gray-700"
          title="Open Graph View"
        >
          Graph
        </button>
      </div>

      {/* Center Title */}
      <span className="text-xs font-medium text-text-muted tracking-widest uppercase select-none pointer-events-none truncate px-4">
        {title || 'Noteer'}
      </span>

      {/* Window Controls (macOS style layout but on the right, or standard Windows style) */}
      <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button
          title="Minimize"
          onClick={() => window.electronAPI.windowMinimize()}
          className="w-3 h-3 rounded-full bg-gray-600 hover:bg-[#febc2e] active:scale-90 transition-all duration-200 ease-out flex items-center justify-center group outline-none focus-visible:ring-1 focus-visible:ring-gray-700"
        >
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-black">
            <IconMinus />
          </span>
        </button>
        <button
          title="Maximize"
          onClick={() => window.electronAPI.windowMaximize()}
          className="w-3 h-3 rounded-full bg-gray-600 hover:bg-[#28c840] active:scale-90 transition-all duration-200 ease-out flex items-center justify-center group outline-none focus-visible:ring-1 focus-visible:ring-gray-700"
        >
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-black">
            <IconMaximize />
          </span>
        </button>
        <button
          title="Close"
          onClick={() => window.electronAPI.windowClose()}
          className="w-3 h-3 rounded-full bg-gray-600 hover:bg-[#ff5f57] active:scale-90 transition-all duration-200 ease-out flex items-center justify-center group outline-none focus-visible:ring-1 focus-visible:ring-gray-700"
        >
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-100 text-black">
            <IconClose />
          </span>
        </button>
      </div>
    </div>
  );
}
