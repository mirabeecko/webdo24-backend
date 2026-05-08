import Link from 'next/link'

export default function PaymentSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 shadow-lg sm:p-10">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            Platba proběhla úspěšně
          </h1>
          <p className="mt-2 text-base text-gray-600">
            Váš účet byl aktivován.
          </p>
          <p className="mt-4 text-sm text-gray-500">
            Teď si nastavte přístup do zákaznické sekce.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/customer"
            className="inline-flex w-full items-center justify-center rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
          >
            Pokračovat do zákaznické sekce
          </Link>
          <Link
            href="/register"
            className="inline-flex w-full items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50"
          >
            Nastavit heslo
          </Link>
        </div>
      </div>
    </main>
  )
}
