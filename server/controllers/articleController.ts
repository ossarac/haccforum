import type { Request, Response } from 'express'
import { Types } from 'mongoose'
import ArticleModel from '../models/Article.js'
import type { ArticleDocument } from '../models/Article.js'
import TopicModel from '../models/Topic.js'
import UserModel from '../models/User.js'
import { buildArticleExportHtml } from '../services/articleExport.js'
import { t } from '../i18n/index.js'

interface ArticleResponse {
  id: string
  title: string
  content: string
  parentId: string | null
  ancestors: string[]
  topicId: string | null
  version: number
  published: boolean
  publishedAt: string | null
  deleted: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  authorName?: string
  author: {
    id: string
    name: string
    email: string
  }
}

interface RevisionResponse {
  version: number
  title: string
  updatedAt: string
  updatedBy: {
    id: string
    name: string
  }
}

function isObjectId(value: unknown): value is Types.ObjectId {
  return value instanceof Types.ObjectId
}

function formatArticle(article: ArticleDocument & { author: any }): ArticleResponse {
  const author = article.author
  const authorId = isObjectId(author) ? author.toString() : author?._id?.toString() ?? ''
  return {
    id: article._id.toString(),
    title: article.title,
    content: article.content,
    parentId: article.parentId ? article.parentId.toString() : null,
    ancestors: article.ancestors.map(id => id.toString()),
    topicId: article.topicId ? article.topicId.toString() : null,
    version: article.version,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
    authorName: article.authorName,
    author: {
      id: authorId,
      name: author?.name ?? '',
      email: author?.email ?? ''
    },
    published: article.published ?? false,
    publishedAt: article.publishedAt ? article.publishedAt.toISOString() : null,
    deleted: article.deleted ?? false,
    deletedAt: article.deletedAt ? article.deletedAt.toISOString() : null
  }
}

function parseBooleanFlag(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase())
}

function isAdminUser(req: Request): boolean {
  return req.user?.roles?.includes('admin') ?? false
}

async function formatRevisions(article: ArticleDocument): Promise<RevisionResponse[]> {
  const updaterIds = article.revisions.map(rev => rev.updatedBy)
  const uniqueIds = Array.from(new Set(updaterIds.map(id => id.toString())))
  const users = await UserModel.find({ _id: { $in: uniqueIds } }).select('name')
  const userMap = new Map(users.map(user => [user._id.toString(), user.name]))
  return article.revisions
    .slice()
    .sort((a, b) => b.version - a.version)
    .map(rev => ({
      version: rev.version,
      title: rev.title,
      updatedAt: rev.updatedAt.toISOString(),
      updatedBy: {
        id: rev.updatedBy.toString(),
        name: userMap.get(rev.updatedBy.toString()) ?? 'Unknown'
      }
    }))
}

function validateParentId(parentId: unknown, req?: Request): Types.ObjectId | null {
  if (parentId === null || parentId === undefined || parentId === '') {
    return null
  }
  if (typeof parentId !== 'string' || !Types.ObjectId.isValid(parentId)) {
    throw new Error(t('invalidParentId', req))
  }
  return new Types.ObjectId(parentId)
}

async function resolveAncestors(parent: Types.ObjectId | null, req?: Request): Promise<Types.ObjectId[]> {
  if (!parent) {
    return []
  }
  const parentArticle = await ArticleModel.findById(parent)
  if (!parentArticle) {
    throw new Error(t('parentArticleNotFound', req))
  }
  if (parentArticle.deleted) {
    throw new Error(t('parentArticleDeleted', req))
  }
  return [...parentArticle.ancestors, parentArticle._id]
}

