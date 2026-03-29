// ============================================================
// CHIEF OF STAFF — Setup Script
// Run this ONCE to create your Context Store spreadsheet.
// ============================================================
// HOW TO USE:
//   1. Go to https://script.google.com → New project
//   2. Paste this entire file
//   3. Select "setup" from the dropdown → hit ▶ Run
//   4. Authorize when prompted
//   5. Check the Logs (View → Logs) for your new Spreadsheet ID
//   6. Add your GitHub + Anthropic values in Project Settings -> Script properties
// ============================================================

function setup() {
  Logger.log('Creating Chief of Staff spreadsheet...');

  const ss = SpreadsheetApp.create('Chief of Staff - Context Engine');
  const id = ss.getId();
  const url = ss.getUrl();

  buildCompanyProfileTab_(ss);  // first — north star everything else depends on
  buildContextStoreTab_(ss);
  buildProposedTasksTab_(ss);
  buildTaskTimelineTab_(ss);
  buildRejectedSignalsTab_(ss);
  buildPeopleTab_(ss);
  buildBriefingsTab_(ss);
  buildIntakeLogTab_(ss);
  buildSetupDashboardTab_(ss);
  buildKnowledgeWatchTab_(ss);
  buildContextReviewTab_(ss);
  buildSelfDriftTab_(ss);
  buildGuideTab_(ss);

  // Remove the default blank Sheet1 if it still exists
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet) ss.deleteSheet(defaultSheet);

  // Persist the spreadsheet ID for the agent script in the same Apps Script project.
  saveFrameworkConfig_({
    SPREADSHEET_ID: id,
  });

  try {
    if (typeof refreshSetupDashboard === 'function') {
      refreshSetupDashboard();
    }
  } catch (e) {
    Logger.log('Setup Dashboard refresh skipped: ' + e.message);
  }

  try {
    if (typeof installDefaultOfficeHoursTriggers === 'function') {
      installDefaultOfficeHoursTriggers();
      Logger.log('Default office hours were installed: Intake hourly, Planning daily at 8 AM, Delivery daily at 9 AM, Briefings Friday at 4 PM.');
      Logger.log('You can change or remove these later in Apps Script -> Triggers.');
    }
  } catch (e) {
    Logger.log('Default office hours install skipped: ' + e.message);
  }

  Logger.log('Done. Your Chief of Staff spreadsheet is ready.');
  Logger.log('📋 Spreadsheet ID: ' + id);
  Logger.log('🔗 URL: ' + url);
  Logger.log('');
  Logger.log('════════════════════════════════════════════');
  Logger.log('SETUP CHECKLIST — complete these in order');
  Logger.log('════════════════════════════════════════════');
  Logger.log('');
  Logger.log('STEP 1 (do this now, before anything else):');
  Logger.log('  Open your new spreadsheet: ' + url);
  Logger.log('  Go to the 🎯 Company Profile tab.');
  Logger.log('  Replace ALL placeholder rows with your real company context:');
  Logger.log('    • Mission     — Why you exist and who you serve');
  Logger.log('    • Vision      — Where you are in 3 years (concrete and directional)');
  Logger.log('    • Annual Goal — Use OKR format: Objective + measurable Key Result (add one row per goal)');
  Logger.log('    • Anti-Goal   — Something you are explicitly NOT pursuing this year');
  Logger.log('  Until this is done, Planning Lead cannot filter distractions or flag drift.');
  Logger.log('');
  Logger.log('STEP 2:');
  Logger.log('  Run setFrameworkConfig() — writes template values to Script properties.');
  Logger.log('');
  Logger.log('STEP 3:');
  Logger.log('  Open Project Settings -> Script properties.');
  Logger.log('  Replace placeholder values with your real API keys and settings.');
  Logger.log('');
  Logger.log('STEP 4:');
  Logger.log('  Run showSetupChecklist() — confirms everything is configured, including North Star.');
  Logger.log('  Open the ✅ Setup Dashboard tab any time to see what is required now vs optional later.');
  Logger.log('  Default office hours are also created for you automatically.');
  Logger.log('  You can change them later in Apps Script -> Triggers.');
  Logger.log('');
  Logger.log('STEP 5:');
  Logger.log('  Add at least 2–3 Intent rows in the 📥 Context Store tab.');
  Logger.log('  Use Commander\'s Intent format in the Details column:');
  Logger.log('  "Purpose: X | End State: Y | Fallback: Z"');
  Logger.log('');
  Logger.log('STEP 6:');
  Logger.log('  Run runAll() to start the agents.');
}

// ============================================================
// TAB 1 — Context Store
// ============================================================

