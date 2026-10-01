import { EVENT, viewportCoordsToSceneCoords } from "@excalidraw/common";

import { actionKnifeCut } from "../actions/actionKnife";
import { AngleKeys, resolveAngle, toDegrees } from "../remarkableAngles";

import type App from "./App";

/** a cut shorter than this many screen px is a stray click */
const MIN_CUT = 6;

/**
 * The knife tool: drag a line across shapes to cut them along it. The angle
 * helps: a held number key locks 0/15/30/45/60/75/90/120/135/150°, Shift steps
 * by 15°, and the magnet catches the usual angles; Alt is free.
 */
export class AppKnife {
  private from: { x: number; y: number } | null = null;
  private keys = new AngleKeys();
  private teardown: (() => void) | null = null;

  constructor(private app: App) {}

  isActive = () => this.from !== null;

  /** @returns true when the knife took the press */
  handlePointerDown = (event: React.PointerEvent<HTMLElement>): boolean => {
    if (
      event.button !== 0 ||
      this.app.state.activeTool.type !== "knife" ||
      this.app.state.viewModeEnabled
    ) {
      return false;
    }
    this.from = viewportCoordsToSceneCoords(event, this.app.state);
    this.app.setState({
      knife: { from: this.from, to: this.from, label: "" },
      angleHelper: { active: null },
    });
    this.keys.start(this.app.ownerWindow, () => {
      this.app.setState({ angleHelper: { active: this.keys.key } });
    });
    const win = this.app.ownerWindow;
    const onMove = (e: PointerEvent) => this.move(e);
    const onUp = (e: PointerEvent) => this.up(e);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.cancel();
      }
    };
    win.addEventListener(EVENT.POINTER_MOVE, onMove);
    win.addEventListener(EVENT.POINTER_UP, onUp);
    win.addEventListener(EVENT.KEYDOWN, onKey);
    this.teardown = () => {
      win.removeEventListener(EVENT.POINTER_MOVE, onMove);
      win.removeEventListener(EVENT.POINTER_UP, onUp);
      win.removeEventListener(EVENT.KEYDOWN, onKey);
    };
    return true;
  };

  /** the end of the line for a pointer, with the angle rules applied */
  private resolve = (
    p: { x: number; y: number },
    mods: { shiftKey: boolean; altKey: boolean },
  ) => {
    const from = this.from!;
    const dx = p.x - from.x;
    const dy = p.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
      return { to: from, label: "" };
    }
    // angles run counter-clockwise from the right, as on paper (y is up)
    const raw = Math.atan2(-dy, dx);
    const { angle, how } = resolveAngle(raw, {
      key: this.keys.key,
      shift: mods.shiftKey,
      alt: mods.altKey,
      symmetry: Math.PI * 2,
    });
    // a held key chooses the line's angle, not its side
    let a = angle;
    if (how === "key") {
      const side = Math.cos(angle - raw) >= 0 ? 0 : Math.PI;
      a = angle + side;
    }
    const to = {
      x: from.x + Math.cos(a) * length,
      y: from.y - Math.sin(a) * length,
    };
    const tag =
      how === "key"
        ? ` ⌨${this.keys.key}`
        : how === "magnet"
        ? " ◆"
        : how === "step"
        ? " ⇧"
        : "";
    // a line has no direction: show 0-180
    const shown = toDegrees(a) % 180;
    return { to, label: `${shown}°${tag}` };
  };

  private move = (event: PointerEvent) => {
    if (!this.from) {
      return;
    }
    const p = viewportCoordsToSceneCoords(event, this.app.state);
    const { to, label } = this.resolve(p, event);
    this.app.setState({ knife: { from: this.from, to, label } });
  };

  private up = (event: PointerEvent) => {
    const from = this.from;
    if (!from) {
      return;
    }
    const p = viewportCoordsToSceneCoords(event, this.app.state);
    const { to } = this.resolve(p, event);
    this.end();
    const zoom = this.app.state.zoom.value;
    if (Math.hypot(to.x - from.x, to.y - from.y) * zoom < MIN_CUT) {
      return;
    }
    this.app.actionManager.executeAction(actionKnifeCut, "ui", {
      from: [from.x, from.y],
      to: [to.x, to.y],
    });
  };

  private end = () => {
    this.teardown?.();
    this.teardown = null;
    this.keys.end();
    this.from = null;
    this.app.setState({ knife: null, angleHelper: null });
  };

  cancel = () => {
    if (this.from) {
      this.end();
    }
  };

  destroy = () => this.cancel();
}
