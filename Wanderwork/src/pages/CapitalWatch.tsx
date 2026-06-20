import { useEffect, useState, useCallback } from "react";
import { Trash2, ArrowLeft, Plus, Triangle } from "lucide-react";

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
  status: "pending" | "approved" | "rejected";
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
  const [statusFilter, setStatusFilter] = useState<"pending" | "rejected">("pending");
  const [loading, setLoading] = useState(false);
  const [popupGrantId, setPopupGrantId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter });
      if (search.trim()) params.set("q", search.trim());
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
  }, [search, statusFilter]);

  useEffect(() => {
    api("/companies").then(setCompanies).catch(console.error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, status: "approved" | "rejected", companyId?: string) {
    try {
      await api(`/grants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, companyId }),
      });
      setPopupGrantId(null);
      setGrants((prev) => prev.filter((g) => g._id !== id));
    } catch (err) {
      console.error("[CapitalWatch] decision failed:", err);
      alert("Could not update grant: " + (err as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-white font-mono">
      <div className="relative bg-[#FACC15] px-8 py-6 overflow-hidden">
        <h1 className="text-3xl tracking-tight flex items-center gap-2">
          <Triangle size={16} strokeWidth={1.5} className="opacity-60" />
          Capital Watch /
        </h1>
        <CornerMark className="absolute top-4 right-6 opacity-50" />
      </div>

      <div className="relative flex items-end justify-between px-8 py-8 gap-8 flex-wrap overflow-hidden">
        <GeometricBackdrop />

        <div className="relative z-10 flex gap-16 divide-x divide-gray-200">
          <div>
            <div className="text-6xl leading-none">{stats.grants}</div>
            <div className="text-gray-500 mt-2">Grants</div>
          </div>
          <div className="pl-16">
            <div className="text-6xl leading-none">{stats.angels}</div>
            <div className="text-gray-500 mt-2">Angels</div>
          </div>
          <div className="pl-16">
            <div className="text-6xl leading-none">{stats.venture}</div>
            <div className="text-gray-500 mt-2">Venture</div>
          </div>
          <div className="pl-16">
            <div className="text-6xl leading-none">{stats.loans}</div>
            <div className="text-gray-500 mt-2">Loans</div>
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-end gap-2">
          <div className="flex">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="border border-gray-300 px-4 py-2 w-64 outline-none transition-colors focus:border-black"
            />
            <button
              onClick={load}
              className="bg-black text-white px-6 py-2 transition-colors hover:bg-gray-800"
            >
              Go
            </button>
          </div>
          <button
            onClick={() => setStatusFilter((s) => (s === "pending" ? "rejected" : "pending"))}
            className="flex items-center gap-1.5 text-gray-400 transition-colors hover:text-black"
            title={statusFilter === "pending" ? "View deleted" : "Back to pending"}
          >
            {statusFilter === "pending" ? (
              <Trash2 size={16} strokeWidth={1.5} />
            ) : (
              <ArrowLeft size={16} strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>

      <hr className="border-gray-200" />

      <div className="px-8">
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_3fr] gap-4 py-4 text-gray-400 text-sm uppercase tracking-wide">
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
            <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_3fr] gap-4 py-6 items-start">
              <div className="font-bold">{grant.title}</div>
              <div className="text-gray-600">
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
              <div>{formatAmount(grant.amountUsd)}</div>
              <div>
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
              <div className="text-sm text-gray-500">{grant.summary || "—"}</div>
            </div>

            {statusFilter === "pending" && (
              <div className="absolute -top-3 -right-3 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setPopupGrantId(grant._id)}
                  className="w-7 h-7 bg-[#FACC15] text-white flex items-center justify-center font-bold transition-transform hover:scale-110"
                  title="Approve"
                >
                  ✓
                </button>
                <button
                  onClick={() => decide(grant._id, "rejected")}
                  className="w-7 h-7 bg-black text-white flex items-center justify-center font-bold transition-transform hover:scale-110"
                  title="Reject"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {popupGrantId && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setPopupGrantId(null)}
        >
          <div
            className="bg-white p-8 w-80"
            onClick={(e) => e.stopPropagation()}
          >
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
            <button
              onClick={() => setPopupGrantId(null)}
              className="mt-4 text-gray-400 underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
