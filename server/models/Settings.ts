import { Schema, model, type Document } from 'mongoose'

export interface SettingsDocument extends Document {
  key: string
  value: any
  updatedAt: Date
}

const settingsSchema = new Schema<SettingsDocument>(
  {
    key: {
      type: String,
      required: true,
      unique: true
    },
    value: {
      type: Schema.Types.Mixed,
      required: true
    }
  },
  { timestamps: true }
)

const SettingsModel = model<SettingsDocument>('Settings', settingsSchema)

// Helper functions for common settings
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const setting = await SettingsModel.findOne({ key })
  return setting ? setting.value : defaultValue
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await SettingsModel.findOneAndUpdate(
    { key },
    { value },
    { upsert: true, new: true }
  )
}

// Specific setting keys
export const SETTINGS_KEYS = {
  GUEST_ACCESS_ENABLED: 'guestAccessEnabled',
  REQUIRE_EMAIL_VERIFICATION: 'requireEmailVerification'
} as const

export default SettingsModel
