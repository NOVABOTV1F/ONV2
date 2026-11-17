import { useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import { VIDEO_LINKS, type VideoKey, type VideoLinks } from "@/config/videos";
import {
  gmailAppOn,
  loadAdminFlag,
  loadGmailApp,
  loadSession,
  loadUsers,
  loadVideoLinks,
  saveAdminFlag,
  saveGmailApp,
  saveSession,
  saveUsers,
  saveVideoLinks,
  type GmailApp,
  type QwenUser,
} from "@/lib/qwen-store";
import { Register, Login, Desk, GearModal, ToolsPanel } from "./qwen-parts";

type View = "intro" | "register" | "login" | "desk";

const PARK = "pointer-events-none fixed top-0 left-0 -z-10 h-px w-px opacity-0";

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
        active={view === "intro" || view === "register"}
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
        active={view === "login"}
        broken={broken.dua}
        onBroken={() => setBroken((b) => ({ ...b, dua: true }))}
        className={view === "login" ? "fixed inset-x-0 top-0 z-0 h-48 w-full object-cover sm:h-56" : PARK}
      />
      <PoolVideo
        src={links.tiga}
        sound={sound}
        active={view === "desk"}
        broken={broken.tiga}
        onBroken={() => setBroken((b) => ({ ...b, tiga: true }))}
        className={view === "desk" ? "fixed inset-x-0 top-14 z-0 h-44 w-full object-cover sm:h-52" : PARK}
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
  active,
  className,
  broken,
  onBroken,
}: {
  src: string;
  sound: boolean;
  active: boolean;
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

    if (active) {
      const pending = node.play();
      if (pending) {
        void pending.catch(() => {
          node.muted = true;
          void node.play().catch(() => undefined);
        });
      }
    } else {
      node.pause();
    }

    return () => node.removeEventListener("error", fail);
  }, [sound, src, broken, active]);

  if (broken || !src) {
    return (
      <div className={`${className} bg-surface`} aria-hidden="true">
        <div className="flex h-full items-end p-4 text-sm text-muted">
          Video belum bisa diputar. Ganti link di file video atau TOLS ADMIN.
        </div>
      </div>
    );
  }

  return (
    <video
      ref={ref}
      className={className}
      src={src}
      autoPlay={active}
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
    <section className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12 sm:px-5 sm:py-16">
      <div className="w-full max-w-[22rem] overflow-hidden border border-line bg-bg/80 p-5 shadow-none backdrop-blur-md sm:max-w-md sm:p-8">
        <p className="text-[0.65rem] font-semibold tracking-[0.2em] text-primary sm:text-xs sm:tracking-widest">
          MESIN OTP
        </p>
        <h1 className="mt-3 font-display text-[1.85rem] leading-[1.05] font-extrabold tracking-tight sm:text-4xl sm:leading-none md:text-5xl">
          QWEN
          <span className="mt-0.5 block text-primary">GENERETE</span>
        </h1>
        <p className="mt-4 max-w-full text-sm leading-relaxed text-muted">
          {sound
            ? "Suara video nyala. Login dan registrasi langsung di sini."
            : "Klik di mana saja — suara video ikut nyala, termasuk di halaman login."}
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:mt-8">
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
