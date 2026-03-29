# Chief of Staff

This is a team of agents, led by a Chief of Staff.

- You can communicate with your Chief of Staff via Slack, Telegram, and/or WhatsApp. You can also forward emails to them.
- You can send them your goals, thoughts, meeting notes, and docs. They can also gather context from Google Drive, Notion, Smartsheet, and OneDrive.
- They collect context from across your work and store it in one place: Google Sheets (source of truth).
- With that context, the Chief of Staff and their team propose work, flag drift, generate updates, and keep a shared operating memory based on your goals and north star.
- Optionally, they can mirror task updates out to Smartsheet / another Google Sheet.
- You can assign work to Chief of Staff, and it can create or update Google Docs for those tasks.

## Your Chief of Staff's team

Here is the org chart.

```text
You
|
└─── Chief of Staff
   |
   |── Intelligence & Context
   |   |── Intake Lead
   |   |── Research Analyst
   |   └── Knowledge Manager
   |
   |── Planning & Execution
   |   |── Planning Lead
   |   |── Delivery Lead
   |   └── Program Manager
   |
   └── Communications
       |── Briefing Lead
       └── Editorial Director
```

## Operating Principles

- Shared memory first: everything important gets written into the Google Sheet context store.
- Google Sheets is the source of truth: the CoS sheet drives tasks, timeline, memory, and reviews. Smartsheet is an optional synced workspace, not the canonical planner.
- North Star alignment: the `🎯 Company Profile` gives the team mission, goals, anti-goals, and principles so it can filter distractions.
- Evidence before action: the team should not suggest work just because a signal exists. It looks for enough evidence and a clear link to goals and constraints.
- Human confirmation for risky execution: high-priority Chief of Staff tasks require explicit confirmation before outward execution like docs or synced write-back.
- Auditability: prompts, proposed tasks, briefings, context changes, rejected signals, stakeholder links, and self-drift checks are meant to stay visible in the Google Sheet.

## Office Hours

The CoS team does not continuously watch the Google Sheet in real time. It works:

