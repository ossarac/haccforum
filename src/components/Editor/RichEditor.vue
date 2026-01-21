<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle, FontSize } from '@tiptap/extension-text-style'
import { Markdown } from 'tiptap-markdown'
import ContextNode from './extensions/ContextNode'
import TooltipMark from './extensions/TooltipMark'
import CustomImage from './extensions/CustomImage'
import ContentDialog from './ContentDialog.vue'
import TooltipPopup from './TooltipPopup.vue'
import ImageDialog from './ImageDialog.vue'
import Dialog from '../Dialog.vue'
import { 
  Heading1, Heading2, List, ListOrdered, 
  Quote, Undo, Redo, Link as LinkIcon,
  MessageSquare, Info, Bold, Italic, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Image as ImageIcon, MoveLeft, MoveRight, Minus
} from 'lucide-vue-next'
import { watch, ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  modelValue: string
  editable?: boolean
}>()

const emit = defineEmits(['update:modelValue'])

// Dialog state
const isDialogOpen = ref(false)
const dialogTitle = ref('')
const dialogContent = ref('')
const editingTooltipElement = ref<HTMLElement | null>(null)

// Image dialog state
const isImageDialogOpen = ref(false)

// Input dialog state
const inputDialogOpen = ref(false)
const inputDialogTitle = ref('')
const inputDialogMessage = ref('')
const inputDialogPlaceholder = ref('')
const inputDialogInitialValue = ref('')
const inputResolve = ref<((value: string | null) => void) | null>(null)

// Tooltip popup state (for preview mode)
const activeTooltip = ref<{ content: string; element: HTMLElement } | null>(null)

// Font size state
const currentFontSize = ref('16px')
const fontSizes = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px']

const editor = useEditor({
  content: props.modelValue,
  editable: props.editable ?? true,
  extensions: [
    StarterKit,
    ContextNode,
    TooltipMark,
    CustomImage,
    Placeholder.configure({
      placeholder: 'Write something amazing...',
    }),
    Link.configure({
      openOnClick: false,
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
    }),
    TextStyle,
    FontSize,
    Markdown.configure({
      html: true,
      transformCopiedText: true,
      transformPastedText: true,
    }),
  ],
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML())
  },
})

// Expose editor instance
defineExpose({ editor })

// Check if text is selected
const hasSelection = computed(() => {
  if (!editor.value) return false
  const { from, to } = editor.value.state.selection
  return from !== to
})

// Update content if external modelValue changes
watch(() => props.modelValue, (newVal) => {
  const isSame = editor.value?.getHTML() === newVal
  if (!isSame && editor.value) {
    editor.value.commands.setContent(newVal, { emitUpdate: false })
  }
})

// Update current font size when selection changes
watch(() => editor.value?.state.selection, () => {
  if (editor.value) {
    const fontSize = editor.value.getAttributes('textStyle').fontSize
    if (fontSize) {
      currentFontSize.value = fontSize
    } else {
      currentFontSize.value = '16px' // default
    }
  }
}, { deep: true })

const showInput = (title: string, message: string, placeholder: string, initialValue = ''): Promise<string | null> => {
  return new Promise((resolve) => {
    inputDialogTitle.value = title
    inputDialogMessage.value = message
    inputDialogPlaceholder.value = placeholder
    inputDialogInitialValue.value = initialValue
    inputResolve.value = resolve
    inputDialogOpen.value = true
  })
}

const handleInputConfirm = (value: string | undefined) => {
  if (inputResolve.value) {
    inputResolve.value(value || '')
    inputResolve.value = null
  }
  inputDialogOpen.value = false
}

const handleInputCancel = () => {
  if (inputResolve.value) {
    inputResolve.value(null)
    inputResolve.value = null
  }
  inputDialogOpen.value = false
}

