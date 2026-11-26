/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Property, Room, Settings, Tenancy, Tenant } from './data'

const BULAN = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember']
export const tarikh = (s: string | null) => {
  if (!s) return '____________'
  const d = new Date(s + 'T00:00:00')
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}
const NOMBOR = ['kosong', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'lapan', 'sembilan', 'sepuluh']
const rm = (n: number | null) => 'RM' + (n ?? 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function years(a: string | null, b: string | null) {
  if (!a || !b) return 1
  const y = Math.round((new Date(b).getTime() - new Date(a).getTime()) / (365.25 * 864e5))
  return Math.max(1, y)
}

export async function agreementPdf(t: Tenancy, tenant: Tenant, room: Room, prop: Property, s: Settings) {
  const pdfMake = (await import('pdfmake/build/pdfmake')).default as any
  const fonts = (await import('pdfmake/build/vfs_fonts')).default as any
  pdfMake.vfs = fonts?.pdfMake?.vfs ?? fonts?.vfs ?? fonts

  const landlord = s.landlord_name || '____________'
  const landlordIc = s.landlord_ic || '____________'
  const nama = tenant.full_name || tenant.nickname
  const ic = tenant.ic_no || '____________'
  const alamat = prop.address || '____________'
  const sewa = rm(t.monthly_rent)
  const deposit = rm(t.deposit ?? t.monthly_rent)
  const hari = t.pay_day ?? 1
  const grace = s.grace_days ?? 7
  const graceWord = `${(NOMBOR[grace] || String(grace)).toUpperCase()} (${grace})`
  const tempoh = years(t.start_date, t.end_date)
  const tempohWord = `${tempoh} (${NOMBOR[tempoh] || tempoh})`
  const bank = [`Nama Bank: ${s.bank_name || ''}`, `Nama Pemegang Akaun: ${s.account_name || ''}`, `Nombor Akaun: ${s.account_no || ''}`]

  const P = (text: any, extra: object = {}) => ({ text, margin: [0, 0, 0, 6], alignment: 'justify', ...extra })
  const list = (items: string[]) => ({ ol: items, type: 'lower-alpha', margin: [12, 0, 0, 8], separator: ['', ')'] })
  const sign = (who: string, name: string, icNo: string) => ({
    stack: [{ text: who, margin: [0, 0, 0, 40] }, '---------------------------------------', { text: name, bold: true }, `(NO. KP: ${icNo})`],
    alignment: 'center',
  })

  const doc = {
    pageSize: 'A4', pageMargins: [56, 56, 56, 56],
    defaultStyle: { fontSize: 10.5, lineHeight: 1.25 },
    footer: (cur: number, total: number) => ({ text: `${cur} / ${total}`, alignment: 'center', fontSize: 8, color: '#888', margin: [0, 20, 0, 0] }),
    content: [
      { text: '\n\n\nPERJANJIAN SEWAAN BILIK\nUNTUK KEDIAMAN', style: 'title' },
      { text: '\n\nANTARA\n\n', alignment: 'center' },
      { text: landlord, bold: true, alignment: 'center' }, { text: `(NO. KP: ${landlordIc})\n("Tuan Rumah")`, alignment: 'center' },
      { text: '\nDAN\n\n', alignment: 'center' },
      { text: nama, bold: true, alignment: 'center' }, { text: `(NO. KP: ${ic})\n("Penyewa")`, alignment: 'center' },
      { text: '\n\nALAMAT:', bold: true, alignment: 'center' }, { text: alamat, alignment: 'center' },
      { text: '\n\nBERTARIKH PADA', bold: true, alignment: 'center' }, { text: tarikh(t.agreement_date), alignment: 'center', pageBreak: 'after' },

      { text: 'PERJANJIAN', style: 'h' },
      P('Suatu perjanjian sewaan bilik untuk kediaman dibuat pada tarikh yang dinyatakan di muka surat hadapan, di antara Tuan Rumah sebagai pihak pertama dan Penyewa sebagai pihak kedua.'),
      { text: 'BAHAWASANYA', style: 'h' },
      list([
        `Tuan Rumah adalah pemilik berdaftar / pihak yang berhak menyewakan premis yang beralamat ${alamat}.`,
        `Tuan Rumah telah bersetuju menyewakan dan Penyewa telah bersetuju menyewa Premis tersebut bagi tempoh ${tempohWord} tahun, bermula pada ${tarikh(t.start_date)} dan tamat pada ${tarikh(t.end_date)}, dengan sewa bulanan sebanyak ${sewa} sebulan, tertakluk kepada terma dan syarat yang dinyatakan seterusnya.`,
      ]),
      { text: 'ADALAH DIPERSAKSIKAN SEPERTI BERIKUT', style: 'h' },
      P('1. Penyewa dengan ini bersetuju dengan Tuan Rumah seperti berikut:-'),
      list([
        `Membayar deposit keselamatan sebanyak ${deposit} semasa penyempurnaan Perjanjian ini, yang tidak akan dianggap sebagai bayaran sewa dan akan dikembalikan tanpa faedah dalam tempoh 30 hari selepas tamat tempoh penyewaan, tertakluk kepada hak Tuan Rumah untuk menampung tunggakan sewa, kos pembaikan (selain haus dan lusuh munasabah), atau apa-apa kemungkiran Perjanjian ini oleh Penyewa.`,
        `Membayar DEPOSIT sebanyak ${deposit} semasa penyempurnaan Perjanjian ini, dan seterusnya membayar sewa bulanan sebanyak ${sewa} pada atau sebelum ${hari}hb setiap bulan (dengan tempoh tenggang ${graceWord.toLowerCase()} hari), dikreditkan ke akaun bank berikut: ${bank.join('; ')}.`,
        'Tuan Rumah yang menanggung semua caj dan utiliti (air, elektrik, Indah Water, pelupusan sisa perdagangan dan pembetungan) sepanjang tempoh penyewaan.',
        'Menggunakan Premis tersebut hanya untuk tujuan kediaman sahaja.',
        'Menjaga bahagian dalaman dan luaran Premis tersebut serta semua lekapan dan kelengkapan milik Tuan Rumah dalam keadaan baik dan boleh diduduki sepanjang tempoh penyewaan (kecuali haus dan lusuh yang munasabah).',
        'Tidak membuat sebarang pengubahsuaian kepada bahagian luaran atau dalaman Premis tersebut tanpa kebenaran bertulis terlebih dahulu daripada Tuan Rumah.',
        'Membenarkan Tuan Rumah atau ejennya memasuki Premis tersebut pada waktu munasabah (9.00 pagi – 7.00 malam) dengan notis sekurang-kurangnya satu (1) hari terlebih dahulu, bagi tujuan pembaikan, pengubahsuaian atau pemeriksaan.',
        'Tidak melakukan atau membenarkan apa-apa perkara yang boleh membatalkan atau meningkatkan premium polisi insurans Premis tersebut, dan membayar balik kepada Tuan Rumah apa-apa peningkatan premium akibat kemungkiran Penyewa.',
        'Menyerahkan semula Premis tersebut berserta lekapan dan kelengkapan Tuan Rumah dalam keadaan baik apabila tamat atau ditamatkan awal tempoh penyewaan (kecuali haus dan lusuh munasabah), dan membaiki apa-apa kerosakan akibat pengalihan barangan Penyewa sendiri.',
        'Mematuhi semua undang-undang, undang-undang kecil dan peraturan berkaitan Premis tersebut, Penyewa, atau penghuninya.',
        'Tidak menjalankan atau membenarkan sebarang aktiviti yang menyalahi undang-undang, tidak bermoral, atau yang menyebabkan kacau-ganggu kepada Tuan Rumah atau penghuni bersebelahan; dan memberi ganti rugi kepada Tuan Rumah bagi apa-apa tuntutan berkaitan.',
        'Memberikan notis bertulis sekurang-kurangnya dua (2) bulan sebelum tamat tempoh penyewaan sekiranya berhasrat menggunakan opsyen pembaharuan.',
        'Sepanjang dua (2) bulan sebelum tamat tempoh penyewaan (melainkan notis pembaharuan telah diberikan), membenarkan Tuan Rumah atau wakilnya melawat Premis tersebut dengan notis tiga (3) hari terlebih dahulu bagi tujuan menyewakan semula.',
        'Tidak mendirikan altar/struktur pemujaan atau membakar colok/kemenyan (kecuali aromaterapi) di Premis tersebut.',
        'Tidak menyewakan semula, memberi lesen, atau memindah milik Perjanjian ini tanpa kebenaran bertulis terlebih dahulu daripada Tuan Rumah.',
        'Hanya membenarkan penghuni yang sah menduduki Premis tersebut, dan memaklumkan Tuan Rumah sebarang perubahan penghuni.',
        'Menyerahkan salinan sebarang notis/perintah pihak berkuasa yang menjejaskan Premis tersebut kepada Tuan Rumah, dan mematuhinya selaras Perjanjian ini.',
      ]),
      P('2. Tuan Rumah dengan ini berjanji dengan Penyewa seperti berikut:'),
      list([
        'Membayar semua cukai tanah, kadaran, cukai dan taksiran berkaitan Premis tersebut yang bukan tanggungjawab Penyewa.',
        'Penyewa yang mematuhi Perjanjian ini berhak memiliki dan menikmati Premis tersebut dengan aman sepanjang tempoh penyewaan tanpa gangguan daripada Tuan Rumah.',
        'Menyelenggara dan membaiki bumbung, struktur utama, dinding luar, saliran utama dan paip Premis tersebut apabila perlu.',
        'Memastikan Premis tersebut (tidak termasuk harta milik Penyewa) diinsuranskan mencukupi terhadap kebakaran sepanjang tempoh penyewaan.',
        `Mengembalikan Deposit Keselamatan sebanyak ${deposit} kepada Penyewa apabila tamat atau ditamatkan awal Perjanjian ini, tertakluk kepada hak Tuan Rumah mengimbangi kos yang ditanggung di bawah Perjanjian ini.`,
      ]),
      P('3. DENGAN INI DIPERSETUJUI SECARA JELAS ANTARA PIHAK-PIHAK DI SINI seperti berikut:'),
      list([
        'Sekiranya sewa tidak dibayar selama empat belas (14) hari selepas kena dibayar, atau mana-mana perjanjian Penyewa tidak dibaiki dalam 14 hari dari notis bertulis Tuan Rumah, ATAU Penyewa mengalami sitaan/pelaksanaan terhadap barangannya, adalah sah bagi Tuan Rumah memasuki semula Premis tersebut dan Perjanjian ini akan tamat sepenuhnya, tanpa menjejaskan hak tindakan Tuan Rumah bagi kemungkiran terdahulu.',
        'Sekiranya Premis tersebut musnah/rosak akibat kebakaran sehingga tidak boleh diduduki, Penyewa berhak memberi notis bertulis satu (1) bulan untuk menamatkan penyewaan, dan semua sewa terdahulu berserta deposit akan dikembalikan dengan segera.',
        'Sekiranya undang-undang baharu memerlukan perubahan struktur Premis tersebut, Tuan Rumah berhak mematuhi atas kosnya sendiri; Penyewa kemudian berhak meneruskan atau membatalkan Penyewaan (dengan deposit dikembalikan jika dibatalkan).',
        'Adalah juga dipersetujui bersama bahawa:-',
      ]),
      { ol: [
        `Selepas genap tempoh penyewaan ${tempoh} tahun dari tarikh ini, sekiranya Tuan Rumah memerlukan Premis tersebut untuk kegunaan sendiri atau bagi tujuan pembangunan apa jua sekalipun, Tuan Rumah boleh menamatkan Perjanjian Sewaan ini lebih awal dengan memberikan notis bertulis tiga (3) bulan kepada Penyewa mengenai penamatan lebih awal tersebut;`,
        `Selepas genap tempoh penyewaan ${tempoh} tahun dari tarikh ini, sekiranya Penyewa berhasrat untuk menamatkan Perjanjian Sewaan ini sebelum tamat tempoh yang diwujudkan di sini, Penyewa dikehendaki memberikan notis bertulis tiga (3) bulan mengenai penamatan lebih awal tersebut;`,
        `Sekiranya penyewa berhasrat untuk menamatkan Perjanjian Sewaan ini SEBELUM genap tempoh penyewaan ${tempohWord} tahun dari tarikh ini, deposit yang telah dibayar oleh penyewa TIDAK akan dikembalikan dan akan dilucuthakkan sepenuhnya kepada Tuan Rumah, sebagai ganti rugi bagi penamatan awal tersebut.`,
      ], type: 'lower-roman', margin: [28, 0, 0, 12], separator: ['', ')'] },
      P([{ text: 'PADA MENYAKSIKAN HAL DI ATAS', bold: true }, ', pihak-pihak di sini telah menandatangani perjanjian ini pada hari dan tahun yang mula-mula tersebut di atas.'], { margin: [0, 10, 0, 20] }),
      { columns: [sign('Ditandatangani oleh Tuan Rumah:', landlord, landlordIc), sign('Ditandatangani oleh Penyewa:', nama, ic)], unbreakable: true },
      { text: '\n' },
      { columns: [sign('Di hadapan:', s.witness_name || '____________', s.witness_ic || '____________'), sign('Di hadapan:', s.witness_name || '____________', s.witness_ic || '____________')], unbreakable: true },

      { text: 'JADUAL', style: 'h', pageBreak: 'before' },
      { text: '(yang hendaklah dianggap, dibaca dan ditafsirkan sebagai sebahagian yang tidak berasingan daripada Perjanjian ini)', italics: true, alignment: 'center', margin: [0, 0, 0, 10] },
      { table: { widths: [22, 150, '*'], body: [
        [{ text: 'No', bold: true }, { text: 'PERIHAL', bold: true }, { text: 'BUTIRAN', bold: true }],
        ['1.', 'Tarikh Perjanjian ini:', tarikh(t.agreement_date)],
        ['2.', 'Tuan Rumah:', `${landlord} (NO. KP: ${landlordIc})`],
        ['3.', 'Penyewa:', `${nama} (NO. KP: ${ic})`],
        ['4.', 'Premis tersebut:', `${alamat}\n(${room.name})`],
        ['5.', 'Tempoh Penyewaan:', `${tempohWord} tahun dengan opsyen untuk memperbaharui bagi satu tahun lagi pada kadar sewa pasaran semasa dan boleh dirunding.`],
        ['6.', 'a) Tarikh Mula Penyewaan:\nb) Tarikh Tamat:', `${tarikh(t.start_date)}\n${tarikh(t.end_date)}`],
        ['7.', 'Sewa Bulanan:', `${sewa} sebulan, dibayar pada atau sebelum ${hari} hari bulan setiap bulan.\nSewa pendahuluan: ${sewa}`],
        ['8.', 'Deposit:', `Deposit: ${deposit}\nAkan dikembalikan dalam tempoh 30 hari selepas berpindah keluar (tamat tempoh penyewaan)`],
        ['9.', 'Tarikh Akhir Bayaran Sewa Bulanan:', `Sewa perlu dibayar selewat-lewatnya pada ${hari} hari bulan setiap bulan kalendar. Tempoh tenggang selama ${graceWord} hari akan diberikan bagi setiap bulan berikutnya.`],
        ['10.', 'Akaun Bank Tuan Rumah untuk Kredit Sewa Bulanan:', bank.join('\n')],
        ['11.', 'Penggunaan:', 'Tuan Rumah hendaklah membayar semua caj dan perbelanjaan berkaitan bekalan air, elektrik, Indah Water, pembetungan dan utiliti lain yang dibekalkan kepada Premis tersebut sepanjang tempoh Penyewaan.'],
        ['12.', 'Tujuan:', 'Untuk kegunaan kediaman sahaja'],
        ['13.', 'Opsyen Pembaharuan:', `Opsyen pembaharuan penyewaan adalah selama satu (1) tahun selepas ${tarikh(t.end_date)} pada harga pasaran semasa.`],
        ['14.', 'Syarat Lain:', 'Membersihkan rumah apabila tamat tempoh penyewaan / serahan kepada pemilik.'],
      ] }, layout: { paddingTop: () => 5, paddingBottom: () => 5 } },

      { text: 'LAMPIRAN\n(DOKUMEN SOKONGAN)', style: 'h', pageBreak: 'before' },
      { text: '\nKad Pengenalan Penyewa (Depan)', alignment: 'center' },
      { canvas: [{ type: 'rect', x: 90, y: 10, w: 300, h: 190, dash: { length: 4 }, lineColor: '#999' }] },
      { text: '\n\nKad Pengenalan Penyewa (Belakang)', alignment: 'center' },
      { canvas: [{ type: 'rect', x: 90, y: 10, w: 300, h: 190, dash: { length: 4 }, lineColor: '#999' }] },
    ],
    styles: {
      title: { fontSize: 20, bold: true, alignment: 'center' },
      h: { bold: true, fontSize: 11.5, margin: [0, 10, 0, 6], alignment: 'center' },
    },
  }
  const file = `TA - ${nama}.pdf`.replace(/[\\/:*?"<>|]/g, '')
  pdfMake.createPdf(doc).download(file)
}
