import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { apiRequest } from '../api/client'

export interface ArticleAuthor {
    id: string
    name: string
    email: string
}

export interface Article {
    id: string
    title: string
    content: string
    parentId: string | null
    ancestors: string[]
    topicId: string | null
    version: number
    published: boolean
    publishedAt: string | null
    deleted?: boolean
    deletedAt?: string | null
    createdAt: string
    updatedAt: string
    authorName?: string
    author: ArticleAuthor
}

export interface ArticleRevision {
    version: number
    title: string
    updatedAt: string
    updatedBy: {
        id: string
        name: string
    }
}

interface SaveArticleInput {
    id?: string
    title: string
    content: string
    authorName?: string
    parentId?: string | null
    topicId?: string | null
}

const ROOT_KEY = 'root'

function keyForParent(parentId: string | null | undefined) {
    return parentId ?? ROOT_KEY
}

export const useArticleStore = defineStore('article', () => {
    const articlesById = reactive<Record<string, Article>>({})
    const childrenIndex = reactive<Record<string, string[]>>({})
    const revisionsByArticle = reactive<Record<string, ArticleRevision[]>>({})
    const userDrafts = ref<Article[]>([])
    const loadingStates = reactive<Record<string, boolean>>({})

    const getChildren = (parentId: string | null) => {
        const key = keyForParent(parentId)
        return (childrenIndex[key] ?? [])
            .map(id => articlesById[id])
            .filter(child => !!child && !child.deleted)
    }

    const allArticles = computed(() => Object.values(articlesById))

    const setChildren = (parentId: string | null, items: Article[]) => {
        const key = keyForParent(parentId)
        childrenIndex[key] = items.map(item => item.id)
        items.forEach(item => {
            const existing = articlesById[item.id]
            if (existing && existing.parentId !== item.parentId) {
                const oldKey = keyForParent(existing.parentId)
                childrenIndex[oldKey] = (childrenIndex[oldKey] ?? []).filter(id => id !== item.id)
            }
            articlesById[item.id] = item
        })
    }

    const mergeArticle = (article: Article) => {
        const previous = articlesById[article.id]
        // If backend payload omits authorName, keep the last known value so we don't wipe it locally
        const mergedArticle: Article = {
            ...previous,
            ...article,
            authorName: article.authorName ?? previous?.authorName
        }
        if (previous && previous.parentId !== article.parentId) {
            const oldKey = keyForParent(previous.parentId)
            childrenIndex[oldKey] = (childrenIndex[oldKey] ?? []).filter(id => id !== article.id)
        }

        articlesById[article.id] = mergedArticle
        const key = keyForParent(article.parentId)
        const existing = childrenIndex[key] ?? []
        childrenIndex[key] = [mergedArticle.id, ...existing.filter(id => id !== mergedArticle.id)]
    }

    const fetchByParent = async (parentId: string | null = null) => {
        const key = keyForParent(parentId)
        loadingStates[key] = true
        try {
            const query = parentId ? `?parentId=${encodeURIComponent(parentId)}` : ''
            const response = await apiRequest<{ articles: Article[] }>(`/articles${query}`)
            setChildren(parentId, response.articles)
            return response.articles
        } finally {
            loadingStates[key] = false
        }
    }

    const fetchArticle = async (id: string) => {
        loadingStates[id] = true
        try {
            const response = await apiRequest<{ article: Article; revisions: ArticleRevision[] }>(`/articles/${id}`)
            mergeArticle(response.article)
            revisionsByArticle[id] = response.revisions
            return response.article
        } finally {
            loadingStates[id] = false
        }
    }

    const saveArticle = async (input: SaveArticleInput) => {
        if (input.id) {
            const current = articlesById[input.id]
            if (!current) {
                throw new Error('Article state out of date. Reload and try again.')
            }
            const payload = {
                title: input.title,
                content: input.content,
                authorName: input.authorName,
                parentId: input.parentId ?? null,
                topicId: input.topicId ?? null,
                version: current.version
            }

            const response = await apiRequest<{ article: Article }>(`/articles/${input.id}`, {
                method: 'PATCH',
                body: JSON.stringify(payload)
            })
            mergeArticle(response.article)
            return response.article
        }

        const response = await apiRequest<{ article: Article }>('/articles', {
            method: 'POST',
            body: JSON.stringify({
                title: input.title,
                content: input.content,
                authorName: input.authorName,
                parentId: input.parentId ?? null,
                topicId: input.topicId ?? null
            })
        })
        mergeArticle(response.article)
        return response.article
    }

    /**
     * Fetch all draft articles for the current user
     * Drafts are articles that have not been published yet
     */
    const fetchUserDrafts = async () => {
        loadingStates['drafts'] = true
        try {
            const response = await apiRequest<{ articles: Article[] }>('/articles/drafts/my')
            userDrafts.value = response.articles
            // Also add to the cache
            response.articles.forEach(article => {
                articlesById[article.id] = article
            })
            return response.articles
        } finally {
            loadingStates['drafts'] = false
        }
    }

    /**
     * Publish a draft article
     * Sets the published flag to true, making it visible on the dashboard
     */
    const publishArticle = async (id: string) => {
        const article = articlesById[id]
        if (!article) {
            throw new Error('Article not found in cache')
        }

        const response = await apiRequest<{ article: Article }>(`/articles/${id}/publish`, {
            method: 'POST'
        })

        mergeArticle(response.article)
        // Remove from drafts list
        userDrafts.value = userDrafts.value.filter(draft => draft.id !== id)
        return response.article
    }

    /**
     * Duplicate a published article into a new draft for the current user
     */
    const duplicateToDraft = async (id: string) => {
        const response = await apiRequest<{ article: Article }>(`/articles/${id}/duplicate-draft`, {
            method: 'POST'
        })

        mergeArticle(response.article)
        userDrafts.value = [response.article, ...userDrafts.value.filter(draft => draft.id !== response.article.id)]
        return response.article
    }

    /**
     * Unpublish a recently published article that has no replies
     * Moves it back into the draft list for the author
     */
    const unpublishArticle = async (id: string) => {
        const article = articlesById[id]
        if (!article) {
            throw new Error('Article not found in cache')
        }

        const response = await apiRequest<{ article: Article }>(`/articles/${id}/unpublish`, {
            method: 'POST'
        })

        mergeArticle(response.article)

        // Remove from published children listings so it disappears from replies
        if (!response.article.published) {
            const parentKey = keyForParent(response.article.parentId)
            childrenIndex[parentKey] = (childrenIndex[parentKey] ?? []).filter(childId => childId !== response.article.id)
        }

        // Add to drafts for quick access
        userDrafts.value = [response.article, ...userDrafts.value.filter(draft => draft.id !== response.article.id)]
        return response.article
    }

    const deleteArticle = async (id: string) => {
        const response = await apiRequest<{ message: string; deletedCount?: number }>(`/articles/${id}`, {
            method: 'DELETE'
        })

        const timestamp = new Date().toISOString()
        const markDeleted = (article: Article) => {
            article.deleted = true
            article.deletedAt = timestamp
            article.published = false
            article.publishedAt = null
        }

        if (articlesById[id]) {
            markDeleted(articlesById[id])
        }

        Object.values(articlesById).forEach(article => {
            if (!article) return
            if (article.ancestors.includes(id)) {
                markDeleted(article)
            }
        })

        return response
    }

    /**
     * Permanently delete an unpublished draft
     * Only works for drafts that have not been published
     */
    const deleteDraft = async (id: string) => {
        const response = await apiRequest<{ message: string }>(`/articles/${id}/draft`, {
            method: 'DELETE'
        })

        // Remove from drafts list
        userDrafts.value = userDrafts.value.filter(draft => draft.id !== id)
        
        // Remove from articles cache
        delete articlesById[id]

        return response
    }

    const getArticle = (id: string) => articlesById[id] ?? null

    const getRevisions = (id: string) => revisionsByArticle[id] ?? []

    /**
     * Fetch recent articles for dashboard
     */
    const fetchRecentArticles = async (limit: number = 6) => {
        loadingStates['recent'] = true
        try {
            const response = await apiRequest<{ articles: Article[] }>(`/articles/recent?limit=${limit}`)
            response.articles.forEach(article => mergeArticle(article))
            return response.articles
        } finally {
            loadingStates['recent'] = false
        }
    }

    /**
     * Fetch topic statistics for dashboard
     */
    const fetchTopicStatistics = async () => {
        loadingStates['topic-stats'] = true
        try {
            const response = await apiRequest<{ 
                statistics: Array<{
                    _id: string | null
                    totalArticles: number
                    latestArticle: string | null
                    latestUpdate: string
                    latestArticles: Article[]
                }>
            }>('/articles/topic-stats')
            
            // Merge articles into cache
            response.statistics.forEach(stat => {
                stat.latestArticles.forEach(article => mergeArticle(article))
            })
            
            return response.statistics
        } finally {
            loadingStates['topic-stats'] = false
        }
    }

    /**
     * Fetch all articles for a specific topic (including subtopics)
     */
    const fetchArticlesByTopic = async (topicId: string) => {
        const cacheKey = `topic-${topicId}`
        loadingStates[cacheKey] = true
        try {
            const query = `?topicId=${encodeURIComponent(topicId)}`
            const response = await apiRequest<{ articles: Article[] }>(`/articles${query}`)
            response.articles.forEach(article => mergeArticle(article))
            return response.articles
        } finally {
            loadingStates[cacheKey] = false
        }
    }

    return {
        articlesById,
        allArticles,
        userDrafts,
        loadingStates,
        getArticle,
        getChildren,
        getRevisions,
        fetchByParent,
        fetchArticle,
        saveArticle,
        fetchUserDrafts,
        publishArticle,
        duplicateToDraft,
        unpublishArticle,
        deleteArticle,
        deleteDraft,
        fetchRecentArticles,
        fetchTopicStatistics,
        fetchArticlesByTopic
    }
})
