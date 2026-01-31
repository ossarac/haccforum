import type { Request, Response } from 'express'
import { Types } from 'mongoose'
import TopicModel from '../models/Topic.js'
import type { TopicDocument } from '../models/Topic.js'
import ArticleModel from '../models/Article.js'
import UserModel from '../models/User.js'
import { t } from '../i18n/index.js'

interface TopicResponse {
  id: string
  name: string
  description?: string
  parentId: string | null
  ancestors: string[]
  createdBy: {
    id: string
    name: string
  }
  createdAt: string
  updatedAt: string
  children?: TopicResponse[]
  articleCount?: number
}

function isObjectId(value: unknown): value is Types.ObjectId {
  return value instanceof Types.ObjectId
}

function formatTopic(topic: TopicDocument & { createdBy: any }): TopicResponse {
  const createdBy = topic.createdBy
  const createdById = isObjectId(createdBy) ? createdBy.toString() : createdBy?._id?.toString() ?? ''
  return {
    id: topic._id.toString(),
    name: topic.name,
    description: topic.description,
    parentId: topic.parentId ? topic.parentId.toString() : null,
    ancestors: topic.ancestors.map(id => id.toString()),
    createdBy: {
      id: createdById,
      name: createdBy?.name ?? 'Unknown'
    },
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString()
  }
}

function isAdminOrWriter(req: Request): boolean {
  return req.user?.roles?.includes('admin') || req.user?.roles?.includes('writer') ? true : false
}

function isAdmin(req: Request): boolean {
  return req.user?.roles?.includes('admin') ?? false
}

export async function listTopics(req: Request, res: Response): Promise<void> {
  try {
    // Fetch ALL topics, not just root ones
    const topics = await TopicModel.find({ deleted: false })
      .populate('createdBy', 'name email')
      .sort({ name: 1 })
      .lean()

    const formattedTopics = await Promise.all(
      topics.map(async (topic) => {
        const formatted = formatTopic(topic as unknown as TopicDocument & { createdBy: any })
        const articleCount = await ArticleModel.countDocuments({
          topicId: topic._id,
          deleted: false,
          published: true
        })
        formatted.articleCount = articleCount
        return formatted
      })
    )

    res.json(formattedTopics)
  } catch (error) {
    console.error('[topics] listTopics error', error)
    res.status(500).json({ error: t('failedToListTopics', req) })
  }
}

export async function getTopicWithChildren(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: t('invalidTopicID', req) })
      return
    }

    const topic = await TopicModel.findById(id)
      .populate('createdBy', 'name email')
      .lean()

    if (!topic || topic.deleted) {
      res.status(404).json({ error: t('topicNotFound', req) })
      return
    }

    const formatted = formatTopic(topic as unknown as TopicDocument & { createdBy: any })

    // Get child topics
    const children = await TopicModel.find({ parentId: id, deleted: false })
      .populate('createdBy', 'name email')
      .sort({ name: 1 })
      .lean()

    if (children.length > 0) {
      formatted.children = await Promise.all(
        children.map(async (child) => {
          const formattedChild = formatTopic(child as unknown as TopicDocument & { createdBy: any })
          const articleCount = await ArticleModel.countDocuments({
            topicId: child._id,
            deleted: false,
            published: true
          })
          formattedChild.articleCount = articleCount
          return formattedChild
        })
      )
    }

    const articleCount = await ArticleModel.countDocuments({
      topicId: id,
      deleted: false,
      published: true
    })
    formatted.articleCount = articleCount

    res.json(formatted)
  } catch (error) {
    console.error('[topics] getTopicWithChildren error', error)
    res.status(500).json({ error: t('failedToGetTopic', req) })
  }
}

