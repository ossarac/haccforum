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
  permanentlyDeleteArticle
} from '../controllers/articleController.js'
import { authenticate, optionalAuthenticate, requireAnyRole } from '../middleware/auth.js'

const router = Router()

router.get('/', optionalAuthenticate, listArticles)
router.get('/deleted', authenticate, requireAnyRole('admin'), getDeletedArticles)
router.get('/drafts/my', authenticate, getUserDrafts)
router.get('/:id', optionalAuthenticate, getArticle)
router.get('/:id/revisions', authenticate, getRevisions)
router.post('/', authenticate, requireAnyRole('admin', 'editor'), createArticle)
router.post('/:id/duplicate-draft', authenticate, duplicateToDraft)
router.post('/:id/export', authenticate, exportArticle)
router.post('/:id/undelete', authenticate, requireAnyRole('admin'), undeleteArticle)
router.patch('/:id', authenticate, requireAnyRole('admin', 'editor'), updateArticle)
router.delete('/:id', authenticate, requireAnyRole('admin'), deleteArticle)
router.delete('/:id/draft', authenticate, deleteDraft)
router.delete('/:id/permanent', authenticate, requireAnyRole('admin'), permanentlyDeleteArticle)
router.post('/:id/publish', authenticate, publishArticle)
router.post('/:id/unpublish', authenticate, unpublishArticle)

export default router
