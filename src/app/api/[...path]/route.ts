import { handle } from "@/core/services/server/router";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function route(req: Request, ctx: Context) {
  return handle(req, (await ctx.params).path);
}
export { route as GET, route as POST, route as PATCH, route as DELETE };
