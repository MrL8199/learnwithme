/**
 * Flashcard backend (Google Apps Script web app).
 *
 * - Reads the vocabulary Sheet (read only, never writes to it).
 * - Stores study events in a separate private spreadsheet "Flashcard Progress", tab NhatKy.
 * - Sends a 21:00 e-mail reminder if nothing was studied today.
 *
 * Setup: see README.md, section "Cài Apps Script".
 */

/** ID of your vocabulary Sheet: the part between /d/ and /edit in its URL. */
const VOCAB_SHEET_ID = 'PASTE_YOUR_SHEET_ID_HERE';

const EVENT_TYPES = ['start', 'import', 'read', 'copy', 'test', 'translate', 'reset'];
const HEADERS = ['id', 'ts', 'device', 'type', 'deckId', 'data'];

/** Run once from the editor (Run ▸ setup). Prints the secret code to paste into the app. */
function setup() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('TOKEN')) p.setProperty('TOKEN', Utilities.getUuid().replace(/-/g, ''));
  if (!p.getProperty('PROGRESS_ID')) {
    const ss = SpreadsheetApp.create('Flashcard Progress');
    const sh = ss.getSheets()[0];
    sh.setName('NhatKy');
    sh.getRange('A:F').setNumberFormat('@'); // keep ISO timestamps as text
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sh.setFrozenRows(1);
    p.setProperty('PROGRESS_ID', ss.getId());
  }
  const vocab = SpreadsheetApp.openById(VOCAB_SHEET_ID);
  Logger.log('Sheet từ vựng: ' + vocab.getName() + ' (' + vocab.getSheets().length + ' tab)');
  Logger.log('Sheet tiến độ: ' + SpreadsheetApp.openById(p.getProperty('PROGRESS_ID')).getUrl());
  Logger.log('MÃ BÍ MẬT (dán vào app): ' + p.getProperty('TOKEN'));
}

/** Optional: daily 21:00 reminder e-mail. Run once (Run ▸ installReminder). */
function installReminder() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'remind'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('remind').timeBased().everyDays(1).atHour(21).create();
  Logger.log('Đã bật nhắc học lúc ~21h (giờ theo múi giờ của project).');
}

function remind() {
  const events = readEvents_();
  const now = new Date();
  const today = studyDate_(now);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
  const activeLately = events.some(function (e) { return new Date(e.ts) >= twoWeeksAgo; });
  const studiedToday = events.some(function (e) {
    return (e.type === 'test' || e.type === 'read' || e.type === 'copy') && studyDate_(new Date(e.ts)) === today;
  });
  if (activeLately && !studiedToday) {
    MailApp.sendEmail(
      Session.getEffectiveUser().getEmail(),
      'Flashcard: hôm nay bạn chưa ôn bài',
      'Mở app Flashcard để làm bài ôn hôm nay. Mỗi ngày 1 lần, đủ 7 ngày.'
    );
  }
}

function doGet(e) {
  try {
    const q = (e && e.parameter) || {};
    if (!authorized_(q.token)) return json_({ ok: false, error: 'bad token' });
    if (q.action === 'data') return json_({ ok: true, tabs: readVocab_() });
    if (q.action === 'events') return json_({ ok: true, events: readEvents_() });
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (!authorized_(body.token)) return json_({ ok: false, error: 'bad token' });
    if (body.action === 'append') return json_({ ok: true, added: appendEvents_(body.events || []) });
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function authorized_(token) {
  const t = PropertiesService.getScriptProperties().getProperty('TOKEN');
  return !!t && typeof token === 'string' && token === t;
}

function readVocab_() {
  return SpreadsheetApp.openById(VOCAB_SHEET_ID)
    .getSheets()
    .map(function (sh) {
      return { name: sh.getName(), values: sh.getLastRow() > 0 ? sh.getDataRange().getDisplayValues() : [] };
    });
}

function progressSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('PROGRESS_ID');
  if (!id) throw new Error('Chưa chạy setup()');
  return SpreadsheetApp.openById(id).getSheetByName('NhatKy');
}

function readEvents_() {
  const sh = progressSheet_();
  const n = sh.getLastRow() - 1;
  if (n <= 0) return [];
  return sh
    .getRange(2, 1, n, HEADERS.length)
    .getDisplayValues()
    .filter(function (r) { return r[0]; })
    .map(function (r) {
      return { id: r[0], ts: r[1], device: r[2], type: r[3], deckId: r[4], data: r[5] ? JSON.parse(r[5]) : undefined };
    });
}

/** Only well-formed events are stored; nothing can start with = + - @ (no formulas). */
function validEvent_(e) {
  if (!e || typeof e !== 'object') return false;
  if (!/^[A-Za-z0-9-]{6,64}$/.test(String(e.id))) return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(String(e.ts))) return false;
  if (!/^[A-Za-z0-9-]{1,40}$/.test(String(e.device))) return false;
  if (EVENT_TYPES.indexOf(e.type) < 0) return false;
  const deck = String(e.deckId);
  if (!deck || deck.length > 200 || /^[=+\-@]/.test(deck)) return false;
  if (e.data !== undefined && JSON.stringify(e.data).length > 5000) return false;
  return true;
}

function appendEvents_(events) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = progressSheet_();
    const n = sh.getLastRow() - 1;
    const seen = {};
    if (n > 0) sh.getRange(2, 1, n, 1).getDisplayValues().forEach(function (r) { seen[r[0]] = true; });
    const rows = [];
    events.forEach(function (e) {
      if (!validEvent_(e) || seen[e.id]) return;
      seen[e.id] = true;
      rows.push([e.id, e.ts, e.device, e.type, e.deckId, e.data === undefined ? '' : JSON.stringify(e.data)]);
    });
    if (rows.length) {
      const range = sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.length);
      range.setNumberFormat('@');
      range.setValues(rows);
    }
    return rows.length;
  } finally {
    lock.releaseLock();
  }
}

/** A study day runs 04:00 → 03:59, Vietnam time (same rule as the app). */
function studyDate_(d) {
  return Utilities.formatDate(new Date(d.getTime() - 4 * 3600000), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
}
