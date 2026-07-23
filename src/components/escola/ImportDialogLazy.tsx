import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import type { ZodTypeAny } from "zod";

// Lazy-load ImportDialog so PapaParse/ExcelJS (browser-only parsers)
// never enter the SSR bundle for Cloudflare Workers.
const ImportDialogInner = lazy(() =>
  import("./ImportDialog").then((m) => ({ default: m.ImportDialog })),
);

type Props<S extends ZodTypeAny> = ComponentProps<typeof import("./ImportDialog").ImportDialog<S>>;

export function ImportDialog<S extends ZodTypeAny>(props: Props<S>) {
  return (
    <ClientOnly fallback={null}>
      <Suspense fallback={null}>
        {/* @ts-expect-error generic forwarding through lazy boundary */}
        <ImportDialogInner {...props} />
      </Suspense>
    </ClientOnly>
  );
}