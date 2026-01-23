<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import RichEditor from './RichEditor.vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  isOpen: boolean
  title: string
  initialContent?: string
  showDelete?: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [content: string]
  delete: []
}>()

const content = ref(props.initialContent || '')

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    content.value = props.initialContent || ''
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'
  } else {
    // Restore body scroll when modal closes
    document.body.style.overflow = ''
  }
})

onUnmounted(() => {
  // Clean up: restore body scroll when component unmounts
  document.body.style.overflow = ''
})

const handleSave = () => {
  emit('save', content.value)
  emit('close')
}

const handleCancel = () => {
  emit('close')
}

const handleDelete = () => {
  emit('delete')
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="handleCancel">
      <div class="modal-dialog">
        <div class="modal-header">
          <h2>{{ title }}</h2>
          <button @click="handleCancel" class="close-btn">
            <X :size="20" />
          </button>
        </div>
        
        <div class="modal-body">
          <div class="editor-container">
            <RichEditor v-model="content" :editable="true" />
          </div>
        </div>
        
        <div class="modal-footer">
          <button v-if="showDelete" @click="handleDelete" class="danger">Delete</button>
          <div class="spacer"></div>
          <button @click="handleCancel" class="secondary">Cancel</button>
          <button @click="handleSave" class="primary">Save</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
  overflow: hidden;
}

.modal-dialog {
  background: var(--surface-color);
  border-radius: var(--radius-md);
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  width: 90%;
  max-width: 900px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.close-btn {
  background: transparent;
  border: none;
  padding: 0.25rem;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.close-btn:hover {
  background: var(--bg-color);
  color: var(--text-color);
}

.modal-body {
  flex: 1;
  overflow: hidden;
  padding: 0;
  display: flex;
  flex-direction: column;
  min-height: 350px;
  max-height: 50vh;
}

.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1rem;
  overflow: visible;
  min-height: 0;
}

/* Override the RichEditor styles for modal context */
.editor-container :deep(.editor-wrapper) {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 0.75rem;
  overflow: hidden;
}

.editor-container :deep(.toolbar) {
  position: relative !important;
  top: auto !important;
  flex-shrink: 0;
  z-index: 100;
}

.editor-container :deep(.editor-content) {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0; /* Allow shrinking below min-content */
  padding: 1rem !important; /* Override large page-card padding */
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
  background: var(--surface-color);
  flex-shrink: 0;
}

.spacer {
  flex: 1;
}

button.secondary {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

button.secondary:hover {
  background: var(--bg-color);
}

button.primary {
  background: var(--accent-color);
  border: none;
  color: white;
  padding: 0.5rem 1.5rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 500;
}

button.primary:hover {
  opacity: 0.9;
}

button.danger {
  background: var(--danger-color, #ef4444);
  border: none;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 500;
}

button.danger:hover {
  opacity: 0.9;
}
</style>
