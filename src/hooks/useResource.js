import { useEffect, useState } from "react";

export function useResource(load, query = "", { enabled = true, delay = 0 } = {}) {
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data } = await load(query, controller.signal);
        if (!controller.signal.aborted) setResult({ load, query, attempt, data });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ load, query, attempt, error });
      }
    }, delay);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [load, query, delay, attempt, enabled]);
  const current = result?.query === query && result.load === load && enabled ? result : null;
  return { data: current?.data, error: current?.error, pending: !current || current.attempt !== attempt,
    refresh: () => setAttempt((value) => value + 1) };
}
