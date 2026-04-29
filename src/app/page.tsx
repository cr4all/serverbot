import Link from 'next/link';
import { readdir } from 'fs/promises';
import path from 'path';
import LandingImagePyramid from '@/app/components/LandingImagePyramid';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

async function getLandingImages() {
  try {
    const landingDir = path.join(process.cwd(), 'public', 'landing');
    const files = await readdir(landingDir, { withFileTypes: true });

    return files
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 5)
      .map((name) => `/landing/${name}`);
  } catch {
    return [];
  }
}

export default async function Home() {
  const landingImages = await getLandingImages();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-white">
      <main className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 py-4 text-center sm:gap-6 sm:px-6 sm:py-8 md:gap-10 md:py-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white md:text-5xl">
          ServerBot Manager
        </h1>
        <p className="text-base text-gray-400 sm:text-lg md:text-xl">
          Manage and monitor your server bots with ease.
        </p>
        <LandingImagePyramid images={landingImages} />
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
