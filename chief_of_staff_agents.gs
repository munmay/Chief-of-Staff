// ============================================================
// CHIEF OF STAFF — Context Engine Script
// Intake Lead + Planning Lead + Delivery Lead + Briefing Lead
// March 2026
// ============================================================
// STEP 1: Add your Script properties before running anything.
// ============================================================

const CONFIG_KEYS = {
  ENABLED_SOURCES:       'ENABLED_SOURCES',
  GITHUB_TOKEN:          'GITHUB_TOKEN',
  GITHUB_OWNER:          'GITHUB_OWNER',
  GITHUB_REPO:           'GITHUB_REPO',
  ANTHROPIC_KEY:         'ANTHROPIC_KEY',
  SPREADSHEET_ID:        'SPREADSHEET_ID',
  DRIVE_FOLDER_ID:       'DRIVE_FOLDER_ID',
  DRIVE_SHARED_DRIVE_ID: 'DRIVE_SHARED_DRIVE_ID',
  NOTION_TOKEN:          'NOTION_TOKEN',
  NOTION_DATABASE_ID:    'NOTION_DATABASE_ID',
  SMARTSHEET_TOKEN:      'SMARTSHEET_TOKEN',
  SMARTSHEET_SHEET_ID:   'SMARTSHEET_SHEET_ID',
  ONEDRIVE_TOKEN:        'ONEDRIVE_TOKEN',
  ONEDRIVE_DRIVE_ID:     'ONEDRIVE_DRIVE_ID',
  ONEDRIVE_FOLDER_ID:    'ONEDRIVE_FOLDER_ID',
  GMAIL_QUERY:           'GMAIL_QUERY',
  GMAIL_LABEL:           'GMAIL_LABEL',
  SLACK_BOT_TOKEN:       'SLACK_BOT_TOKEN',
  SLACK_RELAY_SECRET:    'SLACK_RELAY_SECRET',
  SLACK_ALLOWED_CHANNELS:'SLACK_ALLOWED_CHANNELS',
  TELEGRAM_BOT_TOKEN:    'TELEGRAM_BOT_TOKEN',
  TELEGRAM_ALLOWED_CHATS:'TELEGRAM_ALLOWED_CHATS',
  WHATSAPP_TOKEN:        'WHATSAPP_TOKEN',
  WHATSAPP_PHONE_NUMBER_ID:'WHATSAPP_PHONE_NUMBER_ID',
  WHATSAPP_ALLOWED_SENDERS:'WHATSAPP_ALLOWED_SENDERS',
};

// Sheet names — change only if you renamed them
const SHEET = {
  COMPANY_PROFILE:'🎯 Company Profile',
  CONTEXT:        '📥 Context Store',
  TASKS:          '⚡ Proposed Tasks',
  BRIEFINGS:      '📝 Briefings',
  SLACK:          '📨 Intake Log',
  SETUP:          '✅ Setup Dashboard',
  GUIDE:          '📖 Guide',
  KNOWLEDGE_WATCH:'🔍 Knowledge Watch',
  CONTEXT_REVIEW: '🔎 Context Review',
};

const LEGACY_SHEET = {
  SLACK: '💬 Slack Inbox',
};

// Company Profile columns (1-indexed)
const PROFILE_COL = {
  ID:           1,
  CATEGORY:     2,
  STATEMENT:    3,
  METRIC:       4,
  TIME_HORIZON: 5,
  STATUS:       6,
};

// Context Store columns (1-indexed)
const COL = {
  ID:             1,
  TYPE:           2,
  SOURCE:         3,
  SUMMARY:        4,
  CONFIDENCE:     5,
  LINKED_INTENT:  6,
  VISIBILITY:     7,
  ACTION_READY:   8,
  TASK_STATUS:    9,
  CREATED_AT:     10,
  DETAILS:        11,
};

// Knowledge Watch columns (1-indexed)
const WATCH_COL = {
  URL:          1,
  TYPE:         2,
  TOPIC_TAGS:   3,
  FREQUENCY:    4,
  LAST_FETCHED: 5,
  STATUS:       6,
  NOTES:        7,
  CONTENT_HASH: 8,  // stores hash of last-seen content to skip unchanged sources
};

// Proposed Tasks columns (1-indexed)
const TASK_COL = {
  ID:             1,
  TASK:           2,
  CONTEXT_IDS:    3,
  PRIORITY:       4,
  EFFORT:         5,
  STATUS:         6,
  CREATED_AT:     7,
  REVIEWED_AT:    8,
  NOTES:          9,
};

const SLACK_INBOX_HEADERS = [
  'Logged At', 'Source', 'Channel', 'User', 'Important Context', 'Status', 'Notes', 'Processed At'
];

// ============================================================
// ENTRY POINTS — run these manually or via triggers
// (Standalone script: run from the Apps Script editor dropdown)
// ============================================================

function runAll() {
  const config = validateConfig_(['SPREADSHEET_ID', 'ANTHROPIC_KEY']);

  // Warn if Company Profile has not been filled in.
  // Agents will still run — but output quality degrades without a north star.
  try {
    const ss           = SpreadsheetApp.openById(config.SPREADSHEET_ID);
    const profileSheet = ss.getSheetByName(SHEET.COMPANY_PROFILE);
    if (profileSheet) {
      const profile = readCompanyProfile_(profileSheet);
      if (!profileIsConfigured_(profile)) {
        Logger.log('⚠  WARNING: Company Profile (North Star) is not configured.');
        Logger.log('   Open the 🎯 Company Profile tab and replace the placeholder rows before running agents.');
        Logger.log('   Planning Lead will run but cannot filter distractions or flag drift without active Goals.');
        Logger.log('   Run showSetupChecklist() for step-by-step guidance.');
        Logger.log('');
      }
    }
  } catch (e) {
    // Non-fatal — proceed without the check
  }

  runIntakeLead();
  runPlanningLead();
  runDeliveryMonitor();
  runBriefingLead();
  runResearchAnalyst();
  runEditorialDirector();
  runKnowledgeManager();
  runProgramManager();
}

// Human-friendly aliases so non-technical owners do not need to memorize scheduler names.
function officeHoursNow() {
  runAll();
}

function installDefaultOfficeHoursTriggers() {
  const existing = ScriptApp.getProjectTriggers()
    .map(trigger => trigger.getHandlerFunction());

  if (!existing.includes('scheduledIntakeLead')) {
    ScriptApp.newTrigger('scheduledIntakeLead')
      .timeBased()
      .everyHours(1)
      .create();
  }

  if (!existing.includes('scheduledPlanningLead')) {
    ScriptApp.newTrigger('scheduledPlanningLead')
      .timeBased()
      .everyDays(1)
      .atHour(8)
      .create();
  }

  if (!existing.includes('scheduledDeliveryMonitor')) {
    ScriptApp.newTrigger('scheduledDeliveryMonitor')
      .timeBased()
      .everyDays(1)
      .atHour(9)
      .create();
  }

  if (!existing.includes('scheduledBriefingLead')) {
    ScriptApp.newTrigger('scheduledBriefingLead')
      .timeBased()
      .everyWeeks(1)
      .onWeekDay(ScriptApp.WeekDay.FRIDAY)
      .atHour(16)
      .create();
  }
}

function intakeNow() {
  runIntakeLead();
}

function planningNow() {
  runPlanningLead();
}

function deliveryNow() {
  runDeliveryMonitor();
}

function briefingNow() {
  runBriefingLead();
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: 'chief-of-staff-context-engine' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = parseWebRequestBody_(e);
    const payload = typeof body === 'string' ? JSON.parse(body) : body;
    return handleRelayRequest_(payload);
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error.message,
    });
  }
}

function scheduledIntakeLead() {
  runIntakeLead();
}

function scheduledIngestion() {
  runIntakeLead();
}

function scheduledPlanningLead() {
  runPlanningLead();
}

function scheduledWorkGeneration() {
  runPlanningLead();
}

function scheduledDeliveryMonitor() {
  runDeliveryMonitor();
}

function scheduledBriefingLead() {
  runBriefingLead();
}

function scheduledResearchAnalyst() {
  runResearchAnalyst();
}

function scheduledEditorialDirector() {
  runEditorialDirector();
}

function scheduledKnowledgeManager() {
  runKnowledgeManager();
}

function scheduledProgramManager() {
  runProgramManager();
}

function processSlackPrompt(prompt, channel, userName) {
  const config = validateConfig_(['SPREADSHEET_ID', 'ANTHROPIC_KEY']);
  return processChannelPrompt_({
    platform: 'Slack',
    source: 'Slack',
    channel: channel || '',
    user: userName || '',
    prompt: prompt,
  }, config);
}

function processTelegramPrompt(prompt, chatId, userName) {
  const config = validateConfig_(['SPREADSHEET_ID', 'ANTHROPIC_KEY']);
  return processChannelPrompt_({
    platform: 'Telegram',
    source: 'Telegram',
    channel: chatId || '',
    user: userName || '',
    prompt: prompt,
  }, config);
}

function processWhatsAppPrompt(prompt, senderId, userName) {
  const config = validateConfig_(['SPREADSHEET_ID', 'ANTHROPIC_KEY']);
  return processChannelPrompt_({
    platform: 'WhatsApp',
    source: 'WhatsApp',
    channel: senderId || '',
    user: userName || senderId || '',
    prompt: prompt,
  }, config);
}

function processChannelPrompt_(message, config) {
  const prompt = String(message.prompt || '').trim();
  if (!prompt) return '';

  const metadata = {
    platform: message.platform || message.source || 'Channel',
    source: message.source || message.platform || 'Channel',
    channel: message.channel || '',
    user: message.user || '',
    threadId: '',
  };

  const outcome = processChannelConversation_(config, metadata, prompt, []);
  return outcome.reply;
}

// Backward-compatible aliases for earlier script names.
function runIngestion() {
  runIntakeLead();
}

function runWorkGeneration() {
  runPlanningLead();
}

// ============================================================
// INTAKE LEAD
// Reads enabled source connectors and writes Signal rows to Context Store.
// ============================================================

function runIntakeLead() {
  Logger.log('=== Intake Lead started ===');
  const config = validateConfig_(['SPREADSHEET_ID']);
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET.CONTEXT);

  if (!sheet) {
    Logger.log('ERROR: Context Store sheet not found. Check sheet name.');
    return;
  }

  const existingIds = getExistingIds_(sheet);
  const events = fetchSourceEvents_(config);

  let added = 0;
  for (const event of events) {
    const row = buildContextRow_(event);
    if (!existingIds.has(row[COL.ID - 1])) {
      appendContextRow_(sheet, row);
      existingIds.add(row[COL.ID - 1]);
      added++;
    }
  }

  Logger.log(`Intake Lead: ${added} new rows added (${events.length} events fetched).`);
}

// --- Source connector helpers ---

function fetchSourceEvents_(config) {
  const events = [];
  const enabledSources = getEnabledSources_(config);

  if (enabledSources.length === 0) {
    Logger.log('No sources enabled. Set ENABLED_SOURCES in Script properties.');
    return events;
  }

  const connectors = [
    {
      key: 'github',
      label: 'GitHub',
      requiredKeys: ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'],
      fetcher: fetchGitHubSignalEvents_,
    },
    {
      key: 'google_drive',
      label: 'Google Drive',
      requiredKeys: [],
      fetcher: fetchGoogleDriveSignalEvents_,
    },
    {
      key: 'notion',
      label: 'Notion',
      requiredKeys: ['NOTION_TOKEN'],
      fetcher: fetchNotionSignalEvents_,
    },
    {
      key: 'smartsheet',
      label: 'Smartsheet',
      requiredKeys: ['SMARTSHEET_TOKEN'],
      fetcher: fetchSmartsheetSignalEvents_,
    },
    {
      key: 'onedrive',
      label: 'OneDrive / O365',
      requiredKeys: ['ONEDRIVE_TOKEN'],
      fetcher: fetchOneDriveSignalEvents_,
    },
    {
      key: 'gmail',
      label: 'Gmail',
      requiredKeys: [],
      fetcher: fetchGmailSignalEvents_,
    },
  ];

  connectors.forEach(connector => {
    if (!enabledSources.includes(connector.key)) return;

    const missing = connector.requiredKeys.filter(key => !config[key] || String(config[key]).startsWith('YOUR_'));
    if (missing.length > 0) {
      Logger.log(`${connector.label} skipped. Missing config: ${missing.join(', ')}`);
      return;
    }

    try {
      const connectorEvents = connector.fetcher(config) || [];
      events.push.apply(events, connectorEvents);
      Logger.log(`${connector.label}: ${connectorEvents.length} signal(s) fetched.`);
    } catch (e) {
      Logger.log(`${connector.label} fetch error: ${e.message}`);
    }
  });

  return events;
}

// --- GitHub connector ---

function fetchGitHubSignalEvents_(config) {
  const events = [];

  events.push.apply(events, fetchRecentPRs_(config));
  events.push.apply(events, fetchRecentCommits_(config));
  events.push.apply(events, fetchRecentIssues_(config));

  return events;
}

function fetchRecentPRs_(config) {
  const url = `https://api.github.com/repos/${config.GITHUB_OWNER}/${config.GITHUB_REPO}/pulls?state=all&per_page=10&sort=updated&direction=desc`;
  const data = githubGet_(url, config);
  return data.map(pr => ({
    type:       'Signal',
    source:     'GitHub',
    summary:    `PR #${pr.number}: ${pr.title}`,
    confidence: 'High',
    details:    `State: ${pr.state} | Author: ${pr.user.login} | URL: ${pr.html_url}`,
    id:         `gh-pr-${pr.number}`,
  }));
}

function fetchRecentCommits_(config) {
  const url = `https://api.github.com/repos/${config.GITHUB_OWNER}/${config.GITHUB_REPO}/commits?per_page=10`;
  const data = githubGet_(url, config);
  return data.map(c => ({
    type:       'Signal',
    source:     'GitHub',
    summary:    `Commit: ${c.commit.message.split('\n')[0].substring(0, 80)}`,
    confidence: 'High',
    details:    `SHA: ${c.sha.substring(0,7)} | Author: ${c.commit.author.name} | Date: ${c.commit.author.date}`,
    id:         `gh-commit-${c.sha.substring(0,7)}`,
  }));
}

function fetchRecentIssues_(config) {
  const url = `https://api.github.com/repos/${config.GITHUB_OWNER}/${config.GITHUB_REPO}/issues?state=open&per_page=10&sort=updated&direction=desc`;
  const data = githubGet_(url, config);
  // Filter out PRs (GitHub issues API returns PRs too)
  return data
    .filter(i => !i.pull_request)
    .map(i => ({
      type:       'Signal',
      source:     'GitHub',
      summary:    `Issue #${i.number}: ${i.title}`,
      confidence: 'Medium',
      details:    `State: ${i.state} | Labels: ${(i.labels || []).map(l => l.name).join(', ')} | URL: ${i.html_url}`,
      id:         `gh-issue-${i.number}`,
    }));
}

