import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, Check, ChevronDown, Loader2, Mail, RotateCcw, Settings, Triangle, User, X } from "lucide-react";
import {
  api, send, getSession, setSession, clearSession, labelOf, formatUsd, safeHref,
  type Business, type Draft, type Grant, type Member, type Options, type Stats,
} from "./capitalWatchApi";
import CapitalWatchAthena from "./CapitalWatchAthena";
import CapitalWatchOutbox from "./CapitalWatchOutbox";
import CapitalWatchBusiness from "./CapitalWatchBusiness";

// Capital Watch: free for anyone who joins the marketing list. Opportunities are shared;
// each business profile gets its own ranked matches and its own decisions.
// This file is kept identical in the WanderWork repo (Wanderwork/) and the AonCreative
// repo, which serves it live at aoncreative.io/capitalwatch. Change both together.

const EMPTY = "n/a";
const BUSINESS_KEY = "capitalwatch.business";

function websiteLabel(link?: string) {
  if (!link) return EMPTY;
  try { return new URL(link).hostname.replace(/^www\./, ""); } catch { return link; }
}

// Days left, same UTC day counting as the server's deadline alerts.
function daysLeft(dueDate?: string) {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((Date.parse(`${dueDate}T00:00:00Z`) - today) / 86400000);
}

function DeadlineLabel({ grant }: { grant: Grant }) {
  if (grant.rolling) return <div className="text-xs text-gray-400 mt-1">Rolling</div>;
  const days = daysLeft(grant.dueDate);
  if (days === null) return null;
  const tone = days < 0 ? "text-gray-400 line-through" : days <= 3 ? "text-red-600 font-bold" : days <= 14 ? "text-black font-bold" : "text-gray-500";
  const text = days < 0 ? `Closed ${grant.dueDate}` : days === 0 ? "Due today" : `Due ${grant.dueDate} (${days}d)`;
  return <div className={`text-xs mt-1 ${tone}`}>{text}</div>;
}

function Logo() {
  return (
    <a href="/capitalwatch" className="text-2xl sm:text-3xl tracking-tight flex items-center gap-2 w-fit transition-opacity hover:opacity-70">
      <Triangle size={16} strokeWidth={1.5} className="opacity-60" />
      Capital Watch /
    </a>
  );
}

