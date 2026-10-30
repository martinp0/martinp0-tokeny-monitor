import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'
import { planAuthEmails, verifyStandardWebhook, type HookPayload } from '../_shared/auth-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_NAME = "Tokeny"
const ROOT_DOMAIN = "tokeny.martinpohl.cz"
const FROM_DOMAIN = "notify.tokeny.pohl.uk"

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Potvrď svůj email',
  invite: 'Byl/a jsi pozván/a',
  magiclink: 'Tvůj přihlašovací odkaz',
  recovery: 'Obnov své heslo',
  email_change: 'Potvrď nový email',
  reauthentication: 'Ověřovací kód',
}

const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

async function sendViaResend(params: {
  to: string
  from: string
  subject: string
  html: string
  text: string
}): Promise<void> {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured')

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Resend error ${resp.status}: ${err}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const rawBody = await req.text()

    // Supabase signs auth hooks with Standard Webhooks; secret "v1,whsec_..." from Auth → Hooks.
    const secret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? Deno.env.get('SUPABASE_AUTH_HOOK_SECRET')
    const verified = await verifyStandardWebhook(secret, req.headers, rawBody)
    if (!verified.ok) {
      console.error('auth-email-hook: invalid signature', verified.reason)
      return new Response(JSON.stringify({ error: { http_code: 401, message: 'Invalid signature' } }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = JSON.parse(rawBody) as HookPayload
    const emailType = payload?.email_data?.email_action_type ?? ''
    const emails = planAuthEmails(payload, Deno.env.get('SUPABASE_URL')!, `https://${ROOT_DOMAIN}/`)
    if (emails.length === 0) {
      // Not templated here (e.g. *_notification types) or nothing to send — acknowledge.
      console.warn('auth-email-hook: nothing to send for', emailType)
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    for (const mail of emails) {
      const EmailTemplate = EMAIL_TEMPLATES[mail.type]
      const templateProps = {
        siteName: SITE_NAME,
        siteUrl: `https://${ROOT_DOMAIN}`,
        recipient: mail.to,
        confirmationUrl: mail.confirmationUrl,
        token: mail.token,
        email: mail.to,
        oldEmail: mail.oldEmail,
        newEmail: mail.newEmail,
      }

      const html = await renderAsync(React.createElement(EmailTemplate, templateProps))
      const text = await renderAsync(React.createElement(EmailTemplate, templateProps), { plainText: true })

      await sendViaResend({
        to: mail.to,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        subject: EMAIL_SUBJECTS[mail.type] ?? 'Notification',
        html,
        text,
      })

      // Log to DB for observability (best effort)
      await supabase.from('email_send_log').insert({
        message_id: crypto.randomUUID(),
        template_name: mail.type,
        recipient_email: mail.to,
        status: 'sent',
      })
    }

    console.log('Auth email sent', { emailType, count: emails.length })
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('auth-email-hook error:', error)
    return new Response(JSON.stringify({ error: { http_code: 500, message: 'Failed to send email' } }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
