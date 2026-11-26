import type { Data, Tenancy } from './data'
import { agreementPdfBlob, agreementValues } from './pdf'
import { blobToDataUrl, fileBlob, fillDocx, loadTemplate, saveBlob, templateSignatures } from './template'

function parts(d: Data, t: Tenancy) {
  const tenant = d.tenants.find(x => x.id === t.tenant_id)
  const room = d.rooms.find(r => r.id === t.room_id)
  const prop = d.properties.find(p => p.id === room?.property_id)
  return { tenant, room, prop, name: (tenant?.full_name || tenant?.nickname || 'Penyewa').replace(/[\\/:*?"<>|]/g, '') }
}
const icBlobs = async (t: Tenancy) => Promise.all([t.ic_front_path, t.ic_back_path].map(p => p ? fileBlob(p).catch(() => null) : null)) as Promise<[Blob | null, Blob | null]>

export async function agreementPdf(d: Data, t: Tenancy) {
  const { tenant, prop } = parts(d, t)
  const [tpl, ics] = await Promise.all([loadTemplate().catch(() => null), icBlobs(t)])
  const [landlordSig, witnessSig] = tpl ? await templateSignatures(tpl) : [null, null]
  const [icFront, icBack] = await Promise.all(ics.map(b => b && /image\/(png|jpe?g)/.test(b.type) ? blobToDataUrl(b) : null))
  return agreementPdfBlob(agreementValues(t, tenant, prop), d.settings!, { landlordSig, witnessSig, icFront, icBack })
}

/** Opens the PDF in a new tab. Call straight from a click so the tab isn't blocked. */
export async function openAgreementPdf(d: Data, t: Tenancy) {
  const w = window.open('', '_blank')
  if (w) w.document.write('<p style="font-family:sans-serif;padding:2rem">Preparing agreement…</p>')
  try {
    const blob = await agreementPdf(d, t)
    const url = URL.createObjectURL(blob)
    if (w) w.location.href = url; else saveBlob(blob, `TA - ${parts(d, t).name}.pdf`)
  } catch (e) { w?.close(); throw e }
}

export async function downloadAgreementPdf(d: Data, t: Tenancy) {
  saveBlob(await agreementPdf(d, t), `TA - ${parts(d, t).name}.pdf`)
}

export async function downloadAgreementWord(d: Data, t: Tenancy) {
  const tpl = await loadTemplate()
  if (!tpl) throw new Error('Upload your Word template in Settings first.')
  const { tenant, prop, name } = parts(d, t)
  const blob = await fillDocx(tpl, agreementValues(t, tenant, prop), await icBlobs(t))
  saveBlob(blob, `TA - ${name}.docx`)
}
