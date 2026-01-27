import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
      <main className="text-center">
        <h1 className="mb-4 text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent md:text-5xl">
          ServerBot Manager
        </h1>
        <p className="mb-8 text-xl text-gray-400">
          Manage and monitor your server bots with ease.
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href="/dashboard"
            className="rounded-full bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-700"
          >
            Go to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
