import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number in Indian numbering system (1,00,00,000)
 * Use this for ALL numeric displays across the app.
 */
export function formatIndian(value: number, decimals = 0): string {
  const absVal = Math.abs(value);
  const fixed = absVal.toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  
  // Indian grouping: last 3 digits, then groups of 2
  let result = "";
  const len = intPart.length;
  if (len <= 3) {
    result = intPart;
  } else {
    result = intPart.slice(len - 3);
    let remaining = intPart.slice(0, len - 3);
    while (remaining.length > 2) {
      result = remaining.slice(remaining.length - 2) + "," + result;
      remaining = remaining.slice(0, remaining.length - 2);
    }
    if (remaining.length > 0) {
      result = remaining + "," + result;
    }
  }
  
  if (decPart) result += "." + decPart;
  if (value < 0) result = "-" + result;
  return result;
}

/**
 * Format currency with Indian numbering. 
 * prefix defaults to "$". Pass "₹" for INR.
 */
export function formatCurrencyINR(value: number, prefix = "$", decimals = 2): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}${prefix}${formatIndian(Math.abs(value), decimals)}`;
}

/**
 * Format large currency values with abbreviations (K/M) using Indian formatting for the base.
 */
export function formatCurrencyCompact(value: number, prefix = "$"): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absValue >= 1000000) {
    return `${sign}${prefix}${formatIndian(Math.round(value / 10000) / 100, 2)}M`;
  } else if (absValue >= 1000) {
    return `${sign}${prefix}${formatIndian(Math.round(value / 100) / 10, 1)}K`;
  }
  return `${sign}${prefix}${formatIndian(absValue, 0)}`;
}
