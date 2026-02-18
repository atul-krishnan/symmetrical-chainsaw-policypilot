"use client";

import { useMemo, useState } from "react";

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function RoiCalculator() {
  const [employees, setEmployees] = useState("400");
  const [hourlyCost, setHourlyCost] = useState("68");
  const [hoursSaved, setHoursSaved] = useState("2.5");
  const [incidentReduction, setIncidentReduction] = useState("3");

  const output = useMemo(() => {
    const people = parseNumber(employees, 400);
    const hourly = parseNumber(hourlyCost, 68);
    const saved = parseNumber(hoursSaved, 2.5);
    const reduction = parseNumber(incidentReduction, 3);

    const trainingEfficiencyGain = people * hourly * saved;
    const riskAvoidance = reduction * 18_000;

    return {
      annualValue: trainingEfficiencyGain + riskAvoidance,
      efficiencyGain: trainingEfficiencyGain,
      riskAvoidance,
    };
  }, [employees, hourlyCost, hoursSaved, incidentReduction]);

  return (
    <section className="rounded-[2rem] surface-card p-7 sm:p-8">
      <h1 className="font-display text-4xl text-[#10244a]">ROI estimator</h1>
      <p className="mt-2 text-sm text-[#4c6488]">
        Estimate annual value from faster campaign execution and reduced compliance incident exposure.
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>Employees in scope</span>
          <input
            className="h-11 w-full rounded-xl border border-[#d3deef] bg-white px-3"
            onChange={(event) => setEmployees(event.target.value)}
            value={employees}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Loaded hourly cost ($)</span>
          <input
            className="h-11 w-full rounded-xl border border-[#d3deef] bg-white px-3"
            onChange={(event) => setHourlyCost(event.target.value)}
            value={hourlyCost}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Hours saved per learner/year</span>
          <input
            className="h-11 w-full rounded-xl border border-[#d3deef] bg-white px-3"
            onChange={(event) => setHoursSaved(event.target.value)}
            value={hoursSaved}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Incidents prevented per year</span>
          <input
            className="h-11 w-full rounded-xl border border-[#d3deef] bg-white px-3"
            onChange={(event) => setIncidentReduction(event.target.value)}
            value={incidentReduction}
          />
        </label>
      </div>

      <div className="mt-7 rounded-2xl border border-[#cad8ee] bg-[linear-gradient(135deg,#eff4ff,#f8fbff)] p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-[#5f79a2]">Estimated annual value</p>
        <p className="mt-2 font-display text-5xl text-[#10244a]">${Math.round(output.annualValue).toLocaleString()}</p>
        <p className="mt-4 text-sm text-[#4e6488]">
          Efficiency gain: ${Math.round(output.efficiencyGain).toLocaleString()} | Risk avoidance: ${Math.round(output.riskAvoidance).toLocaleString()}
        </p>
      </div>
    </section>
  );
}
