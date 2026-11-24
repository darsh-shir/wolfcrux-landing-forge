import * as React from "react";
import { Input } from "@/components/ui/input";

/** "-1234567.5" → "-12,34,567.5" (keeps a trailing "." or decimals while typing). */
export const groupIndian = (raw: string): string => {
  if (raw === "" || raw === "-") return raw;
  const neg = raw.startsWith("-");
  const body = neg ? raw.slice(1) : raw;
  const [int, ...rest] = body.split(".");
  const dec = rest.length ? "." + rest.join("") : "";
  const digits = int.replace(/^0+(?=\d)/, "");
  let out = "";
  if (digits.length <= 3) out = digits;
  else {
    out = digits.slice(-3);
    let head = digits.slice(0, -3);
    while (head.length > 2) {
      out = head.slice(-2) + "," + out;
      head = head.slice(0, -2);
    }
    if (head) out = head + "," + out;
  }
  return (neg ? "-" : "") + out + dec;
};

/** Keep only what a number can contain. */
const clean = (text: string, allowNegative: boolean, allowDecimal: boolean) => {
  let s = text.replace(/[^\d.-]/g, "");
  s = allowNegative ? s.replace(/(?!^)-/g, "") : s.replace(/-/g, "");
  if (!allowDecimal) s = s.replace(/\./g, "");
  else {
    const i = s.indexOf(".");
    if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, "");
  }
  return s;
};

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  /** Plain number text without commas, e.g. "2448654" or "" for empty. */
  value: string | number | null | undefined;
  /** Receives plain number text without commas. */
  onValueChange: (raw: string) => void;
  allowNegative?: boolean;
  allowDecimal?: boolean;
};

/**
 * Amount box for ₹ / $ that shows Indian commas while you type (24,48,654).
 * The value going in and out has no commas, so callers use Number(raw) as before.
 */
export const AmountInput = React.forwardRef<HTMLInputElement, Props>(
  ({ value, onValueChange, allowNegative = false, allowDecimal = true, ...rest }, ref) => {
    const inner = React.useRef<HTMLInputElement | null>(null);
    const caret = React.useRef<number | null>(null);
    const raw = value === null || value === undefined ? "" : String(value);
    const shown = groupIndian(clean(raw, allowNegative, allowDecimal));

    // Put the cursor back after the same number of digits it was after.
    React.useLayoutEffect(() => {
      const el = inner.current;
      if (!el || caret.current === null || document.activeElement !== el) return;
      let seen = 0;
      let pos = 0;
      while (pos < shown.length && seen < caret.current) {
        if (/[\d.-]/.test(shown[pos])) seen++;
        pos++;
      }
      el.setSelectionRange(pos, pos);
      caret.current = null;
    });

    return (
      <Input
        {...rest}
        ref={(el) => {
          inner.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
        }}
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        autoComplete="off"
        value={shown}
        onChange={(e) => {
          const before = e.target.value.slice(0, e.target.selectionStart ?? e.target.value.length);
          caret.current = before.replace(/[^\d.-]/g, "").length;
          onValueChange(clean(e.target.value, allowNegative, allowDecimal));
        }}
      />
    );
  },
);
AmountInput.displayName = "AmountInput";
