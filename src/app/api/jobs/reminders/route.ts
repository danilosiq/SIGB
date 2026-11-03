import { scheduledMaintenance } from "@/core/services/server/loans";
import { dispatchPending } from "@/core/services/server/notification-dispatch";
import { timingSafeEqual } from "node:crypto";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied =
    req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (
    !expected ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return Response.json({ message: "Não autorizado." }, { status: 401 });
  await scheduledMaintenance();
  const dispatched = await dispatchPending(
    "daily:" + new Date().toISOString().slice(0, 10),
  );
  return Response.json(
    { ok: true, dispatched },
    { headers: { "Cache-Control": "no-store" } },
  );
}
