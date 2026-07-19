import type { Context } from "hono";

/**
 * Multipart form parser that tolerates a real-world client bug: some HTTP
 * libraries (observed: .NET's HttpClient MultipartFormDataContent, and by
 * extension PowerShell's `Invoke-RestMethod -Form`) emit Content-Disposition
 * parameters without RFC 7578's required quoting — `name=file` instead of
 * `name="file"`. Node's spec-compliant FormData parser rejects that outright.
 * curl and every browser quote correctly, so we try the fast compliant path
 * first and only pay the rewrite cost when a client sends the malformed form.
 */
export async function parseMultipart(c: Context): Promise<FormData> {
  const contentType = c.req.header("content-type") ?? "";
  const buf = Buffer.from(await c.req.arrayBuffer());

  try {
    return await toRequest(contentType, buf).formData();
  } catch {
    return await toRequest(contentType, quoteContentDispositionParams(buf)).formData();
  }
}

function toRequest(contentType: string, body: Buffer): Request {
  return new Request("http://internal.invalid/", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
}

function quoteContentDispositionParams(buf: Buffer): Buffer {
  // latin1 is a byte-preserving 1:1 codec — safe to round-trip binary file
  // payloads through a string so we can patch the text header lines only.
  const text = buf.toString("latin1");
  const fixed = text
    .split("\r\n")
    .map((line) => {
      if (!/^content-disposition:/i.test(line)) return line;
      return line
        .replace(/;\s*filename\*=[^;]*/i, "") // drop the RFC 5987 extended param — unsupported by the strict parser
        .replace(/\bname=([^";]+)/i, 'name="$1"')
        .replace(/\bfilename=([^";]+)/i, 'filename="$1"');
    })
    .join("\r\n");
  return Buffer.from(fixed, "latin1");
}