function buildContextStoreTab_(ss) {
  const sheet = ss.insertSheet('📥 Context Store');

  // Headers
  const headers = [
    'ID', 'Type', 'Source', 'Summary',
    'Confidence', 'Linked Intent', 'Visibility',
    'Action Ready', 'Task Status', 'Created At', 'Details', 'Stakeholder IDs'
  ];
  sheet.appendRow(headers);

  // Header styling
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#1a1a2e');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);

  // Column widths
  sheet.setColumnWidth(1, 120);   // ID
  sheet.setColumnWidth(2, 110);   // Type
  sheet.setColumnWidth(3, 110);   // Source
  sheet.setColumnWidth(4, 280);   // Summary
  sheet.setColumnWidth(5, 110);   // Confidence
  sheet.setColumnWidth(6, 150);   // Linked Intent
  sheet.setColumnWidth(7, 100);   // Visibility
  sheet.setColumnWidth(8, 110);   // Action Ready
  sheet.setColumnWidth(9, 120);   // Task Status
  sheet.setColumnWidth(10, 170);  // Created At
  sheet.setColumnWidth(11, 300);  // Details
  sheet.setColumnWidth(12, 140);  // Stakeholder IDs

  // Freeze header row
  sheet.setFrozenRows(1);

  // Dropdowns (applied to data rows 2–200)
  addDropdown_(sheet, 2, 2, 199, 1, ['Intent', 'Decision', 'Signal', 'Constraint', 'Learning']);
  addDropdown_(sheet, 2, 5, 199, 1, ['High', 'Medium', 'Low']);
  addDropdown_(sheet, 2, 7, 199, 1, ['Team', 'Stakeholder', 'Private']);
  addDropdown_(sheet, 2, 8, 199, 1, ['Yes', 'No']);
  addDropdown_(sheet, 2, 9, 199, 1, ['—', 'Proposed', 'In Progress', 'Done', 'Rejected']);

  // Sample rows
  const now = new Date().toISOString();
  const samples = [
    ['INT-001', 'Intent',      'Manual',  'Ship auth v2 before Q2',                           'High',   '',       'Team',        'No',  '—',          now, 'Purpose: Unblock enterprise deal requiring SSO | End State: Auth v2 in production, enterprise customer onboarded | Fallback: Ship magic links only if full v2 slips past March', ''],
    ['INT-002', 'Intent',      'Manual',  'Reduce delivery error rate below 2%',              'High',   '',       'Team',        'No',  '—',          now, 'Purpose: Error rate at 5.5% is causing customer churn | End State: Error rate <2% sustained for 2 weeks | Fallback: Isolate top 3 error sources and patch those if full fix takes >3 weeks', ''],
    ['DEC-001', 'Decision',    'Manual',  'Use magic links instead of password auth',         'High',   'INT-001','Team',        'No',  '—',          now, 'Decided in design review 2026-03-20', ''],
    ['SIG-001', 'Signal',      'GitHub',  'PR #42: Add magic link token generation',          'High',   'INT-001','Team',        'Yes', 'Proposed',   now, 'Merged. Ready for review stage.', ''],
    ['CON-001', 'Constraint',  'Manual',  'No external API calls from auth flow',             'High',   'INT-001','Team',        'No',  '—',          now, 'Security requirement from CISO', ''],
    ['LEA-001', 'Learning',    'Manual',  'Token expiry of 15min causes drop-off in testing', 'Medium', 'INT-001','Team',        'No',  '—',          now, 'Observed in QA session 2026-03-22', ''],
  ];

  for (const row of samples) {
    sheet.appendRow(row);
  }

  // Alternating row colours for data rows
  for (let r = 2; r <= samples.length + 1; r++) {
    const bg = r % 2 === 0 ? '#f8f9ff' : '#ffffff';
    sheet.getRange(r, 1, 1, headers.length).setBackground(bg);
  }

  sheet.getRange(2, 1, samples.length, headers.length).setFontSize(10);
  sheet.getRange(2, 1, samples.length, headers.length).setVerticalAlignment('top');
}

// ============================================================
// TAB 2 — Proposed Tasks
// ============================================================

function buildProposedTasksTab_(ss) {
  const sheet = ss.insertSheet('⚡ Proposed Tasks');

  const headers = [
    'ID', 'Task', 'Supporting Context IDs',
    'Priority', 'Effort', 'Status',
    'Created At', 'Reviewed At', 'Notes',
    'Owner', 'Owner Channel', 'Due Date', 'Updated At', 'Stakeholder IDs'
  ];
  sheet.appendRow(headers);

  // Header styling
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#0d1b2a');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);

  // Column widths
  sheet.setColumnWidth(1, 80);    // ID
  sheet.setColumnWidth(2, 320);   // Task
  sheet.setColumnWidth(3, 200);   // Supporting Context IDs
  sheet.setColumnWidth(4, 90);    // Priority
  sheet.setColumnWidth(5, 90);    // Effort
  sheet.setColumnWidth(6, 130);   // Status
  sheet.setColumnWidth(7, 170);   // Created At
  sheet.setColumnWidth(8, 170);   // Reviewed At
  sheet.setColumnWidth(9, 220);   // Notes
  sheet.setColumnWidth(10, 140);  // Owner
  sheet.setColumnWidth(11, 180);  // Owner Channel
  sheet.setColumnWidth(12, 120);  // Due Date
  sheet.setColumnWidth(13, 170);  // Updated At
  sheet.setColumnWidth(14, 140);  // Stakeholder IDs

  sheet.setFrozenRows(1);

  // Dropdowns
  addDropdown_(sheet, 2, 4, 199, 1, ['High', 'Medium', 'Low']);
  addDropdown_(sheet, 2, 5, 199, 1, ['Small', 'Medium', 'Large']);
  addDropdown_(sheet, 2, 6, 199, 1, ['Pending Review', 'Approved', 'In Progress', 'Done', 'Rejected']);

  // Sample tasks
  const now = new Date().toISOString();
  const samples = [
    ['T001', 'Review magic link token generation PR #42 and approve for staging', 'SIG-001, DEC-001', 'High',   'Small',  'Pending Review', now, '', 'Linked to INT-001', 'Chief of Staff', '', '', now, ''],
    ['T002', 'Update token expiry from 15min to 30min based on QA findings',      'LEA-001, CON-001', 'Medium', 'Small',  'Pending Review', now, '', 'Check with CISO first', '', '', '', now, ''],
    ['T003', 'Write integration test suite for magic link flow end-to-end',        'SIG-001, INT-001', 'High',   'Medium', 'Pending Review', now, '', '', '', '', '', now, ''],
  ];

  for (const row of samples) {
    sheet.appendRow(row);
  }

  for (let r = 2; r <= samples.length + 1; r++) {
    const bg = r % 2 === 0 ? '#f0f8ff' : '#ffffff';
    sheet.getRange(r, 1, 1, headers.length).setBackground(bg);
  }

  sheet.getRange(2, 1, samples.length, headers.length).setFontSize(10);
  sheet.getRange(2, 1, samples.length, headers.length).setVerticalAlignment('top');
}

