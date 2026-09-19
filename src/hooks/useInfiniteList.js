import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Loads a list PAGE BY PAGE as the person scrolls, instead of either (a)
 * fetching one fixed-size batch up front — which is what silently made
 * "hidden" products past that batch unreachable except by typing a search
 * that matched them exactly — or (b) fetching everything at once, which
 * would genuinely hurt performance/memory for a catalog of any real size.
 * `fetchFn(params)` must resolve to `{ data, pagination: { totalPages } }`,
 * the same shape every list endpoint in this app already returns.
 *
 * Whenever `params` changes (by value — compared via JSON.stringify, same
 * convention as useApiList) the list resets and reloads from page 1 — this
 * is what makes typing in a search box start over with matching results
 * instead of appending them after whatever was already loaded.
 *
 * Returns `loadMore()` to fetch the next page (appended, not replacing) —
 * call it when a sentinel element at the bottom of the list scrolls into
 * view (see useInfiniteScrollTrigger below). `loadingMore` is a separate
 * flag from the initial `loading`, so a grid can show its normal "loading
 * products..." state on first load/search, and a small inline spinner at
 * the bottom while loading more without re-showing that full-page state.
 */
export function useInfiniteList(fetchFn, params, pageSize = 40) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  const paramsKey = JSON.stringify(params);
  // Read inside loadMore without it being a dependency — loadMore is
  // called from an effect (see useInfiniteScrollTrigger) and must always
  // act on the CURRENT page/params, not whatever they were when that
  // effect's closure was created.
  const pageRef = useRef(1);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    pageRef.current = 1;

    fetchFn({ ...params, page: 1, limit: pageSize })
      .then((res) => {
        if (cancelled) return;
        const totalPages = res.pagination?.totalPages || 1;
        setItems(res.data || []);
        hasMoreRef.current = totalPages > 1;
        setHasMore(hasMoreRef.current);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setItems([]);
        hasMoreRef.current = false;
        setHasMore(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, pageSize]);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    const nextPage = pageRef.current + 1;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    fetchFn({ ...paramsRef.current, page: nextPage, limit: pageSize })
      .then((res) => {
        pageRef.current = nextPage;
        setItems((prev) => [...prev, ...(res.data || [])]);
        const totalPages = res.pagination?.totalPages || 1;
        hasMoreRef.current = nextPage < totalPages;
        setHasMore(hasMoreRef.current);
      })
      .catch(() => {}) // a failed "load more" just stops there — the list already shown stays usable, no need to blank it out
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [pageSize]);

  return { items, loading, loadingMore, hasMore, error, loadMore };
}

/**
 * Wires `loadMore` to fire automatically when a sentinel element (a ref you
 * attach to an empty div placed after the last grid item) scrolls into
 * view — the standard, efficient way to implement "load more as you
 * scroll" (an IntersectionObserver, not a scroll-position calculation on
 * every scroll event). Returns the ref to attach.
 */
export function useInfiniteScrollTrigger(loadMore, { hasMore, loading, loadingMore }) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '200px' }, // start loading a bit before it's actually visible, for a smoother feel
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, hasMore, loading, loadingMore]);

  return sentinelRef;
}