// --- Google Drive connector ---

function fetchGoogleDriveSignalEvents_(config) {
  const files = listRecentDriveFiles_(config);
  return files.map(file => ({
    type:       'Signal',
    source:     'Google Drive',
    summary:    `Drive file updated: ${file.name}`,
    confidence: 'Medium',
    details:    `File ID: ${file.id} | Modified: ${file.modifiedAt} | URL: ${file.url}`,
    id:         `drive-file-${file.id}`,
  }));
}

function listRecentDriveFiles_(config) {
  const files = [];
  const query = config.DRIVE_FOLDER_ID
    ? `'${config.DRIVE_FOLDER_ID}' in parents and trashed = false`
    : 'trashed = false';
  const iterator = DriveApp.searchFiles(query);
  const limit = 10;

  while (iterator.hasNext() && files.length < limit) {
    const file = iterator.next();
    files.push({
      id: file.getId(),
      name: file.getName(),
      modifiedAt: file.getLastUpdated().toISOString(),
      url: file.getUrl(),
    });
  }

  files.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
  return files.slice(0, limit);
}

// --- Notion connector ---

function fetchNotionSignalEvents_(config) {
  const payload = config.NOTION_DATABASE_ID
    ? {
        filter: {
          property: 'Last edited time',
          last_edited_time: {
            past_week: {},
          },
        },
        page_size: 10,
      }
    : { page_size: 10, sort: { direction: 'descending', timestamp: 'last_edited_time' } };

  const url = config.NOTION_DATABASE_ID
    ? `https://api.notion.com/v1/databases/${config.NOTION_DATABASE_ID}/query`
    : 'https://api.notion.com/v1/search';

  const data = notionRequest_(url, config, payload);
  const results = data.results || [];

  return results.slice(0, 10).map(item => ({
    type:       'Signal',
    source:     'Notion',
    summary:    `Notion updated: ${getNotionTitle_(item)}`,
    confidence: 'Medium',
    details:    `Object: ${item.object} | Last edited: ${item.last_edited_time || 'unknown'} | URL: ${item.url || ''}`,
    id:         `notion-${item.id}`,
  }));
}

function notionRequest_(url, config, payload) {
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${config.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
    },
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true,
  });

  return parseJsonResponse_(response, 'Notion');
}

function getNotionTitle_(item) {
  if (item.object === 'page' && item.properties) {
    const titleKey = Object.keys(item.properties).find(key => item.properties[key].type === 'title');
    if (titleKey) {
      const titleProp = item.properties[titleKey].title || [];
      const plain = titleProp.map(part => part.plain_text).join('');
      if (plain) return plain;
    }
  }

  if (item.object === 'database' && item.title) {
    const plain = item.title.map(part => part.plain_text).join('');
    if (plain) return plain;
  }

  return 'Untitled item';
}

// --- Smartsheet connector ---

function fetchSmartsheetSignalEvents_(config) {
  const sheets = listSmartsheetSheets_(config);
  return sheets.map(sheet => ({
    type:       'Signal',
    source:     'Smartsheet',
    summary:    `Smartsheet updated: ${sheet.name}`,
    confidence: 'Medium',
    details:    `Sheet ID: ${sheet.id} | Modified: ${sheet.modifiedAt} | URL: ${sheet.url || ''}`,
    id:         `smartsheet-${sheet.id}`,
  }));
}

function listSmartsheetSheets_(config) {
  if (config.SMARTSHEET_SHEET_ID) {
    const sheet = smartsheetGet_(`https://api.smartsheet.com/2.0/sheets/${config.SMARTSHEET_SHEET_ID}`, config);
    return [{
      id: sheet.id,
      name: sheet.name,
      modifiedAt: sheet.modifiedAt || '',
      url: sheet.permalink || '',
    }];
  }

  const data = smartsheetGet_('https://api.smartsheet.com/2.0/sheets?includeAll=true', config);
  const rows = data.data || [];

  return rows
    .slice(0, 10)
    .map(sheet => ({
      id: sheet.id,
      name: sheet.name,
      modifiedAt: sheet.modifiedAt || '',
      url: sheet.permalink || '',
    }));
}

function smartsheetGet_(url, config) {
  const response = UrlFetchApp.fetch(url, {
    headers: {
      'Authorization': `Bearer ${config.SMARTSHEET_TOKEN}`,
      'Accept': 'application/json',
    },
    muteHttpExceptions: true,
  });

  return parseJsonResponse_(response, 'Smartsheet');
}

// --- OneDrive connector ---

function fetchOneDriveSignalEvents_(config) {
  const items = listOneDriveItems_(config);
  return items.map(item => ({
    type:       'Signal',
    source:     'OneDrive',
    summary:    `OneDrive updated: ${item.name}`,
    confidence: 'Medium',
    details:    `Item ID: ${item.id} | Modified: ${item.modifiedAt} | Web URL: ${item.url || ''}`,
    id:         `onedrive-${item.id}`,
  }));
}

function listOneDriveItems_(config) {
  let url = 'https://graph.microsoft.com/v1.0/me/drive/recent?$top=10';

  if (config.ONEDRIVE_DRIVE_ID && config.ONEDRIVE_FOLDER_ID) {
    url = `https://graph.microsoft.com/v1.0/drives/${config.ONEDRIVE_DRIVE_ID}/items/${config.ONEDRIVE_FOLDER_ID}/children?$top=10`;
  }

  const data = oneDriveGet_(url, config);
  const rows = data.value || [];

  return rows.slice(0, 10).map(item => ({
    id: item.id,
    name: item.name,
    modifiedAt: item.lastModifiedDateTime || '',
    url: item.webUrl || '',
  }));
}

function oneDriveGet_(url, config) {
  const response = UrlFetchApp.fetch(url, {
    headers: {
      'Authorization': `Bearer ${config.ONEDRIVE_TOKEN}`,
      'Accept': 'application/json',
    },
    muteHttpExceptions: true,
  });

  return parseJsonResponse_(response, 'OneDrive');
}

// --- Gmail connector ---

function fetchGmailSignalEvents_(config) {
  const threads = listRecentEmailThreads_(config);
  return threads.map(thread => ({
    type:       'Signal',
    source:     'Email',
    summary:    `Email: ${thread.subject}`,
    confidence: 'Medium',
    details:    `From: ${thread.from} | Date: ${thread.date} | Messages: ${thread.messageCount} | Attachments: ${thread.attachmentCount}`,
    id:         `gmail-thread-${thread.id}`,
  }));
}

function listRecentEmailThreads_(config) {
  const query = buildGmailQuery_(config);
  const threads = GmailApp.search(query, 0, 10);

  return threads.map(thread => {
    const messages = thread.getMessages();
    const lastMessage = messages[messages.length - 1];
    const attachmentCount = messages.reduce((count, message) => count + message.getAttachments().length, 0);

    return {
      id: thread.getId(),
      subject: thread.getFirstMessageSubject() || '(no subject)',
      from: lastMessage.getFrom(),
      date: lastMessage.getDate().toISOString(),
      messageCount: messages.length,
      attachmentCount: attachmentCount,
    };
  });
}

function buildGmailQuery_(config) {
  const parts = [];
  if (config.GMAIL_QUERY) parts.push(config.GMAIL_QUERY);
  if (config.GMAIL_LABEL) parts.push(`label:${config.GMAIL_LABEL}`);
  if (parts.length === 0) parts.push('newer_than:7d');
  return parts.join(' ');
}

