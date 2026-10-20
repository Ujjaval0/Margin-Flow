/** Run noncritical work between interactions, with cancellation and a bounded wait. */
export function scheduleIdleTask(task: () => void): () => void {
  let cancelled = false;
  const run = () => { if (!cancelled) task(); };
  if (typeof window.requestIdleCallback === "function" && typeof window.cancelIdleCallback === "function") {
    const handle = window.requestIdleCallback(run, { timeout: 2000 });
    return () => { cancelled = true; window.cancelIdleCallback(handle); };
  }
  const handle = window.setTimeout(run, 0);
  return () => { cancelled = true; window.clearTimeout(handle); };
}
