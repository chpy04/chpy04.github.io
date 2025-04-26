import { create } from "zustand";
import { FOCUS_BREAKPOINT, ZOOM_STEP } from "./constants";

type StoreState = {
  // Camera and navigation
  cameraX: number;
  cameraY: number;
  cameraZ: number;

  targetCameraX: number;
  targetCameraY: number;
  targetCameraZ: number;

  // Event focus
  currentEventIdx: number;
  focussedMode: boolean;

  // Actions
  setCameraX: (x: number) => void;
  setCameraY: (y: number) => void;
  setCameraZ: (z: number) => void;
  setTargetX: (x: number) => void;
  setTargetY: (x: number) => void;
  setTargetZ: (x: number) => void;
  setCurrentEvent: (index: number) => void;
  setFocussedMode: (zoomed: boolean) => void;

  // Helpers
  getCameraPosition: () => [number, number, number];
  zoomIn: () => void;
  zoomOut: () => void;
};

export const useStore = create<StoreState>((set, get) => ({
  cameraX: 0,
  cameraY: 0,
  cameraZ: 5,

  targetCameraX: 0,
  targetCameraY: 0,
  targetCameraZ: 5,

  currentEventIdx: 0,
  focussedMode: false,

  setCameraX: (x) => set({ cameraX: x }),
  setCameraY: (y) => set({ cameraY: y }),
  setCameraZ: (z) => set({ cameraZ: z }),
  setTargetX: (x) => set({ targetCameraX: x }),
  setTargetY: (y) => set({ targetCameraY: y }),
  setTargetZ: (z) => set({ targetCameraZ: z }),
  setCurrentEvent: (index) => set({ currentEventIdx: index }),
  setFocussedMode: (zoomed) => set({ focussedMode: zoomed }),

  getCameraPosition: () => {
    const { cameraX, cameraY, cameraZ } = get();
    return [cameraX, cameraY, cameraZ];
  },

  zoomIn: () => {
    const { focussedMode, cameraZ: curZLevel } = get();
    if (!focussedMode) {
      set({ focussedMode: true, cameraZ: FOCUS_BREAKPOINT });
    } else {
      set({ cameraZ: curZLevel - ZOOM_STEP });
    }
  },

  zoomOut: () => {
    const { focussedMode, cameraZ: curZLevel } = get();
    if (!focussedMode) return;

    if (curZLevel > FOCUS_BREAKPOINT) {
      set({ focussedMode: false, cameraZ: FOCUS_BREAKPOINT });
    } else {
      set({ cameraZ: curZLevel + ZOOM_STEP });
    }
  },
}));
