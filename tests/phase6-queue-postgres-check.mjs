import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import crypto from "node:crypto";

const root = process.cwd();
const require = createRequire(path.join(root, "package.json"));
const { Pool } = require("pg");
const load = require(path.join(root, "tests/helpers/load-app.cjs"));
const envLine = fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/).find(line => /^DATABASE_URL=/.test(line));
if (!envLine) throw new Error("Local DATABASE_URL is not configured.");
let configuredUrl = envLine.slice(envLine.indexOf("=") + 1).trim();
if ((configuredUrl.startsWith('"') && configuredUrl.endsWith('"')) || (configuredUrl.startsWith("'") && configuredUrl.endsWith("'"))) configuredUrl = configuredUrl.slice(1, -1);
const url = new URL(configuredUrl);
if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) throw new Error("Acceptance test requires a local PostgreSQL host.");
url.pathname = "/marginflow_phase2_acceptance_20261015";
const pool = new Pool({ connectionString: url.toString(), max: 4, connectionTimeoutMillis: 5000 });
let ownerId;
const report = {
  database: url.pathname.slice(1), migration19: false, durableEnqueue: false,
  idempotentReplay: false, ownerIsolation: false, cancellation: false,
  processorCompletion: false, financialReportProcessor: false, bulkCsvImportProcessor: false,
  processorFailureRollback: false, retryAndFinalFailure: false,
  expiredLeaseRecovery: false, accountDeletionCascade: false, syntheticAccountCleaned: false,
};

