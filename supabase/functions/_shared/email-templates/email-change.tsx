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

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="cs" dir="ltr">
    <Head />
    <Preview>Potvrzení změny e-mailu pro {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Změna e-mailu ✉️</Heading>
        <Text style={text}>
          Požádal/a jsi o změnu e-mailové adresy pro {siteName} z{' '}
          <Link href={`mailto:${oldEmail}`} style={link}>
            {oldEmail}
          </Link>{' '}
          na{' '}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          .
        </Text>
        <Text style={text}>
          Klikni na tlačítko níže pro potvrzení změny:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Potvrdit změnu e-mailu
        </Button>
        <Text style={footer}>
          Pokud jsi o tuto změnu nežádal/a, zabezpeč prosím okamžitě svůj účet.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

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