const setLink = async () => {
  const previousUrl = editor.value?.getAttributes('link').href as string | undefined
  const url = await showInput(
    'Set Link',
    'Enter URL (full URL like https://example.com)',
    'https://example.com',
    previousUrl || ''
  )
  if (url === null) return
  if (url === '') {
    editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.value?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

const setFontSize = (size: string) => {
  currentFontSize.value = size
  editor.value?.chain().focus().setFontSize(size).run()
}

const addContext = () => {
  editor.value?.chain().focus().insertContent({
    type: 'contextComponent',
    content: [{ type: 'paragraph', content: [] }]
  }).run()
}

// Image functionality
const addImage = () => {
  isImageDialogOpen.value = true
}

const handleImageInsert = (url: string) => {
  editor.value?.chain().focus().setImage({ 
    src: url,
    align: 'left',
    float: 'none'
  }).run()
}

const isImageSelected = computed(() => {
  return editor.value?.isActive('customImage') || false
})

const setImageAlign = (align: 'left' | 'center' | 'right') => {
  editor.value?.chain().focus().setImageAlign(align).run()
}

const setImageFloat = (float: 'none' | 'left' | 'right') => {
  editor.value?.chain().focus().setImageFloat(float).run()
}

const setImageWidth = async () => {
  const width = await showInput('Set Image Width', 'Enter image width (e.g., 300, 50%, or auto)', '300')
  if (width) {
    editor.value?.chain().focus().setImageWidth(width).run()
  }
}

// Open tooltip dialog for NEW tooltip
const setTooltip = () => {
  if (!hasSelection.value) return
  
  editingTooltipElement.value = null
  dialogTitle.value = 'Add Tooltip'
  dialogContent.value = ''
  isDialogOpen.value = true
}

// Handle save from dialog
const handleDialogSave = (content: string) => {
  if (!content.trim()) {
    // Remove tooltip if empty
    if (editingTooltipElement.value) {
      // Editing existing - need to select that text and remove mark
      editor.value?.chain().focus().extendMarkRange('tooltip').unsetTooltip().run()
    }
  } else {
    // Apply tooltip
    editor.value?.chain().focus().extendMarkRange('tooltip').setTooltip({ content }).run()
  }
  isDialogOpen.value = false
  editingTooltipElement.value = null
}

// Handle click on tooltip elements
const handleTooltipClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const tooltipElement = target.closest('[data-tooltip-content]') as HTMLElement
  
  if (tooltipElement) {
    event.preventDefault()
    event.stopPropagation()
    
    const content = tooltipElement.getAttribute('data-tooltip-content') || ''
    
    if (props.editable) {
      // Edit mode: open dialog to edit the tooltip
      editingTooltipElement.value = tooltipElement
      dialogTitle.value = 'Edit Tooltip'
      dialogContent.value = content
      
      // Select the tooltip text in the editor
      // Find and select this text in the editor
      // Use a simple approach: focus and let user interact
      isDialogOpen.value = true
    } else {
      // Preview mode: show popup
      activeTooltip.value = { content, element: tooltipElement }
    }
  }
}

// Close tooltip popup
const closeTooltip = () => {
  activeTooltip.value = null
}

// Close popup when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (activeTooltip.value) {
    const target = event.target as HTMLElement
    if (!target.closest('.tooltip-popup') && !target.closest('[data-tooltip-content]')) {
      closeTooltip()
    }
  }
}

// Setup click listeners
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Add click listener to editor content
watch(() => editor.value, (ed) => {
  if (ed) {
    ed.view.dom.addEventListener('click', handleTooltipClick)
  }
}, { immediate: true })
</script>

