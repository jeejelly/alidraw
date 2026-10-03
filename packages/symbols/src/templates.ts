import type { ExcalidrawElement } from "@excalidraw/element/types";

import { buildElements } from "./build";
import { COMPONENTS, defaultsOf, type Shape, type Values } from "./components";

import type { SymbolTheme } from "./theme";

/**
 * Whole screens made of components: each part is its own symbol (a group with
 * its settings), so every part stays editable, themable, stretchable, and
 * comes out in the code export.
 */
export type TemplatePart = {
  component: string;
  values?: Values;
  x: number;
  y: number;
};

export type TemplateDef = {
  id: string;
  name: string;
  tags: string;
  parts: TemplatePart[];
};

const phone: TemplatePart = { component: "phone", x: 0, y: 0 };

const W = 328;
const part = (
  component: string,
  x: number,
  y: number,
  values: Values = {},
): TemplatePart => ({ component, x, y, values });

export const TEMPLATES: readonly TemplateDef[] = [
  {
    id: "tpl-login",
    name: "Sign in",
    tags: "login form account password",
    parts: [
      phone,
      part("app-bar", 0, 28, {
        title: "Sign in",
        size: "center",
        width: 360,
        actions: 0,
      }),
      part("input", 16, 120, { label: "Email", icon: "mail", width: W }),
      part("input", 16, 206, {
        label: "Password",
        icon: "lock",
        trailing: "eye",
        width: W,
      }),
      part("button", 16, 308, { label: "Sign in", width: W }),
      part("button", 16, 364, {
        label: "Forgot password?",
        look: "text",
        width: W,
      }),
      part("button", 16, 440, {
        label: "Continue with a link",
        look: "outline",
        width: W,
      }),
    ],
  },
  {
    id: "tpl-settings",
    name: "Settings",
    tags: "preferences options switches list",
    parts: [
      phone,
      part("app-bar", 0, 28, {
        title: "Settings",
        leading: "arrow-left",
        actions: 0,
        width: 360,
      }),
      part("list", 16, 112, {
        rows: 4,
        lines: "one",
        leading: "icon",
        trailing: "switch",
        style: "lines",
        width: W,
      }),
      part("list", 16, 340, {
        rows: 3,
        lines: "two",
        leading: "none",
        trailing: "chevron",
        style: "lines",
        width: W,
      }),
      part("button", 16, 600, { label: "Sign out", look: "danger", width: W }),
    ],
  },
  {
    id: "tpl-browse",
    name: "Search and list",
    tags: "browse results catalogue feed",
    parts: [
      phone,
      part("app-bar", 0, 28, { title: "My app", actions: 2, width: 360 }),
      part("search-bar", 16, 96, { width: W }),
      part("pills", 16, 160, {
        labels: "All, Recipes, Drinks, Sweets",
        active: 1,
      }),
      part("list", 16, 214, {
        rows: 5,
        lines: "two",
        leading: "status",
        trailing: "actions",
        style: "cards",
        width: W,
      }),
      part("navigation-bar", 0, 648, {}),
      part("fab", 280, 578, {}),
    ],
  },
  {
    id: "tpl-dashboard",
    name: "Dashboard",
    tags: "overview stats numbers table progress",
    parts: [
      phone,
      part("app-bar", 0, 28, {
        title: "Overview",
        size: "medium",
        width: 360,
        actions: 1,
      }),
      part("stat", 16, 160, {}),
      part("stat", 184, 160, {}),
      part("progress", 16, 280, {
        value: 62,
        style: "bar",
        label: true,
        width: W,
      }),
      part("table", 16, 330, { rows: 4, width: W }),
      part("navigation-bar", 0, 648, {}),
    ],
  },
  {
    id: "tpl-checkout",
    name: "Checkout form",
    tags: "payment steps address form",
    parts: [
      phone,
      part("app-bar", 0, 28, {
        title: "Checkout",
        leading: "arrow-left",
        actions: 0,
        width: 360,
      }),
      part("steps", 40, 110, {
        labels: "Cart, Details, Pay",
        current: 2,
        gap: 124,
      }),
      part("input", 16, 190, { label: "Full name", width: W }),
      part("input", 16, 270, { label: "Address", icon: "map-pin", width: W }),
      part("select", 16, 360, { value: "Country", width: W }),
      part("checkbox", 16, 440, {
        label: "Save for next time",
        value: "checked",
      }),
      part("button", 16, 600, { label: "Continue", width: W }),
    ],
  },
  {
    id: "tpl-onboarding",
    name: "Welcome",
    tags: "intro onboarding carousel first launch",
    parts: [
      phone,
      part("carousel", 16, 120, {
        items: 3,
        active: 1,
        style: "hero",
        height: 300,
      }),
      part("pagination", 52, 330, { pages: 3, current: 1 }),
      part("button", 16, 560, { label: "Get started", width: W }),
      part("button", 16, 616, { label: "Skip", look: "text", width: W }),
    ],
  },
  {
    id: "tpl-confirm",
    name: "Screen with a dialog",
    tags: "modal confirm delete alert",
    parts: [
      phone,
      part("app-bar", 0, 28, { title: "Collections", actions: 1, width: 360 }),
      part("list", 16, 112, {
        rows: 4,
        lines: "two",
        leading: "icon",
        trailing: "chevron",
        style: "cards",
        width: W,
      }),
      part("dialog", 20, 250, {
        title: "Delete collection?",
        body: "This cannot be undone.",
        width: 320,
      }),
    ],
  },
];

/** the shapes of a template, placed, for the panel's preview */
export const templateShapes = (t: TemplateDef, theme: SymbolTheme): Shape[] =>
  t.parts.flatMap((p) => {
    const def = COMPONENTS.find((c) => c.id === p.component);
    if (!def) {
      return [];
    }
    return def.shapes(theme, { ...defaultsOf(def), ...p.values }).map((s) =>
      s.t === "line"
        ? {
            ...s,
            pts: s.pts.map(([x, y]) => [x + p.x, y + p.y] as [number, number]),
          }
        : ({ ...s, x: (s as any).x + p.x, y: (s as any).y + p.y } as Shape),
    );
  });

/** the elements of a template: one group per part */
export const buildTemplate = (
  t: TemplateDef,
  theme: SymbolTheme,
): ExcalidrawElement[] =>
  t.parts.flatMap((p) => {
    const def = COMPONENTS.find((c) => c.id === p.component);
    if (!def) {
      return [];
    }
    const values = { ...defaultsOf(def), ...p.values };
    return buildElements(
      def.shapes(theme, values),
      theme,
      { x: p.x, y: p.y },
      p.component,
      values,
    );
  });