function githubGet_(url, config) {
  const response = UrlFetchApp.fetch(url, {
    headers: {
      'Authorization': `token ${config.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
    },
    muteHttpExceptions: true,
  });

  return parseJsonResponse_(response, 'GitHub');
}

// --- Context Store row helpers ---

function buildContextRow_(event) {
  const now = new Date().toISOString();
  return [
    event.id,          // ID
    event.type,        // Type
    event.source,      // Source
    event.summary,     // Summary
    event.confidence,  // Confidence
    '',                // Linked Intent (filled manually or by Planning Lead)
    'Team',            // Visibility
    'No',              // Action Ready
    '—',               // Task Status
    now,               // Created At
    event.details,     // Details
  ];
}

function appendContextRow_(sheet, row) {
  sheet.appendRow(row);
}

function appendContextRowsIfMissing_(config, rows) {
  if (!rows || rows.length === 0) return 0;

  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET.CONTEXT);
  if (!sheet) {
    throw new Error('Context Store sheet not found while writing context rows.');
  }

  const existingIds = getExistingIds_(sheet);
  let added = 0;

  rows.forEach(row => {
    const id = String(row[COL.ID - 1] || '');
    if (!id || existingIds.has(id)) return;
    appendContextRow_(sheet, row);
    existingIds.add(id);
    added++;
  });

  return added;
}

function getExistingIds_(sheet) {
  const data = sheet.getDataRange().getValues();
  const ids = new Set();
  for (let i = 1; i < data.length; i++) { // skip header row
    if (data[i][COL.ID - 1]) ids.add(String(data[i][COL.ID - 1]));
  }
  return ids;
}

// ============================================================
// PLANNING LEAD
// Reads Context Store, calls Claude, writes proposed tasks.
// ============================================================

function runPlanningLead() {
  Logger.log('=== Planning Lead started ===');
  const config = validateConfig_(['SPREADSHEET_ID', 'ANTHROPIC_KEY']);
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const contextSheet  = ss.getSheetByName(SHEET.CONTEXT);
  const taskSheet     = ss.getSheetByName(SHEET.TASKS);
  const profileSheet  = ss.getSheetByName(SHEET.COMPANY_PROFILE);

  if (!contextSheet || !taskSheet) {
    Logger.log('ERROR: Required sheets not found. Check sheet names.');
    return;
  }

  const contextRows   = readContextStore_(contextSheet);
  const existingTasks = getExistingTaskSummaries_(taskSheet);
  const intents       = extractIntents_(contextRows);
  const signals       = extractActionableSignals_(contextRows);
  const constraints   = extractConstraints_(contextRows);
  const profile       = readCompanyProfile_(profileSheet);

  if (intents.length === 0) {
    Logger.log('Planning Lead: no Intent rows found. Add at least one Intent to the Context Store first.');
    return;
  }

  // Conditional skip: if no new signals since last run, save the Claude call
  const LAST_RUN_KEY = 'PLANNING_LEAD_LAST_RUN';
  const lastRunStr   = PropertiesService.getScriptProperties().getProperty(LAST_RUN_KEY) || '';
  const lastRunMs    = lastRunStr ? new Date(lastRunStr).getTime() : 0;
  const newSignals   = signals.filter(function(s) {
    return new Date(s.createdAt).getTime() > lastRunMs;
  });

  if (newSignals.length === 0 && lastRunMs > 0) {
    Logger.log('Planning Lead: no new signals since last run (' + lastRunStr + ') — skipping Claude call.');
    return;
  }
  PropertiesService.getScriptProperties().setProperty(LAST_RUN_KEY, new Date().toISOString());

  const proposals = generateTaskProposals_(intents, signals, constraints, profile, existingTasks, config);

  let added = 0;
  for (const task of proposals) {
    if (!isDuplicate_(task.task, existingTasks)) {
      appendTaskRow_(taskSheet, task);
      existingTasks.add(task.task.toLowerCase().substring(0, 60));
      added++;
    }
  }

  if (added === 0 && proposals.length === 0) {
    Logger.log('Planning Lead: no tasks proposed. Signals may not meet the threshold, or all actionable signals are already addressed. Check signal confidence levels and linked intents.');
  } else {
    Logger.log('Planning Lead: ' + added + ' new task(s) proposed.');
  }
}

// --- Context Store readers ---

function readContextStore_(sheet) {
  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[COL.ID - 1]) continue; // skip empty rows
    rows.push({
      id:            row[COL.ID - 1],
      type:          row[COL.TYPE - 1],
      source:        row[COL.SOURCE - 1],
      summary:       row[COL.SUMMARY - 1],
      confidence:    row[COL.CONFIDENCE - 1],
      linkedIntent:  row[COL.LINKED_INTENT - 1],
      visibility:    row[COL.VISIBILITY - 1],
      actionReady:   row[COL.ACTION_READY - 1],
      taskStatus:    row[COL.TASK_STATUS - 1],
      createdAt:     row[COL.CREATED_AT - 1],
      details:       row[COL.DETAILS - 1],
    });
  }
  return rows;
}

function extractIntents_(rows) {
  return rows.filter(function(r) { return r.type === 'Intent'; });
}

function extractConstraints_(rows) {
  return rows.filter(function(r) { return r.type === 'Constraint'; });
}

function extractActionableSignals_(rows) {
  return rows.filter(r => {
    if (r.type !== 'Signal' && r.type !== 'Decision') return false;
    if (r.taskStatus === 'Done' || r.taskStatus === 'In Progress') return false;
    return true;
  });
}

function getExistingTaskSummaries_(sheet) {
  const data = sheet.getDataRange().getValues();
  const set = new Set();
  for (let i = 1; i < data.length; i++) {
    const task = data[i][TASK_COL.TASK - 1];
    if (task) set.add(String(task).toLowerCase().substring(0, 60));
  }
  return set;
}

// --- Task generation via Claude ---

function generateTaskProposals_(intents, signals, constraints, profile, existingTasks, config) {
  if (signals.length === 0) {
    Logger.log('No actionable signals found.');
    return [];
  }

  // Pre-filter: rank signals by keyword overlap with active intents.
  // Explicitly linked signals and High confidence always rank highest.
  const intentKeywords = extractKeywords_(intents.map(function(i) { return i.summary + ' ' + (i.details || ''); }).join(' '));
  const scored = signals.map(function(s) {
    let score = 0;
    if (s.confidence === 'High')   score += 3;
    if (s.confidence === 'Medium') score += 1;
    if (s.linkedIntent)            score += 4;
    const sigWords = extractKeywords_(s.summary);
    intentKeywords.forEach(function(kw) { if (sigWords.indexOf(kw) !== -1) score += 2; });
    return { signal: s, score: score };
  });
  scored.sort(function(a, b) { return b.score - a.score; });
  const topSignals = scored.slice(0, 15).map(function(s) { return s.signal; });

  // Build intent block with Commander's Intent structure (Purpose, End State, Fallback from Details)
  const intentText = intents.map(function(i) {
    const ci = parseIntentStructure_(i);
    let block = '- [' + i.id + '] GOAL: ' + i.summary;
    if (ci.purpose)  block += '\n     WHY: '      + ci.purpose;
    if (ci.endState) block += '\n     SUCCESS: '  + ci.endState;
    if (ci.fallback) block += '\n     FALLBACK: ' + ci.fallback;
    return block;
  }).join('\n');

  const constraintText = constraints.length > 0
    ? constraints.map(function(c) { return '- [' + c.id + '] ' + c.summary; }).join('\n')
    : '(none recorded)';

  const signalText = topSignals.map(function(s) {
    return '- [' + s.id + '] (' + s.confidence + ' confidence) ' + s.summary;
  }).join('\n');

  const existingText = [...existingTasks].slice(0, 15).join('\n- ');

  const northStar     = profileIsConfigured_(profile) ? buildNorthStarContext_(profile) : '';
  const northStarBlock = northStar
    ? '\nNORTH STAR — every proposed task must trace to at least one Goal below. If it cannot, it is a distraction — do not propose it. If it conflicts with an Anti-Goal, flag it and drop it.\n' + northStar + '\n'
    : '';

  const prompt = `You are Planning Lead for a Chief of Staff. You reason like a seasoned operator who has seen hundreds of execution cycles. You do not generate tasks mechanically — you diagnose the situation first, then prescribe.
${northStarBlock}
STEP 1 — SITUATION RECOGNITION
Before proposing anything, read the signals and classify each meaningful cluster into one of these archetypes:
• VELOCITY BLOCKAGE — work is stalled waiting on a decision, person, or resource
• DECISION PENDING — a choice must be made that is blocking downstream work
• DRIFT — an approved task or active intent shows no recent progress signal
• OPPORTUNITY WINDOW — a time-sensitive action that directly serves a live intent
• CONSTRAINT PRESSURE — the current trajectory risks violating a known hard limit
• SIGNAL CLUSTER — 2+ independent signals pointing at the same unaddressed need

STEP 2 — COURSE OF ACTION
For each recognised situation, generate the single most direct and specific task that resolves it.

STEP 3 — SIMULATE FORWARD
Before finalising each proposal, test it mentally:
- Does completing this task meaningfully advance its linked intent's end state? If not, drop it.
- Does it conflict with a constraint or an Anti-Goal? If yes, flag and drop or modify.
- What is the cost of NOT doing this in the next 48 hours? If low, deprioritise.
- Does this task unblock or unlock other tasks? If yes, elevate priority.

STEP 4 — PRE-MORTEM
For each surviving proposal: assume it was executed but failed to produce the intended outcome. What is the single most likely reason it failed? If the failure mode reveals a blocker or dependency that must be resolved first, surface that as the task instead.

ACTIVE INTENTS (with Commander's Intent structure where available):
${intentText}

HARD CONSTRAINTS (tasks must never violate these):
${constraintText}

SIGNALS (ranked by relevance to active intents — top 15 shown):
${signalText}

ALREADY PROPOSED (do not duplicate):
${existingText || '(none yet)'}

OUTPUT FORMAT — return a JSON array only, no other text:
[
  {
    "situationType": "VELOCITY_BLOCKAGE | DECISION_PENDING | DRIFT | OPPORTUNITY_WINDOW | CONSTRAINT_PRESSURE | SIGNAL_CLUSTER",
    "task": "Specific, concrete action a person can execute",
    "contextIds": "comma-separated signal IDs that support this",
    "linkedIntent": "intent ID this serves",
    "linkedGoal": "Annual/Quarterly Goal this serves — or DISTRACTION if it cannot be traced",
    "priority": "High | Medium | Low",
    "effort": "Small | Medium | Large",
    "riskOfInaction": "One sentence: what goes wrong if this is not done this week",
    "preMortemRisk": "One sentence: the most likely reason this task fails even if executed"
  }
]

Rules:
- Return [] if the simulation and pre-mortem find nothing worth proposing
- Drop any task where linkedGoal would be DISTRACTION — do not include it
- Maximum 5 proposals
- Each task must be executable, not aspirational ("Schedule auth review with CISO" not "Address auth concerns")
- Conservative — both the forward simulation AND the pre-mortem must pass before you propose`;

  try {
    // Sonnet: RPD reasoning and structured output require quality inference
    const response = callClaude_(prompt, config, { model: 'claude-sonnet-4-6', maxTokens: 1200 });
    const parsed = JSON.parse(response);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 5);
  } catch (e) {
    Logger.log('Planning Lead Claude parse error: ' + e.message);
    return [];
  }
}

// Parses Commander's Intent structure from an Intent row's Details field.
// Expected format in Details: "Purpose: X | End State: Y | Fallback: Z"
// All fields are optional — the system degrades gracefully if absent.
function parseIntentStructure_(intent) {
  const details = String(intent.details || '');
  return {
    purpose:  extractField_(details, 'Purpose'),
    endState: extractField_(details, 'End State') || extractField_(details, 'EndState') || extractField_(details, 'Success'),
    fallback: extractField_(details, 'Fallback'),
  };
}

function extractField_(text, fieldName) {
  const regex = new RegExp(fieldName + '\\s*:\\s*([^|\\n]+)', 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function isDuplicate_(task, existingTasks) {
  const key = task.toLowerCase().substring(0, 60);
  return existingTasks.has(key);
}

function appendTaskRow_(sheet, task) {
  const now    = new Date().toISOString();
  const nextId = 'T' + String(sheet.getLastRow()).padStart(3, '0');
  // Notes carries full RPD analysis: situation type, goal link, risks, pre-mortem
  const autoNotes = [
    task.situationType  ? '[' + task.situationType + ']'                        : '',
    task.linkedGoal     ? 'Goal: '          + task.linkedGoal                   : '',
    task.riskOfInaction ? 'Risk if skipped: ' + task.riskOfInaction             : '',
    task.preMortemRisk  ? 'Pre-mortem: '    + task.preMortemRisk                : '',
  ].filter(Boolean).join(' | ');

  sheet.appendRow([
    nextId,
    task.task,
    task.contextIds || '',
    task.priority   || 'Medium',
    task.effort     || 'Medium',
    'Pending Review',
    now,
    '',
    autoNotes,
  ]);
}

// ============================================================
// DELIVERY LEAD
// Flags stale tasks that need attention.
// ============================================================

function runDeliveryMonitor() {
  Logger.log('=== Delivery Lead started ===');
  const config = validateConfig_(['SPREADSHEET_ID']);
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const taskSheet = ss.getSheetByName(SHEET.TASKS);

  if (!taskSheet) {
    Logger.log('ERROR: Proposed Tasks sheet not found.');
    return;
  }

  const data = taskSheet.getDataRange().getValues();
  if (data.length <= 1) {
    Logger.log('Delivery Lead: no tasks to inspect.');
    return;
  }

  const nowMs = Date.now();
  const staleDays = 7;
  let flagged = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = String(row[TASK_COL.STATUS - 1] || '');
    if (status !== 'Pending Review' && status !== 'Approved' && status !== 'In Progress') continue;

    const created = new Date(row[TASK_COL.CREATED_AT - 1]);
    if (isNaN(created.getTime())) continue;

    const ageDays = Math.floor((nowMs - created.getTime()) / (1000 * 60 * 60 * 24));
    if (ageDays < staleDays) continue;

    const noteCell = taskSheet.getRange(i + 1, TASK_COL.NOTES);
    const currentNote = String(row[TASK_COL.NOTES - 1] || '');
    if (currentNote.includes('[Delivery Lead]')) continue;

    const alert = `[Delivery Lead] Stale for ${ageDays} days - review owner or status.`;
    noteCell.setValue(currentNote ? `${currentNote} | ${alert}` : alert);
    flagged++;
  }

  Logger.log(`Delivery Lead: ${flagged} stale tasks flagged.`);
}

// ============================================================
// BRIEFING LEAD
// Produces a BLUF-format intelligence briefing via Claude.
// Structure: Bottom Line → What Changed → Decisions Required →
//            Execution Risk → Owner Actions.
// Counts are retained as metadata; the narrative goes in Highlights.
// ============================================================

function runBriefingLead() {
  Logger.log('=== Briefing Lead started ===');
  const config = validateConfig_(['SPREADSHEET_ID', 'ANTHROPIC_KEY']);
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const contextSheet  = ss.getSheetByName(SHEET.CONTEXT);
  const taskSheet     = ss.getSheetByName(SHEET.TASKS);
  const profileSheet  = ss.getSheetByName(SHEET.COMPANY_PROFILE);
  const briefSheet    = ensureBriefingsSheet_(ss);

  if (!contextSheet || !taskSheet || !briefSheet) {
    Logger.log('ERROR: Required sheets not found for Briefing Lead.');
    return;
  }

  const contextRows = readContextStore_(contextSheet);
  const taskRows    = readTaskStore_(taskSheet);
  const profile     = readCompanyProfile_(profileSheet);
  const now         = new Date().toISOString();

  // Retain counts as scannable metadata
  const typeCounts   = { Intent: 0, Decision: 0, Signal: 0, Constraint: 0, Learning: 0 };
  contextRows.forEach(function(r) { if (typeCounts[r.type] !== undefined) typeCounts[r.type]++; });

  const statusCounts = { 'Pending Review': 0, Approved: 0, 'In Progress': 0, Done: 0, Rejected: 0 };
  taskRows.forEach(function(r) { if (statusCounts[r.status] !== undefined) statusCounts[r.status]++; });

  const contextSummary = 'Intent ' + typeCounts.Intent + ', Decision ' + typeCounts.Decision + ', Signal ' + typeCounts.Signal + ', Constraint ' + typeCounts.Constraint + ', Learning ' + typeCounts.Learning;
  const taskSummary    = 'Pending ' + statusCounts['Pending Review'] + ', Approved ' + statusCounts.Approved + ', In Progress ' + statusCounts['In Progress'] + ', Done ' + statusCounts.Done + ', Rejected ' + statusCounts.Rejected;

  // Get previous briefing for "what changed" context
  const prevBriefData = briefSheet.getDataRange().getValues();
  const lastBriefing  = prevBriefData.length > 1 ? prevBriefData[prevBriefData.length - 1] : null;

  const narrative = generateBriefingNarrative_(contextRows, taskRows, profile, lastBriefing, config);

  briefSheet.appendRow([now, 'Current', contextSummary, taskSummary, narrative, 'Generated by Briefing Lead']);
  Logger.log('Briefing Lead: BLUF briefing appended.');
}

function generateBriefingNarrative_(contextRows, taskRows, profile, lastBriefing, config) {
  const nowMs = Date.now();

  const intents     = contextRows.filter(function(r) { return r.type === 'Intent'; });
  const decisions   = contextRows.filter(function(r) { return r.type === 'Decision'; });
  const constraints = contextRows.filter(function(r) { return r.type === 'Constraint'; });

  // Recent signals: last 7 days
  const recentSignals = contextRows
    .filter(function(r) {
      if (r.type !== 'Signal' && r.type !== 'Learning') return false;
      return (nowMs - new Date(r.createdAt).getTime()) / 86400000 < 7;
    })
    .slice(0, 10);

  const pendingTasks     = taskRows.filter(function(r) { return r.status === 'Pending Review'; });
  const inProgressTasks  = taskRows.filter(function(r) { return r.status === 'In Progress' || r.status === 'Approved'; });
  const staleTasks       = taskRows.filter(function(r) {
    if (r.status === 'Done' || r.status === 'Rejected') return false;
    const age = (nowMs - new Date(r.createdAt).getTime()) / 86400000;
    return age > 7;
  });

  // Build intent block with Commander's Intent structure
  const intentText = intents.map(function(i) {
    const ci = parseIntentStructure_(i);
    let line = '[' + i.id + '] ' + i.summary;
    if (ci.endState) line += ' → Success: ' + ci.endState;
    return line;
  }).join('\n');

  const recentSignalText = recentSignals.length > 0
    ? recentSignals.map(function(r) { return '- [' + r.id + '] ' + r.summary + ' (' + r.confidence + ')'; }).join('\n')
    : '(none in last 7 days)';

  const pendingText     = pendingTasks.map(function(t)    { return '- [' + t.id + '] ' + t.task + ' (' + (t.priority || 'n/a') + ' priority)'; }).join('\n') || '(none)';
  const inProgressText  = inProgressTasks.map(function(t) { return '- [' + t.id + '] ' + t.task; }).join('\n') || '(none)';
  const staleText       = staleTasks.map(function(t) {
    const age = Math.floor((nowMs - new Date(t.createdAt).getTime()) / 86400000);
    return '- [' + t.id + '] ' + t.task + ' (' + age + 'd old, ' + t.status + ')';
  }).join('\n') || '(none)';

  const constraintText  = constraints.map(function(c) { return '- ' + c.summary; }).join('\n') || '(none recorded)';
  const prevBriefLine   = lastBriefing ? 'Previous briefing (' + lastBriefing[0] + '): ' + String(lastBriefing[4] || '').substring(0, 200) : '(no previous briefing)';
  const northStar       = profileIsConfigured_(profile) ? buildNorthStarContext_(profile) : '';

  const prompt = `You are Briefing Lead for a Chief of Staff system. Produce an executive intelligence briefing in strict BLUF format. This goes directly to a busy operator — every word must earn its place. No padding. No passive voice.

BLUF FORMAT (use these exact section headers):

BOTTOM LINE: [One sentence. The single most important thing the owner needs to know or act on right now. Start with the conclusion, not the context.]

WHAT CHANGED: [2–4 bullet points. What is new since the last briefing — new signals, decisions made, tasks completed, or situations that have shifted. Only what is actually new.]

DECISIONS REQUIRED: [Choices the owner must make. Name the decision explicitly and why it is blocked. If none, write "None."]

EXECUTION RISK: [What is at risk of slipping, failing, or creating a downstream problem. Name the specific task or intent. Not categories — specifics. If none, write "None."]

NORTH STAR ALIGNMENT: [Are active intents and in-progress tasks traceable to the company's annual goals? Call out any work that cannot be traced to a goal, or any active work that looks like an Anti-Goal violation. If everything is aligned, write "Aligned." If no company profile is set, write "No company profile configured."]

OWNER ACTIONS: [Max 3 actions only the owner can take. Numbered. One line each. If none, write "None."]${northStar ? '\n\nCOMPANY NORTH STAR:\n' + northStar : ''}

---

ACTIVE INTENTS:
${intentText || '(none set)'}

RECENT SIGNALS (last 7 days):
${recentSignalText}

PENDING REVIEW (${pendingTasks.length} tasks):
${pendingText}

IN PROGRESS / APPROVED (${inProgressTasks.length} tasks):
${inProgressText}

STALE / AT RISK (${staleTasks.length} tasks):
${staleText}

CONSTRAINTS:
${constraintText}

${prevBriefLine}

---

Rules:
- Never bury the lead. Most urgent item first.
- No vague language. Wrong: "some PRs need attention." Right: "PR #42 has been in review 8 days with no approval decision."
- If nothing requires the owner's attention this period, the Bottom Line should say so in one sentence and skip the other sections.
- Max 350 words total.`;

  try {
    // Sonnet: briefings are the primary stakeholder-facing output — quality is non-negotiable
    return callClaude_(prompt, config, { model: 'claude-sonnet-4-6', maxTokens: 700 });
  } catch (e) {
    return 'BLUF narrative generation failed: ' + e.message.substring(0, 100);
  }
}

// ============================================================
// RESEARCH ANALYST
// Fetches content from watched URLs and RSS feeds.
// Extracts PM / CoS / operations learnings and writes them
// as Learning rows to the Context Store.
// Schedule: daily or weekly via scheduledResearchAnalyst
// ============================================================

function runResearchAnalyst() {
  Logger.log('=== Research Analyst started ===');
  const config = validateConfig_(['SPREADSHEET_ID', 'ANTHROPIC_KEY']);
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const watchSheet = ss.getSheetByName(SHEET.KNOWLEDGE_WATCH);
  const contextSheet = ss.getSheetByName(SHEET.CONTEXT);

  if (!watchSheet) {
    Logger.log('Research Analyst: Knowledge Watch tab not found. Run setup to create it.');
    return;
  }
  if (!contextSheet) {
    Logger.log('Research Analyst: Context Store not found.');
    return;
  }

  const watchRows = readKnowledgeWatchRows_(watchSheet);
  if (watchRows.length === 0) {
    Logger.log('Research Analyst: No sources in Knowledge Watch tab.');
    return;
  }

  const nowMs     = Date.now();
  const isMonday  = new Date().getDay() === 1; // Weekly sources only refresh on Mondays

  const fetched = [];
  watchRows.forEach(function(row, index) {
    if (!row.url || row.status === 'Paused') return;

    // Respect Frequency: skip Weekly sources unless today is the designated refresh day
    if (row.frequency === 'Weekly' && !isMonday) {
      Logger.log('Research Analyst: skipping weekly source (not refresh day): ' + row.url);
      return;
    }
    try {
      const content = fetchKnowledgeSource_(row);
      if (!content) return;

      // Skip Claude extraction if content hasn't changed since last fetch
      const newHash = simpleHash_(content);
      if (newHash === row.contentHash) {
        Logger.log('Research Analyst: no change detected for ' + row.url + ' — skipping.');
        updateKnowledgeWatchRow_(watchSheet, index + 2, 'OK (unchanged)', new Date().toISOString(), newHash);
        return;
      }

      fetched.push({ source: row.url, tags: row.tags, content: content });
      updateKnowledgeWatchRow_(watchSheet, index + 2, 'OK', new Date().toISOString(), newHash);
    } catch (e) {
      Logger.log('Research Analyst: failed to fetch ' + row.url + ': ' + e.message);
      updateKnowledgeWatchRow_(watchSheet, index + 2, 'Error', '', '');
    }
  });

  if (fetched.length === 0) {
    Logger.log('Research Analyst: No content fetched from any source.');
    return;
  }

  const learnings = extractLearningsFromContent_(fetched, config);
  const existingIds = getExistingIds_(contextSheet);
  let added = 0;

  learnings.forEach(learning => {
    const id = 'learn-ra-' + simpleHash_(learning.summary);
    if (existingIds.has(id)) return;
    appendContextRow_(contextSheet, [
      id, 'Learning', 'Research Analyst', learning.summary,
      'Medium', learning.linkedIntent || '', 'Team', 'No', '—',
      new Date().toISOString(), learning.details || '',
    ]);
    existingIds.add(id);
    added++;
  });

  Logger.log('Research Analyst: ' + added + ' new Learning rows added from ' + fetched.length + ' source(s).');
}

// --- Knowledge Watch helpers ---

function readKnowledgeWatchRows_(sheet) {
  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[WATCH_COL.URL - 1]) continue;
    rows.push({
      url:         String(row[WATCH_COL.URL - 1]          || '').trim(),
      type:        String(row[WATCH_COL.TYPE - 1]         || 'Web').trim(),
      tags:        String(row[WATCH_COL.TOPIC_TAGS - 1]   || '').trim(),
      frequency:   String(row[WATCH_COL.FREQUENCY - 1]    || 'Weekly').trim(),
      status:      String(row[WATCH_COL.STATUS - 1]       || 'Active').trim(),
      contentHash: String(row[WATCH_COL.CONTENT_HASH - 1] || '').trim(),
    });
  }
  return rows;
}

function updateKnowledgeWatchRow_(sheet, rowNum, status, lastFetched, contentHash) {
  sheet.getRange(rowNum, WATCH_COL.LAST_FETCHED).setValue(lastFetched);
  sheet.getRange(rowNum, WATCH_COL.STATUS).setValue(status);
  if (contentHash !== undefined) {
    sheet.getRange(rowNum, WATCH_COL.CONTENT_HASH).setValue(contentHash);
  }
}

function fetchKnowledgeSource_(row) {
  const response = UrlFetchApp.fetch(row.url, { muteHttpExceptions: true });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) return null;
  const content = response.getContentText();
  if (row.type === 'RSS') return parseRssContent_(content);
  return extractWebText_(content);
}

function parseRssContent_(xmlText) {
  try {
    const doc = XmlService.parse(xmlText);
    const root = doc.getRootElement();
    const rootName = root.getName().toLowerCase();
    let items = [];

    if (rootName === 'rss') {
      const channel = root.getChild('channel');
      if (channel) items = channel.getChildren('item');
    } else if (rootName === 'feed') {
      // Try Atom namespace first, then no-namespace fallback
      const atomNs = XmlService.getNamespace('http://www.w3.org/2005/Atom');
      items = root.getChildren('entry', atomNs);
      if (items.length === 0) items = root.getChildren('entry');
    }

    return items.slice(0, 8).map(function(item) {
      const title = getChildText_(item, ['title']) || '';
      const desc  = getChildText_(item, ['description', 'summary', 'content']) || '';
      const clean = desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 160);
      return '• ' + title + (clean ? ': ' + clean : '');
    }).join('\n');
  } catch (e) {
    return null;
  }
}

function extractWebText_(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 3000);
}

function getChildText_(element, tagNames) {
  for (let t = 0; t < tagNames.length; t++) {
    const child = element.getChild(tagNames[t]);
    if (child) {
      const text = child.getText();
      if (text && text.trim()) return text.trim();
    }
  }
  return null;
}

function extractLearningsFromContent_(fetched, config) {
  const contentBlocks = fetched.map(function(item, i) {
    return 'SOURCE ' + (i + 1) + ' [' + (item.tags || 'General') + '] — ' + item.source + ':\n' + item.content.substring(0, 1200);
  }).join('\n\n---\n\n');

  const prompt = `You are Research Analyst for a Chief of Staff system. Your role is to keep the owner continuously learning about project management, CoS skills, operations, and leadership — so the system grows more intuitive to their way of working over time.

CONTENT FROM WATCHED SOURCES:
${contentBlocks}

Extract up to 8 learnings that are relevant to:
- Project management and delivery best practices
- Chief of Staff / operator / generalist skills
- Strategic decision-making and prioritisation frameworks
- Team coordination, communication, and stakeholder management
- Tools, processes, or techniques that sharpen operational effectiveness

OUTPUT FORMAT — return a JSON array only, no other text:
[
  {
    "summary": "One concrete learning (max 120 chars)",
    "details": "Context or source elaboration (max 200 chars)",
    "linkedIntent": ""
  }
]

Rules:
- Only extract genuinely useful and specific insights — not generic or obvious observations
- Prefer actionable learnings over vague summaries
- Return [] if no relevant learnings are found in the content`;

  try {
    // Haiku: structured extraction from web text — speed and cost over depth
    const response = callClaude_(prompt, config, { model: 'claude-haiku-4-5-20251001', maxTokens: 768 });
    const parsed = JSON.parse(response);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 8);
  } catch (e) {
    Logger.log('Research Analyst Claude parse error: ' + e.message);
    return [];
  }
}

// ============================================================
// COMPANY PROFILE — north star readers
// ============================================================

function readCompanyProfile_(sheet) {
  const empty = { mission: '', vision: '', annualGoals: [], quarterlyGoals: [], antiGoals: [], principles: [] };
  if (!sheet) return empty;

  const data = sheet.getDataRange().getValues();
  const profile = { mission: '', vision: '', annualGoals: [], quarterlyGoals: [], antiGoals: [], principles: [] };

  for (let i = 1; i < data.length; i++) {
    const row       = data[i];
    const category  = String(row[PROFILE_COL.CATEGORY - 1]  || '').trim();
    const statement = String(row[PROFILE_COL.STATEMENT - 1] || '').trim();
    const metric    = String(row[PROFILE_COL.METRIC - 1]    || '').trim();
    const status    = String(row[PROFILE_COL.STATUS - 1]    || 'Active').trim();

    // Skip placeholders, paused, or retired entries
    if (!statement || statement.includes('Replace with') || status === 'Paused' || status === 'Retired' || status === 'Achieved') continue;

    if      (category === 'Mission')             profile.mission = statement;
    else if (category === 'Vision')              profile.vision  = statement;
    else if (category === 'Annual Goal')         profile.annualGoals.push({ statement: statement, metric: metric });
    else if (category === 'Quarterly Goal')      profile.quarterlyGoals.push({ statement: statement, metric: metric });
    else if (category === 'Anti-Goal')           profile.antiGoals.push({ statement: statement });
    else if (category === 'Strategic Principle') profile.principles.push({ statement: statement });
  }

  return profile;
}

// Builds a compact north star block for use in agent prompts.
// Capped at ~500 chars to avoid ballooning token cost in every call.
function buildNorthStarContext_(profile) {
  if (!profile) return '(no company profile — add goals to the Company Profile tab)';

  const lines = [];
  if (profile.mission)                lines.push('Mission: ' + profile.mission);
  if (profile.vision)                 lines.push('Vision: '  + profile.vision);

  const goals = profile.annualGoals.concat(profile.quarterlyGoals);
  if (goals.length)    lines.push('Goals:\n' + goals.map(function(g) {
    return '  • ' + g.statement + (g.metric ? ' [' + g.metric + ']' : '');
  }).join('\n'));

  if (profile.antiGoals.length)    lines.push('Anti-Goals (do NOT pursue):\n' + profile.antiGoals.map(function(g) {
    return '  ✕ ' + g.statement;
  }).join('\n'));

  if (profile.principles.length)   lines.push('Principles:\n' + profile.principles.map(function(p) {
    return '  → ' + p.statement;
  }).join('\n'));

  const full = lines.join('\n');
  // Hard cap: truncate if profile is very long to protect token budget
  return full.length > 600 ? full.substring(0, 597) + '...' : full;
}

// Returns true if the company profile has been meaningfully filled in
function profileIsConfigured_(profile) {
  return profile && (profile.annualGoals.length > 0 || profile.mission !== '');
}

// ============================================================
// Returns lowercase meaningful words (>3 chars, not stopwords) for keyword-relevance scoring.
function extractKeywords_(text) {
  const stop = { the:1, and:1, for:1, with:1, this:1, that:1, have:1, from:1, been:1, will:1, are:1, was:1, not:1, but:1, our:1, all:1, can:1, per:1, its:1 };
  return String(text).toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(function(w) { return w.length > 3 && !stop[w]; });
}

function simpleHash_(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).substring(0, 8);
}

// ============================================================
// EDITORIAL DIRECTOR
// Reviews each new briefing for completeness, decision coverage,
// and clarity before it reaches stakeholders.
// Schedule: after Briefing Lead, or on demand via scheduledEditorialDirector
// ============================================================

function runEditorialDirector() {
  Logger.log('=== Editorial Director started ===');
  const config = validateConfig_(['SPREADSHEET_ID', 'ANTHROPIC_KEY']);
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const briefSheet    = ss.getSheetByName(SHEET.BRIEFINGS);
  const contextSheet  = ss.getSheetByName(SHEET.CONTEXT);
  const taskSheet     = ss.getSheetByName(SHEET.TASKS);

  if (!briefSheet) {
    Logger.log('Editorial Director: Briefings sheet not found.');
    return;
  }

  const briefData = briefSheet.getDataRange().getValues();
  if (briefData.length <= 1) {
    Logger.log('Editorial Director: No briefings to review.');
    return;
  }

  // Find the latest briefing that has not been reviewed yet
  let targetRow = -1;
  for (let i = briefData.length - 1; i >= 1; i--) {
    const notes = String(briefData[i][5] || '');
    if (!notes.includes('[Editorial Director]')) {
      targetRow = i;
      break;
    }
  }

  if (targetRow === -1) {
    Logger.log('Editorial Director: All briefings already reviewed.');
    return;
  }

  const briefing     = briefData[targetRow];
  const contextRows  = contextSheet ? readContextStore_(contextSheet) : [];
  const taskRows     = taskSheet    ? readTaskStore_(taskSheet)       : [];
  const review       = reviewBriefingContent_(briefing, contextRows, taskRows, config);

  const notesCell    = briefSheet.getRange(targetRow + 1, 6);
  const currentNotes = String(briefing[5] || '');
  notesCell.setValue(currentNotes ? currentNotes + ' | ' + review : review);

  Logger.log('Editorial Director: Briefing reviewed and annotated.');
}

function reviewBriefingContent_(briefing, contextRows, taskRows, config) {
  const briefText = [
    'Generated: '       + briefing[0],
    'Period: '          + briefing[1],
    'Context Summary: ' + briefing[2],
    'Task Summary: '    + briefing[3],
    'Highlights: '      + briefing[4],
  ].join('\n');

  const intents          = contextRows.filter(function(r) { return r.type === 'Intent'; }).map(function(r) { return r.summary; }).join('; ');
  const recentDecisions  = contextRows.filter(function(r) { return r.type === 'Decision'; }).slice(-3).map(function(r) { return r.summary; }).join('; ');
  const openCount        = taskRows.filter(function(r) { return r.status === 'Pending Review' || r.status === 'In Progress'; }).length;
  const constraints      = contextRows.filter(function(r) { return r.type === 'Constraint'; }).map(function(r) { return r.summary; }).join('; ');

  const prompt = `You are Editorial Director for a Chief of Staff system. Your job is to review each briefing before it reaches stakeholders and surface the single most important gap or quality issue.

BRIEFING TO REVIEW:
${briefText}

LIVE CONTEXT (not yet in briefing):
Active intents: ${intents || '(none set)'}
Recent decisions: ${recentDecisions || '(none recorded)'}
Active constraints: ${constraints || '(none)'}
Open tasks: ${openCount}

Review for:
1. Coverage — does the briefing reference all active intents?
2. Decision gap — are recent decisions captured?
3. Execution risk — any task that looks at risk or overdue?
4. Clarity — anything too vague to act on?

Return a single concise annotation starting with "[Editorial Director]". Max 220 characters.
Flag the most important gap only. If the briefing is complete and accurate, say so briefly.`;

  try {
    // Haiku: output is a single annotation sentence — no need for deeper reasoning
    return callClaude_(prompt, config, { model: 'claude-haiku-4-5-20251001', maxTokens: 256 });
  } catch (e) {
    return '[Editorial Director] Review failed: ' + e.message.substring(0, 80);
  }
}

// ============================================================
// KNOWLEDGE MANAGER
// Audits the Context Store for stale, orphaned, and duplicate rows.
// Writes a concise audit report to the Context Review tab.
// Schedule: weekly via scheduledKnowledgeManager
// ============================================================

function runKnowledgeManager() {
  Logger.log('=== Knowledge Manager started ===');
  const config = validateConfig_(['SPREADSHEET_ID', 'ANTHROPIC_KEY']);
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const contextSheet  = ss.getSheetByName(SHEET.CONTEXT);
  const profileSheet  = ss.getSheetByName(SHEET.COMPANY_PROFILE);
  const reviewSheet   = ensureContextReviewSheet_(ss);

  if (!contextSheet) {
    Logger.log('Knowledge Manager: Context Store not found.');
    return;
  }

  const contextRows = readContextStore_(contextSheet);
  if (contextRows.length === 0) {
    Logger.log('Knowledge Manager: Context Store is empty.');
    return;
  }

  const nowMs = Date.now();
  const staleThreshold       = 30; // days, no linked intent
  const lowConfOldThreshold  = 14; // days, Low confidence

  const stale = [], orphaned = [], lowConfOld = [], duplicates = [];
  const summaryMap = {};

  contextRows.forEach(function(row) {
    const ageDays = Math.floor((nowMs - new Date(row.createdAt).getTime()) / 86400000);

    // Stale: old non-Intent rows with no linked intent
    if (ageDays > staleThreshold && !row.linkedIntent && row.type !== 'Intent') {
      stale.push(row);
    }
    // Orphaned: Decisions or Constraints with no linked intent
    if ((row.type === 'Decision' || row.type === 'Constraint') && !row.linkedIntent) {
      orphaned.push(row);
    }
    // Low confidence rows older than 14 days — likely noise
    if (row.confidence === 'Low' && ageDays > lowConfOldThreshold) {
      lowConfOld.push(row);
    }
    // Near-duplicate summaries (first-60-char key match)
    const key = String(row.summary).toLowerCase().substring(0, 60);
    if (summaryMap[key]) {
      duplicates.push({ a: summaryMap[key], b: row });
    } else {
      summaryMap[key] = row;
    }
  });

  // Alignment drift: Intents with no obvious keyword link to Annual Goals
  const profile        = readCompanyProfile_(profileSheet);
  const goalKeywords   = profileIsConfigured_(profile)
    ? extractKeywords_(profile.annualGoals.concat(profile.quarterlyGoals).map(function(g) { return g.statement; }).join(' '))
    : [];
  const driftingIntents = goalKeywords.length > 0
    ? contextRows.filter(function(r) {
        if (r.type !== 'Intent') return false;
        const intentWords = extractKeywords_(r.summary + ' ' + (r.details || ''));
        return goalKeywords.filter(function(kw) { return intentWords.indexOf(kw) !== -1; }).length === 0;
      })
    : [];

  const totalIssues = stale.length + orphaned.length + lowConfOld.length + duplicates.length + driftingIntents.length;
  const auditText   = buildContextAuditText_(stale, orphaned, lowConfOld, duplicates, driftingIntents, contextRows.length);

  // Only call Claude when there is something to act on — clean audits need no recommendation
  const recommendations = totalIssues > 0
    ? generateContextAuditRec_(auditText, profile, config)
    : '[Knowledge Manager] Context store is clean — no issues found.';

  reviewSheet.appendRow([
    new Date().toISOString(),
    contextRows.length,
    stale.length,
    duplicates.length,
    orphaned.length,
    lowConfOld.length,
    recommendations,
    '',
  ]);

  Logger.log('Knowledge Manager: ' + stale.length + ' stale, ' + duplicates.length + ' duplicates, ' + orphaned.length + ' orphaned, ' + lowConfOld.length + ' low-confidence-old.');
}

function buildContextAuditText_(stale, orphaned, lowConfOld, duplicates, driftingIntents, total) {
  const lines = ['Total rows audited: ' + total];
  if (stale.length > 0)           lines.push('Stale (>30d, no intent): '           + stale.map(function(r) { return r.id; }).join(', '));
  if (orphaned.length > 0)        lines.push('Orphaned decisions/constraints: '     + orphaned.map(function(r) { return r.id; }).join(', '));
  if (lowConfOld.length > 0)      lines.push('Low confidence >14d: '                + lowConfOld.map(function(r) { return r.id; }).join(', '));
  if (duplicates.length > 0)      lines.push('Possible duplicates: '                + duplicates.map(function(d) { return d.a.id + ' / ' + d.b.id; }).join(', '));
  if (driftingIntents.length > 0) lines.push('Intents not traceable to any company goal: ' + driftingIntents.map(function(r) { return r.id + ' (' + r.summary.substring(0, 40) + ')'; }).join(', '));
  return lines.join('\n');
}

function generateContextAuditRec_(auditText, profile, config) {
  const northStarNote = profileIsConfigured_(profile)
    ? '\nCOMPANY GOALS (for alignment assessment):\n' + buildNorthStarContext_(profile)
    : '';

  const prompt = `You are Knowledge Manager for a Chief of Staff context engine. You keep the system's memory sharp and trustworthy so every downstream agent reasons from clean data.

AUDIT FINDINGS:
${auditText}${northStarNote}

Write 2–3 concise, specific recommendations the owner should act on to improve context quality (archive, link to an intent, update confidence, or resolve a conflict). Max 300 characters total. Start with "[Knowledge Manager]".

If no issues were found, confirm the store looks healthy.`;

  try {
    // Haiku: short structured recommendation — no reasoning depth needed
    return callClaude_(prompt, config, { model: 'claude-haiku-4-5-20251001', maxTokens: 256 });
  } catch (e) {
    return '[Knowledge Manager] Audit complete. Manual review recommended. ' + auditText.substring(0, 80);
  }
}

function ensureContextReviewSheet_(ss) {
  let sheet = ss.getSheetByName(SHEET.CONTEXT_REVIEW);
  if (sheet) return sheet;

  sheet = ss.insertSheet(SHEET.CONTEXT_REVIEW);
  sheet.appendRow(['Reviewed At', 'Total Rows', 'Stale', 'Duplicates', 'Orphaned', 'Low Conf Old', 'Recommendations', 'Notes']);

  const headerRange = sheet.getRange(1, 1, 1, 8);
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
  return sheet;
}

// ============================================================
// PROGRAM MANAGER
// Reviews the task queue every day.
// Surfaces quick wins, escalates stale pending reviews, and
// flags tasks drifting in progress without resolution.
// Schedule: daily via scheduledProgramManager
// ============================================================

function runProgramManager() {
  Logger.log('=== Program Manager started ===');
  const config = validateConfig_(['SPREADSHEET_ID', 'ANTHROPIC_KEY']);
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const taskSheet = ss.getSheetByName(SHEET.TASKS);

  if (!taskSheet) {
    Logger.log('Program Manager: Proposed Tasks sheet not found.');
    return;
  }

  const data = taskSheet.getDataRange().getValues();
  if (data.length <= 1) {
    Logger.log('Program Manager: No tasks to review.');
    return;
  }

  const nowMs                  = Date.now();
  const pendingStaleThreshold  = 3;   // days in Pending Review before escalating
  const inProgressDriftDays    = 10;  // days in In Progress before flagging drift

  const quickWins = [], stalePending = [], drifting = [], taskSummary = [];

  for (let i = 1; i < data.length; i++) {
    const row      = data[i];
    const id       = String(row[TASK_COL.ID - 1]       || '');
    if (!id) continue;

    const status   = String(row[TASK_COL.STATUS - 1]   || '');
    const priority = String(row[TASK_COL.PRIORITY - 1] || '');
    const effort   = String(row[TASK_COL.EFFORT - 1]   || '');
    const task     = String(row[TASK_COL.TASK - 1]     || '');
    const notes    = String(row[TASK_COL.NOTES - 1]    || '');
    const created  = new Date(row[TASK_COL.CREATED_AT - 1]);
    const ageDays  = isNaN(created.getTime()) ? 0 : Math.floor((nowMs - created.getTime()) / 86400000);

    if (status === 'Done' || status === 'Rejected') continue;

    taskSummary.push({ id: id, task: task, status: status, priority: priority, effort: effort, ageDays: ageDays });

    // Quick wins: Small effort + High priority + still pending
    if (effort === 'Small' && priority === 'High' && status === 'Pending Review' && !notes.includes('[Program Manager] Quick win')) {
      quickWins.push({ rowNum: i + 1, id: id, task: task });
    }
    // Stale pending: sitting in review beyond threshold
    if (status === 'Pending Review' && ageDays > pendingStaleThreshold && !notes.includes('[Program Manager] Stale')) {
      stalePending.push({ rowNum: i + 1, id: id, task: task, ageDays: ageDays });
    }
    // Drifting in progress: no movement for too long
    if (status === 'In Progress' && ageDays > inProgressDriftDays && !notes.includes('[Program Manager] Drift')) {
      drifting.push({ rowNum: i + 1, id: id, task: task, ageDays: ageDays });
    }
  }

  quickWins.forEach(function(item) {
    const noteCell = taskSheet.getRange(item.rowNum, TASK_COL.NOTES);
    const current  = String(data[item.rowNum - 1][TASK_COL.NOTES - 1] || '');
    const note     = '[Program Manager] Quick win — small effort, high priority. Action today.';
    noteCell.setValue(current ? current + ' | ' + note : note);
  });

  stalePending.forEach(function(item) {
    const noteCell = taskSheet.getRange(item.rowNum, TASK_COL.NOTES);
    const current  = String(data[item.rowNum - 1][TASK_COL.NOTES - 1] || '');
    const note     = '[Program Manager] Stale ' + item.ageDays + 'd in review — approve, reject, or reassign.';
    noteCell.setValue(current ? current + ' | ' + note : note);
  });

  drifting.forEach(function(item) {
    const noteCell = taskSheet.getRange(item.rowNum, TASK_COL.NOTES);
    const current  = String(data[item.rowNum - 1][TASK_COL.NOTES - 1] || '');
    const note     = '[Program Manager] Drift — in progress ' + item.ageDays + 'd. Check for blockers or reassign.';
    noteCell.setValue(current ? current + ' | ' + note : note);
  });

  // Only call Claude if there is something worth summarising — skip the API call on clean days
  if (quickWins.length + stalePending.length + drifting.length > 0) {
    const digest = generateTaskQueueDigest_(taskSummary, quickWins, stalePending, drifting, config);
    Logger.log('Program Manager — today\'s digest: ' + digest);
  } else {
    Logger.log('Program Manager: queue is clean — no Claude call needed.');
  }

  Logger.log('Program Manager: ' + quickWins.length + ' quick win(s), ' + stalePending.length + ' stale pending, ' + drifting.length + ' drifting.');
}

function generateTaskQueueDigest_(taskSummary, quickWins, stalePending, drifting, config) {
  const lines = [];
  if (quickWins.length > 0)    lines.push('Quick wins (' + quickWins.length + '): '   + quickWins.map(function(t)    { return t.task.substring(0, 50); }).join('; '));
  if (stalePending.length > 0) lines.push('Stale pending (' + stalePending.length + '): ' + stalePending.map(function(t) { return t.task.substring(0, 40) + ' (' + t.ageDays + 'd)'; }).join('; '));
  if (drifting.length > 0)     lines.push('Drifting (' + drifting.length + '): '      + drifting.map(function(t)    { return t.task.substring(0, 40) + ' (' + t.ageDays + 'd)'; }).join('; '));

  const allTasksText = taskSummary.map(function(t) {
    return '- [' + t.id + '] ' + t.status + ' | ' + t.priority + ' priority | ' + t.effort + ' effort | ' + t.ageDays + 'd old | ' + t.task.substring(0, 60);
  }).join('\n');

  const prompt = `You are Program Manager for a Chief of Staff system. Here is today's task queue review:

FLAGGED ITEMS:
${lines.join('\n')}

ALL ACTIVE TASKS:
${allTasksText}

Write one sharp sentence (max 160 chars) naming the single most important action the owner should take on their task queue today. Be specific — name the task or pattern, not a generic observation.`;

  try {
    // Haiku: one sentence daily digest — cheapest model appropriate
    return callClaude_(prompt, config, { model: 'claude-haiku-4-5-20251001', maxTokens: 192 });
  } catch (e) {
    return 'Program Manager digest unavailable: ' + e.message.substring(0, 60);
  }
}

// ============================================================
// SLACK RELAY
// Accept requests from a trusted relay rather than Slack directly.
// ============================================================

function handleRelayRequest_(payload) {
  const config = validateConfig_(['SPREADSHEET_ID', 'ANTHROPIC_KEY', 'SLACK_RELAY_SECRET']);

  if (!payload || payload.relaySecret !== config.SLACK_RELAY_SECRET) {
    throw new Error('Unauthorized relay request.');
  }

  if (payload.type === 'slack_message') {
    enforceSlackChannelPolicy_(payload, config);
    return handleChannelMessageRelay_(payload, config, {
      platform: 'Slack',
      source: 'Slack',
      channel: payload.channelId || '',
      user: payload.userName || payload.userId || '',
      threadId: payload.threadTs || payload.messageTs || '',
    });
  }

  if (payload.type === 'telegram_message') {
    enforceTelegramChatPolicy_(payload, config);
    return handleChannelMessageRelay_(payload, config, {
      platform: 'Telegram',
      source: 'Telegram',
      channel: payload.chatId || '',
      user: payload.userName || payload.userId || '',
      threadId: '',
    });
  }

  if (payload.type === 'whatsapp_message') {
    enforceWhatsAppSenderPolicy_(payload, config);
    return handleChannelMessageRelay_(payload, config, {
      platform: 'WhatsApp',
      source: 'WhatsApp',
      channel: payload.senderId || '',
      user: payload.userName || payload.senderId || '',
      threadId: '',
    });
  }

  if (payload.type !== 'slack_message' && payload.type !== 'telegram_message' && payload.type !== 'whatsapp_message') {
    return jsonResponse_({ ok: true, ignored: true });
  }
}

function handleChannelMessageRelay_(payload, config, metadata) {
  const prompt = String(payload.text || '').trim();
  if (!prompt) {
    return jsonResponse_({
      ok: false,
      error: `${metadata.platform} message was empty.`,
    });
  }

  const artifactRows = buildChannelArtifactContextRows_(payload, metadata.platform);
  const outcome = processChannelConversation_(config, metadata, prompt, artifactRows);
  const reply = outcome.reply;

  if (metadata.platform === 'Slack' && metadata.channel && config.SLACK_BOT_TOKEN) {
    postSlackMessage_(config, metadata.channel, reply, metadata.threadId || '');
  }
  if (metadata.platform === 'Telegram' && metadata.channel && config.TELEGRAM_BOT_TOKEN) {
    postTelegramMessage_(config, metadata.channel, reply);
  }
  if (metadata.platform === 'WhatsApp' && metadata.channel && config.WHATSAPP_TOKEN && config.WHATSAPP_PHONE_NUMBER_ID) {
    postWhatsAppMessage_(config, metadata.channel, reply);
  }

  return jsonResponse_({
    ok: true,
    reply: reply,
    importantContextLogged: outcome.importantCount,
    rowsAdded: outcome.rowsAdded,
  });
}

function processChannelConversation_(config, metadata, prompt, artifactRows) {
  const reply = generateChiefOfStaffReply_(prompt, config, {
    platform: metadata.platform,
    source: metadata.source,
    channel: metadata.channel,
    userName: metadata.user,
  });

  const extracted = extractImportantContextFromConversation_(prompt, reply, metadata, config);
  const conversationRows = buildConversationContextRows_(prompt, reply, metadata, extracted);
  const allRows = (artifactRows || []).concat(conversationRows);
  const rowsAdded = appendContextRowsIfMissing_(config, allRows);
  const contextIds = allRows.map(function(row) { return row[COL.ID - 1]; }).filter(Boolean);

  if (contextIds.length > 0) {
    logSlackConversation_(config, {
      source: metadata.source,
      channel: metadata.channel,
      user: metadata.user,
      summary: extracted.summary || buildFallbackConversationSummary_(prompt, metadata),
      status: 'Important context logged',
      notes: buildConversationNotes_(extracted, contextIds, artifactRows || []),
      processedAt: new Date().toISOString(),
    });
  }

  return {
    reply: reply,
    importantCount: allRows.length,
    rowsAdded: rowsAdded,
  };
}

function generateChiefOfStaffReply_(prompt, config, metadata) {
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const contextSheet = ss.getSheetByName(SHEET.CONTEXT);
  const taskSheet = ss.getSheetByName(SHEET.TASKS);

  if (!contextSheet || !taskSheet) {
    throw new Error('Required sheets not found for Slack response generation.');
  }

  const contextRows    = readContextStore_(contextSheet);
  const taskRows       = readTaskStore_(taskSheet);
  // Pass the user's message so context is filtered by relevance, not just recency
  const contextSummary = buildContextSummaryForChat_(contextRows, prompt);
  const taskSummary    = buildTaskSummaryForChat_(taskRows, prompt);

  const conversationContext = [
    `Source: ${metadata.source || 'Slack'}`,
    `Channel: ${metadata.channel || 'unknown'}`,
    `User: ${metadata.userName || 'unknown'}`,
  ].join('\n');

  const agentPrompt = `You are the Chief of Staff agent speaking in Slack.

Your job:
- answer clearly and concisely
- stay grounded in the current context store and proposed task list
- if a question asks for action, suggest the next best step
- if the context is insufficient, say what is missing
- avoid pretending external work already happened

${conversationContext}

CURRENT CONTEXT SNAPSHOT:
${contextSummary}

CURRENT TASK SNAPSHOT:
${taskSummary}

USER MESSAGE:
${prompt}

Return plain text only. Keep it concise but useful for Slack.`;

  // Sonnet: conversational replies are user-facing — quality matters here
  return callClaude_(agentPrompt, config, { model: 'claude-sonnet-4-6', maxTokens: 768 });
}

function readTaskStore_(sheet) {
  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[TASK_COL.ID - 1]) continue;
    rows.push({
      id: row[TASK_COL.ID - 1],
      task: row[TASK_COL.TASK - 1],
      contextIds: row[TASK_COL.CONTEXT_IDS - 1],
      priority: row[TASK_COL.PRIORITY - 1],
      effort: row[TASK_COL.EFFORT - 1],
      status: row[TASK_COL.STATUS - 1],
      createdAt: row[TASK_COL.CREATED_AT - 1],
      reviewedAt: row[TASK_COL.REVIEWED_AT - 1],
      notes: row[TASK_COL.NOTES - 1],
    });
  }
  return rows;
}

// Scores context rows by keyword overlap with the user's message.
// Intents always included (they're the anchor). Everything else ranked by relevance.
function buildContextSummaryForChat_(rows, userMessage) {
  if (rows.length === 0) return '(no context rows yet)';

  const queryWords = userMessage ? extractKeywords_(userMessage) : [];
  const intents    = rows.filter(function(r) { return r.type === 'Intent'; });

  const rest = rows
    .filter(function(r) { return r.type !== 'Intent'; })
    .map(function(r) {
      let score = 0;
      if (queryWords.length > 0) {
        const rowWords = extractKeywords_(r.summary + ' ' + (r.details || ''));
        queryWords.forEach(function(w) { if (rowWords.indexOf(w) !== -1) score++; });
      }
      // Recency bonus: rows created in the last 7 days
      const ageDays = (Date.now() - new Date(r.createdAt).getTime()) / 86400000;
      if (ageDays < 7)  score += 2;
      if (ageDays < 2)  score += 1;
      if (r.confidence === 'High') score += 1;
      return { row: r, score: score };
    })
    .sort(function(a, b) { return b.score - a.score; })
    .slice(0, 10) // top 10 non-intent rows (was 15 undifferentiated)
    .map(function(s) { return s.row; });

  const selected = intents.concat(rest);
  return selected.map(function(row) {
    return '- [' + row.id + '] ' + row.type + ' | ' + row.summary + ' | ' + (row.confidence || 'n/a') + ' | Intent: ' + (row.linkedIntent || 'none');
  }).join('\n');
}

function buildTaskSummaryForChat_(rows, userMessage) {
  if (rows.length === 0) return '(no tasks yet)';

  const queryWords = userMessage ? extractKeywords_(userMessage) : [];
  const active     = rows.filter(function(r) { return r.status !== 'Done' && r.status !== 'Rejected'; });

  const scored = active.map(function(r) {
    let score = 0;
    if (queryWords.length > 0) {
      const taskWords = extractKeywords_(r.task);
      queryWords.forEach(function(w) { if (taskWords.indexOf(w) !== -1) score++; });
    }
    if (r.priority === 'High')            score += 2;
    if (r.status === 'In Progress')       score += 1;
    if (r.status === 'Pending Review')    score += 1;
    return { row: r, score: score };
  });
  scored.sort(function(a, b) { return b.score - a.score; });

  return scored.slice(0, 8).map(function(s) { // top 8 relevant (was last-10 by recency)
    return '- [' + s.row.id + '] ' + s.row.status + ' | ' + s.row.task + ' | ' + (s.row.priority || 'n/a');
  }).join('\n');
}

function buildChannelArtifactContextRows_(payload, platform) {
  if (platform === 'Slack') return buildSlackArtifactContextRows_(payload);
  if (platform === 'Telegram') return buildTelegramArtifactContextRows_(payload);
  if (platform === 'WhatsApp') return buildWhatsAppArtifactContextRows_(payload);
  return [];
}

function buildSlackArtifactContextRows_(payload) {
  const rows = [];
  const artifacts = normalizeSlackArtifacts_(payload);
  const baseTimestamp = payload.messageTs || String(new Date().getTime());

  artifacts.forEach((item, index) => {
    rows.push(buildSlackContextRow_({
      id: item.id || `slack-artifact-${payload.channelId || 'unknown'}-${baseTimestamp}-${index}`,
      summary: item.kind === 'image'
        ? `Slack image shared: ${item.name || 'Untitled image'}`
        : `Slack file shared: ${item.name || 'Untitled file'}`,
      details: [
        `User: ${payload.userName || payload.userId || 'unknown'}`,
        `Channel: ${payload.channelId || 'unknown'}`,
        `Type: ${item.mimeType || item.kind || 'file'}`,
        `URL: ${item.url || ''}`,
        `Caption: ${item.caption || payload.text || ''}`,
      ].join(' | '),
    }));
  });

  if (payload.text && payload.ingestMessageAsSignal) {
    rows.push(buildSlackContextRow_({
      id: `slack-msg-${payload.channelId || 'unknown'}-${baseTimestamp}`,
      summary: `Slack update from ${payload.userName || payload.userId || 'teammate'}`,
      details: `Channel: ${payload.channelId || 'unknown'} | Message: ${payload.text}`,
    }));
  }

  return rows;
}

function buildTelegramArtifactContextRows_(payload) {
  const rows = [];
  const artifacts = normalizeTelegramArtifacts_(payload);
  const baseTimestamp = payload.messageTs || String(new Date().getTime());

  artifacts.forEach((item, index) => {
    rows.push(buildChannelContextRow_({
      id: item.id || `telegram-artifact-${payload.chatId || 'unknown'}-${baseTimestamp}-${index}`,
      source: 'Telegram',
      summary: `${item.kind === 'image' ? 'Telegram image shared' : 'Telegram file shared'}: ${item.name || 'Untitled artifact'}`,
      details: [
        `User: ${payload.userName || payload.userId || 'unknown'}`,
        `Chat: ${payload.chatId || 'unknown'}`,
        `Type: ${item.mimeType || item.kind || 'file'}`,
        `File ID: ${item.fileId || ''}`,
        `Caption: ${item.caption || payload.text || ''}`,
      ].join(' | '),
    }));
  });

  return rows;
}

function buildWhatsAppArtifactContextRows_(payload) {
  const rows = [];
  const artifacts = normalizeWhatsAppArtifacts_(payload);
  const baseTimestamp = payload.messageId || String(new Date().getTime());

  artifacts.forEach((item, index) => {
    rows.push(buildChannelContextRow_({
      id: item.id || `whatsapp-artifact-${payload.senderId || 'unknown'}-${baseTimestamp}-${index}`,
      source: 'WhatsApp',
      summary: `${item.kind === 'image' ? 'WhatsApp image shared' : 'WhatsApp file shared'}: ${item.name || 'Untitled artifact'}`,
      details: [
        `User: ${payload.userName || payload.senderId || 'unknown'}`,
        `Sender: ${payload.senderId || 'unknown'}`,
        `Type: ${item.mimeType || item.kind || 'file'}`,
        `Media ID: ${item.mediaId || ''}`,
        `Caption: ${item.caption || payload.text || ''}`,
      ].join(' | '),
    }));
  });

  return rows;
}

function normalizeSlackArtifacts_(payload) {
  const files = Array.isArray(payload.files) ? payload.files : [];
  return files.map(file => ({
    id: file.id ? `slack-file-${file.id}` : '',
    name: file.name || file.title || '',
    mimeType: file.mimetype || file.mimeType || '',
    url: file.url_private_download || file.url_private || file.url || '',
    kind: isSlackImage_(file) ? 'image' : 'file',
    caption: file.initial_comment ? file.initial_comment.comment || '' : '',
  }));
}

function normalizeTelegramArtifacts_(payload) {
  const artifacts = [];

  if (payload.photo && Array.isArray(payload.photo) && payload.photo.length > 0) {
    const lastPhoto = payload.photo[payload.photo.length - 1];
    artifacts.push({
      id: lastPhoto.file_id ? `telegram-file-${lastPhoto.file_id}` : '',
      name: 'telegram-photo',
      mimeType: 'image/jpeg',
      fileId: lastPhoto.file_id || '',
      kind: 'image',
      caption: payload.caption || '',
    });
  }

  if (payload.document) {
    artifacts.push({
      id: payload.document.file_id ? `telegram-file-${payload.document.file_id}` : '',
      name: payload.document.file_name || 'telegram-document',
      mimeType: payload.document.mime_type || '',
      fileId: payload.document.file_id || '',
      kind: 'file',
      caption: payload.caption || '',
    });
  }

  if (payload.voice) {
    artifacts.push({
      id: payload.voice.file_id ? `telegram-file-${payload.voice.file_id}` : '',
      name: 'telegram-voice-note',
      mimeType: payload.voice.mime_type || 'audio/ogg',
      fileId: payload.voice.file_id || '',
      kind: 'audio',
      caption: payload.caption || '',
    });
  }

  return artifacts;
}

function normalizeWhatsAppArtifacts_(payload) {
  const artifacts = [];

  if (payload.image) {
    artifacts.push({
      id: payload.image.id ? `whatsapp-media-${payload.image.id}` : '',
      name: payload.image.caption || 'whatsapp-image',
      mimeType: payload.image.mime_type || 'image/jpeg',
      mediaId: payload.image.id || '',
      kind: 'image',
      caption: payload.image.caption || payload.text || '',
    });
  }

  if (payload.document) {
    artifacts.push({
      id: payload.document.id ? `whatsapp-media-${payload.document.id}` : '',
      name: payload.document.filename || 'whatsapp-document',
      mimeType: payload.document.mime_type || '',
      mediaId: payload.document.id || '',
      kind: 'file',
      caption: payload.document.caption || payload.text || '',
    });
  }

  if (payload.audio) {
    artifacts.push({
      id: payload.audio.id ? `whatsapp-media-${payload.audio.id}` : '',
      name: 'whatsapp-audio',
      mimeType: payload.audio.mime_type || '',
      mediaId: payload.audio.id || '',
      kind: 'audio',
      caption: payload.text || '',
    });
  }

  return artifacts;
}

function isSlackImage_(file) {
  const type = String(file.mimetype || file.mimeType || '');
  return type.indexOf('image/') === 0;
}

function buildSlackContextRow_(item) {
  return buildChannelContextRow_(Object.assign({}, item, { source: 'Slack' }));
}

function buildChannelContextRow_(item) {
  const now = new Date().toISOString();
  return [
    item.id,
    item.type || 'Signal',
    item.source || 'Signal',
    item.summary,
    item.confidence || 'Medium',
    '',
    'Team',
    'No',
    '—',
    now,
    item.details,
  ];
}

function buildConversationContextRows_(prompt, reply, metadata, extracted) {
  if (!extracted || !Array.isArray(extracted.items) || extracted.items.length === 0) {
    return [];
  }

  return extracted.items
    .filter(function(item) { return item && item.type && item.type !== 'None'; })
    .map(function(item, index) {
      const normalizedType = normalizeContextType_(item.type);
      const detailsParts = [
        `Source: ${metadata.source || metadata.platform || 'Channel'}`,
        `User: ${metadata.user || 'unknown'}`,
        `Channel: ${metadata.channel || 'unknown'}`,
        item.details ? `Why it matters: ${item.details}` : '',
        item.quote ? `Key quote: ${item.quote}` : '',
        `Prompt excerpt: ${prompt.substring(0, 200)}`,
        `Reply excerpt: ${reply.substring(0, 200)}`,
      ].filter(Boolean);

      return buildChannelContextRow_({
        id: buildConversationContextId_(metadata, normalizedType, item.summary, index),
        source: metadata.source || metadata.platform || 'Channel',
        summary: item.summary || `${metadata.platform || 'Channel'} update`,
        details: detailsParts.join(' | '),
        type: normalizedType,
        confidence: normalizeConfidence_(item.confidence),
      });
    });
}

function buildConversationContextId_(metadata, type, summary, index) {
  const seed = [
    metadata.platform || metadata.source || 'channel',
    metadata.channel || 'unknown',
    metadata.user || 'unknown',
    type || 'Signal',
    summary || '',
    String(index || 0),
  ].join('|');
  return 'msg-' + simpleHash_(seed);
}

function normalizeContextType_(value) {
  const raw = String(value || 'Signal').trim().toLowerCase();
  if (raw === 'intent') return 'Intent';
  if (raw === 'decision') return 'Decision';
  if (raw === 'constraint') return 'Constraint';
  if (raw === 'learning') return 'Learning';
  return 'Signal';
}

function normalizeConfidence_(value) {
  const raw = String(value || 'Medium').trim().toLowerCase();
  if (raw === 'high') return 'High';
  if (raw === 'low') return 'Low';
  return 'Medium';
}

function extractImportantContextFromConversation_(prompt, reply, metadata, config) {
  const analysisPrompt = `You are Intake Lead for a Chief of Staff system.

Decide whether the user's message contains IMPORTANT CONTEXT that should be promoted into the shared context store.

IMPORTANT CONTEXT means one or more of:
- a new goal or intent
- a decision that was made
- a hard constraint or non-negotiable
- a meaningful learning
- a significant signal, blocker, risk, request, or priority change

DO NOT log casual chatter, acknowledgements, low-signal back-and-forth, or routine conversation that does not change priorities.

CHANNEL:
${metadata.platform || metadata.source || 'Channel'}
USER:
${metadata.user || 'unknown'}

MESSAGE:
${prompt}

COs REPLY:
${reply}

Return JSON only, no prose:
{
  "summary": "short summary of the important context, or empty string",
  "items": [
    {
      "type": "Intent | Decision | Constraint | Learning | Signal",
      "summary": "max 120 chars",
      "details": "why this matters, max 220 chars",
      "confidence": "High | Medium | Low",
      "quote": "optional short verbatim quote from the user, max 120 chars"
    }
  ]
}

Rules:
- Return {"summary":"","items":[]} if nothing important should be logged
- Keep at most 3 items
- Prefer Decision / Constraint / Learning / Intent over generic Signal when justified
- Quote only the most important phrase, not the whole message`;

  try {
    const response = callClaude_(analysisPrompt, config, { model: 'claude-haiku-4-5-20251001', maxTokens: 700 });
    const parsed = parseClaudeJsonObject_(response);
    if (!parsed || !Array.isArray(parsed.items)) {
      return { summary: '', items: [] };
    }
    return {
      summary: String(parsed.summary || '').trim(),
      items: parsed.items.slice(0, 3),
    };
  } catch (e) {
    Logger.log('Channel context extraction error: ' + e.message);
    return buildFallbackImportantContext_(prompt);
  }
}

function buildFallbackImportantContext_(prompt) {
  const text = String(prompt || '').trim();
  if (!text) return { summary: '', items: [] };

  const lower = text.toLowerCase();
  if (lower.indexOf('decided') !== -1 || lower.indexOf('decision') !== -1) {
    return {
      summary: 'Decision mentioned in channel conversation',
      items: [{
        type: 'Decision',
        summary: truncateText_(text, 120),
        details: 'Captured from channel message because it appears to record a decision.',
        confidence: 'Medium',
        quote: truncateText_(text, 120),
      }],
    };
  }
  if (lower.indexOf('must') !== -1 || lower.indexOf("can't") !== -1 || lower.indexOf('cannot') !== -1) {
    return {
      summary: 'Constraint mentioned in channel conversation',
      items: [{
        type: 'Constraint',
        summary: truncateText_(text, 120),
        details: 'Captured from channel message because it appears to describe a hard constraint.',
        confidence: 'Medium',
        quote: truncateText_(text, 120),
      }],
    };
  }
  if (lower.indexOf('goal') !== -1 || lower.indexOf('north star') !== -1) {
    return {
      summary: 'Goal or intent mentioned in channel conversation',
      items: [{
        type: 'Intent',
        summary: truncateText_(text, 120),
        details: 'Captured from channel message because it appears to describe a goal or intent.',
        confidence: 'Medium',
        quote: truncateText_(text, 120),
      }],
    };
  }

  return { summary: '', items: [] };
}

function buildFallbackConversationSummary_(prompt, metadata) {
  return `${metadata.platform || metadata.source || 'Channel'} context from ${metadata.user || 'teammate'}`;
}

function buildConversationNotes_(extracted, contextIds, artifactRows) {
  const notes = [];
  if (contextIds.length > 0) notes.push('Context IDs: ' + contextIds.join(', '));
  const quotes = (extracted.items || [])
    .map(function(item) { return item.quote ? `"${truncateText_(item.quote, 120)}"` : ''; })
    .filter(Boolean);
  if (quotes.length > 0) notes.push('Key quotes: ' + quotes.join(' | '));
  if (artifactRows && artifactRows.length > 0) notes.push('Artifacts captured: ' + artifactRows.length);
  return notes.join(' || ');
}

function truncateText_(text, maxLen) {
  const value = String(text || '').trim();
  if (value.length <= maxLen) return value;
  return value.substring(0, Math.max(0, maxLen - 1)).trim() + '…';
}

function enforceSlackChannelPolicy_(payload, config) {
  const allowed = getAllowedSlackChannels_(config);
  if (allowed.length === 0) return;

  const channelId = String(payload.channelId || '');
  if (!allowed.includes(channelId)) {
    throw new Error(`Channel ${channelId} is not allowed for Slack conversations.`);
  }
}

function enforceTelegramChatPolicy_(payload, config) {
  const allowed = getAllowedTelegramChats_(config);
  if (allowed.length === 0) return;

  const chatId = String(payload.chatId || '');
  if (!allowed.includes(chatId)) {
    throw new Error(`Telegram chat ${chatId} is not allowed for conversations.`);
  }
}

function enforceWhatsAppSenderPolicy_(payload, config) {
  const allowed = getAllowedWhatsAppSenders_(config);
  if (allowed.length === 0) return;

  const senderId = String(payload.senderId || '');
  if (!allowed.includes(senderId)) {
    throw new Error(`WhatsApp sender ${senderId} is not allowed for conversations.`);
  }
}

function getAllowedSlackChannels_(config) {
  const raw = config.SLACK_ALLOWED_CHANNELS || '';
  return String(raw)
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

function getAllowedTelegramChats_(config) {
  const raw = config.TELEGRAM_ALLOWED_CHATS || '';
  return String(raw)
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

function getAllowedWhatsAppSenders_(config) {
  const raw = config.WHATSAPP_ALLOWED_SENDERS || '';
  return String(raw)
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

function logSlackConversation_(config, item) {
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = ensureSlackInboxSheet_(ss);
  ensureSlackInboxHeaders_(sheet);
  sheet.appendRow([
    new Date().toISOString(),
    item.source || 'Slack',
    item.channel || '',
    item.user || '',
    item.summary || '',
    item.status || 'Important context logged',
    item.notes || '',
    item.processedAt || '',
  ]);
}

function ensureSlackInboxSheet_(ss) {
  let sheet = ss.getSheetByName(SHEET.SLACK);
  if (sheet) {
    ensureSlackInboxHeaders_(sheet);
    return sheet;
  }

  const legacySheet = ss.getSheetByName(LEGACY_SHEET.SLACK);
  if (legacySheet) {
    legacySheet.setName(SHEET.SLACK);
    ensureSlackInboxHeaders_(legacySheet);
    return legacySheet;
  }

  sheet = ss.insertSheet(SHEET.SLACK);
  sheet.appendRow(SLACK_INBOX_HEADERS);
  sheet.setFrozenRows(1);
  return sheet;
}

function ensureSlackInboxHeaders_(sheet) {
  const current = sheet.getRange(1, 1, 1, SLACK_INBOX_HEADERS.length).getValues()[0];
  const firstHeader = String(current[0] || '').trim();
  if (!firstHeader || firstHeader === 'Queued At' || firstHeader === 'Logged At') {
    sheet.getRange(1, 1, 1, SLACK_INBOX_HEADERS.length).setValues([SLACK_INBOX_HEADERS]);
  }
}

function postSlackMessage_(config, channelId, text, threadTs) {
  const payload = {
    channel: channelId,
    text: text,
  };

  if (threadTs) {
    payload.thread_ts = threadTs;
  }

  const response = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${config.SLACK_BOT_TOKEN}`,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const data = parseJsonResponse_(response, 'Slack');
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error || 'unknown_error'}`);
  }
}

function postTelegramMessage_(config, chatId, text) {
  const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: chatId,
      text: text,
    }),
    muteHttpExceptions: true,
  });

  const data = parseJsonResponse_(response, 'Telegram');
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description || 'unknown_error'}`);
  }
}

function postWhatsAppMessage_(config, recipientId, text) {
  const url = `https://graph.facebook.com/v23.0/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${config.WHATSAPP_TOKEN}`,
    },
    payload: JSON.stringify({
      messaging_product: 'whatsapp',
      to: recipientId,
      type: 'text',
      text: { body: text },
    }),
    muteHttpExceptions: true,
  });

  parseJsonResponse_(response, 'WhatsApp');
}