- on its office-hours schedule, which `setup()` creates for you
- `scheduledIntakeLead`: every hour
- `scheduledPlanningLead`: every day at 8:00 AM
- `scheduledDeliveryMonitor`: every day at 9:00 AM
- `scheduledBriefingLead`: every Friday at 4:00 PM
- `scheduledTaskReminders`: every day at 10:00 AM
- `scheduledTaskTimelineRefresh`: every day at 10:00 AM
- `scheduledSelfDriftCheck`: every day at 10:00 AM
- If your team starts later, change the times. What matters most is choosing a rhythm that matches how your team actually works.
- through instant channel replies once Slack, Telegram, or WhatsApp is connected through a trusted relay
- when you manually run it from Apps Script
- open your CoS Apps Script project at [script.google.com](http://script.google.com)
- choose `officeHoursNow` from the function dropdown and click `Run`
- If you want just one part of the team to work: `intakeNow` `planningNow` `deliveryNow` `briefingNow`

## Meet the team

| Role | Responsibility |
|---|---|
| Intake Lead | Gathers new information from enabled channels and connectors. |
| Planning Lead | Turns information into suggested next steps and records "not now" reasoning for dropped signals. |
| Delivery Lead | Watches for drift, stale work, and tasks that need attention. |
| Briefing Lead | Turns the state of the business into readable updates. |
| Research Analyst | Brings in outside learnings to improve the team's work. |
| Editorial Director | Improves the quality of summaries. |
| Knowledge Manager | Keeps the context clean and useful. |
| Program Manager | Watches the task queue, execution flow, and reminder hygiene. |

### What the team produces and uses

> `*` needs extra setup beyond the core install

| Item | What it is | Type |
|---|---|---|
| `🎯 Company Profile` | The north star: mission, goals, anti-goals, and principles. | Control surface |
| `📥 Context Store` | The shared notebook and system memory. | Shared memory |
| `⚡ Proposed Tasks` | The working task list used by the CoS system. | Source-of-truth task store |
| `📅 Task Timeline` | Gantt-style timeline of current work in Google Sheets. | Planning view |
| `📝 Briefings` | The updates the team produces. | Output |
| `🪵 Rejected Signals` | The "not now" pile for signals considered but not selected for action. | Memory / review surface |
| `👥 Stakeholders` | Relationship memory, communication preferences, and stakeholder IDs. | Shared memory |
| `🪞 Self Drift` | A check on whether recent activity matches the stated north star. | Review surface |
| `💬 `Intake Log` | A cross-channel intake and audit log for promoted interactions. | Input log |
| `✅ Setup Dashboard` | The setup and status panel. | Control surface |
| `🔭 Knowledge Watch` | The list of outside sources to monitor. | Source watchlist |
| `🧹 Context Review` | The cleanup and audit view. | Review surface |

## What You Can Do With It

- Capture goals, decisions, constraints, learnings, and signals in one shared Google Sheet.
- Ask the system to propose next-step tasks grounded in your north star.
- Create tasks by chat command and assign them to Chief of Staff or another owner.
- Assign, reassign, change status, set due dates, add notes, and inspect tasks from Slack, Telegram, or WhatsApp.
- Create and update Google Docs for Chief of Staff-owned tasks.
- Link tasks and context rows to stakeholders.
- Record stakeholder memory, including role, org, notes, and preferred channel.
- Review a Gantt-style timeline of current work in Google Sheets.
- Send reminders to task owners through configured messaging channels.
- Mirror tasks into another Google Sheet and optionally into Smartsheet.

## What It Can Do Today

- Ingest context from GitHub, Google Drive, Notion, Smartsheet, OneDrive, Gmail, and messaging channels when configured.
- Deduplicate incoming signals before writing them to the context store.
- Propose tasks with Planning Lead using goals, constraints, and stakeholder context.
- Preserve dropped signals in `🪵 Rejected Signals` with a "why not now" reason.
- Flag stale work and drift through Delivery Lead and Program Manager.
- Generate executive-style briefings.
- Run a self-drift audit against the north star.
- Maintain lightweight relational memory across `stakeholder ↔ task` and `stakeholder ↔ context`.
- Write task updates back to Google Sheets and Smartsheet when configured.

## Team Workflow

```text
What goes into the Google Sheet (source of truth)
---------------
GitHub activity
Meeting notes
Decisions you make
Goals you set
Messages from Slack / Telegram / WhatsApp
Emails forwarded via Gmail
Signals from Google Drive / Notion / Smartsheet / OneDrive

        |
        v

What the CoS team does
---------------
Intake Lead gathers signals
Planning Lead suggests next steps
Planning Lead records "not now" decisions
Delivery Lead watches for drift
Briefing Lead writes updates
Research Analyst adds outside learnings
Knowledge Manager keeps context clean
Program Manager watches execution flow

        |
        v

Their deliverables
---------------
Proposed tasks
Task reminders
Gantt-style timeline in Google Sheets
Drift alerts
Briefings
What needs attention
```

## Task Commands

- `create task Draft Q2 board update`
- `assign T004 to me`
- `assign T004 to Chief of Staff`
- `assign T004 to Sarah via slack:C012345`
- `set T004 due 2026-04-02`
- `status T004 In Progress`
- `mark T004 done`
- `note T004 Waiting on legal review`
- `show T004`
- `create doc for T004`
- `update doc T004 with Add customer rollout checklist and owners.`
- `refresh timeline`
- `sync T004`
- `confirm T004`
- `remember person Jane Doe | Head of Product | Acme | prefers concise async updates | slack:C012345`
- `link T004 to Jane Doe`
- `link context SIG-001 to Jane Doe`

## What Could Go Wrong

| Risk | What could happen | Mitigation |
|---|---|---|
| Identity drift | The same person gets saved as multiple stakeholders under different names. | Use stakeholder IDs as canonical; prefer `link ... to STK-...`; periodically merge duplicates in `👥 Stakeholders`. |
| Wrong links | A task or context row gets linked to the wrong stakeholder. | Keep explicit link commands; review `Stakeholder IDs` during weekly maintenance. |
| Incomplete graph | Some tasks or context rows stay unlinked, so reasoning is patchy. | Build the habit of linking stakeholders when assigning tasks or logging important context. |
| Over-trust in relational reasoning | The system can sound more relational than it really is. | Treat stakeholder-aware reasoning as assistive, not authoritative; keep human judgment in the loop. |
| High-priority execution risk | Chief of Staff could act outward on something important too early. | Keep the explicit confirmation gate for high-priority CoS tasks via `confirm T###`. |
| Workspace sync mismatch | Google or Smartsheet mirrors may not have matching columns or may miss optional fields. | Keep schemas aligned; use dedicated sync sheets if your operational sheets are complex. |
| Privacy leakage | Stakeholder notes may accumulate sensitive details in shared sheets. | Keep notes operational and minimal; avoid storing private or unnecessary personal information. |
| Cache staleness | Cached prompt results may survive slightly longer than ideal. | TTLs are short and input-based; rerun after meaningful changes or reduce TTLs if needed. |
| Rejected-signal misclassification | A "why not now" reason can be plausible but imperfect. | Use the classifier plus heuristics, and review `🪵 Rejected Signals` periodically. |
| Schema migration friction | Older sheets with manual edits can drift from expected columns. | Auto-migration covers the common case, but it is still worth checking tabs after upgrade. |

- [Setup guide](https://www.notion.so/33202f9e5d568163af12f370c152dfff)
- [How Agents Think](https://www.notion.so/33202f9e5d56819ebc37ebe6210452eb)
- [Tokens & Costs](https://www.notion.so/33202f9e5d56810db361c0d123a7fe46)
