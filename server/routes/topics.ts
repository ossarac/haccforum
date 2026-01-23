import { Router } from 'express'
import {
  listTopics,
  getTopicWithChildren,
  createTopic,
  updateTopic,
  deleteTopic,
  getTopicPath
} from '../controllers/topicController.js'
import { authenticate, optionalAuthenticate, requireAnyRole } from '../middleware/auth.js'

const router = Router()

// List all root topics
router.get('/', optionalAuthenticate, listTopics)

// Get topic with children
router.get('/:id', optionalAuthenticate, getTopicWithChildren)

// Get topic path (breadcrumb)
router.get('/:id/path', optionalAuthenticate, getTopicPath)

// Create topic (admin/editor only)
router.post('/', authenticate, requireAnyRole('admin', 'editor'), createTopic)

// Update topic (admin/editor only)
router.patch('/:id', authenticate, requireAnyRole('admin', 'editor'), updateTopic)

// Delete topic (admin only)
router.delete('/:id', authenticate, requireAnyRole('admin'), deleteTopic)

export default router
