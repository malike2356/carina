import { useCallback, useEffect, useRef, useState } from 'react';

export function useInfiniteScroll<T>(items: T[], pageSize = 25) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [items, pageSize]);

  const loadMore = useCallback(() => {
    setVisibleCount((count) => Math.min(count + pageSize, items.length));
  }, [items.length, pageSize]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || visibleCount >= items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '120px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [items.length, loadMore, visibleCount]);

  return {
    visibleItems: items.slice(0, visibleCount),
    hasMore: visibleCount < items.length,
    sentinelRef,
    loadMore,
  };
}
