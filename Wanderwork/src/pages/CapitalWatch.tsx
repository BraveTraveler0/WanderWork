import { useEffect, useState, useCallback, useRef } from "react";
import { Trash2, Plus, Triangle, Check, X, Loader2, Archive } from "lucide-react";

const API_BASE =
  import.meta.env.VITE_CAPITALWATCH_API_BASE_URL || "http://localhost:8000";
const CAPITAL_WATCH_KEY = import.meta.env.VITE_CAPITAL_WATCH_KEY || "";

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
  status: "pending" | "approved" | "rejected" | "archived";
};

type Stats = { grants: number; angels: number; venture: number; loans: number };

async function api(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}/capitalwatch${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-capitalwatch-key": CAPITAL_WATCH_KEY,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || res.statusText);
  return res.json();
}

function formatAmount(amountUsd?: number) {
  if (!amountUsd) return "—";
  return `$${amountUsd.toLocaleString()}`;
}

function websiteLabel(link?: string) {
  if (!link) return "—";
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

export default function CapitalWatch() {
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
  const searchRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter });
      if (search.trim()) params.set("q", search.trim());
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      const [grantsData, statsData] = await Promise.all([
        api(`/grants?${params.toString()}`),
        api(`/stats`),
      ]);
      setGrants(grantsData);
      setStats(statsData);
    } catch (err) {
      console.error("[CapitalWatch] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter]);

  useEffect(() => {
    api("/companies").then(setCompanies).catch(console.error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, status: "approved" | "rejected" | "archived", companyId?: string) {
    if (decidingId) return; // a request is already in flight — ignore repeat clicks
    setDecidingId(id);
    try {
      await api(`/grants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, companyId }),
      });
      setGrants((prev) => prev.filter((g) => g._id !== id));
      if (status === "approved") {
        setSuccessMessage("Application drafted and emailed.");
        setTimeout(() => setSuccessMessage(null), 2500);
      }
      setPopupGrantId(null);
    } catch (err) {
      console.error("[CapitalWatch] decision failed:", err);
      alert("Could not update grant: " + (err as Error).message);
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-white font-mono">
      <div className="relative bg-[#FACC15] px-4 sm:px-8 py-6 overflow-hidden">
        <a href="https://wanderwork.io" className="text-2xl sm:text-3xl tracking-tight flex items-center gap-2 w-fit transition-opacity hover:opacity-70">
          <Triangle size={16} strokeWidth={1.5} className="opacity-60" />
          Capital Watch /
        </a>
        <CornerMark className="absolute top-4 right-6 opacity-50" />
      </div>

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
          <div className="flex w-full lg:w-auto">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="border border-gray-300 px-4 py-2 flex-1 lg:w-64 outline-none transition-colors focus:border-black"
            />
            <button
              onClick={load}
              className="bg-black text-white px-6 py-2 transition-colors hover:bg-gray-800"
            >
              Go
            </button>
          </div>
          <div className="flex items-center gap-4 self-end">
            <button
              onClick={() => setStatusFilter((s) => (s === "approved" ? "pending" : "approved"))}
              className={`transition-colors ${statusFilter === "approved" ? "text-black" : "text-gray-400 hover:text-black"}`}
              title={statusFilter === "approved" ? "Back to pending" : "View applied"}
            >
              <Check size={16} strokeWidth={2} />
            </button>
            <button
              onClick={() => setStatusFilter((s) => (s === "archived" ? "pending" : "archived"))}
              className={`transition-colors ${statusFilter === "archived" ? "text-black" : "text-gray-400 hover:text-black"}`}
              title={statusFilter === "archived" ? "Back to pending" : "View archived"}
            >
              <Archive size={16} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setStatusFilter((s) => (s === "rejected" ? "pending" : "rejected"))}
              className={`transition-colors ${statusFilter === "rejected" ? "text-black" : "text-gray-400 hover:text-black"}`}
              title={statusFilter === "rejected" ? "Back to pending" : "View deleted"}
            >
              <Trash2 size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      <hr className="border-gray-200" />

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
              </div>
              <div>
                <span className="sm:hidden block text-xs uppercase tracking-wide text-gray-400 mb-0.5">Type</span>
                {grant.fundingType || "—"}
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
                {grant.summary || "—"}
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

      {successMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-black text-white px-4 py-3 shadow-lg">
          <Check size={16} strokeWidth={2} />
          <span className="text-sm">{successMessage}</span>
        </div>
      )}
    </div>
  );
}
