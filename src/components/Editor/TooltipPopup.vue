<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  content: string
  targetElement: HTMLElement | null
}>()

const emit = defineEmits<{
  close: []
}>()

const popupRef = ref<HTMLElement | null>(null)
const position = ref({ top: 0, left: 0 })

const renderedContent = computed(() => {
  // The content is already HTML from the editor
  return props.content
})

const updatePosition = () => {
  if (!props.targetElement || !popupRef.value) return
  
  const rect = props.targetElement.getBoundingClientRect()
  const popupRect = popupRef.value.getBoundingClientRect()
  
  // Position above the target element
  let top = rect.top - popupRect.height - 10
  let left = rect.left + (rect.width / 2) - (popupRect.width / 2)
  
  // Ensure popup doesn't go off screen
  if (top < 10) {
    // If not enough space above, show below
    top = rect.bottom + 10
  }
  
  if (left < 10) {
    left = 10
  } else if (left + popupRect.width > window.innerWidth - 10) {
    left = window.innerWidth - popupRect.width - 10
  }
  
  position.value = { top, left }
}

onMounted(() => {
  updatePosition()
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)
})

onUnmounted(() => {
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="popupRef"
      class="tooltip-popup"
      :style="{ top: position.top + 'px', left: position.left + 'px' }"
      @click.stop
    >
      <button class="close-btn" @click="emit('close')">
        <X :size="16" />
      </button>
      <div class="tooltip-content" v-html="renderedContent"></div>
    </div>
  </Teleport>
</template>

<style scoped>
.tooltip-popup {
  position: fixed;
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1rem;
  max-width: 400px;
  min-width: 200px;
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.2), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  z-index: 1000;
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.close-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: transparent;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--bg-color);
  color: var(--text-color);
}

.tooltip-content {
  padding-right: 1.5rem;
  line-height: 1.6;
}

.tooltip-content :deep(h1) {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
}

.tooltip-content :deep(h2) {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
}

.tooltip-content :deep(p) {
  margin: 0 0 0.5rem 0;
}

.tooltip-content :deep(p:last-child) {
  margin-bottom: 0;
}

.tooltip-content :deep(strong) {
  font-weight: 600;
}

.tooltip-content :deep(em) {
  font-style: italic;
}

.tooltip-content :deep(a) {
  color: var(--accent-color);
  text-decoration: underline;
}
</style>