function Modal({ onClose, children, wide = false }: { onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className={`bg-white p-6 sm:p-8 w-full ${wide ? "max-w-3xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ─── Sign in ─────────────────────────────────────────────────────────────────

const fieldClass = "w-full border border-gray-300 px-4 py-2 mb-4 outline-none focus:border-black";

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white font-mono">
      <div className="bg-[#FACC15] px-4 sm:px-8 py-6"><Logo /></div>
      <div className="max-w-md mx-auto px-4 py-12">{children}</div>
    </div>
  );
}

function PasswordField({ id, label, value, onChange, autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <div className="flex justify-between items-baseline mb-1">
        <label className="block text-sm font-bold" htmlFor={id}>{label}</label>
        <button type="button" onClick={() => setShow((s) => !s)} className="text-xs underline text-gray-500">{show ? "Hide" : "Show"}</button>
      </div>
      <input id={id} type={show ? "text" : "password"} required value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} minLength={autoComplete === "new-password" ? 8 : undefined}
        className={fieldClass} />
    </>
  );
}

type AuthMode = "signin" | "signup" | "link" | "forgot";

// Sign in (password), create account, emailed sign-in link, and forgot password.
function SignIn({ notice, onSignedIn }: { notice?: string | null; onSignedIn: () => void }) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(notice || null);

  const go = (m: AuthMode) => { setMode(m); setError(null); setSent(null); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin" || mode === "signup") {
        const r = mode === "signin"
          ? await send("/auth/login", "POST", { email, password })
          : await send("/auth/signup", "POST", { email, password, name, consent });
        setSession(r.token);
        onSignedIn();
      } else {
        const r = await send(mode === "link" ? "/auth/request" : "/auth/forgot", "POST", { email });
        setSent(r.message);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tabs = mode === "signin" || mode === "signup";
  return (
    <AuthShell>
      <h1 className="text-2xl mb-3">Find funding that fits your business</h1>
      <p className="text-sm text-gray-600 mb-8">
        Capital Watch finds grants, loans, investors, competitions and accelerators every week, ranks them against your business,
        and drafts your applications. Free when you join our email list.
      </p>

      {tabs && (
        <div className="flex border-b border-gray-200 mb-6" role="tablist">
          {([["signin", "Sign in"], ["signup", "Create account"]] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={mode === id} onClick={() => go(id)}
              className={`flex-1 py-2 text-sm ${mode === id ? "border-b-2 border-black font-bold" : "text-gray-400 hover:text-black"}`}>{label}</button>
          ))}
        </div>
      )}
      {!tabs && (
        <div className="mb-6">
          <button onClick={() => go("signin")} className="text-sm underline text-gray-500">← Back to sign in</button>
          <h2 className="text-lg mt-3">{mode === "link" ? "Email me a sign-in link" : "Forgot your password?"}</h2>
          <p className="text-sm text-gray-500 mt-1">{mode === "link" ? "We'll email you a link that signs you in. No password needed." : "We'll email you a link to choose a new password."}</p>
        </div>
      )}

      {sent ? (
        <div className="border border-black p-5">
          <div className="font-bold mb-2">Check your email</div>
          <p className="text-sm text-gray-600">{sent} The link works once and expires in 20 minutes.</p>
          <button onClick={() => setSent(null)} className="text-sm underline mt-4">Send it again or use a different email</button>
        </div>
      ) : (
        <form onSubmit={submit}>
          {mode === "signup" && (
            <>
              <label className="block text-sm font-bold mb-1" htmlFor="cw-name">Name</label>
              <input id="cw-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} className={fieldClass} />
            </>
          )}
          <label className="block text-sm font-bold mb-1" htmlFor="cw-email">Email</label>
          <input id="cw-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={fieldClass} />
          {mode === "signin" && <PasswordField id="cw-pass" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />}
          {mode === "signup" && <PasswordField id="cw-pass" label="Password (8+ characters)" value={password} onChange={setPassword} autoComplete="new-password" />}
          {mode === "signup" && (
            <label className="flex items-start gap-3 text-sm mb-6 cursor-pointer">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required className="mt-1 accent-black w-4 h-4" />
              <span>Email me funding matches and news from Aon Creative. Required for a free account. Unsubscribe anytime.</span>
            </label>
          )}
          {error && <div role="alert" className="text-sm text-red-600 mb-4">{error}</div>}
          <button type="submit" disabled={busy} className="w-full bg-black text-white px-6 py-3 flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-50">
            {busy && <Loader2 size={14} className="animate-spin" />}
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create free account" : mode === "link" ? "Email me a sign-in link" : "Email me a reset link"}
          </button>
          {mode === "signin" && (
            <div className="flex flex-wrap justify-between gap-2 mt-4 text-sm">
              <button type="button" onClick={() => go("forgot")} className="underline text-gray-600">Forgot password?</button>
              <button type="button" onClick={() => go("link")} className="underline text-gray-600">Email me a sign-in link instead</button>
            </div>
          )}
          {mode === "signup" && <p className="text-xs text-gray-400 mt-4">Already have an account? <button type="button" onClick={() => go("signin")} className="underline">Sign in</button></p>}
        </form>
      )}
    </AuthShell>
  );
}

// Opened from a "reset your password" email.
function ResetPassword({ token, onDone, onCancel }: { token: string; onDone: () => void; onCancel: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await send("/auth/reset", "POST", { token, password });
      setSession(r.token);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-2xl mb-6">Choose a new password</h1>
      <form onSubmit={submit}>
        <PasswordField id="cw-new" label="New password (8+ characters)" value={password} onChange={setPassword} autoComplete="new-password" />
        {error && <div role="alert" className="text-sm text-red-600 mb-4">{error}</div>}
        <button type="submit" disabled={busy} className="w-full bg-black text-white px-6 py-3 flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-50">
          {busy && <Loader2 size={14} className="animate-spin" />} Save and sign in
        </button>
        <button type="button" onClick={onCancel} className="text-sm underline text-gray-500 mt-4">Back to sign in</button>
      </form>
    </AuthShell>
  );
}

// ─── Root: sign-in link, session, first-run setup ───────────────────────────

export default function CapitalWatch() {
  const [signedIn, setSignedIn] = useState(() => Boolean(getSession()));
  const [verifying, setVerifying] = useState(() => new URLSearchParams(window.location.search).has("signin"));
  const [notice, setNotice] = useState<string | null>(null);
  // A "reset your password" link: read once, then removed from the address bar.
  const [resetToken, setResetToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("reset");
    if (token) {
      params.delete("reset");
      window.history.replaceState(null, "", `${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
    }
    return token;
  });

  // Internal tool on a public site: keep the dashboard out of search results.
  useEffect(() => {
    const tag = document.createElement("meta");
    tag.name = "robots";
    tag.content = "noindex, nofollow";
    document.head.appendChild(tag);
    const prevTitle = document.title;
    document.title = "Capital Watch";
    return () => { tag.remove(); document.title = prevTitle; };
  }, []);

  // Arriving from the emailed link: trade it for a session, then clean the address bar.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("signin");
    if (!token) return;
    params.delete("signin");
    window.history.replaceState(null, "", `${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
    send("/auth/verify", "POST", { token })
      .then((r) => { setSession(r.token); setSignedIn(true); })
      .catch((err) => setNotice((err as Error).message))
      .finally(() => setVerifying(false));
  }, []);

  useEffect(() => {
    const out = () => setSignedIn(false);
    window.addEventListener("capitalwatch:signed-out", out);
    return () => window.removeEventListener("capitalwatch:signed-out", out);
  }, []);

  if (verifying) return <div className="min-h-screen font-mono flex items-center justify-center gap-2 text-gray-500"><Loader2 size={16} className="animate-spin" /> Signing you in…</div>;
  if (resetToken) return <ResetPassword token={resetToken} onDone={() => { setResetToken(null); setSignedIn(true); }} onCancel={() => setResetToken(null)} />;
  if (!signedIn) return <SignIn notice={notice} onSignedIn={() => setSignedIn(true)} />;
  return <App onSignOut={() => { clearSession(); setSignedIn(false); }} />;
}

function App({ onSignOut }: { onSignOut: () => void }) {
  const [member, setMember] = useState<Member | null>(null);
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [businessId, setBusinessId] = useState<string>(() => { try { return localStorage.getItem(BUSINESS_KEY) || ""; } catch { return ""; } });
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadMe = useCallback(async () => {
    const me = await api<{ member: Member; businesses: Business[] }>("/me");
    setMember(me.member);
    setBusinesses(me.businesses);
    return me;
  }, []);

  useEffect(() => {
    Promise.all([loadMe(), api<Options>("/options").then(setOptions)]).catch((err) => setLoadError((err as Error).message));
  }, [loadMe]);

  const current = businesses?.find((b) => b._id === businessId) || businesses?.[0] || null;
  useEffect(() => {
    if (current && current._id !== businessId) setBusinessId(current._id);
    if (current) { try { localStorage.setItem(BUSINESS_KEY, current._id); } catch { /* storage blocked */ } }
  }, [current, businessId]);

  if (loadError) return <div className="min-h-screen font-mono p-8">Couldn't load Capital Watch: {loadError} <button onClick={() => window.location.reload()} className="underline ml-2">Try again</button></div>;
  if (!member || !businesses || !options) return <div className="min-h-screen font-mono flex items-center justify-center gap-2 text-gray-500"><Loader2 size={16} className="animate-spin" /> Loading…</div>;

  if (!current) {
    return (
      <div className="min-h-screen bg-white font-mono">
        <div className="bg-[#FACC15] px-4 sm:px-8 py-6 flex items-center justify-between"><Logo /><button onClick={onSignOut} className="text-sm underline">Sign out</button></div>
        <CapitalWatchBusiness firstRun options={options} onSaved={(b) => { setBusinesses([b]); setBusinessId(b._id); }} />
      </div>
    );
  }

  return (
    <Dashboard
      key={current._id}
      member={member}
      options={options}
      businesses={businesses}
      business={current}
      onSwitch={setBusinessId}
      onBusinessesChanged={async (selectId) => { const me = await loadMe(); setBusinessId(selectId || me.businesses[0]?._id || ""); }}
      onMemberChanged={setMember}
      onSignOut={onSignOut}
    />
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

type View = "matches" | "applied" | "saved" | "dismissed";
type DraftJob = {
  key: string;
  grantId: string;
  title: string;
  businessName: string;
  state: "drafting" | "done" | "error";
  needsInput?: number;
  message?: string;
};
const VIEWS: { id: View; label: string; stat: keyof Stats }[] = [
  { id: "matches", label: "Matches", stat: "matches" },
  { id: "applied", label: "Applied", stat: "applied" },
  { id: "saved", label: "Saved", stat: "saved" },
  { id: "dismissed", label: "Dismissed", stat: "dismissed" },
];

function Dashboard({ member, options, businesses, business, onSwitch, onBusinessesChanged, onMemberChanged, onSignOut }: {
  member: Member;
  options: Options;
  businesses: Business[];
  business: Business;
  onSwitch: (id: string) => void;
  onBusinessesChanged: (selectId?: string) => Promise<void>;
  onMemberChanged: (m: Member) => void;
  onSignOut: () => void;
}) {
  const [page, setPage] = useState<"list" | "outbox" | "profile" | "new-business">("list");
  const [view, setView] = useState<View>("matches");
  const [category, setCategory] = useState("all");
  const [showUnfit, setShowUnfit] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [grants, setGrants] = useState<Grant[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<{ id: string; title: string } | null>(null);
  // Drafts run in the background so the page stays usable while they compose.
  const [jobs, setJobs] = useState<DraftJob[]>([]);
  const [jobsDocked, setJobsDocked] = useState(false);
  const [draftView, setDraftView] = useState<{ grant: Grant; draft: Draft | null } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [outboxCount, setOutboxCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [menu, setMenu] = useState<"business" | "account" | null>(null);
  const loadSeq = useRef(0);
  const qs = `businessId=${business._id}`;

  // Typing waits for a short pause before searching, instead of one request per key.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ businessId: business._id, view: view === "matches" && showUnfit ? "all" : view, category });
      if (query) params.set("q", query);
      const rows = await api<Grant[]>(`/grants?${params}`);
      if (seq === loadSeq.current) setGrants(rows);
    } catch (err) {
      if (seq === loadSeq.current) flash((err as Error).message);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [business._id, view, showUnfit, category, query]);

  // Counts change only when decisions or the profile change, not on every filter click.
  const loadStats = useCallback(() => {
    api<Stats>(`/stats?${qs}`).then(setStats).catch(() => {});
  }, [qs]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => {
    const refresh = () => setRefreshKey((k) => k + 1);
    window.addEventListener("capitalwatch:outbox-changed", refresh);
    return () => window.removeEventListener("capitalwatch:outbox-changed", refresh);
  }, []);

  const afterChange = () => { loadStats(); setRefreshKey((k) => k + 1); };

  async function decide(id: string, status: "archived" | "rejected" | "pending") {
    try {
      await send(`/grants/${id}`, "PATCH", { businessId: business._id, status });
      setGrants((prev) => prev.filter((g) => g._id !== id));
      afterChange();
    } catch (err) {
      flash((err as Error).message);
    }
  }

  // The composing card starts in the middle of the screen and moves to the bottom
  // left as soon as you scroll, so it never sits on top of what you're reading.
  const activeJobs = jobs.length > 0;
  useEffect(() => {
    if (!activeJobs || jobsDocked) return;
    const dock = () => setJobsDocked(true);
    window.addEventListener("scroll", dock, { passive: true, once: true });
    window.addEventListener("wheel", dock, { passive: true, once: true });
    window.addEventListener("touchmove", dock, { passive: true, once: true });
    return () => {
      window.removeEventListener("scroll", dock);
      window.removeEventListener("wheel", dock);
      window.removeEventListener("touchmove", dock);
    };
  }, [activeJobs, jobsDocked]);

  const updateJob = (key: string, patch: Partial<DraftJob>) =>
    setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, ...patch } : j)));
  const dismissJob = (key: string) => setJobs((prev) => prev.filter((j) => j.key !== key));

  async function apply() {
    if (!applying) return;
    const { id, title } = applying;
    setApplying(null);
    if (jobs.some((j) => j.grantId === id && j.state === "drafting")) return;
    const key = `${id}-${Date.now()}`;
    const businessId = business._id;
    // First draft on a quiet screen shows in the middle; later ones join the docked stack.
    if (!jobs.length) setJobsDocked(false);
    setJobs((prev) => [...prev, { key, grantId: id, title, businessName: business.name, state: "drafting" }]);
    setGrants((prev) => prev.filter((g) => g._id !== id));
    try {
      const r = await send(`/grants/${id}`, "PATCH", { businessId, status: "approved" });
      updateJob(key, { state: "done", needsInput: r.needsInput || 0 });
      setTimeout(() => dismissJob(key), 15000);
      afterChange();
      api<{ member: Member }>("/me").then((me) => onMemberChanged(me.member)).catch(() => {});
    } catch (err) {
      updateJob(key, { state: "error", message: (err as Error).message });
      load();
      loadStats();
    }
  }

  async function openDraft(grant: Grant) {
    setDraftView({ grant, draft: null });
    try {
      setDraftView({ grant, draft: await api<Draft>(`/grants/${grant._id}/draft?${qs}`) });
    } catch (err) {
      setDraftView(null);
      flash((err as Error).message);
    }
  }

  const draftsLeft = Math.max(0, member.limits.drafts - member.usage.drafts);
  const isAdmin = member.role === "admin";

  return (
    <div className="min-h-screen bg-white font-mono">
      {/* Top bar: business switcher, Outbox, account */}
      <div className="relative bg-[#FACC15] px-4 sm:px-8 py-5 flex flex-wrap items-center justify-between gap-3">
        <Logo />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button onClick={() => setMenu((m) => (m === "business" ? null : "business"))} aria-expanded={menu === "business"}
              className="flex items-center gap-2 border border-black px-3 py-1.5 text-sm bg-[#FACC15] hover:bg-black hover:text-white max-w-[220px]">
              <span className="truncate">{business.name}</span><ChevronDown size={14} />
            </button>
            {menu === "business" && (
              <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1 z-40 bg-white border border-black min-w-[240px] max-w-[calc(100vw-2rem)] shadow-lg">
                {businesses.map((b) => (
                  <button key={b._id} onClick={() => { setMenu(null); onSwitch(b._id); }}
                    className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${b._id === business._id ? "font-bold" : ""}`}>{b.name}</button>
                ))}
                <div className="border-t border-gray-200" />
                <button onClick={() => { setMenu(null); setPage("profile"); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100">Edit {business.name}'s profile</button>
                {businesses.length < member.limits.businesses && (
                  <button onClick={() => { setMenu(null); setPage("new-business"); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100">+ Add another business</button>
                )}
              </div>
            )}
          </div>
          <button onClick={() => setPage((p) => (p === "outbox" ? "list" : "outbox"))}
            className={`relative flex items-center gap-2 border border-black px-3 py-1.5 text-sm transition-colors ${page === "outbox" ? "bg-black text-white" : "hover:bg-black hover:text-white"}`}>
            <Mail size={15} strokeWidth={1.5} /> Outbox
            {outboxCount > 0 && (
              <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${page === "outbox" ? "bg-[#FACC15] text-black" : "bg-black text-white"}`}>
                {outboxCount > 9 ? "9+" : outboxCount}
              </span>
            )}
          </button>
          <button onClick={() => setMenu((m) => (m === "account" ? null : "account"))} aria-label="Account" aria-expanded={menu === "account"}
            className="border border-black p-2 hover:bg-black hover:text-white"><User size={15} /></button>
        </div>
      </div>

      {menu === "account" && (
        <AccountPanel member={member} onClose={() => setMenu(null)} onChanged={onMemberChanged} onSignOut={onSignOut} />
      )}

      {member.emailVerified === false && <ConfirmEmailNotice email={member.email} />}

      {page === "outbox" && <CapitalWatchOutbox businessId={business._id} isAdmin={isAdmin} sharedView={Boolean(business.sharedView)} onChange={afterChange} />}

      {(page === "profile" || page === "new-business") && (
        <CapitalWatchBusiness
          key={page}
          options={options}
          business={page === "profile" ? business : null}
          onCancel={() => setPage("list")}
          onSaved={async (b) => { await onBusinessesChanged(b._id); setPage("list"); flash("Profile saved. Matches updated."); }}
          onDeleted={async () => { await onBusinessesChanged(); setPage("list"); }}
          onTeamChanged={() => { onBusinessesChanged(business._id); afterChange(); }}
        />
      )}

      {page === "list" && (
        <>
          {/* Views with counts */}
          <div className="px-4 sm:px-8 pt-6 sm:pt-8 flex flex-wrap gap-6 sm:gap-12 items-end">
            {VIEWS.map((v) => (
              <button key={v.id} onClick={() => { setView(v.id); setCategory("all"); }} aria-pressed={view === v.id}
                className={`text-left transition-opacity ${view === v.id ? "" : "opacity-40 hover:opacity-70"}`}>
                <div className="text-4xl sm:text-5xl leading-none">{stats ? stats[v.stat] as number : "·"}</div>
                <div className={`mt-2 text-sm ${view === v.id ? "text-black underline" : "text-gray-500"}`}>{v.label}</div>
              </button>
            ))}
            <form className="flex ml-auto w-full sm:w-auto" onSubmit={(e) => { e.preventDefault(); if (search.trim() === query) load(); else setQuery(search.trim()); }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search opportunities"
                className="border border-gray-300 px-4 py-2 flex-1 sm:w-56 outline-none focus:border-black" />
              <button type="submit" className="bg-black text-white px-5 py-2 hover:bg-gray-800">Go</button>
            </form>
          </div>

          {/* Category filters */}
          {/* On phones the types are one row you can swipe sideways; wider screens wrap. */}
          <div className="px-4 sm:px-8 py-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[{ id: "all", label: "All types" }, ...options.fundingCategories].map((c) => {
                const count = view === "matches" && c.id !== "all" ? stats?.byCategory?.[c.id] : undefined;
                if (view === "matches" && c.id !== "all" && !count && category !== c.id) return null;
                return (
                  <button key={c.id} onClick={() => setCategory(c.id)} aria-pressed={category === c.id}
                    className={`shrink-0 whitespace-nowrap text-xs px-3 py-2 sm:py-1.5 border ${category === c.id ? "bg-black text-white border-black" : "border-gray-300 hover:border-black"}`}>
                    {c.label}{count ? ` (${count})` : ""}
                  </button>
                );
              })}
            </div>
            {view === "matches" && (
              <label className="sm:ml-auto flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" checked={showUnfit} onChange={(e) => setShowUnfit(e.target.checked)} className="accent-black" />
                Also show ones that aren't a fit
              </label>
            )}
          </div>

          <hr className="border-gray-200" />

          <div className="px-4 sm:px-8 pt-4 lg:pt-0 pb-28">
            <div className="hidden lg:grid grid-cols-[2fr_1.2fr_1fr_1fr_3fr] gap-4 py-4 text-gray-400 text-sm uppercase tracking-wide">
              <div>Opportunity</div><div>Website</div><div>Amount</div><div>Type</div><div>Description</div>
            </div>

            {view === "dismissed" && (
              <div className="pt-4 text-xs text-gray-400">{business.sharedView ? "Your whole team shares this list." : "Only you see what you dismiss."} Dismissed opportunities clear out after 3 days and won't come back as matches.</div>
            )}
            {loading && <div className="py-8 text-gray-400">Loading…</div>}
            {!loading && grants.length === 0 && (
              <div className="py-8 text-gray-400">
                {view === "matches"
                  ? <>No matches{category !== "all" ? " of this type" : ""} right now. New opportunities arrive every week. <button onClick={() => setPage("profile")} className="underline">Check what your profile hides</button>.</>
                  : `Nothing ${VIEWS.find((v) => v.id === view)?.label.toLowerCase()} yet.`}
              </div>
            )}

            {grants.map((grant) => (
              <div key={grant._id} className={`group relative border mb-4 px-3 lg:px-2 transition-colors hover:border-black ${grant.fit === false ? "border-dashed border-gray-300 opacity-70" : "border-gray-200"}`}>
                {/* Phone: one column. Tablet: title, then website / amount / type side by side,
                    then the description. Desktop: the five-column table. */}
                <div className="grid grid-cols-1 gap-3 py-4 md:grid-cols-3 md:gap-x-6 lg:grid-cols-[2fr_1.2fr_1fr_1fr_3fr] lg:gap-4 lg:py-6 lg:items-start">
                  <div className="md:col-span-3 lg:col-span-1 lg:pr-10">
                    <div className="font-bold">{grant.title}</div>
                    {grant.agency && <div className="text-xs text-gray-500 mt-1">{grant.agency}</div>}
                  </div>
                  <div className="text-gray-600 min-w-0">
                    <span className="lg:hidden block text-xs uppercase tracking-wide text-gray-400 mb-0.5">Website</span>
                    {safeHref(grant.link) ? <a href={safeHref(grant.link)} target="_blank" rel="noopener noreferrer" className="underline hover:text-black break-words">{websiteLabel(grant.link)}</a> : EMPTY}
                  </div>
                  <div>
                    <span className="lg:hidden block text-xs uppercase tracking-wide text-gray-400 mb-0.5">Amount</span>
                    {formatUsd(grant.amountUsd) || EMPTY}
                    <DeadlineLabel grant={grant} />
                  </div>
                  <div>
                    <span className="lg:hidden block text-xs uppercase tracking-wide text-gray-400 mb-0.5">Type</span>
                    {labelOf(options.fundingCategories, grant.category) || EMPTY}
                    {!!grant.targetDemographics?.length && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {grant.targetDemographics.map((tag) => (
                          <span key={tag} className="text-[10px] uppercase tracking-wide border border-gray-300 px-1.5 py-0.5 text-gray-500">{labelOf(options.demographics, tag).replace(/-owned$/, "")}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 md:col-span-3 lg:col-span-1">
                    <span className="lg:hidden block text-xs uppercase tracking-wide text-gray-400 mb-0.5">Description</span>
                    {grant.summary || EMPTY}
                    {grant.fit === false && grant.unfitReason && <div className="mt-2 text-xs text-black">Not a fit: {grant.unfitReason}</div>}
                    {grant.fit !== false && !!grant.reasons?.length && view === "matches" && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {grant.reasons.map((r) => <span key={r} className="text-[11px] bg-[#FEF9C3] px-1.5 py-0.5 text-black">{r}</span>)}
                      </div>
                    )}
                    {!!grant.needsInput?.length && <div className="mt-2 text-xs text-black">Still needed from you: {grant.needsInput.join(", ")}</div>}
                    {view === "applied" && <button onClick={() => openDraft(grant)} className="mt-2 text-xs underline text-black">View the drafted application</button>}
                  </div>
                </div>

                {/* Phone and tablet: labeled buttons inside the card, easy to tap. */}
                <div className="lg:hidden flex flex-wrap gap-2 pb-4">
                  {(view === "matches" || view === "saved") && (
                    <button onClick={() => setApplying({ id: grant._id, title: grant.title })} aria-label={`Apply to ${grant.title}`}
                      className="flex items-center gap-1.5 bg-[#FACC15] text-black px-4 py-2 text-sm font-bold active:bg-yellow-400">
                      <Check size={15} strokeWidth={2.5} /> Apply
                    </button>
                  )}
                  {view === "matches" && (
                    <>
                      <button onClick={() => decide(grant._id, "archived")} aria-label={`Save ${grant.title} for later`}
                        className="flex items-center gap-1.5 border border-gray-300 px-4 py-2 text-sm active:border-black">
                        <Archive size={14} /> Save
                      </button>
                      <button onClick={() => decide(grant._id, "rejected")} aria-label={`Dismiss ${grant.title}`}
                        className="flex items-center gap-1.5 border border-gray-300 px-4 py-2 text-sm active:border-black">
                        <X size={14} strokeWidth={2.5} /> Dismiss
                      </button>
                    </>
                  )}
                  {view !== "matches" && (
                    <button onClick={() => decide(grant._id, "pending")} aria-label={`Move ${grant.title} back to matches`}
                      className="flex items-center gap-1.5 border border-gray-300 px-4 py-2 text-sm active:border-black">
                      <RotateCcw size={14} /> Back to matches
                    </button>
                  )}
                </div>

                {/* Desktop: floating buttons on the corner. With a mouse they appear on hover;
                    on a large touchscreen (no hover) they always show. */}
                <div className="hidden lg:flex absolute -top-4 -right-4 flex-col gap-3 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  {(view === "matches" || view === "saved") && (
                    <button onClick={() => setApplying({ id: grant._id, title: grant.title })} title="Apply: draft an application"
                      className="w-9 h-9 sm:w-8 sm:h-8 rotate-45 bg-[#FACC15] ring-4 ring-white shadow-lg flex items-center justify-center hover:bg-yellow-400 hover:scale-110 transition-transform">
                      <Check size={16} strokeWidth={2} className="-rotate-45 text-black" />
                    </button>
                  )}
                  {view === "matches" && (
                    <>
                      <button onClick={() => decide(grant._id, "rejected")} title="Dismiss"
                        className="w-9 h-9 sm:w-8 sm:h-8 bg-black text-white ring-4 ring-white shadow-lg flex items-center justify-center hover:bg-gray-800 hover:scale-110 transition-transform">
                        <X size={15} strokeWidth={3} />
                      </button>
                      <button onClick={() => decide(grant._id, "archived")} title="Save for later"
                        className="w-9 h-9 sm:w-8 sm:h-8 bg-white text-gray-600 ring-4 ring-white border border-gray-300 shadow-lg flex items-center justify-center hover:border-black hover:text-black hover:scale-110 transition-transform">
                        <Archive size={15} strokeWidth={2} />
                      </button>
                    </>
                  )}
                  {view !== "matches" && (
                    <button onClick={() => decide(grant._id, "pending")} title="Move back to matches"
                      className="w-9 h-9 sm:w-8 sm:h-8 bg-white text-gray-600 ring-4 ring-white border border-gray-300 shadow-lg flex items-center justify-center hover:border-black hover:text-black hover:scale-110 transition-transform">
                      <RotateCcw size={14} strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {applying && (
        <Modal onClose={() => setApplying(null)}>
          <h2 className="text-lg mb-2">Apply to {applying.title}?</h2>
          <p className="text-sm text-gray-600 mb-4">
            We'll draft the application from {business.name}'s profile, list what you still need to gather, email it to you,
            and put an outreach email in your Outbox. Nothing is submitted or sent for you. You can keep browsing while it drafts.
          </p>
          <p className="text-xs text-gray-400 mb-6">{Math.max(0, draftsLeft - jobs.filter((j) => j.state === "drafting").length)} of {member.limits.drafts} drafts left today.</p>
          <div className="flex gap-3">
            <button onClick={apply} disabled={draftsLeft - jobs.filter((j) => j.state === "drafting").length <= 0} className="bg-black text-white px-5 py-2 hover:bg-gray-800 disabled:opacity-40">Draft my application</button>
            <button onClick={() => setApplying(null)} className="text-gray-500 underline">Cancel</button>
          </div>
        </Modal>
      )}

      {jobs.length > 0 && (
        <div
          className="fixed z-40 flex flex-col gap-2 w-[calc(100%-6rem)] sm:w-96 transition-all duration-500 ease-out"
          style={jobsDocked
            ? { left: 16, top: "calc(100% - 16px)", transform: "translate(0, -100%)" }
            : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
        >
          {jobs.map((job) => (
            <div key={job.key} role="status" aria-live="polite"
              className={`border border-black shadow-xl p-4 text-sm ${job.state === "done" ? "bg-[#FACC15]" : "bg-white"}`}>
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {job.state === "drafting" && <Loader2 size={18} className="animate-spin text-gray-500" />}
                  {job.state === "done" && <Check size={18} strokeWidth={2.5} />}
                  {job.state === "error" && <X size={18} strokeWidth={2.5} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{job.title}</div>
                  {job.state === "drafting" && (
                    <div className="text-gray-500 mt-1">Composing an application for {job.businessName}. This takes about 20 seconds; keep browsing.</div>
                  )}
                  {job.state === "done" && (
                    <>
                      <div className="mt-1">
                        Success! Your application is drafted and emailed to you
                        {job.needsInput ? `. ${job.needsInput} item${job.needsInput === 1 ? "" : "s"} still need your input` : ""}.
                      </div>
                      <div className="mt-2 flex gap-4">
                        <button onClick={() => { dismissJob(job.key); setPage("outbox"); }} className="underline font-bold">Review in Outbox</button>
                        <button onClick={() => { dismissJob(job.key); setPage("list"); setView("applied"); setCategory("all"); }} className="underline">See applied</button>
                      </div>
                    </>
                  )}
                  {job.state === "error" && <div className="mt-1 text-gray-600">Couldn't draft this one: {job.message}</div>}
                </div>
                {job.state !== "drafting" && (
                  <button onClick={() => dismissJob(job.key)} aria-label="Close" className="shrink-0 text-gray-500 hover:text-black"><X size={16} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {draftView && (
        <Modal wide onClose={() => setDraftView(null)}>
          <div className="flex justify-between items-start gap-4 mb-4">
            <h2 className="text-lg">{draftView.grant.title}</h2>
            <button onClick={() => setDraftView(null)} aria-label="Close" className="text-gray-400 hover:text-black"><X size={18} /></button>
          </div>
          {!draftView.draft ? <Loader2 size={18} className="animate-spin text-gray-400" /> : (
            <div className="space-y-6 text-sm">
              {!!draftView.draft.requirementsChecklist?.length && (
                <section>
                  <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Checklist</h3>
                  {draftView.draft.requirementsChecklist.map((c, i) => (
                    <div key={i} className="border-b border-gray-100 py-2">
                      <div className="font-bold">{c.requirement} <span className={`ml-2 text-[10px] uppercase px-1.5 py-0.5 ${c.status === "needs_input" ? "bg-[#FACC15]" : "bg-gray-100"}`}>{c.status === "needs_input" ? "Needs you" : c.status === "drafted" ? "Drafted" : "N/A"}</span></div>
                      {c.detail && <div className="text-gray-500 mt-1">{c.detail}</div>}
                    </div>
                  ))}
                </section>
              )}
              {!!draftView.draft.applicationFields?.length && (
                <section>
                  <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Form answers</h3>
                  {draftView.draft.applicationFields.map((f, i) => (
                    <div key={i} className="border-b border-gray-100 py-2">
                      <div className="flex justify-between gap-3">
                        <div className="font-bold">{f.label}{f.status === "needs_input" && <span className="ml-2 text-[10px] uppercase px-1.5 py-0.5 bg-[#FACC15] font-normal">Needs you</span>}</div>
                        {f.answer && <button onClick={() => navigator.clipboard?.writeText(f.answer).then(() => flash(`Copied "${f.label}".`))} className="text-xs underline shrink-0">Copy</button>}
                      </div>
                      {f.answer && <div className="text-gray-600 mt-1 whitespace-pre-wrap font-sans">{f.answer}</div>}
                      {f.note && <div className="text-gray-400 text-xs mt-1">{f.note}</div>}
                    </div>
                  ))}
                </section>
              )}
              <section>
                <div className="flex justify-between items-baseline mb-2">
                  <h3 className="text-xs uppercase tracking-wide text-gray-400">Application</h3>
                  <button onClick={() => navigator.clipboard?.writeText(draftView.draft?.applicationNarrative || "").then(() => flash("Copied."))} className="text-xs underline">Copy</button>
                </div>
                <div className="whitespace-pre-wrap font-sans leading-relaxed bg-gray-50 p-4">{draftView.draft.applicationNarrative || EMPTY}</div>
              </section>
            </div>
          )}
        </Modal>
      )}

      {page !== "profile" && page !== "new-business" && (
        <CapitalWatchAthena
          businessId={business._id}
          businessName={business.name}
          refreshKey={refreshKey}
          onBriefing={(b) => setOutboxCount(b.outboxDrafts)}
          onApprove={(id, title) => setApplying({ id, title })}
          onDecide={async (id, status) => { await decide(id, status); }}
          onOpenOutbox={() => setPage("outbox")}
        />
      )}

      {toast && (
        <div role="status" className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 z-50 flex items-center gap-2 bg-black text-white px-4 py-3 shadow-lg max-w-md">
          <Check size={16} strokeWidth={2} className="shrink-0" />
          <span className="text-sm">{toast}</span>
        </div>
      )}
    </div>
  );
}

// ─── Account ─────────────────────────────────────────────────────────────────

// Accounts made from an emailed link have no password until they set one here.
function PasswordSection({ member, onChanged }: { member: Member; onChanged: (m: Member) => void }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await send("/me/password", "POST", { currentPassword: current, newPassword: next });
      // Changing the password signs out older sessions; keep this one with the new token.
      if (r.token) setSession(r.token);
      onChanged(r.member);
      setMsg({ text: r.message, ok: true });
      setOpen(false);
      setCurrent("");
      setNext("");
    } catch (err) {
      setMsg({ text: (err as Error).message, ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-gray-200 pt-4 mb-4 text-sm">
      {!open ? (
        <button onClick={() => { setOpen(true); setMsg(null); }} className="underline">{member.hasPassword ? "Change password" : "Set a password"}</button>
      ) : (
        <form onSubmit={save}>
          {member.hasPassword && <PasswordField id="cw-current" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />}
          <PasswordField id="cw-next" label="New password (8+ characters)" value={next} onChange={setNext} autoComplete="new-password" />
          <div className="flex gap-3">
            <button type="submit" disabled={busy} className="bg-black text-white px-4 py-2 disabled:opacity-50">Save password</button>
            <button type="button" onClick={() => setOpen(false)} className="underline text-gray-500">Cancel</button>
          </div>
        </form>
      )}
      {msg && <div className={`mt-2 ${msg.ok ? "text-gray-600" : "text-red-600"}`}>{msg.text}</div>}
      {!member.hasPassword && !open && <div className="text-xs text-gray-400 mt-1">You sign in with emailed links. A password lets you sign in directly.</div>}
    </div>
  );
}

// Accounts made with a password haven't proven they own the address yet. Until they use
// an emailed link, businesses teammates share with them stay pending.
function ConfirmEmailNotice({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  async function resend() {
    setState("sending");
    try { await send("/auth/request", "POST", { email }); setState("sent"); } catch { setState("error"); }
  }
  return (
    <div className="border border-black bg-[#FEF9C3] px-4 py-3 mb-4 text-sm flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <span className="flex-1">
        Confirm your email with the link we sent to <span className="font-bold break-all">{email}</span>. Until then, businesses teammates share with you won't show up.
      </span>
      {state === "sent" ? <span className="text-gray-700">Sent. Check your inbox.</span>
        : <button onClick={resend} disabled={state === "sending"} className="underline text-left disabled:opacity-50 shrink-0">
            {state === "error" ? "Couldn't send. Try again" : state === "sending" ? "Sending..." : "Send a new link"}
          </button>}
    </div>
  );
}

function AccountPanel({ member, onClose, onChanged, onSignOut }: { member: Member; onClose: () => void; onChanged: (m: Member) => void; onSignOut: () => void }) {
  const [summary, setSummary] = useState<Record<string, number | string | null> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (member.role === "admin") api("/admin/summary").then(setSummary).catch(() => {});
  }, [member.role]);

  async function toggleDigest() {
    try { onChanged((await send("/me", "PATCH", { digestOptOut: !member.digestOptOut })).member); } catch (err) { setError((err as Error).message); }
  }
  async function deleteAccount() {
    try { await send("/me", "DELETE"); onSignOut(); } catch (err) { setError((err as Error).message); }
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="font-bold">{member.name || member.email}</div>
          <div className="text-sm text-gray-500">{member.email}{member.role === "admin" ? " · admin" : ""}</div>
        </div>
        <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-black"><X size={18} /></button>
      </div>

      <div className="text-sm text-gray-600 border-t border-gray-200 pt-4 mb-4">
        Today: {member.usage.questions} of {member.limits.questions} Athena questions, {member.usage.drafts} of {member.limits.drafts} application drafts.
      </div>

      <label className="flex items-center gap-3 text-sm mb-4 cursor-pointer">
        <input type="checkbox" checked={!member.digestOptOut} onChange={toggleDigest} className="accent-black w-4 h-4" />
        Weekly match digest and deadline alerts
      </label>

      <PasswordSection member={member} onChanged={onChanged} />

      {summary && (
        <div className="text-sm border-t border-gray-200 pt-4 mb-4">
          <div className="text-xs uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1"><Settings size={12} /> Admin</div>
          <div>{summary.members} members ({summary.signupsLast7Days} this week, {summary.signupsLast30Days} this month)</div>
          <div>{summary.businesses} business profiles · {summary.openOpportunities} open opportunities</div>
          {summary.lastScrapeAt && <div className="text-gray-500">Last scrape {new Date(String(summary.lastScrapeAt)).toLocaleDateString()}</div>}
        </div>
      )}

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
      <div className="flex flex-wrap items-center gap-4 border-t border-gray-200 pt-4">
        <button onClick={onSignOut} className="bg-black text-white px-4 py-2">Sign out</button>
        {confirmDelete ? (
          <span className="text-sm flex items-center gap-2">Delete your account and unshared businesses?
            <button onClick={deleteAccount} className="underline text-red-600">Yes</button>
            <button onClick={() => setConfirmDelete(false)} className="underline">No</button>
          </span>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-sm text-gray-500 underline">Delete account</button>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-3">To leave our newsletter, use the unsubscribe link in any newsletter email.</p>
    </Modal>
  );
}
