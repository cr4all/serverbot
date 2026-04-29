'use client';

import { useEffect, useMemo, useState } from 'react';

type LandingImagePyramidProps = {
  images: string[];
};

const BASE_LAYOUT = [
  { x: 0, y: -36, z: 80, rotate: 0, order: 5 },
  { x: -190, y: 28, z: 22, rotate: -12, order: 4 },
  { x: 190, y: 28, z: 22, rotate: 12, order: 4 },
  { x: -95, y: 102, z: -26, rotate: -6, order: 3 },
  { x: 95, y: 102, z: -26, rotate: 6, order: 3 },
];

export default function LandingImagePyramid({ images }: LandingImagePyramidProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const [isEntered, setIsEntered] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(1280);

  const normalizedImages = useMemo(() => images.slice(0, 5), [images]);
  const activeIndex = pinnedIndex ?? hoverIndex;
  const positionScale = viewportWidth < 640 ? 0.5 : viewportWidth < 1024 ? 0.78 : 1;
  const cardWidth = Math.max(220, Math.round(300 * positionScale));
  const cardHeight = Math.max(132, Math.round(180 * positionScale));

  useEffect(() => {
    const syncWidth = () => setViewportWidth(window.innerWidth);
    syncWidth();
    window.addEventListener('resize', syncWidth);
    return () => window.removeEventListener('resize', syncWidth);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setIsEntered(true), 80);
    return () => window.clearTimeout(id);
  }, []);

  if (normalizedImages.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 px-6 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        `public/landing` images not found.
      </div>
    );
  }

  return (
    <section className="w-full py-1 sm:py-3 md:py-8">
      <div
        className="mx-auto h-[235px] w-full max-w-[920px] sm:h-[320px] md:h-[400px]"
        style={{ perspective: '1300px' }}
        onClick={() => setPinnedIndex(null)}
      >
        <div className="relative h-full w-full" style={{ transformStyle: 'preserve-3d' }}>
          {normalizedImages.map((src, index) => {
            const pose = BASE_LAYOUT[index] ?? {
              x: 0,
              y: index * 12,
              z: -index * 12,
              rotate: 0,
              order: 2,
            };
            const isActive = activeIndex === index;
            const zIndex = isActive ? 30 : pose.order;
            const baseScale = index === 0 ? 1.5 : 1;
            const activeScale = baseScale * 1.22;

            return (
              <div
                key={src}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/20 bg-gray-900/20 shadow-2xl transition-all duration-500 ease-out"
                style={{
                  width: `${cardWidth}px`,
                  height: `${cardHeight}px`,
                  zIndex,
                  opacity: isEntered ? 1 : 0,
                  transitionDelay: `${index * 70}ms`,
                  transform: `translate3d(${Math.round(pose.x * positionScale)}px, ${Math.round((pose.y + (isEntered ? 0 : 30)) * positionScale)}px, ${Math.round((isActive ? 240 : pose.z) * positionScale)}px) rotateZ(${isActive ? 0 : pose.rotate}deg) scale(${isActive ? activeScale : baseScale})`,
                }}
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  setPinnedIndex((prev) => (prev === index ? null : index));
                }}
              >
                <img
                  src={src}
                  alt={`Landing preview ${index + 1}`}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
