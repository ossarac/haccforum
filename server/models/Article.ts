import { Schema, model, type Document, type Types } from 'mongoose'

export interface ArticleRevision {
  title: string
  content: string
  version: number
  updatedAt: Date
  updatedBy: Types.ObjectId
}

export interface ArticleDocument extends Document {
  title: string
  content: string
  authorName?: string
  parentId: Types.ObjectId | null
  ancestors: Types.ObjectId[]
  topicId: Types.ObjectId | null
  author: Types.ObjectId
  version: number
  revisions: ArticleRevision[]
  published: boolean
  publishedAt: Date | null
  deleted: boolean
  deletedAt: Date | null
  deletedBy: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

const revisionSchema = new Schema<ArticleRevision>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    version: { type: Number, required: true },
    updatedAt: { type: Date, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { _id: false }
)

const articleSchema = new Schema<ArticleDocument>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    authorName: { type: String, trim: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Article', default: null },
    ancestors: { type: [Schema.Types.ObjectId], default: [] },
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', default: null },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    version: { type: Number, default: 1 },
    revisions: { type: [revisionSchema], default: [] },
    published: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  {
    timestamps: true
  }
)

articleSchema.index({ parentId: 1 })
// Indexes for efficient draft queries: find unpublished articles by author
articleSchema.index({ author: 1, published: 1 })
// Index for listing published articles
articleSchema.index({ published: 1, parentId: 1 })
articleSchema.index({ ancestors: 1 })
articleSchema.index({ deleted: 1, parentId: 1 })
// Index for topic-based queries
articleSchema.index({ topicId: 1, deleted: 1 })
articleSchema.index({ topicId: 1, published: 1 })

articleSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: any) => {
    ret.id = ret._id.toString()
    ret.author = ret.author?.toString()
    ret.parentId = ret.parentId ? ret.parentId.toString() : null
    delete ret._id
    return ret
  }
})

const ArticleModel = model<ArticleDocument>('Article', articleSchema)

export default ArticleModel
