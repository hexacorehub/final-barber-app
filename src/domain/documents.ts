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

export function isValidCpf(value: string): boolean {
  const d = digits(value);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export function formatCpf(value: string): string {
  const d = digits(value).padStart(11, "0").slice(-11);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
