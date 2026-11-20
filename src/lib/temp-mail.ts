/** Free temporary email via Guerrilla Mail API (works from Vercel) */

import { createServerFn } from "@tanstack/react-start";

const API = "https://api.guerrillamail.com/ajax.php";

export type TempMailAccount = {
  address: string;
  password: string; // unused for guerrilla, kept for type compat
  token: string; // sid_token
};

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function gmFetch(params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ ...params, ip: "127.0.0.1", agent: "Mozilla_foo_bar" });
  const res = await fetch(`${API}?${qs.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; QWEN/1.0)",
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${t.slice(0, 100)}`);
  }
  return res.json();
}

async function createAccountOnServer(_prefix: string): Promise<TempMailAccount> {
  // Guerrilla returns a random address + sid_token
  const data = await gmFetch({ f: "get_email_address" });
  const address = data?.email_addr;
  const token = data?.sid_token;
  if (!address || !token) throw new Error("Gagal buat email sementara (Guerrilla)");
  return { address, password: "", token };
}

async function pollOtpOnServer(token: string, maxWaitMs: number): Promise<string | null> {
  const start = Date.now();
  const otpRegex = /\b(\d{4,8})\b/g;

  while (Date.now() - start < maxWaitMs) {
    try {
      // check_email returns list of messages
      const data = await gmFetch({ f: "check_email", sid_token: token, seq: "0" });
      const list = data?.list || [];

      for (const msg of list) {
        // skip the welcome mail from Guerrilla itself
        const from = (msg.mail_from || "").toLowerCase();
        if (from.includes("guerrillamail") || from.includes("no-reply@guerrillamail")) continue;

        const subject = msg.mail_subject || "";
        const subMatch = subject.match(otpRegex);
        if (subMatch) return subMatch[0];

        // fetch full body
        if (msg.mail_id) {
          try {
            const full = await gmFetch({
              f: "fetch_email",
              sid_token: token,
              email_id: String(msg.mail_id),
            });
            const text = `${full.mail_subject || ""} ${full.mail_body || ""} ${full.mail_excerpt || ""}`;
            const match = text.match(otpRegex);
            if (match) return match[0];
          } catch {
            // ignore single fetch error
          }
        }
      }
    } catch {
      // keep polling
    }
    await sleep(2500);
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
