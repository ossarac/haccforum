<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { X } from 'lucide-vue-next'

export type DialogType = 'alert' | 'confirm' | 'input'

const props = defineProps<{
  isOpen: boolean
  title: string
  message: string
  type?: DialogType
  placeholder?: string
  initialValue?: string
  confirmText?: string
  cancelText?: string
  confirmLoading?: boolean
  hideFooter?: boolean
}>()

const emit = defineEmits<{
  close: []
  confirm: [value?: string]
  cancel: []
}>()

const inputValue = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    inputValue.value = props.initialValue ?? ''
    if (props.type === 'input') {
      nextTick(() => {
        inputEl.value?.focus()
        inputEl.value?.select()
      })
    }
  }
})

const handleClose = () => {
  if (props.confirmLoading) return
  emit('close')
}

const handleConfirm = () => {
  if (props.confirmLoading) return
  if (props.type === 'input') {
    emit('confirm', inputValue.value)
  } else {
    emit('confirm')
  }
  // Only auto-close if not loading (though usually handled by parent)
  if (!props.confirmLoading) {
    emit('close')
  }
}

const handleCancel = () => {
  if (props.confirmLoading) return
  emit('cancel')
  emit('close')
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && props.type !== 'confirm') {
    handleConfirm()
  } else if (event.key === 'Escape') {
    handleClose()
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="dialog-overlay" @click.self="handleClose" @keydown="handleKeydown">
      <div class="dialog-card" tabindex="-1" @keydown="handleKeydown">
        <div class="dialog-header">
          <h3>{{ title }}</h3>
          <button @click="handleClose" class="close-btn" aria-label="Close" :disabled="confirmLoading">
            <X :size="20" />
          </button>
        </div>

        <div class="dialog-body">
          <slot name="content">
            <p class="dialog-message">{{ message }}</p>

            <div v-if="type === 'input'" class="input-section">
              <input
                v-model="inputValue"
                :placeholder="placeholder"
                class="dialog-input"
                ref="inputEl"
                @keydown="handleKeydown"
              />
            </div>
          </slot>
        </div>

        <div class="dialog-footer" v-if="!hideFooter">
          <slot name="footer">
            <button
              v-if="type === 'confirm' || type === 'input'"
              @click="handleCancel"
              class="secondary-btn"
              :disabled="confirmLoading"
            >
              {{ cancelText || 'Cancel' }}
            </button>
            <button 
              @click="handleConfirm" 
              class="primary-btn"
              :disabled="confirmLoading"
            >
              <span v-if="confirmLoading" class="loading-spinner"></span>
              {{ confirmText || 'OK' }}
            </button>
          </slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
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
  padding: 1rem;
}

.dialog-card {
  background: var(--surface-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 400px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.dialog-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-color);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--bg-color);
  color: var(--text-color);
}

.dialog-body {
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
}

.dialog-message {
  margin: 0 0 1rem 0;
  color: var(--text-color);
  line-height: 1.5;
}

.input-section {
  margin-top: 1rem;
}

.dialog-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 1rem;
  box-sizing: border-box;
}

.dialog-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-color) 20%, transparent);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
  background: var(--surface-color);
}

.secondary-btn {
  padding: 0.5rem 1rem;
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  color: var(--text-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.secondary-btn:hover {
  background: var(--bg-color);
}

.primary-btn {
  padding: 0.5rem 1.5rem;
  background: var(--accent-color);
  border: none;
  color: white;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.primary-btn:hover {
  background: color-mix(in srgb, var(--accent-color) 90%, black);
}
</style>
