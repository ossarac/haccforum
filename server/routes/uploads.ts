import express from 'express'
import multer from 'multer'
import path from 'path'
import { Storage } from '@google-cloud/storage'
import { authenticate } from '../middleware/auth.js'
import env from '../config/env.js'

const router = express.Router()
const storageClient = new Storage()
const bucket = storageClient.bucket(env.storageBucket)

// Configure multer to use memory storage
const storage = multer.memoryStorage()

// File filter to only allow images
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG are allowed.'))
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
})

// Upload image endpoint (requires authentication)
router.post('/image', authenticate, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }

  try {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(req.file.originalname)
    const filename = `uploads/${uniqueSuffix}${ext}`
    const blob = bucket.file(filename)
    
    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: req.file.mimetype,
    })

    blobStream.on('error', (err) => {
      console.error(err)
      res.status(500).json({ error: 'Upload to cloud storage failed' })
    })

    blobStream.on('finish', () => {
      // The public URL can be used to directly access the file via HTTP.
      // Use 'https://storage.googleapis.com/${bucket.name}/${blob.name}'
      // or if public access is enabled on the bucket:
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`
      
      res.json({
        url: publicUrl,
        filename: blob.name,
        size: req.file!.size,
        mimetype: req.file!.mimetype
      })
    })

    blobStream.end(req.file.buffer)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error during upload' })
  }
})

// Error handling for multer
router.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' })
    }
    return res.status(400).json({ error: err.message })
  }
  if (err) {
    return res.status(400).json({ error: err.message })
  }
  next()
})

export default router
