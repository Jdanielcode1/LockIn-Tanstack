import { createFileRoute } from '@tanstack/react-router'
import { reactStartHandler } from '@convex-dev/better-auth/react-start'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        console.log('[Auth API Route] Handling GET:', request.url)
        return await reactStartHandler(request)
      },
      POST: async ({ request }) => {
        console.log('[Auth API Route] Handling POST:', request.url)
        return await reactStartHandler(request)
      },
    },
  },
})
