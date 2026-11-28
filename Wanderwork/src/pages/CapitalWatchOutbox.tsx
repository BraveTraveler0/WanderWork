import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink, Loader2, RefreshCw, Send, Sparkles, Trash2 } from "lucide-react";
import { api, send, safeHref, type ApplicationField, type OutboundEmail } from "./capitalWatchApi";

// The review step for every email that leaves a business, and the place to finish the
// application it belongs to. Drafts come from applying to an opportunity, from Athena,
// or are written by hand. Nothing goes out until someone reads it here. Admins can send
// from our domain; everyone else sends from their own email app (so replies come
// straight back to them).

const SOURCE_LABEL: Record<OutboundEmail["source"], string> = {
  approval: "From an application",
  athena: "Drafted by Athena",
  inanna: "Drafted by Athena",
  manual: "Written by hand",
};

// Email apps reliably accept links up to roughly this length; longer bodies are copied instead.
const MAILTO_LIMIT = 1800;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A body that isn't a real message yet: too short, a placeholder, or "no email needed".
const WEAK_BODY_RE = /no (separate )?(outreach )?email (is )?(needed|required)|not needed for this|\[[A-Z][A-Za-z ]*\]/i;

type Verdict = { kind: "ready" | "work" | "discard"; reasons: string[] };

function verdictFor(email: OutboundEmail, to: string, body: string, fields: ApplicationField[]): Verdict {
  const ctx = email.context;
  const pastDue = ctx && !ctx.rolling && ctx.dueDate && new Date(ctx.dueDate).getTime() < Date.now() - 86400000;
  if (ctx?.expired || pastDue) return { kind: "discard", reasons: ["The deadline has passed"] };
  const reasons: string[] = [];
  if (body.trim().length < 120 || WEAK_BODY_RE.test(body)) reasons.push("The message needs writing");
  if (!EMAIL_RE.test(to.trim())) reasons.push("No contact address yet");
  const openFields = fields.filter((f) => f.status === "needs_input").length;
  if (openFields) reasons.push(`${openFields} form answer${openFields === 1 ? "" : "s"} need you`);
  const gather = ctx?.needsInput.length || 0;
  if (gather) reasons.push(`${gather} item${gather === 1 ? "" : "s"} to gather`);
  return reasons.length ? { kind: "work", reasons } : { kind: "ready", reasons: [] };
}

const VERDICT_STYLE: Record<Verdict["kind"], { label: string; className: string }> = {
  ready: { label: "Ready to send", className: "bg-black text-white" },
  work: { label: "More work needed", className: "bg-[#FACC15] text-black" },
  discard: { label: "Consider discarding", className: "border border-gray-400 text-gray-500" },
};

