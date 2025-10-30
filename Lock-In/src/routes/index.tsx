import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { useState } from 'react'

export const Route = createFileRoute('/')({
  component: Feed,
})

function Feed() {
  const [cursor, setCursor] = useState<string | null>(null)
  
  const { data: feedData } = useSuspenseQuery(
    convexQuery(api.timelapses.listFeed, {
      paginationOpts: { numItems: 12, cursor: cursor },
    })
  )

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Timelapse Feed
          </h1>
          <p className="text-gray-600">
            Discover amazing project progress from the community
          </p>
        </div>

        {feedData.page.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-400 text-6xl mb-4">📹</div>
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">
              No timelapses yet
            </h2>
            <p className="text-gray-500 mb-6">
              Be the first to share your project progress!
            </p>
            <Link
              to="/projects"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Create a Project
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {feedData.page.map((timelapse) => (
                <Link
                  key={timelapse._id}
                  to="/timelapse/$timelapseId"
                  params={{ timelapseId: timelapse._id }}
                  className="group"
                >
                  <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition">
                    <div className="aspect-video bg-gray-200 flex items-center justify-center">
                      <div className="text-gray-400 text-6xl">▶️</div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-1 group-hover:text-blue-600 transition">
                        {timelapse.projectTitle}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">
                        {timelapse.durationMinutes} minutes
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>👁️ {timelapse.viewCount}</span>
                        <span>❤️ {timelapse.likeCount}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {!feedData.isDone && (
              <div className="text-center mt-8">
                <button
                  onClick={() => setCursor(feedData.continueCursor)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