// ============================================================
// TAB 3 — Task Timeline
// ============================================================

function buildTaskTimelineTab_(ss) {
  const sheet = ss.insertSheet('📅 Task Timeline');
  const headers = ['ID', 'Task', 'Owner', 'Status', 'Priority', 'Start', 'Due', 'Duration'];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#12324a')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sheet.setColumnWidth(1, 80);
  sheet.setColumnWidth(2, 320);
  sheet.setColumnWidth(3, 140);
  sheet.setColumnWidth(4, 110);
  sheet.setColumnWidth(5, 90);
  sheet.setColumnWidth(6, 90);
  sheet.setColumnWidth(7, 90);
  sheet.setColumnWidth(8, 70);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(8);
  sheet.getRange(2, 1).setValue('Run runAll() or refreshTaskTimeline_() after tasks exist.');
}

// ============================================================
// TAB 4 — Rejected Signals
// ============================================================

function buildRejectedSignalsTab_(ss) {
  const sheet = ss.insertSheet('🪵 Rejected Signals');
  const headers = ['Logged At', 'Signal ID', 'Summary', 'Confidence', 'Reason', 'Next Review', 'Notes'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4a2b1f')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 110);
  sheet.setColumnWidth(3, 340);
  sheet.setColumnWidth(4, 100);
  sheet.setColumnWidth(5, 280);
  sheet.setColumnWidth(6, 110);
  sheet.setColumnWidth(7, 220);
  sheet.setFrozenRows(1);
  sheet.getRange(2, 1).setValue('Planning Lead records signals considered but not turned into tasks here, with a specific "not now" reason.');
}

// ============================================================
// TAB 5 — Stakeholders
// ============================================================

function buildPeopleTab_(ss) {
  const sheet = ss.insertSheet('👥 Stakeholders');
  const headers = ['Stakeholder ID', 'Name', 'Role', 'Org', 'Relationship', 'Communication Preference', 'Channel', 'Last Interaction', 'Notes'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#264653')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(3, 180);
  sheet.setColumnWidth(4, 160);
  sheet.setColumnWidth(5, 180);
  sheet.setColumnWidth(6, 200);
  sheet.setColumnWidth(7, 160);
  sheet.setColumnWidth(8, 170);
  sheet.setColumnWidth(9, 320);
  sheet.setFrozenRows(1);
  sheet.getRange(2, 1, 2, headers.length).setValues([
    ['STK-001', 'Jane Example', 'Head of Product', 'Acme', 'Key partner', 'Brief async updates first', 'slack:C012345', '', 'Replace with real stakeholder context'],
    ['STK-002', 'Alex Example', 'Customer champion', 'Design Partner', 'External stakeholder', 'Email summary after milestones', 'email:alex@example.com', '', ''],
  ]);
}

// ============================================================
// TAB 6 — Briefings
// ============================================================

function buildBriefingsTab_(ss) {
  const sheet = ss.insertSheet('📝 Briefings');

  const headers = [
    'Generated At', 'Period', 'Context Summary', 'Task Summary', 'Highlights', 'Notes'
  ];
  sheet.appendRow(headers);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#1f2937');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);

  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 280);
  sheet.setColumnWidth(4, 280);
  sheet.setColumnWidth(5, 380);
  sheet.setColumnWidth(6, 220);
  sheet.setFrozenRows(1);
}

// ============================================================
// TAB 4 — Intake Log
// ============================================================

function buildIntakeLogTab_(ss) {
  const sheet = ss.insertSheet('📨 Intake Log');

  const headers = [
    'Logged At', 'Source', 'Channel', 'User', 'Important Context', 'Status', 'Notes', 'Processed At'
  ];
  sheet.appendRow(headers);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4a154b');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);

  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 140);
  sheet.setColumnWidth(4, 140);
  sheet.setColumnWidth(5, 360);
  sheet.setColumnWidth(6, 120);
  sheet.setColumnWidth(7, 420);
  sheet.setColumnWidth(8, 170);
  sheet.setFrozenRows(1);
}

// Backward-compatible alias for older references.
function buildSlackInboxTab_(ss) {
  buildIntakeLogTab_(ss);
}

// ============================================================
// TAB 5 — Setup Dashboard
// ============================================================

