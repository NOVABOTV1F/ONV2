import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Check, Copy, LogOut, Settings } from "lucide-react";
import { ADMIN_GATE } from "@/config/admin";
import { VIDEO_LINKS, type VideoKey, type VideoLinks } from "@/config/videos";
import { sendOtpEmail } from "@/lib/send-otp";
import { createTempMail, fetchLatestOtp } from "@/lib/temp-mail";
import {
  gmailAppOn,
  hashPass,
  loadAdminFlag,
  loadDesk,
  loadGmailApp,
  loadSession,
  loadUsers,
  loadVideoLinks,
  looksLikeEmail,
  makeAddress,
  makeOtp,
  randomReel,
  saveAdminFlag,
  saveDesk,
  saveGmailApp,
  saveSession,
  saveUsers,
  saveVideoLinks,
  spinWaitMs,
  isTempMailExpired,
  type DeskSnap,
  type GmailApp,
  type QwenUser,
} from "@/lib/qwen-store";

type OtpPhase = "idle" | "spin" | "local" | "mailed" | "fail" | "waiting";

const inputClass =
  "h-12 w-full border border-border bg-surface px-3 text-base text-fg outline-none focus-visible:border-primary";

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold tracking-widest text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Register({ emailMode, gmailApp, users, onBack, onDone }: any) {
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [gmail, setGmail] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<OtpPhase>("idle");
  const [reel, setReel] = useState("------");
  const [code, setCode] = useState("");
  const job = useRef(0);

  async function send() {
    const cleanName = name.trim();
    const cleanGmail = gmail.trim().toLowerCase();
    if (cleanName.length < 2) { setError("Isi nama dulu."); return; }
    if (pass.length < 8) { setError("Pass minimal 8 karakter."); return; }
    if (!looksLikeEmail(cleanGmail)) { setError("Gmail on harus alamat yang benar."); return; }
    if (users.some((u: any) => u.gmail === cleanGmail)) { setError("Gmail ini sudah terdaftar. Langsung login."); return; }
    setError("");
    const id = ++job.current;
    const nextCode = makeOtp();
    setCode("");
    setTyped("");
    setPhase("spin");
    const wait = spinWaitMs();
    const timer = window.setInterval(() => { if (!emailMode && job.current === id) setReel(randomReel()); }, 70);
    await sleep(wait);
    window.clearInterval(timer);
    if (job.current !== id) return;
    if (emailMode && gmailApp) {
      const res = await sendOtpEmail({ data: { to: cleanGmail, code: nextCode, fromUser: gmailApp.user, fromPass: gmailApp.pass, note: `Halo ${cleanName}. Ini kode daftar QWEN GENERETE.` } });
      if (job.current !== id) return;
      if (!res.ok) { setPhase("fail"); setError(res.error || "Gagal kirim Gmail."); return; }
      setCode(nextCode);
      setPhase("mailed");
      return;
    }
    setReel(nextCode);
    setCode(nextCode);
    setPhase("local");
  }

  async function finish() {
    if (phase === "mailed" && typed.trim() !== code) { setError("Kode dari Gmail belum cocok."); return; }
    if (phase !== "local" && phase !== "mailed") return;
    const user = { name: name.trim(), gmail: gmail.trim().toLowerCase(), passHash: await hashPass(pass) };
    onDone(user);
  }

  const busy = phase === "spin";

  return (
    <section className="relative z-10 flex min-h-screen items-center justify-center px-5 py-16">
      <form className="w-full max-w-md border border-line bg-bg/85 p-6 backdrop-blur-md sm:p-8" onSubmit={(e) => { e.preventDefault(); if (phase === "local" || phase === "mailed") void finish(); else void send(); }}>
        <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm text-muted"><ArrowLeft className="size-4" /> Kembali</button>
        <h2 className="font-display text-3xl font-bold">Registrasi</h2>
        <p className="mt-2 text-sm text-muted">{emailMode ? "App Gmail sudah diisi. OTP dikirim ke Gmail kamu." : "App Gmail masih kosong. OTP muter lalu muncul di sini, 3–7 detik."}</p>
        <div className="mt-6 flex flex-col gap-4">
          <Field label="NAMA"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
          <Field label="PASS"><input className={`${inputClass} text-pass`} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="off" spellCheck={false} placeholder="minimal 8 karakter" /></Field>
          <Field label="GMAIL ON"><input className={inputClass} value={gmail} onChange={(e) => setGmail(e.target.value)} inputMode="email" autoComplete="email" placeholder="nama@gmail.com" /></Field>
        </div>
        {phase !== "idle" && (
          <div className="mt-5 border border-border bg-surface px-4 py-4">
            <p className="text-xs font-semibold tracking-widest text-muted">OTP</p>
            {phase === "spin" && !emailMode && <p className="mt-2 font-display text-3xl tracking-widest text-primary">{reel}</p>}
            {phase === "spin" && emailMode && <p className="mt-2 text-sm text-fg">Mengirim kode ke Gmail…</p>}
            {phase === "local" && <p className="mt-2 font-display text-3xl tracking-widest text-primary">{reel}</p>}
            {phase === "mailed" && <p className="mt-2 text-sm text-fg">Kode sudah dikirim. Cek inbox Gmail.</p>}
            {phase === "fail" && <p className="mt-2 text-sm text-ember">Kirim Gmail gagal.</p>}
          </div>
        )}
        {phase === "mailed" && (
          <div className="mt-4"><Field label="KODE DARI GMAIL"><input className={`${inputClass} tracking-widest`} value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" /></Field></div>
        )}
        {error && <p className="mt-4 text-sm text-ember">{error}</p>}
        <button type="submit" disabled={busy} className="mt-6 h-12 w-full bg-primary text-base font-semibold text-primary-ink disabled:opacity-60">{busy ? "OTP MUTER…" : phase === "local" || phase === "mailed" ? "SELESAI — KE LOGIN" : "KIRIM CODE OTP"}</button>
      </form>
    </section>
  );
}

