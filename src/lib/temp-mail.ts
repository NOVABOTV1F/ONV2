/** Free temporary email via mail.tm – server-side with retries + fallback */

import { createServerFn } from "@tanstack/react-start";

const API = "https://api.mail.tm";
const FALLBACK_DOMAIN = "euploading.com";

const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "User-Agent": "QWEN-GENERETE/1.0",
};

export type TempMailAccount = {
  address: string;
  password: string;
  token: string;
};

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url: string, init?: RequestInit, retries = 2): Promise<any> {
  let lastErr: Error | null = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { ...headers, ...(init?.headers || {}) },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
      }
      return await res.json();
    } catch (e: any) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (i < retries) await sleep(600 * (i + 1));
    }
  }
  throw lastErr || new Error("Fetch gagal");
}

async function getActiveDomain(): Promise<string> {
  try {
    const data = await fetchJson(`${API}/domains`);
    const domain = data?.["hydra:member"]?.[0]?.domain;
    if (domain) return domain;
  } catch {
    // fall through to fallback
  }
  return FALLBACK_DOMAIN;
}

async function createAccountOnServer(prefix: string): Promise<TempMailAccount> {
  const domain = await getActiveDomain();
  const local = `${prefix}${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`;
  const address = `${local}@${domain}`;
  const password = `Qw${Math.random().toString(36).slice(2, 10)}9!`;

  await fetchJson(`${API}/accounts`, {
    method: "POST",
    body: JSON.stringify({ address, password }),
  });

  const tokenData = await fetchJson(`${API}/token`, {
    method: "POST",
    body: JSON.stringify({ address, password }),
  });

  const token = tokenData?.token;
  if (!token) throw new Error("Token kosong dari mail.tm");

  return { address, password, token };
}

async function pollOtpOnServer(token: string, maxWaitMs: number): Promise<string | null> {
  const start = Date.now();
  const otpRegex = /\b(\d{4,8})\b/g;

  while (Date.now() - start < maxWaitMs) {
    try {
      const data = await fetchJson(`${API}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const messages = data?.["hydra:member"] || [];

      for (const msg of messages) {
        const subject = msg.subject || "";
        const subMatch = subject.match(otpRegex);
        if (subMatch) return subMatch[0];

        if (msg.id) {
          try {
            const full = await fetchJson(`${API}/messages/${msg.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const text = `${full.subject || ""} ${full.text || ""} ${full.intro || ""}`;
            const match = text.match(otpRegex);
            if (match) return match[0];
          } catch {
            // ignore single message fetch error
          }
        }
      }
    } catch {
      // keep polling
    }
    await sleep(2200);
  }
  return null;
}

export const createTempMail = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const prefix = typeof data === "string" ? data : (data as any)?.prefix || "qwen";
    return String(prefix).replace(/[^a-z0-9]/gi, "").slice(0, 10) || "qwen";
  })
  .handler(async ({ data: prefix }) => {
    try {
      return await createAccountOnServer(prefix);
    } catch (e: any) {
      throw new Error(e?.message || "Gagal buat email sementara");
    }
  });

export const fetchLatestOtp = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as any;
    const token = String(d?.token || "").trim();
    const maxWaitMs = Math.min(Number(d?.maxWaitMs) || 25000, 30000);
    if (!token) throw new Error("Token kosong");
    return { token, maxWaitMs };
  })
  .handler(async ({ data }) => {
    return pollOtpOnServer(data.token, data.maxWaitMs);
  });