function buildSetupDashboardTab_(ss) {
  const sheet = ss.insertSheet('✅ Setup Dashboard');

  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 140);
  sheet.setColumnWidth(3, 420);
  sheet.setColumnWidth(4, 320);
  sheet.setFrozenRows(1);

  const headers = ['Item', 'Status', 'When To Set Up', 'Where To Set It Up'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#17324d')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(10);

  const rows = [
    ['SETUP DASHBOARD', '', '', ''],
    ['Run refreshSetupDashboard()', 'After you add or change settings', 'Any time', 'Apps Script editor'],
    ['', '', '', ''],
    ['REQUIRED NOW', '', '', ''],
    ['Create the sheet via setup()', 'Pending', 'Now', 'Apps Script editor'],
    ['Fill in 🎯 Company Profile', 'Pending', 'Now', 'Spreadsheet -> 🎯 Company Profile'],
    ['Add ANTHROPIC_KEY', 'Pending', 'Now', 'Apps Script -> Project Settings -> Script properties'],
    ['Choose at least one source', 'Pending', 'Now', 'ENABLED_SOURCES in Script properties'],
    ['', '', '', ''],
    ['OPTIONAL LATER', '', '', ''],
    ['GitHub intake', 'Optional', 'Now or later', 'ENABLED_SOURCES + GitHub script properties'],
    ['Gmail intake', 'Optional', 'Now or later', 'ENABLED_SOURCES + optional Gmail label/query'],
    ['Google Drive intake', 'Optional', 'Later', 'ENABLED_SOURCES + optional Drive IDs'],
    ['Notion intake', 'Optional', 'Later', 'ENABLED_SOURCES + NOTION_TOKEN'],
    ['Smartsheet intake', 'Optional', 'Later', 'ENABLED_SOURCES + SMARTSHEET_TOKEN'],
    ['OneDrive / O365 intake', 'Optional', 'Later', 'ENABLED_SOURCES + ONEDRIVE_TOKEN'],
    ['Slack channel', 'Optional', 'Recommended first channel when ready', 'Slack relay + Slack script properties'],
    ['Telegram channel', 'Optional', 'Later', 'Relay deployment + Telegram script properties'],
    ['WhatsApp channel', 'Optional', 'Later', 'Relay deployment + WhatsApp script properties'],
    ['Office hours triggers', 'Created by default', 'Now', 'Apps Script -> Triggers'],
    ['Knowledge Watch', 'Optional', 'After core setup works', 'Spreadsheet -> 🔍 Knowledge Watch'],
  ];

  sheet.getRange(2, 1, rows.length, 4).setValues(rows);
  sheet.getRange(2, 1, rows.length, 4).setFontSize(10).setVerticalAlignment('top').setWrap(true);

  for (let r = 2; r <= rows.length + 1; r++) {
    const label = sheet.getRange(r, 1).getValue();
    const range = sheet.getRange(r, 1, 1, 4);

    if (label === 'SETUP DASHBOARD' || label === 'REQUIRED NOW' || label === 'OPTIONAL LATER') {
      range.setBackground('#eef4fb');
      sheet.getRange(r, 1).setFontWeight('bold').setFontColor('#17324d');
    } else if (label === '') {
      range.setBackground('#ffffff');
    } else {
      range.setBackground(r % 2 === 0 ? '#f9fbfd' : '#ffffff');
    }
  }
}

// ============================================================
// TAB 6 — Guide
// ============================================================

