import { handle } from "@/server/http";
import { getSession } from "@/server/auth";
import { ApiError } from "@/lib/api-error";
import { createNote, listNotes } from "@/server/notes";

export async function GET(req: Request) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const p = new URL(req.url).searchParams;
    return listNotes({
      q: p.get("q") ?? undefined,
      incident: p.get("incident") ?? undefined,
      author: p.get("author") ?? undefined,
      page: Number(p.get("page") ?? 1) || 1,
      pageSize: Number(p.get("pageSize") ?? 10) || 10,
    });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const ctx = await getSession();
    if (!ctx) throw new ApiError(401, "UNAUTHORIZED", "Please sign in to continue.");
    const note = await createNote(ctx.user, await req.json());
    return { note };
  }, 201);
}