export async function createTopic(req: Request, res: Response): Promise<void> {
  try {
    if (!isAdminOrWriter(req)) {
      res.status(403).json({ error: t('onlyAdminsAndWritersCanCreate', req) })
      return
    }

    const { name, description, parentId } = req.body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: t('topicNameRequired', req) })
      return
    }

    let validatedParentId: Types.ObjectId | null = null
    let ancestors: Types.ObjectId[] = []

    if (parentId) {
      if (!Types.ObjectId.isValid(parentId)) {
        res.status(400).json({ error: t('invalidParentTopicID', req) })
        return
      }

      const parentTopic = await TopicModel.findById(parentId)

      if (!parentTopic || parentTopic.deleted) {
        res.status(404).json({ error: t('parentTopicNotFound', req) })
        return
      }

      validatedParentId = new Types.ObjectId(parentId)
      ancestors = [parentTopic._id, ...parentTopic.ancestors]
    }

    const newTopic = new TopicModel({
      name: name.trim(),
      description: description?.trim() || undefined,
      parentId: validatedParentId,
      ancestors,
      createdBy: req.user?.id
    })

    const saved = await newTopic.save()
    const populated = await TopicModel.findById(saved._id).populate('createdBy', 'name email').lean()

    res.status(201).json(formatTopic(populated as unknown as TopicDocument & { createdBy: any }))
  } catch (error) {
    console.error('[topics] createTopic error', error)
    res.status(500).json({ error: t('failedToCreateTopic', req) })
  }
}

export async function updateTopic(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const { name, description } = req.body

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: t('invalidTopicID', req) })
      return
    }

    const topic = await TopicModel.findById(id)

    if (!topic || topic.deleted) {
      res.status(404).json({ error: t('topicNotFound', req) })
      return
    }

    // Check if user is admin or the creator of the topic
    const isCreator = topic.createdBy.toString() === req.user?.id
    if (!isAdmin(req) && !isCreator) {
      res.status(403).json({ error: t('onlyAdminsOrCreatorCanUpdate', req) })
      return
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: t('topicNameMustBeNonEmpty', req) })
        return
      }
      topic.name = name.trim()
    }

    if (description !== undefined) {
      topic.description = description?.trim() || undefined
    }

    const updated = await topic.save()
    const populated = await TopicModel.findById(updated._id).populate('createdBy', 'name email').lean()

    res.json(formatTopic(populated as unknown as TopicDocument & { createdBy: any }))
  } catch (error) {
    console.error('[topics] updateTopic error', error)
    res.status(500).json({ error: t('failedToUpdateTopic', req) })
  }
}

export async function deleteTopic(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: t('invalidTopicID', req) })
      return
    }

    const topic = await TopicModel.findById(id)

    if (!topic || topic.deleted) {
      res.status(404).json({ error: t('topicNotFound', req) })
      return
    }

    // Only admins can delete topics
    if (!isAdmin(req)) {
      res.status(403).json({ error: t('onlyAdminsCanDelete', req) })
      return
    }

    // Check if topic has published articles (drafts are allowed)
    const publishedArticleCount = await ArticleModel.countDocuments({
      topicId: id,
      deleted: false,
      published: true
    })

    if (publishedArticleCount > 0) {
      res.status(400).json({
        error: t('cannotDeleteTopicWithArticles', req),
        articleCount: publishedArticleCount
      })
      return
    }

    // Check if topic has child topics
    const childCount = await TopicModel.countDocuments({
      parentId: id,
      deleted: false
    })

    if (childCount > 0) {
      res.status(400).json({
        error: t('cannotDeleteTopicWithChildren', req),
        childCount
      })
      return
    }

    // Move draft articles to parent topic or set to null
    const draftArticles = await ArticleModel.find({
      topicId: id,
      deleted: false,
      published: false
    })

    if (draftArticles.length > 0) {
      const fallbackTopicId = topic.parentId || null
      await ArticleModel.updateMany(
        {
          topicId: id,
          deleted: false,
          published: false
        },
        {
          $set: { topicId: fallbackTopicId }
        }
      )
    }

    // Soft delete
    topic.deleted = true
    topic.deletedAt = new Date()
    topic.deletedBy = new Types.ObjectId(req.user?.id)

    await topic.save()

    res.json({ success: true, message: t('topicDeletedSuccessfully', req) })
  } catch (error) {
    console.error('[topics] deleteTopic error', error)
    res.status(500).json({ error: t('failedToDeleteTopic', req) })
  }
}

