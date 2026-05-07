/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="cs" dir="ltr">
    <Head />
    <Preview>Potvrzení e-mailu pro {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Potvrď svůj e-mail ✨</Heading>
        <Text style={text}>
          Díky za registraci na{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          !
        </Text>
        <Text style={text}>
          Potvrď prosím svou e-mailovou adresu (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) kliknutím na tlačítko níže:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Ověřit e-mail
        </Button>
        <Text style={footer}>
          Pokud sis nezakládal/a účet, tento e-mail můžeš klidně ignorovat.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '32px 28px' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#1a1a2e',
  margin: '0 0 24px',
}
const text = {
  fontSize: '15px',
  color: '#4a4a5a',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const link = { color: 'hsl(270, 95%, 65%)', textDecoration: 'underline' }
const button = {
  backgroundColor: 'hsl(270, 95%, 65%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0' }
