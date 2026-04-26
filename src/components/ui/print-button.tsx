"use client";

type PrintButtonProps = {
  className?: string;
  filename?: string;
  label?: string;
};

export function PrintButton({
  className = "button button-primary",
  filename,
  label = "Imprimir justificante",
}: PrintButtonProps) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const previousTitle = document.title;

        if (filename) {
          document.title = filename;
        }

        window.print();

        if (filename) {
          window.setTimeout(() => {
            document.title = previousTitle;
          }, 250);
        }
      }}
    >
      {label}
    </button>
  );
}
