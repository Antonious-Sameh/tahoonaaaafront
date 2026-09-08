import { useState, useEffect, useCallback } from 'react';

/**
 * Fetches a paginated list from `fetchFn(params)` — expected to resolve to
 * `{ success, data, pagination }`, the shape every backend list endpoint
 * returns — and refetches whenever `params` changes (compared by value via
 * JSON.stringify, so callers don't need to memoize the params object
 * themselves for typical small param shapes like page/limit/search/filter).
 *
 * `fetchFn` should be a stable reference (a plain imported API function is
 * fine); it is intentionally not part of the dependency array.
 */
export function useApiList(fetchFn, params) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [extra, setExtra] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchFn(params)
      .then((res) => {
        if (cancelled) return;
        setItems(res.data || []);
        setPagination(res.pagination || null);
        // Some list endpoints return extra top-level fields alongside data/
        // pagination (e.g. expenses' `totalAmount`, summed over every
        // matching row, not just the current page) — exposed generically so
        // callers that need one don't require a hook change of their own.
        const { success: _success, data: _data, pagination: _pagination, ...rest } = res;
        setExtra(rest);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setItems([]);
        setPagination(null);
        setExtra({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, reloadToken]);

  const reload = useCallback(() => setReloadToken((k) => k + 1), []);

  return { items, pagination, extra, loading, error, reload };
}

export default useApiList;
