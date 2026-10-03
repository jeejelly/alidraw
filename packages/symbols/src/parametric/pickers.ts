import {
  deg,
  ellipseShape,
  iconShape,
  lineShape,
  defineParametric,
  rectShape,
  textShape,
  type Shape,
} from "../shapes";

import { num, bool, pick } from "./helpers";

export const calendar = defineParametric(
  "calendar",
  "Calendar",
  "Pickers",
  [
    num("year", "Year", 2026, 1970, 2100),
    num("month", "Month", 9, 1, 12),
    num("selected", "Selected day (0 none)", 17, 0, 31),
    bool("mondayFirst", "Week starts Monday", true),
    bool("today", "Mark today as ring", true),
  ],
  (_t, values) => {
    const names = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const first = new Date(values.year, values.month - 1, 1).getDay();
    const lead = values.mondayFirst ? (first + 6) % 7 : first;
    const days = new Date(values.year, values.month, 0).getDate();
    const weeks = Math.ceil((lead + days) / 7);
    const height = 96 + weeks * 38 + 10;
    const out: Shape[] = [
      rectShape(0, 0, 280, height, { r: "card", f: "surface", s: "border" }),
      iconShape("chevron-left", 14, 14, 20, "muted"),
      textShape(
        `${names[values.month - 1]} ${values.year}`,
        140,
        24,
        15,
        "text",
        "middle",
      ),
      iconShape("chevron-right", 246, 14, 20, "muted"),
    ];
    (values.mondayFirst
      ? ["M", "T", "W", "T", "F", "S", "S"]
      : ["S", "M", "T", "W", "T", "F", "S"]
    ).forEach((weekday, index) =>
      out.push(textShape(weekday, 20 + index * 40, 56, 12, "muted", "middle")),
    );
    for (let day = 1; day <= days; day++) {
      const cell = lead + day - 1;
      const x = 20 + (cell % 7) * 40;
      const y = 90 + Math.floor(cell / 7) * 38;
      const sel = day === values.selected;
      if (sel) {
        out.push(
          ellipseShape(x - 17, y - 17, 34, 34, { f: "accent", s: null }),
        );
      } else if (values.today && day === 3) {
        out.push(
          ellipseShape(x - 17, y - 17, 34, 34, { f: null, s: "accent" }),
        );
      }
      out.push(
        textShape(String(day), x, y, 13, sel ? "onAccent" : "text", "middle"),
      );
    }
    return out;
  },
  "date picker month",
);

export const timePicker = defineParametric(
  "time-picker",
  "Time picker",
  "Pickers",
  [
    num("hour", "Hour", 10, 0, 23),
    num("minute", "Minute", 34, 0, 59),
    bool("ampm", "12-hour", false),
    pick("style", "Style", "wheel", ["wheel", "dial"]),
  ],
  (_t, values) => {
    const pad = (value: number) =>
      String(((value % 60) + 60) % 60).padStart(2, "0");
    const hh = (value: number) =>
      values.ampm ? ((value + 11) % 12) + 1 : value;
    if (values.style === "dial") {
      const out: Shape[] = [
        rectShape(0, 0, 240, 300, { r: "card", f: "surface", s: "border" }),
        rectShape(24, 24, 72, 64, { r: "ctl", f: "accent", s: null }),
        textShape(pad(hh(values.hour)), 60, 56, 30, "onAccent", "middle"),
        textShape(":", 108, 54, 28, "text", "middle"),
        rectShape(120, 24, 72, 64, { r: "ctl", f: "surfaceAlt", s: null }),
        textShape(pad(values.minute), 156, 56, 30, "text", "middle"),
        ellipseShape(30, 108, 180, 180, { f: "surfaceAlt", s: null }),
        ellipseShape(116, 194, 8, 8, { f: "accent", s: null }),
      ];
      const angle = deg(-90 + (values.hour % 12) * 30);
      out.push(
        lineShape(
          [
            [120, 198],
            [120 + Math.cos(angle) * 66, 198 + Math.sin(angle) * 66],
          ],
          { s: "accent", sw: 2 },
        ),
        ellipseShape(
          120 + Math.cos(angle) * 66 - 16,
          198 + Math.sin(angle) * 66 - 16,
          32,
          32,
          {
            f: "accent",
            s: null,
          },
        ),
      );
      return out;
    }
    return [
      rectShape(0, 0, 200, 160, { r: "card", f: "surface", s: "border" }),
      rectShape(14, 62, 172, 36, { r: "ctl", f: "surfaceAlt", s: null }),
      textShape(pad(hh(values.hour - 1)), 56, 26, 14, "muted", "middle"),
      textShape(pad(hh(values.hour)), 56, 80, 20, "text", "middle"),
      textShape(pad(hh(values.hour + 1)), 56, 134, 14, "muted", "middle"),
      textShape(":", 100, 80, 20, "muted", "middle"),
      textShape(pad(values.minute - 1), 144, 26, 14, "muted", "middle"),
      textShape(pad(values.minute), 144, 80, 20, "accent", "middle"),
      textShape(pad(values.minute + 1), 144, 134, 14, "muted", "middle"),
    ];
  },
  "clock wheel",
);

export const datePicker = defineParametric(
  "date-picker",
  "Date picker dialog",
  "Pickers",
  [
    num("day", "Day", 17, 1, 28),
    num("month", "Month", 9, 1, 12),
    num("year", "Year", 2026, 1970, 2100),
  ],
  (_t, values) => {
    const names = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      new Date(values.year, values.month - 1, values.day).getDay()
    ];
    const first = new Date(values.year, values.month - 1, 1).getDay();
    const lead = (first + 6) % 7;
    const days = new Date(values.year, values.month, 0).getDate();
    const weeks = Math.ceil((lead + days) / 7);
    const height = 120 + 40 + weeks * 40 + 64;
    const out: Shape[] = [
      rectShape(0, 0, 328, height, { r: "card", f: "surface", s: "border" }),
      textShape("Select date", 24, 28, 12, "muted"),
      textShape(`${wd}, ${names[values.month - 1]} ${values.day}`, 24, 68, 28),
      iconShape("pencil", 280, 52, 24, "muted"),
      rectShape(0, 100, 328, 1, { f: "border", s: null }),
      textShape(`${names[values.month - 1]} ${values.year}`, 24, 124, 14),
      iconShape("chevron-left", 252, 112, 24, "muted"),
      iconShape("chevron-right", 284, 112, 24, "muted"),
    ];
    ["M", "T", "W", "T", "F", "S", "S"].forEach((weekday, index) =>
      out.push(textShape(weekday, 36 + index * 40, 160, 12, "muted", "middle")),
    );
    for (let day = 1; day <= days; day++) {
      const cell = lead + day - 1;
      const x = 36 + (cell % 7) * 40;
      const y = 196 + Math.floor(cell / 7) * 40;
      if (day === values.day) {
        out.push(
          ellipseShape(x - 18, y - 18, 36, 36, { f: "accent", s: null }),
        );
      }
      out.push(
        textShape(
          String(day),
          x,
          y,
          13,
          day === values.day ? "onAccent" : "text",
          "middle",
        ),
      );
    }
    const by = height - 52;
    out.push(
      textShape("Cancel", 220, by + 20, 14, "accent", "middle"),
      textShape("OK", 290, by + 20, 14, "accent", "middle"),
    );
    return out;
  },
  "modal calendar",
);
