import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { ComponentType } from "react";
import type { ZodTypeAny } from "zod";
import type { ImportDialog as ImportDialogType } from "./ImportDialog";

// Lazy-load ImportDialog so PapaParse/ExcelJS (browser-only parsers)
// never enter the SSR bundle for Cloudflare Workers.
const ImportDialogInner = lazy(() =>
  import("./ImportDialog").then((m) => ({ default: m.ImportDialog as ComponentType<unknown> })),
);

type Props<S extends ZodTypeAny> = Parameters<typeof ImportDialogType<S>>[0];

export function ImportDialog<S extends ZodTypeAny>(props: Props<S>) {
  const Inner = ImportDialogInner as unknown as ComponentType<Props<S>>;
  return (
    <ClientOnly fallback={null}>
      <Suspense fallback={null}>
        <Inner {...props} />
      </Suspense>
    </ClientOnly>
  );
}