<template>
  <div class="editor-wrapper" :class="{ 'is-editable': editable }">
    <div v-if="editor && editable" class="toolbar flex-row gap-2">
      <button @click="editor.chain().focus().toggleBold().run()" :class="{ 'is-active': editor.isActive('bold') }" title="Bold">
        <Bold :size="16" />
      </button>
      <button @click="editor.chain().focus().toggleItalic().run()" :class="{ 'is-active': editor.isActive('italic') }" title="Italic">
        <Italic :size="16" />
      </button>
      <button @click="editor.chain().focus().toggleStrike().run()" :class="{ 'is-active': editor.isActive('strike') }" title="Strike">
        <Strikethrough :size="16" />
      </button>
      <div class="divider"></div>
      <select @change="setFontSize(($event.target as HTMLSelectElement).value)" :value="currentFontSize" class="font-size-select" title="Font Size">
        <option v-for="size in fontSizes" :key="size" :value="size">{{ size.replace('px', '') }}</option>
      </select>
      <div class="divider"></div>
      <button @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" :class="{ 'is-active': editor.isActive('heading', { level: 1 }) }" title="H1">
        <Heading1 :size="16" />
      </button>
      <button @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }" title="H2">
        <Heading2 :size="16" />
      </button>
      <div class="divider"></div>
      <button @click="editor.chain().focus().toggleBulletList().run()" :class="{ 'is-active': editor.isActive('bulletList') }" title="List">
        <List :size="16" />
      </button>
      <button @click="editor.chain().focus().toggleOrderedList().run()" :class="{ 'is-active': editor.isActive('orderedList') }" title="Ordered List">
        <ListOrdered :size="16" />
      </button>
      <button @click="editor.chain().focus().toggleBlockquote().run()" :class="{ 'is-active': editor.isActive('blockquote') }" title="Quote">
        <Quote :size="16" />
      </button>
      <div class="divider"></div>
      <button @click="editor.chain().focus().setTextAlign('left').run()" :class="{ 'is-active': editor.isActive({ textAlign: 'left' }) }" title="Align Left">
        <AlignLeft :size="16" />
      </button>
      <button @click="editor.chain().focus().setTextAlign('center').run()" :class="{ 'is-active': editor.isActive({ textAlign: 'center' }) }" title="Align Center">
        <AlignCenter :size="16" />
      </button>
      <button @click="editor.chain().focus().setTextAlign('right').run()" :class="{ 'is-active': editor.isActive({ textAlign: 'right' }) }" title="Align Right">
        <AlignRight :size="16" />
      </button>
      <button @click="editor.chain().focus().setTextAlign('justify').run()" :class="{ 'is-active': editor.isActive({ textAlign: 'justify' }) }" title="Justify">
        <AlignJustify :size="16" />
      </button>
      <div class="divider"></div>
      <button @click="setLink" :class="{ 'is-active': editor.isActive('link') }" title="Link">
        <LinkIcon :size="16" />
      </button>
      <button @click="addContext" title="Insert Context">
        <Info :size="16" />
        <span class="desktop-only">Context</span>
      </button>
      <button @click="setTooltip" :class="{ 'is-active': editor.isActive('tooltip') }" :disabled="!hasSelection" title="Add Tooltip">
        <MessageSquare :size="16" />
      </button>
      <div class="divider"></div>
      <button @click="addImage" title="Insert Image">
        <ImageIcon :size="16" />
      </button>
      <template v-if="isImageSelected">
        <button @click="setImageAlign('left')" title="Align Image Left">
          <AlignLeft :size="16" />
        </button>
        <button @click="setImageAlign('center')" title="Align Image Center">
          <AlignCenter :size="16" />
        </button>
        <button @click="setImageAlign('right')" title="Align Image Right">
          <AlignRight :size="16" />
        </button>
        <button @click="setImageFloat('left')" title="Float Left (text wraps)">
          <MoveLeft :size="16" />
        </button>
        <button @click="setImageFloat('right')" title="Float Right (text wraps)">
          <MoveRight :size="16" />
        </button>
        <button @click="setImageFloat('none')" title="No Float">
          <Minus :size="16" />
        </button>
        <button @click="setImageWidth" title="Set Image Width">
          W
        </button>
      </template>
      <div class="divider"></div>
      <button @click="editor.chain().focus().undo().run()" :disabled="!editor.can().undo()" title="Undo">
        <Undo :size="16" />
      </button>
      <button @click="editor.chain().focus().redo().run()" :disabled="!editor.can().redo()" title="Redo">
        <Redo :size="16" />
      </button>
    </div>

    <EditorContent :editor="editor" class="editor-content page-card" />
    
    <ContentDialog 
      :is-open="isDialogOpen"
      :title="dialogTitle"
      :initial-content="dialogContent"
      @close="isDialogOpen = false"
      @save="handleDialogSave"
    />
    
    <ImageDialog
      :is-open="isImageDialogOpen"
      @close="isImageDialogOpen = false"
      @insert="handleImageInsert"
    />
    
    <TooltipPopup
      v-if="activeTooltip"
      :content="activeTooltip.content"
      :target-element="activeTooltip.element"
      @close="closeTooltip"
    />

    <!-- Input Dialog -->
    <Dialog
      :is-open="inputDialogOpen"
      :title="inputDialogTitle"
      :message="inputDialogMessage"
      :placeholder="inputDialogPlaceholder"
      :initial-value="inputDialogInitialValue"
      type="input"
      @confirm="handleInputConfirm"
      @cancel="handleInputCancel"
      @close="inputDialogOpen = false"
    />
  </div>