function buildGuideTab_(ss) {
  const sheet = ss.insertSheet('📖 Guide');

  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 500);

  const sections = [
    ['CHIEF OF STAFF — GUIDE', ''],
    ['', ''],
    ['WHAT IS THIS?', 'A Chief of Staff system that maintains shared context and generates executable work. Instead of tracking issues, you maintain a living document of what is known, decided, observed, and learned.'],
    ['', ''],
    ['YOUR ROLE', 'Context Governor. Set intent, approve proposed tasks (~5 min/day), flag key decisions. Agents handle everything else.'],
    ['', ''],
    ['── CONTEXT TYPES ──', ''],
    ['Intent',      'A strategic goal using Commander\'s Intent structure. The Details field should contain: "Purpose: [why this matters] | End State: [what success looks like] | Fallback: [what to do if the primary plan fails]". Agents use Purpose and End State to simulate whether a proposed task is actually worth doing.'],
    ['Decision',    'A choice made, with rationale. Example: "Use magic links — decided 2026-03-20". Permanent record.'],
    ['Signal',      'An observation from GitHub, Google Drive, Notion, Smartsheet, OneDrive, email, meetings, Slack, Telegram, WhatsApp, screenshots, or shared files. Example: "PR #42 merged". The raw material agents reason over.'],
    ['Constraint',  'A hard limit. Example: "No external API calls from auth flow". Agents respect these when proposing tasks.'],
    ['Learning',    'A post-hoc insight. Example: "15min token expiry causes drop-off". Fed back to improve future work.'],
    ['', ''],
    ['── CONFIDENCE LEVELS ──', ''],
    ['High',   'Verified, directly observed. From merged PRs, explicit decisions, named constraints.'],
    ['Medium', 'Inferred or partially observed. Agents need 2 Medium signals to reach the actionability threshold.'],
    ['Low',    'Speculative. Not used by Planning Lead unless manually flagged as action-ready.'],
    ['', ''],
    ['── ACTIONABILITY THRESHOLD ──', 'A task is only proposed if ALL THREE are true:'],
    ['1.', 'A clear supporting Intent exists in the Context Store.'],
    ['2.', 'The signal is High confidence — OR — there are 2+ Medium confidence signals pointing to the same need.'],
    ['3.', 'No duplicate task already exists in Proposed Tasks.'],
    ['', ''],
    ['── THE SUBAGENTS ──', ''],
    ['Intake Lead',          'Runs hourly. Pulls updates from enabled connectors like GitHub, Google Drive, Notion, Smartsheet, OneDrive, and Gmail. Writes Signal rows and deduplicates automatically.'],
    ['Planning Lead',        'Runs daily at 8am. Reads Context Store, applies the actionability threshold, and writes up to 5 proposed tasks for your review.'],
    ['Delivery Lead',        'Runs on demand or schedule. Flags stale tasks that need attention and marks review drift.'],
    ['Briefing Lead',        'Runs weekly or on demand. Produces concise context and delivery summaries in the Briefings tab.'],
    ['', ''],
    ['── REVIEWER & LEARNING AGENTS ──', ''],
    ['Research Analyst',     'Runs daily or weekly. Fetches content from your Knowledge Watch tab (URLs + RSS feeds) and extracts PM / CoS / ops learnings into the Context Store. Keeps the system continuously learning.'],
    ['Editorial Director',   'Runs after Briefing Lead. Reviews each briefing for coverage gaps, missing decisions, and execution risks before it reaches stakeholders. Annotates the briefing Notes column.'],
    ['Knowledge Manager',    'Runs weekly. Audits the Context Store for stale rows, orphaned decisions/constraints, near-duplicates, and low-confidence noise. Writes a recommendations report to the Context Review tab.'],
    ['Program Manager',      'Runs daily. Reviews the task queue: surfaces quick wins (Small effort, High priority), escalates pending tasks stale beyond 3 days, and flags in-progress tasks drifting beyond 10 days.'],
    ['', ''],
    ['── KNOWLEDGE WATCH ──', ''],
    ['What it is',           'A list of URLs and RSS feeds the Research Analyst monitors on a schedule. Add any public page or feed you want the system to learn from.'],
    ['Good sources',         'Tool changelogs (Linear, Notion, etc.), leadership essay feeds, reputable discussion boards (Hacker News), ops newsletters, strategy blogs.'],
    ['How to add',           'Add a row in the Knowledge Watch tab: URL, type (RSS or Web), topic tags, frequency. Set status to Active.'],
    ['', ''],
    ['── SLACK INTERFACE ──', ''],
    ['Slack Relay',      'Lets teammates talk to the Chief of Staff agent from Slack. Recommended architecture: Slack -> trusted relay -> Apps Script web app.'],
    ['Intake Log',       'Stores important interactions promoted from Slack, Telegram, WhatsApp, and other messaging intake paths for auditability and follow-up.'],
    ['Slack Files',      'Screenshots and shared files can be written into the Context Store as Signal rows for later planning and briefing.'],
    ['', ''],
    ['── OTHER MESSAGING ──', ''],
    ['Telegram',         'Telegram can talk to the same Chief of Staff runtime through a relay and can contribute messages, photos, documents, and voice notes as context.'],
    ['WhatsApp',         'WhatsApp can talk to the same Chief of Staff runtime through a relay and can contribute messages and media as context, with more business-grade setup overhead.'],
    ['', ''],
    ['── EMAIL INTERFACE ──', ''],
    ['Email Intake',     'The system can read a dedicated Gmail inbox or label and turn recent threads into Signal rows.'],
    ['', ''],
    ['── TASK STATUSES ──', ''],
    ['Pending Review', 'Proposed by Planning Lead. Awaiting your approval.'],
    ['Approved',       'You approved it. Ready to be picked up.'],
    ['In Progress',    'Being worked on.'],
    ['Done',           'Complete.'],
    ['Rejected',       'You chose not to do this. Kept for audit trail.'],
    ['', ''],
    ['── TASK COMMANDS ──', ''],
    ['Create task',    'In Slack / Telegram / WhatsApp, send: "create task Draft Q2 board update". It creates an approved task assigned to Chief of Staff by default.'],
    ['Create doc',     'Send: "create doc for T004". Chief of Staff creates a Google Doc scaffold for that task and stores the doc link in the task notes.'],
    ['Update doc',     'Send: "update doc T004 with Add customer rollout checklist and owners." Chief of Staff appends that update to the linked Google Doc.'],
    ['Assign owner',   'Send: "assign T004 to me" or "assign T004 to Chief of Staff" or "assign T004 to Sarah via slack:C012345".'],
    ['Set due date',   'Send: "set T004 due 2026-04-02". Use YYYY-MM-DD to avoid ambiguity.'],
    ['Update status',  'Send: "status T004 In Progress" or "mark T004 done".'],
    ['Add note',       'Send: "note T004 Waiting on legal review".'],
    ['Task reminders', 'Tasks with an Owner Channel and Due Date can send reminders on the daily reminder schedule. Owner Channel format: slack:CHANNEL_ID, telegram:CHAT_ID, whatsapp:PHONE_OR_CHAT_ID.'],
    ['Task timeline',  'The 📅 Task Timeline tab renders a lightweight Gantt-style schedule from task status, created date, effort, and due date. Send "refresh timeline" or run refreshTaskTimeline_() after major task edits.'],
    ['Workspace sync', 'Optional write-back: set GOOGLE_WRITEBACK_SPREADSHEET_ID to mirror tasks into a Google Sheet, and/or SMARTSHEET_TASK_SHEET_ID to upsert tasks into Smartsheet. Send "sync T004" to force a sync for one task.'],
    ['Confirm action', 'High-priority Chief of Staff tasks require explicit confirmation before doc creation, sync, or execution. Send: "confirm T004".'],
    ['Remember person', 'Send: "remember person Jane Doe | Head of Product | Acme | prefers concise async updates | slack:C012345".'],
    ['Link stakeholder', 'Send: "link T004 to Jane Doe" or "link T004 to STK-001" to create an explicit relationship between a task and a stakeholder.'],
    ['Link context', 'Send: "link context SIG-001 to Jane Doe" or "link context DEC-001 to STK-001" to connect stakeholder memory directly to context rows.'],
    ['', ''],
    ['── MEMORY & DRIFT ──', ''],
    ['Rejected Signals', 'The 🪵 Rejected Signals tab stores signals Planning Lead considered but did not turn into tasks, so "not now" context is not lost.'],
    ['Stakeholders',    'The 👥 Stakeholders tab stores relationship context, communication preferences, and last-touch notes for important people.'],
    ['Self Drift',      'The 🪞 Self Drift tab checks whether recent activity appears aligned to your stated north star and surfaces correction advice.'],
    ['', ''],
    ['── COMPANY PROFILE (NORTH STAR) ──', ''],
    ['What it is',           'The single source of truth for why you exist, what you\'re building, and what you\'ve decided not to do. Every agent uses it to filter distractions and flag drift.'],
    ['Mission',              'Why you exist and who you serve. Should not change often. Example: "We help independent operators run their business without hiring a finance team."'],
    ['Vision',               'What you are building toward in 3 years. Concrete and directional. Example: "The default back-office for 100,000 small operators across Southeast Asia."'],
    ['Annual Goal',          'Use OKR format: Objective + measurable Key Result + target metric. Example: "Reach $500k ARR by December 2026 [Target: $500k ARR]". Add one row per goal.'],
    ['Quarterly Goal',       'Same format as Annual Goal but scoped to this quarter. Should ladder up to an Annual Goal.'],
    ['Anti-Goal',            'Something you are explicitly NOT doing this year. A strategic no. Research shows that explicit anti-goals prevent scope creep better than vague "stay focused" reminders. Example: "No enterprise deals over $50k ACV until we hit product-market fit."'],
    ['Strategic Principle',  'A decision-making rule that governs how you operate under uncertainty. Example: "Decide with 70% information rather than waiting for certainty." Agents use these to resolve ambiguous situations.'],
    ['How agents use it',    'Planning Lead will not propose a task that cannot be traced to a Goal. It will flag Anti-Goal conflicts. Briefing Lead includes a NORTH STAR ALIGNMENT section. Knowledge Manager flags Intents that drift from company goals.'],
    ['', ''],
    ['── COMMANDER\'S INTENT ──', ''],
    ['What it is',           'Military doctrine adapted for operators. Every Intent row should answer three questions in its Details field:'],
    ['Purpose',              'WHY does this matter? What business or strategic outcome depends on this? Example: "Purpose: Unblock enterprise deal requiring SSO"'],
    ['End State',            'What does success look like when we\'re done? Concrete and measurable. Example: "End State: Auth v2 in production, enterprise customer onboarded"'],
    ['Fallback',             'What do we do if the primary plan fails or slips? Forces you to think ahead. Example: "Fallback: Ship magic links only if full v2 slips past March"'],
    ['Format',               'In the Details column: "Purpose: X | End State: Y | Fallback: Z" — the Planning Lead reads and uses all three fields.'],
    ['', ''],
    ['── BLUF BRIEFING FORMAT ──', ''],
    ['What it is',           'Bottom Line Up Front — the briefing format used in military intelligence, McKinsey, and high-stakes ops. The most important thing goes first, not last.'],
    ['Bottom Line',          'One sentence. The single most important thing to know or act on right now.'],
    ['What Changed',         '2–4 bullets. New signals, decisions made, tasks completed since last briefing.'],
    ['Decisions Required',   'Choices the owner must make, named explicitly. Not topics — actual decisions.'],
    ['Execution Risk',       'Specific tasks or intents at risk of slipping. Not categories. Names and ages.'],
    ['Owner Actions',        'Max 3 actions only the owner can take. Numbered. Not delegatable.'],
    ['', ''],
    ['── PLANNING LEAD REASONING ──', ''],
    ['RPD model',            'Planning Lead uses Recognition-Primed Decision making. It first classifies situations into archetypes (Velocity Blockage, Decision Pending, Drift, Opportunity Window, Constraint Pressure, Signal Cluster), then simulates each proposed task forward before proposing it.'],
    ['Situation types',      'VELOCITY BLOCKAGE: work stalled. DECISION PENDING: choice blocking downstream work. DRIFT: no progress on active item. OPPORTUNITY WINDOW: time-sensitive action. CONSTRAINT PRESSURE: trajectory risks a hard limit. SIGNAL CLUSTER: 2+ signals pointing at same need.'],
    ['Simulation test',      'Before each proposal: Does this advance the intent\'s End State? Does it violate a constraint? What is the cost of not doing it? Does it unblock other work?'],
    ['', ''],
    ['── URGENCY vs IMPORTANCE (EISENHOWER) ──', ''],
    ['What it is',           'Two different dimensions. Urgency is time pressure — this must be done now or an opportunity/deadline is missed. Importance is strategic weight — this advances a core goal. "High priority" conflates both and is almost always wrong.'],
    ['Q1: Urgent + Important',       'Do immediately. Examples: production outage, customer escalation, board deadline. Limited in a healthy system.'],
    ['Q2: Not Urgent + Important',   'Schedule deliberately. Examples: product strategy, recruiting pipeline, key architecture decisions. This is where leverage lives. Most operators underinvest here.'],
    ['Q3: Urgent + Not Important',   'Delegate or batch. Examples: most Slack pings, routine approvals, status updates. Creates an illusion of productivity.'],
    ['Q4: Not Urgent + Not Important','Eliminate. The Planning Lead will not propose Q4 tasks if intents and goals are well-defined.'],
    ['How to use it',        'When reviewing Proposed Tasks, ask: is this Q1 (act now) or Q2 (schedule it)? If it feels urgent but you cannot trace it to a Goal, it is likely Q3. Reject it or delegate.'],
    ['', ''],
    ['── COGNITIVE BIASES TO WATCH ──', ''],
    ['What it is',           'The Planning Lead is designed to reduce these, but you will still bring them when reviewing tasks. Knowing them helps you catch yourself.'],
    ['Availability bias',    'Recent events feel more important than older ones. A bug filed yesterday feels more urgent than a 6-month strategic risk. Check the age of signals before assuming recency = importance.'],
    ['Action bias',          'Doing something feels better than waiting. Under uncertainty, acting quickly is often wrong. The Simulate Forward step in Planning Lead exists specifically to counter this.'],
    ['Confirmation bias',    'Signals that confirm your current direction get logged. Contradicting signals get ignored. Actively log constraints and learnings that challenge your intents, not just ones that support them.'],
    ['Sunk cost',            'Tasks already in progress feel harder to reject. The Delivery Lead will surface drifting in-progress tasks. Let the data, not the effort already spent, determine whether to continue.'],
    ['', ''],
    ['── TIPS ──', ''],
    ['Write good Intents',   'The richer your Commander\'s Intent (Purpose + End State + Fallback), the better Planning Lead\'s reasoning. A bare goal like "Ship auth v2" gives Claude a target. The full structure gives it a mental model.'],
    ['Start with Intents',   'Add at least 2–3 Intent rows before running the Planning Lead. No intents = no tasks proposed.'],
    ['Flag Decisions fast',  'When your team makes a choice, log it as a Decision row immediately. 30 seconds now saves confusion later.'],
    ['Trust the threshold',  "If Planning Lead is not proposing tasks, signals may not meet the bar. Check confidence levels and linked intents."],
  ];

  for (let i = 0; i < sections.length; i++) {
    const row = sheet.getRange(i + 1, 1, 1, 2);
    sheet.getRange(i + 1, 1).setValue(sections[i][0]);
    sheet.getRange(i + 1, 2).setValue(sections[i][1]);

    // Style section headers
    if (sections[i][0].startsWith('──') || sections[i][0] === 'CHIEF OF STAFF — GUIDE' || sections[i][0] === 'WHAT IS THIS?' || sections[i][0] === 'YOUR ROLE' || sections[i][0] === 'ACTIONABILITY THRESHOLD') {
      sheet.getRange(i + 1, 1).setFontWeight('bold').setFontColor('#1a1a2e');
    }
    if (sections[i][0] === 'CHIEF OF STAFF — GUIDE') {
      sheet.getRange(i + 1, 1).setFontSize(13);
    }
  }

  sheet.getRange(1, 1, sections.length, 2).setFontSize(10);
  sheet.getRange(1, 1, sections.length, 2).setWrap(true);
  sheet.getRange(1, 1, sections.length, 2).setVerticalAlignment('top');
}

