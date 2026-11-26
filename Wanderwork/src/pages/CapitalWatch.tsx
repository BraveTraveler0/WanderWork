import { useEffect, useState, useCallback, useRef } from "react";
import { Trash2, Plus, Triangle, Check, X, Loader2, Archive, Mail } from "lucide-react";
import { api, getKey, setKey } from "./capitalWatchApi";
import CapitalWatchInanna from "./CapitalWatchInanna";
import CapitalWatchOutbox from "./CapitalWatchOutbox";

type Company = { id: string; name: string };

type Grant = {
  _id: string;
  title: string;
  agency?: string;
  fundingType?: string;
  amountUsd?: number;
  link?: string;
  summary?: string;
  requirements?: string;
  targetDemographics?: string[];
  status: "pending" | "approved" | "rejected" | "archived" | "expired";
  dueDate?: string;
  rolling?: boolean;
  contactEmail?: string;
};

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

type Stats = { grants: number; angels: number; venture: number; loans: number };

const EMPTY = "n/a";

function formatAmount(amountUsd?: number) {
  if (!amountUsd) return EMPTY;
  return `$${amountUsd.toLocaleString()}`;
}

function websiteLabel(link?: string) {
  if (!link) return EMPTY;
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}

// Thin geometric line-art, purely decorative — sits behind the stats row.
function GeometricBackdrop() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <circle cx="92%" cy="10%" r="120" fill="none" stroke="#e5e7eb" strokeWidth="1" />
      <line x1="0" y1="0" x2="100%" y2="100%" stroke="#f3f4f6" strokeWidth="1" />
      <line x1="60%" y1="0" x2="60%" y2="100%" stroke="#f3f4f6" strokeWidth="1" />
      <path d="M 0 70 Q 200 0 400 70" fill="none" stroke="#e5e7eb" strokeWidth="1" />
    </svg>
  );
}

// Small "+" crop-mark, decorative corner accent.
function CornerMark({ className = "" }: { className?: string }) {
  return <Plus size={14} strokeWidth={1.5} className={className} />;
}

