import Image from '@tiptap/extension-image'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    customImage: {
      setImage: (options: {
        src: string
        alt?: string
        title?: string
        width?: string | number
        align?: 'left' | 'center' | 'right'
        float?: 'none' | 'left' | 'right'
      }) => ReturnType
      setImageAlign: (align: 'left' | 'center' | 'right') => ReturnType
      setImageFloat: (float: 'none' | 'left' | 'right') => ReturnType
      setImageWidth: (width: string | number) => ReturnType
    }
  }
}

export const CustomImage = Image.extend({
  name: 'customImage',

  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: 'left',
        parseHTML: element => element.getAttribute('data-align') || 'left',
        renderHTML: attributes => {
          return { 'data-align': attributes.align }
        }
      },
      float: {
        default: 'none',
        parseHTML: element => element.getAttribute('data-float') || 'none',
        renderHTML: attributes => {
          return { 'data-float': attributes.float }
        }
      },
      width: {
        default: null,
        parseHTML: element => element.getAttribute('width') || null,
        renderHTML: attributes => {
          if (!attributes.width) return {}
          return { width: attributes.width }
        }
      }
    }
  },

  addCommands() {
    return {
      setImage:
        (options: any) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: options.src,
              alt: options.alt,
              title: options.title,
              width: options.width,
              align: options.align || 'left',
              float: options.float || 'none'
            }
          })
        },

      setImageAlign:
        align =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { align })
        },

      setImageFloat:
        float =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { float })
        },

      setImageWidth:
        width =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { width })
        }
    }
  },

  renderHTML({ HTMLAttributes }) {
    const { align, float } = HTMLAttributes
    
    // Build style based on align and float
    let style = ''
    
    if (float && float !== 'none') {
      style += `float: ${float}; margin: ${float === 'left' ? '0 1rem 1rem 0' : '0 0 1rem 1rem'};`
    } else if (align) {
      switch (align) {
        case 'center':
          style += 'display: block; margin-left: auto; margin-right: auto;'
          break
        case 'right':
          style += 'display: block; margin-left: auto; margin-right: 0;'
          break
        case 'left':
        default:
          style += 'display: block; margin-right: auto; margin-left: 0;'
      }
    }
    
    return [
      'img',
      {
        ...HTMLAttributes,
        style: style || null
      }
    ]
  }
})

export default CustomImage
