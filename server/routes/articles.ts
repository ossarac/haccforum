import { Router } from 'express'
import {
  createArticle,
  deleteDraft,
  duplicateToDraft,
  exportArticle,
  getArticle,
  getRevisions,
  getUserDrafts,
  listArticles,
  publishArticle,
  deleteArticle,
  unpublishArticle,
  updateArticle,
  getDeletedArticles,
  undeleteArticle,
  permanentlyDeleteArticle,
  getRecentArticles,
  getTopicStatistics
} from '../controllers/articleController.js'
import { authenticate, optionalAuthenticate, requireAnyRole, requireAuthIfGuestDisabled } from '../middleware/auth.js'

const router = Router()

// Reading routes - check guest access setting
router.get('/', optionalAuthenticate, requireAuthIfGuestDisabled, listArticles)
router.get('/recent', optionalAuthenticate, requireAuthIfGuestDisabled, getRecentArticles)
router.get('/topic-stats', optionalAuthenticate, requireAuthIfGuestDisabled, getTopicStatistics)

// Admin-only routes (place before param routes to avoid /deleted matching :id)
router.get('/deleted', authenticate, requireAnyRole('admin'), getDeletedArticles)
router.post('/:id/undelete', authenticate, requireAnyRole('admin'), undeleteArticle)
router.delete('/:id/permanent', authenticate, requireAnyRole('admin'), permanentlyDeleteArticle)
router.delete('/:id', authenticate, requireAnyRole('admin'), deleteArticle)

// Authenticated user routes (writer or admin can create/edit)
router.get('/drafts/my', authenticate, getUserDrafts)
router.get('/:id/revisions', authenticate, getRevisions)
router.post('/', authenticate, requireAnyRole('admin', 'writer'), createArticle)
router.post('/:id/duplicate-draft', authenticate, requireAnyRole('admin', 'writer'), duplicateToDraft)
router.post('/:id/export', authenticate, exportArticle)
router.patch('/:id', authenticate, updateArticle)
router.delete('/:id/draft', authenticate, deleteDraft)
router.post('/:id/publish', authenticate, publishArticle)
router.post('/:id/unpublish', authenticate, unpublishArticle)

// Param route last to avoid swallowing fixed paths
router.get('/:id', optionalAuthenticate, requireAuthIfGuestDisabled, getArticle)

export default router
