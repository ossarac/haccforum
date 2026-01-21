import type { ArticleDocument } from '../models/Article.js'
import type { ReadingPreferences } from '../models/User.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

type BackgroundPreset = {
  backgroundColor: string
  color: string
  surface: string
  border: string
  surfaceImage?: string
  surfaceSize?: string
  surfacePosition?: string
  surfaceRepeat?: string
}

const backgroundPresets: Record<string, BackgroundPreset> = {
  'clean-light': {
    backgroundColor: '#ffffff',
    color: '#1f2933',
    surface: '#ffffff',
    border: '#e5e7eb'
  },
  'soft-gray': {
    backgroundColor: '#f2f4f7',
    color: '#111827',
    surface: '#f2f4f7',
    border: '#e5e7eb'
  },
  'warm-sepia': {
    backgroundColor: '#f6efe5',
    color: '#2f1f0f',
    surface: '#f6efe5',
    border: '#e8dccd'
  },
  'dark-slate': {
    backgroundColor: '#1f2430',
    color: '#f5f5f5',
    surface: '#1f2430',
    border: '#2f3647'
  },
  'midnight-ink': {
    backgroundColor: '#0b0d11',
    color: '#e5e7eb',
    surface: '#0b0d11',
    border: '#1c2230'
  },
  'graphite': {
    backgroundColor: '#191b22',
    color: '#d6d9df',
    surface: '#191b22',
    border: '#2a303f'
  },
  'noir-sepia': {
    backgroundColor: '#1a1410',
    color: '#f0e2d0',
    surface: '#1a1410',
    border: '#2f251c'
  },
  'paper-texture': {
    backgroundColor: '#fbf8f1',
    color: '#2f2a25',
    surface: '#fbf8f1',
    border: '#eae1d3',
    surfaceImage:
      'linear-gradient(rgba(0,0,0,0.02) 1px, transparent 0), linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 0)',
    surfaceSize: '20px 20px',
    surfaceRepeat: 'repeat'
  },
  'newsprint': {
    backgroundColor: '#f1ede4',
    color: '#2c241b',
    surface: '#f1ede4',
    border: '#e0d5c3',
    surfaceImage:
      'linear-gradient(180deg, rgba(0,0,0,0.015) 25%, transparent 25%, transparent 50%, rgba(0,0,0,0.015) 50%, rgba(0,0,0,0.015) 75%, transparent 75%, transparent)',
    surfaceSize: '8px 8px',
    surfaceRepeat: 'repeat'
  }
}

const fontPresets: Record<string, string> = {
  serif: "'Merriweather', serif",
  sans: "'Inter', system-ui, -apple-system, sans-serif",
  slab: "'Roboto Slab', 'Merriweather', serif",
  humanist: "'Source Sans Pro', 'Inter', sans-serif",
  mono: "'JetBrains Mono', 'SFMono-Regular', monospace",
  georgia: "Georgia, 'Times New Roman', serif",
  'open-sans': "'Open Sans', 'Inter', sans-serif",
  lora: "'Lora', 'Merriweather', serif",
  'plex-sans': "'IBM Plex Sans', 'Inter', sans-serif",
  'noto-serif': "'Noto Serif', 'Merriweather', serif"
}

const docWidthPresets: Record<string, string> = {
  narrow: '620px',
  default: '760px',
  wide: '900px',
  full: '100%'
}

const defaultPrefs = {
  backgroundId: 'clean-light',
  fontId: 'serif',
  fontSize: '18px',
  lineHeight: 1.6,
  docWidthId: 'default'
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  if (![3, 6].includes(normalized.length)) return null
  const value = normalized.length === 3 ? normalized.split('').map(c => c + c).join('') : normalized
  const intVal = Number.parseInt(value, 16)
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255
  }
}

function darkenColor(hex: string, amount = 0.1) {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const factor = 1 - amount
  const r = Math.round(rgb.r * factor)
  const g = Math.round(rgb.g * factor)
  const b = Math.round(rgb.b * factor)
  return `rgb(${r}, ${g}, ${b})`
}

function textOnBackground(hexBg: string, lightText = '#f8fafc', darkText = '#0b0d11') {
  const rgb = hexToRgb(hexBg)
  if (!rgb) return lightText
  const srgb = [rgb.r, rgb.g, rgb.b].map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  const luminance = 0.2126 * srgb[0]! + 0.7152 * srgb[1]! + 0.0722 * srgb[2]!
  return luminance > 0.35 ? darkText : lightText
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || 'article'
}

