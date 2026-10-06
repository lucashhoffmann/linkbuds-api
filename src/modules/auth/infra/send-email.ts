import { Logger } from '@nestjs/common';

type Env = NodeJS.ProcessEnv;

export type Email = { to: string; subject: string; text: string };

const logger = new Logger('Email');

/**
 * Sends through Resend's HTTP API. Without RESEND_API_KEY (dev) the email is
 * only logged, so the reset link can be copied from the console.
 */
export async function sendEmail(email: Email, env: Env = process.env) {
  const apiKey = env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    if (env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY is not set');
    }

    logger.warn(`[dev] ${email.to} · ${email.subject}\n${email.text}`);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM?.trim() || 'LinkBuds <onboarding@resend.dev>',
      to: email.to,
      subject: email.subject,
      text: email.text,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Resend failed (${response.status}): ${await response.text()}`,
    );
  }
}

export function resetPasswordEmail(to: string, url: string): Email {
  return {
    to,
    subject: 'Redefinir sua senha do LinkBuds',
    text: [
      'Recebemos um pedido para redefinir sua senha.',
      '',
      `Abra o link para criar uma nova senha (vale 1 hora): ${url}`,
      '',
      'Se não foi você, ignore este email.',
    ].join('\n'),
  };
}
