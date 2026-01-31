import { Router } from 'express'
import {
  listTopics,
  getTopicWithChildren,
  createTopic,
  updateTopic,
  deleteTopic,
  getTopicPath,
  mergeTopics
} from '../controllers/topicController.js'
import { authenticate, optionalAuthenticate, requireAnyRole, requireAuthIfGuestDisabled } from '../middleware/auth.js'

const router = Router()

// List all root topics - check guest access
router.get('/', optionalAuthenticate, requireAuthIfGuestDisabled, listTopics)

// Merge topics (admin only) - keep before dynamic :id routes
router.post('/merge', authenticate, requireAnyRole('admin'), mergeTopics)

// Get topic with children - check guest access
router.get('/:id', optionalAuthenticate, requireAuthIfGuestDisabled, getTopicWithChildren)

// Get topic path (breadcrumb) - check guest access
router.get('/:id/path', optionalAuthenticate, requireAuthIfGuestDisabled, getTopicPath)

// Create topic (admin or writer)
router.post('/', authenticate, requireAnyRole('admin', 'writer'), createTopic)

// Update topic (admin or writer)
router.patch('/:id', authenticate, requireAnyRole('admin', 'writer'), updateTopic)

// Delete topic (admin only)
router.delete('/:id', authenticate, requireAnyRole('admin'), deleteTopic)

export default router