try {
  const current = await pool.query("SELECT current_database() AS name");
  if (current.rows[0]?.name !== report.database) throw new Error("Refusing to test against an unexpected database.");
  const migration = fs.readFileSync(path.join(root, "database/19_durable_jobs.sql"), "utf8");
  await pool.query(migration);
  await pool.query(migration);
  report.migration19 = true;

  const account = await pool.query("INSERT INTO user_accounts (name,email) VALUES ('Queue Acceptance','queue-acceptance-' || gen_random_uuid() || '@example.invalid') RETURNING id");
  ownerId = account.rows[0].id;
  const queue = load("tests/helpers/queue-with-processors.ts", {
    "@/lib/db": { pool, query: pool.query.bind(pool), ensureMarketplaceTables: async () => {} },
  });

  const job = await queue.queueManager.enqueue("GENERATE_FINANCIAL_REPORT", { scope: "synthetic" }, { ownerId, idempotencyKey: "acceptance:report:one", maxAttempts: 2 });
  report.durableEnqueue = job.status === "QUEUED" && job.ownerId === ownerId;
  const replay = await queue.queueManager.enqueue("GENERATE_FINANCIAL_REPORT", { scope: "replay" }, { ownerId, idempotencyKey: "acceptance:report:one", maxAttempts: 2 });
  report.idempotentReplay = replay.id === job.id;
  const otherOwner = crypto.randomUUID();
  report.ownerIsolation = (await queue.queueManager.listJobs({ ownerId: otherOwner })).length === 0 && await queue.queueManager.getJob(job.id, otherOwner) === undefined;
  report.cancellation = await queue.queueManager.cancelJob(job.id, ownerId) && (await queue.queueManager.getJob(job.id, ownerId))?.status === "CANCELLED";

  queue.registerJobProcessor("PROCESS_BATCH_IDP", async ({ idempotencyKey, updateProgress }) => { await updateProgress(30); return { key: idempotencyKey, processed: 1 }; });
  const processJob = await queue.queueManager.enqueue("PROCESS_BATCH_IDP", {}, { ownerId });
  const claimed = await queue.queueManager.runNextJob();
  const processed = await queue.queueManager.getJob(processJob.id, ownerId);
  report.processorCompletion = claimed && processed?.status === "COMPLETED" && processed.result?.key === processJob.id;

  const order = {
    id: `JOB-${crypto.randomUUID()}`, channelOrderId: `queue-${crypto.randomUUID()}`, marketplace: "Amazon India", orderDate: "2026-10-15",
    status: "CONFIRMED", customerName: "Synthetic Queue Acceptance", customerCity: "Pune", customerState: "MH",
    items: [{ id: `LINE-${crypto.randomUUID()}`, sku: "QUEUE-SYNTHETIC-SKU", productName: "Synthetic Test Product", quantity: 1, sellingPrice: 100, discount: 0, taxAmount: 0, snapshotUnitCost: 0, returnedQuantity: 0 }],
    shippingFeeCharged: 0, marketplaceChargesEstimate: 0,
  };
  const csvJob = await queue.queueManager.enqueue("BULK_CSV_IMPORT", { orders: [order] }, { ownerId });
  await queue.queueManager.runNextJob();
  const imported = await queue.queueManager.getJob(csvJob.id, ownerId);
  report.bulkCsvImportProcessor = imported?.status === "COMPLETED" && imported.result?.inserted === 1 && imported.result?.orderIds?.length === 1;

  const reportJob = await queue.queueManager.enqueue("GENERATE_FINANCIAL_REPORT", { startDate: "2026-10-01", endDate: "2026-10-31" }, { ownerId });
  await queue.queueManager.runNextJob();
  const generatedReport = await queue.queueManager.getJob(reportJob.id, ownerId);
  const marketSummary = generatedReport?.result?.byMarketplace?.find(row => row.marketplace === "Amazon India");
  report.financialReportProcessor = generatedReport?.status === "COMPLETED" && generatedReport.result?.startDate === "2026-10-01" && marketSummary?.order_count === 1 && Number(marketSummary?.gross_sales) === 100;

  queue.registerJobProcessor("RECONCILE_SETTLEMENTS", async ({ job: current, client }) => {
    await client.query("INSERT INTO background_jobs (type,payload,created_by,idempotency_key) VALUES ('PROCESS_BATCH_IDP','{}',$1,$2)", [ownerId, `rollback:${current.id}`]);
    throw new Error("processor details are not persisted");
  });
  const retryJob = await queue.queueManager.enqueue("RECONCILE_SETTLEMENTS", {}, { ownerId, maxAttempts: 2 });
  await queue.queueManager.runNextJob();
  report.processorFailureRollback = (await pool.query("SELECT 1 FROM background_jobs WHERE idempotency_key = $1", [`rollback:${retryJob.id}`])).rowCount === 0;
  let retried = await queue.queueManager.getJob(retryJob.id, ownerId);
  let retryPassed = retried?.status === "QUEUED" && retried.attempts === 1 && retried.error === "Background job attempt failed." && Date.parse(retried.availableAt) > Date.now();
  await pool.query("UPDATE background_jobs SET available_at = now() WHERE id = $1", [retryJob.id]);
  await queue.queueManager.runNextJob();
  retried = await queue.queueManager.getJob(retryJob.id, ownerId);
  report.retryAndFinalFailure = retryPassed && retried?.status === "FAILED" && retried.attempts === 2;

  const stale = await pool.query("INSERT INTO background_jobs (type,payload,status,created_by,attempts,max_attempts,locked_at,lock_token) VALUES ('PROCESS_BATCH_IDP','{}','PROCESSING',$1,1,3,now() - interval '6 minutes',gen_random_uuid()) RETURNING id", [ownerId]);
  await queue.queueManager.runNextJob();
  let recovered = await queue.queueManager.getJob(stale.rows[0].id, ownerId);
  const leaseWasReleasedForRetry = recovered?.status === "QUEUED" && recovered.attempts === 1;
  await pool.query("UPDATE background_jobs SET available_at = now() WHERE id = $1", [stale.rows[0].id]);
  await queue.queueManager.runNextJob();
  recovered = await queue.queueManager.getJob(stale.rows[0].id, ownerId);
  report.expiredLeaseRecovery = leaseWasReleasedForRetry && recovered?.status === "COMPLETED" && recovered.attempts === 2;

  const orphan = await queue.queueManager.enqueue("PROCESS_BATCH_IDP", { private: "synthetic" }, { ownerId });
  await pool.query("DELETE FROM user_accounts WHERE id = $1", [ownerId]);
  ownerId = undefined;
  report.accountDeletionCascade = (await pool.query("SELECT 1 FROM background_jobs WHERE id = $1", [orphan.id])).rowCount === 0;
  report.syntheticAccountCleaned = true;

  const failed = Object.entries(report).filter(([key, value]) => key !== "database" && key !== "syntheticAccountCleaned" && value !== true);
  if (failed.length) throw new Error(`PostgreSQL queue acceptance failed: ${failed.map(([key]) => key).join(", ")}`);
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} finally {
  if (ownerId) {
    await pool.query("DELETE FROM user_accounts WHERE id = $1", [ownerId]).catch(() => {});
    report.syntheticAccountCleaned = true;
  }
  await pool.end();
}
