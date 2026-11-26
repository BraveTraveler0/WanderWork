import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Send, Trash2 } from "lucide-react";
import { api, send, type OutboundEmail } from "./capitalWatchApi";

// The review step for every email that leaves a business. Drafts come from applying
// to an opportunity, from Inanna, or are written by hand. Nothing goes out until
// someone reads it here. Admins can send from our domain; everyone else sends from
// their own email app (so replies come straight back to them).

const SOURCE_LABEL: Record<OutboundEmail["source"], string> = {
  approval: "From an application",
  inanna: "Drafted by Inanna",
  manual: "Written by hand",
};

// Email apps reliably accept links up to roughly this length; longer bodies are copied instead.
const MAILTO_LIMIT = 1800;

function DraftCard({ email, isAdmin, onDone }: { email: OutboundEmail; isAdmin: boolean; onDone: (message: string) => void }) {
  const [to, setTo] = useState(email.to);
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(email.sendError ? `Last send failed: ${email.sendError}` : null);
  const [confirming, setConfirming] = useState(false);
  const [opened, setOpened] = useState(false);
  const dirty = to !== email.to || subject !== email.subject || body !== email.body;

  const save = () => send(`/outbox/${email._id}`, "PATCH", { to, subject, body });

  async function run(kind: "save" | "send" | "discard" | "mark") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "discard") {
        await send(`/outbox/${email._id}`, "PATCH", { status: "discarded" });
        return onDone("Draft discarded.");
      }
      if (dirty) await save();
      if (kind === "send") { await send(`/outbox/${email._id}/send`, "POST"); return onDone(`Sent to ${to}.`); }
      if (kind === "mark") { await send(`/outbox/${email._id}/mark-sent`, "POST"); return onDone("Marked as sent."); }
      onDone("Draft saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  }

  const mailto = `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const tooLong = mailto.length > MAILTO_LIMIT;

  async function openInEmailApp() {
    if (dirty) await save().catch(() => {});
    if (tooLong) {
      // Too long for a mail link: copy the body and open a message with just the subject.
      await navigator.clipboard?.writeText(body).catch(() => {});
      window.location.href = `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}`;
      setError("The message is long, so it was copied. Paste it into the email that just opened.");
    } else {
      window.location.href = mailto;
    }
    setOpened(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setError("Copied.");
    } catch {
      setError("Couldn't copy. Select the text and copy it.");
    }
  }

  return (
    <div className="border border-gray-200 mb-4 p-4 sm:p-6 transition-colors hover:border-black">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <div className="font-bold">{email.grantTitle || "General outreach"}</div>
        <div className="text-xs uppercase tracking-wide text-gray-400">{SOURCE_LABEL[email.source]}</div>
      </div>

      <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1" htmlFor={`to-${email._id}`}>To</label>
      <input id={`to-${email._id}`} value={to} onChange={(e) => setTo(e.target.value)} placeholder="Find the program contact on the opportunity's page"
        className="w-full border border-gray-300 px-3 py-2 mb-3 outline-none focus:border-black" />

      <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1" htmlFor={`subj-${email._id}`}>Subject</label>
      <input id={`subj-${email._id}`} value={subject} onChange={(e) => setSubject(e.target.value)}
        className="w-full border border-gray-300 px-3 py-2 mb-3 outline-none focus:border-black" />

      <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1" htmlFor={`body-${email._id}`}>Message</label>
      <textarea id={`body-${email._id}`} value={body} onChange={(e) => setBody(e.target.value)} rows={10}
        className="w-full border border-gray-300 px-3 py-2 outline-none focus:border-black font-sans text-sm leading-relaxed" />

      {error && <div className={`mt-2 text-sm ${/fail|valid|empty|limit|Add /i.test(error) ? "text-red-600" : "text-gray-600"}`}>{error}</div>}

      <div className="flex flex-wrap items-center gap-3 mt-4">
        {confirming ? (
          <>
            <span className="text-sm">Send this to <strong>{to || "(no recipient)"}</strong> from Capital Watch?</span>
            <button onClick={() => run("send")} disabled={!!busy}
              className="bg-black text-white px-4 py-2 flex items-center gap-2 hover:bg-gray-800 disabled:opacity-50">
              {busy === "send" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Yes, send
            </button>
            <button onClick={() => setConfirming(false)} disabled={!!busy} className="text-gray-500 underline">Cancel</button>
          </>
        ) : (
          <>
            <button onClick={openInEmailApp} disabled={!!busy}
              className="bg-[#FACC15] text-black px-4 py-2 flex items-center gap-2 hover:bg-yellow-400 disabled:opacity-50">
              <ExternalLink size={14} /> Open in my email
            </button>
            {opened && (
              <button onClick={() => run("mark")} disabled={!!busy} className="border border-black px-4 py-2 flex items-center gap-2 hover:bg-black hover:text-white">
                <Check size={14} /> I sent it
              </button>
            )}
            {isAdmin && (
              <button onClick={() => setConfirming(true)} disabled={!!busy}
                className="border border-gray-300 px-4 py-2 flex items-center gap-2 hover:border-black disabled:opacity-50">
                <Send size={14} /> Send from Capital Watch
              </button>
            )}
            <button onClick={copy} className="border border-gray-300 px-3 py-2 flex items-center gap-2 hover:border-black" aria-label="Copy email">
              <Copy size={14} />
            </button>
            {dirty && (
              <button onClick={() => run("save")} disabled={!!busy} className="text-sm underline">
                {busy === "save" ? "Saving…" : "Save edits"}
              </button>
            )}
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

export default function CapitalWatchOutbox({ businessId, isAdmin, onChange }: { businessId: string; isAdmin: boolean; onChange?: () => void }) {
  const [tab, setTab] = useState<"draft" | "sent">("draft");
  const [emails, setEmails] = useState<OutboundEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEmails(await api(`/outbox?businessId=${businessId}&status=${tab}`));
    } catch (err) {
      console.error("[CapitalWatch] outbox load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [tab, businessId]);

  useEffect(() => { load(); }, [load]);
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
        Emails to program contacts and investors wait here. Read each one, edit anything, then open it in your own email to send.
      </p>

      {loading && <div className="py-8 text-gray-400">Loading…</div>}
      {!loading && emails.length === 0 && (
        <div className="py-8 text-gray-400">{tab === "draft" ? "Nothing waiting for review. Applying to an opportunity, or asking Inanna to write an email, puts a draft here." : "No emails sent yet."}</div>
      )}

      {tab === "draft" && emails.map((email) => <DraftCard key={email._id} email={email} isAdmin={isAdmin} onDone={done} />)}

      {tab === "sent" && emails.map((email) => (
        <div key={email._id} className="border border-gray-200 mb-3 p-4">
          <div className="flex flex-wrap justify-between gap-2">
            <div className="font-bold">{email.subject}</div>
            <div className="text-xs text-gray-400">{email.sentAt ? new Date(email.sentAt).toLocaleString() : ""}</div>
          </div>
          <div className="text-sm text-gray-500">To {email.to || "(not recorded)"}{email.grantTitle ? ` · ${email.grantTitle}` : ""}</div>
          <div className="text-sm text-gray-600 mt-2 whitespace-pre-wrap font-sans line-clamp-4">{email.body}</div>
        </div>
      ))}

      {notice && (
        <div role="status" className="fixed bottom-24 right-6 z-50 flex items-center gap-2 bg-black text-white px-4 py-3 shadow-lg">
          <Check size={16} strokeWidth={2} />
          <span className="text-sm">{notice}</span>
        </div>
      )}
    </div>
  );
}
