import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, ExternalLink, Loader2, Mail, RotateCcw, Sparkles, X } from "lucide-react";
import { api, formatUsd, type Briefing, type InannaAction } from "./capitalWatchApi";

// Inanna for Capital Watch: the floating orb from MarketGenius, scoped to funding.
// It reads the real grants, deadlines and company profiles on the server, answers in
// context, and suggests actions. Every action is a button a person clicks; emails go
// to the Outbox as drafts and are only sent from there.

type Turn = { role: "user" | "assistant"; content: string; actions?: InannaAction[]; error?: boolean };

const HISTORY_KEY = "capitalwatch.inanna.history";
const STARTERS = [
  "Which 3 should we apply to this week, and why?",
  "What deadlines are coming up?",
  "What's still missing on the applications we started?",
  "Which opportunities fit Aonverse best?",
];

function loadHistory(): Turn[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(-30) : [];
  } catch {
    return [];
  }
}

function saveHistory(turns: Turn[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(turns.slice(-30))); } catch { /* storage blocked */ }
}

// Canvas orb: flowing ribbons and particles masked to a soft sphere. Same engine as
// MarketGenius's Inanna orb, retinted to Capital Watch's yellow and gold.
function OrbCanvas({ level = 0.2, size = 48 }: { level?: number; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelRef = useRef(level);
  useEffect(() => { levelRef.current = Math.max(0, Math.min(1, level)); }, [level]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    const offscreen = document.createElement("canvas");
    const off = offscreen.getContext("2d", { alpha: true });
    if (!canvas || !context || !off) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let width = size;
    let height = size;
    let smoothed = 0;
    let last = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = offscreen.width = Math.round(width * ratio);
      canvas.height = offscreen.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      off.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();

    const ribbon = (t: number, cx: number, cy: number, r: number, i: number, energy: number) => {
      const steps = 48;
      const top: [number, number][] = [];
      const bottom: [number, number][] = [];
      const phase = t * (0.42 + i * 0.035) + i * 1.43;
      const amp = r * (0.12 + i * 0.008 + energy * 0.105);
      const thick = r * (0.035 + (i % 3) * 0.012 + energy * 0.025);
      const vOff = Math.sin(t * 0.24 + i * 1.9) * r * 0.1;
      for (let s = 0; s <= steps; s++) {
        const p = s / steps;
        const nx = p * 2 - 1;
        const env = Math.pow(Math.max(0, Math.cos(nx * Math.PI * 0.5)), 0.65);
        const y = cy + vOff + (Math.sin(nx * Math.PI * (1.15 + i * 0.17) + phase) * amp
          + Math.sin(nx * Math.PI * (2.1 + i * 0.11) - phase * 0.72) * r * 0.045) * env;
        const th = thick * env * (0.8 + Math.sin(p * Math.PI * 3 + phase) * 0.2);
        const x = cx + nx * r * 1.12;
        top.push([x, y - th]);
        bottom.push([x, y + th]);
      }
      off.beginPath();
      off.moveTo(top[0][0], top[0][1]);
      for (const pt of top) off.lineTo(pt[0], pt[1]);
      for (let k = bottom.length - 1; k >= 0; k--) off.lineTo(bottom[k][0], bottom[k][1]);
      off.closePath();
      // Warm palette: pale yellow -> gold -> amber.
      const hA = 52 - ((i * 3) % 8);
      const hB = 45 - ((i * 5) % 10);
      const hC = 34 - ((i * 4) % 10);
      const g = off.createLinearGradient(cx - r, cy, cx + r, cy);
      g.addColorStop(0, `hsla(${hA},100%,62%,0)`);
      g.addColorStop(0.18, `hsla(${hA},100%,60%,${0.32 + energy * 0.18})`);
      g.addColorStop(0.5, `hsla(${hB},100%,55%,${0.52 + energy * 0.24})`);
      g.addColorStop(0.78, `hsla(${hC},100%,55%,${0.42 + energy * 0.18})`);
      g.addColorStop(1, `hsla(${hC},100%,55%,0)`);
      off.fillStyle = g;
      off.fill();
    };

    const render = (ts: number) => {
      frame = requestAnimationFrame(render);
      if (ts - last < 1000 / 30) return;
      last = ts;
      const t = reduceMotion ? 0 : ts / 1000;
      smoothed += (levelRef.current - smoothed) * 0.09;
      const energy = 0.28 + smoothed * 0.72 + (0.5 + Math.sin(t * 1.35) * 0.5) * 0.09;
      const cx = width / 2;
      const cy = height / 2;
      const r = Math.min(width, height) * 0.36 * (1 + smoothed * 0.075 + Math.sin(t * 1.4) * 0.022);

      context.clearRect(0, 0, width, height);
      off.clearRect(0, 0, width, height);

      const inner = off.createRadialGradient(cx - r * 0.15, cy - r * 0.12, r * 0.04, cx, cy, r);
      inner.addColorStop(0, `rgba(250,204,21,${0.42 + energy * 0.14})`);
      inner.addColorStop(0.5, `rgba(234,160,20,${0.3 + energy * 0.1})`);
      inner.addColorStop(1, "rgba(180,100,10,0)");
      off.fillStyle = inner;
      off.fillRect(0, 0, width, height);

      off.globalCompositeOperation = "lighter";
      for (let i = 0; i < 7; i++) ribbon(t, cx, cy, r, i, energy);
      for (let i = 0; i < 18; i++) {
        const a = i * 2.399;
        const d = r * (0.15 + ((i * 47) % 100) / 145);
        off.beginPath();
        off.arc(cx + Math.cos(a + t * 0.035) * d, cy + Math.sin(a * 1.13 - t * 0.025) * d * 0.82, 0.5 + ((i * 13) % 5) * 0.2 + energy * 0.6, 0, Math.PI * 2);
        off.fillStyle = `rgba(255,255,255,${0.3 + energy * 0.3})`;
        off.fill();
      }

      off.globalCompositeOperation = "destination-in";
      const mask = off.createRadialGradient(cx, cy, r * 0.12, cx, cy, r * 1.18);
      mask.addColorStop(0, "rgba(255,255,255,1)");
      mask.addColorStop(0.72, "rgba(255,255,255,0.96)");
      mask.addColorStop(1, "rgba(255,255,255,0)");
      off.fillStyle = mask;
      off.fillRect(0, 0, width, height);
      off.globalCompositeOperation = "source-over";

      context.globalCompositeOperation = "lighter";
      context.drawImage(offscreen, 0, 0, canvas.width, canvas.height, 0, 0, width, height);
      context.globalCompositeOperation = "source-over";
      // Reduced motion: one still frame, then stop drawing entirely.
      if (reduceMotion) cancelAnimationFrame(frame);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [size]);

  return <canvas ref={canvasRef} style={{ width: size, height: size, display: "block" }} aria-hidden="true" />;
}

// **bold** spans, in case the model uses them despite being asked for plain text.
function Inline({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : part)}</>;
}

// Plain text with "- " bullets, kept readable without a markdown library.
function ReplyText({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split("\n").filter((l) => l.trim()).map((line, i) =>
        /^\s*[-*•]\s+/.test(line)
          ? <div key={i} className="pl-3 relative"><span className="absolute left-0">·</span><Inline text={line.replace(/^\s*[-*•]\s+/, "")} /></div>
          : <p key={i}><Inline text={line} /></p>,
      )}
    </div>
  );
}

