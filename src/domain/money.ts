/** Decimal text -> whole paise, with symmetric half-away-from-zero rounding. */
export function toPaise(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Money must be finite.");
  const [coefficient, exponent = "0"] = String(Math.abs(value)).toLowerCase().split("e");
  const [whole, fraction = ""] = coefficient.split(".");
  const digits = BigInt(whole + fraction);
  const shift = 2 + Number(exponent) - fraction.length;
  const divisor = shift < 0 ? BigInt(10) ** BigInt(-shift) : BigInt(1);
  const absolute = shift >= 0 ? digits * BigInt(10) ** BigInt(shift) : (digits + divisor / BigInt(2)) / divisor;
  const paise = Number(absolute) * Math.sign(value);
  if (!Number.isSafeInteger(paise)) throw new Error("Money amount is outside the supported range.");
  return paise || 0;
}

export const money = (value: number): number => toPaise(value) / 100;
export const sumMoney = (values: number[]): number => {
  const total = values.reduce((sum, value) => sum + BigInt(toPaise(value)), BigInt(0));
  if (!Number.isSafeInteger(Number(total))) throw new Error("Money total is outside the supported range.");
  return Number(total) / 100;
};

/** Round an integer-paise proportion without intermediate floating point money. */
export function prorateMoney(value: number, numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0)
    throw new Error("Money proportions require integers and a positive denominator.");
  const product = BigInt(toPaise(value)) * BigInt(numerator);
  const absolute = product < BigInt(0) ? -product : product;
  const rounded = (absolute * BigInt(2) + BigInt(denominator)) / (BigInt(denominator) * BigInt(2));
  const result = Number(rounded) * (product < BigInt(0) ? -1 : 1);
  if (!Number.isSafeInteger(result)) throw new Error("Money amount is outside the supported range.");
  return result / 100 || 0;
}
