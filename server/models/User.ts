import bcrypt from 'bcryptjs'
import { Schema, model, type Document } from 'mongoose'

export interface ReadingPreferences {
  backgroundId?: string
  fontId?: string
  fontSize?: string
  lineHeight?: number
  docWidthId?: string
}

export type UserRole = 'admin' | 'writer' | 'viewer'
export type UserStatus = 'pending' | 'approved' | 'rejected'

export interface UserDocument extends Document {
  email: string
  name: string
  passwordHash: string
  roles: UserRole[]
  status: UserStatus
  requestedRole?: UserRole
  applicationNote?: string
  adminNote?: string
  emailVerified: boolean
  language?: string
  readingPreferences?: ReadingPreferences
  comparePassword(password: string): Promise<boolean>
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    roles: {
      type: [String],
      enum: ['admin', 'writer', 'viewer'],
      default: ['viewer']
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    requestedRole: {
      type: String,
      enum: ['admin', 'writer', 'viewer']
    },
    applicationNote: {
      type: String,
      maxlength: 2000
    },
    adminNote: {
      type: String,
      maxlength: 1000
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    language: {
      type: String,
      enum: ['tr', 'en'],
      default: 'tr'
    },
    readingPreferences: {
      backgroundId: String,
      fontId: String,
      fontSize: String,
      lineHeight: Number,
      docWidthId: String
    }
  },
  { timestamps: true }
)

userSchema.methods.comparePassword = async function comparePassword(password: string) {
  return bcrypt.compare(password, this.passwordHash)
}

const UserModel = model<UserDocument>('User', userSchema)

export default UserModel