export async function mergeTopics(req: Request, res: Response): Promise<void> {
  try {
    if (!isAdmin(req)) {
      res.status(403).json({ error: t('onlyAdminsCanMerge', req) })
      return
    }

    const { sourceId, targetId, dryRun = false, deleteSource = true } = req.body as {
      sourceId?: string
      targetId?: string
      dryRun?: boolean
      deleteSource?: boolean
    }

    if (!sourceId || !targetId) {
      res.status(400).json({ error: t('mergeSourceTargetRequired', req) })
      return
    }

    if (!Types.ObjectId.isValid(sourceId) || !Types.ObjectId.isValid(targetId)) {
      res.status(400).json({ error: t('invalidTopicID', req) })
      return
    }

    if (sourceId === targetId) {
      res.status(400).json({ error: t('mergeMustDiffer', req) })
      return
    }

    const source = await TopicModel.findById(sourceId)
    const target = await TopicModel.findById(targetId)

    if (!source || source.deleted) {
      res.status(404).json({ error: t('topicNotFound', req) })
      return
    }

    if (!target || target.deleted) {
      res.status(404).json({ error: t('targetTopicNotFound', req) })
      return
    }

    // Prevent cycles: target cannot be a descendant of source
    const targetAncestors = (target.ancestors || []).map(id => id.toString())
    if (targetAncestors.includes(sourceId)) {
      res.status(400).json({ error: t('mergeCycleNotAllowed', req) })
      return
    }

    // Gather stats
    const movedArticles = await ArticleModel.countDocuments({ topicId: sourceId, deleted: false })
    const descendantTopics = await TopicModel.find({ ancestors: sourceId, deleted: false }).lean()
    const reparentedTopics = descendantTopics.length

    if (dryRun) {
      res.json({
        sourceId,
        targetId,
        movedArticles,
        reparentedTopics,
        message: t('mergeDryRun', req)
      })
      return
    }

    // Move articles from source to target
    await ArticleModel.updateMany(
      { topicId: sourceId, deleted: false },
      { $set: { topicId: targetId } }
    )

    // Reparent descendants by rewriting ancestors
    const targetAncestorIds = [new Types.ObjectId(targetId), ...target.ancestors]
    const descendantDocs = await TopicModel.find({ ancestors: sourceId, deleted: false })

    for (const doc of descendantDocs) {
      const ancestors = doc.ancestors.map(id => id.toString())
      const idx = ancestors.indexOf(sourceId)
      const suffixIds = idx >= 0 ? ancestors.slice(idx + 1) : []
      const newAncestors = [...targetAncestorIds, ...suffixIds.map(id => new Types.ObjectId(id))]

      if (doc.parentId && doc.parentId.toString() === sourceId) {
        doc.parentId = new Types.ObjectId(targetId)
      }
      doc.ancestors = newAncestors
      await doc.save()
    }

    // Optionally delete source topic after moving
    if (deleteSource) {
      source.deleted = true
      await source.save()
    }

    res.json({
      sourceId,
      targetId,
      movedArticles,
      reparentedTopics,
      message: t('mergeCompleted', req)
    })
  } catch (error) {
    console.error('[topics] mergeTopics error', error)
    res.status(500).json({ error: t('failedToMergeTopics', req) })
  }
}

export async function getTopicPath(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params

    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: t('invalidTopicID', req) })
      return
    }

    const topic = await TopicModel.findById(id).populate('createdBy', 'name email').lean()

    if (!topic || topic.deleted) {
      res.status(404).json({ error: t('topicNotFound', req) })
      return
    }

    // Build path from root to this topic
    let path: TopicResponse[] = [formatTopic(topic as unknown as TopicDocument & { createdBy: any })]

    if (topic.ancestors && topic.ancestors.length > 0) {
      const ancestorIds = topic.ancestors
      const ancestors = await TopicModel.find({ _id: { $in: ancestorIds } })
        .populate('createdBy', 'name email')
        .lean()

      const ancestorMap = new Map(ancestors.map((a: any) => [a._id.toString(), a]))

      for (const ancestorId of ancestorIds) {
        const ancestor = ancestorMap.get(ancestorId.toString())
        if (ancestor) {
          path.unshift(formatTopic(ancestor as unknown as TopicDocument & { createdBy: any }))
        }
      }
    }

    res.json(path)
  } catch (error) {
    console.error('[topics] getTopicPath error', error)
    res.status(500).json({ error: t('failedToGetTopicPath', req) })
  }
}
