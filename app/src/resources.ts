export interface Resource {
  name: string;
  detail: string;
  phone?: string;
  url?: string;
}

export const NATIONAL: Resource[] = [
  { name: 'Emergency', detail: 'Immediate danger', phone: '911' },
  { name: 'National Domestic Violence Hotline', detail: '24/7. You can also text START to 88788.', phone: '18007997233', url: 'https://www.thehotline.org' },
  { name: 'Safety Net (NNEDV)', detail: 'Technology safety tips', url: 'https://www.techsafety.org' },
];

// Fill in local shelters, courts, and advocates for each launch area.
export const LOCAL: Resource[] = [];
