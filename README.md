# Chief of Staff

This is a team of agents, led by a Chief of Staff.

- You can communicate with your Chief of Staff via Slack, Telegram, and/or WhatsApp. You can also forward emails to them.
- You can send them your goals, thoughts, meeting notes, and docs. They can also gather context from Google Drive*, Notion*, Smartsheet*, and OneDrive*.
- They collects context from across your work, store it in one place (Google Sheets). That's where they work from.
- With all of these information, the Chief of Staff and their team propose work, flag drift, and generate updates for you — based on your goals and north star.

## Your Chief of Staff’s team

Here is the org chart.

```text
You
|
└─-- Chief of Staff
   |
   |-- Intelligence & Context
   |   |-- Intake Lead
   |   |-- Research Analyst
   |   └-- Knowledge Manager
   |
   |-- Planning & Execution
   |   |-- Planning Lead
   |   |-- Delivery Lead
   |   └-- Program Manager
   |
   └─-- Communications
       |-- Briefing Lead
       └─- Editorial Director
```

## Operating Principles

- Shared memory first: everything important gets written into the Google Sheet context store.
- North Star alignment: the `🎯 Company Profile` gives the team mission, goals, anti-goals, and principles so it can filter distractions.
- Evidence before action: the team should not suggest work just because a signal exists. It looks for enough evidence and a clear link to goals and constraints.
- Auditability: prompts, proposed tasks, briefings, and context changes are meant to stay visible in the Google Sheet.

## Office hours — when does it work?

The CoS team does not continuously watch the Google Sheet in real time. It works:

- on its office-hours schedule, which `setup()` creates for you
  - `scheduledIntakeLead`: every hour
  - `scheduledPlanningLead`: every day at 8:00 AM
  - `scheduledDeliveryMonitor`: every day at 9:00 AM
  - `scheduledBriefingLead`: every Friday at 4:00 PM
  - If your team starts later, change the times. What matters most is choosing a rhythm that matches how your team actually works.
- through instant channel replies once Slack is connected
- when you manually run it from Apps Script
  - open your CoS Apps Script project at [script.google.com](http://script.google.com)
  - choose `officeHoursNow` from the function dropdown at the top \> click `Run`
  - If you want just one part of the team to work: `intakeNow` `planningNow` `deliveryNow` `briefingNow`

## Meet the team

| Role | Responsibility |
|---|---|
| Intake Lead | Gathers new information. |
| Planning Lead | Turns information into suggested next steps. |
| Delivery Lead | Watches for drift or stuck work. |
| Briefing Lead | Turns the state of the business into readable updates. |
| Research Analyst | Brings in outside learnings to improve the team’s work. |
| Editorial Director | Improves the quality of summaries. |
| Knowledge Manager | Keeps the context clean and useful. |
| Program Manager | Watches the task queue and execution flow. |

### What the team produces and uses

> `*` needs extra setup beyond the core install

| Item | What it is | Type |
|---|---|---|
| `Context Store` | The shared notebook. | Shared memory |
| `Proposed Tasks` | The list of suggested next steps. | Output |
| `Briefings` | The updates that come out. | Output |
| `Intake Log` | `*` A cross-channel intake and audit log for important interactions promoted from messaging channels. | Input log |
| `Setup Dashboard` | The setup/status panel. | Control surface |
| `Knowledge Watch` | The list of outside sources to monitor. | Source watchlist |
| `Context Review` | The cleanup and audit view. | Review surface |

## Team workflow:

```text
What goes into the Google Sheet (a.k.a. Context store)
---------------
GitHub activity
Meeting notes
Decisions you make
Goals you set
Messages from Slack / Telegram / WhatsApp
Emails forwarded via Gmail

        |
        v

What the CoS team does
---------------
Intake Lead gathers signals
Planning Lead suggests next steps
Delivery Lead watches for drift
Briefing Lead writes updates
Research Analyst adds outside learnings
Knowledge Manager keeps context clean

        |
        v

Their deliverables
---------------
Proposed tasks
Drift alerts
Updates
What needs attention
```

- [Setup guide](https://www.notion.so/33202f9e5d568163af12f370c152dfff)
- [How Agents Think](https://www.notion.so/33202f9e5d56819ebc37ebe6210452eb)
- [Tokens & Costs](https://www.notion.so/33202f9e5d56810db361c0d123a7fe46)
