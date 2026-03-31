// ============================================================
// CHIEF OF STAFF — Task Runtime
// Task schema, task commands, reminders, and Gantt deck refresh.
// ============================================================

function scheduledTaskReminders() {
  runTaskReminders();
}

function scheduledTaskTimelineRefresh() {
  refreshTaskTimeline_();
}

function syncTaskToWorkspacesNow(taskId) {
  const config = validateConfig_(['SPREADSHEET_ID']);
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const taskSheet = ss.getSheetByName(SHEET.TASKS);
  if (!taskSheet) throw new Error('Proposed Tasks sheet not found.');
  ensureTaskSheetSchema_(taskSheet);

  const found = findTaskRowById_(taskSheet, taskId);
  if (!found) throw new Error('Task ' + normalizeTaskId_(taskId) + ' was not found.');

  syncTaskToWorkspaces_(config, taskSheet, found.rowNum);
}

function handleTaskCommand_(config, metadata, prompt) {
  const text = String(prompt || '').trim();
  if (!text) return { handled: false };

  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const taskSheet = ss.getSheetByName(SHEET.TASKS);
  if (!taskSheet) return { handled: false };
  ensureTaskSheetSchema_(taskSheet);

  let match = text.match(/^show\s+(T\d+)$/i) || text.match(/^task\s+(T\d+)$/i);
  if (match) {
    const found = findTaskRowById_(taskSheet, match[1]);
    return {
      handled: true,
      reply: found ? describeTaskRow_(found.row) : 'Task ' + normalizeTaskId_(match[1]) + ' was not found.',
    };
  }

  match = text.match(/^create task\s+(.+)$/i);
  if (match) {
    const taskText = match[1].trim();
    if (!taskText) {
      return { handled: true, reply: 'Create task needs a task description.' };
    }

    const taskId = createManualTask_(taskSheet, taskText, {
      owner: 'Chief of Staff',
      ownerChannel: buildOwnerChannel_(metadata.platform, metadata.channel),
      notes: '[Manual] Created from ' + metadata.source + ' by ' + (metadata.user || 'unknown'),
    });
    const created = findTaskRowById_(taskSheet, taskId);
    if (created) syncTaskToWorkspaces_(config, taskSheet, created.rowNum);
    refreshTaskTimeline_();
    return {
      handled: true,
      reply: 'Created [' + taskId + '] ' + taskText + ' and assigned it to Chief of Staff.',
    };
  }

  match = text.match(/^link\s+(T\d+)\s+to\s+(.+)$/i);
  if (match) {
    const found = findTaskRowById_(taskSheet, match[1]);
    if (!found) {
      return { handled: true, reply: 'Task ' + normalizeTaskId_(match[1]) + ' was not found.' };
    }
    const stakeholder = findStakeholderByNameOrId_(config, match[2]);
    if (!stakeholder) {
      return { handled: true, reply: 'No stakeholder matched "' + match[2].trim() + '".' };
    }
    addStakeholderLinkToTask_(taskSheet, found.rowNum, stakeholder.id);
    syncTaskToWorkspaces_(config, taskSheet, found.rowNum);
    return {
      handled: true,
      reply: 'Linked ' + normalizeTaskId_(match[1]) + ' to stakeholder ' + stakeholder.name + ' (' + stakeholder.id + ').',
    };
  }

  match = text.match(/^confirm\s+(T\d+)$/i);
  if (match) {
    const found = findTaskRowById_(taskSheet, match[1]);
    if (!found) {
      return { handled: true, reply: 'Task ' + normalizeTaskId_(match[1]) + ' was not found.' };
    }
    appendTaskNote_(taskSheet, found.rowNum, '[Confirmed] ' + new Date().toISOString() + ' by ' + (metadata.user || metadata.source || 'owner'));
    touchTaskUpdatedAt_(taskSheet, found.rowNum);
    syncTaskToWorkspaces_(config, taskSheet, found.rowNum);
    return {
      handled: true,
      reply: 'Confirmed ' + normalizeTaskId_(match[1]) + ' for Chief of Staff execution.',
    };
  }

  match = text.match(/^create doc for\s+(T\d+)$/i) || text.match(/^doc create\s+(T\d+)$/i);
  if (match) {
    const found = findTaskRowById_(taskSheet, match[1]);
    if (!found) {
      return { handled: true, reply: 'Task ' + normalizeTaskId_(match[1]) + ' was not found.' };
    }

    const gateMessage = getHumanConfirmationMessage_(found.row);
    if (gateMessage) {
      return { handled: true, reply: gateMessage };
    }

    const outcome = createTaskDocument_(taskSheet, found, metadata);
    syncTaskToWorkspaces_(config, taskSheet, found.rowNum);
    refreshTaskTimeline_();
    return {
      handled: true,
      reply: outcome.message,
    };
  }

  match = text.match(/^update doc\s+(T\d+)\s+with\s+([\s\S]+)$/i) || text.match(/^doc update\s+(T\d+)\s+([\s\S]+)$/i);
  if (match) {
    const found = findTaskRowById_(taskSheet, match[1]);
    if (!found) {
      return { handled: true, reply: 'Task ' + normalizeTaskId_(match[1]) + ' was not found.' };
    }

    const gateMessage = getHumanConfirmationMessage_(found.row);
    if (gateMessage) {
      return { handled: true, reply: gateMessage };
    }

    const outcome = appendToTaskDocument_(taskSheet, found, match[2].trim(), metadata);
    syncTaskToWorkspaces_(config, taskSheet, found.rowNum);
    refreshTaskTimeline_();
    return {
      handled: true,
      reply: outcome.message,
    };
  }

  match = text.match(/^(assign|reassign)\s+(T\d+)\s+to\s+(.+?)(?:\s+via\s+(slack|telegram|whatsapp):([A-Za-z0-9._:@\-]+))?$/i);
  if (match) {
    const found = findTaskRowById_(taskSheet, match[2]);
    if (!found) {
      return { handled: true, reply: 'Task ' + normalizeTaskId_(match[2]) + ' was not found.' };
    }

    const ownerInput = match[3].trim();
    let owner = ownerInput;
    let ownerChannel = match[4] && match[5] ? String(match[4]).toLowerCase() + ':' + match[5] : '';

    if (/^me$/i.test(ownerInput)) {
      owner = metadata.user || 'Current User';
      ownerChannel = buildOwnerChannel_(metadata.platform, metadata.channel);
    } else if (/^chief of staff$|^cos$/i.test(ownerInput)) {
      owner = 'Chief of Staff';
      if (!ownerChannel) ownerChannel = buildOwnerChannel_(metadata.platform, metadata.channel);
    } else {
      const stakeholder = findStakeholderByNameOrId_(config, ownerInput);
      if (stakeholder) addStakeholderLinkToTask_(taskSheet, found.rowNum, stakeholder.id);
    }

    taskSheet.getRange(found.rowNum, TASK_COL.OWNER).setValue(owner);
    taskSheet.getRange(found.rowNum, TASK_COL.OWNER_CHANNEL).setValue(ownerChannel);
    appendTaskNote_(taskSheet, found.rowNum, '[Assignment] ' + owner + ' via ' + (ownerChannel || 'manual'));
    touchTaskUpdatedAt_(taskSheet, found.rowNum);
    syncTaskToWorkspaces_(config, taskSheet, found.rowNum);
    refreshTaskTimeline_();

    return {
      handled: true,
      reply: 'Assigned ' + normalizeTaskId_(match[2]) + ' to ' + owner + (ownerChannel ? ' (' + ownerChannel + ')' : '') + '.',
    };
  }

  match = text.match(/^(?:set\s+)?(T\d+)\s+due\s+(.+)$/i) || text.match(/^(?:due|deadline)\s+(T\d+)\s+(?:to\s+)?(.+)$/i);
  if (match) {
    const found = findTaskRowById_(taskSheet, match[1]);
    if (!found) {
      return { handled: true, reply: 'Task ' + normalizeTaskId_(match[1]) + ' was not found.' };
    }

    const dueDate = normalizeDateInput_(match[2]);
    if (!dueDate) {
      return { handled: true, reply: 'Use due dates in YYYY-MM-DD format, for example: set T001 due 2026-04-02' };
    }

    taskSheet.getRange(found.rowNum, TASK_COL.DUE_DATE).setValue(dueDate);
    appendTaskNote_(taskSheet, found.rowNum, '[Due Date] ' + dueDate);
    touchTaskUpdatedAt_(taskSheet, found.rowNum);
    syncTaskToWorkspaces_(config, taskSheet, found.rowNum);
    refreshTaskTimeline_();

    return {
      handled: true,
      reply: 'Set ' + normalizeTaskId_(match[1]) + ' due date to ' + dueDate + '.',
    };
  }

  match = text.match(/^(?:status|set status|mark)\s+(T\d+)\s+(?:to\s+)?(.+)$/i);
  if (match) {
    const found = findTaskRowById_(taskSheet, match[1]);
    if (!found) {
      return { handled: true, reply: 'Task ' + normalizeTaskId_(match[1]) + ' was not found.' };
    }

    const status = normalizeTaskStatus_(match[2]);
    if (!status) {
      return { handled: true, reply: 'Valid statuses are Pending Review, Approved, In Progress, Done, Rejected.' };
    }

    if (status === 'In Progress') {
      const gateMessage = getHumanConfirmationMessage_(found.row);
      if (gateMessage) {
        return { handled: true, reply: gateMessage };
      }
    }

    taskSheet.getRange(found.rowNum, TASK_COL.STATUS).setValue(status);
    if ((status === 'Approved' || status === 'Rejected' || status === 'In Progress' || status === 'Done') && !found.row[TASK_COL.REVIEWED_AT - 1]) {
      taskSheet.getRange(found.rowNum, TASK_COL.REVIEWED_AT).setValue(new Date().toISOString());
    }
    appendTaskNote_(taskSheet, found.rowNum, '[Status] ' + status);
    touchTaskUpdatedAt_(taskSheet, found.rowNum);
    syncTaskToWorkspaces_(config, taskSheet, found.rowNum);
    refreshTaskTimeline_();

    return {
      handled: true,
      reply: 'Updated ' + normalizeTaskId_(match[1]) + ' to ' + status + '.',
    };
  }

  match = text.match(/^(?:note|add note|context|add context)\s+(T\d+)\s+(.+)$/i);
  if (match) {
    const found = findTaskRowById_(taskSheet, match[1]);
    if (!found) {
      return { handled: true, reply: 'Task ' + normalizeTaskId_(match[1]) + ' was not found.' };
    }

    appendTaskNote_(taskSheet, found.rowNum, '[User Note] ' + match[2].trim());
    touchTaskUpdatedAt_(taskSheet, found.rowNum);
    syncTaskToWorkspaces_(config, taskSheet, found.rowNum);
    refreshTaskTimeline_();
    return {
      handled: true,
      reply: 'Added a note to ' + normalizeTaskId_(match[1]) + '.',
    };
  }

  match = text.match(/^refresh timeline$/i) || text.match(/^timeline refresh$/i);
  if (match) {
    const deck = refreshTaskTimeline_();
    return {
      handled: true,
      reply: deck && deck.url ? 'Gantt deck refreshed: ' + deck.url : 'Gantt deck refreshed.',
    };
  }

  match = text.match(/^sync\s+(T\d+)$/i) || text.match(/^write back\s+(T\d+)$/i);
  if (match) {
    const found = findTaskRowById_(taskSheet, match[1]);
    if (!found) {
      return { handled: true, reply: 'Task ' + normalizeTaskId_(match[1]) + ' was not found.' };
    }
    const gateMessage = getHumanConfirmationMessage_(found.row);
    if (gateMessage) {
      return { handled: true, reply: gateMessage };
    }

    syncTaskToWorkspaces_(config, taskSheet, found.rowNum);
    return {
      handled: true,
      reply: 'Synced ' + normalizeTaskId_(match[1]) + ' to configured workspaces.',
    };
  }

  match = text.match(/^remember person\s+(.+)$/i);
  if (match) {
    const result = upsertStakeholderFromCommand_(config, match[1], metadata);
    return {
      handled: true,
      reply: result,
    };
  }

  match = text.match(/^link context\s+([A-Za-z0-9\-_]+)\s+to\s+(.+)$/i);
  if (match) {
    const result = linkStakeholderToContext_(config, match[1], match[2]);
    return {
      handled: true,
      reply: result,
    };
  }

  return { handled: false };
}

