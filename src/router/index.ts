import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ArticleView from '../views/ArticleView.vue'
import EditorView from '../views/EditorView.vue'
import DraftsView from '../views/DraftsView.vue'
import TopicView from '../views/TopicView.vue'
import AdminArticlesView from '../views/AdminArticlesView.vue'
import AdminTopicsView from '../views/AdminTopicsView.vue'
import LoginView from '../views/LoginView.vue'
import SignupView from '../views/SignupView.vue'
import VerifyEmailView from '../views/VerifyEmailView.vue'
import { useAuthStore } from '../stores/authStore'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/topic/:id',
      name: 'topic',
      component: TopicView
    },
    {
      path: '/drafts',
      name: 'drafts',
      component: DraftsView,
      meta: { requiresAuth: true }
    },
    {
      path: '/admin/articles',
      name: 'admin-articles',
      component: AdminArticlesView,
      meta: { requiresAuth: true, requiresAdmin: true }
    },
    {
      path: '/admin/topics',
      name: 'admin-topics',
      component: AdminTopicsView,
      meta: { requiresAuth: true, requiresEditor: true }
    },
    {
      path: '/editor/:id?',
      name: 'editor',
      component: EditorView,
      meta: { requiresAuth: true }
    },
    {
      path: '/article/:id',
      name: 'article',
      component: ArticleView
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/signup',
      name: 'signup',
      component: SignupView
    },
    {
      path: '/verify-email',
      name: 'verify-email',
      component: VerifyEmailView
    }
  ]
})

router.beforeEach(async to => {
  const auth = useAuthStore()
  if (!auth.initialised) {
    await auth.loadSession()
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return {
      name: 'login',
      query: { redirect: to.fullPath }
    }
  }

  if (to.meta.requiresAdmin && !auth.hasRole('admin')) {
    return { name: 'home' }
  }

  if (to.meta.requiresEditor && !auth.hasRole('editor') && !auth.hasRole('admin')) {
    return { name: 'home' }
  }

  if ((to.name === 'login' || to.name === 'signup') && auth.isAuthenticated) {
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/'
    return { path: redirect }
  }

  return true
})

export default router