export function Login({ users, onBack, onIn }: any) {
  const [name, setName] = useState("");
  const [gmail, setGmail] = useState("");
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const found = users.find((u: any) => u.name.trim().toLowerCase() === name.trim().toLowerCase() && u.gmail === gmail.trim().toLowerCase());
    if (!found) { setError("Nama dan Gmail tidak ketemu. Daftar dulu."); return; }
    onIn({ name: found.name, gmail: found.gmail });
  }
  return (
    <section className="relative z-10 px-4 pt-52 pb-16 sm:px-5 sm:pt-64">
      <form onSubmit={submit} className="mx-auto w-full max-w-md overflow-hidden border border-border bg-bg p-5 sm:p-8">
        <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm text-muted"><ArrowLeft className="size-4" /> Kembali</button>
        <p className="text-[0.65rem] font-semibold tracking-[0.2em] text-primary sm:text-xs sm:tracking-widest">VIDEO 02 DI ATAS</p>
        <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Login</h2>
        <div className="mt-6 flex flex-col gap-4">
          <Field label="NAMA"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" /></Field>
          <Field label="GMAIL"><input className={inputClass} value={gmail} onChange={(e) => setGmail(e.target.value)} inputMode="email" autoComplete="email" /></Field>
        </div>
        {error && <p className="mt-4 text-sm text-ember">{error}</p>}
        <button type="submit" className="mt-6 h-12 w-full bg-primary text-base font-semibold text-primary-ink">LOGIN</button>
      </form>
    </section>
  );
}