function readTaskStore_(sheet) {
  ensureTaskSheetSchema_(sheet);
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
      owner: row[TASK_COL.OWNER - 1],
      ownerChannel: row[TASK_COL.OWNER_CHANNEL - 1],
      startDate: row[TASK_COL.START_DATE - 1],
      dueDate: row[TASK_COL.DUE_DATE - 1],
      blockedBy: row[TASK_COL.BLOCKED_BY - 1],
      updatedAt: row[TASK_COL.UPDATED_AT - 1],
      stakeholderIds: row[TASK_COL.STAKEHOLDER_IDS - 1],
    });
  }
  return rows;
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

  return scored.slice(0, 8).map(function(s) {
    const owner = s.row.owner ? ' | Owner: ' + s.row.owner : '';
    const due = s.row.dueDate ? ' | Due: ' + formatTaskDueDate_(s.row.dueDate) : '';
    const stakeholders = s.row.stakeholderIds ? ' | Stakeholders: ' + s.row.stakeholderIds : '';
    return '- [' + s.row.id + '] ' + s.row.status + ' | ' + s.row.task + ' | ' + (s.row.priority || 'n/a') + owner + due + stakeholders;
  }).join('\n');
}

function ensureTaskSheetSchema_(sheet) {
  if (!sheet) return null;

  const requiredHeaders = [
    'ID', 'Task', 'Supporting Context IDs', 'Priority', 'Effort', 'Status',
    'Created At', 'Reviewed At', 'Notes', 'Owner', 'Owner Channel', 'Start Date', 'Due Date', 'Blocked By', 'Updated At', 'Stakeholder IDs'
  ];

  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const data = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const currentHeaders = data[0] || [];
  const currentSignature = currentHeaders.slice(0, requiredHeaders.length).join('|');
  const requiredSignature = requiredHeaders.join('|');

  if (currentSignature !== requiredSignature) {
    const headerIndex = {};
    currentHeaders.forEach(function(header, index) {
      headerIndex[String(header || '').trim()] = index;
    });

    const migratedRows = [];
    for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex];
      if (!row[0]) continue;
      migratedRows.push([
        row[headerIndex['ID']] || '',
        row[headerIndex['Task']] || '',
        row[headerIndex['Supporting Context IDs']] || '',
        row[headerIndex['Priority']] || '',
        row[headerIndex['Effort']] || '',
        row[headerIndex['Status']] || '',
        row[headerIndex['Created At']] || '',
        row[headerIndex['Reviewed At']] || '',
        row[headerIndex['Notes']] || '',
        row[headerIndex['Owner']] || '',
        row[headerIndex['Owner Channel']] || '',
        row[headerIndex['Start Date']] || '',
        row[headerIndex['Due Date']] || '',
        row[headerIndex['Blocked By']] || '',
        row[headerIndex['Updated At']] || '',
        row[headerIndex['Stakeholder IDs']] || '',
      ]);
    }

    sheet.clearContents();
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    if (migratedRows.length > 0) {
      sheet.getRange(2, 1, migratedRows.length, requiredHeaders.length).setValues(migratedRows);
    }
  }

  sheet.setFrozenRows(1);
  sheet.setColumnWidth(10, 140);
  sheet.setColumnWidth(11, 180);
  sheet.setColumnWidth(12, 120);
  sheet.setColumnWidth(13, 120);
  sheet.setColumnWidth(14, 120);
  sheet.setColumnWidth(15, 170);
  sheet.setColumnWidth(16, 140);
  try {
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Pending Review', 'Approved', 'In Progress', 'Done', 'Rejected'], true)
      .build();
    sheet.getRange(2, TASK_COL.STATUS, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(statusRule);
  } catch (e) {
    // Existing spreadsheets may not allow large-range validation updates during every run.
  }

  return sheet;
}