const ACTION_TEXT: Record<InannaAction["type"], string> = {
  open: "Open source",
  approve: "Approve",
  archive: "Archive for later",
  reject: "Reject",
  draft_email: "Save email to Outbox",
};

type Props = {
  onBriefing?: (briefing: Briefing) => void;
  onApprove: (grantId: string) => void;
  onDecide: (grantId: string, status: "rejected" | "archived") => Promise<void>;
  onOpenOutbox: () => void;
  refreshKey: number;
};

export default function CapitalWatchInanna({ onBriefing, onApprove, onDecide, onOpenOutbox, refreshKey }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "today">("chat");
  const [turns, setTurns] = useState<Turn[]>(loadHistory);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [doneActions, setDoneActions] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // The page's Outbox badge reads from this too, so there's one request, not two.
  const onBriefingRef = useRef(onBriefing);
  onBriefingRef.current = onBriefing;
  const loadBriefing = useCallback(() => {
    api("/inanna/briefing")
      .then((b: Briefing) => { setBriefing(b); onBriefingRef.current?.(b); })
      .catch((err) => console.error("[Inanna] briefing failed:", err));
  }, []);
  useEffect(() => { loadBriefing(); }, [loadBriefing, refreshKey]);
  useEffect(() => { saveHistory(turns); }, [turns]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, asking, open, tab]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // base: the conversation to continue from (a retry drops the failed exchange first).
  async function ask(question: string, base: Turn[] = turns) {
    const q = question.trim();
    if (!q || asking) return;
    const next: Turn[] = [...base, { role: "user", content: q }];
    setTurns(next);
    setInput("");
    setTab("chat");
    setAsking(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const messages = next.filter((t) => !t.error).map(({ role, content }) => ({ role, content }));
      const data = await api("/inanna/ask", { method: "POST", body: JSON.stringify({ messages }), signal: controller.signal });
      setTurns((prev) => [...prev, { role: "assistant", content: data.reply, actions: data.actions }]);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setTurns((prev) => [...prev, { role: "assistant", content: (err as Error).message || "Something went wrong.", error: true }]);
      }
    } finally {
      setAsking(false);
      abortRef.current = null;
    }
  }

  async function runAction(action: InannaAction, key: string) {
    if (doneActions[key]) return;
    try {
      if (action.type === "open" && action.link) {
        window.open(action.link, "_blank", "noopener,noreferrer");
        return;
      }
      if (action.type === "approve") {
        // Opens the normal "Apply as which company?" step, so a person confirms.
        onApprove(action.grantId);
        return;
      }
      if (action.type === "reject" && !window.confirm(`Reject "${action.grantTitle}"?`)) return;
      if (action.type === "reject" || action.type === "archive") {
        setDoneActions((d) => ({ ...d, [key]: "Working…" }));
        await onDecide(action.grantId, action.type === "reject" ? "rejected" : "archived");
        setDoneActions((d) => ({ ...d, [key]: action.type === "reject" ? "Rejected" : "Archived" }));
        loadBriefing();
        return;
      }
      if (action.type === "draft_email") {
        setDoneActions((d) => ({ ...d, [key]: "Saving…" }));
        await api("/outbox", {
          method: "POST",
          body: JSON.stringify({ grantId: action.grantId, companyId: action.companyId, to: action.to, subject: action.subject, body: action.body, source: "inanna" }),
        });
        setDoneActions((d) => ({ ...d, [key]: "In Outbox for review" }));
        window.dispatchEvent(new Event("capitalwatch:outbox-changed"));
        loadBriefing();
      }
    } catch (err) {
      setDoneActions((d) => { const c = { ...d }; delete c[key]; return c; });
      alert((err as Error).message);
    }
  }

  const badge = (briefing?.urgentCount || 0) + (briefing?.outboxDrafts || 0);
  const tooltip = briefing && badge
    ? [briefing.urgentCount && `${briefing.urgentCount} due this week`, briefing.outboxDrafts && `${briefing.outboxDrafts} email${briefing.outboxDrafts === 1 ? "" : "s"} to review`].filter(Boolean).join(" · ")
    : "Ask Inanna";

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 font-mono">
      {open && (
        <div role="dialog" aria-label="Inanna"
          className="w-[calc(100vw-2.5rem)] sm:w-[400px] h-[min(600px,calc(100vh-7rem))] bg-white border border-black shadow-[6px_6px_0_0_#FACC15] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Sparkles size={14} />
              <span className="font-bold">Inanna</span>
              <span className="text-xs text-gray-400">funding assistant</span>
            </div>
            <div className="flex items-center gap-3">
              {turns.length > 0 && (
                <button onClick={() => { abortRef.current?.abort(); setTurns([]); setDoneActions({}); }}
                  className="text-gray-400 hover:text-black" title="Start a new conversation">
                  <RotateCcw size={14} />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-black" aria-label="Close Inanna">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex border-b border-gray-200 text-sm">
            {(["chat", "today"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2 ${tab === t ? "border-b-2 border-black text-black" : "text-gray-400 hover:text-black"}`}>
                {t === "chat" ? "Ask" : `Today${briefing?.urgentCount ? ` (${briefing.urgentCount})` : ""}`}
              </button>
            ))}
            <button onClick={() => { setOpen(false); onOpenOutbox(); }}
              className="flex-1 py-2 text-gray-400 hover:text-black flex items-center justify-center gap-1">
              <Mail size={13} /> Outbox{briefing?.outboxDrafts ? ` (${briefing.outboxDrafts})` : ""}
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
            {tab === "chat" && turns.length === 0 && !asking && (
              <div className="space-y-2">
                <p className="text-gray-500 mb-3">
                  I read every opportunity on this dashboard, your deadlines, and the company profiles. Ask me what to pursue, or to draft an email. Emails wait in the Outbox until you send them.
                </p>
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => ask(s)}
                    className="block w-full text-left border border-gray-200 px-3 py-2 hover:border-black transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {tab === "chat" && turns.map((turn, i) => (
              turn.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] bg-black text-white px-3 py-2">{turn.content}</div>
                </div>
              ) : (
                <div key={i} className={`max-w-[95%] ${turn.error ? "text-red-600" : "text-gray-800"}`}>
                  <ReplyText text={turn.content} />
                  {turn.error && (
                    <button onClick={() => {
                      const prev = turns[i - 1];
                      if (prev?.role === "user") ask(prev.content, turns.slice(0, i - 1));
                    }} className="mt-1 text-xs underline">Try again</button>
                  )}
                  {!!turn.actions?.length && (
                    <div className="mt-3 space-y-2">
                      {turn.actions.map((a, j) => {
                        const key = `${i}:${j}`;
                        return (
                          <div key={key} className="border border-gray-200 p-2">
                            <div className="text-xs text-gray-500 mb-1 truncate">{a.grantTitle}</div>
                            {a.type === "draft_email" && (
                              <div className="text-xs text-gray-600 mb-2 whitespace-pre-wrap font-sans max-h-32 overflow-y-auto border-l-2 border-[#FACC15] pl-2">
                                <div className="font-bold">{a.subject}</div>
                                {a.to && <div className="text-gray-400">To {a.to}</div>}
                                {a.body}
                              </div>
                            )}
                            <button onClick={() => runAction(a, key)} disabled={!!doneActions[key]}
                              className={`text-xs px-3 py-1.5 flex items-center gap-1 ${a.type === "approve" ? "bg-[#FACC15] text-black hover:bg-yellow-400" : a.type === "reject" ? "bg-black text-white hover:bg-gray-800" : "border border-gray-300 hover:border-black"} disabled:opacity-60`}>
                              {a.type === "open" && <ExternalLink size={11} />}
                              {a.type === "draft_email" && <Mail size={11} />}
                              {doneActions[key] || a.label || ACTION_TEXT[a.type]}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )
            ))}

            {tab === "chat" && asking && (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 size={14} className="animate-spin" /> Reading your opportunities…
                <button onClick={() => abortRef.current?.abort()} className="ml-2 underline text-xs">Stop</button>
              </div>
            )}

            {tab === "today" && !briefing && <div className="text-gray-400">Loading…</div>}
            {tab === "today" && briefing && (
              <div className="space-y-6">
                <section>
                  <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Due in the next 2 weeks</h3>
                  {briefing.dueSoon.length === 0 && <div className="text-gray-400">No dated deadlines in the next 14 days.</div>}
                  {briefing.dueSoon.map((d) => (
                    <button key={d.id} onClick={() => ask(`Tell me about "${d.title}". Should we go for it before the deadline, and what do we need?`)}
                      className="w-full text-left border border-gray-200 px-3 py-2 mb-2 hover:border-black">
                      <div className="flex justify-between gap-2">
                        <span className="truncate">{d.title}</span>
                        <span className={`shrink-0 ${d.days <= 3 ? "text-red-600 font-bold" : d.days <= 7 ? "text-black font-bold" : "text-gray-500"}`}>
                          {d.days === 0 ? "today" : `${d.days}d`}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">{d.status === "approved" ? "Applying" : "Not decided"}{d.amountUsd ? ` · ${formatUsd(d.amountUsd)}` : ""}</div>
                    </button>
                  ))}
                </section>

                <section>
                  <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Best matches waiting</h3>
                  {briefing.topMatches.map((m) => (
                    <button key={m.id} onClick={() => ask(`Why is "${m.title}" a good fit, and which company should apply?`)}
                      className="w-full text-left border border-gray-200 px-3 py-2 mb-2 hover:border-black">
                      <div className="truncate">{m.title}</div>
                      <div className="text-xs text-gray-400">{[formatUsd(m.amountUsd), m.fundingType, `deadline ${m.deadline}`].filter(Boolean).join(" · ")}</div>
                    </button>
                  ))}
                </section>

                {briefing.needsInput.length > 0 && (
                  <section>
                    <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Applications waiting on you</h3>
                    {briefing.needsInput.map((n) => (
                      <button key={n.id} onClick={() => ask(`For "${n.title}", walk me through what's still missing and how to get each item.`)}
                        className="w-full text-left border border-gray-200 px-3 py-2 mb-2 hover:border-black">
                        <div className="truncate">{n.title}</div>
                        <div className="text-xs text-gray-400 truncate">Needs: {n.missing.join(", ")}</div>
                      </button>
                    ))}
                  </section>
                )}
              </div>
            )}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="border-t border-gray-200 p-3 flex gap-2">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
              placeholder="Ask Inanna about your funding…"
              className="flex-1 resize-none border border-gray-300 px-3 py-2 outline-none focus:border-black text-sm" />
            <button type="submit" disabled={asking || !input.trim()} aria-label="Send question"
              className="bg-black text-white px-3 hover:bg-gray-800 disabled:opacity-40">
              <ArrowUp size={16} />
            </button>
          </form>
        </div>
      )}

      <div className="relative group">
        {badge > 0 && !open && (
          <span className="absolute -top-1 -right-1 z-10 min-w-[18px] h-[18px] px-1 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label={open ? "Close Inanna" : "Ask Inanna"} aria-expanded={open}
          className="w-14 h-14 rounded-full bg-black flex items-center justify-center overflow-hidden shadow-[0_8px_24px_rgba(250,204,21,0.35)] transition-transform hover:-translate-y-0.5 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black">
          <OrbCanvas size={56} level={open || asking ? 0.6 : 0.18} />
        </button>
        {!open && (
          <span className="pointer-events-none absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap bg-black text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {tooltip}
          </span>
        )}
      </div>
    </div>
  );
}
