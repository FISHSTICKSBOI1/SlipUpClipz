export function SocialIcon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
    {name === 'YouTube' ? <><rect x="2" y="5" width="20" height="14" rx="5" /><path d="m10 9 6 3-6 3Z" fill="#15172e" /></> :
      name === 'Instagram' ? <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="18" cy="6" r="1" /></> :
      <path d="M14 2h3c.3 3 2 4.6 5 5v3c-2 0-3.5-.7-5-1.6V16a6 6 0 1 1-7-5.9v3a3 3 0 1 0 4 2.9Z" />}
  </svg>
}