function normalizeTaskId_(value) {
  const raw = String(value || '').trim().toUpperCase();
  const match = raw.match(/^T\d+$/);
  return match ? match[0] : '';
}

function normalizeTaskStatus_(value) {
  const raw = String(value || '').trim().toLowerCase();
  const statuses = {
    'pending review': 'Pending Review',
    pending: 'Pending Review',
    approved: 'Approved',
    approve: 'Approved',
    'in progress': 'In Progress',
    progress: 'In Progress',
    started: 'In Progress',
    start: 'In Progress',
    done: 'Done',
    complete: 'Done',
    completed: 'Done',
    rejected: 'Rejected',
    reject: 'Rejected',
  };
  return statuses[raw] || '';
}

function normalizeDateInput_(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return '';
  return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function formatTaskDueDate_(value) {
  const normalized = normalizeDateInput_(value);
  return normalized || 'none';
}

function buildOwnerChannel_(platform, channelId) {
  const base = String(platform || '').trim().toLowerCase();
  const channel = String(channelId || '').trim();
  if (!base || !channel) return '';
  return base + ':' + channel;
}

function parseOwnerChannel_(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(slack|telegram|whatsapp):(.+)$/i);
  if (!match) return null;
  return {
    platform: match[1].toLowerCase(),
    channel: match[2],
  };
}

