import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { personalPalette } from "./personal-colors.mjs";
import { PERSONALITY_KEY, validPersonality } from "./personality-data.mjs";

const names = ["xzx", "吃吃", "czl", "子涵", "悦悦"];
const dir = process.env.TONGPIN_DATA_DIR || join(process.cwd(), ".team-data");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
type Store = { invitations: Record<string, string>; sessions: Record<string, { name: string; expires: number }>; documents: Record<string, { revision: number; value: unknown }> };
function read(): Store {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, "workspace.json");
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const invitations = Object.fromEntries(names.map(name => [name, randomBytes(18).toString("base64url")]));
  writeFileSync(join(dir, "invitations.json"), JSON.stringify(invitations, null, 2), { mode: 0o600 });
  const state: Store = { invitations: Object.fromEntries(Object.entries(invitations).map(([name, code]) => [hash(code), name])), sessions: {}, documents: {} };
  save(state); return state;
}
function save(state: Store) {
  const file = join(dir, "workspace.json");
  if (existsSync(file)) writeFileSync(join(dir, "workspace.previous.json"), readFileSync(file), { mode: 0o600 });
  writeFileSync(file + ".tmp", JSON.stringify(state), { mode: 0o600 });
  renameSync(file + ".tmp", file);
}
const allowed = new Set(["tongpin-tasks-v8", "tongpin-messages-v8", "tongpin-personal-tasks-v3", "tongpin-personal-categories-v2", "tongpin-personal-category-colors-v1", "tongpin-review-notes-v1"]);
const attempts = new Map<string, { count: number; until: number }>();
allowed.add(PERSONALITY_KEY);
export async function handleTeam(request: Request) {
  const publicOrigin = new URL(process.env.TONGPIN_PUBLIC_ORIGIN || request.url).origin;
  const secureCookie = new URL(publicOrigin).protocol === "https:";
  const reply = (value: unknown, status = 200, headers = {}) => Response.json(value, { status, headers: { "Cache-Control": "no-store", ...headers } });
  if (request.method === "POST" && request.headers.get("origin") && request.headers.get("origin") !== publicOrigin) return reply({ error: "请求来源不匹配" }, 403);
  let state = read();
  const token = request.headers.get("cookie")?.match(/(?:^|;\s*)tongpin_session=([^;]+)/)?.[1] || "";
  const session = state.sessions[hash(token)];
  let member = session && session.expires > Date.now() ? session.name : null;
  if (request.method === "GET") {
    if (!member) return reply({ error: "请使用邀请码进入" }, 401);
    const key = new URL(request.url).searchParams.get("key");
    if (key === PERSONALITY_KEY && member !== "xzx") return reply({ error: "无权访问此内容" }, 403);
    if (key && !allowed.has(key)) return reply({ error: "未知数据类型" }, 400);
    return reply(key ? { member, document: state.documents[key] || null } : { member });
  }
  const raw = await request.text();
  if (raw.length > 2_000_000) return reply({ error: "内容过大" }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return reply({ error: "内容格式错误" }, 400); }
  if (!body || typeof body !== "object") return reply({ error: "内容格式错误" }, 400);
  state = read();
  const currentSession = state.sessions[hash(token)];
  member = currentSession && currentSession.expires > Date.now() ? currentSession.name : null;
  if (body.action === "login") {
    const bucket = "login";
    const attempt = attempts.get(bucket) || { count: 0, until: Date.now() + 60000 };
    if (attempt.until < Date.now()) { attempt.count = 0; attempt.until = Date.now() + 60000; }
    if (++attempt.count > 30) return reply({ error: "尝试次数较多，请一分钟后重试" }, 429);
    attempts.set(bucket, attempt);
    const name = state.invitations[hash(String(body.code || "").trim())];
    if (!name) return reply({ error: "邀请码不正确" }, 401);
    const value = randomBytes(32).toString("base64url");
    state.sessions[hash(value)] = { name, expires: Date.now() + 30 * 86400000 };
    save(state);
    return reply({ member: name }, 200, { "Set-Cookie": `tongpin_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${secureCookie ? "; Secure" : ""}` });
  }
  if (!member) return reply({ error: "登录已过期，请重新进入" }, 401);
  if (body.action === "logout") { delete state.sessions[hash(token)]; save(state); return reply({}, 200, { "Set-Cookie": `tongpin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie ? "; Secure" : ""}` }); }
  if (!allowed.has(body.key)) return reply({ error: "未知数据类型" }, 400);
  if (body.key === PERSONALITY_KEY && member !== "xzx") return reply({ error: "无权访问此内容" }, 403);
  const previous = state.documents[body.key];
  if ((previous?.revision || 0) !== body.revision) return reply({ error: "另一位成员已更新，请刷新后重试", document: previous }, 409);
  const isColors = body.key === "tongpin-personal-category-colors-v1";
  const isPersonality = body.key === PERSONALITY_KEY;
  if (isPersonality && !validPersonality(body.value)) return reply({ error: "请填写有效内容（每项最多一万字，最多 1000 条记录）" }, 400);
  if (body.key.endsWith("categories-v2") || isColors || isPersonality ? !body.value || Array.isArray(body.value) || typeof body.value !== "object" : !Array.isArray(body.value)) return reply({ error: "数据格式不正确" }, 400);
  if (isColors && Object.entries(body.value).some(([owner, colors]) => !names.includes(owner) || !colors || Array.isArray(colors) || typeof colors !== "object" || Object.values(colors).some(color => !personalPalette.some(item => item.id === color)))) return reply({ error: "分类配色无效" }, 400);
  if (Array.isArray(body.value)) {
    if (body.value.some((item: any) => !item || typeof item !== "object" || !Number.isFinite(item.id))) return reply({ error: "任务格式不正确" }, 400);
    const old = Array.isArray(previous?.value) ? previous.value : [];
    for (const item of body.value) {
      const before = old.find((entry: { id: number }) => entry.id === item.id);
      if (body.key === "tongpin-review-notes-v1") {
        if (!Number.isFinite(item.taskId)) return reply({ error: "请选择对应的复盘任务" }, 400);
        if (typeof item.text !== "string" || !item.text.trim() || item.text.length > 10000) return reply({ error: "请填写有效的复盘内容（最多一万字）" }, 400);
        item.author = before?.author || member;
        item.createdAt = before?.createdAt || new Date().toISOString();
      }
      if (body.key === "tongpin-messages-v8" && previous && !before) item.author = member;
      if (body.key === "tongpin-tasks-v8") {
        if (item.quantity !== undefined && item.quantity !== null && (!Number.isSafeInteger(item.quantity) || item.quantity < 0 || item.quantity > 999999)) return reply({ error: "产出次数须为 0 到 999999 的整数" }, 400);
        if (item.assistants !== undefined && (!Array.isArray(item.assistants) || item.assistants.some((name: unknown) => typeof name !== "string" || !names.includes(name)))) return reply({ error: "协助人无效" }, 400);
        if (Array.isArray(item.assistants)) item.assistants = [...new Set(item.assistants)];
        if (previous && item.status === "已完成" && before?.status !== "已完成") { item.completedBy = member; item.completedAt = new Date().toISOString(); }
        for (const field of ["notes", "reviews"]) {
          if (item[field] !== undefined && !Array.isArray(item[field])) return reply({ error: "沟通格式不正确" }, 400);
          for (const note of item[field] || []) {
            if (!note || typeof note.text !== "string") return reply({ error: "沟通格式不正确" }, 400);
            if (previous && !(before?.[field] || []).some((entry: { id: number }) => entry.id === note.id)) note.author = member;
          }
        }
        item.reviews = [...(item.reviews || []), ...(item.notes || [])].filter((note, index, all) => all.findIndex(n => n.id === note.id) === index);
        item.notes = [];
      }
    }
  }
  const document = { revision: (previous?.revision || 0) + 1, value: body.value };
  state.documents[body.key] = document; save(state);
  return reply({ member, document });
}
