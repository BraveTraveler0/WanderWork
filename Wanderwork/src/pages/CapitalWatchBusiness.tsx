import { useEffect, useState } from "react";
import { Check, Loader2, Trash2, UserPlus, X } from "lucide-react";
import { api, send, type Business, type Option, type Options } from "./capitalWatchApi";

// The business profile: everything matching and the AI drafts are based on.
// Shared by the first-run setup and the "Edit profile" view.

type Draft = Omit<Business, "_id" | "memberIds" | "pendingInvites">;

const EMPTY: Draft = {
  name: "", website: "", description: "", founders: "", highlights: "",
  industries: [], stage: "", entityType: "for_profit", foundedYear: null, teamSize: null,
  country: "United States", state: "", city: "",
  founderDemographics: [], seeking: [], ignoreCategories: [], ignoreKeywords: [],
  amountMin: null, amountMax: null, useOfFunds: "",
};

function Chips({ options, value, onChange, tone = "yellow" }: { options: Option[]; value: string[]; onChange: (v: string[]) => void; tone?: "yellow" | "black" }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button key={o.id} type="button" aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id])}
            className={`text-sm px-3 py-1.5 border transition-colors ${on ? (tone === "yellow" ? "bg-[#FACC15] border-black" : "bg-black text-white border-black") : "border-gray-300 hover:border-black"}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block mb-5">
      <span className="block text-sm font-bold mb-1">{label}</span>
      {hint && <span className="block text-xs text-gray-500 mb-2">{hint}</span>}
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-gray-200 pt-6 mt-6">
      <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-4">{title}</h3>
      {children}
    </section>
  );
}

const input = "w-full border border-gray-300 px-3 py-2 outline-none focus:border-black bg-white";
const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[$,\s]/g, "")));

function Team({ business }: { business: Business }) {
  const [people, setPeople] = useState<{ members: { id: string; email: string; name: string }[]; pendingInvites: string[] } | null>(null);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const load = () => api(`/businesses/${business._id}/members`).then(setPeople).catch(() => {});
  useEffect(() => { load(); }, [business._id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const r = await send(`/businesses/${business._id}/members`, "POST", { email });
      setMsg(r.message);
      setEmail("");
      load();
    } catch (err) { setMsg((err as Error).message); }
  }
  async function remove(who: string) {
    try { await send(`/businesses/${business._id}/members/${encodeURIComponent(who)}`, "DELETE"); load(); } catch (err) { setMsg((err as Error).message); }
  }

  return (
    <Section title="Team">
      <p className="text-sm text-gray-500 mb-3">Everyone here sees the same matches, applications and Outbox for this business.</p>
      {people?.members.map((m) => (
        <div key={m.id} className="flex items-center justify-between border-b border-gray-100 py-2 text-sm">
          <span>{m.name ? `${m.name} · ` : ""}{m.email}</span>
          {people.members.length > 1 && <button type="button" onClick={() => remove(m.id)} className="text-gray-400 hover:text-black" aria-label={`Remove ${m.email}`}><X size={14} /></button>}
        </div>
      ))}
      {people?.pendingInvites.map((e) => (
        <div key={e} className="flex items-center justify-between border-b border-gray-100 py-2 text-sm text-gray-500">
          <span>{e} (invited)</span>
          <button type="button" onClick={() => remove(e)} className="text-gray-400 hover:text-black" aria-label={`Cancel invite for ${e}`}><X size={14} /></button>
        </div>
      ))}
      <form onSubmit={invite} className="flex gap-2 mt-3">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" className={input} />
        <button type="submit" disabled={!email.trim()} className="border border-black px-3 flex items-center gap-1 text-sm hover:bg-black hover:text-white disabled:opacity-40">
          <UserPlus size={14} /> Invite
        </button>
      </form>
      {msg && <div className="text-sm mt-2">{msg}</div>}
    </Section>
  );
}

export default function CapitalWatchBusiness({ options, business, onSaved, onDeleted, onCancel, firstRun = false }: {
  options: Options;
  business?: Business | null;
  onSaved: (b: Business) => void;
  onDeleted?: () => void;
  onCancel?: () => void;
  firstRun?: boolean;
}) {
  const [form, setForm] = useState<Draft>(() => ({ ...EMPTY, ...(business || {}) }));
  const [keywords, setKeywords] = useState((business?.ignoreKeywords || []).join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Give the business a name."); return; }
    setSaving(true);
    setError(null);
    const body = { ...form, ignoreKeywords: keywords.split(",").map((k) => k.trim()).filter(Boolean) };
    try {
      const saved = business ? await send(`/businesses/${business._id}`, "PATCH", body) : await send("/businesses", "POST", body);
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try { await send(`/businesses/${business!._id}`, "DELETE"); onDeleted?.(); } catch (err) { setError((err as Error).message); }
  }

  return (
    <div className="px-4 sm:px-8 py-8 max-w-3xl">
      <h2 className="text-2xl mb-2">{firstRun ? "Tell us about your business" : business ? `Edit ${business.name}` : "Add a business"}</h2>
      <p className="text-sm text-gray-500 mb-6">
        Capital Watch ranks every grant, loan, investor and competition against this profile, and hides what doesn't fit.
        The more you fill in, the better the matches and the AI-drafted applications.
      </p>

      <form onSubmit={save}>
        <Field label="Business name">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} className={input} required maxLength={120} />
        </Field>
        <Field label="What does it do?" hint="A few plain sentences: product, customers, and why it matters.">
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} maxLength={2000} className={`${input} font-sans text-sm`} />
        </Field>
        <Field label="Website">
          <input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" className={input} maxLength={200} />
        </Field>

        <Section title="The basics">
          <Field label="Industry" hint="Pick all that apply.">
            <Chips options={options.industries} value={form.industries} onChange={(v) => set("industries", v)} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-x-6">
            <Field label="Stage">
              <select value={form.stage} onChange={(e) => set("stage", e.target.value)} className={input}>
                <option value="">Choose…</option>
                {options.stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Legal type">
              <select value={form.entityType} onChange={(e) => set("entityType", e.target.value)} className={input}>
                {options.entityTypes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Year founded">
              <input inputMode="numeric" value={form.foundedYear ?? ""} onChange={(e) => set("foundedYear", numOrNull(e.target.value))} className={input} />
            </Field>
            <Field label="Team size">
              <input inputMode="numeric" value={form.teamSize ?? ""} onChange={(e) => set("teamSize", numOrNull(e.target.value))} className={input} />
            </Field>
          </div>
        </Section>

        <Section title="Location">
          <div className="grid sm:grid-cols-3 gap-x-6">
            <Field label="Country"><input value={form.country} onChange={(e) => set("country", e.target.value)} className={input} maxLength={60} /></Field>
            <Field label="State or region"><input value={form.state} onChange={(e) => set("state", e.target.value)} className={input} maxLength={60} /></Field>
            <Field label="City"><input value={form.city} onChange={(e) => set("city", e.target.value)} className={input} maxLength={60} /></Field>
          </div>
        </Section>

        <Section title="Founders">
          <Field label="Founder backgrounds" hint="Many opportunities are only for certain founders. This is used only to show you the ones you qualify for. Optional.">
            <Chips options={options.demographics} value={form.founderDemographics} onChange={(v) => set("founderDemographics", v)} />
          </Field>
          <Field label="Founders and team" hint="Names, roles and relevant experience. Used in application drafts.">
            <textarea value={form.founders} onChange={(e) => set("founders", e.target.value)} rows={3} maxLength={1500} className={`${input} font-sans text-sm`} />
          </Field>
          <Field label="Traction and highlights" hint="Customers, revenue, users, awards, partnerships. The AI only uses facts you put here.">
            <textarea value={form.highlights} onChange={(e) => set("highlights", e.target.value)} rows={3} maxLength={1500} className={`${input} font-sans text-sm`} />
          </Field>
        </Section>

        <Section title="What you're looking for">
          <Field label="Types of funding you want" hint="Leave empty to see every type you haven't hidden below.">
            <Chips options={options.fundingCategories} value={form.seeking} onChange={(v) => set("seeking", v)} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-x-6">
            <Field label="Smallest amount worth it ($)">
              <input inputMode="numeric" value={form.amountMin ?? ""} onChange={(e) => set("amountMin", numOrNull(e.target.value))} className={input} placeholder="Any" />
            </Field>
            <Field label="Most you'd want ($)">
              <input inputMode="numeric" value={form.amountMax ?? ""} onChange={(e) => set("amountMax", numOrNull(e.target.value))} className={input} placeholder="Any" />
            </Field>
          </div>
          <Field label="What the money is for">
            <textarea value={form.useOfFunds} onChange={(e) => set("useOfFunds", e.target.value)} rows={2} maxLength={600} className={`${input} font-sans text-sm`} />
          </Field>
        </Section>

        <Section title="What to hide">
          <Field label="Never show these types">
            <Chips tone="black" options={options.fundingCategories} value={form.ignoreCategories} onChange={(v) => set("ignoreCategories", v)} />
          </Field>
          <Field label="Hide opportunities that mention" hint="Comma-separated, e.g. housing, food truck, film">
            <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className={input} />
          </Field>
        </Section>

        {error && <div className="text-sm text-red-600 mt-4">{error}</div>}
        <div className="flex flex-wrap items-center gap-3 mt-6">
          <button type="submit" disabled={saving} className="bg-black text-white px-6 py-2 flex items-center gap-2 hover:bg-gray-800 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {firstRun ? "Show my matches" : "Save profile"}
          </button>
          {onCancel && <button type="button" onClick={onCancel} className="text-gray-500 underline">Cancel</button>}
        </div>
      </form>

      {business && <Team business={business} />}

      {business && onDeleted && (
        <Section title="Delete">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>{business.memberIds.length > 1 ? "Leave this business? Your teammates keep it." : "Delete this business, its decisions and its Outbox?"}</span>
              <button type="button" onClick={remove} className="bg-black text-white px-3 py-1.5">Yes</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="underline text-gray-500">No</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-gray-500 hover:text-black flex items-center gap-1">
              <Trash2 size={14} /> {business.memberIds.length > 1 ? "Leave this business" : "Delete this business"}
            </button>
          )}
        </Section>
      )}
    </div>
  );
}
