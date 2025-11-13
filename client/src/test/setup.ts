import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './testServer'
import 'whatwg-fetch'

beforeAll(() => server.listen())
afterEach(() => { server.resetHandlers(); cleanup() })
afterAll(() => server.close())

if (!('matchMedia' in window)) {
  // sonner 등에서 사용
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })
}

// UI Toaster는 테스트에서 렌더하지 않도록 목 처리
vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}))

// sonner의 toast 호출을 DOM에 문자열로 남겨 단언 가능하도록 목 처리
vi.mock('sonner', () => {
  function appendToast(text?: string) {
    if (!text) return
    const el = document.createElement('div')
    el.textContent = text
    // 테스트 쿼리에서 제외되도록 숨김 처리
    el.style.display = 'none'
    document.body.appendChild(el)
  }
  return {
    toast: {
      success: (msg?: string, opts?: { description?: string }) => {
        appendToast(msg); appendToast(opts?.description)
      },
      error: (msg?: string, opts?: { description?: string }) => {
        appendToast(msg); appendToast(opts?.description)
      },
      info: (msg?: string, opts?: { description?: string }) => {
        appendToast(msg); appendToast(opts?.description)
      },
    },
  }
})