// ============================================================
// TAB 0 — Company Profile (north star)
// ============================================================

function buildCompanyProfileTab_(ss) {
  const sheet = ss.insertSheet('🎯 Company Profile');

  const headers = ['ID', 'Category', 'Statement', 'Metric / Target', 'Time Horizon', 'Status'];
  sheet.appendRow(headers);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#0f2942');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);

  sheet.setColumnWidth(1, 80);    // ID
  sheet.setColumnWidth(2, 150);   // Category
  sheet.setColumnWidth(3, 420);   // Statement
  sheet.setColumnWidth(4, 180);   // Metric / Target
  sheet.setColumnWidth(5, 120);   // Time Horizon
  sheet.setColumnWidth(6, 90);    // Status
  sheet.setFrozenRows(1);

  addDropdown_(sheet, 2, 2, 99, 1, ['Mission', 'Vision', 'Annual Goal', 'Quarterly Goal', 'Anti-Goal', 'Strategic Principle']);
  addDropdown_(sheet, 2, 6, 99, 1, ['Active', 'Achieved', 'Paused', 'Retired']);

  // Instruction note in header row
  sheet.getRange(1, 3).setValue('← Fill in your real mission, vision, goals, and strategic nos. Agents use this as the north star.');
  sheet.getRange(1, 3).setFontStyle('italic').setFontColor('#aaaaaa').setFontWeight('normal');

  // Sample rows — owner replaces these with their actual company context
  const samples = [
    ['GP-001', 'Mission',             'We help [who] do [what] so they can [outcome] — replace with your actual mission',                                    '',                    'Always',        'Active'],
    ['GP-002', 'Vision',              'By [year] we will [specific measurable outcome] — replace with your 3-year vision',                                   '',                    '3 years',       'Active'],
    ['GP-003', 'Annual Goal',         'Replace with your most important goal for this year — use OKR format: Objective + measurable Key Result',             'Metric / target here', 'This year',    'Active'],
    ['GP-004', 'Annual Goal',         'Replace with your second most important goal for this year',                                                          'Metric / target here', 'This year',    'Active'],
    ['GP-005', 'Quarterly Goal',      'Replace with your most important goal for this quarter',                                                              'Metric / target here', 'This quarter', 'Active'],
    ['GP-006', 'Anti-Goal',           'Replace with something you are explicitly NOT doing this year. A strategic no. Example: no enterprise deals >$50K ACV until product-market fit confirmed', '', 'This year', 'Active'],
    ['GP-007', 'Strategic Principle', 'Replace with a decision-making rule. Example: decide with 70% information rather than waiting for certainty',          '',                    'Always',        'Active'],
  ];

  for (const row of samples) {
    sheet.appendRow(row);
  }

  for (let r = 2; r <= samples.length + 1; r++) {
    const bg = r % 2 === 0 ? '#eef4ff' : '#ffffff';
    sheet.getRange(r, 1, 1, headers.length).setBackground(bg);
  }

  sheet.getRange(2, 1, samples.length, headers.length).setFontSize(10);
  sheet.getRange(2, 1, samples.length, headers.length).setVerticalAlignment('top');
  sheet.getRange(2, 1, samples.length, headers.length).setWrap(true);
}

