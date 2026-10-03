import { useSyncExternalStore } from "react";

import type { ReactNode } from "react";

import type { ExcalidrawImperativeAPI } from "./types";

/**
 * Tabs the host application adds to the palette (the desktop app adds its
 * project browser this way). A tab is a title and a function that draws it.
 */
export type HostPaletteTab = {
  id: string;
  title: string;
  render: (ctx: { api: ExcalidrawImperativeAPI }) => ReactNode;
};

let tabs: readonly HostPaletteTab[] = [];
const listeners = new Set<() => void>();

export const registerPaletteTab = (tab: HostPaletteTab) => {
  tabs = [...tabs.filter((existing) => existing.id !== tab.id), tab];
  listeners.forEach((listener) => listener());
  return () => {
    tabs = tabs.filter((existing) => existing !== tab);
    listeners.forEach((listener) => listener());
  };
};

export const useHostPaletteTabs = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => tabs,
  );