export async function listArticles(req: Request, res: Response): Promise<void> {
  const { parentId, topicId } = req.query
  const isAdmin = isAdminUser(req)
  const includeDeleted = isAdmin && parseBooleanFlag(req.query.includeDeleted)

  let parentFilter: Record<string, unknown>
  if (!parentId || parentId === 'root') {
    parentFilter = { parentId: null }
  } else if (typeof parentId === 'string' && Types.ObjectId.isValid(parentId)) {
    parentFilter = { parentId }
  } else {
    res.status(400).json({ message: t('invalidParentIdParameter', req) })
    return
  }

  const filters: Record<string, unknown>[] = [parentFilter]
  
  // Add topicId filter if provided
  if (topicId && typeof topicId === 'string' && Types.ObjectId.isValid(topicId)) {
    filters.push({ topicId })
  } else if (topicId && typeof topicId === 'string') {
    res.status(400).json({ message: t('invalidTopicIdParameter', req) })
    return
  }

  // Filter out deleted articles unless admin explicitly requests them
  if (!includeDeleted) {
    filters.push({ deleted: { $ne: true } })
  }
  
  // Always filter for published articles (drafts are accessed via /drafts/my endpoint)
  filters.push({ $or: [{ published: true }, { published: { $exists: false } }] })

  console.log(`[listArticles] Query filters:`, JSON.stringify(filters, null, 2))
  const articles = await ArticleModel.find({ $and: filters })
    .sort({ createdAt: -1 })
    .populate('author', 'name email')
  
  console.log(`[listArticles] Found ${articles.length} articles with parentFilter:`, JSON.stringify(parentFilter, null, 2))
  articles.forEach(a => {
    console.log(`  - ${a._id}: title="${a.title}" deleted=${a.deleted} published=${a.published}`)
  })
  
  res.status(200).json({ articles: articles.map(formatArticle) })
}

export async function getArticle(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const isAdmin = isAdminUser(req)
  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: t('invalidArticleId', req) })
    return
  }

  const article = await ArticleModel.findById(id).populate('author', 'name email')
  if (!article) {
    res.status(404).json({ message: t('articleNotFound', req) })
    return
  }

  if (article.deleted && !isAdmin) {
    res.status(404).json({ message: t('articleNotFound', req) })
    return
  }

  const revisions = await formatRevisions(article)
  res.status(200).json({ article: formatArticle(article), revisions })
}

export async function createArticle(req: Request, res: Response): Promise<void> {
  const { title, content, parentId, topicId, authorName } = req.body ?? {}
  if (!req.user) {
    res.status(401).json({ message: t('unauthorized', req) })
    return
  }
  if (!title || !content) {
    res.status(400).json({ message: t('titleAndContentRequired', req) })
    return
  }

  let parent: Types.ObjectId | null
  try {
    parent = validateParentId(parentId, req)
  } catch (error) {
    res.status(400).json({ message: (error as Error).message })
    return
  }

  let ancestors: Types.ObjectId[] = []
  let resolvedTopicId: Types.ObjectId | null = null

  try {
    ancestors = await resolveAncestors(parent, req)
  } catch (error) {
    res.status(400).json({ message: (error as Error).message })
    return
  }

  // Handle topicId logic
  if (parent) {
    // Child article: inherit parent's topicId
    const parentArticle = await ArticleModel.findById(parent)
    if (parentArticle) {
      resolvedTopicId = parentArticle.topicId
    }
  } else {
    // Root article: topicId is required
    if (!topicId) {
      res.status(400).json({ message: t('topicIdRequired', req) })
      return
    }

    if (!Types.ObjectId.isValid(topicId)) {
      res.status(400).json({ message: t('invalidTopicId', req) })
      return
    }

    // Verify topic exists and is not deleted
    const topic = await TopicModel.findById(topicId)
    if (!topic || topic.deleted) {
      res.status(404).json({ message: t('topicNotFound', req) })
      return
    }

    resolvedTopicId = new Types.ObjectId(topicId)
  }

  const article = await ArticleModel.create({
    title,
    content,
    authorName,
    parentId: parent,
    ancestors,
    topicId: resolvedTopicId,
    author: new Types.ObjectId(req.user.id),
    version: 1
  })

  await article.populate('author', 'name email')
  res.status(201).json({ article: formatArticle(article) })
}

