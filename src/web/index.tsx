import { useEffect, useState } from "react";

type Entry = { id: string; date: string; note: string };
type Action =
	| { action: "list"; placeId: string }
	| { action: "add"; placeId: string; id: string; date: string; note: string }
	| { action: "delete"; placeId: string; id: string };
async function call(action: Action): Promise<Entry[]> {
	const response = await fetch("/api/m/places.visit-journal/entries", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(action),
	});
	if (!response.ok)
		throw new Error("Could not load or save your journal. Please try again.");
	return response.json();
}
function newId() {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 15) | 64;
	bytes[8] = (bytes[8] & 63) | 128;
	const hex = Array.from(bytes, (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function today() {
	const date = new Date();
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function VisitJournalSection({
	placeId,
}: {
	placeId: string;
	category: string;
	isOwner: boolean;
}) {
	const [entries, setEntries] = useState<Entry[] | null>(null);
	const [date, setDate] = useState(today);
	const [note, setNote] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [deleting, setDeleting] = useState<string | null>(null);
	useEffect(() => {
		let active = true;
		setEntries(null);
		setError("");
		setNote("");
		setPendingId(null);
		setDeleting(null);
		call({ action: "list", placeId })
			.then((value) => {
				if (active) setEntries(value);
			})
			.catch(() => {
				if (active) setError("Could not load your journal.");
			});
		return () => {
			active = false;
		};
	}, [placeId]);
	async function update(action: Action) {
		setBusy(true);
		setError("");
		try {
			setEntries(await call(action));
			if (action.action === "add") {
				setNote("");
				setPendingId(null);
			}
			setDeleting(null);
		} catch {
			setError("Could not save your journal. Please try again.");
		} finally {
			setBusy(false);
		}
	}
	return (
		<section className="visit-journal" aria-label="Visit Journal">
			<style>{`.visit-journal{border-top:1px solid #8885;padding-top:24px;display:grid;gap:12px}.visit-journal h2{font-size:1.2rem;font-weight:600}.visit-journal form,.visit-journal label{display:grid;gap:8px}.visit-journal input,.visit-journal textarea,.visit-journal button{font:inherit;color:inherit;background:transparent;border:1px solid #8888;border-radius:6px;padding:8px}.visit-journal button{cursor:pointer;min-height:44px}.visit-journal button:disabled{opacity:.5}.visit-journal textarea{min-height:100px;resize:vertical}.visit-journal article{border-top:1px solid #8884;padding-top:12px}.visit-journal article p{white-space:pre-wrap;overflow-wrap:anywhere}.visit-journal [role=alert]{color:#c65b45}`}</style>
			<h2>Visit Journal</h2>
			<p>Private notes for your visits.</p>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					const id = pendingId ?? newId();
					setPendingId(id);
					void update({ action: "add", placeId, id, date, note });
				}}
			>
				<label>
					Visit date
					<input
						disabled={busy || !entries}
						type="date"
						required
						value={date}
						onChange={(event) => {
							setDate(event.target.value);
							setPendingId(null);
						}}
					/>
				</label>
				<label>
					Note
					<textarea
						disabled={busy || !entries}
						required
						maxLength={10000}
						value={note}
						onChange={(event) => {
							setNote(event.target.value);
							setPendingId(null);
						}}
					/>
				</label>
				<button disabled={busy || !entries || !note.trim()} type="submit">
					{busy ? "Saving…" : "Add visit"}
				</button>
			</form>
			{error && (
				<p role="alert">
					{error}{" "}
					<button
						onClick={() => {
							setError("");
							void call({ action: "list", placeId })
								.then(setEntries)
								.catch(() => setError("Could not load your journal."));
						}}
					>
						Reload
					</button>
				</p>
			)}
			{!entries && !error && <p role="status">Loading visits…</p>}
			{entries?.length === 0 && <p>No visits yet.</p>}
			{entries?.map((entry) => (
				<article key={entry.id}>
					<time dateTime={entry.date}>{entry.date}</time>
					<p>{entry.note}</p>
					{deleting === entry.id ? (
						<div>
							Delete this visit?{" "}
							<button
								disabled={busy}
								onClick={() =>
									void update({ action: "delete", placeId, id: entry.id })
								}
							>
								Confirm delete
							</button>{" "}
							<button disabled={busy} onClick={() => setDeleting(null)}>
								Cancel
							</button>
						</div>
					) : (
						<button disabled={busy} onClick={() => setDeleting(entry.id)}>
							Delete visit
						</button>
					)}
				</article>
			))}
		</section>
	);
}
