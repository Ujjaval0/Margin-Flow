import crypto from "crypto";
import path from "path";

/** Owner-derived directories prevent filenames from granting cross-merchant access. */
export function getDocumentDirectory(userId: string): string {
  if (!userId) throw new Error("Document owner is required.");
  const ownerDirectory = crypto.createHash("sha256").update(userId).digest("hex");
  return path.join(process.cwd(), "data", "secure-vault", "documents", ownerDirectory);
}
