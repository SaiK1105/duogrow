export type BoundedRequestBody =
  | { ok: true; text: string }
  | { ok: false };

/**
 * Reads a request body without accepting more than maxBytes. Content-Length is
 * an early guard only: streamed and chunked bodies are counted while reading.
 */
export async function readBoundedRequestBody(request: Request, maxBytes: number): Promise<BoundedRequestBody> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const advertisedBytes = Number(contentLength);
    if (!Number.isSafeInteger(advertisedBytes) || advertisedBytes < 0 || advertisedBytes > maxBytes) return { ok: false };
  }

  if (!request.body) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { ok: false };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}
