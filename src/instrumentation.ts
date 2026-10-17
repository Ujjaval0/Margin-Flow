declare global {
  // eslint-disable-next-line no-var
  var _marginflowJobWorkerController: AbortController | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.MARGINFLOW_JOB_WORKER !== "1") return;
    if (global._marginflowJobWorkerController) return;

    await import("./lib/queue/job-processors");
    const { queueManager } = await import("./lib/queue/queue-manager");
    const controller = new AbortController();
    global._marginflowJobWorkerController = controller;
    void queueManager.runWorker({ signal: controller.signal }).catch(() => {
      delete global._marginflowJobWorkerController;
      console.error("Background worker stopped unexpectedly.");
    });
  }
}
