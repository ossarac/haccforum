import { Mark, mergeAttributes } from '@tiptap/core'

export interface FootnoteOptions {
    HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        footnote: {
            setFootnote: (attributes: { content: string }) => ReturnType
            unsetFootnote: () => ReturnType
        }
    }
}

export default Mark.create<FootnoteOptions>({
    name: 'footnote',

    addOptions() {
        return {
            HTMLAttributes: {},
        }
    },

    // Make the mark inclusive so it can be deleted easier
    inclusive: false,
    
    // Make it span the entire selection
    spanning: false,

    addAttributes() {
        return {
            content: {
                default: null,
                parseHTML: element => element.getAttribute('data-footnote-content'),
                renderHTML: attributes => {
                    if (!attributes.content) return {}
                    return {
                        'data-footnote-content': attributes.content,
                        'class': 'footnote-ref',
                    }
                },
            },
            id: {
                default: null,
                parseHTML: element => element.getAttribute('data-footnote-id'),
                renderHTML: attributes => {
                    if (!attributes.id) return {}
                    return {
                        'data-footnote-id': attributes.id,
                    }
                },
            },
        }
    },

    parseHTML() {
        return [
            {
                tag: 'sup[data-footnote-content]',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['sup', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), '[*]']
    },

    addCommands() {
        return {
            setFootnote:
                attributes =>
                    ({ commands }) => {
                        // Generate a unique ID based on timestamp and random number
                        const id = `fn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                        return commands.setMark(this.name, { ...attributes, id })
                    },
            unsetFootnote:
                () =>
                    ({ commands }) => {
                        return commands.unsetMark(this.name)
                    },
        }
    },

    addKeyboardShortcuts() {
        return {
            // Remove footnote with Mod-Shift-F
            'Mod-Shift-f': () => this.editor.commands.unsetFootnote(),
            // Allow backspace to remove footnote when cursor is at mark boundary
            Backspace: () => {
                const { state } = this.editor
                const { $from } = state.selection
                
                // Check if we're right after a footnote mark
                const marksBefore = $from.nodeBefore?.marks || []
                const hasFootnoteBefore = marksBefore.some(mark => mark.type.name === 'footnote')
                
                if (hasFootnoteBefore) {
                    return this.editor.commands.unsetFootnote()
                }
                
                return false
            },
            // Allow delete to remove footnote when cursor is at mark boundary
            Delete: () => {
                const { state } = this.editor
                const { $from } = state.selection
                
                // Check if we're right before a footnote mark
                const marksAfter = $from.nodeAfter?.marks || []
                const hasFootnoteAfter = marksAfter.some(mark => mark.type.name === 'footnote')
                
                if (hasFootnoteAfter) {
                    return this.editor.commands.unsetFootnote()
                }
                
                return false
            },
        }
    },
})
