import { Types } from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../server/database/connection.js'
import TopicModel from '../server/models/Topic.js'
import UserModel from '../server/models/User.js'

async function seedTopics() {
  await connectDatabase()

  try {
    // Check if Uncategorized topic already exists
    const existing = await TopicModel.findOne({ name: 'Uncategorized', deleted: false })
    if (existing) {
      console.info('[seed] Uncategorized topic already exists')
      await disconnectDatabase()
      return
    }

    // Get first admin user or create one
    let adminUser = await UserModel.findOne({ roles: 'admin' })
    if (!adminUser) {
      console.warn('[seed] No admin user found. Creating Uncategorized topic without creator.')
      // Create a system user or just use a placeholder ID
      adminUser = await UserModel.findOne().sort({ createdAt: 1 })
    }

    if (!adminUser) {
      throw new Error('No users found in database. Please create an admin user first.')
    }

    const uncategorized = new TopicModel({
      name: 'Uncategorized',
      description: 'Default topic for articles without a specific category',
      parentId: null,
      ancestors: [],
      createdBy: adminUser._id
    })

    const saved = await uncategorized.save()
    console.info(`[seed] Created Uncategorized topic with ID: ${saved._id}`)

    // Update existing articles without topicId to use Uncategorized
    const { default: ArticleModel } = await import('../server/models/Article.js')
    const updateResult = await ArticleModel.updateMany(
      { topicId: { $exists: false } },
      { $set: { topicId: saved._id } }
    )
    console.info(
      `[seed] Updated ${updateResult.modifiedCount} existing articles to use Uncategorized topic`
    )
  } catch (error) {
    console.error('[seed] Error seeding topics:', error)
    process.exit(1)
  } finally {
    await disconnectDatabase()
  }
}

seedTopics()
