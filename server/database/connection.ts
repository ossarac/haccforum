import mongoose from 'mongoose'
import env from '../config/env.js'

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true)

  try {
    await mongoose.connect(env.mongoUri)
    const { host, name } = mongoose.connection
    console.info(`[database] connected to ${host}/${name}`)
  } catch (error) {
    console.error('[database] connection failed', error)
    throw error
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect()
}
