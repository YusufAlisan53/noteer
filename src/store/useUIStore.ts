import { create } from 'zustand';

interface UIStoreState {
  isCommandPaletteOpen: boolean;
}

interface UIStoreActions {
  toggleCommandPalette: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
}

export type UIStore = UIStoreState & UIStoreActions;

export const useUIStore = create<UIStore>((set) => ({
  isCommandPaletteOpen: false,

  toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
  openCommandPalette: () => set({ isCommandPaletteOpen: true }),
  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),
}));
