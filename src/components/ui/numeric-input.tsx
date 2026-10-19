"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

type NumericInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & {
  value: string | number;
  onChange?: InputHTMLAttributes<HTMLInputElement>["onChange"];
};

export function NumericInput({ value, onChange, onFocus, onBlur, ...props }: NumericInputProps) {
  const [draft, setDraft] = useState(String(value ?? ""));
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) setDraft(String(value ?? ""));
  }, [value]);

  return (
    <input
      {...props}
      value={draft}
      onFocus={(event) => {
        isFocused.current = true;
        onFocus?.(event);
      }}
      onChange={(event) => {
        setDraft(event.currentTarget.value);
        onChange?.(event);
      }}
      onBlur={(event) => {
        isFocused.current = false;
        setDraft(String(value ?? ""));
        onBlur?.(event);
      }}
    />
  );
}