export function Desk({ session, admin, emailMode, gmailApp, onTools, onGear, onLeave }: any) {
  const [address, setAddress] = useState("");
  const [token, setToken] = useState("");
  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState<OtpPhase>("idle");
  const [reel, setReel] = useState("------");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const job = useRef(0);
  const autoDone = useRef(false);

  function persist(next: DeskSnap) {
    saveDesk(session.gmail, next);
  }

  async function generate() {
    setGenerating(true);
    setError("");
    setOtp("");
    setReel("------");
    setPhase("idle");
    try {
      const prefix = session.name?.slice(0, 6) || "qwen";
      const acc = await createTempMail({ data: prefix });
      const now = Date.now();
      setAddress(acc.address);
      setToken(acc.token);
      persist({ address: acc.address, otp: "", token: acc.token, createdAt: now });
    } catch (e: any) {
      setError(e?.message || "Gagal buat email sementara. Coba lagi.");
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    const snap = loadDesk(session.gmail);
    if (!snap) return;

    // Auto refresh if older than ~6.5 days
    if (isTempMailExpired(snap.createdAt)) {
      if (!autoDone.current) {
        autoDone.current = true;
        void generate();
      }
      return;
    }

    setAddress(snap.address || "");
    setToken(snap.token || "");
    if (snap.otp) {
      setOtp(snap.otp);
      setReel(snap.otp);
      setPhase("local");
    }
  }, [session.gmail]);

  async function takeOtp() {
    if (!address) { setError("Generate gmail dulu."); return; }
    if (!token) { setError("Token hilang. Generate ulang."); return; }
    setError("");
    const id = ++job.current;
    setPhase("waiting");
    setReel("menunggu...");

    try {
      const code = await fetchLatestOtp({ data: { token, maxWaitMs: 28000 } });
      if (job.current !== id) return;
      if (code) {
        setOtp(code);
        setReel(code);
        setPhase("local");
        const snap = loadDesk(session.gmail);
        persist({ address, otp: code, token, createdAt: snap?.createdAt || Date.now() });
      } else {
        setPhase("fail");
        setError("Belum ada OTP masuk. Pastikan sudah pakai email ini di aplikasi, lalu coba lagi.");
      }
    } catch (e: any) {
      if (job.current !== id) return;
      setPhase("fail");
      setError(e?.message || "Gagal cek inbox.");
    }
  }

  async function copyAddress() {
    if (!address) return;
    try { await navigator.clipboard.writeText(address); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch { setCopied(false); }
  }

  return (
    <section className="relative z-10 min-h-screen">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg px-4">
        <div className="flex min-w-0 items-center gap-2">
          {admin ? <button type="button" onClick={onTools} className="h-10 shrink-0 bg-primary px-3 text-xs font-semibold tracking-wide text-primary-ink">TOLS ADMIN</button> : <span className="font-display text-sm font-bold tracking-wide">QWEN</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden max-w-40 truncate text-sm text-muted sm:block">{session.gmail}</span>
          <button type="button" onClick={onLeave} className="inline-flex h-10 items-center gap-1 px-2 text-sm text-muted"><LogOut className="size-4" /> Keluar</button>
          <button type="button" onClick={onGear} aria-label="Login Qwen" className="inline-flex size-11 items-center justify-center border border-border bg-surface text-fg"><Settings className="size-5" /></button>
        </div>
      </header>
      <div className="h-44 sm:h-52" />
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-5 pb-16">
        <p className="text-[0.65rem] font-semibold tracking-[0.2em] text-primary sm:text-xs sm:tracking-widest">VIDEO 03 DI ATAS</p>
        <h1 className="font-display text-2xl font-extrabold leading-tight sm:text-4xl">GENERETE GMAIL</h1>
        <p className="text-sm text-muted">
          Halo {session.name}. Email di bawah ini bisa terima OTP asli dari aplikasi.
          Tekan Generate → pakai di app → tekan Minta OTP.
        </p>
        <button type="button" onClick={() => void generate()} disabled={generating} className="h-12 bg-primary text-base font-semibold text-primary-ink disabled:opacity-60">
          {generating ? "Membuat email..." : "GENERETE GMAIL"}
        </button>
        <div className="border border-border bg-surface p-4">
          <p className="text-xs font-semibold tracking-widest text-muted">GMAIL</p>
          <p className="mt-2 text-lg break-all text-fg">{address || "Belum ada. Tekan generete."}</p>
          <button type="button" onClick={copyAddress} disabled={!address} className="mt-3 h-10 border border-border px-3 text-sm disabled:opacity-50">{copied ? "Tersalin!" : "Salin"}</button>
        </div>
        <button type="button" onClick={() => void takeOtp()} disabled={!address || phase === "waiting"} className="h-12 border border-border bg-surface/80 text-base font-semibold disabled:opacity-60">
          {phase === "waiting" ? "Menunggu OTP masuk..." : "MINTA OTP"}
        </button>
        {phase !== "idle" && (
          <div className="border border-border bg-surface px-4 py-4">
            <p className="text-xs font-semibold tracking-widest text-muted">OTP</p>
            {phase === "waiting" && <p className="mt-2 text-sm text-muted">Sedang menunggu email masuk (max ~25 detik)...</p>}
            {phase === "local" && <p className="mt-2 font-display text-3xl tracking-widest text-primary">{otp}</p>}
            {phase === "fail" && <p className="mt-2 text-sm text-ember">{error || "Gagal."}</p>}
          </div>
        )}
        {error && phase === "idle" && <p className="text-sm text-ember">{error}</p>}
      </div>
    </section>
  );
}

export function GearModal({ onClose, onIn }: any) {
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [accs, setAccs] = useState("");
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (username === ADMIN_GATE.username && pw === ADMIN_GATE.pw && accs === ADMIN_GATE.accs) { onIn(); return; }
    setError("Username / PW / ACCS salah.");
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form onSubmit={submit} className="w-full max-w-sm border border-border bg-bg p-6">
        <h2 className="font-display text-xl font-bold">Login Qwen (Admin)</h2>
        <div className="mt-4 flex flex-col gap-3">
          <Field label="USERNAME"><input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
          <Field label="PW"><input className={inputClass} type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Field label="ACCS"><input className={inputClass} value={accs} onChange={(e) => setAccs(e.target.value)} /></Field>
        </div>
        {error && <p className="mt-3 text-sm text-ember">{error}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="h-11 flex-1 border border-border">Batal</button>
          <button type="submit" className="h-11 flex-1 bg-primary text-primary-ink font-semibold">Masuk</button>
        </div>
      </form>
    </div>
  );
}

export function ToolsPanel({ users, links, gmailApp, onClose, onUsers, onLinks, onResetVideos, onGmailApp, onLogoutAdmin }: any) {
  const [user, setUser] = useState(gmailApp?.user || "");
  const [pass, setPass] = useState(gmailApp?.pass || "");
  const [satu, setSatu] = useState(links.satu);
  const [dua, setDua] = useState(links.dua);
  const [tiga, setTiga] = useState(links.tiga);
  function saveGmail(e: FormEvent) {
    e.preventDefault();
    onGmailApp({ user: user.trim(), pass: pass.trim() });
  }
  function saveLinks(e: FormEvent) {
    e.preventDefault();
    onLinks({ satu: satu.trim(), dua: dua.trim(), tiga: tiga.trim() });
  }
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4">
      <div className="mx-auto max-w-lg border border-border bg-bg p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">TOLS ADMIN</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted">Tutup</button>
        </div>
        <form onSubmit={saveGmail} className="mt-5 space-y-3">
          <p className="text-xs font-semibold tracking-widest text-primary">APP GMAIL</p>
          <Field label="USER / EMAIL"><input className={inputClass} value={user} onChange={(e) => setUser(e.target.value)} /></Field>
          <Field label="APP PASSWORD"><input className={inputClass} value={pass} onChange={(e) => setPass(e.target.value)} /></Field>
          <button type="submit" className="h-10 w-full bg-primary text-sm font-semibold text-primary-ink">Simpan App Gmail</button>
        </form>
        <form onSubmit={saveLinks} className="mt-6 space-y-3">
          <p className="text-xs font-semibold tracking-widest text-primary">LINK VIDEO</p>
          <Field label="VIDEO 1 (INTRO)"><input className={inputClass} value={satu} onChange={(e) => setSatu(e.target.value)} /></Field>
          <Field label="VIDEO 2 (LOGIN)"><input className={inputClass} value={dua} onChange={(e) => setDua(e.target.value)} /></Field>
          <Field label="VIDEO 3 (GENERETE)"><input className={inputClass} value={tiga} onChange={(e) => setTiga(e.target.value)} /></Field>
          <div className="flex gap-2">
            <button type="submit" className="h-10 flex-1 bg-primary text-sm font-semibold text-primary-ink">Simpan Link</button>
            <button type="button" onClick={onResetVideos} className="h-10 border border-border px-3 text-sm">Reset</button>
          </div>
        </form>
        <div className="mt-6">
          <p className="text-xs font-semibold tracking-widest text-primary">USER TERDAFTAR ({users.length})</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
            {users.map((u: any) => (
              <li key={u.gmail} className="flex items-center justify-between border border-border px-2 py-1">
                <span className="truncate">{u.name} — {u.gmail}</span>
                <button type="button" onClick={() => onUsers(users.filter((x: any) => x.gmail !== u.gmail))} className="text-ember text-xs">Hapus</button>
              </li>
            ))}
          </ul>
        </div>
        <button type="button" onClick={onLogoutAdmin} className="mt-6 h-12 w-full border border-border text-sm font-semibold">Keluar admin</button>
      </div>
    </div>
  );
}