export async function updateArticle(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const { title, content, parentId, topicId, version, authorName } = req.body ?? {}

  if (!req.user) {
    res.status(401).json({ message: t('unauthorized', req) })
    return
  }

  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: t('invalidArticleId', req) })
    return
  }

  if (typeof version !== 'number') {
    res.status(400).json({ message: t('versionRequired', req) })
    return
  }

  const article = await ArticleModel.findById(id)
  if (!article) {
    res.status(404).json({ message: t('articleNotFound', req) })
    return
  }

  if (article.deleted) {
    res.status(404).json({ message: t('articleNotFound', req) })
    return
  }

  if (version !== article.version) {
    res.status(409).json({ message: t('articleModified', req) })
    return
  }

  // Check if user is author (needed for topic change permission and update permission)
  const isAuthor = article.author.equals(new Types.ObjectId(req.user.id))
  const isAdmin = isAdminUser(req)

  // Only author or admin can update article
  if (!isAuthor && !isAdmin) {
    res.status(403).json({ message: t('onlyAuthorOrAdminCanUpdate', req) })
    return
  }

  let newParent: Types.ObjectId | null
  try {
    newParent = validateParentId(parentId ?? article.parentId?.toString() ?? null, req)
  } catch (error) {
    res.status(400).json({ message: (error as Error).message })
    return
  }

  if (newParent && newParent.equals(article._id)) {
    res.status(400).json({ message: t('articleCannotBeOwnParent', req) })
    return
  }

  let ancestors: Types.ObjectId[] = []
  try {
    ancestors = await resolveAncestors(newParent, req)
  } catch (error) {
    res.status(400).json({ message: (error as Error).message })
    return
  }

  if (ancestors.some(ancestorId => ancestorId.equals(article._id))) {
    res.status(400).json({ message: t('cannotMoveUnderDescendant', req) })
    return
  }

  // Handle topicId changes
  let newTopicId = article.topicId
  if (topicId !== undefined) {
    // Topic can only be changed for root articles (parentId === null)
    if (article.parentId) {
      res.status(400).json({ message: t('cannotChangeTopicOfChild', req) })
      return
    }

    // Topic can be changed if:
    // - Article is a draft (not published), OR
    // - User is admin (admins can change topic even on published articles)
    const isDraft = !article.published
    if (!isDraft && !isAdmin) {
      res.status(403).json({ message: t('cannotChangeTopicPublished', req) })
      return
    }

    // Only author or admin can change topic
    if (!isAuthor && !isAdmin) {
      res.status(403).json({ message: t('onlyAuthorOrAdminCanChangeTopic', req) })
      return
    }

    if (topicId === null) {
      newTopicId = null
    } else {
      if (!Types.ObjectId.isValid(topicId)) {
        res.status(400).json({ message: t('invalidTopicId', req) })
        return
      }

      // Verify topic exists and is not deleted
      const topic = await TopicModel.findById(topicId)
      if (!topic || topic.deleted) {
        res.status(404).json({ message: t('topicNotFound', req) })
        return
      }

      newTopicId = new Types.ObjectId(topicId)
    }
  }

  article.revisions.push({
    title: article.title,
    content: article.content,
    version: article.version,
    updatedAt: new Date(),
    updatedBy: new Types.ObjectId(req.user.id)
  })

  if (typeof title === 'string') {
    article.title = title
  }
  if (typeof content === 'string') {
    article.content = content
  }
  if (typeof authorName === 'string') {
    article.authorName = authorName
  }

  article.parentId = newParent
  article.ancestors = ancestors
  article.topicId = newTopicId
  article.version += 1

  await article.save()
  await article.populate('author', 'name email')

  res.status(200).json({ article: formatArticle(article) })
}

export async function getRevisions(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const isAdmin = isAdminUser(req)
  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: t('invalidArticleId', req) })
    return
  }

  const article = await ArticleModel.findById(id)
  if (!article) {
    res.status(404).json({ message: t('articleNotFound', req) })
    return
  }

  if (article.deleted && !isAdmin) {
    res.status(404).json({ message: t('articleNotFound', req) })
    return
  }

  const revisions = await formatRevisions(article)
  res.status(200).json({ revisions })
}

/**
 * Fetch all unpublished draft articles by the current user
 * Users can only access their own drafts
 */
export async function getUserDrafts(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: t('unauthorized', req) })
    return
  }

  const articles = await ArticleModel.find({
    author: new Types.ObjectId(req.user.id),
    published: false,
    deleted: { $ne: true }
  })
    .sort({ updatedAt: -1 })
    .populate('author', 'name email')

  res.status(200).json({ articles: articles.map(formatArticle) })
}

/**
 * Publish an article by setting published to true
 * Performs authorization check to ensure only the article author can publish
 */
export async function publishArticle(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!req.user) {
    res.status(401).json({ message: t('unauthorized', req) })
    return
  }

  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: t('invalidArticleId', req) })
    return
  }

  const article = await ArticleModel.findById(id)
  if (!article) {
    res.status(404).json({ message: t('articleNotFound', req) })
    return
  }

  // Ensure only the author can publish their draft
  if (!article.author.equals(new Types.ObjectId(req.user.id))) {
    res.status(403).json({ message: t('noPermissionToPublish', req) })
    return
  }

  article.published = true
  article.publishedAt = new Date()
  await article.save()
  await article.populate('author', 'name email')

  res.status(200).json({ article: formatArticle(article) })
}

