import { useCallback, useEffect, useState } from "react";
import { Loader2, Send, Trash2, Check } from "lucide-react";
import { api, type OutboundEmail } from "./capitalWatchApi";

// The review step for every email that leaves the team. Drafts come from approving
// an opportunity that lists a contact, from Inanna, or are written by hand. Nothing is
// sent until someone reads it here and clicks Send.

const SOURCE_LABEL: Record<OutboundEmail["source"], string> = {
  approval: "From approval",
  inanna: "Drafted by Inanna",
  manual: "Written by hand",
};

function DraftCard({ email, onDone }: { email: OutboundEmail; onDone: (message: string) => void }) {
  const [to, setTo] = useState(email.to);
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body);
  const [busy, setBusy] = useState<"save" | "send" | "discard" | null>(null);
  const [error, setError] = useState<string | null>(email.sendError ? `Last send failed: ${email.sendError}` : null);
  const [confirming, setConfirming] = useState(false);
  const dirty = to !== email.to || subject !== email.subject || body !== email.body;

  async function save() {
    await api(`/outbox/${email._id}`, { method: "PATCH", body: JSON.stringify({ to, subject, body }) });
  }

  async function run(kind: "save" | "send" | "discard") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "discard") {
        await api(`/outbox/${email._id}`, { method: "PATCH", body: JSON.stringify({ status: "discarded" }) });
        onDone("Draft discarded.");
      } else {
        if (dirty) await save();
        if (kind === "send") {
          await api(`/outbox/${email._id}/send`, { method: "POST" });
          onDone(`Sent to ${to}.`);
        } else {
          onDone("Draft saved.");
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  }

  return (
    <div className="border border-gray-200 mb-4 p-4 sm:p-6 transition-colors hover:border-black">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <div className="font-bold">{email.grantTitle || "General outreach"}</div>
        <div className="text-xs uppercase tracking-wide text-gray-400">
          {SOURCE_LABEL[email.source]}{email.company ? ` · ${email.company}` : ""}
        </div>
      </div>

      <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">To</label>
      <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@organization.org"
        className="w-full border border-gray-300 px-3 py-2 mb-3 outline-none focus:border-black" />

      <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Subject</label>
      <input value={subject} onChange={(e) => setSubject(e.target.value)}
        className="w-full border border-gray-300 px-3 py-2 mb-3 outline-none focus:border-black" />

      <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1">Message</label>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10}
        className="w-full border border-gray-300 px-3 py-2 outline-none focus:border-black font-sans text-sm leading-relaxed" />

      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

      <div className="flex flex-wrap items-center gap-3 mt-4">
        {confirming ? (
          <>
            <span className="text-sm">Send this to <strong>{to || "(no recipient)"}</strong>?</span>
            <button onClick={() => run("send")} disabled={!!busy}
              className="bg-black text-white px-4 py-2 flex items-center gap-2 hover:bg-gray-800 disabled:opacity-50">
              {busy === "send" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Yes, send
            </button>
            <button onClick={() => setConfirming(false)} disabled={!!busy} className="text-gray-500 underline">Cancel</button>
          </>
        ) : (
          <>
            <button onClick={() => setConfirming(true)} disabled={!!busy}
              className="bg-[#FACC15] text-black px-4 py-2 flex items-center gap-2 hover:bg-yellow-400 disabled:opacity-50">
              <Send size={14} /> Review &amp; send
            </button>
            <button onClick={() => run("save")} disabled={!!busy || !dirty}
              className="border border-gray-300 px-4 py-2 flex items-center gap-2 hover:border-black disabled:opacity-40">
              {busy === "save" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save edits
            </button>
            <button onClick={() => run("discard")} disabled={!!busy}
              className="ml-auto text-gray-400 hover:text-black flex items-center gap-1 text-sm">
              <Trash2 size={14} /> Discard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function CapitalWatchOutbox({ onChange }: { onChange?: () => void }) {
  const [tab, setTab] = useState<"draft" | "sent">("draft");
  const [emails, setEmails] = useState<OutboundEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEmails(await api(`/outbox?status=${tab}`));
    } catch (err) {
      console.error("[CapitalWatch] outbox load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  // Inanna can add drafts while this view is open.
  useEffect(() => {
    const refresh = () => load();
    window.addEventListener("capitalwatch:outbox-changed", refresh);
    return () => window.removeEventListener("capitalwatch:outbox-changed", refresh);
  }, [load]);

  function done(message: string) {
    setNotice(message);
    setTimeout(() => setNotice(null), 2500);
    load();
    onChange?.();
  }

  return (
    <div className="px-4 sm:px-8 py-6">
      <div className="flex items-baseline gap-6 mb-2">
        <h2 className="text-xl">Outbox</h2>
        {(["draft", "sent"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`text-sm ${tab === t ? "text-black underline" : "text-gray-400 hover:text-black"}`}>
            {t === "draft" ? "Needs review" : "Sent"}
          </button>
        ))}
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Every email to someone outside the team waits here. Read it, edit anything, then send. Replies go to the founder, and the team gets a copy.
      </p>

      {loading && <div className="py-8 text-gray-400">Loading…</div>}
      {!loading && emails.length === 0 && (
        <div className="py-8 text-gray-400">{tab === "draft" ? "Nothing waiting for review." : "No emails sent yet."}</div>
      )}

      {tab === "draft" && emails.map((email) => <DraftCard key={email._id} email={email} onDone={done} />)}

      {tab === "sent" && emails.map((email) => (
        <div key={email._id} className="border border-gray-200 mb-3 p-4">
          <div className="flex flex-wrap justify-between gap-2">
            <div className="font-bold">{email.subject}</div>
            <div className="text-xs text-gray-400">{email.sentAt ? new Date(email.sentAt).toLocaleString() : ""}</div>
          </div>
          <div className="text-sm text-gray-500">To {email.to}{email.grantTitle ? ` · ${email.grantTitle}` : ""}</div>
          <div className="text-sm text-gray-600 mt-2 whitespace-pre-wrap font-sans line-clamp-4">{email.body}</div>
        </div>
      ))}

      {notice && (
        <div className="fixed bottom-24 right-6 z-50 flex items-center gap-2 bg-black text-white px-4 py-3 shadow-lg">
          <Check size={16} strokeWidth={2} />
          <span className="text-sm">{notice}</span>
        </div>
      )}
    </div>
  );
}