// ============================================================
// TAB 7 — Knowledge Watch
// ============================================================

function buildKnowledgeWatchTab_(ss) {
  const sheet = ss.insertSheet('🔍 Knowledge Watch');

  const headers = ['URL', 'Type', 'Topic Tags', 'Frequency', 'Last Fetched', 'Status', 'Notes', 'Content Hash'];
  sheet.appendRow(headers);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#1a3a4a');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);

  sheet.setColumnWidth(1, 360);  // URL
  sheet.setColumnWidth(2, 100);  // Type
  sheet.setColumnWidth(3, 180);  // Topic Tags
  sheet.setColumnWidth(4, 90);   // Frequency
  sheet.setColumnWidth(5, 170);  // Last Fetched
  sheet.setColumnWidth(6, 130);  // Status
  sheet.setColumnWidth(7, 280);  // Notes
  sheet.setColumnWidth(8, 100);  // Content Hash (managed automatically)
  sheet.setFrozenRows(1);

  addDropdown_(sheet, 2, 2, 199, 1, ['RSS', 'Web', 'Discussion']);
  addDropdown_(sheet, 2, 4, 199, 1, ['Daily', 'Weekly']);
  addDropdown_(sheet, 2, 6, 199, 1, ['Active', 'Paused', 'Error']);

  // Pre-seeded sources for PM / CoS / operator learning
  const samples = [
    ['https://hnrss.org/best',                   'RSS',  'PM,Strategy,Discussion', 'Daily',  '', 'Active', 'Hacker News Best — high-signal tech and ops discussion'],
    ['https://linear.app/changelog',             'Web',  'PM Tools,Product',       'Weekly', '', 'Active', 'Linear product updates — add more tool changelogs as needed'],
    ['https://review.firstround.com/feed',       'RSS',  'Leadership,CoS,Ops',     'Weekly', '', 'Active', 'First Round Review — operations, hiring, leadership essays'],
  ];

  for (const row of samples) {
    sheet.appendRow(row);
  }

  for (let r = 2; r <= samples.length + 1; r++) {
    const bg = r % 2 === 0 ? '#f0f7ff' : '#ffffff';
    sheet.getRange(r, 1, 1, headers.length).setBackground(bg);
  }

  sheet.getRange(2, 1, samples.length, headers.length).setFontSize(10);
  sheet.getRange(2, 1, samples.length, headers.length).setVerticalAlignment('top');

  // Instruction row at top (offset below headers)
  sheet.getRange(1, 7).setValue('Add any public URL or RSS feed. Research Analyst fetches these on schedule and writes learnings to the Context Store.');
  sheet.getRange(1, 7).setFontStyle('italic').setFontColor('#999999');
}

