import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, App, theme } from 'antd';
import type { Socket } from 'socket.io-client';
import { vi } from 'vitest';
import { ThemeProvider } from '../theme/ThemeProvider';

export function installDomMocks() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      media: query,
      matches: false,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    })
  });

  class RO {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  (globalThis as any).ResizeObserver = RO as any;
}

export class FakeSocket implements Partial<Socket> {
  connected = true;

  private handlers: Record<string, Function[]> = {};

  public emit = vi.fn(((event: string, ...args: any[]) => {
    const cb = args.find((a) => typeof a === 'function');
    if (event === 'register') cb?.(true);
    if (event === 'connect-request') cb?.(true);
    return this as any;
  }) as unknown as Socket['emit']) as unknown as Socket['emit'];

  public connect = vi.fn((() => {
    this.connected = true;
    this.trigger('connect');
    return this as any;
  }) as unknown as Socket['connect']) as unknown as Socket['connect'];

  public on = vi.fn(((event: string, handler: any) => {
    (this.handlers[event] ||= []).push(handler);
    return this as any;
  }) as unknown as Socket['on']) as unknown as Socket['on'];

  public off = vi.fn(((event: string, handler?: any) => {
    if (!this.handlers[event]) return this as any;
    if (!handler) {
      delete this.handlers[event];
      return this as any;
    }
    this.handlers[event] = this.handlers[event].filter((h) => h !== handler);
    return this as any;
  }) as unknown as Socket['off']) as unknown as Socket['off'];

  trigger(event: string, payload?: any) {
    (this.handlers[event] || []).forEach((h) => h(payload));
  }
}

function withProviders(_children: React.ReactNode, route: string, routes: React.ReactNode) {
  installDomMocks();
  return render(
    <ThemeProvider>
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          cssVar: true,
          token: { motion: false }
        }}
        getPopupContainer={() => document.body}
      >
        <App>
          <MemoryRouter initialEntries={[route]}>
            <Routes>{routes}</Routes>
          </MemoryRouter>
        </App>
      </ConfigProvider>
    </ThemeProvider>
  );
}

export function renderHome(ui: React.ReactElement, route = '/') {
  return withProviders(
    ui,
    route,
    <>
      <Route path="/" element={ui} />
      <Route path="/chat/:userId" element={<div>chat page</div>} />
    </>
  );
}

export function renderChat(ui: React.ReactElement, route = '/chat/bob') {
  return withProviders(
    ui,
    route,
    <>
      <Route path="/" element={<div>home</div>} />
      <Route path="/chat/:userId" element={ui} />
    </>
  );
}