/**
 * Unpublish an article if it has no replies and was published within 24 hours
 * Only the author can unpublish their own article
 */
export async function unpublishArticle(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!req.user) {
    res.status(401).json({ message: t('unauthorized', req) })
    return
  }

  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: t('invalidArticleId', req) })
    return
  }

  const article = await ArticleModel.findById(id)
  if (!article) {
    res.status(404).json({ message: t('articleNotFound', req) })
    return
  }

  if (!article.author.equals(new Types.ObjectId(req.user.id))) {
    res.status(403).json({ message: t('noPermissionToUnpublish', req) })
    return
  }

  if (!article.published) {
    res.status(400).json({ message: t('articleNotPublished', req) })
    return
  }

  const replyCount = await ArticleModel.countDocuments({ parentId: article._id })
  if (replyCount > 0) {
    res.status(400).json({ message: t('cannotUnpublishWithReplies', req) })
    return
  }

  const publishedAt = article.publishedAt ?? article.updatedAt ?? article.createdAt
  const elapsedMs = Date.now() - publishedAt.getTime()
  const twentyFourHoursMs = 24 * 60 * 60 * 1000

  if (elapsedMs > twentyFourHoursMs) {
    res.status(400).json({ message: t('unpublishWindowPassed', req) })
    return
  }

  article.published = false
  article.publishedAt = null
  await article.save()
  await article.populate('author', 'name email')

  res.status(200).json({ article: formatArticle(article) })
}

/**
 * Permanently delete an unpublished draft article
 * Only the author can delete their own draft
 * This permanently removes the draft from the database
 */
export async function deleteDraft(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!req.user) {
    res.status(401).json({ message: t('unauthorized', req) })
    return
  }

  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: t('invalidArticleId', req) })
    return
  }

  const article = await ArticleModel.findById(id)
  if (!article) {
    res.status(404).json({ message: t('articleNotFound', req) })
    return
  }

  // Only author can delete their own draft
  if (!article.author.equals(new Types.ObjectId(req.user.id))) {
    res.status(403).json({ message: t('noPermissionToDeleteDraft', req) })
    return
  }

  // Can only delete unpublished articles
  if (article.published) {
    res.status(400).json({ message: t('cannotDeletePublished', req) })
    return
  }

  // Permanently delete the draft
  await ArticleModel.findByIdAndDelete(id)

  res.status(200).json({ message: t('draftDeletedSuccessfully', req) })
}

/**
 * Duplicate a published article into a new draft for the same author
 */
export async function duplicateToDraft(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!req.user) {
    res.status(401).json({ message: t('unauthorized', req) })
    return
  }

  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: t('invalidArticleId', req) })
    return
  }

  const article = await ArticleModel.findById(id)
  if (!article) {
    res.status(404).json({ message: t('articleNotFound', req) })
    return
  }

  if (!article.author.equals(new Types.ObjectId(req.user.id))) {
    res.status(403).json({ message: t('noPermissionToDuplicate', req) })
    return
  }

  if (article.published === false) {
    res.status(400).json({ message: t('onlyPublishedCanDuplicate', req) })
    return
  }

  let ancestors: Types.ObjectId[] = []
  try {
    ancestors = await resolveAncestors(article.parentId, req)
  } catch (error) {
    res.status(400).json({ message: (error as Error).message })
    return
  }

  const draft = await ArticleModel.create({
    title: article.title ? `Copy of ${article.title}` : 'Copy of Untitled',
    content: article.content,
    parentId: article.parentId,
    ancestors,
    author: new Types.ObjectId(req.user.id),
    version: 1,
    published: false
  })

  await draft.populate('author', 'name email')
  res.status(201).json({ article: formatArticle(draft) })
}

/**
 * Soft-delete an article and all of its replies (descendants)
 * Only admins can perform this action
 */
export async function deleteArticle(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!req.user) {
    res.status(401).json({ message: t('unauthorized', req) })
    return
  }

  const isAdmin = isAdminUser(req)
  if (!isAdmin) {
    res.status(403).json({ message: t('forbidden', req) })
    return
  }

  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: t('invalidArticleId', req) })
    return
  }

  const article = await ArticleModel.findById(id)
  if (!article) {
    res.status(404).json({ message: t('articleNotFound', req) })
    return
  }

  if (article.deleted) {
    res.status(200).json({ message: t('articleAlreadyDeleted', req), deletedCount: 0 })
    return
  }

  const now = new Date()
  const deleteUpdate = {
    deleted: true,
    deletedAt: now,
    deletedBy: new Types.ObjectId(req.user.id),
    published: false,
    publishedAt: null
  }

  const result = await ArticleModel.updateMany(
    { $or: [{ _id: article._id }, { ancestors: article._id }] },
    { $set: deleteUpdate }
  )

  res.status(200).json({ message: t('articleDeleted', req), deletedCount: result.modifiedCount ?? 0 })
}