function ensureBriefingsSheet_(ss) {
  let sheet = ss.getSheetByName(SHEET.BRIEFINGS);
  if (sheet) return sheet;

  sheet = ss.insertSheet(SHEET.BRIEFINGS);
  sheet.appendRow(['Generated At', 'Period', 'Context Summary', 'Task Summary', 'Highlights', 'Notes']);
  sheet.setFrozenRows(1);
  return sheet;
}

// ============================================================
// ANTHROPIC API HELPER
// ============================================================

// options: { model, maxTokens }
// Defaults to Haiku (cheapest) — call sites that need reasoning override to Sonnet.
function callClaude_(prompt, config, options) {
  const model     = (options && options.model)     || 'claude-haiku-4-5-20251001';
  const maxTokens = (options && options.maxTokens) || 512;

  const payload = {
    model: model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key':         config.ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code !== 200) {
    throw new Error(`Anthropic API returned ${code}: ${body.substring(0, 200)}`);
  }

  const data = JSON.parse(body);
  return data.content[0].text;
}

function parseClaudeJsonObject_(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw e;
    return JSON.parse(match[0]);
  }
}

// ============================================================
// CONFIG HELPERS
// ============================================================

function showSetupChecklist() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const required = ['SPREADSHEET_ID', 'ANTHROPIC_KEY'];
  const enabledSources = getEnabledSources_(props);
  const sourceMissing = [];

  if (enabledSources.includes('github')) {
    sourceMissing.push.apply(sourceMissing, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'].filter(key => !props[key] || String(props[key]).startsWith('YOUR_')));
  }
  if (enabledSources.includes('notion')) {
    sourceMissing.push.apply(sourceMissing, ['NOTION_TOKEN'].filter(key => !props[key] || String(props[key]).startsWith('YOUR_')));
  }
  if (enabledSources.includes('smartsheet')) {
    sourceMissing.push.apply(sourceMissing, ['SMARTSHEET_TOKEN'].filter(key => !props[key] || String(props[key]).startsWith('YOUR_')));
  }
  if (enabledSources.includes('onedrive')) {
    sourceMissing.push.apply(sourceMissing, ['ONEDRIVE_TOKEN'].filter(key => !props[key] || String(props[key]).startsWith('YOUR_')));
  }
  if (enabledSources.includes('gmail')) {
    sourceMissing.push.apply(sourceMissing, []);
  }
  if (props.SLACK_RELAY_SECRET && String(props.SLACK_RELAY_SECRET).startsWith('YOUR_')) {
    sourceMissing.push('SLACK_RELAY_SECRET');
  }

  const missing = required
    .filter(key => !props[key] || String(props[key]).startsWith('YOUR_'))
    .concat(sourceMissing);

  Logger.log('Chief of Staff setup checklist');
  Logger.log(`Enabled sources: ${enabledSources.join(', ') || '(none)'}`);
  Logger.log(`Spreadsheet ID: ${props.SPREADSHEET_ID || 'missing'}`);
  Logger.log(`Anthropic key: ${props.ANTHROPIC_KEY ? 'set' : 'missing'}`);
  Logger.log(`GitHub owner: ${props.GITHUB_OWNER || '(optional)'}`);
  Logger.log(`GitHub repo: ${props.GITHUB_REPO || '(optional)'}`);
  Logger.log(`GitHub token: ${props.GITHUB_TOKEN ? 'set' : '(optional)'}`);
  Logger.log(`Drive folder ID: ${props.DRIVE_FOLDER_ID || '(optional)'}`);
  Logger.log(`Notion token: ${props.NOTION_TOKEN ? 'set' : '(optional)'}`);
  Logger.log(`Smartsheet token: ${props.SMARTSHEET_TOKEN ? 'set' : '(optional)'}`);
  Logger.log(`OneDrive token: ${props.ONEDRIVE_TOKEN ? 'set' : '(optional)'}`);
  Logger.log(`Gmail label: ${props.GMAIL_LABEL || '(optional)'}`);
  Logger.log(`Gmail query: ${props.GMAIL_QUERY || '(optional)'}`);
  Logger.log(`Slack bot token: ${props.SLACK_BOT_TOKEN ? 'set' : '(optional)'}`);
  Logger.log(`Slack relay secret: ${props.SLACK_RELAY_SECRET ? 'set' : '(optional)'}`);
  Logger.log(`Slack allowed channels: ${props.SLACK_ALLOWED_CHANNELS || '(optional)'}`);
  Logger.log(`Telegram bot token: ${props.TELEGRAM_BOT_TOKEN ? 'set' : '(optional)'}`);
  Logger.log(`Telegram allowed chats: ${props.TELEGRAM_ALLOWED_CHATS || '(optional)'}`);
  Logger.log(`WhatsApp token: ${props.WHATSAPP_TOKEN ? 'set' : '(optional)'}`);
  Logger.log(`WhatsApp phone number ID: ${props.WHATSAPP_PHONE_NUMBER_ID || '(optional)'}`);
  Logger.log(`WhatsApp allowed senders: ${props.WHATSAPP_ALLOWED_SENDERS || '(optional)'}`);

  if (missing.length === 0) {
    Logger.log('All required script properties are configured.');
  } else {
    Logger.log('Missing script properties: ' + missing.join(', '));
    Logger.log('Add them in Apps Script -> Project Settings -> Script properties.');
  }

  try {
    refreshSetupDashboard();
    Logger.log('');
    Logger.log('✅ Setup Dashboard refreshed.');
  } catch (e) {
    Logger.log('Setup Dashboard refresh skipped: ' + e.message);
  }

  // ── North Star check ──────────────────────────────────────────
  // Agents run without a north star but produce lower-quality output.
  // This check tells the user exactly what to fill in.
  Logger.log('');
  Logger.log('── Company Profile (North Star) ──');
  if (!props.SPREADSHEET_ID || String(props.SPREADSHEET_ID).startsWith('YOUR_')) {
    Logger.log('Skipped — SPREADSHEET_ID not set yet.');
  } else {
    try {
      const ss           = SpreadsheetApp.openById(props.SPREADSHEET_ID);
      const profileSheet = ss.getSheetByName(SHEET.COMPANY_PROFILE);
      if (!profileSheet) {
        Logger.log('NOT FOUND — run setup() first to create the Company Profile tab.');
      } else {
        const profile = readCompanyProfile_(profileSheet);
        if (profileIsConfigured_(profile)) {
          Logger.log('Status: CONFIGURED');
          Logger.log('Mission: '          + (profile.mission        ? profile.mission.substring(0, 80)      : '(not set)'));
          Logger.log('Vision: '           + (profile.vision         ? profile.vision.substring(0, 80)       : '(not set)'));
          Logger.log('Annual Goals: '     + profile.annualGoals.length    + ' active');
          Logger.log('Quarterly Goals: '  + profile.quarterlyGoals.length + ' active');
          Logger.log('Anti-Goals: '       + profile.antiGoals.length      + ' active');
          Logger.log('Principles: '       + profile.principles.length     + ' active');
          if (profile.annualGoals.length === 0) {
            Logger.log('⚠  No Annual Goals set — Planning Lead cannot filter distractions. Add at least one Annual Goal.');
          }
        } else {
          Logger.log('Status: NOT CONFIGURED ← action required');
          Logger.log('');
          Logger.log('  The 🎯 Company Profile tab still contains placeholder rows.');
          Logger.log('  Until this is filled in:');
          Logger.log('    • Planning Lead cannot filter distractions or flag drift');
          Logger.log('    • Briefing Lead will omit the North Star Alignment section');
          Logger.log('    • Knowledge Manager cannot detect Intent drift');
          Logger.log('');
          Logger.log('  What to fill in (open the 🎯 Company Profile tab):');
          Logger.log('    1. Mission    — Why you exist and who you serve');
          Logger.log('    2. Vision     — Where you are in 3 years (concrete + directional)');
          Logger.log('    3. Annual Goal — OKR format: Objective + measurable Key Result. Add one row per goal.');
          Logger.log('    4. Anti-Goal  — Something you are explicitly NOT doing this year');
          Logger.log('  Quarterly Goals and Strategic Principles are recommended but optional.');
        }
      }
    } catch (e) {
      Logger.log('North Star check failed: ' + e.message);
    }
  }
}

