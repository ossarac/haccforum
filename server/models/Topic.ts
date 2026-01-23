import { Schema, model, type Document, type Types } from 'mongoose'

export interface TopicDocument extends Document {
  name: string
  description?: string
  parentId: Types.ObjectId | null
  ancestors: Types.ObjectId[]
  createdBy: Types.ObjectId
  deleted: boolean
  deletedAt: Date | null
  deletedBy: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

const topicSchema = new Schema<TopicDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: false // Can have same name in different parent topics
    },
    description: {
      type: String,
      trim: true
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Topic',
      default: null
    },
    ancestors: {
      type: [Schema.Types.ObjectId],
      default: []
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    deleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
)

// Index for finding topics by parentId
topicSchema.index({ parentId: 1, deleted: 1 })

// Index for finding topics by ancestors
topicSchema.index({ ancestors: 1, deleted: 1 })

// Index for finding topics by name
topicSchema.index({ name: 1, deleted: 1 })

// Compound index for common query patterns
topicSchema.index({ parentId: 1, deleted: 1, name: 1 })

const TopicModel = model<TopicDocument>('Topic', topicSchema)

export default TopicModel
