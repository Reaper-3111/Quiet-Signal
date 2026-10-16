export interface Resource {
  name: string;
  detail: string;
  phone?: string;
  url?: string;
  category?: 'shelter' | 'court' | 'advocate' | 'hotline';
  /** County or city it serves. */
  area?: string;
  /** Not real yet: shown only in development builds so a fake number can never reach a user. */
  placeholder?: boolean;
}

export const NATIONAL: Resource[] = [
  { name: 'Emergency', detail: 'Immediate danger', phone: '911' },
  { name: 'National Domestic Violence Hotline', detail: '24/7. You can also text START to 88788.', phone: '18007997233', url: 'https://www.thehotline.org' },
  { name: 'Safety Net (NNEDV)', detail: 'Technology safety tips', url: 'https://www.techsafety.org' },
];

// Local shelters, courts, and advocates for each launch area. Replace every placeholder with
// verified details (confirm with the agency) and remove `placeholder` before launch.
const AREA = 'St. Joseph County, IN';
export const LOCAL: Resource[] = [
  { name: 'Local shelter', detail: 'PLACEHOLDER: 24/7 shelter line and intake hours', category: 'shelter', area: AREA, placeholder: true },
  { name: 'Protective order help', detail: 'PLACEHOLDER: county court clerk, address and filing hours', category: 'court', area: AREA, placeholder: true },
  { name: 'Victim advocate', detail: "PLACEHOLDER: prosecutor's office or nonprofit advocate line", category: 'advocate', area: AREA, placeholder: true },
];

const LABELS: Record<NonNullable<Resource['category']>, string> = { hotline: 'Hotlines', shelter: 'Shelters', court: 'Courts and protective orders', advocate: 'Advocates' };

/** What the Resources screen lists, in sections. */
export function resourceSections(dev: boolean) {
  const local = LOCAL.filter((r) => dev || !r.placeholder);
  const sections = [{ title: 'National', items: NATIONAL }];
  for (const cat of ['advocate', 'shelter', 'court', 'hotline'] as const) {
    const items = local.filter((r) => (r.category ?? 'hotline') === cat);
    if (items.length) sections.push({ title: LABELS[cat], items });
  }
  return sections;
}