function dueLabel(ctx: OutboundEmail["context"]) {
  if (!ctx) return "";
  if (ctx.rolling) return "Rolling deadline";
  if (!ctx.dueDate) return "";
  return `Due ${new Date(ctx.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

function FieldRow({ field, onCopied }: { field: ApplicationField; onCopied: (label: string) => void }) {
  const copy = () => navigator.clipboard?.writeText(field.answer).then(() => onCopied(field.label)).catch(() => {});
  return (
    <div className="border-b border-gray-100 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-bold">
          {field.label}{field.required && <span className="text-gray-400"> *</span>}
          {field.status === "needs_input" && <span className="ml-2 text-[10px] uppercase px-1.5 py-0.5 bg-[#FACC15] font-normal">Needs you</span>}
        </div>
        {field.answer && (
          <button onClick={copy} className="shrink-0 text-xs border border-gray-300 px-2 py-1 flex items-center gap-1 hover:border-black" aria-label={`Copy ${field.label}`}>
            <Copy size={12} /> Copy
          </button>
        )}
      </div>
      {field.answer && <div className="mt-1 text-sm font-sans whitespace-pre-wrap bg-gray-50 px-3 py-2 max-h-48 overflow-auto">{field.answer}</div>}
      {field.note && <div className="mt-1 text-xs text-gray-500">{field.note}</div>}
      {!!field.options?.length && <div className="mt-1 text-xs text-gray-400">Choices on the form: {field.options.join(", ")}</div>}
    </div>
  );
}

function DraftCard({ email, businessId, isAdmin, sharedView, startOpen, onDone }: {
  email: OutboundEmail; businessId: string; isAdmin: boolean; sharedView: boolean; startOpen: boolean; onDone: (message: string) => void;
}) {
  const [open, setOpen] = useState(startOpen);
  const [to, setTo] = useState(email.to);
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body);
  const [fields, setFields] = useState<ApplicationField[]>(email.context?.fields || []);
  const [fieldsSource, setFieldsSource] = useState(email.context?.fieldsSource || null);
  const [applyUrl, setApplyUrl] = useState(email.context?.applyUrl || "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(email.sendError ? `Last send failed: ${email.sendError}` : null);
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [opened, setOpened] = useState(false);
  // The address as last saved (Athena may fill it in after the card loads).
  const [savedTo, setSavedTo] = useState(email.to);
  const [contactPage, setContactPage] = useState("");
  const dirty = to !== savedTo || subject !== email.subject || body !== email.body;
  const ctx = email.context;
  const verdict = verdictFor(email, to, body, fields);
  const style = VERDICT_STYLE[verdict.kind];
  const weakBody = body.trim().length < 120 || WEAK_BODY_RE.test(body);

  const flashNote = (message: string) => { setNote(message); setError(null); };

  // No address yet: Athena looks on the opportunity's website for one (once a week at most).
  const looked = useRef(false);
  useEffect(() => {
    if (looked.current || email.to || !email.grant) return;
    looked.current = true;
    setBusy("contact");
    send<{ to: string; found: boolean; contactPage?: string }>(`/outbox/${email._id}/find-contact`, "POST")
      .then((r) => {
        if (r.found && r.to) {
          setTo((current) => current || r.to);
          setSavedTo(r.to);
          setNote(`Athena found the contact address on the website: ${r.to}`);
        } else if (r.contactPage) {
          setContactPage(safeHref(r.contactPage));
        }
      })
      .catch(() => {})
      .finally(() => setBusy((b) => (b === "contact" ? null : b)));
  }, [email._id, email.to, email.grant]);
  const save = () => send(`/outbox/${email._id}`, "PATCH", { to, subject, body }).then((r) => { setSavedTo(to); return r; });

  async function run(kind: "save" | "send" | "discard" | "mark") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "discard") {
        await send(`/outbox/${email._id}`, "PATCH", { status: "discarded" });
        return onDone(sharedView ? "Discarded for the team." : "Discarded for you. Your teammates still see it.");
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

  async function athenaDraft() {
    setBusy("athena");
    setError(null);
    setNote(null);
    try {
      const r = await send<{ subject: string; body: string; changes: string }>(`/outbox/${email._id}/athena`, "POST", { to, subject, body });
      setSubject(r.subject || subject);
      setBody(r.body);
      flashNote(`Athena's draft is in the box${r.changes ? `: ${r.changes}` : "."} Edit anything, then save or send.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function readForm() {
    if (!email.grant) return;
    setBusy("fields");
    setError(null);
    try {
      const r = await send<{ fields: ApplicationField[]; fieldsSource: "page" | "likely"; applyUrl: string }>(
        `/grants/${email.grant}/fields`, "POST", { businessId });
      setFields(r.fields);
      setFieldsSource(r.fieldsSource);
      if (r.applyUrl) setApplyUrl(r.applyUrl);
      flashNote(r.fieldsSource === "page" ? `Found ${r.fields.length} fields on the application form.` : "Couldn't see the form itself, so these are the fields this kind of application usually asks for.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
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
      flashNote("The message is long, so it was copied. Paste it into the email that just opened.");
    } else {
      window.location.href = mailto;
    }
    setOpened(true);
  }

  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      flashNote(message);
    } catch {
      setError("Couldn't copy. Select the text and copy it.");
    }
  }

  const due = dueLabel(ctx);
  const applicationLink = safeHref(applyUrl) || safeHref(ctx?.link);

  return (
    <div className={`border mb-3 transition-colors ${open ? "border-black" : "border-gray-200 hover:border-black"}`}>
      {/* Summary row: always visible, click to open */}
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full text-left px-4 sm:px-6 py-4 flex items-start gap-3">
        <ChevronDown size={16} className={`mt-1 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{email.grantTitle || "General outreach"}</span>
            <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 ${style.className}`}>{style.label}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1 truncate">
            {[to || "No recipient yet", due, SOURCE_LABEL[email.source]].filter(Boolean).join(" · ")}
          </div>
          {verdict.reasons.length > 0 && <div className="text-xs text-black mt-1">{verdict.reasons.join(" · ")}</div>}
        </div>
      </button>

      {open && (
        <div className="px-4 sm:px-6 pb-5 border-t border-gray-100 pt-4">
          <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1" htmlFor={`to-${email._id}`}>To</label>
          <input id={`to-${email._id}`} value={to} onChange={(e) => setTo(e.target.value)} placeholder={busy === "contact" ? "Athena is looking for the contact address on the website…" : "No address on the website yet"}
            className="w-full border border-gray-300 px-3 py-2 mb-1 outline-none focus:border-black" />
          <div className="text-xs text-gray-500 mb-3 min-h-[1rem]">
            {busy === "contact" && "Athena is checking the opportunity's website for the right address…"}
            {busy !== "contact" && !to && (contactPage
              ? <>Athena couldn't find an email address on the website. The program may only take messages through a form: <a href={contactPage} target="_blank" rel="noopener noreferrer" className="underline">open its contact page</a>.</>
              : "Athena couldn't find an email address on the website. The program may only take messages through its application form.")}
          </div>

          <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1" htmlFor={`subj-${email._id}`}>Subject</label>
          <input id={`subj-${email._id}`} value={subject} onChange={(e) => setSubject(e.target.value)}
            className="w-full border border-gray-300 px-3 py-2 mb-3 outline-none focus:border-black" />

          <div className="flex items-end justify-between gap-2 mb-1">
            <label className="block text-xs uppercase tracking-wide text-gray-400" htmlFor={`body-${email._id}`}>Message</label>
            <button onClick={athenaDraft} disabled={!!busy}
              className="text-xs bg-black text-white px-3 py-1.5 flex items-center gap-1.5 hover:bg-gray-800 disabled:opacity-50">
              {busy === "athena" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {busy === "athena" ? "Athena is drafting…" : weakBody ? "Have Athena draft it" : "Improve with Athena"}
            </button>
          </div>
          <textarea id={`body-${email._id}`} value={body} onChange={(e) => setBody(e.target.value)} rows={10} disabled={busy === "athena"}
            className="w-full border border-gray-300 px-3 py-2 outline-none focus:border-black font-sans text-sm leading-relaxed disabled:bg-gray-50" />

          {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
          {note && !error && <div className="mt-2 text-sm text-gray-600">{note}</div>}

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
                <button onClick={() => copy(`Subject: ${subject}\n\n${body}`, "Email copied.")} className="border border-gray-300 px-3 py-2 flex items-center gap-2 hover:border-black" aria-label="Copy email">
                  <Copy size={14} />
                </button>
                {dirty && (
                  <button onClick={() => run("save")} disabled={!!busy} className="text-sm underline">
                    {busy === "save" ? "Saving…" : "Save edits"}
                  </button>
                )}
                <button onClick={() => run("discard")} disabled={!!busy}
                  className="ml-auto text-gray-400 hover:text-black flex items-center gap-1 text-sm">
                  <Trash2 size={14} /> {sharedView ? "Discard" : "Discard for me"}
                </button>
              </>
            )}
          </div>

          {/* Everything needed to fill in the application itself, ready to copy */}
          {email.grant && ctx && (
            <div className="mt-6 border-t border-gray-200 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs uppercase tracking-wide text-gray-400">Application form</h3>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {applicationLink && (
                    <a href={applicationLink} target="_blank" rel="noopener noreferrer" className="underline flex items-center gap-1">
                      <ExternalLink size={12} /> Open the application
                    </a>
                  )}
                  {fields.some((f) => f.answer) && (
                    <button onClick={() => copy(fields.filter((f) => f.answer).map((f) => `${f.label}:\n${f.answer}`).join("\n\n"), "All answers copied.")} className="underline">Copy all</button>
                  )}
                  {ctx.applied && (
                    <button onClick={readForm} disabled={!!busy} className="flex items-center gap-1 underline disabled:opacity-50">
                      {busy === "fields" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      {fields.length ? "Read the form again" : "Find the form fields"}
                    </button>
                  )}
                </div>
              </div>
              {fields.length > 0 ? (
                <>
                  <p className="text-xs text-gray-500 mt-1">
                    {fieldsSource === "page"
                      ? "Read from the application page. Copy each answer into the matching field."
                      : "We couldn't see the form itself, so these are the fields this kind of application usually asks for."}
                  </p>
                  {fields.map((f, i) => <FieldRow key={`${f.label}-${i}`} field={f} onCopied={(label) => flashNote(`Copied "${label}".`)} />)}
                </>
              ) : (
                <p className="text-sm text-gray-500 mt-2">
                  {ctx.applied ? "No form answers yet. \"Find the form fields\" reads the application page and drafts an answer for each field." : "Apply to this opportunity to get its form answers drafted."}
                </p>
              )}
              {ctx.needsInput.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-1">Still to gather</h3>
                  <ul className="text-sm space-y-1">
                    {ctx.needsInput.map((n, i) => (
                      <li key={i}><span className="font-bold">{n.requirement}</span>{n.detail ? <span className="text-gray-500">: {n.detail}</span> : null}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CapitalWatchOutbox({ businessId, isAdmin, sharedView = false, onChange }: { businessId: string; isAdmin: boolean; sharedView?: boolean; onChange?: () => void }) {
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
        A short note to the people who review applications helps you stand out. Open each one, let Athena draft or improve it,
        copy the form answers into the application, then send the note from your own email.
      </p>

      {loading && emails.length === 0 && <div className="py-8 text-gray-400">Loading…</div>}
      {!loading && emails.length === 0 && (
        <div className="py-8 text-gray-400">{tab === "draft" ? "Nothing waiting for review. Applying to an opportunity, or asking Athena to write an email, puts a draft here." : "No emails sent yet."}</div>
      )}

      {tab === "draft" && emails.map((email) => (
        <DraftCard key={email._id} email={email} businessId={businessId} isAdmin={isAdmin} sharedView={sharedView} startOpen={emails.length === 1} onDone={done} />
      ))}

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
