<script setup lang="ts">
import { NodeViewWrapper, NodeViewContent, nodeViewProps } from '@tiptap/vue-3'
import { ref, computed } from 'vue'
import { ChevronDown, ChevronRight, Pencil, X } from 'lucide-vue-next'

const props = defineProps(nodeViewProps)
const isExpanded = ref(true)

const toggle = () => {
  isExpanded.value = !isExpanded.value
}

// Get title from node attributes
const labelText = computed({
  get: () => props.node.attrs.title || 'Context',
  set: (value: string) => {
    props.updateAttributes({ title: value })
  }
})

const isEditingLabel = ref(false)

const startEditingLabel = (e: MouseEvent) => {
  e.stopPropagation()
  isEditingLabel.value = true
}

const finishEditingLabel = () => {
  isEditingLabel.value = false
  if (!labelText.value.trim()) {
    labelText.value = 'Context'
  }
}

// Delete the entire context block
const deleteBlock = (e: MouseEvent) => {
  e.stopPropagation()
  props.deleteNode()
}
</script>

<template>
  <NodeViewWrapper class="context-block" :class="{ 'is-collapsed': !isExpanded }">
    <div class="context-header" @click="toggle">
      <component :is="isExpanded ? ChevronDown : ChevronRight" :size="16" class="chevron" />
      <input 
        v-if="isEditingLabel"
        v-model="labelText"
        class="label-input"
        @blur="finishEditingLabel"
        @keydown.enter="finishEditingLabel"
        @click.stop
        autofocus
      />
      <span v-else class="context-label" @dblclick="startEditingLabel">{{ labelText }}</span>
      <Pencil v-if="!isEditingLabel && props.editor?.isEditable" :size="12" class="edit-icon" @click="startEditingLabel" />
      <button 
        v-if="props.editor?.isEditable" 
        class="delete-btn" 
        @click="deleteBlock"
        title="Delete context block"
      >
        <X :size="14" />
      </button>
    </div>
    <div class="context-content" :class="{ 'collapsed': !isExpanded }">
      <NodeViewContent class="content" />
    </div>
    <div v-if="!isExpanded" class="expand-hint" @click="toggle">
      Click to expand...
    </div>
  </NodeViewWrapper>
</template>


<style scoped>
.context-block {
  --context-accent: color-mix(in srgb, var(--accent-color) 38%, var(--context-surface, var(--surface-color)) 62%);
  --context-accent-strong: color-mix(in srgb, var(--accent-color) 75%, var(--context-surface, var(--surface-color)) 25%);
  margin: 1rem 0;
  border-left: 2px solid var(--context-accent);
  background: var(--context-surface);
  color: var(--context-text, var(--text-color));
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  padding: 0.5rem 1rem;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border-color) 80%, var(--context-accent) 20%);
}

.context-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.25rem 0;
  user-select: none;
  color: var(--context-accent-strong);
  font-weight: 700;
  font-size: 0.875rem;
}

.context-header:hover {
  opacity: 0.9;
}

.chevron {
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.context-label {
  flex: 1;
}

.label-input {
  flex: 1;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 0.125rem 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--context-accent-strong);
  outline: none;
}

.label-input:focus {
  border-color: var(--context-accent-strong);
}

.edit-icon {
  opacity: 0;
  color: var(--text-secondary);
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.context-header:hover .edit-icon {
  opacity: 0.5;
}

.edit-icon:hover {
  opacity: 1 !important;
}

.delete-btn {
  opacity: 0;
  background: transparent;
  border: none;
  padding: 0.25rem;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  margin-left: auto;
}

.context-block:hover .delete-btn {
  opacity: 0.5;
}

.delete-btn:hover {
  opacity: 1 !important;
  color: var(--danger-color);
  background: color-mix(in srgb, var(--danger-color) 10%, transparent);
}


.context-content {
  padding: 0.5rem 0;
  transition: max-height 0.2s ease, opacity 0.2s ease;
}

.context-content.collapsed {
  max-height: 3em;
  overflow: hidden;
  position: relative;
  opacity: 0.6;
}

.context-content.collapsed::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2em;
  background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--context-surface) 65%, var(--surface-color)));
  pointer-events: none;
}

.expand-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem 0;
  font-style: italic;
}

.expand-hint:hover {
  color: var(--accent-color);
}

/* Content styling */
.content :deep(p) {
  margin: 0.25rem 0;
}

.content :deep(p:first-child) {
  margin-top: 0;
}

.content :deep(p:last-child) {
  margin-bottom: 0;
}
</style>
