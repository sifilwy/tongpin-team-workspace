"use client";
import { createContext, useContext, useEffect, useState, type ReactNode, type FormEvent } from "react";
import "../team-access.css";
const Identity = createContext("xzx");
export const useMember = () => useContext(Identity);
export default function TeamAccess({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/team").then(r => r.json()).then(data => setMember(data.member || null)).catch(() => setError("暂时连接不上，请稍后重试")).finally(() => setLoading(false)); }, []);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const code = new FormData(event.currentTarget).get("code");
    try { const r = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", code }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error); setMember(data.member); } catch (e) { setError(e instanceof Error ? e.message : "连接失败"); } finally { setBusy(false); }
  }
  if (loading) return <div className="team-access">正在连接工作台…</div>;
  if (!member) return <main className="team-access"><form onSubmit={login}><span className="access-mark">同</span><h1>同频工作台</h1><p>输入你的邀请码，进入团队。</p><label htmlFor="invite-code">成员邀请码</label><input id="invite-code" name="code" type="password" autoComplete="current-password" required autoFocus placeholder="粘贴邀请码" /><p role="alert">{error}</p><button disabled={busy}>{busy ? "正在进入…" : "进入工作台"}</button></form></main>;
  return <Identity.Provider value={member}><div className="team-identity"><span>{member}</span><button onClick={async () => { await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) }); location.reload(); }}>退出</button></div>{children}</Identity.Provider>;
}
