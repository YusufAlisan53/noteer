import { useEffect } from 'react';
import { useUIStore } from '../store/useUIStore';

export function useKeybinds() {
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette);
  const closeCommandPalette = useUIStore((s) => s.closeCommandPalette);
  const isCommandPaletteOpen = useUIStore((s) => s.isCommandPaletteOpen);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      // Escape
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        e.preventDefault();
        closeCommandPalette();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCommandPalette, closeCommandPalette, isCommandPaletteOpen]);
}
