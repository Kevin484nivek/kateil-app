"use client";

import { useEffect, useRef, type FormEvent, type ReactNode } from "react";

type AutoSubmitFormProps = {
  children: ReactNode;
  className?: string;
  debounceMs?: number;
  method?: "get" | "post";
};

function isDebouncedField(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement &&
    !["checkbox", "radio", "hidden", "file", "submit"].includes(target.type)
  );
}

export function AutoSubmitForm({
  children,
  className,
  debounceMs = 250,
  method = "get",
}: AutoSubmitFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function submitForm() {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  }

  function handleInput(event: FormEvent<HTMLFormElement>) {
    const target = event.target;

    if (!isDebouncedField(target)) {
      return;
    }

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    timeoutRef.current = window.setTimeout(() => {
      submitForm();
    }, debounceMs);
  }

  function handleChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target;

    if (isDebouncedField(target)) {
      return;
    }

    if (
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    ) {
      submitForm();
    }
  }

  return (
    <form
      ref={formRef}
      method={method}
      className={className}
      onInput={handleInput}
      onChange={handleChange}
    >
      {children}
    </form>
  );
}
