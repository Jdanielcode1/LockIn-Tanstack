import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import * as React from 'react'
import type { QueryClient } from '@tanstack/react-query'
import appCss from '~/styles/app.css?url'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Timelapse Social - Share Your Progress',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  notFoundComponent: () => <div>Route not found</div>,
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <nav className="bg-[#161b22] border-b border-[#30363d] text-[#c9d1d9]">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-base font-semibold hover:text-white transition flex items-center gap-2">
              <span className="text-xl">📹</span>
              Timelapse Social
            </Link>
            <div className="flex gap-4">
              <Link
                to="/"
                className="hover:text-white transition text-sm"
                activeProps={{ className: 'text-white font-semibold' }}
              >
                Feed
              </Link>
              <Link
                to="/projects"
                className="hover:text-white transition text-sm"
                activeProps={{ className: 'text-white font-semibold' }}
              >
                Profile
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <React.Suspense fallback={
        <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
          <div className="text-[#8b949e] text-center">
            <div className="animate-spin text-4xl mb-4">⏳</div>
            <p>Loading...</p>
          </div>
        </div>
      }>
        <Outlet />
      </React.Suspense>
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html className="bg-[#0d1117]">
      <head>
        <HeadContent />
      </head>
      <body className="bg-[#0d1117]">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
