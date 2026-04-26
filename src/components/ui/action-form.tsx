"use client";

import { type ComponentPropsWithoutRef, type KeyboardEvent, type ReactNode } from "react";

type ActionFormProps = {
  action?: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  className?: string;
  method?: ComponentPropsWithoutRef<"form">["method"];
  preventEnterSubmit?: boolean;
};

export function ActionForm({
  action,
  children,
  className,
  method,
  preventEnterSubmit = true,
}: ActionFormProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (!preventEnterSubmit || event.key !== "Enter") {
      return;
    }

    const target = event.target as HTMLElement;

    if (target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement) {
      return;
    }

    event.preventDefault();
  }

  return (
    <form action={action} className={className} method={method} onKeyDown={handleKeyDown}>
      {children}
    </form>
  );
}
