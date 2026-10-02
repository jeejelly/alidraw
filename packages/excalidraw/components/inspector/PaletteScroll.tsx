import { useCallback, useEffect, useRef, useState } from "react";

import type { ReactNode } from "react";

const MIN_THUMB = 36;

/**
 * The scrolling part of the palette, with a slider on its right edge instead
 * of the native bar: a wide track and a thumb you can grab, like the grip at
 * the bottom of the panel. Clicking the track pages up or down.
 */
export const PaletteScroll = ({ children }: { children: ReactNode }) => {
  const body = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ top: number; height: number } | null>(
    null,
  );
  const drag = useRef<{ y: number; scrollTop: number } | null>(null);

  const measure = useCallback(() => {
    const el = body.current;
    const tr = track.current;
    if (!el || !tr) {
      return;
    }
    const room = tr.clientHeight;
    if (!room || el.scrollHeight <= el.clientHeight + 1) {
      setThumb(null);
      return;
    }
    const height = Math.max(
      MIN_THUMB,
      Math.round((room * el.clientHeight) / el.scrollHeight),
    );
    const max = el.scrollHeight - el.clientHeight;
    const top = Math.round(((room - height) * el.scrollTop) / max);
    setThumb((prev) =>
      prev && prev.top === top && prev.height === height
        ? prev
        : { top, height },
    );
  }, []);

  useEffect(() => {
    const el = body.current;
    if (!el) {
      return;
    }
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const resize =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    resize?.observe(el);
    if (el.firstElementChild) {
      resize?.observe(el.firstElementChild);
    }
    const mutate =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(measure)
        : null;
    mutate?.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener("scroll", measure);
      resize?.disconnect();
      mutate?.disconnect();
    };
  }, [measure]);

  return (
    <div className="inspector__scroll">
      <div className="inspector__body" ref={body}>
        {children}
      </div>
      <div
        ref={track}
        className={`inspector__slider${thumb ? " is-active" : ""}`}
        data-testid="palette-slider"
        onPointerDown={(e) => {
          const el = body.current;
          if (!el || !thumb || e.target !== e.currentTarget) {
            return;
          }
          // a click on the track pages towards it
          const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
          el.scrollBy({
            top: (y < thumb.top ? -1 : 1) * el.clientHeight * 0.9,
            behavior: "smooth",
          });
        }}
      >
        {thumb && (
          <div
            className="inspector__thumb"
            data-testid="palette-slider-thumb"
            style={{ top: thumb.top, height: thumb.height }}
            onPointerDown={(e) => {
              const el = body.current;
              if (!el) {
                return;
              }
              e.preventDefault();
              e.currentTarget.setPointerCapture?.(e.pointerId);
              drag.current = { y: e.clientY, scrollTop: el.scrollTop };
            }}
            onPointerMove={(e) => {
              const el = body.current;
              const tr = track.current;
              if (!drag.current || !el || !tr) {
                return;
              }
              const room = tr.clientHeight - thumb.height;
              const max = el.scrollHeight - el.clientHeight;
              if (room > 0) {
                el.scrollTop =
                  drag.current.scrollTop +
                  ((e.clientY - drag.current.y) * max) / room;
              }
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          />
        )}
      </div>
    </div>
  );
};
