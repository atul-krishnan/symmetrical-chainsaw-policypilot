import type { Metadata } from "next";

import { AuthPanel } from "@/components/product/auth-panel";

export const metadata: Metadata = {
  title: "Authentication",
  description: "Sign into your enterprise learning workspace.",
};

export default function AuthPage() {
  return (
    <section className="py-10">
      <AuthPanel />
    </section>
  );
}
