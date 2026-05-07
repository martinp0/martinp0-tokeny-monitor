/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="cs" dir="ltr">
    <Head />
    <Preview>Tvůj ověřovací kód</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Ověření identity 🔐</Heading>
        <Text style={text}>Použij kód níže pro potvrzení své identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Kód brzy vyprší. Pokud jsi o něj nežádal/a, můžeš tento e-mail klidně ignorovat.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

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
const codeStyle = {
  fontFamily: "'JetBrains Mono', Courier, monospace",
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: 'hsl(270, 95%, 65%)',
  margin: '0 0 32px',
  letterSpacing: '4px',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0' }