function refreshSetupDashboard() {
  const config = getConfig_();

  if (!config.SPREADSHEET_ID || String(config.SPREADSHEET_ID).startsWith('YOUR_')) {
    throw new Error('SPREADSHEET_ID is not configured yet.');
  }

  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET.SETUP);

  if (!sheet) {
    throw new Error('Setup Dashboard tab not found. Re-run setup() to create it.');
  }

  const profileSheet = ss.getSheetByName(SHEET.COMPANY_PROFILE);
  const profile = profileSheet ? readCompanyProfile_(profileSheet) : null;
  const profileReady = !!profile && profileIsConfigured_(profile);
  const enabledSources = getEnabledSources_(config);

  const sourceRows = [
    buildFeatureRow_('GitHub intake', enabledSources.includes('github'), 'Now or later', 'Script properties: ENABLED_SOURCES + GITHUB_TOKEN + GITHUB_OWNER + GITHUB_REPO'),
    buildFeatureRow_('Gmail intake', enabledSources.includes('gmail'), 'Now or later', 'Script properties: ENABLED_SOURCES + optional GMAIL_LABEL / GMAIL_QUERY'),
    buildFeatureRow_('Google Drive intake', enabledSources.includes('google_drive'), 'Later', 'Script properties: ENABLED_SOURCES + optional DRIVE_FOLDER_ID / DRIVE_SHARED_DRIVE_ID'),
    buildFeatureRow_('Notion intake', enabledSources.includes('notion'), 'Later', 'Script properties: ENABLED_SOURCES + NOTION_TOKEN'),
    buildFeatureRow_('Smartsheet intake', enabledSources.includes('smartsheet'), 'Later', 'Script properties: ENABLED_SOURCES + SMARTSHEET_TOKEN'),
    buildFeatureRow_('OneDrive / O365 intake', enabledSources.includes('onedrive'), 'Later', 'Script properties: ENABLED_SOURCES + ONEDRIVE_TOKEN'),
  ];

  const slackEnabled = !!config.SLACK_BOT_TOKEN && !!config.SLACK_RELAY_SECRET;
  const telegramEnabled = !!config.TELEGRAM_BOT_TOKEN;
  const whatsappEnabled = !!config.WHATSAPP_TOKEN && !!config.WHATSAPP_PHONE_NUMBER_ID;
  const triggerStatuses = getSetupTriggerStatuses_();
  const automationReady = triggerStatuses.some(item => item.enabled);
  const knowledgeWatchReady = getKnowledgeWatchStatus_(ss);

  const requiredRows = [
    buildStatusRow_('Create the sheet via setup()', !!config.SPREADSHEET_ID && !String(config.SPREADSHEET_ID).startsWith('YOUR_'), 'Now', 'Apps Script editor'),
    buildStatusRow_('Fill in 🎯 Company Profile', profileReady, 'Now', 'Spreadsheet -> 🎯 Company Profile'),
    buildStatusRow_('Add ANTHROPIC_KEY', !!config.ANTHROPIC_KEY && !String(config.ANTHROPIC_KEY).startsWith('YOUR_'), 'Now', 'Apps Script -> Project Settings -> Script properties'),
    buildStatusRow_('Choose at least one source', enabledSources.length > 0, 'Now', 'Script properties -> ENABLED_SOURCES'),
  ];

  const optionalRows = []
    .concat(sourceRows)
    .concat([
      buildFeatureRow_('Slack channel', slackEnabled, 'Recommended first channel when ready', 'Slack relay + SLACK_BOT_TOKEN + SLACK_RELAY_SECRET'),
      buildFeatureRow_('Telegram channel', telegramEnabled, 'Later', 'Relay deployment + TELEGRAM_BOT_TOKEN'),
      buildFeatureRow_('WhatsApp channel', whatsappEnabled, 'Later', 'Relay deployment + WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID'),
      [ 'Office hours triggers', automationReady ? summarizeTriggerStatus_(triggerStatuses) : 'Missing', 'Now', 'Apps Script -> Triggers' ],
      [ 'Knowledge Watch', knowledgeWatchReady ? 'Configured' : 'Optional', 'After core setup works', 'Spreadsheet -> 🔍 Knowledge Watch' ],
    ]);

  const requiredDone = requiredRows.filter(row => row[1] === 'Ready').length;
  const optionalEnabled = optionalRows.filter(row => row[1] !== 'Optional' && row[1] !== 'Not enabled').length;

  const rows = [
    ['SETUP DASHBOARD', '', '', ''],
    ['Last refreshed', new Date().toISOString(), 'Any time', 'Run refreshSetupDashboard() or showSetupChecklist()'],
    ['Overall setup', requiredDone === requiredRows.length ? 'Core ready' : `${requiredDone}/${requiredRows.length} core steps done`, 'Now', 'Complete the remaining Required Now items'],
    ['Optional features enabled', String(optionalEnabled), 'Later', 'Enable only what you want'],
    ['', '', '', ''],
    ['REQUIRED NOW', '', '', ''],
  ].concat(requiredRows).concat([
    ['', '', '', ''],
    ['OPTIONAL LATER', '', '', ''],
  ]).concat(optionalRows);

  sheet.clearContents();
  sheet.getRange(1, 1, 1, 4).setValues([['Item', 'Status', 'When To Set Up', 'Where To Set It Up']]);
  sheet.getRange(1, 1, 1, 4)
    .setBackground('#17324d')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(10);

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

