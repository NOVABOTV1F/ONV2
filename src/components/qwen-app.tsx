import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Check, Copy, LogOut, Settings } from "lucide-react";
import { ADMIN_GATE } from "@/config/admin";
import { VIDEO_LINKS, type VideoKey, type VideoLinks } from "@/config/videos";
import { sendOtpEmail } from "@/lib/send-otp";
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
  type DeskSnap,
  type GmailApp,
  type QwenUser,
} from "@/lib/qwen-store";

type View = "intro" | "register" | "login" | "desk";
type OtpPhase = "idle" | "spin" | "local" | "mailed" | "fail";

const PARK = "pointer-events-none fixed top-0 left-0 -z-10 h-px w-px opacity-0";

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function QwenApp() {
  const [view, setView] = useState<View>("intro");
  const [sound, setSound] = useState(false);
  const [links, setLinks] = useState<VideoLinks>(VIDEO_LINKS);
  const [users, setUsers] = useState<QwenUser[]>([]);
  const [session, setSession] = useState<{ name: string; gmail: string } | null>(null);
  const [gmailApp, setGmailApp] = useState<GmailApp | null>(null);
  const [admin, setAdmin] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [broken, setBroken] = useState<Partial<Record<VideoKey, boolean>>>({});

  useEffect(() => {
    setLinks(loadVideoLinks());
    setUsers(loadUsers());
    setSession(loadSession());
    setGmailApp(loadGmailApp());
    setAdmin(loadAdminFlag());
  }, []);

  function unlock() {
    setSound(true);
  }

  const emailMode = gmailAppOn(gmailApp);

  return (
    <main className="min-h-screen bg-bg text-fg" onPointerDown={unlock}>
      <PoolVideo
        src={links.satu}
        sound={sound}
        broken={broken.satu}
        onBroken={() => setBroken((b) => ({ ...b, satu: true }))}
        className={
          view === "intro" || view === "register"
            ? "fixed inset-0 z-0 h-full w-full object-cover"
            : PARK
        }
      />
      <PoolVideo
        src={links.dua}
        sound={sound}
        broken={broken.dua}
        onBroken={() => setBroken((b) => ({ ...b, dua: true }))}
        className={view === "login" ? "fixed inset-x-0 top-0 z-0 h-52 w-full object-cover sm:h-64" : PARK}
      />
      <PoolVideo
        src={links.tiga}
        sound={sound}
        broken={broken.tiga}
        onBroken={() => setBroken((b) => ({ ...b, tiga: true }))}
        className={view === "desk" ? "fixed inset-x-0 top-14 z-0 h-48 w-full object-cover sm:h-60" : PARK}
      />

      {view !== "desk" ? (
        <button
          type="button"
          aria-label="Login Qwen"
          onClick={() => (admin ? setToolsOpen(true) : setGearOpen(true))}
          className="fixed top-4 right-4 z-30 inline-flex size-11 items-center justify-center border border-border bg-bg/80 text-fg"
        >
          <Settings className="size-5" />
        </button>
      ) : null}

      {admin && view !== "desk" ? (
        <button
          type="button"
          onClick={() => setToolsOpen(true)}
          className="fixed top-4 left-4 z-30 h-11 bg-primary px-3 text-xs font-semibold text-primary-ink"
        >
          TOLS ADMIN
        </button>
      ) : null}

      {view === "intro" ? (
        <Intro
          sound={sound}
          hasSession={Boolean(session)}
          onLogin={() => setView(session ? "desk" : "login")}
          onRegister={() => setView("register")}
        />
      ) : null}

      {view === "register" ? (
        <Register
          emailMode={emailMode}
          gmailApp={gmailApp}
          users={users}
          onBack={() => setView("intro")}
          onDone={(user) => {
            const next = [...users.filter((u) => u.gmail !== user.gmail), user];
            setUsers(next);
            saveUsers(next);
            setView("login");
          }}
        />
      ) : null}

      {view === "login" ? (
        <Login
          users={users}
          onBack={() => setView("intro")}
          onIn={(next) => {
            setSession(next);
            saveSession(next);
            setView("desk");
          }}
        />
      ) : null}

      {view === "desk" && session ? (
        <Desk
          session={session}
          admin={admin}
          emailMode={emailMode}
          gmailApp={gmailApp}
          onTools={() => setToolsOpen(true)}
          onGear={() => (admin ? setToolsOpen(true) : setGearOpen(true))}
          onLeave={() => {
            setSession(null);
            saveSession(null);
            setView("intro");
          }}
        />
      ) : null}

      {gearOpen ? (
        <GearModal
          onClose={() => setGearOpen(false)}
          onIn={() => {
            setAdmin(true);
            saveAdminFlag(true);
            setGearOpen(false);
            setToolsOpen(true);
          }}
        />
      ) : null}

      {toolsOpen ? (
        <ToolsPanel
          users={users}
          links={links}
          gmailApp={gmailApp}
          onClose={() => setToolsOpen(false)}
          onUsers={(next) => {
            setUsers(next);
            saveUsers(next);
          }}
          onLinks={(next) => {
            setLinks(next);
            saveVideoLinks(next);
            setBroken({});
          }}
          onResetVideos={() => {
            setLinks({ ...VIDEO_LINKS });
            saveVideoLinks(null);
            setBroken({});
          }}
          onGmailApp={(next) => {
            setGmailApp(next);
            saveGmailApp(next);
          }}
          onLogoutAdmin={() => {
            setAdmin(false);
            saveAdminFlag(false);
            setToolsOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}

function PoolVideo({
  src,
  sound,
  className,
  broken,
  onBroken,
}: {
  src: string;
  sound: boolean;
  className: string;
  broken?: boolean;
  onBroken: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || broken) return;
    const fail = () => onBroken();
    node.addEventListener("error", fail);
    if (node.error) fail();
    node.muted = !sound;
    const pending = node.play();
    if (pending) {
      void pending.catch(() => {
        node.muted = true;
        void node.play().catch(() => undefined);
      });
    }
    return () => node.removeEventListener("error", fail);
  }, [sound, src, broken]);

  if (broken || !src) {
    return (
      <div className={`${className} bg-surface`} aria-hidden="true">
        <div className="flex h-full items-end p-4 text-sm text-muted">Video belum bisa diputar. Ganti link di file video atau TOLS ADMIN.</div>
      </div>
    );
  }

  return (
    <video
      ref={ref}
      className={className}
      src={src}
      autoPlay
      loop
      muted={!sound}
      playsInline
      preload="auto"
      onError={onBroken}
    />
  );
}

function Intro({
  sound,
  hasSession,
  onLogin,
  onRegister,
}: {
  sound: boolean;
  hasSession: boolean;
  onLogin: () => void;
  onRegister: () => void;
}) {
  return (
    <section className="relative z-10 flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-md border border-line bg-bg/80 p-6 shadow-none backdrop-blur-md sm:p-8">
        <p className="text-xs font-semibold tracking-widest text-primary">MESIN OTP</p>
        <h1 className="mt-3 font-display text-4xl leading-none font-extrabold sm:text-5xl">
          QWEN
          <span className="block text-primary">GENERETE</span>
        </h1>
        <p className="mt-4 max-w-sm text-sm text-muted">
          {sound
            ? "Suara video nyala. Login dan registrasi langsung di sini."
            : "Klik di mana saja — suara video ikut nyala, termasuk di halaman login."}
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={onLogin}
            className="h-12 bg-primary text-base font-semibold text-primary-ink"
          >
            {hasSession ? "LANJUT" : "LOGIN"}
          </button>
          <button
            type="button"
            onClick={onRegister}
            className="h-12 border border-border bg-surface/80 text-base font-semibold text-fg"
          >
            REGISTRASI
          </button>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold tracking-widest text-muted">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "h-12 w-full border border-border bg-surface px-3 text-base text-fg outline-none focus-visible:border-primary";

function Register({
  emailMode,
  gmailApp,
  users,
  onBack,
  onDone,
}: {
  emailMode: boolean;
  gmailApp: GmailApp | null;
  users: QwenUser[];
  onBack: () => void;
  onDone: (user: QwenUser) => void;
}) {
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
    if (cleanName.length < 2) {
      setError("Isi nama dulu.");
      return;
    }
    if (pass.length < 8) {
      setError("Pass minimal 8 karakter.");
      return;
    }
    if (!looksLikeEmail(cleanGmail)) {
      setError("Gmail on harus alamat yang benar.");
      return;
    }
    if (users.some((u) => u.gmail === cleanGmail)) {
      setError("Gmail ini sudah terdaftar. Langsung login.");
      return;
    }
    setError("");
    const id = ++job.current;
    const nextCode = makeOtp();
    setCode("");
    setTyped("");
    setPhase("spin");
    const wait = spinWaitMs();
    const timer = window.setInterval(() => {
      if (!emailMode && job.current === id) setReel(randomReel());
    }, 70);
    await sleep(wait);
    window.clearInterval(timer);
    if (job.current !== id) return;

    if (emailMode && gmailApp) {
      const res = await sendOtpEmail({
        data: {
          to: cleanGmail,
          code: nextCode,
          fromUser: gmailApp.user,
          fromPass: gmailApp.pass,
          note: `Halo ${cleanName}. Ini kode daftar QWEN GENERETE.`,
        },
      });
      if (job.current !== id) return;
      if (!res.ok) {
        setPhase("fail");
        setError(res.error || "Gagal kirim Gmail. OTP layar tetap mati karena App Gmail sudah diisi.");
        return;
      }
      setCode(nextCode);
      setPhase("mailed");
      return;
    }

    setReel(nextCode);
    setCode(nextCode);
    setPhase("local");
  }

  async function finish() {
    if (phase === "mailed" && typed.trim() !== code) {
      setError("Kode dari Gmail belum cocok.");
      return;
    }
    if (phase !== "local" && phase !== "mailed") return;
    const user: QwenUser = {
      name: name.trim(),
      gmail: gmail.trim().toLowerCase(),
      passHash: await hashPass(pass),
    };
    onDone(user);
  }

  const busy = phase === "spin";

  return (
    <section className="relative z-10 flex min-h-screen items-center justify-center px-5 py-16">
      <form
        className="w-full max-w-md border border-line bg-bg/85 p-6 backdrop-blur-md sm:p-8"
        onSubmit={(event) => {
          event.preventDefault();
          if (phase === "local" || phase === "mailed") void finish();
          else void send();
        }}
      >
        <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm text-muted">
          <ArrowLeft className="size-4" />
          Kembali
        </button>
        <h2 className="font-display text-3xl font-bold">Registrasi</h2>
        <p className="mt-2 text-sm text-muted">
          {emailMode
            ? "App Gmail sudah diisi. OTP tidak muncul di sini — dikirim ke Gmail kamu."
            : "App Gmail masih kosong. OTP muter lalu muncul di sini, sekitar 3–7 detik."}
        </p>
        <div className="mt-6 flex flex-col gap-4">
          <Field label="NAMA">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
          <Field label="PASS">
            <input
              className={`${inputClass} text-pass`}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="minimal 8 karakter, tetap bisa dibaca"
            />
          </Field>
          <Field label="GMAIL ON">
            <input
              className={inputClass}
              value={gmail}
              onChange={(e) => setGmail(e.target.value)}
              inputMode="email"
              autoComplete="email"
              placeholder="nama@gmail.com"
            />
          </Field>
        </div>

        <OtpReadout phase={phase} reel={reel} emailMode={emailMode} />

        {phase === "mailed" ? (
          <div className="mt-4">
            <Field label="KODE DARI GMAIL">
              <input
                className={`${inputClass} tracking-widest`}
                value={typed}
                onChange={(e) => setTyped(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </Field>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-ember">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 h-12 w-full bg-primary text-base font-semibold text-primary-ink disabled:opacity-60"
        >
          {busy ? "OTP MUTER…" : phase === "local" || phase === "mailed" ? "SELESAI — KE LOGIN" : "KIRIM CODE OTP"}
        </button>
      </form>
    </section>
  );
}

function OtpReadout({ phase, reel, emailMode }: { phase: OtpPhase; reel: string; emailMode: boolean }) {
  if (phase === "idle") return null;
  return (
    <div className="mt-5 border border-border bg-surface px-4 py-4">
      <p className="text-xs font-semibold tracking-widest text-muted">OTP</p>
      {phase === "spin" && !emailMode ? (
        <p className="mt-2 font-display text-3xl tracking-widest text-primary">{reel}</p>
      ) : null}
      {phase === "spin" && emailMode ? <p className="mt-2 text-sm text-fg">Mengirim kode ke Gmail…</p> : null}
      {phase === "local" ? <p className="mt-2 font-display text-3xl tracking-widest text-primary">{reel}</p> : null}
      {phase === "mailed" ? (
        <p className="mt-2 text-sm text-fg">Kode sudah dikirim. Cek inbox Gmail, lalu ketik di bawah. Tidak ditampilkan di layar.</p>
      ) : null}
      {phase === "fail" ? <p className="mt-2 text-sm text-ember">Kirim Gmail gagal. OTP layar tidak dinyalakan.</p> : null}
    </div>
  );
}

function Login({
  users,
  onBack,
  onIn,
}: {
  users: QwenUser[];
  onBack: () => void;
  onIn: (session: { name: string; gmail: string }) => void;
}) {
  const [name, setName] = useState("");
  const [gmail, setGmail] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = users.find(
      (u) => u.name.trim().toLowerCase() === name.trim().toLowerCase() && u.gmail === gmail.trim().toLowerCase(),
    );
    if (!found) {
      setError("Nama dan Gmail tidak ketemu. Daftar dulu.");
      return;
    }
    onIn({ name: found.name, gmail: found.gmail });
  }

  return (
    <section className="relative z-10 px-5 pt-56 pb-16 sm:pt-72">
      <form onSubmit={submit} className="mx-auto w-full max-w-md border border-border bg-bg p-6 sm:p-8">
        <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm text-muted">
          <ArrowLeft className="size-4" />
          Kembali
        </button>
        <p className="text-xs font-semibold tracking-widest text-primary">VIDEO 02 DI ATAS</p>
        <h2 className="mt-2 font-display text-3xl font-bold">Login</h2>
        <div className="mt-6 flex flex-col gap-4">
          <Field label="NAMA">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" />
          </Field>
          <Field label="GMAIL">
            <input
              className={inputClass}
              value={gmail}
              onChange={(e) => setGmail(e.target.value)}
              inputMode="email"
              autoComplete="email"
            />
          </Field>
        </div>
        {error ? <p className="mt-4 text-sm text-ember">{error}</p> : null}
        <button type="submit" className="mt-6 h-12 w-full bg-primary text-base font-semibold text-primary-ink">
          LOGIN
        </button>
      </form>
    </section>
  );
}

function Desk({
  session,
  admin,
  emailMode,
  gmailApp,
  onTools,
  onGear,
  onLeave,
}: {
  session: { name: string; gmail: string };
  admin: boolean;
  emailMode: boolean;
  gmailApp: GmailApp | null;
  onTools: () => void;
  onGear: () => void;
  onLeave: () => void;
}) {
  const [address, setAddress] = useState("");
  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState<OtpPhase>("idle");
  const [reel, setReel] = useState("------");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const job = useRef(0);

  useEffect(() => {
    const snap = loadDesk(session.gmail);
    if (!snap) return;
    setAddress(snap.address);
    if (snap.otp && !emailMode) {
      setOtp(snap.otp);
      setReel(snap.otp);
      setPhase("local");
    }
  }, [session.gmail, emailMode]);

  function persist(next: DeskSnap | null) {
    saveDesk(session.gmail, next);
  }

  function generate() {
    job.current += 1;
    const next = makeAddress(session.name);
    setAddress(next);
    setOtp("");
    setReel("------");
    setPhase("idle");
    setError("");
    persist({ address: next, otp: "" });
  }

  async function takeOtp() {
    if (!address) return;
    const id = ++job.current;
    const nextCode = makeOtp();
    setError("");
    setPhase("spin");
    setOtp("");
    const wait = spinWaitMs();
    const timer = window.setInterval(() => {
      if (job.current === id) setReel(randomReel());
    }, 70);
    await sleep(wait);
    window.clearInterval(timer);
    if (job.current !== id) return;

    if (emailMode && gmailApp) {
      const res = await sendOtpEmail({
        data: {
          to: session.gmail,
          code: nextCode,
          fromUser: gmailApp.user,
          fromPass: gmailApp.pass,
          note: `OTP untuk alamat ${address}.`,
        },
      });
      if (job.current !== id) return;
      if (!res.ok) {
        setPhase("fail");
        setError(res.error || "Gagal kirim. Kotak OTP tetap kosong.");
        persist({ address, otp: "" });
        return;
      }
      setPhase("mailed");
      persist({ address, otp: "" });
      return;
    }

    setReel(nextCode);
    setOtp(nextCode);
    setPhase("local");
    persist({ address, otp: nextCode });
  }

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="relative z-10 min-h-screen">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg px-4">
        <div className="flex min-w-0 items-center gap-2">
          {admin ? (
            <button
              type="button"
              onClick={onTools}
              className="h-10 shrink-0 bg-primary px-3 text-xs font-semibold tracking-wide text-primary-ink"
            >
              TOLS ADMIN
            </button>
          ) : (
            <span className="font-display text-sm font-bold tracking-wide">QWEN</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden max-w-40 truncate text-sm text-muted sm:block">{session.gmail}</span>
          <button type="button" onClick={onLeave} className="inline-flex h-10 items-center gap-1 px-2 text-sm text-muted">
            <LogOut className="size-4" />
            Keluar
          </button>
          <button
            type="button"
            onClick={onGear}
            aria-label="Login Qwen"
            className="inline-flex size-11 items-center justify-center border border-border bg-surface text-fg"
          >
            <Settings className="size-5" />
          </button>
        </div>
      </header>

      <div className="h-48 sm:h-60" />

      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-5 pb-16">
        <p className="text-xs font-semibold tracking-widest text-primary">VIDEO 03 DI ATAS</p>
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">GENERETE GMAIL</h1>
        <p className="text-sm text-muted">
          Halo {session.name}. Ambil alamatnya, pakai, lalu minta OTP.
          {emailMode
            ? " App Gmail aktif — OTP tidak ditulis di kotak, dikirim ke Gmail akunmu."
            : " App Gmail kosong — OTP muncul sendiri di kotak bawah, 3–7 detik."}
        </p>

        <button type="button" onClick={generate} className="h-12 bg-primary text-base font-semibold text-primary-ink">
          GENERETE GMAIL
        </button>

        <div className="border border-border bg-surface p-4">
          <p className="text-xs font-semibold tracking-widest text-muted">GMAIL</p>
          <p className="mt-2 text-lg break-all text-fg">{address || "Belum ada. Tekan generete."}</p>
          <button
            type="button"
            onClick={() => void copyAddress()}
            disabled={!address}
            className="mt-3 inline-flex h-10 items-center gap-2 text-sm font-semibold text-primary disabled:opacity-40"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Tersalin" : "Salin"}
          </button>
        </div>

        <div className="min-h-28 border border-dashed border-line bg-bg px-4 py-4">
          <p className="text-xs font-semibold tracking-widest text-muted">KOTAK OTP</p>
          {phase === "idle" ? <p className="mt-3 text-sm text-muted">Kosong. Isi setelah alamatnya kamu pakai.</p> : null}
          {phase === "spin" && !emailMode ? (
            <p className="mt-3 font-display text-3xl tracking-widest text-primary">{reel}</p>
          ) : null}
          {phase === "spin" && emailMode ? <p className="mt-3 text-sm">Mengirim OTP ke {session.gmail}…</p> : null}
          {phase === "local" ? <p className="mt-3 font-display text-4xl tracking-widest text-primary">{otp}</p> : null}
          {phase === "mailed" ? (
            <p className="mt-3 text-sm text-fg">OTP tidak ditampilkan. Cek Gmail {session.gmail}.</p>
          ) : null}
          {phase === "fail" ? <p className="mt-3 text-sm text-ember">Kirim gagal. Kotak tetap kosong.</p> : null}
        </div>

        {error ? <p className="text-sm text-ember">{error}</p> : null}

        <button
          type="button"
          onClick={() => void takeOtp()}
          disabled={!address || phase === "spin"}
          className="h-12 border border-primary text-base font-semibold text-primary disabled:opacity-40"
        >
          {phase === "spin" ? "MENUNGGU OTP…" : "SUDAH DIPAKAI — AMBIL OTP"}
        </button>
      </div>
    </section>
  );
}

function GearModal({ onClose, onIn }: { onClose: () => void; onIn: () => void }) {
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [accs, setAccs] = useState("");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const ok = username === ADMIN_GATE.username && pw === ADMIN_GATE.pw && accs === ADMIN_GATE.accs;
    if (!ok) {
      setError("Tidak cocok.");
      return;
    }
    onIn();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/70 px-5">
      <form onSubmit={submit} className="w-full max-w-md border border-line bg-surface p-6">
        <h2 className="font-display text-2xl font-bold">Login Qwen</h2>
        <p className="mt-2 text-sm text-muted">Masukan username, pw, dan accs.</p>
        <div className="mt-5 flex flex-col gap-4">
          <Field label="USERNAME">
            <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="PW">
            <input className={inputClass} value={pw} onChange={(e) => setPw(e.target.value)} type="password" autoComplete="off" />
          </Field>
          <Field label="ACCS">
            <input className={inputClass} value={accs} onChange={(e) => setAccs(e.target.value)} autoComplete="off" />
          </Field>
        </div>
        {error ? <p className="mt-4 text-sm text-ember">{error}</p> : null}
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} className="h-12 flex-1 border border-border text-sm font-semibold">
            Batal
          </button>
          <button type="submit" className="h-12 flex-1 bg-primary text-sm font-semibold text-primary-ink">
            Masuk
          </button>
        </div>
      </form>
    </div>
  );
}

function ToolsPanel({
  users,
  links,
  gmailApp,
  onClose,
  onUsers,
  onLinks,
  onResetVideos,
  onGmailApp,
  onLogoutAdmin,
}: {
  users: QwenUser[];
  links: VideoLinks;
  gmailApp: GmailApp | null;
  onClose: () => void;
  onUsers: (users: QwenUser[]) => void;
  onLinks: (links: VideoLinks) => void;
  onResetVideos: () => void;
  onGmailApp: (app: GmailApp | null) => void;
  onLogoutAdmin: () => void;
}) {
  const [sender, setSender] = useState(gmailApp?.user ?? "");
  const [appPass, setAppPass] = useState(gmailApp?.pass ?? "");
  const [draft, setDraft] = useState<VideoLinks>(links);
  const [note, setNote] = useState("");

  function saveGmail(event: FormEvent) {
    event.preventDefault();
    if (!sender.trim() && !appPass.trim()) {
      onGmailApp(null);
      setNote("App Gmail dikosongkan. OTP otomatis muncul lagi di layar.");
      return;
    }
    if (!looksLikeEmail(sender) || appPass.replace(/\s+/g, "").length < 8) {
      setNote("Isi Gmail pengirim dan app password (minimal 8). Atau kosongkan keduanya.");
      return;
    }
    onGmailApp({ user: sender.trim(), pass: appPass });
    setNote("App Gmail tersimpan di browser ini. OTP layar mati, kode dikirim lewat Gmail.");
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-bg/80">
      <div className="mx-auto min-h-screen w-full max-w-lg bg-bg px-5 py-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold">TOLS ADMIN</h2>
          <button type="button" onClick={onClose} className="h-10 px-3 text-sm text-muted">
            Tutup
          </button>
        </div>

        <form onSubmit={saveGmail} className="mt-6 border border-border p-4">
          <h3 className="font-display text-lg font-bold">App Gmail</h3>
          <p className="mt-2 text-sm text-muted">
            Kosong: OTP muter di layar 3–7 detik. Diisi: OTP layar mati dan dikirim dari Gmail ini (pakai App Password, bukan password biasa).
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <Field label="GMAIL PENGIRIM">
              <input className={inputClass} value={sender} onChange={(e) => setSender(e.target.value)} inputMode="email" />
            </Field>
            <Field label="APP PASSWORD">
              <input
                className={inputClass}
                value={appPass}
                onChange={(e) => setAppPass(e.target.value)}
                type="password"
                autoComplete="off"
              />
            </Field>
          </div>
          <div className="mt-4 flex gap-3">
            <button type="submit" className="h-11 flex-1 bg-primary text-sm font-semibold text-primary-ink">
              Simpan
            </button>
            <button
              type="button"
              onClick={() => {
                setSender("");
                setAppPass("");
                onGmailApp(null);
                setNote("Mode OTP layar nyala lagi.");
              }}
              className="h-11 flex-1 border border-border text-sm font-semibold"
            >
              Matikan
            </button>
          </div>
          {note ? <p className="mt-3 text-sm text-primary">{note}</p> : null}
        </form>

        <form
          className="mt-4 border border-border p-4"
          onSubmit={(event) => {
            event.preventDefault();
            onLinks({
              satu: draft.satu.trim() || VIDEO_LINKS.satu,
              dua: draft.dua.trim() || VIDEO_LINKS.dua,
              tiga: draft.tiga.trim() || VIDEO_LINKS.tiga,
            });
            setNote("Link video diganti.");
          }}
        >
          <h3 className="font-display text-lg font-bold">Link video</h3>
          <p className="mt-2 text-sm text-muted">File aslinya tetap di config video. Ini menimpa untuk browser ini.</p>
          {(["satu", "dua", "tiga"] as const).map((key) => (
            <div key={key} className="mt-4">
              <Field label={`VIDEO ${key.toUpperCase()}`}>
                <input
                  className={inputClass}
                  value={draft[key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                />
              </Field>
            </div>
          ))}
          <div className="mt-4 flex gap-3">
            <button type="submit" className="h-11 flex-1 bg-primary text-sm font-semibold text-primary-ink">
              Pakai link
            </button>
            <button type="button" onClick={onResetVideos} className="h-11 flex-1 border border-border text-sm font-semibold">
              Reset file
            </button>
          </div>
        </form>

        <div className="mt-4 border border-border p-4">
          <h3 className="font-display text-lg font-bold">Akun</h3>
          {users.length === 0 ? <p className="mt-3 text-sm text-muted">Belum ada yang daftar.</p> : null}
          <ul className="mt-3 flex flex-col gap-3">
            {users.map((user) => (
              <li key={user.gmail} className="flex items-center justify-between gap-3 border border-border px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{user.name}</p>
                  <p className="truncate text-sm text-muted">{user.gmail}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onUsers(users.filter((u) => u.gmail !== user.gmail))}
                  className="h-10 shrink-0 px-2 text-sm text-ember"
                >
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        </div>

        <button type="button" onClick={onLogoutAdmin} className="mt-6 h-12 w-full border border-border text-sm font-semibold">
          Keluar admin
        </button>
      </div>
    </div>
  );
}
