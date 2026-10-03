import fs from "node:fs";

import path from "node:path";

import React from "react";

import { getCommonBounds } from "@excalidraw/element";

import { getFlowMeta, readFlow } from "@excalidraw/flow";
import { serializeFlow } from "@excalidraw/flow";
import {
  buildElements,
  getSymbolMeta,
  symbolGroupOf,
} from "@excalidraw/symbols";
import { COMPONENTS, defaultsOf, type Values } from "@excalidraw/symbols";
import { ILLUSTRATIONS } from "@excalidraw/symbols";
import { importSvg } from "@excalidraw/vector";
import { generateResponsiveSceneCode } from "@excalidraw/symbols";

import { THEMES, type SymbolTheme } from "@excalidraw/symbols";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { setSymbolTheme } from "../../components/inspector/symbols/themeStore";
import { exportToSvg } from "../../scene/export";
import { Excalidraw } from "../../index";
import { serializeAsJSON } from "../../data/json";

import { liveElements } from "../helpers/fixtures";
import { API } from "../helpers/api";
import {
  act,
  fireEvent,
  mockBoundingClientRect,
  render,
  restoreOriginalGetBoundingClientRect,
  screen,
  unmountComponent,
} from "../test-utils";

/**
 * Designs "Crumbly" (a cookie social network: website plus phone app) using only
 * app features: symbols, flow elements, Flow tab text and code export.
 * Run with WRITE_FIXTURE=1 to write the result to docs/fixtures/crumbly/.
 */

unmountComponent();

const handle = window.h;
const FLOW = "Crumbly";

/** the app's own default look: white sheets, coral accent, round shapes */
const COOKIE: SymbolTheme = THEMES.find((theme) => theme.name === "Pop")!;
/** the canvas behind the screens */
const BACKDROP = "#20202e";

type Part = [component: string, x: number, y: number, values?: Values];

const centerOf = (els: readonly ExcalidrawElement[]) => {
  const [x1, y1, x2, y2] = getCommonBounds(els);
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
};
const client = (point: { x: number; y: number }) => ({
  clientX: point.x + handle.state.scrollX + handle.state.offsetLeft,
  clientY: point.y + handle.state.scrollY + handle.state.offsetTop,
});

/** the symbols of a screen, from the library, inserted the way the panel does */
type Art = [illustration: string, x: number, y: number, size: number];

const insertScreen = (
  parts: Part[],
  at: { x: number; y: number },
  arts: Art[] = [],
) => {
  const drawings = arts.flatMap(
    ([id, x, y, size]) =>
      importSvg(
        ILLUSTRATIONS.find((illustration) => illustration.id === id)!.svg,
        { x, y },
        size,
      ).elements,
  );
  const elements = parts.flatMap(([id, x, y, values]) => {
    const def = COMPONENTS.find((component) => component.id === id)!;
    const merged = { ...defaultsOf(def), ...values };
    return buildElements(
      def.shapes(COOKIE, merged),
      COOKIE,
      { x, y },
      id,
      merged,
    );
  });
  elements.push(...(drawings as any));
  const known = new Set(liveElements().map((element) => element.id));
  act(() => {
    handle.app.addElementsFromPasteOrLibrary({
      elements,
      files: null,
      position: client(at),
    });
  });
  const made = liveElements().filter((element) => !known.has(element.id));
  return {
    all: made,
    of: (component: string) =>
      made.filter((element) => getSymbolMeta(element)?.component === component),
  };
};

const convert = (els: readonly ExcalidrawElement[], label: string) => {
  API.setSelectedElements(els as any);
  let key: string | null = null;
  act(() => {
    key = handle.app.flow.convertSelection(FLOW, label);
  });
  expect(key).toBeTruthy();
  return key as unknown as string;
};

const handleOf = (key: string) => {
  const el = liveElements().find(
    (element) =>
      getFlowMeta(element)?.kind === "handle" &&
      getFlowMeta(element)!.key === key,
  )!;
  return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
};