function findTaskRowById_(sheet, taskId) {
  const normalized = normalizeTaskId_(taskId);
  if (!normalized) return null;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][TASK_COL.ID - 1] || '').trim().toUpperCase() === normalized) {
      return {
        rowNum: i + 1,
        row: data[i],
      };
    }
  }
  return null;
}

function describeTaskRow_(row) {
  if (!row) return 'Task not found.';
  const owner = String(row[TASK_COL.OWNER - 1] || '').trim() || 'Unassigned';
  const due = formatTaskDueDate_(row[TASK_COL.DUE_DATE - 1]);
  const start = normalizeDateInput_(row[TASK_COL.START_DATE - 1]);
  const status = String(row[TASK_COL.STATUS - 1] || '').trim() || 'Unknown';
  const stakeholders = String(row[TASK_COL.STAKEHOLDER_IDS - 1] || '').trim();
  return [
    '[' + row[TASK_COL.ID - 1] + '] ' + row[TASK_COL.TASK - 1],
    'Status: ' + status,
    'Owner: ' + owner,
    start ? 'Start: ' + start : '',
    'Due: ' + due,
    stakeholders ? 'Stakeholders: ' + stakeholders : '',
  ].join(' | ');
}

function appendTaskNote_(sheet, rowNum, note) {
  const cell = sheet.getRange(rowNum, TASK_COL.NOTES);
  const current = String(cell.getValue() || '');
  cell.setValue(current ? current + ' | ' + note : note);
}

function touchTaskUpdatedAt_(sheet, rowNum) {
  sheet.getRange(rowNum, TASK_COL.UPDATED_AT).setValue(new Date().toISOString());
}

function createManualTask_(sheet, text, metadata) {
  ensureTaskSheetSchema_(sheet);
  const now = new Date().toISOString();
  const nextId = 'T' + String(sheet.getLastRow()).padStart(3, '0');
  const ownerChannel = metadata && metadata.ownerChannel ? metadata.ownerChannel : '';
  sheet.appendRow([
    nextId,
    text,
    '',
    'Medium',
    'Medium',
    'Approved',
    now,
    now,
    metadata && metadata.notes ? metadata.notes : '',
    metadata && metadata.owner ? metadata.owner : '',
    ownerChannel,
    metadata && metadata.startDate ? metadata.startDate : '',
    metadata && metadata.dueDate ? metadata.dueDate : '',
    metadata && metadata.blockedBy ? metadata.blockedBy : '',
    now,
    metadata && metadata.stakeholderIds ? metadata.stakeholderIds : '',
  ]);
  return nextId;
}

function syncTaskToWorkspaces_(config, taskSheet, rowNum) {
  const row = taskSheet.getRange(rowNum, 1, 1, TASK_COL.STAKEHOLDER_IDS).getValues()[0];
  const status = String(row[TASK_COL.STATUS - 1] || '').trim();
  if (requiresHumanConfirmation_(row) && status !== 'Pending Review') {
    Logger.log('Workspace sync skipped for ' + row[TASK_COL.ID - 1] + ' pending explicit confirmation.');
    return;
  }

  try {
    syncTaskToGoogleWriteback_(config, taskSheet, rowNum);
  } catch (e) {
    Logger.log('Google task write-back failed: ' + e.message);
  }

  try {
    syncTaskToSmartsheetWriteback_(config, taskSheet, rowNum);
  } catch (e) {
    Logger.log('Smartsheet task write-back failed: ' + e.message);
  }
}

function taskRowToObject_(row) {
  return {
    id: row[TASK_COL.ID - 1],
    task: row[TASK_COL.TASK - 1],
    contextIds: row[TASK_COL.CONTEXT_IDS - 1],
    priority: row[TASK_COL.PRIORITY - 1],
    effort: row[TASK_COL.EFFORT - 1],
    status: row[TASK_COL.STATUS - 1],
    createdAt: row[TASK_COL.CREATED_AT - 1],
    reviewedAt: row[TASK_COL.REVIEWED_AT - 1],
    notes: row[TASK_COL.NOTES - 1],
    owner: row[TASK_COL.OWNER - 1],
    ownerChannel: row[TASK_COL.OWNER_CHANNEL - 1],
    startDate: row[TASK_COL.START_DATE - 1],
    dueDate: row[TASK_COL.DUE_DATE - 1],
    blockedBy: row[TASK_COL.BLOCKED_BY - 1],
    updatedAt: row[TASK_COL.UPDATED_AT - 1],
    stakeholderIds: row[TASK_COL.STAKEHOLDER_IDS - 1],
  };
}

