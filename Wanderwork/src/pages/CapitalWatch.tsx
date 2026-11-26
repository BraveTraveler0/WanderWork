import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, Check, ChevronDown, Loader2, Mail, RotateCcw, Settings, Triangle, User, X } from "lucide-react";
import {
  api, send, getSession, setSession, clearSession, labelOf, formatUsd,
  type Business, type Draft, type Grant, type Member, type Options, type Stats,
} from "./capitalWatchApi";
import CapitalWatchInanna from "./CapitalWatchInanna";
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

function SignIn({ notice }: { notice?: string | null }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(notice || null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      await send("/auth/request", "POST", { email, name, consent });
      setState("sent");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  }

  return (
    <div className="min-h-screen bg-white font-mono">
      <div className="bg-[#FACC15] px-4 sm:px-8 py-6"><Logo /></div>
      <div className="max-w-md mx-auto px-4 py-12">
        <h1 className="text-2xl mb-3">Find funding that fits your business</h1>
        <p className="text-sm text-gray-600 mb-8">
          Capital Watch finds grants, loans, investors, competitions and accelerators every week, ranks them against your business,
          and drafts your applications. Free when you join our email list.
        </p>
        {state === "sent" ? (
          <div className="border border-black p-5">
            <div className="font-bold mb-2">Check your email</div>
            <p className="text-sm text-gray-600">We sent a sign-in link to <strong>{email}</strong>. It works once and expires in 20 minutes.</p>
            <button onClick={() => setState("idle")} className="text-sm underline mt-4">Use a different email</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label className="block text-sm font-bold mb-1" htmlFor="cw-email">Email</label>
            <input id="cw-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
              className="w-full border border-gray-300 px-4 py-2 mb-4 outline-none focus:border-black" />
            <label className="block text-sm font-bold mb-1" htmlFor="cw-name">Name <span className="font-normal text-gray-400">(new accounts)</span></label>
            <input id="cw-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80}
              className="w-full border border-gray-300 px-4 py-2 mb-4 outline-none focus:border-black" />
            <label className="flex items-start gap-3 text-sm mb-6 cursor-pointer">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-black w-4 h-4" />
              <span>Email me funding matches and news from Aon Creative. Required for a new free account. Unsubscribe anytime.</span>
            </label>
            {error && <div className="text-sm text-red-600 mb-4">{error}</div>}
            <button type="submit" disabled={state === "sending"} className="w-full bg-black text-white px-6 py-3 flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-50">
              {state === "sending" && <Loader2 size={14} className="animate-spin" />} Email me a sign-in link
            </button>
            <p className="text-xs text-gray-400 mt-4">No password. Already have an account? Just enter your email.</p>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Root: sign-in link, session, first-run setup ───────────────────────────

export default function CapitalWatch() {
  const [signedIn, setSignedIn] = useState(() => Boolean(getSession()));
  const [verifying, setVerifying] = useState(() => new URLSearchParams(window.location.search).has("signin"));
  const [notice, setNotice] = useState<string | null>(null);

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
  if (!signedIn) return <SignIn notice={notice} />;
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
  const [drafting, setDrafting] = useState(false);
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

  async function apply() {
    if (!applying) return;
    setDrafting(true);
    try {
      const r = await send(`/grants/${applying.id}`, "PATCH", { businessId: business._id, status: "approved" });
      setGrants((prev) => prev.filter((g) => g._id !== applying.id));
      flash(`Application drafted and emailed to you${r.needsInput ? `; ${r.needsInput} item${r.needsInput === 1 ? "" : "s"} need your input` : ""}. The outreach email is in your Outbox.`);
      setApplying(null);
      afterChange();
      api<{ member: Member }>("/me").then((me) => onMemberChanged(me.member)).catch(() => {});
    } catch (err) {
      flash((err as Error).message);
    } finally {
      setDrafting(false);
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
              <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-black min-w-[240px] shadow-lg">
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

      {page === "outbox" && <CapitalWatchOutbox businessId={business._id} isAdmin={isAdmin} onChange={afterChange} />}

      {(page === "profile" || page === "new-business") && (
        <CapitalWatchBusiness
          key={page}
          options={options}
          business={page === "profile" ? business : null}
          onCancel={() => setPage("list")}
          onSaved={async (b) => { await onBusinessesChanged(b._id); setPage("list"); flash("Profile saved. Matches updated."); }}
          onDeleted={async () => { await onBusinessesChanged(); setPage("list"); }}
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
          <div className="px-4 sm:px-8 py-4 flex flex-wrap gap-2 items-center">
            {[{ id: "all", label: "All types" }, ...options.fundingCategories].map((c) => {
              const count = view === "matches" && c.id !== "all" ? stats?.byCategory?.[c.id] : undefined;
              if (view === "matches" && c.id !== "all" && !count && category !== c.id) return null;
              return (
                <button key={c.id} onClick={() => setCategory(c.id)} aria-pressed={category === c.id}
                  className={`text-xs px-3 py-1.5 border ${category === c.id ? "bg-black text-white border-black" : "border-gray-300 hover:border-black"}`}>
                  {c.label}{count ? ` (${count})` : ""}
                </button>
              );
            })}
            {view === "matches" && (
              <label className="ml-auto flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" checked={showUnfit} onChange={(e) => setShowUnfit(e.target.checked)} className="accent-black" />
                Also show ones that aren't a fit
              </label>
            )}
          </div>

          <hr className="border-gray-200" />

          <div className="px-4 sm:px-8 pb-28">
            <div className="hidden sm:grid grid-cols-[2fr_1.2fr_1fr_1fr_3fr] gap-4 py-4 text-gray-400 text-sm uppercase tracking-wide">
              <div>Opportunity</div><div>Website</div><div>Amount</div><div>Type</div><div>Description</div>
            </div>

            {loading && <div className="py-8 text-gray-400">Loading…</div>}
            {!loading && grants.length === 0 && (
              <div className="py-8 text-gray-400">
                {view === "matches"
                  ? <>No matches{category !== "all" ? " of this type" : ""} right now. New opportunities arrive every week. <button onClick={() => setPage("profile")} className="underline">Check what your profile hides</button>.</>
                  : `Nothing ${VIEWS.find((v) => v.id === view)?.label.toLowerCase()} yet.`}
              </div>
            )}

            {grants.map((grant) => (
              <div key={grant._id} className={`group relative border mb-4 px-2 transition-colors hover:border-black ${grant.fit === false ? "border-dashed border-gray-300 opacity-70" : "border-gray-200"}`}>
                <div className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-[2fr_1.2fr_1fr_1fr_3fr] sm:gap-4 sm:py-6 sm:items-start">
                  <div className="pr-14 sm:pr-10">
                    <div className="font-bold">{grant.title}</div>
                    {grant.agency && <div className="text-xs text-gray-500 mt-1">{grant.agency}</div>}
                  </div>
                  <div className="text-gray-600">
                    <span className="sm:hidden block text-xs uppercase tracking-wide text-gray-400 mb-0.5">Website</span>
                    {grant.link ? <a href={grant.link} target="_blank" rel="noopener noreferrer" className="underline hover:text-black break-all">{websiteLabel(grant.link)}</a> : EMPTY}
                  </div>
                  <div>
                    <span className="sm:hidden block text-xs uppercase tracking-wide text-gray-400 mb-0.5">Amount</span>
                    {formatUsd(grant.amountUsd) || EMPTY}
                    <DeadlineLabel grant={grant} />
                  </div>
                  <div>
                    <span className="sm:hidden block text-xs uppercase tracking-wide text-gray-400 mb-0.5">Type</span>
                    {labelOf(options.fundingCategories, grant.category) || EMPTY}
                    {!!grant.targetDemographics?.length && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {grant.targetDemographics.map((tag) => (
                          <span key={tag} className="text-[10px] uppercase tracking-wide border border-gray-300 px-1.5 py-0.5 text-gray-500">{labelOf(options.demographics, tag).replace(/-owned$/, "")}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    <span className="sm:hidden block text-xs uppercase tracking-wide text-gray-400 mb-0.5">Description</span>
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

                <div className="absolute -top-4 -right-4 flex flex-col gap-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
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
        <Modal onClose={() => !drafting && setApplying(null)}>
          {drafting ? (
            <div className="flex flex-col items-center gap-3 py-6 text-gray-500">
              <Loader2 size={24} className="animate-spin" />
              <div className="text-sm text-center">Drafting an application for {business.name}… this takes about 20 seconds.</div>
            </div>
          ) : (
            <>
              <h2 className="text-lg mb-2">Apply to {applying.title}?</h2>
              <p className="text-sm text-gray-600 mb-4">
                We'll draft the application from {business.name}'s profile, list what you still need to gather, email it to you,
                and put an outreach email in your Outbox. Nothing is submitted or sent for you.
              </p>
              <p className="text-xs text-gray-400 mb-6">{draftsLeft} of {member.limits.drafts} drafts left today.</p>
              <div className="flex gap-3">
                <button onClick={apply} disabled={draftsLeft === 0} className="bg-black text-white px-5 py-2 hover:bg-gray-800 disabled:opacity-40">Draft my application</button>
                <button onClick={() => setApplying(null)} className="text-gray-500 underline">Cancel</button>
              </div>
            </>
          )}
        </Modal>
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
        <CapitalWatchInanna
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
        Today: {member.usage.questions} of {member.limits.questions} Inanna questions, {member.usage.drafts} of {member.limits.drafts} application drafts.
      </div>

      <label className="flex items-center gap-3 text-sm mb-4 cursor-pointer">
        <input type="checkbox" checked={!member.digestOptOut} onChange={toggleDigest} className="accent-black w-4 h-4" />
        Weekly match digest and deadline alerts
      </label>

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
