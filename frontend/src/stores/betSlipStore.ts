import { create } from 'zustand';

export interface BetSlipSelection {
  selectionId: string;
  selectionName: string;
  marketName: string;
  odds: number;
  gameId: string;
  homeTeam: string;
  awayTeam: string;
}

interface BetSlipState {
  selections: BetSlipSelection[];
  stake: number;
  useBonus: boolean;
  isOpen: boolean;

  addSelection: (selection: BetSlipSelection) => void;
  removeSelection: (selectionId: string) => void;
  toggleSelection: (selection: BetSlipSelection) => void;
  hasSelection: (selectionId: string) => boolean;
  clearAll: () => void;
  setStake: (stake: number) => void;
  setUseBonus: (useBonus: boolean) => void;
  setOpen: (open: boolean) => void;
  getTotalOdds: () => number;
  getPotentialWin: () => number;
}

export const useBetSlipStore = create<BetSlipState>((set, get) => ({
  selections: [],
  stake: 10,
  useBonus: false,
  isOpen: false,

  addSelection: (selection) => {
    set((state) => ({
      selections: [...state.selections, selection],
      isOpen: true,
    }));
  },

  removeSelection: (selectionId) => {
    set((state) => ({
      selections: state.selections.filter((s) => s.selectionId !== selectionId),
    }));
  },

  toggleSelection: (selection) => {
    const { hasSelection, addSelection, removeSelection } = get();
    if (hasSelection(selection.selectionId)) {
      removeSelection(selection.selectionId);
    } else {
      // Remove any selection from the same game
      set((state) => ({
        selections: state.selections.filter((s) => s.gameId !== selection.gameId),
      }));
      addSelection(selection);
    }
  },

  hasSelection: (selectionId) => {
    return get().selections.some((s) => s.selectionId === selectionId);
  },

  clearAll: () => set({ selections: [], stake: 10 }),

  setStake: (stake) => set({ stake }),

  setUseBonus: (useBonus) => set({ useBonus }),

  setOpen: (open) => set({ isOpen: open }),

  getTotalOdds: () => {
    const { selections } = get();
    if (selections.length === 0) return 1;
    return selections.reduce((acc, s) => acc * s.odds, 1);
  },

  getPotentialWin: () => {
    const { stake, getTotalOdds } = get();
    return parseFloat((stake * getTotalOdds()).toFixed(2));
  },
}));