function requiresHumanConfirmation_(row) {
  const priority = String(row[TASK_COL.PRIORITY - 1] || '').trim();
  const owner = String(row[TASK_COL.OWNER - 1] || '').trim().toLowerCase();
  const notes = String(row[TASK_COL.NOTES - 1] || '');
  if (priority !== 'High') return false;
  if (owner !== 'chief of staff') return false;
  return notes.indexOf('[Confirmed]') === -1;
}

function getHumanConfirmationMessage_(row) {
  if (!requiresHumanConfirmation_(row)) return '';
  return 'High-priority Chief of Staff task ' + row[TASK_COL.ID - 1] + ' requires explicit confirmation before action. Send "confirm ' + row[TASK_COL.ID - 1] + '".';
}

function syncTaskToGoogleWriteback_(config, taskSheet, rowNum) {
  if (!config.GOOGLE_WRITEBACK_SPREADSHEET_ID) return;

  const row = taskSheet.getRange(rowNum, 1, 1, TASK_COL.STAKEHOLDER_IDS).getValues()[0];
  const task = taskRowToObject_(row);
  const targetSs = SpreadsheetApp.openById(config.GOOGLE_WRITEBACK_SPREADSHEET_ID);
  const sheetName = config.GOOGLE_WRITEBACK_SHEET_NAME || 'Chief of Staff Tasks';
  let targetSheet = targetSs.getSheetByName(sheetName);

  if (!targetSheet) {
    targetSheet = targetSs.insertSheet(sheetName);
  }

  const headers = ['Task ID', 'Task', 'Owner', 'Status', 'Priority', 'Effort', 'Start Date', 'Due Date', 'Blocked By', 'Updated At', 'Context IDs', 'Stakeholder IDs', 'Notes', 'Doc URL'];
  const currentHeaders = targetSheet.getRange(1, 1, 1, Math.max(targetSheet.getLastColumn(), 1)).getValues()[0];
  if (currentHeaders[0] !== headers[0]) {
    targetSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    targetSheet.getRange(1, 1, 1, headers.length).setBackground('#16324f').setFontColor('#ffffff').setFontWeight('bold');
    targetSheet.setFrozenRows(1);
  }

  const data = targetSheet.getDataRange().getValues();
  let targetRow = 0;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === String(task.id || '').trim()) {
      targetRow = i + 1;
      break;
    }
  }

  const values = [[
    task.id || '',
    task.task || '',
    task.owner || '',
    task.status || '',
    task.priority || '',
    task.effort || '',
    normalizeDateInput_(task.startDate),
    formatTaskDueDate_(task.dueDate),
    task.blockedBy || '',
    task.updatedAt || task.createdAt || '',
    task.contextIds || '',
    task.stakeholderIds || '',
    task.notes || '',
    findTaskDocumentUrl_(row) || '',
  ]];

  if (!targetRow) targetRow = Math.max(targetSheet.getLastRow() + 1, 2);
  targetSheet.getRange(targetRow, 1, 1, headers.length).setValues(values);
}

function syncTaskToSmartsheetWriteback_(config, taskSheet, rowNum) {
  if (!config.SMARTSHEET_TOKEN || !config.SMARTSHEET_TASK_SHEET_ID) return;

  const row = taskSheet.getRange(rowNum, 1, 1, TASK_COL.STAKEHOLDER_IDS).getValues()[0];
  const task = taskRowToObject_(row);
  const sheetId = config.SMARTSHEET_TASK_SHEET_ID;
  const meta = smartsheetGet_('https://api.smartsheet.com/2.0/sheets/' + sheetId, config);
  const columns = meta.columns || [];
  const rows = meta.rows || [];
  const columnMap = {};

  columns.forEach(function(col) {
    columnMap[String(col.title || '').trim().toLowerCase()] = col.id;
  });

  const requiredTitles = ['task id', 'task', 'owner', 'status', 'priority', 'effort', 'due date', 'updated at', 'context ids', 'notes', 'doc url'];
  const missing = requiredTitles.filter(function(title) { return !columnMap[title]; });
  if (missing.length > 0) {
    throw new Error('Smartsheet task sheet is missing columns: ' + missing.join(', '));
  }

  let existingRowId = null;
  rows.forEach(function(item) {
    if (existingRowId) return;
    const cells = item.cells || [];
    const idCell = cells.find(function(cell) { return cell.columnId === columnMap['task id']; });
    if (idCell && String(idCell.displayValue || idCell.value || '').trim() === String(task.id || '').trim()) {
      existingRowId = item.id;
    }
  });

  const cells = [
    buildSmartsheetCell_(columnMap['task id'], task.id || ''),
    buildSmartsheetCell_(columnMap['task'], task.task || ''),
    buildSmartsheetCell_(columnMap['owner'], task.owner || ''),
    buildSmartsheetCell_(columnMap['status'], task.status || ''),
    buildSmartsheetCell_(columnMap['priority'], task.priority || ''),
    buildSmartsheetCell_(columnMap['effort'], task.effort || ''),
    buildSmartsheetCell_(columnMap['due date'], formatTaskDueDate_(task.dueDate)),
    buildSmartsheetCell_(columnMap['updated at'], task.updatedAt || task.createdAt || ''),
    buildSmartsheetCell_(columnMap['context ids'], task.contextIds || ''),
    buildSmartsheetCell_(columnMap['notes'], task.notes || ''),
    buildSmartsheetCell_(columnMap['doc url'], findTaskDocumentUrl_(row) || ''),
  ];
  if (columnMap['stakeholder ids']) {
    cells.push(buildSmartsheetCell_(columnMap['stakeholder ids'], task.stakeholderIds || ''));
  }

  if (existingRowId) {
    smartsheetRequest_('https://api.smartsheet.com/2.0/sheets/' + sheetId + '/rows', config, 'put', [{
      id: existingRowId,
      cells: cells,
    }]);
  } else {
    smartsheetRequest_('https://api.smartsheet.com/2.0/sheets/' + sheetId + '/rows', config, 'post', [{
      toBottom: true,
      cells: cells,
    }]);
  }
}