/**
 * Export an article as a standalone HTML file
 * Only the author (or an admin) can export
 */
export async function exportArticle(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!req.user) {
    res.status(401).json({ message: t('unauthorized', req) })
    return
  }

  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: t('invalidArticleId', req) })
    return
  }

  const article = await ArticleModel.findById(id).populate('author', 'name email readingPreferences roles')
  if (!article) {
    res.status(404).json({ message: t('articleNotFound', req) })
    return
  }

  if (article.deleted) {
    res.status(404).json({ message: t('articleNotFound', req) })
    return
  }

  const isAuthor = article.author.equals(new Types.ObjectId(req.user.id))
  const isAdmin = req.user.roles?.includes('admin')
  if (!isAuthor && !isAdmin) {
    res.status(403).json({ message: t('noPermissionToExport', req) })
    return
  }

  const author = article.author as unknown as { name?: string; readingPreferences?: any }
  const { filename, html } = buildArticleExportHtml({
    article,
    authorName: article.authorName || author?.name || 'Unknown',
    prefs: author?.readingPreferences
  })

  res.setHeader('Content-Type', 'text/html')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.status(200).send(html)
}

export async function getDeletedArticles(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: t('unauthorized', req) })
    return
  }

  const isAdmin = isAdminUser(req)
  if (!isAdmin) {
    res.status(403).json({ message: t('forbiddenAdminOnly', req) })
    return
  }

  // Get all deleted articles with populated author
  const deletedArticles = await ArticleModel.find({ deleted: true })
    .populate('author', 'name email')
    .sort({ deletedAt: -1 })
    .lean()

  // Build a map for quick lookup
  const articleMap = new Map<string, any>()

  // First pass: create all formatted articles in the map
  for (const article of deletedArticles) {
    const formatted = formatArticle(article as any)
    articleMap.set(formatted.id, {
      ...formatted,
      children: []
    })
  }

  // Second pass: build hierarchy by finding children within the deleted articles list
  const rootArticles: any[] = []
  
  for (const article of deletedArticles) {
    const formatted = formatArticle(article as any)
    const current = articleMap.get(formatted.id)
    
    // Find children from the deleted articles list (more efficient than querying)
    const articleId = article._id.toString()
    for (const possibleChild of deletedArticles) {
      const parentId = possibleChild.parentId?.toString()
      if (parentId === articleId) {
        const childFormatted = formatArticle(possibleChild as any)
        const childNode = articleMap.get(childFormatted.id)
        if (childNode) {
          current.children.push(childNode)
        }
      }
    }

    // Only add top-level articles (no parent or parent is not deleted)
    if (!article.parentId) {
      rootArticles.push(current)
    }
  }

  res.status(200).json(rootArticles)
}

