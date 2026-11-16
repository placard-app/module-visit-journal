import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { http } from "../src/server/index.ts";

test("entries persist, sort, and remain private to user and place", async () => {
	const dataDir = mkdtempSync(join(tmpdir(), "journal-"));
	const ctx = {
		dataDir,
		ownerId: "alice",
		pathSuffix: "/entries",
		hostFetch: async () => Response.json({ deletedAt: null }),
	};
	const call = (body: unknown, context = ctx) =>
		http(
			new Request("http://localhost", {
				method: "POST",
				body: JSON.stringify(body),
			}),
			context,
		);
	try {
		const first = randomUUID(),
			second = randomUUID();
		for (const entry of [
			{ id: first, date: "2024-01-01", note: "First" },
			{ id: second, date: "2025-05-03", note: "Second" },
		])
			assert.equal(
				(await call({ action: "add", placeId: "p1", ...entry })).status,
				200,
			);
		await call({
			action: "add",
			placeId: "p1",
			id: second,
			date: "2025-05-03",
			note: "Second",
		});
		assert.deepEqual(
			(await (await call({ action: "list", placeId: "p1" })).json()).map(
				(e: { note: string }) => e.note,
			),
			["Second", "First"],
		);
		assert.deepEqual(
			await (
				await call(
					{ action: "list", placeId: "p1" },
					{ ...ctx, ownerId: "bob" },
				)
			).json(),
			[],
		);
		assert.deepEqual(
			await (await call({ action: "list", placeId: "p2" })).json(),
			[],
		);
		await call(
			{ action: "delete", placeId: "p1", id: second },
			{ ...ctx, ownerId: "bob" },
		);
		assert.equal(
			(await (await call({ action: "list", placeId: "p1" })).json()).length,
			2,
		);
		await call({ action: "delete", placeId: "p1", id: second });
		assert.equal(
			(await (await call({ action: "list", placeId: "p1" })).json()).length,
			1,
		);
		assert.equal(
			(
				await call(
					{ action: "list", placeId: "p1" },
					{
						...ctx,
						hostFetch: async () => new Response(null, { status: 404 }),
					},
				)
			).status,
			404,
		);
		assert.equal(
			(
				await call({
					action: "add",
					placeId: "p1",
					id: randomUUID(),
					date: "2024-02-30",
					note: "bad",
				})
			).status,
			400,
		);
	} finally {
		rmSync(dataDir, { recursive: true, force: true });
	}
});
