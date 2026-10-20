declare global {
  // eslint-disable-next-line no-var
  var _marginflowJobWorkerController: AbortController | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.MARGINFLOW_JOB_WORKER !== "1" || process.env.VERCEL === '1') return;
    if (global._marginflowJobWorkerController) return;

    await import("./lib/queue/job-processors");
    const { queueManager } = await import("./lib/queue/queue-manager");
    const controller = new AbortController();
    global._marginflowJobWorkerController = controller;
    void queueManager.runWorker({ signal: controller.signal }).catch(() => {
      delete global._marginflowJobWorkerController;
      console.error("Background worker stopped unexpectedly.");
    });
    const { runIntegrationTasks, seedScheduledSyncs } = await import("./lib/integrations/task-queue");
    void (async () => {
      while (!controller.signal.aborted) {
        try { await seedScheduledSyncs(); await runIntegrationTasks(); } catch { /* Durable tasks remain queued for recovery. */ }
        await new Promise<void>(resolve => {
          const finish = () => { controller.signal.removeEventListener("abort", cancel); resolve(); };
          const timer = setTimeout(finish, 5000);
          const cancel = () => { clearTimeout(timer); finish(); };
          controller.signal.addEventListener("abort", cancel, { once: true });
        });
      }
    })();
  }
}
