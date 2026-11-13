// The site's sections. The `ready` flag says whether a section has content to show: the
// header navigation and the footer render only the ready ones, so an unfinished section
// never appears as a placeholder. Turning one on is one change, made with its content.

export interface Section {
  id: 'projects' | 'contact' | 'writing' | 'resume';
  label: string;
  href: string;
  ready: boolean;
}

export const SECTIONS: readonly Section[] = [
  { id: 'projects', label: 'Projects', href: '/', ready: true },
  { id: 'contact', label: 'Contact', href: '#contact', ready: true },
  { id: 'writing', label: 'Writing', href: '#writing', ready: false },
  { id: 'resume', label: 'Resume', href: '#resume', ready: false },
];

/** The sections the page can link to: those with content, in site order. */
export const READY_SECTIONS: readonly Section[] = SECTIONS.filter((s) => s.ready);
