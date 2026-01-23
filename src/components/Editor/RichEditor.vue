<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle, FontSize } from '@tiptap/extension-text-style'
import { Markdown } from 'tiptap-markdown'
import ContextNode from './extensions/ContextNode'
import TooltipMark from './extensions/TooltipMark'
import FootnoteMark from './extensions/FootnoteMark'
import CustomImage from './extensions/CustomImage'
import ContentDialog from './ContentDialog.vue'
import TooltipPopup from './TooltipPopup.vue'
import ImageDialog from './ImageDialog.vue'
import Dialog from '../Dialog.vue'
import { useI18n } from 'vue-i18n'
import { 
  Heading1, Heading2, List, ListOrdered, 
  Quote, Undo, Redo, Link as LinkIcon,
  MessageSquare, Info, Bold, Italic, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Image as ImageIcon, MoveLeft, MoveRight, Minus,
  Superscript
} from 'lucide-vue-next'
import { watch, ref, computed, onMounted, onUnmounted } from 'vue'

const { t } = useI18n()

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
const editingFootnoteElement = ref<HTMLElement | null>(null)
const isFootnoteDialog = ref(false)

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
    HorizontalRule,
    ContextNode,
    TooltipMark,
    FootnoteMark,
    CustomImage,
    Placeholder.configure({
      placeholder: t('editor.placeholder'),
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

// Collect and number footnotes from the editor content
const footnotes = computed(() => {
  if (!editor.value) return []
  
  const footnoteList: Array<{ id: string; content: string; number: number }> = []
  const doc = editor.value.state.doc
  
  doc.descendants((node, pos) => {
    if (node.marks) {
      node.marks.forEach(mark => {
        if (mark.type.name === 'footnote') {
          const id = mark.attrs.id
          const content = mark.attrs.content
          if (id && content && !footnoteList.find(fn => fn.id === id)) {
            footnoteList.push({
              id,
              content,
              number: footnoteList.length + 1
            })
          }
        }
      })
    }
  })
  
  return footnoteList
})

// Update footnote numbers in the DOM when content changes
watch([() => editor.value?.state.doc, footnotes], () => {
  if (!editor.value) return
  
  // Create a map of footnote IDs to their numbers
  const footnoteNumberMap = new Map<string, number>()
  footnotes.value.forEach(fn => {
    footnoteNumberMap.set(fn.id, fn.number)
  })
  
  // Update the displayed numbers in footnote references
  const editorDom = editor.value.view.dom
  editorDom.querySelectorAll('sup[data-footnote-id]').forEach((el) => {
    const id = el.getAttribute('data-footnote-id')
    if (id && footnoteNumberMap.has(id)) {
      const number = footnoteNumberMap.get(id)
      el.textContent = `[${number}]`
    }
  })
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
    t('editor.setLink'),
    t('editor.enterUrl'),
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
  const width = await showInput(t('editor.setImageWidth'), t('editor.enterUrl'), '300')
  if (width) {
    editor.value?.chain().focus().setImageWidth(width).run()
  }
}

// Open tooltip dialog for NEW tooltip
const setTooltip = () => {
  if (!hasSelection.value) return
  
  editingTooltipElement.value = null
  dialogTitle.value = t('editor.addTooltip')
  dialogContent.value = ''
  isDialogOpen.value = true
}

// Handle save from dialog
const handleDialogSave = (content: string) => {
  if (isFootnoteDialog.value) {
    // Handle footnote
    if (!content.trim()) {
      // Remove footnote if empty
      if (editingFootnoteElement.value) {
        editor.value?.chain().focus().extendMarkRange('footnote').unsetFootnote().run()
      }
    } else {
      // Apply footnote
      editor.value?.chain().focus().extendMarkRange('footnote').setFootnote({ content }).run()
    }
    editingFootnoteElement.value = null
    isFootnoteDialog.value = false
  } else {
    // Handle tooltip
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
    editingTooltipElement.value = null
  }
  isDialogOpen.value = false
}

// Handle delete from dialog (for footnotes)
const handleDialogDelete = () => {
  if (isFootnoteDialog.value && editingFootnoteElement.value) {
    editor.value?.chain().focus().extendMarkRange('footnote').unsetFootnote().run()
    editingFootnoteElement.value = null
    isFootnoteDialog.value = false
  }
  isDialogOpen.value = false
}

// Open footnote dialog for NEW footnote
const setFootnote = () => {
  if (!hasSelection.value) return
  
  editingFootnoteElement.value = null
  dialogTitle.value = 'Add Footnote'
  dialogContent.value = ''
  isFootnoteDialog.value = true
  isDialogOpen.value = true
}

// Handle click on tooltip and footnote elements
const handleTooltipClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const tooltipElement = target.closest('[data-tooltip-content]') as HTMLElement
  const footnoteElement = target.closest('[data-footnote-content]') as HTMLElement
  
  if (footnoteElement) {
    event.preventDefault()
    event.stopPropagation()
    
    const content = footnoteElement.getAttribute('data-footnote-content') || ''
    
    if (props.editable) {
      // Edit mode: open dialog to edit the footnote
      editingFootnoteElement.value = footnoteElement
      dialogTitle.value = 'Edit Footnote'
      dialogContent.value = content
      isFootnoteDialog.value = true
      isDialogOpen.value = true
    } else {
      // Preview mode: show popup
      activeTooltip.value = { content, element: footnoteElement }
    }
  } else if (tooltipElement) {
    event.preventDefault()
    event.stopPropagation()
    
    const content = tooltipElement.getAttribute('data-tooltip-content') || ''
    
    if (props.editable) {
      // Edit mode: open dialog to edit the tooltip
      editingTooltipElement.value = tooltipElement
      dialogTitle.value = t('editor.editTooltip')
      dialogContent.value = content
      isFootnoteDialog.value = false
      
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
      <button @click="editor.chain().focus().toggleBold().run()" :class="{ 'is-active': editor.isActive('bold') }" :title="t('editor.bold')">
        <Bold :size="16" />
      </button>
      <button @click="editor.chain().focus().toggleItalic().run()" :class="{ 'is-active': editor.isActive('italic') }" :title="t('editor.italic')">
        <Italic :size="16" />
      </button>
      <button @click="editor.chain().focus().toggleStrike().run()" :class="{ 'is-active': editor.isActive('strike') }" :title="t('editor.strike')">
        <Strikethrough :size="16" />
      </button>
      <div class="divider"></div>
      <select @change="setFontSize(($event.target as HTMLSelectElement).value)" :value="currentFontSize" class="font-size-select" :title="t('editor.fontSize')">
        <option v-for="size in fontSizes" :key="size" :value="size">{{ size.replace('px', '') }}</option>
      </select>
      <div class="divider"></div>
      <button @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" :class="{ 'is-active': editor.isActive('heading', { level: 1 }) }" :title="t('editor.h1')">
        <Heading1 :size="16" />
      </button>
      <button @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }" :title="t('editor.h2')">
        <Heading2 :size="16" />
      </button>
      <div class="divider"></div>
      <button @click="editor.chain().focus().toggleBulletList().run()" :class="{ 'is-active': editor.isActive('bulletList') }" :title="t('editor.list')">
        <List :size="16" />
      </button>
      <button @click="editor.chain().focus().toggleOrderedList().run()" :class="{ 'is-active': editor.isActive('orderedList') }" :title="t('editor.orderedList')">
        <ListOrdered :size="16" />
      </button>
      <button @click="editor.chain().focus().toggleBlockquote().run()" :class="{ 'is-active': editor.isActive('blockquote') }" :title="t('editor.quote')">
        <Quote :size="16" />
      </button>
      <button @click="editor.chain().focus().setHorizontalRule().run()" :title="t('editor.horizontalRule', 'Horizontal Line')">
        <Minus :size="16" />
      </button>
      <div class="divider"></div>
      <button @click="editor.chain().focus().setTextAlign('left').run()" :class="{ 'is-active': editor.isActive({ textAlign: 'left' }) }" :title="t('editor.alignLeft')">
        <AlignLeft :size="16" />
      </button>
      <button @click="editor.chain().focus().setTextAlign('center').run()" :class="{ 'is-active': editor.isActive({ textAlign: 'center' }) }" :title="t('editor.alignCenter')">
        <AlignCenter :size="16" />
      </button>
      <button @click="editor.chain().focus().setTextAlign('right').run()" :class="{ 'is-active': editor.isActive({ textAlign: 'right' }) }" :title="t('editor.alignRight')">
        <AlignRight :size="16" />
      </button>
      <button @click="editor.chain().focus().setTextAlign('justify').run()" :class="{ 'is-active': editor.isActive({ textAlign: 'justify' }) }" :title="t('editor.justify')">
        <AlignJustify :size="16" />
      </button>
      <div class="divider"></div>
      <button @click="setLink" :class="{ 'is-active': editor.isActive('link') }" :title="t('editor.link')">
        <LinkIcon :size="16" />
      </button>
      <button @click="addContext" :title="t('editor.context')">
        <Info :size="16" />
        <span class="desktop-only">{{ t('editor.context') }}</span>
      </button>
      <button @click="setTooltip" :class="{ 'is-active': editor.isActive('tooltip') }" :disabled="!hasSelection" :title="t('editor.tooltip')">
        <MessageSquare :size="16" />
      </button>
      <button 
        v-if="!editor.isActive('footnote')"
        @click="setFootnote" 
        :disabled="!hasSelection" 
        :title="t('editor.footnote')"
      >
        <Superscript :size="16" />
      </button>
      <button 
        v-else
        @click="editor.chain().focus().unsetFootnote().run()" 
        class="is-active" 
        :title="t('editor.removeFootnote')"
      >
        <Superscript :size="16" />
      </button>
      <div class="divider"></div>
      <button @click="addImage" :title="t('editor.image')">
        <ImageIcon :size="16" />
      </button>
      <template v-if="isImageSelected">
        <button @click="setImageAlign('left')" :title="t('editor.alignImageLeft')">
          <AlignLeft :size="16" />
        </button>
        <button @click="setImageAlign('center')" :title="t('editor.alignImageCenter')">
          <AlignCenter :size="16" />
        </button>
        <button @click="setImageAlign('right')" :title="t('editor.alignImageRight')">
          <AlignRight :size="16" />
        </button>
        <button @click="setImageFloat('left')" :title="t('editor.floatLeft')">
          <MoveLeft :size="16" />
        </button>
        <button @click="setImageFloat('right')" :title="t('editor.floatRight')">
          <MoveRight :size="16" />
        </button>
        <button @click="setImageFloat('none')" :title="t('editor.noFloat')">
          <Minus :size="16" />
        </button>
        <button @click="setImageWidth" :title="t('editor.setImageWidth')">
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
    
    <!-- Footnotes List -->
    <div v-if="footnotes.length > 0" class="footnotes-list">
      <hr class="footnotes-divider" />
      <div class="footnotes-title">Footnotes</div>
      <ol class="footnotes-items">
        <li v-for="footnote in footnotes" :key="footnote.id" :id="`footnote-${footnote.id}`" class="footnote-item">
          <span class="footnote-number">{{ footnote.number }}.</span>
          <span class="footnote-content" v-html="footnote.content"></span>
        </li>
      </ol>
    </div>
    
    <ContentDialog 
      :is-open="isDialogOpen"
      :title="dialogTitle"
      :initial-content="dialogContent"
      :show-delete="isFootnoteDialog && editingFootnoteElement !== null"
      @close="isDialogOpen = false"
      @save="handleDialogSave"
      @delete="handleDialogDelete"
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

.ProseMirror hr {
  border: none;
  border-top: 2px solid var(--border-color);
  margin: 1.5rem 0;
  height: 0;
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

/* Footnote styles */
.ProseMirror .footnote-ref {
  color: var(--accent-color);
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s ease;
}

.ProseMirror .footnote-ref:hover {
  color: color-mix(in srgb, var(--accent-color) 80%, #000);
  text-decoration: underline;
}

/* Footnotes list section */
.footnotes-list {
  max-width: 850px;
  width: 100%;
  margin: 2rem auto 0;
  padding: 1.5rem 2rem;
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.footnotes-divider {
  border: none;
  border-top: 2px solid var(--border-color);
  margin: 0 0 1rem 0;
}

.footnotes-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--text-color);
}

.footnotes-items {
  list-style: none;
  padding: 0;
  margin: 0;
  counter-reset: footnote-counter;
}

.footnote-item {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  line-height: 1.6;
  scroll-margin-top: 100px;
}

.footnote-number {
  color: var(--accent-color);
  font-weight: 600;
  flex-shrink: 0;
}

.footnote-content {
  flex: 1;
  color: var(--text-secondary);
}
</style>
