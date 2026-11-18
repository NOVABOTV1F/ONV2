/** Free temporary email via mail.tm API – real inbox that can receive OTPs */

const API = "https://api.mail.tm";

export type TempMailAccount = {
  address: string;
  password: string;
  token: string;
};

async function getActiveDomain(): Promise<string> {
  const res = await fetch(`${API}/domains`);
  if (!res.ok) throw new Error("Gagal ambil domain temp mail");
  const data = await res.json();
  const domain = data?.["hydra:member"]?.[0]?.domain;
  if (!domain) throw new Error("Tidak ada domain aktif");
  return domain;
}

export async function createTempMail(prefix = "qwen"): Promise<TempMailAccount> {
  const domain = await getActiveDomain();
  const local = `${prefix}${Date.now().toString(36).slice(-6)}${Math.random().toString(36).slice(2, 5)}`;
  const address = `${local}@${domain}`;
  const password = `Qw${Math.random().toString(36).slice(2, 10)}!9`;

  const createRes = await fetch(`${API}/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, password }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.detail || "Gagal buat email sementara");
  }

  const tokenRes = await fetch(`${API}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, password }),
  });

  if (!tokenRes.ok) throw new Error("Gagal ambil token email");
  const tokenData = await tokenRes.json();
  const token = tokenData.token;
  if (!token) throw new Error("Token kosong");

  return { address, password, token };
}

export async function fetchLatestOtp(token: string, maxWaitMs = 25000): Promise<string | null> {
  const start = Date.now();
  const otpRegex = /\b(\d{4,8})\b/g;

  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`${API}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      await new Promise((r) => setTimeout(r, 2500));
      continue;
    }
    const data = await res.json();
    const messages = data?.["hydra:member"] || [];

    for (const msg of messages) {
      // Prefer subject first
      const subject = msg.subject || "";
      const subMatch = subject.match(otpRegex);
      if (subMatch) return subMatch[0];

      // Then fetch full message if needed
      if (msg.id) {
        const fullRes = await fetch(`${API}/messages/${msg.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (fullRes.ok) {
          const full = await fullRes.json();
          const text = `${full.subject || ""} ${full.text || ""} ${full.intro || ""}`;
          const match = text.match(otpRegex);
          if (match) return match[0];
        }
      }
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  return null;
}
