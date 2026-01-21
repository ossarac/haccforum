import dotenv from 'dotenv'

dotenv.config()

const required = ['JWT_SECRET', 'MONGODB_URI', 'GCS_BUCKET_NAME'] as const

required.forEach(key => {
  if (!process.env[key] || process.env[key]!.trim() === '') {
    throw new Error(`Missing required environment variable ${key}`)
  }
})

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI!,
  jwtSecret: process.env.JWT_SECRET!,
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  storageBucket: process.env.GCS_BUCKET_NAME!
}

export default env
