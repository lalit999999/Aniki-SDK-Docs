import { siteConfig } from "@/config/site";
import { extractReferrerHost, hashVisitor, ingestEventPayloadSchema, normalizePath, resolveAnalyticsStore } from "@/lib/analytics";

/** Reads the current request's headers and writes to the analytics store
 * on every call - this route must never be prerendered or cached. */
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2048;

/** Routes the analytics collector (`components/analytics/analytics-collector.tsx`)
 * ever fires a beacon from (D9) - anything else is dropped rather than
 * recorded, so a stray or malicious path can't grow a day's file. */
function isKnownRoute(path: string): boolean {
  return path === "/" || path.startsWith("/docs") || path.startsWith("/changelog");
}

function resolveClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const first = forwardedFor?.split(",")[0]?.trim();
  if (first !== undefined && first.length > 0) {
    return first;
  }
  return "unknown";
}

/**
 * Ingests a single page-view beacon (D8). Always returns `204`, even for a
 * malformed, oversized, or unauthenticated request - a `500` from an
 * analytics beacon must never appear in a visitor's console. Every
 * rejection (body too large, invalid JSON, failed schema validation, an
 * unknown route, a store failure) is a silent drop, not an error response.
 *
 * The visitor hash is derived entirely server-side from `x-forwarded-for`
 * and `user-agent` - the request body never carries a visitor identifier,
 * so a client can't spoof or supply one directly.
 */
export async function POST(request: Request): Promise<Response> {
  const noContent = new Response(null, { status: 204 });

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > MAX_BODY_BYTES) {
    return noContent;
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return noContent;
  }
  if (rawBody.length > MAX_BODY_BYTES) {
    return noContent;
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return noContent;
  }

  const parsed = ingestEventPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return noContent;
  }

  const path = normalizePath(parsed.data.path);
  if (!isKnownRoute(path)) {
    return noContent;
  }

  const timestamp = new Date().toISOString();
  const date = timestamp.slice(0, 10);
  const ip = resolveClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const visitorHash = hashVisitor(ip, userAgent, date);

  try {
    const store = await resolveAnalyticsStore();
    await store.record(
      {
        path,
        versionId: parsed.data.versionId ?? null,
        referrerHost: extractReferrerHost(parsed.data.referrer, siteConfig.url),
        timestamp,
      },
      visitorHash,
    );
  } catch {
    // A store failure must never surface to the beacon (D8/D6 in this
    // sub-task's spec) - counted only in the sense that it's simply
    // dropped, same as an invalid payload.
  }

  return noContent;
}
