import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_NAME = "Tokeny Monitor"
const ROOT_DOMAIN = "tokeny.pohl.uk"
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

// Verify Supabase Auth Hook HMAC-SHA256 signature.
// Supabase signs the raw body with the webhook secret and puts the result
// in the Authorization header as "Bearer <base64_signature>".
async function verifySupabaseSignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = Deno.env.get('SUPABASE_AUTH_HOOK_SECRET')
  if (!secret) return false

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  if (!token) return false

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  const signatureBytes = Uint8Array.from(atob(token), (c) => c.charCodeAt(0))
  return crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(rawBody))
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

    const isValid = await verifySupabaseSignature(req, rawBody)
    if (!isValid) {
      console.error('Invalid auth hook signature')
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Supabase Send Email Hook payload format
    const payload = JSON.parse(rawBody)
    const emailType: string = payload?.email_data?.email_action_type ?? ''
    const recipientEmail: string = payload?.user?.email ?? payload?.email_data?.email ?? ''
    const confirmationUrl: string = payload?.email_data?.redirect_to ?? payload?.email_data?.url ?? ''
    const token: string = payload?.email_data?.token ?? ''
    const oldEmail: string = payload?.email_data?.old_email ?? ''
    const newEmail: string = payload?.email_data?.new_email ?? recipientEmail

    if (!recipientEmail || !emailType) {
      return new Response(JSON.stringify({ error: 'Missing email or action type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const EmailTemplate = EMAIL_TEMPLATES[emailType]
    if (!EmailTemplate) {
      console.warn('Unknown email type', emailType)
      return new Response(JSON.stringify({ error: `Unknown email type: ${emailType}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const templateProps = {
      siteName: SITE_NAME,
      siteUrl: `https://${ROOT_DOMAIN}`,
      recipient: recipientEmail,
      confirmationUrl,
      token,
      email: recipientEmail,
      oldEmail,
      newEmail,
    }

    const html = await renderAsync(React.createElement(EmailTemplate, templateProps))
    const text = await renderAsync(React.createElement(EmailTemplate, templateProps), { plainText: true })

    await sendViaResend({
      to: recipientEmail,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      subject: EMAIL_SUBJECTS[emailType] ?? 'Notification',
      html,
      text,
    })

    // Log to DB for observability
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    await supabase.from('email_send_log').insert({
      message_id: crypto.randomUUID(),
      template_name: emailType,
      recipient_email: recipientEmail,
      status: 'sent',
    })

    console.log('Auth email sent', { emailType, email: recipientEmail })
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('auth-email-hook error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
