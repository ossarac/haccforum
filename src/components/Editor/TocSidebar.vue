<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { Editor } from '@tiptap/vue-3'

const props = defineProps<{
  editor: Editor | undefined
}>()

const headings = ref<{ id: string; text: string; level: number; pos: number }[]>([])

const updateHeadings = () => {
  if (!props.editor) return

  const items: { id: string; text: string; level: number; pos: number }[] = []

  props.editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const id = `heading-${pos}`
      // Tiptap doesn't store IDs by default unless configured, so we generate one or just use pos
      // For scrolling, we'll use pos.
      items.push({
        id,
        text: node.textContent,
        level: node.attrs.level,
        pos
      })
    }
  })

  headings.value = items
}

const scrollToHeading = (pos: number) => {
  if (!props.editor) return
  
  // Set selection
  props.editor.chain().setTextSelection(pos).run()
  
  // Find the DOM element and scroll to top
  const { node } = props.editor.view.domAtPos(pos + 1) // +1 to ensure we are inside the node content
  if (node) {
    const element = node.nodeType === 1 ? (node as HTMLElement) : node.parentElement
    if (element) {
      // Add a small offset (scroll-margin) via style or just standard scroll
      element.scrollIntoView({ behavior: 'smooth', block: 'center' }) // 'center' or 'start', 'start' might be behind sticky headers if not careful
      // Given we have a fixed sidebar at top: 240px, 'start' might put it behind toolbar?
      // Actually toolbar is sticky? 
      // Let's try 'start' but assume reasonable behavior. 
      // The user asked for "top of the edit page", so 'start' is the most accurate translation.
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
}

// Watch for editor updates
watch(() => props.editor, (newEditor) => {
  if (newEditor) {
    updateHeadings()
    newEditor.on('update', updateHeadings)
    newEditor.on('transaction', updateHeadings) // also update on selection/transaction if we want robust syncing
  }
}, { immediate: true })

onUnmounted(() => {
  if (props.editor) {
    props.editor.off('update', updateHeadings)
    props.editor.off('transaction', updateHeadings)
  }
})
</script>

<template>
  <aside v-if="headings.length > 0" class="toc-sidebar">
    <div class="toc-title">Table of Contents</div>
    <nav>
      <ul>
        <li 
          v-for="heading in headings" 
          :key="heading.id"
          :class="`level-${heading.level}`"
          @click="scrollToHeading(heading.pos)"
        >
          {{ heading.text }}
        </li>
      </ul>
    </nav>
  </aside>
</template>

<style scoped>
.toc-sidebar {
  --toc-offset: 160px;
  --toc-bottom-gap: 32px;

  position: fixed;
  top: var(--toc-offset);
  left: max(2rem, calc(50% - 680px)); /* Symmetrically placed on left. 425px (half content) + 25px gap + 230px width */
  width: 200px;
  max-height: calc(100vh - var(--toc-offset) - var(--toc-bottom-gap));
  overflow-y: auto;
  padding: 1.25rem;
  
  /* Subtle background styling */
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  z-index: 90;
}

.toc-title {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  font-weight: 600;
  margin-bottom: 0.75rem;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  cursor: pointer;
  padding: 0.25rem 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  transition: color 0.2s;
  line-height: 1.4;
  display: block;
}

li:hover {
  color: var(--accent-color);
}

/* Indentation levels */
.level-1 {
  font-weight: 600;
  color: var(--text-color);
}

.level-2 {
  padding-left: 0.75rem;
}

.level-3 {
  padding-left: 1.5rem;
}

/* Scrollbar styling */
.toc-sidebar::-webkit-scrollbar {
  width: 4px;
}
.toc-sidebar::-webkit-scrollbar-track {
  background: transparent;
}
.toc-sidebar::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}
.toc-sidebar::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

@media (max-width: 1250px) {
  .toc-sidebar {
    display: none; /* Hide on smaller screens */
  }
}
</style>