function buildSmartsheetCell_(columnId, value) {
  return {
    columnId: columnId,
    value: value,
  };
}

function ensureStakeholdersSheet_(ss) {
  let sheet = ss.getSheetByName(SHEET.PEOPLE);
  if (sheet) {
    const firstHeader = String(sheet.getRange(1, 1).getValue() || '').trim();
    if (firstHeader !== 'Stakeholder ID') {
      sheet.insertColumnBefore(1);
      sheet.getRange(1, 1).setValue('Stakeholder ID');
      const lastRow = sheet.getLastRow();
      for (let row = 2; row <= lastRow; row++) {
        const name = String(sheet.getRange(row, 2).getValue() || '').trim();
        if (name) sheet.getRange(row, 1).setValue(buildStakeholderId_(name));
      }
    }
    const headers = ['Stakeholder ID', 'Name', 'Role', 'Org', 'Relationship', 'Communication Preference', 'Channel', 'Last Interaction', 'Notes'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  sheet = ss.insertSheet(SHEET.PEOPLE);
  sheet.appendRow(['Stakeholder ID', 'Name', 'Role', 'Org', 'Relationship', 'Communication Preference', 'Channel', 'Last Interaction', 'Notes']);
  sheet.setFrozenRows(1);
  return sheet;
}

function upsertStakeholderFromCommand_(config, raw, metadata) {
  const parts = String(raw || '').split('|').map(function(part) { return part.trim(); });
  if (!parts[0]) {
    return 'Use: remember person Name | Role | Org | Notes | Channel(optional)';
  }

  const name = parts[0];
  const role = parts[1] || '';
  const org = parts[2] || '';
  const notes = parts[3] || '';
  const channel = parts[4] || buildOwnerChannel_(metadata.platform, metadata.channel);

  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = ensureStakeholdersSheet_(ss);
  const data = sheet.getDataRange().getValues();
  let rowNum = 0;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1] || '').trim().toLowerCase() === name.toLowerCase()) {
      rowNum = i + 1;
      break;
    }
  }

  const existing = rowNum ? data[rowNum - 1] : null;
  const stakeholderId = existing ? String(existing[0] || '') : buildStakeholderId_(name);
  const values = [[
    stakeholderId,
    name,
    role,
    org,
    existing ? existing[4] : '',
    existing ? existing[5] : '',
    channel,
    new Date().toISOString(),
    notes || (existing ? existing[8] : ''),
  ]];

  if (!rowNum) rowNum = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(rowNum, 1, 1, values[0].length).setValues(values);
  return 'Saved stakeholder memory for ' + name + ' (' + stakeholderId + ').';
}

function buildStakeholderId_(name) {
  return 'STK-' + simpleHash_(String(name || '').toLowerCase()).toUpperCase();
}

function findStakeholderByNameOrId_(config, raw) {
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = ensureStakeholdersSheet_(ss);
  const data = sheet.getDataRange().getValues();
  const query = String(raw || '').trim().toLowerCase();
  if (!query) return null;

  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0] || '').trim();
    const name = String(data[i][1] || '').trim();
    if (id.toLowerCase() === query || name.toLowerCase() === query) {
      return { id: id, name: name };
    }
  }
  return null;
}

function addStakeholderLinkToTask_(taskSheet, rowNum, stakeholderId) {
  const cell = taskSheet.getRange(rowNum, TASK_COL.STAKEHOLDER_IDS);
  const current = String(cell.getValue() || '').split(',').map(function(id) { return id.trim(); }).filter(Boolean);
  if (current.indexOf(stakeholderId) === -1) current.push(stakeholderId);
  cell.setValue(current.join(', '));
  touchTaskUpdatedAt_(taskSheet, rowNum);
}

function linkStakeholderToContext_(config, contextId, rawStakeholder) {
  const stakeholder = findStakeholderByNameOrId_(config, rawStakeholder);
  if (!stakeholder) {
    return 'No stakeholder matched "' + String(rawStakeholder || '').trim() + '".';
  }

  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET.CONTEXT);
  if (!sheet) return 'Context Store sheet not found.';
  ensureContextSheetSchema_(sheet);

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL.ID - 1] || '').trim().toUpperCase() !== String(contextId || '').trim().toUpperCase()) continue;
    const cell = sheet.getRange(i + 1, COL.STAKEHOLDER_IDS);
    const current = String(cell.getValue() || '').split(',').map(function(id) { return id.trim(); }).filter(Boolean);
    if (current.indexOf(stakeholder.id) === -1) current.push(stakeholder.id);
    cell.setValue(current.join(', '));
    return 'Linked context ' + String(contextId).toUpperCase() + ' to stakeholder ' + stakeholder.name + ' (' + stakeholder.id + ').';
  }

  return 'Context ' + String(contextId).toUpperCase() + ' was not found.';
}

