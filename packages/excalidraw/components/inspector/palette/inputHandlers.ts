import type { KeyboardEvent } from "react";

/** Keeps typing out of the editor shortcuts; Enter commits by blurring. */
export const blurOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
  event.stopPropagation();
  if (event.key === "Enter") {
    event.currentTarget.blur();
  }
};
