export function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPreviousDay(d: Date): Date {
  const prev = new Date(d);
  prev.setDate(prev.getDate() - 1);
  return prev;
}
