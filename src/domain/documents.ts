/** Brazilian company and person registration numbers: clean, validate, format, mask. */

export const digits = (v: string) => v.replace(/\D/g, "");

function checkDigit(nums: string, weights: number[]): number {
  const sum = weights.reduce((t, w, i) => t + Number(nums[i]) * w, 0);
  const r = sum % 11;
  return r < 2 ? 0 : 11 - r;
}

export function isValidCnpj(value: string): boolean {
  const d = digits(value);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = checkDigit(d, w1);
  const d2 = checkDigit(d, [6, ...w1]);
  return d1 === Number(d[12]) && d2 === Number(d[13]);
}

export function formatCnpj(value: string): string {
  const d = digits(value).padStart(14, "0").slice(-14);
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** First 8 digits: the company. Branches share it; /0001 is usually the head office. */
export function cnpjRoot(value: string): string {
  return digits(value).slice(0, 8);
}
