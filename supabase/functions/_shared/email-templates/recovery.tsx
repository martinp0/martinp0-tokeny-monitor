/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="cs" dir="ltr">
    <Head />
    <Preview>Reset hesla pro {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Obnova hesla 🔑</Heading>
        <Text style={text}>
          Obdrželi jsme požadavek na reset hesla k tvému účtu na {siteName}.
          Klikni na tlačítko níže pro nastavení nového hesla.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Nastavit nové heslo
        </Button>
        <Text style={footer}>
          Pokud jsi o reset nežádal/a, tento e-mail můžeš klidně ignorovat.
          Tvoje heslo zůstane beze změny.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

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