function runTaskReminders() {
  Logger.log('=== Task Reminders started ===');
  const config = validateConfig_(['SPREADSHEET_ID']);
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const taskSheet = ss.getSheetByName(SHEET.TASKS);

  if (!taskSheet) {
    Logger.log('Task Reminders: Proposed Tasks sheet not found.');
    return;
  }

  ensureTaskSheetSchema_(taskSheet);
  const taskRows = readTaskStore_(taskSheet);
  const now = new Date();
  const todayKey = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const todayStart = new Date(todayKey + 'T00:00:00');
  let sent = 0;

  taskRows.forEach(function(task) {
    if (task.status === 'Done' || task.status === 'Rejected') return;
    if (!task.ownerChannel) return;

    const due = normalizeDateInput_(task.dueDate);
    if (!due) return;

    const dueDate = new Date(due + 'T00:00:00');
    const diffDays = Math.round((dueDate.getTime() - todayStart.getTime()) / 86400000);
    let reason = '';

    if (diffDays < 0) {
      reason = 'overdue';
    } else if (diffDays <= 1) {
      reason = 'due-soon';
    } else {
      return;
    }

    const reminderKey = 'TASK_REMINDER_' + task.id + '_' + todayKey + '_' + reason;
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty(reminderKey)) return;

    const message = buildTaskReminderMessage_(task, reason, due);
    if (sendMessageToOwnerChannel_(config, task.ownerChannel, message)) {
      props.setProperty(reminderKey, new Date().toISOString());
      const found = findTaskRowById_(taskSheet, task.id);
      if (found) {
        appendTaskNote_(taskSheet, found.rowNum, '[Reminder] Sent ' + todayKey + ' (' + reason + ')');
        touchTaskUpdatedAt_(taskSheet, found.rowNum);
        syncTaskToWorkspaces_(config, taskSheet, found.rowNum);
      }
      sent++;
    }
  });

  Logger.log('Task Reminders: ' + sent + ' reminder(s) sent.');
}

function buildTaskReminderMessage_(task, reason, dueDate) {
  const owner = task.owner || 'task owner';
  const intro = reason === 'overdue'
    ? 'Reminder for ' + owner + ': task is overdue.'
    : 'Reminder for ' + owner + ': task is due soon.';
  return [
    intro,
    '[' + task.id + '] ' + task.task,
    'Status: ' + (task.status || 'Unknown'),
    'Due: ' + dueDate,
  ].join('\n');
}

function sendMessageToOwnerChannel_(config, ownerChannel, text) {
  const destination = parseOwnerChannel_(ownerChannel);
  if (!destination) return false;

  if (destination.platform === 'slack' && config.SLACK_BOT_TOKEN) {
    postSlackMessage_(config, destination.channel, text, '');
    return true;
  }
  if (destination.platform === 'telegram' && config.TELEGRAM_BOT_TOKEN) {
    postTelegramMessage_(config, destination.channel, text);
    return true;
  }
  if (destination.platform === 'whatsapp' && config.WHATSAPP_TOKEN && config.WHATSAPP_PHONE_NUMBER_ID) {
    postWhatsAppMessage_(config, destination.channel, text);
    return true;
  }
  return false;
}

function refreshTaskTimeline_() {
  const config = validateConfig_(['SPREADSHEET_ID']);
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const taskSheet = ss.getSheetByName(SHEET.TASKS);
  if (!taskSheet) return null;

  ensureTaskSheetSchema_(taskSheet);
  const taskRows = readTaskStore_(taskSheet)
    .filter(function(task) { return task.status !== 'Rejected'; })
    .sort(function(a, b) { return taskSortValue_(a) - taskSortValue_(b); });
  return refreshGanttDeck_(config, ss, taskRows);
}

