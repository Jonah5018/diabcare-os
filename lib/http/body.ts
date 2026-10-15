import "server-only";

export async function boundedRequestText(request: Request, maximumBytes = 65536) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maximumBytes) throw new Error("Request body too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request body required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) throw new Error("Request body too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => null);
  }
  return Buffer.concat(chunks).toString("utf8");
}
