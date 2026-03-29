// ============================================================
// CHIEF OF STAFF — Docs Execution
// Google Docs helpers for CoS-owned task execution.
// ============================================================

function findTaskDocumentUrl_(row) {
  const notes = String(row[TASK_COL.NOTES - 1] || '');
  const match = notes.match(/\[CoS Doc\]\s+(https:\/\/docs\.google\.com\/document\/d\/[A-Za-z0-9\-_]+)/);
  return match ? match[1] : '';
}

function extractGoogleDocId_(url) {
  const match = String(url || '').match(/\/document\/d\/([A-Za-z0-9\-_]+)/);
  return match ? match[1] : '';
}

function createTaskDocument_(sheet, found, metadata) {
  const row = found.row;
  const existingUrl = findTaskDocumentUrl_(row);
  if (existingUrl) {
    return {
      created: false,
      url: existingUrl,
      message: 'Task already has a document: ' + existingUrl,
    };
  }

  const taskId = String(row[TASK_COL.ID - 1] || '');
  const taskTitle = String(row[TASK_COL.TASK - 1] || 'Untitled task');
  const doc = DocumentApp.create('[' + taskId + '] ' + taskTitle);
  const body = doc.getBody();
  const now = new Date().toISOString();
  const owner = String(row[TASK_COL.OWNER - 1] || '').trim() || 'Chief of Staff';
  const dueDate = formatTaskDueDate_(row[TASK_COL.DUE_DATE - 1]);

  body.appendParagraph(taskTitle).setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph('Task ID: ' + taskId);
  body.appendParagraph('Owner: ' + owner);
  body.appendParagraph('Status: ' + (row[TASK_COL.STATUS - 1] || 'Approved'));
  body.appendParagraph('Due Date: ' + dueDate);
  body.appendParagraph('Supporting Context: ' + (row[TASK_COL.CONTEXT_IDS - 1] || '(none)'));
  body.appendParagraph('');
  body.appendParagraph('Working Draft').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('Created by Chief of Staff on ' + now + '.');
  body.appendParagraph('');
  body.appendParagraph('Notes').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(String(row[TASK_COL.NOTES - 1] || '(none)'));

  const url = doc.getUrl();
  appendTaskNote_(sheet, found.rowNum, '[CoS Doc] ' + url);
  if (!String(row[TASK_COL.OWNER - 1] || '').trim()) {
    sheet.getRange(found.rowNum, TASK_COL.OWNER).setValue('Chief of Staff');
  }
  if (!String(row[TASK_COL.OWNER_CHANNEL - 1] || '').trim()) {
    sheet.getRange(found.rowNum, TASK_COL.OWNER_CHANNEL).setValue(buildOwnerChannel_(metadata.platform, metadata.channel));
  }
  if (String(row[TASK_COL.STATUS - 1] || '').trim() === 'Approved') {
    sheet.getRange(found.rowNum, TASK_COL.STATUS).setValue('In Progress');
  }
  touchTaskUpdatedAt_(sheet, found.rowNum);

  return {
    created: true,
    url: url,
    message: 'Created Google Doc for ' + taskId + ': ' + url,
  };
}

function appendToTaskDocument_(sheet, found, content, metadata) {
  const row = found.row;
  const url = findTaskDocumentUrl_(row);
  if (!url) {
    return {
      updated: false,
      message: 'Task ' + row[TASK_COL.ID - 1] + ' does not have a document yet. Send "create doc for ' + row[TASK_COL.ID - 1] + '" first.',
    };
  }

  const docId = extractGoogleDocId_(url);
  if (!docId) {
    return {
      updated: false,
      message: 'Found a doc link for ' + row[TASK_COL.ID - 1] + ' but could not parse the document ID.',
    };
  }

  const doc = DocumentApp.openById(docId);
  const body = doc.getBody();
  const now = new Date().toISOString();

  body.appendParagraph('Update').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('Added ' + now + ' by ' + (metadata.user || metadata.source || 'Chief of Staff'));
  body.appendParagraph(content);

  appendTaskNote_(sheet, found.rowNum, '[Doc Update] ' + now);
  if (String(row[TASK_COL.STATUS - 1] || '').trim() === 'Approved') {
    sheet.getRange(found.rowNum, TASK_COL.STATUS).setValue('In Progress');
  }
  touchTaskUpdatedAt_(sheet, found.rowNum);

  return {
    updated: true,
    url: url,
    message: 'Updated Google Doc for ' + row[TASK_COL.ID - 1] + ': ' + url,
  };
}
