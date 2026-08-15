// Type declaration for the API exposed by the preload script via contextBridge.
// The renderer never touches Node.js directly — everything goes through
// window.habiterAPI, which is typed end-to-end against src/types/index.ts.

import type { HabiterAPI } from './index.js';

declare global {
  interface Window {
    habiterAPI: HabiterAPI;
  }
}
