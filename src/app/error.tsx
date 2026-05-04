'use client'

export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="max-w-md rounded-lg bg-white p-8 text-center shadow-md">
        <h1 className="text-2xl font-bold text-red-600">Chyba aplikace</h1>
        <p className="mt-4 text-gray-600">{error.message}</p>
        <button
          onClick={reset}
          className="mt-6 rounded-md bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
        >
          Zkusit znovu
        </button>
      </div>
    </div>
  )
}
