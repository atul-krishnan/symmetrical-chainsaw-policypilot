import type { PropsWithChildren } from "react";

import { ProductNav } from "@/components/layout/product-nav";

export function ProductShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-[#f3ede2]">
      <ProductNav />
      <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