function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

function normalizeText(input: string): string {
  const text = stripTags(input)
  return text.replace(/\s+/g, ' ').trim()
}

function buildHeadingId(text: string, index: number): string {
  return `${slugify(text) || 'heading'}-${index}`
}

function injectHeadingAnchors(html: string) {
  const headingRegex = /<(h[1-3])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi
  const headings: { id: string; text: string; level: number }[] = []
  let idx = 0

  const withIds = html.replace(headingRegex, (_match, tag: string, attrs = '', inner = '') => {
    const text = normalizeText(inner)
    const id = buildHeadingId(text || `section-${idx + 1}`, idx)
    headings.push({ id, text, level: Number(tag.replace('h', '')) || 1 })

    // if attrs already has id, keep it but ensure ours is present (overwrite)
    const filteredAttrs = attrs.replace(/\s+id="[^"]*"/i, '')
    return `<${tag} id="${id}"${filteredAttrs}>${inner}</${tag}>`
  })

  return { html: withIds, headings }
}

function buildTocHtml(headings: Array<{ id: string; text: string; level: number }>): string {
  if (!headings.length) return ''
  const items = headings
    .map(h => `<li class="level-${h.level}"><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`)
    .join('')
  return `<aside class="toc-sidebar"><div class="toc-title">Table of Contents</div><nav><ul>${items}</ul></nav></aside>`
}

function convertImagesToBase64(html: string): string {
  // Find all local uploaded images and convert to base64
  const imgRegex = /<img([^>]*)\s+src="\/uploads\/([^"]+)"([^>]*)>/gi
  
  return html.replace(imgRegex, (match, before, filename, after) => {
    try {
      // Construct path to uploaded image
      const imagePath = path.join(__dirname, '../../public/uploads', filename)
      
      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        console.warn(`Image not found: ${imagePath}`)
        return match // Return original if file not found
      }
      
      // Read image and convert to base64
      const imageBuffer = fs.readFileSync(imagePath)
      const base64 = imageBuffer.toString('base64')
      
      // Detect mime type from file extension
      const ext = path.extname(filename).toLowerCase()
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
      }
      const mimeType = mimeTypes[ext] || 'image/jpeg'
      
      // Return img tag with base64 data URL
      return `<img${before} src="data:${mimeType};base64,${base64}"${after}>`
    } catch (error) {
      console.error(`Error converting image ${filename}:`, error)
      return match // Return original on error
    }
  })
}

