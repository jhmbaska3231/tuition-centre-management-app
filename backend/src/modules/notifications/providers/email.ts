// backend/src/modules/notifications/providers/email.ts
//
// builds an emailprovider from the org's stored integration. two adapters cover most
// centres: smtp (any mailbox or relay) and resend (http api). add others by
// implementing emailprovider and adding a case to build()

import nodemailer from 'nodemailer';
import { config } from '../../../config';
import { readIntegrationConfig } from '../../org/integrations';
import { EmailMessage, EmailProvider } from '../types';

const smtpProvider = (c: Record<string, string>): EmailProvider => {
  for (const k of ['host', 'port', 'from']) if (!c[k]) throw new Error(`SMTP config missing ${k}`);
  const transport = nodemailer.createTransport({
    host: c.host, port: Number(c.port), secure: c.secure === 'true',
    auth: c.user ? { user: c.user, pass: c.pass ?? '' } : undefined,
  });
  return {
    name: 'smtp',
    async send(m: EmailMessage) {
      const info = await transport.sendMail({ from: c.from, to: `"${m.toName}" <${m.to}>`, subject: m.subject, text: m.text, html: m.html });
      return { providerMessageId: info.messageId ?? null };
    },
  };
};

const resendProvider = (c: Record<string, string>): EmailProvider => {
  for (const k of ['apiKey', 'from']) if (!c[k]) throw new Error(`Resend config missing ${k}`);
  return {
    name: 'resend',
    async send(m: EmailMessage) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${c.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: c.from, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { id?: string };
      return { providerMessageId: body.id ?? null };
    },
  };
};

// development fallback so the outbox drains without a real provider
const consoleProvider: EmailProvider = {
  name: 'console',
  async send(m: EmailMessage) {
    console.log(JSON.stringify({ level: 'info', msg: 'email_console', to: m.to, subject: m.subject, text: m.text }));
    return { providerMessageId: null };
  },
};

const build = (provider: string, c: Record<string, string>): EmailProvider => {
  switch (provider) {
    case 'smtp': return smtpProvider(c);
    case 'resend': return resendProvider(c);
    default: throw new Error(`Unsupported email provider: ${provider}`);
  }
};

// cached per org for a short time so a config change takes effect without a restart
const cache = new Map<string, { provider: EmailProvider; expiresAt: number }>();
const CACHE_MS = 60_000;

export const emailProviderFor = async (orgId: string): Promise<EmailProvider> => {
  const hit = cache.get(orgId);
  if (hit && hit.expiresAt > Date.now()) return hit.provider;
  const integration = await readIntegrationConfig(orgId, 'email');
  let provider: EmailProvider;
  if (integration) provider = build(integration.provider, integration.config);
  else if (config.isDevelopment) provider = consoleProvider;
  else throw new Error('No active email integration configured');
  cache.set(orgId, { provider, expiresAt: Date.now() + CACHE_MS });
  return provider;
};

export const invalidateEmailProvider = (orgId: string) => cache.delete(orgId);