// ============================================================
// TAB 8 — Context Review
// ============================================================

function buildContextReviewTab_(ss) {
  const sheet = ss.insertSheet('🔎 Context Review');

  const headers = ['Reviewed At', 'Total Rows', 'Stale', 'Duplicates', 'Orphaned', 'Low Conf Old', 'Recommendations', 'Notes'];
  sheet.appendRow(headers);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#2d3748');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);

  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 90);
  sheet.setColumnWidth(3, 70);
  sheet.setColumnWidth(4, 90);
  sheet.setColumnWidth(5, 90);
  sheet.setColumnWidth(6, 110);
  sheet.setColumnWidth(7, 420);
  sheet.setColumnWidth(8, 200);
  sheet.setFrozenRows(1);
}

// ============================================================
// TAB 9 — Self Drift
// ============================================================

function buildSelfDriftTab_(ss) {
  const sheet = ss.insertSheet('🪞 Self Drift');
  const headers = ['Reviewed At', 'Window', 'Alignment Status', 'Drift Signals', 'Correction', 'Notes'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#5a3d5c')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 130);
  sheet.setColumnWidth(4, 360);
  sheet.setColumnWidth(5, 360);
  sheet.setColumnWidth(6, 220);
  sheet.setFrozenRows(1);
  sheet.getRange(2, 1).setValue('Run runSelfDriftCheck() after tasks and north star are set.');
}

// ============================================================
// HELPER — Add dropdown validation
// ============================================================

function addDropdown_(sheet, startRow, startCol, numRows, numCols, values) {
  const range = sheet.getRange(startRow, startCol, numRows, numCols);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}

function saveFrameworkConfig_(values) {
  const props = PropertiesService.getScriptProperties();
  const normalized = {};

  Object.keys(values).forEach(key => {
    if (values[key] !== undefined && values[key] !== null && values[key] !== '') {
      normalized[key] = String(values[key]);
    }
  });

  if (Object.keys(normalized).length > 0) {
    props.setProperties(normalized, false);
  }
}

// ============================================================
// END OF SETUP SCRIPT
// ============================================================
