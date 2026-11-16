import styles from "./section.css";
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
function formatDate(date: string) {
	return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
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
			<style>{styles}</style>
			<h2>Visit Journal</h2>
			<p className="journal-intro">Private notes for your visits.</p>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					const id = pendingId ?? newId();
					setPendingId(id);
					void update({ action: "add", placeId, id, date, note });
				}}
			>
				<label>
					Visit note
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
				<div className="journal-footer">
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
					<button
						className="journal-submit"
						disabled={busy || !entries || !note.trim()}
						type="submit"
					>
						{busy ? "Saving…" : "Add visit"}
					</button>
				</div>
			</form>
			{error && (
				<p role="alert">
					{error}{" "}
					<button
						className="journal-reload"
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
			{!entries && !error && (
				<p className="journal-status" role="status">
					Loading visits…
				</p>
			)}
			{entries?.length === 0 && (
				<p className="journal-status">No visits yet.</p>
			)}
			{entries?.map((entry) => (
				<article className="journal-entry" key={entry.id}>
					<div className="journal-entry-head">
						<time dateTime={entry.date}>{formatDate(entry.date)}</time>
						{deleting !== entry.id && (
							<button
								className="journal-delete"
								title="Delete visit"
								disabled={busy}
								onClick={() => setDeleting(entry.id)}
								aria-label={`Delete visit from ${formatDate(entry.date)}`}
							>
								<svg
									aria-hidden="true"
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.7"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="M4 7h16M10 11v6m4-6v6M5.5 7l1 12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
								</svg>
							</button>
						)}
					</div>
					<p>{entry.note}</p>
					{deleting === entry.id ? (
						<div className="journal-confirm">
							Delete this visit?{" "}
							<button
								className="journal-confirm-delete"
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
					) : null}
				</article>
			))}
		</section>
	);
}