function buildStatusRow_(label, isReady, timing, location) {
  return [label, isReady ? 'Ready' : 'Pending', timing, location];
}

function buildFeatureRow_(label, isEnabled, timing, location) {
  return [label, isEnabled ? 'Enabled' : 'Not enabled', timing, location];
}

function getSetupTriggerStatuses_() {
  const desiredHandlers = [
    'scheduledIntakeLead',
    'scheduledPlanningLead',
    'scheduledDeliveryMonitor',
    'scheduledBriefingLead',
  ];

  const installed = ScriptApp.getProjectTriggers()
    .map(trigger => trigger.getHandlerFunction());

  return desiredHandlers.map(name => ({
    name: name,
    enabled: installed.includes(name),
  }));
}

function summarizeTriggerStatus_(statuses) {
  const enabledCount = statuses.filter(item => item.enabled).length;
  return enabledCount === statuses.length ? 'Configured' : `${enabledCount}/${statuses.length} installed`;
}

function getKnowledgeWatchStatus_(ss) {
  const sheet = ss.getSheetByName(SHEET.KNOWLEDGE_WATCH);
  if (!sheet) return false;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  return values.some(row => row[0] && String(row[5] || '').toLowerCase() === 'active');
}

function setFrameworkConfig() {
  saveFrameworkConfig_({
    ENABLED_SOURCES:     'github',
    GITHUB_TOKEN:        'YOUR_GITHUB_TOKEN',
    GITHUB_OWNER:        'YOUR_GITHUB_OWNER',
    GITHUB_REPO:         'YOUR_GITHUB_REPO',
    ANTHROPIC_KEY:       'YOUR_ANTHROPIC_API_KEY',
    DRIVE_FOLDER_ID:     '',
    DRIVE_SHARED_DRIVE_ID:'',
    NOTION_TOKEN:        '',
    NOTION_DATABASE_ID:  '',
    SMARTSHEET_TOKEN:    '',
    SMARTSHEET_SHEET_ID: '',
    ONEDRIVE_TOKEN:      '',
    ONEDRIVE_DRIVE_ID:   '',
    ONEDRIVE_FOLDER_ID:  '',
    GMAIL_QUERY:         '',
    GMAIL_LABEL:         '',
    SLACK_BOT_TOKEN:     '',
    SLACK_RELAY_SECRET:  '',
    SLACK_ALLOWED_CHANNELS: '',
    TELEGRAM_BOT_TOKEN:  '',
    TELEGRAM_ALLOWED_CHATS: '',
    WHATSAPP_TOKEN:      '',
    WHATSAPP_PHONE_NUMBER_ID: '',
    WHATSAPP_ALLOWED_SENDERS: '',
  });

  Logger.log('Template values saved to Script properties.');
  Logger.log('Open Project Settings and replace them with your real values before running the agents.');
  Logger.log('Use ENABLED_SOURCES as a comma-separated list, for example: github,google_drive,notion');
}

