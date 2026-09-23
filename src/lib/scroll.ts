import { useEffect, useRef } from 'react'

/**
 * The page scrolls inside a div, not the document — the tab bar and the
 * sidebar are fixed around it — so anything that wants to move the page has
 * to find that scroller rather than touch `window`.
 */
export function scroller(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.scroll')
}

export function scrollToTop(): void {
  scroller()?.scrollTo({ top: 0 })
}

/**
 * Back to the top when `value` changes.
 *
 * Switching the view inside a screen — the day to the quarter-hour log, the
 * board to the week — is a new page, and landing halfway down one is
 * disorienting: the first thing you see is the middle of something. The
 * first render is left alone, because the shell has already put you at the
 * top by then.
 */
export function useTopOnChange(value: unknown): void {
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    scrollToTop()
  }, [value])
}
