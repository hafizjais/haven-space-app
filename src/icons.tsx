// Outline icons adapted from Lucide (ISC licence), inlined so the app needs no icon package.
const P: Record<string, string[]> = {
  dashboard: ['<rect x="3" y="3" width="7" height="9" rx="1"/>', '<rect x="14" y="3" width="7" height="5" rx="1"/>', '<rect x="14" y="12" width="7" height="9" rx="1"/>', '<rect x="3" y="16" width="7" height="5" rx="1"/>'],
  wallet: ['<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/>', '<path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>'],
  bed: ['<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/>', '<path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/>', '<path d="M12 4v6"/>', '<path d="M2 18h20"/>'],
  users: ['<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>', '<circle cx="9" cy="7" r="4"/>', '<path d="M22 21v-2a4 4 0 0 0-3-3.87"/>', '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>'],
  receipt: ['<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/>', '<path d="M8 8h8"/>', '<path d="M8 12h8"/>', '<path d="M8 16h5"/>'],
  file: ['<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>', '<path d="M14 2v4a2 2 0 0 0 2 2h4"/>', '<path d="M10 9H8"/>', '<path d="M16 13H8"/>', '<path d="M16 17H8"/>'],
  settings: ['<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>', '<circle cx="12" cy="12" r="3"/>'],
  trend: ['<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>', '<polyline points="16 7 22 7 22 13"/>'],
  coins: ['<rect x="2" y="6" width="20" height="12" rx="2"/>', '<circle cx="12" cy="12" r="2"/>', '<path d="M6 12h.01M18 12h.01"/>'],
  wrench: ['<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'],
  percent: ['<line x1="19" x2="5" y1="5" y2="19"/>', '<circle cx="6.5" cy="6.5" r="2.5"/>', '<circle cx="17.5" cy="17.5" r="2.5"/>'],
  alert: ['<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>', '<path d="M12 9v4"/>', '<path d="M12 17h.01"/>'],
  chat: ['<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'],
  home: ['<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>', '<path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'],
}
export type IconName = keyof typeof P
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: P[name].join('') }} />
}