function getConfig_() {
  const props = PropertiesService.getScriptProperties().getProperties();
  return {
    ENABLED_SOURCES:       props[CONFIG_KEYS.ENABLED_SOURCES] || 'github',
    GITHUB_TOKEN:          props[CONFIG_KEYS.GITHUB_TOKEN] || '',
    GITHUB_OWNER:          props[CONFIG_KEYS.GITHUB_OWNER] || '',
    GITHUB_REPO:           props[CONFIG_KEYS.GITHUB_REPO] || '',
    ANTHROPIC_KEY:         props[CONFIG_KEYS.ANTHROPIC_KEY] || '',
    SPREADSHEET_ID:        props[CONFIG_KEYS.SPREADSHEET_ID] || '',
    DRIVE_FOLDER_ID:       props[CONFIG_KEYS.DRIVE_FOLDER_ID] || '',
    DRIVE_SHARED_DRIVE_ID: props[CONFIG_KEYS.DRIVE_SHARED_DRIVE_ID] || '',
    NOTION_TOKEN:          props[CONFIG_KEYS.NOTION_TOKEN] || '',
    NOTION_DATABASE_ID:    props[CONFIG_KEYS.NOTION_DATABASE_ID] || '',
    SMARTSHEET_TOKEN:      props[CONFIG_KEYS.SMARTSHEET_TOKEN] || '',
    SMARTSHEET_SHEET_ID:   props[CONFIG_KEYS.SMARTSHEET_SHEET_ID] || '',
    ONEDRIVE_TOKEN:        props[CONFIG_KEYS.ONEDRIVE_TOKEN] || '',
    ONEDRIVE_DRIVE_ID:     props[CONFIG_KEYS.ONEDRIVE_DRIVE_ID] || '',
    ONEDRIVE_FOLDER_ID:    props[CONFIG_KEYS.ONEDRIVE_FOLDER_ID] || '',
    GMAIL_QUERY:           props[CONFIG_KEYS.GMAIL_QUERY] || '',
    GMAIL_LABEL:           props[CONFIG_KEYS.GMAIL_LABEL] || '',
    SLACK_BOT_TOKEN:       props[CONFIG_KEYS.SLACK_BOT_TOKEN] || '',
    SLACK_RELAY_SECRET:    props[CONFIG_KEYS.SLACK_RELAY_SECRET] || '',
    SLACK_ALLOWED_CHANNELS:props[CONFIG_KEYS.SLACK_ALLOWED_CHANNELS] || '',
    TELEGRAM_BOT_TOKEN:    props[CONFIG_KEYS.TELEGRAM_BOT_TOKEN] || '',
    TELEGRAM_ALLOWED_CHATS:props[CONFIG_KEYS.TELEGRAM_ALLOWED_CHATS] || '',
    WHATSAPP_TOKEN:        props[CONFIG_KEYS.WHATSAPP_TOKEN] || '',
    WHATSAPP_PHONE_NUMBER_ID: props[CONFIG_KEYS.WHATSAPP_PHONE_NUMBER_ID] || '',
    WHATSAPP_ALLOWED_SENDERS: props[CONFIG_KEYS.WHATSAPP_ALLOWED_SENDERS] || '',
  };
}

