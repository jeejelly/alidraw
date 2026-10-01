import { atom } from "../app-jotai";

/** What autosave to file last did, as the footer reports it. */
export type AutosaveStatus =
  | { kind: "off" }
  | { kind: "idle" }
  | { kind: "unsupported" }
  | { kind: "noFile" }
  | { kind: "needsPermission"; fileName: string }
  | { kind: "saving"; fileName: string }
  | { kind: "saved"; fileName: string; at: Date }
  | { kind: "failed"; fileName: string; reason: string };

export const autosaveStatusAtom = atom<AutosaveStatus>({ kind: "off" });
