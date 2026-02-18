import type { Metadata } from "next";

import { RoiCalculator } from "@/components/marketing/roi-calculator";

export const metadata: Metadata = {
  title: "ROI Calculator",
  description: "Estimate annual enterprise value from AI compliance training operations.",
};

export default function RoiPage() {
  return (
    <section className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <RoiCalculator />
      </div>
    </section>
  );
}
