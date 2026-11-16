import { createServerFn } from "@tanstack/react-start";

type SendInput = {
  to: string;
  code: string;
  fromUser: string;
  fromPass: string;
  note: string;
};

function asSendInput(data: unknown): SendInput {
  if (!data || typeof data !== "object") throw new Error("Data OTP kosong");
  const d = data as Record<string, unknown>;
  const to = String(d.to ?? "").trim();
  const code = String(d.code ?? "").trim();
  const fromUser = String(d.fromUser ?? "").trim();
  const fromPass = String(d.fromPass ?? "").replace(/\s+/g, "");
  const note = String(d.note ?? "").slice(0, 180);
  const emailOk = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (!emailOk(to)) throw new Error("Gmail tujuan tidak valid");
  if (!emailOk(fromUser)) throw new Error("Gmail pengirim tidak valid");
  if (!/^\d{6}$/.test(code)) throw new Error("Kode OTP tidak valid");
  if (fromPass.length < 8) throw new Error("App password minimal 8 karakter");
  return { to, code, fromUser, fromPass, note };
}

export const sendOtpEmail = createServerFn({ method: "POST" })
  .validator((data: unknown) => asSendInput(data))
  .handler(async ({ data }) => {
    try {
      const { createTransport } = await import("nodemailer");
      const transport = createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: data.fromUser, pass: data.fromPass },
      });
      await transport.sendMail({
        from: `QWEN GENERETE <${data.fromUser}>`,
        to: data.to,
        subject: "Kode OTP QWEN GENERETE",
        text: `${data.note}\n\nKode OTP: ${data.code}\n\nKode ini hanya untuk kamu. Jangan diteruskan.`,
      });
      return { ok: true as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal mengirim Gmail";
      return { ok: false as const, error: message };
    }
  });