function calculateTaskWindow_(task) {
  const created = normalizeDateInput_(task.startDate) || normalizeDateInput_(task.createdAt) || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const due = normalizeDateInput_(task.dueDate);
  const durationDays = task.effort === 'Large' ? 10 : task.effort === 'Medium' ? 5 : 2;
  const startLabel = created;

  let endDate = due;
  if (!endDate) {
    const startDate = new Date(created + 'T00:00:00');
    startDate.setDate(startDate.getDate() + Math.max(durationDays - 1, 0));
    endDate = Utilities.formatDate(startDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  return {
    startLabel: startLabel,
    endLabel: endDate,
    durationDays: durationDays,
  };
}

function taskSortValue_(task) {
  const due = normalizeDateInput_(task.dueDate);
  if (due) return new Date(due + 'T00:00:00').getTime();
  const created = normalizeDateInput_(task.createdAt);
  return created ? new Date(created + 'T00:00:00').getTime() : Number.MAX_SAFE_INTEGER;
}

function refreshGanttDeck_(config, ss, taskRows) {
  const deck = getOrCreateGanttDeck_(config, ss);
  const presentation = SlidesApp.openById(deck.id);
  const slides = presentation.getSlides();
  if (slides.length === 0) {
    presentation.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  }

  while (presentation.getSlides().length > 1) {
    presentation.getSlides()[presentation.getSlides().length - 1].remove();
  }

  const titleSlide = presentation.getSlides()[0];
  clearSlide_(titleSlide);
  renderGanttTitleSlide_(titleSlide, ss, taskRows);

  const activeTasks = taskRows.filter(function(task) {
    return task.status !== 'Done' && task.status !== 'Rejected';
  });

  if (activeTasks.length === 0) {
    titleSlide.insertTextBox('No active tasks to display.', 40, 120, 300, 30)
      .getText().getTextStyle().setFontSize(18);
  } else {
    const chunkSize = 8;
    for (let i = 0; i < activeTasks.length; i += chunkSize) {
      const slide = i === 0 ? presentation.appendSlide(SlidesApp.PredefinedLayout.BLANK) : presentation.appendSlide(SlidesApp.PredefinedLayout.BLANK);
      renderGanttTimelineSlide_(slide, activeTasks.slice(i, i + chunkSize), i / chunkSize + 1);
    }
  }

  return deck;
}

function getOrCreateGanttDeck_(config, ss) {
  let deckId = String(config.GANTT_SLIDES_ID || '').trim();
  if (deckId) {
    try {
      const file = DriveApp.getFileById(deckId);
      return { id: deckId, url: file.getUrl() };
    } catch (e) {
      deckId = '';
    }
  }

  const deck = SlidesApp.create('Chief of Staff - Gantt Timeline');
  deckId = deck.getId();
  saveFrameworkConfig_({ GANTT_SLIDES_ID: deckId });
  try {
    DriveApp.getFileById(deckId).addEditor(Session.getEffectiveUser().getEmail());
  } catch (e) {
    // Best effort only.
  }
  refreshSetupDashboard();
  return { id: deckId, url: deck.getUrl() };
}

function clearSlide_(slide) {
  slide.getPageElements().forEach(function(element) {
    element.remove();
  });
}

function renderGanttTitleSlide_(slide, ss, taskRows) {
  const title = slide.insertTextBox('Chief of Staff Gantt', 32, 24, 420, 40);
  title.getText().getTextStyle().setFontSize(26).setBold(true);

  const subtitle = [
    'Source of truth: ' + ss.getUrl(),
    'Last refreshed: ' + new Date().toISOString(),
    'Tasks shown: ' + taskRows.filter(function(task) { return task.status !== 'Rejected'; }).length,
  ].join('\n');
  slide.insertTextBox(subtitle, 32, 76, 520, 54).getText().getTextStyle().setFontSize(12);

  slide.insertTextBox('Status colors: Pending Review = gray | Approved = yellow | In Progress = blue | Done = green | Blocked = red', 32, 330, 600, 24)
    .getText().getTextStyle().setFontSize(10);
}

function renderGanttTimelineSlide_(slide, tasks, pageNumber) {
  clearSlide_(slide);
  slide.insertTextBox('Gantt Timeline', 20, 12, 240, 24).getText().getTextStyle().setFontSize(20).setBold(true);
  slide.insertTextBox('Page ' + pageNumber, 620, 14, 60, 20).getText().getTextStyle().setFontSize(10);

  const today = new Date();
  const rangeStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3);
  const days = 21;
  const chartLeft = 280;
  const chartTop = 54;
  const chartWidth = 400;
  const dayWidth = chartWidth / days;
  const rowHeight = 34;

  for (let i = 0; i < days; i++) {
    const date = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate() + i);
    const label = Utilities.formatDate(date, Session.getScriptTimeZone(), 'MM-dd');
    slide.insertTextBox(label, chartLeft + (i * dayWidth), chartTop, dayWidth, 14)
      .getText().getTextStyle().setFontSize(8);
  }

  tasks.forEach(function(task, index) {
    const y = chartTop + 20 + (index * rowHeight);
    const window = calculateTaskWindow_(task);
    const startDate = new Date(window.startLabel + 'T00:00:00');
    const endDate = new Date(window.endLabel + 'T00:00:00');
    const offsetDays = Math.max(0, Math.floor((startDate.getTime() - rangeStart.getTime()) / 86400000));
    const spanDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
    const barLeft = chartLeft + Math.min(days - 1, offsetDays) * dayWidth;
    const barWidth = Math.min(days - offsetDays, spanDays) * dayWidth;

    slide.insertTextBox('[' + task.id + '] ' + truncateTaskLabel_(task.task, 42), 20, y, 250, 16)
      .getText().getTextStyle().setFontSize(10);
    slide.insertTextBox((task.owner || 'Unassigned') + ' | ' + (task.status || 'Unknown'), 20, y + 14, 250, 14)
      .getText().getTextStyle().setFontSize(8);

    const bar = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, barLeft, y + 6, Math.max(barWidth, 6), 12);
    bar.getFill().setSolidFill(colorForTaskStatus_(task.status));
  });
}

function colorForTaskStatus_(status) {
  if (status === 'Done') return '#9AE6B4';
  if (status === 'In Progress') return '#63B3ED';
  if (status === 'Approved') return '#F6E05E';
  if (status === 'Blocked') return '#FC8181';
  return '#CBD5E0';
}

function truncateTaskLabel_(text, maxLen) {
  const value = String(text || '').trim();
  if (value.length <= maxLen) return value;
  return value.substring(0, Math.max(0, maxLen - 1)).trim() + '…';
}
