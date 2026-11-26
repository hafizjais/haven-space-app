/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Property, Settings, Tenancy, Tenant } from './data'

const BULAN = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember']
export const tarikh = (s: string | null | undefined) => {
  if (!s) return ''
  const d = new Date(s + 'T00:00:00')
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}
const money = (n: number | null | undefined) => (n ?? 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** The 8 fields of the Haven Space template, keyed by the exact {{placeholder}} name. */
export const FIELDS = [
  { key: 'Nama Penuh Penyewa', label: 'Nama Penuh Penyewa (as in IC)' },
  { key: 'IC Penyewa', label: 'IC Penyewa' },
  { key: 'Alamat', label: 'Alamat premis' },
  { key: 'Tarikh Perjanjian', label: 'Tarikh Perjanjian' },
  { key: 'Tarikh Mula Sewa', label: 'Tarikh Mula Sewa' },
  { key: 'Tarikh Tamat Sewa', label: 'Tarikh Tamat Sewa' },
  { key: 'Sewa Bulanan (RM)', label: 'Sewa Bulanan (RM)' },
  { key: 'Tarikh Bayaran Sewa', label: 'Tarikh Bayaran Sewa (hari bulan)' },
] as const

export function agreementValues(t: Tenancy, tenant: Tenant | undefined, prop: Property | undefined): Record<string, string> {
  return {
    ...(t.extra_fields ?? {}),
    'Nama Penuh Penyewa': tenant?.full_name || '',
    'IC Penyewa': tenant?.ic_no || '',
    'Alamat': t.premises_address || prop?.address || '',
    'Tarikh Perjanjian': tarikh(t.agreement_date),
    'Tarikh Mula Sewa': tarikh(t.start_date),
    'Tarikh Tamat Sewa': tarikh(t.end_date),
    'Sewa Bulanan (RM)': money(t.monthly_rent),
    'Tarikh Bayaran Sewa': t.pay_day ? String(t.pay_day) : '',
  }
}

type Extras = { landlordSig: string | null; witnessSig: string | null; icFront: string | null; icBack: string | null }

export async function agreementPdfBlob(v: Record<string, string>, s: Settings, x: Extras): Promise<Blob> {
  const pdfMake = (await import('pdfmake/build/pdfmake')).default as any
  const fonts = (await import('pdfmake/build/vfs_fonts')).default as any
  pdfMake.vfs = fonts?.pdfMake?.vfs ?? fonts?.vfs ?? fonts

  const blank = '________________'
  const f = (k: string) => v[k] || blank
  const landlord = s.landlord_name || blank, landlordIc = s.landlord_ic || blank
  const witness = s.witness_name || blank, witnessIc = s.witness_ic || blank
  const nama = f('Nama Penuh Penyewa'), ic = f('IC Penyewa'), alamat = f('Alamat')
  const sewa = 'RM' + f('Sewa Bulanan (RM)'), hari = f('Tarikh Bayaran Sewa')
  const bank = [`Nama Bank: ${s.bank_name || ''}`, `Nama Pemegang Akaun: ${s.account_name || ''}`, `Nombor Akaun: ${s.account_no || ''}`]

  const P = (text: any, extra: object = {}) => ({ text, margin: [0, 0, 0, 6], alignment: 'justify', ...extra })
  const item = (label: string, text: any) => ({ columns: [{ text: label, width: 18 }, { text, alignment: 'justify' }], margin: [12, 0, 0, 5] })
  const items = (arr: any[], letters = 'abcdefghijklmnopqrstuvwxyz') => arr.map((t, i) => item(letters[i] + ')', t))
  const sub = (label: string, text: any) => ({ columns: [{ text: label, width: 24 }, { text, alignment: 'justify' }], margin: [30, 0, 0, 5] })
  const sign = (who: string, img: string | null, name: string, icNo: string) => ({
    stack: [{ text: who, margin: [0, 0, 0, 4] }, img ? { image: img, fit: [110, 60], alignment: 'center' } : { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 1, y2: 0, lineColor: '#ffffff' }], margin: [0, 0, 0, 59] },
      '---------------------------------------', { text: name, bold: true }, `(NO. KP: ${icNo})`],
    alignment: 'center',
  })
  const icBox = (img: string | null, label: string) => [
    { text: label, alignment: 'center', margin: [0, 16, 0, 8] },
    img ? { image: img, fit: [300, 200], alignment: 'center' } : { canvas: [{ type: 'rect', x: 90, y: 0, w: 300, h: 190, dash: { length: 4 }, lineColor: '#999' }] },
  ]

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
      { text: '\n\nBERTARIKH PADA', bold: true, alignment: 'center' }, { text: f('Tarikh Perjanjian'), alignment: 'center', pageBreak: 'after' },

      { text: 'PERJANJIAN', style: 'h' },
      P('Suatu perjanjian sewaan bilik untuk kediaman dibuat pada tarikh yang dinyatakan di muka surat hadapan, di antara Tuan Rumah sebagai pihak pertama dan Penyewa sebagai pihak kedua.'),
      { text: 'BAHAWASANYA', style: 'h' },
      ...items([
        `Tuan Rumah adalah pemilik berdaftar / pihak yang berhak menyewakan premis yang beralamat ${alamat}.`,
        `Tuan Rumah telah bersetuju menyewakan dan Penyewa telah bersetuju menyewa Premis tersebut bagi tempoh 1 (satu) tahun, bermula pada ${f('Tarikh Mula Sewa')} dan tamat pada ${f('Tarikh Tamat Sewa')}, dengan sewa bulanan sebanyak ${sewa} sebulan, tertakluk kepada terma dan syarat yang dinyatakan seterusnya.`,
      ]),
      { text: 'ADALAH DIPERSAKSIKAN SEPERTI BERIKUT', style: 'h' },
      P('1. Penyewa dengan ini bersetuju dengan Tuan Rumah seperti berikut:-'),
      ...items([
        `Membayar deposit keselamatan sebanyak ${sewa} semasa penyempurnaan Perjanjian ini, yang tidak akan dianggap sebagai bayaran sewa dan akan dikembalikan tanpa faedah dalam tempoh 30 hari selepas tamat tempoh penyewaan, tertakluk kepada hak Tuan Rumah untuk menampung tunggakan sewa, kos pembaikan (selain haus dan lusuh munasabah), atau apa-apa kemungkiran Perjanjian ini oleh Penyewa.`,
        [`Membayar DEPOSIT sebanyak ${sewa} semasa penyempurnaan Perjanjian ini, dan seterusnya membayar sewa bulanan sebanyak ${sewa} pada atau sebelum ${hari}hb setiap bulan (dengan tempoh tenggang tujuh (7) hari), dikreditkan ke akaun bank berikut:\n`, ...bank.map(b => b + '\n')],
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
      P('2. Tuan Rumah dengan ini berjanji dengan Penyewa seperti berikut:', { margin: [0, 6, 0, 6] }),
      ...items([
        'Membayar semua cukai tanah, kadaran, cukai dan taksiran berkaitan Premis tersebut yang bukan tanggungjawab Penyewa.',
        'Penyewa yang mematuhi Perjanjian ini berhak memiliki dan menikmati Premis tersebut dengan aman sepanjang tempoh penyewaan tanpa gangguan daripada Tuan Rumah.',
        'Menyelenggara dan membaiki bumbung, struktur utama, dinding luar, saliran utama dan paip Premis tersebut apabila perlu.',
        'Memastikan Premis tersebut (tidak termasuk harta milik Penyewa) diinsuranskan mencukupi terhadap kebakaran sepanjang tempoh penyewaan.',
        `Mengembalikan Deposit Keselamatan sebanyak ${sewa} kepada Penyewa apabila tamat atau ditamatkan awal Perjanjian ini, tertakluk kepada hak Tuan Rumah mengimbangi kos yang ditanggung di bawah Perjanjian ini.`,
      ]),
      P('3. DENGAN INI DIPERSETUJUI SECARA JELAS ANTARA PIHAK-PIHAK DI SINI seperti berikut:', { margin: [0, 6, 0, 6] }),
      item('a)', { text: 'BAYARAN LEWAT TUJUH (7) HARI - NOTIS AMARAN', bold: true }),
      item('', 'Sekiranya sewa tidak dibayar dalam tempoh tujuh (7) hari selepas tarikh pembayaran yang ditetapkan, Tuan Rumah berhak mengeluarkan NOTIS AMARAN bertulis kepada Penyewa. Notis amaran ini sebagai peringatan bahawa Penyewa wajib membayar sewa tertunggak dalam tempoh tiga (3) hari selepas menerima notis tersebut. Kegagalan untuk membuat pembayaran selepas menerima notis amaran akan memberi Tuan Rumah hak untuk mengambil tindakan lanjut.'),
      item('b)', { text: 'BAYARAN LEWAT SATU (1) BULAN PENUH - SURAT PENAMATAN PERJANJIAN', bold: true }),
      item('', 'Sekiranya sewa tetap tidak dibayar sehingga lambat satu (1) bulan penuh daripada tarikh pembayaran yang ditetapkan, Tuan Rumah berhak mengeluarkan SURAT PENAMATAN PERJANJIAN SEWAAN. Surat penamatan ini akan memberi notis kepada Penyewa untuk mengosongkan Premis dalam tempoh tidak kurang daripada tujuh (7) hari. Penyewa wajib menyerahkan kembali Premis dalam keadaan bersih dan sempurna. Sekiranya Penyewa gagal mengosongkan Premis dalam tempoh yang diberikan, Tuan Rumah berhak mengambil tindakan undang-undang untuk pengusiran melalui mahkamah.'),
      item('c)', { text: 'TIDAK MEMBUAT BAYARAN SEWA BERBULAN LANGSUNG - SURAT ADUAN POLIS DAN TINDAKAN MAHKAMAH', bold: true }),
      item('', 'Sekiranya Penyewa sepenuhnya tidak membuat bayaran sewa selama dua (2) bulan atau lebih, atau sekiranya Penyewa enggan mengosongkan Premis setelah menerima Surat Penamatan, Tuan Rumah berhak mengambil tindakan undang-undang yang lebih serius, termasuk tetapi tidak terhad kepada:'),
      sub('•', 'Membuat laporan polis berkaitan dengan kemungkiran kontrak dan penolakan untuk mengosongkan Premis;'),
      sub('•', 'Memulakan prosedur saman di mahkamah untuk memperoleh Perintah Pengusiran dan tuntutan untuk semua bayaran sewa tertunggak, caj kerosakan, kos prosiding mahkamah, dan ganti rugi yang berkaitan.'),
      item('d)', { text: 'RUJUKAN UNDANG-UNDANG BERKAITAN PROSEDUR PENGUSIRAN', bold: true }),
      item('', 'Prosedur pengusiran yang dilakukan oleh Tuan Rumah adalah tertakluk kepada peruntukan dalam undang-undang berkaitan berikut:'),
      sub('i)', [{ text: 'RESIDENTIAL TENANCIES ACT 1966\n', bold: true }, 'Bagi pengusiran penyewa yang gagal membayar sewa atau melakukan kemungkiran terhadap syarat-syarat perjanjian sewaan, prosedur pengusiran akan dijalankan mengikut peruntukan Akta Sewaan Kediaman 1966. Tuan Rumah mesti memberikan notis bertulis yang wajar kepada Penyewa sebelum membuat permohonan ke mahkamah.']),
      sub('ii)', [{ text: 'CIVIL LAW ACT 1956\n', bold: true }, 'Prosedur saman dan penguatkuasaan hak Tuan Rumah melalui sistem undang-undang awam Malaysia akan mengikut peruntukan Akta Undang-Undang Sivil 1956. Setiap tindakan undang-undang akan dijalankan melalui mahkamah yang berwenang.']),
      sub('iii)', [{ text: 'DISTRESS ACT 1955\n', bold: true }, 'Tuan Rumah berhak mengambil alih hak barang alih milik Penyewa untuk membayar sewa tertunggak mengikut peruntukan Akta Gangguan 1955, sekiranya berkenaan dengan keadaan.']),
      sub('iv)', [{ text: 'RULES OF COURT 2012\n', bold: true }, 'Semua prosedur permohonan pengusiran dan pengendalian kes di mahkamah akan mematuhi Peraturan-Peraturan Mahkamah 2012.']),
      ...items([
        'Sekiranya Premis tersebut musnah/rosak akibat kebakaran sehingga tidak boleh diduduki, Penyewa berhak memberi notis bertulis satu (1) bulan untuk menamatkan penyewaan, dan semua sewa terdahulu berserta deposit akan dikembalikan dengan segera.',
        'Sekiranya undang-undang baharu memerlukan perubahan struktur Premis tersebut, Tuan Rumah berhak mematuhi atas kosnya sendiri; Penyewa kemudian berhak meneruskan atau membatalkan Penyewaan (dengan deposit dikembalikan jika dibatalkan).',
        'Selepas genap tempoh penyewaan 1 tahun dari tarikh ini, sekiranya Tuan Rumah memerlukan Premis tersebut untuk kegunaan sendiri atau bagi tujuan pembangunan apa jua sekalipun, Tuan Rumah boleh menamatkan Perjanjian Sewaan ini lebih awal dengan memberikan notis bertulis tiga (3) bulan kepada Penyewa;',
        'Selepas genap tempoh penyewaan 1 tahun dari tarikh ini, sekiranya Penyewa berhasrat untuk menamatkan Perjanjian Sewaan ini sebelum tamat tempoh yang diwujudkan di sini, Penyewa dikehendaki memberikan notis bertulis tiga (3) bulan;',
        'Sekiranya penyewa berhasrat untuk menamatkan Perjanjian Sewaan ini SEBELUM genap tempoh penyewaan satu (1) tahun dari tarikh ini, deposit yang telah dibayar oleh penyewa TIDAK akan dikembalikan dan akan dilucuthakkan sepenuhnya kepada Tuan Rumah, sebagai ganti rugi bagi penamatan awal tersebut.',
      ], 'efghi'),
      P([{ text: 'PADA MENYAKSIKAN HAL DI ATAS', bold: true }, ', pihak-pihak di sini telah menandatangani perjanjian ini pada hari dan tahun yang mula-mula tersebut di atas.'], { margin: [0, 12, 0, 16] }),
      { columns: [sign('Ditandatangani oleh Tuan Rumah:', x.landlordSig, landlord, landlordIc), sign('Ditandatangani oleh Penyewa:', null, nama, ic)], unbreakable: true },
      { text: '\n' },
      { columns: [sign('Di hadapan:', x.witnessSig, witness, witnessIc), sign('Di hadapan:', x.witnessSig, witness, witnessIc)], unbreakable: true },

      { text: 'JADUAL', style: 'h', pageBreak: 'before' },
      { text: '(yang hendaklah dianggap, dibaca dan ditafsirkan sebagai sebahagian yang tidak berasingan daripada Perjanjian ini)', italics: true, alignment: 'center', margin: [0, 0, 0, 10] },
      { table: { widths: [22, 150, '*'], body: [
        [{ text: 'No', bold: true }, { text: 'PERIHAL', bold: true }, { text: 'BUTIRAN', bold: true }],
        ['1.', 'Tarikh Perjanjian ini:', f('Tarikh Perjanjian')],
        ['2.', 'Tuan Rumah:', `${landlord}\n(NO. KP: ${landlordIc})`],
        ['3.', 'Penyewa:', `${nama}\n(NO. KP: ${ic})`],
        ['4.', 'Premis tersebut:', alamat],
        ['5.', 'Tempoh Penyewaan:', '(1) tahun dengan opsyen untuk memperbaharui bagi satu tahun lagi pada kadar sewa pasaran semasa dan boleh dirunding.'],
        ['6.', 'a) Tarikh Mula Penyewaan:\nb) Tarikh Tamat:', `${f('Tarikh Mula Sewa')}\n${f('Tarikh Tamat Sewa')}`],
        ['7.', 'Sewa Bulanan:', `${sewa} sebulan, dibayar pada atau sebelum ${hari} hari bulan setiap bulan.\nSewa pendahuluan: ${sewa}`],
        ['8.', 'Deposit:', `Deposit: ${sewa} (bersamaan dengan sewa satu (1) bulan)\nAkan dikembalikan dalam tempoh 30 hari selepas berpindah keluar (tamat tempoh penyewaan)`],
        ['9.', 'Tarikh Akhir Bayaran Sewa Bulanan:', `Sewa perlu dibayar selewat-lewatnya pada ${hari} hari bulan setiap bulan kalendar. Tempoh tenggang selama TUJUH (7) hari akan diberikan bagi setiap bulan berikutnya.`],
        ['10.', 'Akaun Bank Tuan Rumah untuk Kredit Sewa Bulanan:', bank.join('\n')],
        ['11.', 'Penggunaan:', 'Tuan Rumah hendaklah membayar semua caj dan perbelanjaan berkaitan bekalan air, elektrik, Indah Water, pembetungan dan utiliti lain yang dibekalkan kepada Premis tersebut sepanjang tempoh Penyewaan.'],
        ['12.', 'Tujuan:', 'Untuk kegunaan kediaman sahaja'],
        ['13.', 'Opsyen Pembaharuan:', `Opsyen pembaharuan penyewaan adalah selama satu (1) tahun selepas ${f('Tarikh Mula Sewa')} pada harga pasaran semasa.`],
        ['14.', 'Syarat Lain:', 'Membersihkan rumah apabila tamat tempoh penyewaan / serahan kepada pemilik.'],
      ] }, layout: { paddingTop: () => 3, paddingBottom: () => 3 }, fontSize: 10 },

      { text: 'LAMPIRAN\n(DOKUMEN SOKONGAN)', style: 'h', pageBreak: 'before' },
      ...icBox(x.icFront, 'Kad Pengenalan Penyewa (Depan)'),
      ...icBox(x.icBack, 'Kad Pengenalan Penyewa (Belakang)'),
    ],
    styles: {
      title: { fontSize: 20, bold: true, alignment: 'center' },
      h: { bold: true, fontSize: 11.5, margin: [0, 10, 0, 6], alignment: 'center' },
    },
  }
  return new Promise(res => pdfMake.createPdf(doc).getBlob((b: Blob) => res(b)))
}
