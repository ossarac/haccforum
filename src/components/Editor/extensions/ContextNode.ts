import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import ContextComponent from './ContextComponent.vue'

export default Node.create({
    name: 'contextComponent',

    group: 'block',

    content: 'block+',

    draggable: true,

    addAttributes() {
        return {
            title: {
                default: 'Context',
            },
        }
    },

    parseHTML() {
        return [
            {
                tag: 'context-component',
                getAttrs: (element) => ({
                    title: element.getAttribute('title') || 'Context',
                }),
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['context-component', mergeAttributes(HTMLAttributes), 0]
    },

    addNodeView() {
        return VueNodeViewRenderer(ContextComponent)
    },
})
