import { VIDEO_LINKS, type VideoLinks } from "@/config/videos";

export type QwenUser = {
  name: string;
  passHash: string;
  gmail: string;
};

export type GmailApp = {
  user: string;
  pass: string;
};

export type DeskSnap = {
  address: string;
  otp: string;
};

const USERS = "qwen-users-v1";
const SESSION = "qwen-session-v1";
const GMAIL_APP = "qwen-gmail-app-v1";
const VIDEOS = "qwen-videos-v1";
const DESK = "qwen-desk-v1";
const ADMIN = "qwen-admin-v1";

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export async function hashPass(pass: string) {
  const data = new TextEncoder().encode(`qwen-generete:${pass}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function loadUsers(): QwenUser[] {
  const parsed = readJson<unknown>(USERS);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((row): row is QwenUser => {
    if (!row || typeof row !== "object") return false;
    const u = row as QwenUser;
    return typeof u.name === "string" && typeof u.gmail === "string" && typeof u.passHash === "string";
  });
}

export function saveUsers(users: QwenUser[]) {
  writeJson(USERS, users);
}

export function loadSession(): { name: string; gmail: string } | null {
  const row = readJson<{ name?: string; gmail?: string }>(SESSION);
  if (!row?.name || !row.gmail) return null;
  return { name: row.name, gmail: row.gmail };
}

export function saveSession(session: { name: string; gmail: string } | null) {
  if (!session) localStorage.removeItem(SESSION);
  else writeJson(SESSION, session);
}

export function loadGmailApp(): GmailApp | null {
  const row = readJson<GmailApp>(GMAIL_APP);
  if (!row?.user?.trim() || !row.pass?.trim()) return null;
  return { user: row.user.trim(), pass: row.pass };
}

export function saveGmailApp(app: GmailApp | null) {
  if (!app) localStorage.removeItem(GMAIL_APP);
  else writeJson(GMAIL_APP, app);
}

export function gmailAppOn(app: GmailApp | null) {
  return Boolean(app?.user && app.pass);
}

export function loadVideoLinks(): VideoLinks {
  const row = readJson<Partial<VideoLinks>>(VIDEOS);
  return {
    satu: row?.satu?.trim() || VIDEO_LINKS.satu,
    dua: row?.dua?.trim() || VIDEO_LINKS.dua,
    tiga: row?.tiga?.trim() || VIDEO_LINKS.tiga,
  };
}

export function saveVideoLinks(links: VideoLinks | null) {
  if (!links) localStorage.removeItem(VIDEOS);
  else writeJson(VIDEOS, links);
}

export function loadDesk(gmail: string): DeskSnap | null {
  const all = readJson<Record<string, DeskSnap>>(DESK);
  const row = all?.[gmail.toLowerCase()];
  if (!row?.address) return null;
  return { address: row.address, otp: row.otp ?? "" };
}

export function saveDesk(gmail: string, snap: DeskSnap | null) {
  const all = readJson<Record<string, DeskSnap>>(DESK) ?? {};
  const key = gmail.toLowerCase();
  if (!snap) delete all[key];
  else all[key] = snap;
  writeJson(DESK, all);
}

export function loadAdminFlag() {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(ADMIN) === "1";
}

export function saveAdminFlag(on: boolean) {
  if (on) sessionStorage.setItem(ADMIN, "1");
  else sessionStorage.removeItem(ADMIN);
}

export function makeOtp() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0]! % 1_000_000).padStart(6, "0");
}

export function spinWaitMs() {
  return 3000 + Math.floor(Math.random() * 4001);
}

export function randomReel() {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
}

export function makeAddress(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "qwen";
  const tail = Math.random().toString(36).slice(2, 8);
  return `${base}.${tail}@gmail.com`;
}

export function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