</template>

<style scoped>
.editor-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: center; /* Center the page */
  width: 100%;
}

.editor-wrapper.is-editable .editor-content,
.editor-content {
  width: 100%;
  /* Apply page-card styling here or in the template class */
}

/* The actual editable area needs to look like a page */
:deep(.ProseMirror) {
  outline: none;
  min-height: 100%;
}

/* Focus state for the page */
.editor-content:focus-within {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color) 20%, transparent);
}

.toolbar {
  padding: 0.5rem;
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  position: sticky;
  top: 80px; /* Adjusted for header */
  z-index: 10;
  flex-wrap: wrap;
  box-shadow: var(--shadow-sm);
  max-width: 850px; /* Match page width */
  width: 100%;
  margin: 0 auto;
}

/* Override sticky positioning inside modal */
:global(.modal-body) .editor-wrapper .toolbar {
  position: relative;
  top: auto;
  z-index: 100;
}

/* Ensure editor content fits in modal */
:global(.modal-body) .editor-content.page-card {
  min-height: 0;
  box-shadow: none;
  border: 1px solid var(--border-color);
}

.toolbar button {
  padding: 0.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
}

.toolbar .font-size-select {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9em;
}

.toolbar .font-size-select:hover {
  background: var(--bg-color);
}

.toolbar .font-size-select:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-color) 20%, transparent);
}

.toolbar button:hover {
  background: var(--bg-color);
  color: var(--text-color);
}

.toolbar button.is-active {
  background: var(--accent-color);
  color: white;
}

.toolbar button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar .divider {
  width: 1px;
  background: var(--border-color);
  height: 24px;
  margin: 0 0.25rem;
}

.desktop-only {
  font-size: 0.8em;
  margin-left: 4px;
}

@media (max-width: 600px) {
  .desktop-only {
    display: none;
  }
}
</style>

<style>
/* Global ProseMirror styles */
.ProseMirror {
  outline: none;
  min-height: 100%;
  line-height: var(--reader-line-height, 1.6);
}

.ProseMirror p.is-editor-empty:first-child::before {
  color: var(--text-secondary);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

.ProseMirror h1 { 
  font-size: 2rem; 
  margin-top: 1rem; 
  margin-bottom: 0.5rem; 
  font-weight: 700; 
  line-height: 1.2; 
}

.ProseMirror h2 { 
  font-size: 1.5rem; 
  margin-top: 1rem; 
  margin-bottom: 0.5rem; 
  font-weight: 600; 
}

.ProseMirror p { 
  margin-bottom: 1rem; 
  line-height: inherit; 
}

.ProseMirror ul, .ProseMirror ol { 
  padding-left: 1.5rem; 
  margin-bottom: 1rem; 
}

.ProseMirror blockquote {
  border-left: 3px solid var(--accent-color);
  padding-left: 1rem;
  margin-left: 0;
  margin-right: 0;
  font-style: italic;
  color: var(--text-secondary);
}

.ProseMirror a {
  color: var(--accent-color);
  text-decoration: underline;
}

/* Image styles */
.ProseMirror img {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.ProseMirror img.ProseMirror-selectednode {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

/* Image with float creates text wrapping */
.ProseMirror img[data-float="left"] {
  float: left;
  margin: 0 1rem 1rem 0;
  max-width: 50%;
}

.ProseMirror img[data-float="right"] {
  float: right;
  margin: 0 0 1rem 1rem;
  max-width: 50%;
}

/* Clear floats after images */
.ProseMirror::after {
  content: "";
  display: table;
  clear: both;
}
</style>
