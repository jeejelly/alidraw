import {
  defineParametric,
  ellipseShape,
  iconShape,
  lineShape,
  rectShape,
  textShape,
  type Shape,
} from "../shapes";

import {
  accentParam,
  closed,
  cylinder,
  ellipseArc,
  nodeDef,
  sizeParams,
  withFlow,
} from "./diagramKit";
import { text } from "./helpers";

import type { Token } from "../theme";

const box = (width: number, height: number, ink: Token, dash = false) =>
  rectShape(0, 0, width, height, { r: "ctl", f: "wash", s: ink, dash });

/** a box with an icon on its left and the label in the room that is left */
const iconBox = (
  id: string,
  name: string,
  icon: string,
  label: string,
  tags: string,
) =>
  nodeDef({
    id,
    name,
    category: "Architecture",
    tags,
    width: 160,
    height: 64,
    label,
    flow: { shape: "round" },
    body: (width, height, ink) => [
      box(width, height, ink),
      iconShape(icon, 14, height / 2 - 12, 24, ink),
    ],
    place: (width, height) => [(width + 40) / 2, height / 2, "middle"],
  });

export const service = iconBox(
  "arch-service",
  "Service",
  "cube",
  "Orders",
  "microservice backend component server",
);

export const cache = iconBox(
  "arch-cache",
  "Cache",
  "bolt",
  "Cache",
  "redis memcached fast memory",
);

export const loadBalancer = iconBox(
  "arch-load-balancer",
  "Load balancer",
  "swap",
  "Load balancer",
  "proxy traffic nginx distribute",
);

export const gateway = nodeDef({
  id: "arch-api-gateway",
  name: "API gateway",
  category: "Architecture",
  tags: "entry point edge proxy hexagon",
  width: 170,
  height: 76,
  label: "API gateway",
  flow: { form: "hexagon", shape: "rect" },
  body: (width, height, ink) => {
    const slant = Math.min(height / 2, width / 4);
    return [
      closed(
        [
          [slant, 0],
          [width - slant, 0],
          [width, height / 2],
          [width - slant, height],
          [slant, height],
          [0, height / 2],
        ],
        ink,
      ),
    ];
  },
});

export const queue = nodeDef({
  id: "arch-message-queue",
  name: "Message queue",
  category: "Architecture",
  tags: "kafka rabbitmq broker events stream topic",
  width: 180,
  height: 56,
  label: "Events",
  flow: { shape: "rect" },
  body: (width, height, ink) => [
    box(width, height, ink),
    ...[width - 24, width - 48].map((x) =>
      lineShape(
        [
          [x, 0],
          [x, height],
        ],
        { s: ink },
      ),
    ),
  ],
  place: (width, height) => [(width - 48) / 2, height / 2, "middle"],
});

export const database = nodeDef({
  id: "arch-database",
  name: "Database",
  category: "Architecture",
  tags: "sql storage postgres data cylinder",
  width: 120,
  height: 100,
  label: "Orders DB",
  flow: { form: "cylinder", shape: "rect" },
  body: (width, height, ink) => cylinder(width, height, ink),
  place: (width, height) => [width / 2, height * 0.58, "middle"],
});

export const browser = nodeDef({
  id: "arch-browser",
  name: "Browser / Client",
  category: "Architecture",
  tags: "web frontend client spa window",
  width: 180,
  height: 120,
  label: "Web app",
  flow: { shape: "rect" },
  body: (width, height, ink) => [
    box(width, height, ink),
    lineShape(
      [
        [0, 24],
        [width, 24],
      ],
      { s: ink },
    ),
    ...[0, 1, 2].map((index) =>
      ellipseShape(10 + index * 14, 9, 7, 7, { f: ink, s: null }),
    ),
  ],
  place: (width, height) => [width / 2, 24 + (height - 24) / 2, "middle"],
});

export const mobile = nodeDef({
  id: "arch-mobile-app",
  name: "Mobile app",
  category: "Architecture",
  tags: "phone ios android device client",
  width: 100,
  height: 170,
  label: "App",
  flow: { shape: "round" },
  body: (width, height, ink) => [
    rectShape(0, 0, width, height, { r: "card", f: "wash", s: ink }),
    lineShape(
      [
        [width / 2 - 14, 12],
        [width / 2 + 14, 12],
      ],
      { s: ink },
    ),
  ],
});

export const cloud = nodeDef({
  id: "arch-cloud",
  name: "Cloud",
  category: "Architecture",
  tags: "internet provider aws gcp azure saas",
  width: 200,
  height: 120,
  label: "Cloud",
  flow: { form: "cloud", shape: "ellipse" },
  body: (width, height, ink) => {
    const bump = (
      cx: number,
      cy: number,
      radius: number,
      from: number,
      to: number,
    ) =>
      ellipseArc(
        width * cx,
        height * cy,
        height * radius,
        height * radius,
        (from * Math.PI) / 180,
        (to * Math.PI) / 180,
        8,
      );
    return [
      closed(
        [
          ...bump(0.22, 0.62, 0.28, 100, 270),
          ...bump(0.4, 0.38, 0.26, 180, 330),
          ...bump(0.65, 0.34, 0.3, 200, 370),
          ...bump(0.8, 0.62, 0.28, 280, 450),
        ],
        ink,
      ),
    ];
  },
});

export const actor = withFlow(
  defineParametric(
    "arch-actor",
    "Actor / User",
    "Architecture",
    [text("label", "Label", "User"), accentParam],
    (_theme, values) => {
      const ink = values.accent as Token;
      const line = (...points: [number, number][]): Shape =>
        lineShape(points, { s: ink });
      return [
        ellipseShape(20, 0, 24, 24, { f: "wash", s: ink }),
        line([32, 24], [32, 58]),
        line([10, 36], [54, 36]),
        line([32, 58], [14, 84]),
        line([32, 58], [50, 84]),
        textShape(values.label, 32, 100, 14, "text", "middle"),
      ];
    },
    "person human customer persona stick figure",
  ),
  { shape: "rect", labelParam: "label" },
);

export const external = nodeDef({
  id: "arch-external",
  name: "External system",
  category: "Architecture",
  tags: "third party outside dashed partner vendor",
  width: 170,
  height: 64,
  label: "Payments API",
  flow: { shape: "rect" },
  body: (width, height, ink) => [box(width, height, ink, true)],
});

export const trustBoundary = withFlow(
  defineParametric(
    "arch-trust-boundary",
    "Trust boundary / group",
    "Architecture",
    [
      text("title", "Title", "Private network"),
      ...sizeParams(360, 220),
      accentParam,
    ],
    (_theme, values) => [
      rectShape(0, 0, values.width, values.height, {
        r: "card",
        f: null,
        s: values.accent as Token,
        dash: true,
      }),
      textShape(values.title, 14, 18, 13, "muted"),
    ],
    "zone vpc network security group container perimeter",
  ),
  { shape: "round", labelParam: "title" },
);

export const ARCHITECTURE_COMPONENTS = [
  service,
  gateway,
  queue,
  database,
  cache,
  browser,
  mobile,
  loadBalancer,
  cloud,
  actor,
  external,
  trustBoundary,
];
