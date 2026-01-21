<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { Upload, Link as LinkIcon, X } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/authStore'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
  insert: [url: string]
}>()

const authStore = useAuthStore()
const activeTab = ref<'upload' | 'url'>('upload')
const imageUrl = ref('')
const selectedFile = ref<File | null>(null)
const uploadError = ref('')
const isUploading = ref(false)

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
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

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (file) {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!validTypes.includes(file.type)) {
      uploadError.value = 'Invalid file type. Please select a JPEG, PNG, GIF, WebP, or SVG image.'
      selectedFile.value = null
      return
    }
    
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      uploadError.value = 'File too large. Maximum size is 5MB.'
      selectedFile.value = null
      return
    }
    
    uploadError.value = ''
    selectedFile.value = file
  }
}

const handleUpload = async () => {
  if (!selectedFile.value) {
    uploadError.value = 'Please select a file'
    return
  }
  
  isUploading.value = true
  uploadError.value = ''
  
  try {
    const formData = new FormData()
    formData.append('image', selectedFile.value)
    
    const token = authStore.token
    const response = await fetch('/api/upload/image', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    })
    
    if (!response.ok) {
      let errorMessage = 'Upload failed'
      try {
        const error = await response.json()
        errorMessage = error.error || error.message || errorMessage
      } catch {
        errorMessage = `Upload failed: ${response.status} ${response.statusText}`
      }
      throw new Error(errorMessage)
    }
    
    const data = await response.json()
    // Prepend the base URL for the image
    const fullUrl = window.location.origin + data.url
    emit('insert', fullUrl)
    handleClose()
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : 'Upload failed'
  } finally {
    isUploading.value = false
  }
}

const handleUrlInsert = () => {
  if (!imageUrl.value.trim()) {
    return
  }
  emit('insert', imageUrl.value.trim())
  handleClose()
}

const handleClose = () => {
  // Reset state
  imageUrl.value = ''
  selectedFile.value = null
  uploadError.value = ''
  activeTab.value = 'upload'
  emit('close')
}
</script>

<template>
  <div v-if="isOpen" class="dialog-overlay" @click.self="handleClose">
    <div class="dialog-card">
      <div class="dialog-header">
        <h3>Insert Image</h3>
        <button @click="handleClose" class="close-btn" aria-label="Close">
          <X :size="20" />
        </button>
      </div>
      
      <div class="tabs">
        <button 
          :class="{ active: activeTab === 'upload' }" 
          @click="activeTab = 'upload'"
        >
          <Upload :size="16" />
          Upload
        </button>
        <button 
          :class="{ active: activeTab === 'url' }" 
          @click="activeTab = 'url'"
        >
          <LinkIcon :size="16" />
          URL
        </button>
      </div>
      
      <div class="dialog-body">
        <div v-if="activeTab === 'upload'" class="upload-section">
          <div class="file-input-wrapper">
            <input
              type="file"
              id="image-file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml"
              @change="handleFileChange"
              :disabled="isUploading"
            />
            <label for="image-file" class="file-label">
              <Upload :size="24" />
              <span v-if="!selectedFile">Choose image file</span>
              <span v-else class="file-name">{{ selectedFile.name }}</span>
            </label>
          </div>
          
          <div v-if="uploadError" class="error-message">{{ uploadError }}</div>
          
          <div class="help-text">
            Supported: JPEG, PNG, GIF, WebP, SVG (Max 5MB)
          </div>
          
          <button 
            @click="handleUpload" 
            :disabled="!selectedFile || isUploading"
            class="primary-btn"
          >
            {{ isUploading ? 'Uploading...' : 'Upload & Insert' }}
          </button>
        </div>
        
        <div v-else class="url-section">
          <input
            v-model="imageUrl"
            type="url"
            placeholder="https://example.com/image.jpg"
            class="url-input"
            @keyup.enter="handleUrlInsert"
          />
          
          <button 
            @click="handleUrlInsert" 
            :disabled="!imageUrl.trim()"
            class="primary-btn"
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
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
  max-width: 500px;
  max-height: 90vh;
  overflow: auto;
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

.tabs {
  display: flex;
  gap: 0.5rem;
  padding: 1rem 1.5rem 0;
  border-bottom: 1px solid var(--border-color);
}

.tabs button {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 500;
  transition: all 0.2s;
}

.tabs button:hover {
  color: var(--text-color);
}

.tabs button.active {
  color: var(--accent-color);
  border-bottom-color: var(--accent-color);
}

.dialog-body {
  padding: 1.5rem;
}

.upload-section,
.url-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.file-input-wrapper input[type="file"] {
  display: none;
}

.file-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem 1rem;
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.file-label:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: color-mix(in srgb, var(--accent-color) 5%, transparent);
}

.file-name {
  font-weight: 500;
  color: var(--text-color);
  word-break: break-all;
  text-align: center;
}

.help-text {
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-align: center;
}

.error-message {
  padding: 0.75rem;
  background: color-mix(in srgb, #ef4444 10%, transparent);
  border: 1px solid #ef4444;
  border-radius: var(--radius-sm);
  color: #dc2626;
  font-size: 0.875rem;
}

.url-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-color);
  color: var(--text-color);
  font-size: 1rem;
}

.url-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-color) 20%, transparent);
}

.primary-btn {
  padding: 0.75rem 1.5rem;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.primary-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent-color) 90%, black);
}

.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
