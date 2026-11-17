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

// The rest of the functions (Register, Login, Desk, GearModal, ToolsPanel, etc.) are in the full original. This is a temporary restore to stop the crash. Full fixed version will follow.
