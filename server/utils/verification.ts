import crypto from 'crypto'

export interface VerificationToken {
  token: string
  email: string
  expiresAt: Date
}

const verificationTokens = new Map<string, VerificationToken>()

export function generateVerificationToken(email: string): string {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  verificationTokens.set(token, { token, email, expiresAt })

  // Clean up expired tokens
  for (const [key, value] of verificationTokens.entries()) {
    if (value.expiresAt < new Date()) {
      verificationTokens.delete(key)
    }
  }

  return token
}

export function verifyToken(token: string): string | null {
  const verification = verificationTokens.get(token)
  
  if (!verification) {
    return null
  }

  if (verification.expiresAt < new Date()) {
    verificationTokens.delete(token)
    return null
  }

  verificationTokens.delete(token)
  return verification.email
}

export function sendVerificationEmail(email: string, token: string): void {
  // In production, integrate with an email service (SendGrid, AWS SES, etc.)
  // For now, just log it
  const verificationUrl = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/verify-email?token=${token}`
  console.log(`
[EMAIL] Verification email for ${email}
===========================================
Click the link below to verify your email:
${verificationUrl}
===========================================
  `)
}
