import { Mark, mergeAttributes } from '@tiptap/core'

export interface TooltipOptions {
    HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        tooltip: {
            setTooltip: (attributes: { content: string }) => ReturnType
            unsetTooltip: () => ReturnType
        }
    }
}

export default Mark.create<TooltipOptions>({
    name: 'tooltip',

    addOptions() {
        return {
            HTMLAttributes: {},
        }
    },

    addAttributes() {
        return {
            content: {
                default: null,
                parseHTML: element => element.getAttribute('data-tooltip-content'),
                renderHTML: attributes => {
                    if (!attributes.content) return {}
                    return {
                        'data-tooltip-content': attributes.content,
                        'class': 'custom-tooltip',
                        'title': attributes.content.replace(/<[^>]*>/g, '') // Strip HTML for native fallback
                    }
                },
            },
        }
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-tooltip-content]',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
    },

    addCommands() {
        return {
            setTooltip:
                attributes =>
                    ({ commands }) => {
                        return commands.setMark(this.name, attributes)
                    },
            unsetTooltip:
                () =>
                    ({ commands }) => {
                        return commands.unsetMark(this.name)
                    },
        }
    },
})