export function buildArticleExportHtml(params: {
  article: ArticleDocument
  authorName: string
  prefs?: ReadingPreferences
}): { filename: string; html: string } {
  const prefs = { ...defaultPrefs, ...(params.prefs ?? {}) }
  const background = backgroundPresets[prefs.backgroundId ?? defaultPrefs.backgroundId] ?? backgroundPresets[defaultPrefs.backgroundId]
  const fontFamily = fontPresets[prefs.fontId ?? defaultPrefs.fontId] ?? fontPresets[defaultPrefs.fontId]
  const docWidth = docWidthPresets[prefs.docWidthId ?? defaultPrefs.docWidthId] ?? docWidthPresets[defaultPrefs.docWidthId]
  const fontSize = prefs.fontSize ?? defaultPrefs.fontSize
  const lineHeight = prefs.lineHeight ?? defaultPrefs.lineHeight
  const backgroundId = prefs.backgroundId ?? defaultPrefs.backgroundId
  const baseBackground = background.backgroundColor ?? '#ffffff'
  const useGentleDarken = ['dark', 'midnight', 'graphite', 'noir'].some(key => backgroundId.includes(key))
  const contextSurface = darkenColor(baseBackground, useGentleDarken ? 0.05 : 0.1)
  const contextText = textOnBackground(baseBackground)

  const title = params.article.title || 'Untitled'
  const filename = `${slugify(title)}.html`
  const createdAt = params.article.createdAt?.toISOString?.() ?? ''

    const { html: contentWithAnchors, headings } = injectHeadingAnchors(params.article.content)
    // Convert local images to base64 for standalone export
    const contentWithEmbeddedImages = convertImagesToBase64(contentWithAnchors)
    const tocHtml = buildTocHtml(headings)

    const surfaceImage = background.surfaceImage ?? ''
    const surfaceSize = background.surfaceSize ?? '24px 24px'
    const surfacePosition = background.surfacePosition ?? '0 0'
    const surfaceRepeat = background.surfaceRepeat ?? 'repeat'

  const inlineStyles = `:root { --bg: ${background.backgroundColor}; --text: ${background.color}; --surface: ${background.surface}; --border: ${background.border}; --accent: #6366f1; --danger: #ef4444; --font-family: ${fontFamily}; --font-size: ${fontSize}; --line-height: ${lineHeight}; --doc-width: ${docWidth}; --page-bg: #f7f4ed; --frame-surface: #ffffff; --frame-border: #e5e0d7; --context-surface: ${contextSurface}; --context-text: ${contextText}; }
  body { margin: 0; padding: 0; background: var(--page-bg); color: var(--text); font-family: var(--font-family); font-size: var(--font-size); line-height: var(--line-height); -webkit-font-smoothing: antialiased; }
a { color: var(--accent); }
  .page { max-width: 1380px; margin: 40px auto 72px; padding: 0 40px; display: grid; grid-template-columns: 248px minmax(0, 1fr); column-gap: 48px; row-gap: 32px; box-sizing: border-box; align-items: start; }
  @media (max-width: 1240px) { .page { grid-template-columns: 1fr; column-gap: 0; padding: 0 24px; } .toc-sidebar { position: relative; top: 0; left: 0; max-height: none; width: 100%; margin-bottom: 16px; } }
.article-card { background: var(--frame-surface); border: 1px solid var(--frame-border); border-radius: 18px; padding: 32px; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08); }
.article-title { font-size: 2.3rem; margin: 0 0 0.5rem; letter-spacing: -0.02em; }
.article-meta { color: rgba(0,0,0,0.55); font-size: 0.95rem; margin-bottom: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap; }
  .reader-surface { border: 1px solid var(--border); border-radius: 12px; padding: 26px; background: var(--surface); background-image: ${surfaceImage ? surfaceImage : 'none'}; background-size: ${surfaceSize}; background-position: ${surfacePosition}; background-repeat: ${surfaceRepeat}; box-shadow: inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 10px rgba(0,0,0,0.05); max-width: var(--doc-width); width: 100%; margin: 0 auto; box-sizing: border-box; }
.reader-surface .page-card { background: transparent; box-shadow: none; border: none; padding: 0; }
.reader-surface .ProseMirror { outline: none; }
.context-card { margin: 1rem 0; border-left: 4px solid var(--accent); background: var(--context-surface); color: var(--context-text); border-radius: 0 10px 10px 0; padding: 0.5rem 1rem; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border) 70%, var(--accent) 30%); }
.context-header { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; color: var(--accent); font-weight: 700; font-size: 0.95rem; user-select: none; }
.context-label { flex: 1; }
.context-toggle { width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--accent); border-radius: 4px; font-size: 12px; color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
.context-body { padding: 0.5rem 0; transition: max-height 0.2s ease, opacity 0.2s ease; overflow: hidden; }
.context-body.collapsed { max-height: 3.2em; opacity: 0.65; position: relative; }
.context-body.collapsed::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1.8em; background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--context-surface) 65%, var(--surface))); }
.context-expand-hint { font-size: 0.8rem; color: rgba(0,0,0,0.55); cursor: pointer; font-style: italic; }
.context-expand-hint:hover { color: var(--accent); }
.tooltip-inline { text-decoration: underline dotted; cursor: pointer; }
.tooltip-layer { position: fixed; inset: 0; background: rgba(0,0,0,0.2); display: none; align-items: flex-start; justify-content: center; z-index: 2000; }
.tooltip-layer.active { display: flex; }
.tooltip-box { position: relative; margin-top: 18vh; max-width: 460px; width: calc(100% - 32px); background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 12px; padding: 18px 18px 14px; box-shadow: 0 16px 40px rgba(0,0,0,0.18); }
.tooltip-close { position: absolute; top: 8px; right: 8px; background: transparent; border: none; cursor: pointer; font-size: 16px; color: var(--text); }
/* TOC */
.toc-sidebar { position: sticky; top: 32px; align-self: flex-start; width: 100%; max-height: calc(100vh - 64px); overflow: auto; padding: 1.2rem; background: var(--frame-surface); border: 1px solid var(--frame-border); border-radius: 14px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); margin-right: 8px; }
.toc-title { font-size: 0.8rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(0,0,0,0.55); font-weight: 700; margin-bottom: 0.75rem; }
.toc-sidebar ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.toc-sidebar li { line-height: 1.4; color: rgba(0,0,0,0.65); cursor: pointer; }
.toc-sidebar a { text-decoration: none; color: inherit; }
.toc-sidebar a:hover { color: var(--accent); }
.toc-sidebar .level-1 { font-weight: 700; color: var(--text); }
.toc-sidebar .level-2 { padding-left: 0.75rem; }
.toc-sidebar .level-3 { padding-left: 1.5rem; }
@media (max-width: 640px) { .article-card { padding: 18px; } .reader-surface { padding: 16px; } .article-title { font-size: 1.9rem; } }
`.
  replace(/\n/g, ' ')

  const inlineScript = `(function(){
    const tooltipLayer = document.createElement('div');
    tooltipLayer.className = 'tooltip-layer';
    tooltipLayer.innerHTML = '<div class="tooltip-box"><button class="tooltip-close" aria-label="Close">×</button><div class="tooltip-content"></div></div>';
    document.body.appendChild(tooltipLayer);
    const tooltipContent = tooltipLayer.querySelector('.tooltip-content');
    const closeBtn = tooltipLayer.querySelector('.tooltip-close');
    function closeTooltip(){ tooltipLayer.classList.remove('active'); }
    closeBtn?.addEventListener('click', closeTooltip);
    tooltipLayer.addEventListener('click', (e)=>{ if(e.target === tooltipLayer) closeTooltip(); });
    document.querySelectorAll('span[data-tooltip-content]').forEach(el=>{
      el.classList.add('tooltip-inline');
      el.addEventListener('click',(e)=>{
        e.preventDefault();
        const html = el.getAttribute('data-tooltip-content') || '';
        if(tooltipContent){ tooltipContent.innerHTML = html; }
        tooltipLayer.classList.add('active');
      });
    });
    document.querySelectorAll('context-component').forEach((node)=>{
      const wrapper = document.createElement('div');
      wrapper.className = 'context-card';
      const header = document.createElement('div');
      header.className = 'context-header';
      const toggle = document.createElement('span');
      toggle.className = 'context-toggle';
      toggle.textContent = '−';
      const label = document.createElement('span');
      label.className = 'context-label';
      const labelText = node.getAttribute('title') || node.getAttribute('data-title') || 'Context';
      label.textContent = labelText;
      header.appendChild(toggle); header.appendChild(label);
      const body = document.createElement('div');
      body.className = 'context-body';
      body.innerHTML = node.innerHTML;
      const hint = document.createElement('div');
      hint.className = 'context-expand-hint';
      hint.textContent = 'Click to expand…';
      hint.style.display = 'none';
      function setState(collapsed){
        if(collapsed){ body.classList.add('collapsed'); toggle.textContent = '+'; hint.style.display = 'block'; }
        else { body.classList.remove('collapsed'); toggle.textContent = '−'; hint.style.display = 'none'; }
      }
      let collapsed = false;
      setState(collapsed);
      const toggleHandler = (e)=>{ e.preventDefault(); collapsed = !collapsed; setState(collapsed); };
      header.addEventListener('click', toggleHandler);
      hint.addEventListener('click', toggleHandler);
      wrapper.appendChild(header); wrapper.appendChild(body); wrapper.appendChild(hint);
      node.replaceWith(wrapper);
    });
    document.querySelectorAll('a[href^="http"]').forEach(a=>{ a.setAttribute('target','_blank'); a.setAttribute('rel','noopener noreferrer'); });
  })();`

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${inlineStyles}</style>
</head>
<body>
  <main class="page">
    ${tocHtml}
    <div class="article-card">
      <h1 class="article-title">${escapeHtml(title)}</h1>
      <div class="article-meta">
        <span>${escapeHtml(params.authorName || 'Unknown')}</span>
        ${createdAt ? `<span>${escapeHtml(new Date(createdAt).toLocaleDateString())}</span>` : ''}
      </div>
      <div class="reader-surface">
        ${contentWithEmbeddedImages}
      </div>
    </div>
  </main>
  <script>${inlineScript}</script>
</body>
</html>`

  return { filename, html }
}
