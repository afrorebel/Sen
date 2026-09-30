import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Sends mail through any SMTP server. With a Hostinger mailbox (e.g. hello@aeogrowthlead.com):
 *   SMTP_HOST=smtp.hostinger.com  SMTP_PORT=465  SMTP_USER=hello@aeogrowthlead.com  SMTP_PASSWORD=…
 * Without SMTP settings, emails are printed to the server log instead (useful in development).
 */

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

let transport: Transporter | null = null;
function getTransport() {
  const port = Number(process.env.SMTP_PORT ?? 465);
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  return transport;
}

const FROM = () => process.env.EMAIL_FROM || `AEO GrowthLead <${process.env.SMTP_USER ?? "hello@aeogrowthlead.com"}>`;

/** Same mailbox, different display name (white-label report emails). */
const fromAs = (name: string) => {
  const address = FROM().match(/<([^>]+)>/)?.[1] ?? FROM();
  return `"${name.replace(/["\\<>]/g, "")}" <${address}>`;
};

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** A plain, reliable email layout: one message, one button, the link as text too. */
function layout(opts: { heading: string; body: string; button: string; url: string; footer: string; sender?: string }) {
  const html = `<!doctype html><html><body style="margin:0;background:#f7f7f5;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a19">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border:1px solid #e3e3de;border-radius:12px" cellpadding="0" cellspacing="0"><tr><td style="padding:28px">
<div style="font-weight:800;font-size:18px;margin-bottom:20px">${opts.sender ? escape(opts.sender) : 'AEO <span style="color:#FF5A1F">GrowthLead</span>'}</div>
<h1 style="font-size:20px;margin:0 0 12px">${escape(opts.heading)}</h1>
<p style="font-size:15px;line-height:1.55;color:#4a4a46;margin:0 0 22px">${escape(opts.body)}</p>
<a href="${escape(opts.url)}" style="display:inline-block;background:#1a1a19;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">${escape(opts.button)}</a>
<p style="font-size:13px;color:#75756f;margin:22px 0 0">Or paste this link into your browser:<br><span style="word-break:break-all">${escape(opts.url)}</span></p>
<p style="font-size:13px;color:#75756f;margin:16px 0 0">${escape(opts.footer)}</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `${opts.heading}\n\n${opts.body}\n\n${opts.button}: ${opts.url}\n\n${opts.footer}`;
  return { html, text };
}

interface Attachment {
  filename: string;
  content: Buffer;
}

async function send(to: string | string[], subject: string, content: { html: string; text: string }, attachments: Attachment[] = [], sender?: string) {
  if (!emailConfigured()) {
    const files = attachments.map((a) => `${a.filename} (${Math.round(a.content.length / 1024)} KB)`).join(", ");
    console.log(`[email not configured] To: ${[to].flat().join(", ")}\nSubject: ${subject}\n${content.text}\n${files ? `Attachments: ${files}\n` : ""}`);
    return;
  }
  await getTransport().sendMail({
    from: sender ? fromAs(sender) : FROM(),
    to,
    subject,
    ...content,
    attachments: attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: "application/pdf" })),
  });
}

export async function sendPasswordResetEmail(to: string, name: string, url: string) {
  await send(
    to,
    "Reset your AEO GrowthLead password",
    layout({
      heading: `Hi ${name.split(" ")[0]}, reset your password`,
      body: "We received a request to reset the password for your AEO GrowthLead account. This link works once and expires in 1 hour.",
      button: "Choose a new password",
      url,
      footer: "If you didn't ask for this, you can ignore this email. Your password won't change.",
    }),
  );
}

export async function sendInviteEmail(to: string, name: string, workspace: string, url: string) {
  await send(
    to,
    `You're invited to ${workspace} on AEO GrowthLead`,
    layout({
      heading: `Hi ${name.split(" ")[0]}, your dashboard is ready`,
      body: `You've been given access to ${workspace} on AEO GrowthLead. There you can see how AI assistants like ChatGPT and Google AI Mode talk about your business, and follow the work our team is doing. Set a password to get started. The link expires in 3 days.`,
      button: "Set my password",
      url,
      footer: "Questions? Just reply to this email.",
    }),
  );
}

export async function sendReportEmail(
  to: string[],
  r: { brandName: string; periodLabel: string; score: number | null; summary: string[]; attachment: Attachment; sender?: string },
) {
  const url = `${process.env.APP_URL?.replace(/\/$/, "") ?? ""}/app`;
  const body = `${r.score != null ? `AEO score: ${r.score}/100. ` : ""}${r.summary.join(" ")} The full report is attached as a PDF.`;
  await send(
    to,
    `${r.brandName}: AI visibility report for ${r.periodLabel}`,
    layout({
      heading: `${r.brandName} · ${r.periodLabel}`,
      body,
      button: "Open the live dashboard",
      url,
      footer: "You're receiving this because you're on the monthly report list for this brand. Reply to this email to change that.",
      sender: r.sender,
    }),
    [r.attachment],
    r.sender,
  );
}