export async function undeleteArticle(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const { restoreChildren } = req.query

  if (!req.user) {
    res.status(401).json({ message: t('unauthorized', req) })
    return
  }

  const isAdmin = isAdminUser(req)
  if (!isAdmin) {
    res.status(403).json({ message: t('forbiddenAdminOnly', req) })
    return
  }

  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: t('invalidArticleId', req) })
    return
  }

  const article = await ArticleModel.findById(id)
  if (!article) {
    res.status(404).json({ message: t('articleNotFound', req) })
    return
  }

  if (!article.deleted) {
    res.status(400).json({ message: t('articleNotDeleted', req) })
    return
  }

  // Helper function to recursively undelete articles
  const undeleteRecursive = async (articleId: Types.ObjectId | string): Promise<void> => {
    const art = await ArticleModel.findById(articleId)
    if (!art) {
      console.log(`[undelete] Article not found: ${articleId}`)
      return
    }

    if (art.deleted) {
      console.log(`[undelete] Undeleting article ${art._id}: "${art.title}"`)
      art.deleted = false
      art.deletedAt = null
      art.deletedBy = null
      // Restore published status - articles are published by default when restored
      art.published = true
      art.publishedAt = new Date()
      
      const saved = await art.save()
      console.log(`[undelete] Saved article ${art._id}. New state: deleted=${saved.deleted}, published=${saved.published}`)
    } else {
      console.log(`[undelete] Article ${art._id} is not deleted, skipping save`)
    }

    // If this article has a parent, undelete it too
    if (art.parentId) {
      console.log(`[undelete] Article ${art._id} has parent ${art.parentId}, recursing...`)
      await undeleteRecursive(art.parentId)
    }
  }

  try {
    // Undelete the article and its ancestors
    await undeleteRecursive(article._id)

    // Restore all descendants - articles that have this article in their ancestors
    const descendants = await ArticleModel.find({
      ancestors: article._id,
      deleted: true
    })

    console.log(`[undelete] Found ${descendants.length} descendants of article ${article._id}`)
    for (const descendant of descendants) {
      await undeleteRecursive(descendant._id)
    }

    // Optionally undelete children if requested (this is for the UI "Restore All" button)
    if (restoreChildren === 'true') {
      const deletedChildren = await ArticleModel.find({
        parentId: article._id,
        deleted: true
      })

      console.log(`[undelete] Restoring ${deletedChildren.length} children for article ${article._id}`)
      for (const child of deletedChildren) {
        await undeleteRecursive(child._id)
      }
    }

    const updatedArticle = await ArticleModel.findById(id).populate('author', 'name email')
    console.log(`[undelete] Successfully restored article ${id}`)
    res.status(200).json(formatArticle(updatedArticle as any))
  } catch (error) {
    console.error(`[undelete] Error restoring article ${id}:`, error)
    res.status(500).json({ message: t('errorRestoringArticle', req) })
  }
}

export async function permanentlyDeleteArticle(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  if (!req.user) {
    res.status(401).json({ message: t('unauthorized', req) })
    return
  }

  const isAdmin = isAdminUser(req)
  if (!isAdmin) {
    res.status(403).json({ message: t('forbiddenAdminOnly', req) })
    return
  }

  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: t('invalidArticleId', req) })
    return
  }

  const article = await ArticleModel.findById(id)
  if (!article) {
    res.status(404).json({ message: t('articleNotFound', req) })
    return
  }

  if (!article.deleted) {
    res.status(400).json({ message: t('articleMustBeDeletedFirst', req) })
    return
  }

  await ArticleModel.findByIdAndDelete(id)
  res.status(200).json({ message: t('articlePermanentlyDeleted', req) })
}

/**
 * Get recent articles across all topics for dashboard
 * Returns the most recent published root articles
 */
export async function getRecentArticles(req: Request, res: Response): Promise<void> {
  const limit = parseInt(req.query.limit as string) || 6
  const isAdmin = isAdminUser(req)

  const filters: Record<string, unknown>[] = [
    { parentId: null }, // Only root articles
    { deleted: { $ne: true } }
  ]

  if (!isAdmin) {
    filters.push({ published: true })
  }

  const articles = await ArticleModel.find({ $and: filters })
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(limit)
    .populate('author', 'name email')

  res.status(200).json({ articles: articles.map(formatArticle) })
}

/**
 * Get topic statistics for dashboard
 * Returns article counts and latest activity per topic
 */
export async function getTopicStatistics(req: Request, res: Response): Promise<void> {
  const isAdmin = isAdminUser(req)
  
  const matchConditions: any = {
    parentId: null, // Only count root articles
    deleted: { $ne: true }
  }

  if (!isAdmin) {
    matchConditions.published = true
  }

  const stats = await ArticleModel.aggregate([
    { $match: matchConditions },
    {
      $group: {
        _id: '$topicId',
        totalArticles: { $sum: 1 },
        latestArticle: { $max: '$publishedAt' },
        latestUpdate: { $max: '$updatedAt' }
      }
    }
  ])

  // Get latest articles for each topic
  const topicArticles = await Promise.all(
    stats.map(async (stat) => {
      if (!stat._id) return { ...stat, _id: null, latestArticles: [] }
      
      const latest = await ArticleModel.find({
        topicId: stat._id,
        parentId: null,
        deleted: { $ne: true },
        ...(isAdmin ? {} : { published: true })
      })
        .sort({ publishedAt: -1, updatedAt: -1 })
        .limit(3)
        .populate('author', 'name email')

      return {
        ...stat,
        latestArticles: latest.map(formatArticle)
      }
    })
  )

  res.status(200).json({ statistics: topicArticles })
}
