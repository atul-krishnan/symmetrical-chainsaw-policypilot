# Demo Script: Adoption Intelligence Showcase

## Objective
Demonstrate end-to-end flow:
1. Policy update introduces adoption drift.
2. Control freshness declines and risk concentrates.
3. Copilot recommends interventions.
4. Admin approves and executes remediation.
5. Freshness and evidence posture recover.

## Demo Steps
1. Open `Adoption Command Center`.
- Highlight `% fresh in-scope controls` and benchmark delta.
- Show stale/critical controls in the table.

2. Open a control drilldown via `Controls & Evidence`.
- Show evidence status mix, lineage links, and generated narrative.

3. Open `Intervention Inbox`.
- Generate recommendations.
- Approve one `manager_escalation` and one `reminder_cadence`.
- Execute approved recommendations.

4. Refresh `Adoption Command Center`.
- Show movement in intervention queue and freshness indicators.
- Explain how actions are audited in request logs.

5. Export evidence artifacts (CSV/PDF).
- Explain lineage from source evidence to export evidence object.

## Talk Track
- "We are not just tracking completion. We track control-level behavior adoption."
- "Every remediation is human-approved and auditable."
- "This is designed to coexist with Vanta/Drata as an evidence producer."
