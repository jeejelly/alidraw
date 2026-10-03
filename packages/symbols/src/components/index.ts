import { PARAMETRIC, REPLACED } from "../parametric";

import { CONTROL_COMPONENTS } from "./controls";
import { DISPLAY_COMPONENTS } from "./display";
import { NAVIGATION_COMPONENTS } from "./navigation";

import type { ComponentDef } from "../shapes";

export * from "../shapes";

const BASIC: readonly ComponentDef[] = [
  ...CONTROL_COMPONENTS,
  ...DISPLAY_COMPONENTS,
  ...NAVIGATION_COMPONENTS,
];

export const COMPONENTS: readonly ComponentDef[] = [
  ...PARAMETRIC,
  ...BASIC.filter((x) => !REPLACED.has(x.id)),
];

export const getComponent = (id: string) => COMPONENTS.find((x) => x.id === id);
