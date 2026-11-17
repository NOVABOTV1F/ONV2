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

type OtpPhase = "idle" | "spin" | "local" | "mailed" | "fail";

const inputClass =
  "h-12 w-full border border-border bg-surface px-3 text-base text-fg outline-none focus-visible:border-primary";

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function Field({
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

// NOTE: Full Register, Login, Desk, GearModal, ToolsPanel will be added in next commit to avoid size limit.
// Temporary stub to prevent crash.
export function Register(props: any) {
  return <div className="p-8 text-center">Registrasi loading... (sedang diperbaiki)</div>;
}
export function Login(props: any) {
  return <div className="p-8 text-center">Login loading... (sedang diperbaiki)</div>;
}
export function Desk(props: any) {
  return <div className="p-8 text-center">Desk loading... (sedang diperbaiki)</div>;
}
export function GearModal(props: any) {
  return null;
}
export function ToolsPanel(props: any) {
  return null;
}
