import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const place = z.string().min(1).max(200);
const id = z.uuid();
const input = z.discriminatedUnion("action", [
	z.object({ action: z.literal("list"), placeId: place }),
	z.object({
		action: z.literal("add"),
		placeId: place,
		id,
		date: z.iso.date(),
		note: z.string().trim().min(1).max(10000),
	}),
	z.object({ action: z.literal("delete"), placeId: place, id }),
]);
type Context = {
	ownerId: string;
	dataDir: string;
	pathSuffix: string;
	hostFetch?: (path: string) => Promise<Response>;
};

export async function http(request: Request, ctx: Context): Promise<Response> {
	if (ctx.pathSuffix.replace(/^\//, "") !== "entries")
		return Response.json({ error: "Not found" }, { status: 404 });
	if (request.method !== "POST")
		return Response.json({ error: "Use POST" }, { status: 405 });
	try {
		const text = await request.text();
		if (text.length > 20000)
			return Response.json({ error: "Request too large" }, { status: 413 });
		let raw: unknown;
		try {
			raw = JSON.parse(text);
		} catch {
			return Response.json({ error: "Invalid JSON" }, { status: 400 });
		}
		const parsed = input.safeParse(raw);
		if (!parsed.success)
			return Response.json({ error: "Invalid journal entry" }, { status: 400 });
		if (!ctx.ownerId || !ctx.hostFetch)
			return Response.json(
				{ error: "Host access unavailable" },
				{ status: 503 },
			);
		const args = parsed.data;
		const access = await ctx.hostFetch(
			`/api/places/${encodeURIComponent(args.placeId)}`,
		);
		if (!access.ok)
			return Response.json(
				{ error: "Place unavailable" },
				{ status: access.status === 404 ? 404 : 403 },
			);
		const hostPlace = z
			.object({ deletedAt: z.string().nullish() })
			.safeParse(await access.json());
		if (!hostPlace.success || hostPlace.data.deletedAt)
			return Response.json({ error: "Place unavailable" }, { status: 404 });
		mkdirSync(ctx.dataDir, { recursive: true });
		const db = new DatabaseSync(join(ctx.dataDir, "journal.sqlite"));
		try {
			db.exec(
				"PRAGMA busy_timeout = 5000; CREATE TABLE IF NOT EXISTS entries (user_id TEXT NOT NULL, place_id TEXT NOT NULL, id TEXT NOT NULL, visit_date TEXT NOT NULL, note TEXT NOT NULL, PRIMARY KEY(user_id, place_id, id));",
			);
			if (args.action === "add") {
				db.prepare("INSERT OR IGNORE INTO entries VALUES (?, ?, ?, ?, ?)").run(
					ctx.ownerId,
					args.placeId,
					args.id,
					args.date,
					args.note,
				);
			} else if (args.action === "delete") {
				db.prepare(
					"DELETE FROM entries WHERE user_id = ? AND place_id = ? AND id = ?",
				).run(ctx.ownerId, args.placeId, args.id);
			}
			const rows = db
				.prepare(
					"SELECT id, visit_date AS date, note FROM entries WHERE user_id = ? AND place_id = ? ORDER BY visit_date DESC, id DESC",
				)
				.all(ctx.ownerId, args.placeId);
			return Response.json(rows);
		} finally {
			db.close();
		}
	} catch {
		return Response.json({ error: "Journal request failed" }, { status: 500 });
	}
}
export const createModule = () => ({ createHttpApp: http });