/** drag a handle onto whatever is at `to`, with the pointer */
const link = (fromKey: string, to: { x: number; y: number }) => {
  const canvas = document.querySelector("canvas.interactive")!;
  fireEvent.pointerDown(canvas, client(handleOf(fromKey)));
  fireEvent.pointerMove(window, client(to));
  fireEvent.pointerUp(window, client(to));
};

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 650));
  });

describe("Crumbly: a social network about eating cookies", () => {
  beforeAll(() => {
    mockBoundingClientRect({ width: 1000, height: 1000 });
  });
  afterAll(() => {
    restoreOriginalGetBoundingClientRect();
  });

  it("is designed, wired as a flow and exported with the app's own tools", async () => {
    await render(<Excalidraw />);
    API.setAppState({ paletteOpen: true });
    setSymbolTheme(COOKIE);
    API.setAppState({ viewBackgroundColor: BACKDROP });

    // the phone app
    const feed = insertScreen(
      [
        ["phone", 0, 0],
        ["app-bar", 0, 28, { title: "Crumbly", actions: 2, width: 360 }],
        [
          "pills",
          16,
          96,
          { labels: "All, Chip, Oatmeal, Shortbread", active: 0 },
        ],
        [
          "card",
          16,
          152,
          {
            title: "Maya ate 3 chocolate chips",
            body: "Still warm. Would dunk again.",
            media: true,
            width: 328,
          },
        ],
        [
          "card",
          16,
          316,
          {
            title: "Leo dunked oatmeal raisin",
            body: "Two glasses of milk later.",
            media: true,
            width: 328,
          },
        ],
        ["fab", 280, 578],
        ["navigation-bar", 0, 648],
      ],
      { x: 0, y: 0 },
    );
    const compose = insertScreen(
      [
        ["phone", 0, 0],
        [
          "app-bar",
          0,
          28,
          { title: "New crumb", leading: "arrow-left", actions: 0, width: 360 },
        ],
        [
          "input",
          16,
          100,
          {
            label: "Which cookie?",
            value: "Chocolate chip, still warm",
            width: 328,
          },
        ],
        [
          "input",
          16,
          180,
          {
            label: "How did it go?",
            value: "Crunchy outside, chewy inside",
            width: 328,
          },
        ],
        [
          "pills",
          16,
          270,
          { labels: "Warm, Crunchy, Chewy, Dunked", active: 0 },
        ],
        ["rating", 16, 330, { value: 4 }],
        ["button", 16, 400, { label: "Share a crumb", width: 328 }],
      ],
      { x: 520, y: 0 },
    );
    const profile = insertScreen(
      [
        ["phone", 0, 0],
        [
          "app-bar",
          0,
          28,
          { title: "Maya", size: "center", actions: 1, width: 360 },
        ],
        ["avatar-photo", 16, 104],
        [
          "progress",
          16,
          190,
          { value: 72, style: "bar", label: true, width: 328 },
        ],
        ["tabs", 16, 230, { labels: "Crumbs, Bakers, Jars", width: 328 }],
        [
          "list",
          16,
          290,
          { rows: 4, lines: "two", leading: "status", width: 328 },
        ],
        ["navigation-bar", 0, 648],
      ],
      { x: 1040, y: 0 },
    );

    // the website
    const web = insertScreen(
      [
        ["browser", 0, 0],
        [
          "app-bar",
          0,
          40,
          { title: "Crumbly", look: "accent", actions: 2, width: 800 },
        ],
        ["search-bar", 24, 112, { width: 400 }],
        ["button", 640, 112, { label: "Get the app", width: 136 }],
        [
          "card",
          24,
          172,
          {
            title: "Tonight's jar: oatmeal raisin",
            body: "412 bakers are dunking right now",
            media: true,
            width: 400,
          },
        ],
        [
          "list",
          464,
          196,
          { rows: 3, lines: "two", leading: "status", width: 312 },
        ],
      ],
      { x: 520, y: 900 },
      [["jar", 24, 380, 110]],
    );
    // first and last screens of the app: the welcome and the thanks
    const welcome = insertScreen(
      [
        ["phone", 0, 0],
        [
          "app-bar",
          0,
          28,
          {
            title: "Welcome to Crumbly",
            size: "large",
            actions: 0,
            width: 360,
          },
        ],
        ["pagination", 60, 492, { pages: 5, current: 2 }],
        ["button", 16, 600, { label: "Let's bake", width: 328 }],
      ],
      { x: -520, y: 0 },
      [["baker", 30, 190, 300]],
    );
    const thanks = insertScreen(
      [
        ["phone", 0, 0],
        [
          "app-bar",
          0,
          28,
          { title: "Thank you!", size: "large", actions: 0, width: 360 },
        ],
        ["button", 16, 600, { label: "Continue", width: 328 }],
      ],
      { x: 1560, y: 0 },
      [["hands", 30, 190, 300]],
    );
    for (const mockup of [feed, compose, profile, web, welcome, thanks]) {
      expect(mockup.all.length).toBeGreaterThan(8);
    }
    // everything is a real symbol: groups with settings, in the cookie colours
    expect(
      new Set(
        liveElements()
          .map((element) => getSymbolMeta(element)?.component)
          .filter(Boolean),
      ).size,
    ).toBeGreaterThanOrEqual(10);
    // parts stay inside their phone
    const overflowing: string[] = [];
    for (const mockup of [feed, compose, profile, welcome, thanks]) {
      const [qx1, qy1, qx2, qy2] = getCommonBounds(mockup.of("phone"));
      const groups = new Map<string, ExcalidrawElement[]>();
      for (const element of mockup.all) {
        const groupKey = symbolGroupOf(element) ?? element.id;
        groups.set(groupKey, [...(groups.get(groupKey) ?? []), element]);
      }
      for (const members of groups.values()) {
        const [minX, minY, maxX, maxY] = getCommonBounds(members);
        const name = getSymbolMeta(members[0])?.component;
        if (
          name !== "phone" &&
          (minX < qx1 - 1 || maxX > qx2 + 1 || minY < qy1 - 1 || maxY > qy2 + 1)
        ) {
          overflowing.push(name ?? "?");
        }
      }
      const [px1, py1, px2, py2] = getCommonBounds(mockup.of("phone"));
      const [x1, y1, x2, y2] = getCommonBounds(mockup.all);
      expect([
        x1 >= px1 - 1,
        x2 <= px2 + 1,
        y1 >= py1 - 1,
        y2 <= py2 + 1,
      ]).toEqual([true, true, true, true]);
    }
    // nothing sticks out of the browser window either
    {
      const [bx1, by1, bx2, by2] = getCommonBounds(web.of("browser"));
      const [x1, y1, x2, y2] = getCommonBounds(web.all);
      overflowing.push(
        ...(x1 < bx1 - 1 || x2 > bx2 + 1 || y1 < by1 - 1 || y2 > by2 + 1
          ? [`web ${[x1 - bx1, y1 - by1, x2 - bx2, y2 - by2].map(Math.round)}`]
          : []),
      );
    }
    // nothing sticks out of its phone
    expect(overflowing).toEqual([]);

    // flow elements: buttons first, then the screens that hold them
    const newCrumb = convert(feed.of("fab"), "New crumb");
    const share = convert(compose.of("button"), "Share");
    const profileTab = convert(feed.of("navigation-bar"), "Profile tab");
    const getApp = convert(web.of("button"), "Get the app");
    const letsBake = convert(welcome.of("button"), "Let's bake");
    const cont = convert(thanks.of("button"), "Continue");
    const feedKey = convert(
      liveElements().filter(
        (element) =>
          feed.all.some((member) => member.id === element.id) ||
          getFlowMeta(element)?.key === newCrumb ||
          getFlowMeta(element)?.key === profileTab,
      ),
      "Feed",
    );
    const composeKey = convert(
      liveElements().filter(
        (element) =>
          compose.all.some((member) => member.id === element.id) ||
          getFlowMeta(element)?.key === share,
      ),
      "Compose",
    );
    const profileKey = convert(profile.all, "Profile");
    convert(
      liveElements().filter(
        (element) =>
          welcome.all.some((member) => member.id === element.id) ||
          getFlowMeta(element)?.key === letsBake,
      ),
      "Welcome",
    );
    const thanksKey = convert(
      liveElements().filter(
        (element) =>
          thanks.all.some((member) => member.id === element.id) ||
          getFlowMeta(element)?.key === cont,
      ),
      "Thank you",
    );
    convert(
      liveElements().filter(
        (element) =>
          web.all.some((member) => member.id === element.id) ||
          getFlowMeta(element)?.key === getApp,
      ),
      "Web feed",
    );

    // links, dragged from handle to screen
    link(newCrumb, centerOf(compose.of("phone")));
    link(share, centerOf(thanks.of("phone")));
    link(cont, centerOf(feed.of("phone")));
    link(letsBake, centerOf(feed.of("phone")));
    link(profileTab, centerOf(profile.of("phone")));
    link(getApp, centerOf(feed.of("phone")));
    let text = serializeFlow(readFlow(handle.elements, FLOW));
    expect(text).toMatch(/subgraph feed\["Feed"\]/);
    expect(text).toMatch(
      /subgraph feed\["Feed"\]\n\s+new_crumb\["New crumb"\]\n\s+profile_tab\["Profile tab"\]/,
    );
    expect(text).toContain(`${newCrumb} --> ${composeKey}`);
    expect(text).toContain(`${share} --> ${thanksKey}`);
    expect(text).toContain(`${cont} --> ${feedKey}`);
    expect(text).toContain(`${letsBake} --> ${feedKey}`);
    expect(text).toContain(`${profileTab} --> ${profileKey}`);
    expect(text).toContain(`${getApp} --> ${feedKey}`);

    // the Flow tab: label a link in the Mermaid text, the design stays
    fireEvent.click(screen.getByTestId("inspector-tab-flow"));
    const source = screen.getByTestId("flow-source") as HTMLTextAreaElement;
    const before = liveElements().find(
      (element) => element.id === feed.of("card")[0].id,
    )!;
    fireEvent.change(source, {
      target: {
        value: source.value.replace(
          `${newCrumb} --> ${composeKey}`,
          `${newCrumb} -->|"tap"| ${composeKey}`,
        ),
      },
    });
    await settle();
    text = serializeFlow(readFlow(handle.elements, FLOW));
    expect(text).toContain(`${newCrumb} -->|"tap"| ${composeKey}`);
    const after = liveElements().find((element) => element.id === before.id)!;
    expect([after.x, after.y, after.width]).toEqual([
      before.x,
      before.y,
      before.width,
    ]);
    expect(symbolGroupOf(after)).toBeTruthy();

    // the whole thing as code
    const code = generateResponsiveSceneCode(
      liveElements().filter((element) => !getFlowMeta(element)),
      COOKIE,
    )!;
    expect(code.html).toContain("Crumbly");
    expect(code.compose).toContain("@Composable");

    if (process.env.WRITE_FIXTURE) {
      const dir = path.join(process.cwd(), "docs", "fixtures", "crumbly");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "crumbly.mmd"), text);
      fs.writeFileSync(path.join(dir, "crumbly.html"), code.html);
      fs.writeFileSync(path.join(dir, "Crumbly.kt"), code.compose);
      fs.writeFileSync(
        path.join(dir, "crumbly.excalidraw"),
        serializeAsJSON(handle.elements, handle.state, {}, "local"),
      );
      const svg = await exportToSvg(
        liveElements() as any,
        {
          exportBackground: true,
          viewBackgroundColor: BACKDROP,
          exportPadding: 40,
        },
        null,
      );
      fs.writeFileSync(path.join(dir, "crumbly.svg"), svg.outerHTML);
    }
  }, 120000);
});
