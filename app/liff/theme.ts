'use client'

import { useSyncExternalStore } from 'react'

/**
 * Shared light/dark theme for the LIFF pages (itinerary + pre-planned).
 *
 * Read via useSyncExternalStore so SSR and the first client paint both use the
 * server snapshot ('light') — no hydration mismatch, no setState-in-effect. The
 * value is persisted in localStorage under one key and broadcast via a custom
 * event, so toggling on one LIFF page is reflected on the other.
 */
export type LiffTheme = 'dark' | 'light'

const KEY = 'liff-theme'
const EVENT = 'liff-theme-change'

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

function read(): LiffTheme {
  // Light is the default; dark is opt-in (persisted when the user toggles).
  return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
}

function server(): LiffTheme {
  return 'light'
}

export function setLiffTheme(next: LiffTheme) {
  localStorage.setItem(KEY, next)
  window.dispatchEvent(new Event(EVENT))
}

/** Current LIFF theme (light default), synced across LIFF pages. */
export function useLiffTheme(): LiffTheme {
  return useSyncExternalStore(subscribe, read, server)
}