function validateConfig_(requiredKeys) {
  const config = getConfig_();
  const required = requiredKeys || ['SPREADSHEET_ID', 'ANTHROPIC_KEY'];
  const missing = required.filter(key => !config[key] || String(config[key]).startsWith('YOUR_'));

  if (missing.length > 0) {
    throw new Error(
      'Missing required Script properties: ' +
      missing.join(', ') +
      '. Open Apps Script -> Project Settings -> Script properties, then run showSetupChecklist().'
    );
  }

  return config;
}

function getEnabledSources_(config) {
  const raw = config.ENABLED_SOURCES || '';
  return String(raw)
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
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

function parseJsonResponse_(response, providerName) {
  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error(`${providerName} API returned ${code}: ${body.substring(0, 200)}`);
  }

  return JSON.parse(body);
}

function parseWebRequestBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Missing request body.');
  }
  return e.postData.contents;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// END OF FILE
// ============================================================
// TRIGGER SETUP REMINDER:
// Extensions → Apps Script → Triggers → Add Trigger
//
// Core agents:
//   scheduledIntakeLead        -> Time-driven -> Hour timer  -> Every hour
//   scheduledPlanningLead      -> Time-driven -> Day timer   -> 8am
//   scheduledDeliveryMonitor   -> Time-driven -> Day timer   -> 9am
//   scheduledBriefingLead      -> Time-driven -> Week timer  -> Friday 4pm
//
// Reviewer agents:
//   scheduledResearchAnalyst   -> Time-driven -> Day timer   -> 7am   (or weekly)
//   scheduledEditorialDirector -> Time-driven -> Week timer  -> Friday 5pm (after Briefing Lead)
//   scheduledKnowledgeManager  -> Time-driven -> Week timer  -> Monday 8am
//   scheduledProgramManager    -> Time-driven -> Day timer   -> 8:30am
// ============================================================
