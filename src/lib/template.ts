import JSZip from 'jszip'
import { supabase } from './supabase'

export const BUCKET = 'agreements'
export const TEMPLATE_PATH = 'template/agreement.docx'
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const PART = /^word\/(document|header\d*|footer\d*)\.xml$/

export type Template = { zip: JSZip; placeholders: string[]; images: string[] /* media paths in order of appearance */ }

let cache: Promise<Template | null> | null = null
export function clearTemplateCache() { cache = null }

export function loadTemplate(): Promise<Template | null> {
  if (!cache) cache = (async () => {
    const { data, error } = await supabase.storage.from(BUCKET).download(TEMPLATE_PATH)
    if (error || !data) return null
    return parseTemplate(await data.arrayBuffer())
  })().catch(e => { cache = null; throw e })
  return cache
}

export async function parseTemplate(buf: ArrayBuffer): Promise<Template> {
  const zip = await JSZip.loadAsync(buf)
  const found = new Set<string>()
  for (const name of Object.keys(zip.files).filter(n => PART.test(n))) {
    const doc = new DOMParser().parseFromString(await zip.file(name)!.async('string'), 'application/xml')
    for (const p of Array.from(doc.getElementsByTagNameNS(W, 'p'))) {
      const text = Array.from(p.getElementsByTagNameNS(W, 't')).map(t => t.textContent).join('')
      for (const m of text.matchAll(/\{\{\s*(.+?)\s*\}\}/g)) found.add(m[1])
    }
  }
  // images in document order -> media paths
  const docXml = await zip.file('word/document.xml')!.async('string')
  const rels = new DOMParser().parseFromString(await zip.file('word/_rels/document.xml.rels')!.async('string'), 'application/xml')
  const target: Record<string, string> = {}
  for (const r of Array.from(rels.getElementsByTagName('Relationship'))) target[r.getAttribute('Id')!] = 'word/' + r.getAttribute('Target')!.replace(/^\/?word\//, '')
  const images = [...docXml.matchAll(/r:embed="(rId\d+)"/g)].map(m => target[m[1]]).filter(Boolean)
  return { zip, placeholders: [...found], images }
}

/** Replace {{placeholders}} even when Word split them across several runs. */
function fillXml(xml: string, values: Record<string, string>) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  for (const p of Array.from(doc.getElementsByTagNameNS(W, 'p'))) {
    const ts = Array.from(p.getElementsByTagNameNS(W, 't'))
    const full = ts.map(t => t.textContent ?? '').join('')
    if (!full.includes('{{')) continue
    // map each char to its node
    const owner: number[] = []; ts.forEach((t, i) => { for (let k = 0; k < (t.textContent ?? '').length; k++) owner.push(i) })
    const parts = ts.map(t => t.textContent ?? '')
    const re = /\{\{\s*(.+?)\s*\}\}/g; const hits: { s: number; e: number; v: string }[] = []
    for (const m of full.matchAll(re)) hits.push({ s: m.index!, e: m.index! + m[0].length, v: values[m[1]] ?? '' })
    // rebuild per node from the right so indexes stay valid
    const newText = parts.slice()
    const starts: number[] = []; let acc = 0; parts.forEach(s => { starts.push(acc); acc += s.length })
    for (const h of hits.reverse()) {
      const a = owner[h.s], b = owner[h.e - 1]
      if (a === b) {
        const o = starts[a]; newText[a] = newText[a].slice(0, h.s - o) + h.v + newText[a].slice(h.e - o)
      } else {
        newText[a] = newText[a].slice(0, h.s - starts[a]) + h.v
        for (let i = a + 1; i < b; i++) newText[i] = ''
        newText[b] = newText[b].slice(h.e - starts[b])
      }
    }
    ts.forEach((t, i) => { t.textContent = newText[i]; t.setAttribute('xml:space', 'preserve') })
  }
  return new XMLSerializer().serializeToString(doc)
}

const BLANK_PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='), c => c.charCodeAt(0))

/** Fill the Word template. icImages replaces the 4th and 5th pictures (IC front/back); missing ones become blank. */
export async function fillDocx(t: Template, values: Record<string, string>, icImages: [Blob | null, Blob | null]) {
  const zip = await JSZip.loadAsync(await t.zip.generateAsync({ type: 'arraybuffer' }))
  for (const name of Object.keys(zip.files).filter(n => PART.test(n)))
    zip.file(name, fillXml(await zip.file(name)!.async('string'), values))
  const icSlots = [t.images[3], t.images[4]]
  for (let i = 0; i < 2; i++) {
    const slot = icSlots[i]; if (!slot) continue
    // Word picks the decoder from the content, so a JPEG in a .png slot still displays.
    zip.file(slot, icImages[i] ? await icImages[i]!.arrayBuffer() : BLANK_PNG)
  }
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}

/** Signature pictures from the template: [landlord, witness] as data URLs. */
export async function templateSignatures(t: Template): Promise<[string | null, string | null]> {
  const get = async (p?: string) => {
    if (!p || !t.zip.file(p)) return null
    const ext = p.split('.').pop()!.toLowerCase()
    return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,` + await t.zip.file(p)!.async('base64')
  }
  return [await get(t.images[0]), await get(t.images[1])]
}

export async function fileUrl(path: string, seconds = 300) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds)
  if (error) throw error
  return data.signedUrl
}
export async function fileBlob(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw error
  return data
}
export async function blobToDataUrl(b: Blob) {
  return new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(b) })
}
export function saveBlob(b: Blob, name: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000)
}