function Header({ onOutbox, outboxCount, outboxActive }: { onOutbox?: () => void; outboxCount?: number; outboxActive?: boolean }) {
  return (
    <div className="relative bg-[#FACC15] px-4 sm:px-8 py-6 overflow-hidden flex items-center justify-between gap-4">
      <a href="/" className="text-2xl sm:text-3xl tracking-tight flex items-center gap-2 w-fit transition-opacity hover:opacity-70">
        <Triangle size={16} strokeWidth={1.5} className="opacity-60" />
        Capital Watch /
      </a>
      {onOutbox ? (
        <button
          onClick={onOutbox}
          className={`relative flex items-center gap-2 border border-black px-3 py-1.5 text-sm transition-colors ${outboxActive ? "bg-black text-white" : "hover:bg-black hover:text-white"}`}
          title={outboxActive ? "Back to opportunities" : "Emails waiting for review"}
        >
          <Mail size={15} strokeWidth={1.5} />
          Outbox
          {!!outboxCount && (
            <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${outboxActive ? "bg-[#FACC15] text-black" : "bg-black text-white"}`}>
              {outboxCount > 9 ? "9+" : outboxCount}
            </span>
          )}
        </button>
      ) : (
        <CornerMark className="opacity-50" />
      )}
    </div>
  );
}

// Asks for the team's access key once per browser. The key is checked against the
// server before it's saved, so a typo shows an error instead of an empty dashboard.
function KeyGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const key = value.trim();
    if (!key) return;
    setChecking(true);
    setError(null);
    try {
      await api("/companies", {}, key);
      setKey(key);
      onUnlock();
    } catch (err) {
      setError((err as Error).message === "Unauthorized" ? "That key didn't work." : (err as Error).message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen bg-white font-mono">
      <Header />
      <form onSubmit={submit} className="max-w-sm mx-auto px-4 py-16">
        <label htmlFor="cw-key" className="block text-lg mb-2">Team access key</label>
        <p className="text-sm text-gray-500 mb-4">Enter it once on this device. It stays in this browser only.</p>
        <input id="cw-key" type="password" value={value} onChange={(e) => setValue(e.target.value)} autoFocus autoComplete="current-password"
          className="w-full border border-gray-300 px-4 py-2 outline-none focus:border-black" />
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
        <button type="submit" disabled={checking || !value.trim()}
          className="mt-4 w-full bg-black text-white px-6 py-2 flex items-center justify-center gap-2 hover:bg-gray-800 disabled:opacity-50">
          {checking && <Loader2 size={14} className="animate-spin" />} Open dashboard
        </button>
      </form>
    </div>
  );
}

// This file is kept identical in the Wander repo (Wanderwork/) and the AonCreative repo,
// which serves it live at aoncreative.io/capitalwatch. Change both together.
export default function CapitalWatch() {
  const [unlocked, setUnlocked] = useState(() => Boolean(getKey()));
  // Internal tool on a public site: keep it out of search results.
  useEffect(() => {
    const tag = document.createElement("meta");
    tag.name = "robots";
    tag.content = "noindex, nofollow";
    document.head.appendChild(tag);
    const prevTitle = document.title;
    document.title = "Capital Watch";
    return () => { tag.remove(); document.title = prevTitle; };
  }, []);
  useEffect(() => {
    const lock = () => setUnlocked(false);
    window.addEventListener("capitalwatch:locked", lock);
    return () => window.removeEventListener("capitalwatch:locked", lock);
  }, []);
  return unlocked ? <Dashboard /> : <KeyGate onUnlock={() => setUnlocked(true)} />;
}

function Dashboard() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [stats, setStats] = useState<Stats>({ grants: 0, angels: 0, venture: 0, loans: 0 });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"pending" | "rejected" | "approved" | "archived">("pending");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "grants" | "angels" | "venture" | "loans">("all");
  const [loading, setLoading] = useState(false);
  const [popupGrantId, setPopupGrantId] = useState<string | null>(null);
  const [hoveredStat, setHoveredStat] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // "outbox" shows the email review queue in place of the opportunity list.
  const [view, setView] = useState<"opportunities" | "outbox">("opportunities");
  const [outboxCount, setOutboxCount] = useState(0);
  // Bumped after any change so Inanna's briefing and badge stay current.
  const [refreshKey, setRefreshKey] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  // Typing waits for a short pause before searching, instead of one request per key.
  const [query, setQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);
  // Ignores a slow response that arrives after a newer one.
  const loadSeq = useRef(0);

  useEffect(() => {
    const refresh = () => setRefreshKey((k) => k + 1);
    window.addEventListener("capitalwatch:outbox-changed", refresh);
    return () => window.removeEventListener("capitalwatch:outbox-changed", refresh);
  }, []);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter });
      if (query) params.set("q", query);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      const data = await api(`/grants?${params.toString()}`);
      if (seq === loadSeq.current) setGrants(data);
    } catch (err) {
      console.error("[CapitalWatch] load failed:", err);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [query, statusFilter, categoryFilter]);

  // Counts only change when data changes, not when a filter is clicked.
  const loadStats = useCallback(() => {
    api(`/stats`).then(setStats).catch((err) => console.error("[CapitalWatch] stats failed:", err));
  }, []);

  useEffect(() => {
    api("/companies").then(setCompanies).catch(console.error);
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, status: "approved" | "rejected" | "archived", companyId?: string) {
    if (decidingId) return; // a request is already in flight, ignore repeat clicks
    setDecidingId(id);
    try {
      await api(`/grants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, companyId }),
      });
      setGrants((prev) => prev.filter((g) => g._id !== id));
      if (status === "approved") {
        setSuccessMessage("Application drafted and emailed to the team. The outreach email is in the Outbox for review.");
        setTimeout(() => setSuccessMessage(null), 4000);
      }
      setPopupGrantId(null);
      setRefreshKey((k) => k + 1);
      loadStats();
    } catch (err) {
      console.error("[CapitalWatch] decision failed:", err);
      alert("Could not update grant: " + (err as Error).message);
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-white font-mono">
      <Header
        onOutbox={() => setView((v) => (v === "outbox" ? "opportunities" : "outbox"))}
        outboxCount={outboxCount}
        outboxActive={view === "outbox"}
      />

      <div className="relative flex flex-col lg:flex-row items-stretch lg:items-end justify-between px-4 sm:px-8 py-6 sm:py-8 gap-6 sm:gap-8 overflow-hidden">
        <GeometricBackdrop />

        <div className="relative z-10 flex flex-wrap sm:flex-nowrap gap-4 sm:gap-10 lg:gap-16 divide-x divide-gray-200">
          {([
            ["grants", "Grants", stats.grants],
            ["angels", "Angels", stats.angels],
            ["venture", "Venture", stats.venture],
            ["loans", "Loans", stats.loans],
          ] as const).map(([key, label, value], i) => (
            <button
              key={key}
              onClick={() => setCategoryFilter((c) => (c === key ? "all" : key))}
              onMouseEnter={() => setHoveredStat(label)}
              onMouseLeave={() => setHoveredStat(null)}
              className={`group relative text-left transition-opacity ${i > 0 ? "pl-4 sm:pl-10 lg:pl-16" : ""} ${categoryFilter !== "all" && categoryFilter !== key ? "opacity-40" : ""}`}
            >
              <div className="text-4xl sm:text-6xl leading-none">{value}</div>
              <div className={`mt-2 text-sm sm:text-base ${categoryFilter === key ? "text-black" : "text-gray-500"}`}>{label}</div>
              {hoveredStat === label && (
                <span className="hidden sm:block absolute left-1/2 -translate-x-1/2 top-full mt-2 z-30 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white">
                  Filter by {label}
                </span>
              )}
            </button>
          ))}
        </div>

        {hoveredStat && (
          <span
            className="sm:hidden absolute z-30 -translate-y-full whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white"
            style={{
              top: searchRef.current?.offsetTop ?? 0,
              left: searchRef.current?.offsetLeft ?? 0,
            }}
          >
            Filter by {hoveredStat}
          </span>
        )}

        <div ref={searchRef} className="relative z-10 flex flex-col items-stretch lg:items-end gap-2 w-full lg:w-auto">
          <form
            className="flex w-full lg:w-auto"
            onSubmit={(e) => { e.preventDefault(); setView("opportunities"); if (search.trim() === query) load(); else setQuery(search.trim()); }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              aria-label="Search opportunities"
              className="border border-gray-300 px-4 py-2 flex-1 lg:w-64 outline-none transition-colors focus:border-black"
            />
            <button
              type="submit"
              className="bg-black text-white px-6 py-2 transition-colors hover:bg-gray-800"
            >
              Go
            </button>
          </form>
          <div className="flex items-center gap-4 self-end">
            <button
              onClick={() => { setView("opportunities"); setStatusFilter((s) => (s === "approved" ? "pending" : "approved")); }}
              className={`transition-colors ${statusFilter === "approved" ? "text-black" : "text-gray-400 hover:text-black"}`}
              title={statusFilter === "approved" ? "Back to pending" : "View applied"}
            >
              <Check size={16} strokeWidth={2} />
            </button>
            <button
              onClick={() => { setView("opportunities"); setStatusFilter((s) => (s === "archived" ? "pending" : "archived")); }}
              className={`transition-colors ${statusFilter === "archived" ? "text-black" : "text-gray-400 hover:text-black"}`}
              title={statusFilter === "archived" ? "Back to pending" : "View archived"}
            >
              <Archive size={16} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => { setView("opportunities"); setStatusFilter((s) => (s === "rejected" ? "pending" : "rejected")); }}
              className={`transition-colors ${statusFilter === "rejected" ? "text-black" : "text-gray-400 hover:text-black"}`}
              title={statusFilter === "rejected" ? "Back to pending" : "View deleted"}
            >
              <Trash2 size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      <hr className="border-gray-200" />

      {view === "outbox" ? (
        <CapitalWatchOutbox onChange={() => setRefreshKey((k) => k + 1)} />
      ) : (
      <div className="px-4 sm:px-8">
        <div className="hidden sm:grid grid-cols-[2fr_1.5fr_1fr_1fr_3fr] gap-4 py-4 text-gray-400 text-sm uppercase tracking-wide">
          <div>Grant Name</div>
          <div>Website</div>
          <div>Amount</div>
          <div>Type</div>
          <div>Description</div>
        </div>

        {loading && <div className="py-8 text-gray-400">Loading…</div>}
        {!loading && grants.length === 0 && (
          <div className="py-8 text-gray-400">No {statusFilter} opportunities.</div>
        )}

        {grants.map((grant) => (
          <div
            key={grant._id}
            className="group relative border border-gray-200 mb-4 px-2 transition-colors hover:border-black"
          >
            <div className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-[2fr_1.5fr_1fr_1fr_3fr] sm:gap-4 sm:py-6 sm:items-start">
              <div className="font-bold pr-14 sm:pr-10">{grant.title}</div>
              <div className="text-gray-600">
                <span className="sm:hidden block text-xs uppercase tracking-wide text-gray-400 mb-0.5">Website</span>
                {grant.link ? (
                  <a
                    href={grant.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline transition-colors hover:text-black"
                  >
                    {websiteLabel(grant.link)}
                  </a>
                ) : (
                  websiteLabel(grant.link)
                )}
              </div>
              <div>
                <span className="sm:hidden block text-xs uppercase tracking-wide text-gray-400 mb-0.5">Amount</span>
                {formatAmount(grant.amountUsd)}
                <DeadlineLabel grant={grant} />
              </div>
              <div>
                <span className="sm:hidden block text-xs uppercase tracking-wide text-gray-400 mb-0.5">Type</span>
                {grant.fundingType || EMPTY}
                {!!grant.targetDemographics?.length && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {grant.targetDemographics.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] uppercase tracking-wide border border-gray-300 px-1.5 py-0.5 text-gray-500"
                      >
                        {tag.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-500">
                <span className="sm:hidden block text-xs uppercase tracking-wide text-gray-400 mb-0.5">Description</span>
                {grant.summary || EMPTY}
              </div>
            </div>

            {statusFilter === "pending" && (
              <div className="absolute -top-4 -right-4 flex flex-col gap-4 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setPopupGrantId(grant._id)}
                  className="w-9 h-9 sm:w-8 sm:h-8 rotate-45 bg-[#FACC15] text-white ring-4 ring-white shadow-lg flex items-center justify-center transition-all hover:bg-yellow-400 hover:scale-110"
                  title="Approve"
                >
                  <Check size={16} strokeWidth={2} className="-rotate-45 text-black" />
                </button>
                <button
                  onClick={() => decide(grant._id, "rejected")}
                  className="w-9 h-9 sm:w-8 sm:h-8 bg-black text-white ring-4 ring-white shadow-lg flex items-center justify-center transition-all hover:bg-gray-800 hover:scale-110"
                  title="Reject"
                >
                  <X size={15} strokeWidth={3} />
                </button>
                <button
                  onClick={() => decide(grant._id, "archived")}
                  className="w-9 h-9 sm:w-8 sm:h-8 bg-white text-gray-600 ring-4 ring-white border border-gray-300 shadow-lg flex items-center justify-center transition-all hover:border-black hover:text-black hover:scale-110"
                  title="Archive for later"
                >
                  <Archive size={15} strokeWidth={2} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      )}

      {popupGrantId && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => !decidingId && setPopupGrantId(null)}
        >
          <div
            className="bg-white p-8 w-80"
            onClick={(e) => e.stopPropagation()}
          >
            {decidingId === popupGrantId ? (
              <div className="flex flex-col items-center gap-3 py-6 text-gray-500">
                <Loader2 size={24} className="animate-spin" />
                <div className="text-sm">Drafting application…</div>
              </div>
            ) : (
              <>
                <h2 className="text-lg mb-4">Apply as which company?</h2>
                <div className="flex flex-col gap-2">
                  {companies.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => decide(popupGrantId, "approved", c.id)}
                      className="border border-gray-300 px-4 py-2 text-left transition-all hover:border-black hover:translate-x-1"
                    >
                      {c.name}
                    </button>
                  ))}
                  {companies.length === 0 && (
                    <div className="text-gray-400 text-sm">No companies configured.</div>
                  )}
                </div>
              </>
            )}
            <button
              onClick={() => setPopupGrantId(null)}
              disabled={!!decidingId}
              className="mt-4 text-gray-400 underline disabled:opacity-0"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <CapitalWatchInanna
        refreshKey={refreshKey}
        onBriefing={(b) => setOutboxCount(b.outboxDrafts)}
        onApprove={(id) => setPopupGrantId(id)}
        onDecide={(id, status) => decide(id, status)}
        onOpenOutbox={() => setView("outbox")}
      />

      {successMessage && (
        <div className="fixed bottom-24 right-6 z-50 flex items-center gap-2 bg-black text-white px-4 py-3 shadow-lg">
          <Check size={16} strokeWidth={2} />
          <span className="text-sm">{successMessage}</span>
        </div>
      )}
    </div>
  );
}
