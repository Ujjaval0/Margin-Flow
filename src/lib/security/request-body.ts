export class RequestBodyError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

/** Bound bytes before JSON/multipart parsing, including requests without Content-Length. */
export async function readRequestBytes(request: Request, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
    throw new RequestBodyError("Request body exceeds the permitted size.", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel("Body read timeout"); }, 30_000);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (timedOut) throw new RequestBodyError("Request body timed out.", 408);
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RequestBodyError("Request body exceeds the permitted size.", 413);
      }
      chunks.push(value);
    }
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

export async function readJsonBody(request: Request, limit = 1024 * 1024): Promise<any> {
  try {
    return JSON.parse(new TextDecoder().decode(await readRequestBytes(request, limit)));
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError("Invalid JSON request body.", 400);
  }
}

export async function readFormBody(request: Request, limit = 20 * 1024 * 1024): Promise<FormData> {
  const body = await readRequestBytes(request, limit);
  try {
    return await new Request(request.url, { method: "POST", headers: request.headers, body }).formData();
  } catch {
    throw new RequestBodyError("Invalid multipart request body.", 400);
  }
}
