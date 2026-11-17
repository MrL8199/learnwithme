/**
 * Flashcard backend (Google Apps Script web app).
 *
 * - Reads the vocabulary Sheet (read only, never writes to it). Shared by everyone in the group.
 * - Accounts: username + password per person (tab NguoiDung). Creating an account or logging in
 *   needs the group code (TOKEN); after that each device uses a personal key.
 * - Stores study events in a separate private spreadsheet "Flashcard Progress", tab NhatKy,
 *   with a `user` column; each person only reads and writes their own events.
 * - Sends a 21:00 e-mail reminder to the owner if the owner studied nothing today.
 *
 * Setup: see README.md, section "Cài Apps Script".
 */

/** ID of your vocabulary Sheet: the part between /d/ and /edit in its URL. */
const VOCAB_SHEET_ID = 'PASTE_YOUR_SHEET_ID_HERE';

const EVENT_TYPES = ['start', 'import', 'read', 'copy', 'test', 'translate', 'reset'];
const HEADERS = ['id', 'ts', 'device', 'type', 'deckId', 'data', 'user'];
const USER_HEADERS = ['username', 'salt', 'hash', 'key', 'createdAt'];

/** Run once from the editor (Run ▸ setup). Prints the group code to paste into the app. */
function setup() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('TOKEN')) p.setProperty('TOKEN', Utilities.getUuid().replace(/-/g, ''));
  if (!p.getProperty('PROGRESS_ID')) {
    const ss = SpreadsheetApp.create('Flashcard Progress');
    const sh = ss.getSheets()[0];
    sh.setName('NhatKy');
    sh.getRange('A:G').setNumberFormat('@'); // keep ISO timestamps as text
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sh.setFrozenRows(1);
    p.setProperty('PROGRESS_ID', ss.getId());
  }
  progressSheet_();
  usersSheet_();
  const vocab = SpreadsheetApp.openById(VOCAB_SHEET_ID);
  Logger.log('Sheet từ vựng: ' + vocab.getName() + ' (' + vocab.getSheets().length + ' tab)');
  Logger.log('Sheet tiến độ: ' + SpreadsheetApp.openById(p.getProperty('PROGRESS_ID')).getUrl());
  Logger.log('MÃ NHÓM / MÃ BÍ MẬT (dán vào app): ' + p.getProperty('TOKEN'));
}

/** Optional: daily 21:00 reminder e-mail. Run once (Run ▸ installReminder). */
function installReminder() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'remind'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('remind').timeBased().everyDays(1).atHour(21).create();
  Logger.log('Đã bật nhắc học lúc ~21h (giờ theo múi giờ của project).');
}

/** Reminds the owner (the first account created) only. */
function remind() {
  const users = readUsers_();
  if (!users.length) return;
  const owner = users[0].username;
  const events = readEvents_().filter(function (e) { return e.user === owner; });
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

/** Owner tool: list accounts and how many events each has (Run ▸ listUsers, see the log). */
function listUsers() {
  const events = readEvents_();
  readUsers_().forEach(function (u) {
    const n = events.filter(function (e) { return e.user === u.username; }).length;
    Logger.log(u.username + ' — tạo ' + u.createdAt + ' — ' + n + ' sự kiện');
  });
}

/** Owner tool: set a new password for someone who forgot it. Edit the two values, then Run. */
function resetPassword() {
  const username = 'ten_dang_nhap';
  const newPassword = 'mat_khau_moi';
  const sh = usersSheet_();
  const u = readUsers_().filter(function (x) { return x.username === username; })[0];
  if (!u) return Logger.log('Không có tài khoản ' + username);
  const salt = Utilities.getUuid();
  sh.getRange(u.row, 2, 1, 2).setValues([[salt, hash_(salt, newPassword)]]);
  Logger.log('Đã đổi mật khẩu cho ' + username);
}

// ───────────────────────── web app ─────────────────────────

function doGet(e) {
  try {
    const q = (e && e.parameter) || {};
    if (q.action === 'data') {
      if (!authorized_(q.token) && !userByKey_(q.key)) return json_({ ok: false, error: 'bad token' });
      return json_({ ok: true, tabs: readVocab_() });
    }
    if (q.action === 'events') {
      const user = userByKey_(q.key);
      if (!user) return json_({ ok: false, error: 'bad key' });
      return json_({
        ok: true,
        events: readEvents_().filter(function (ev) { return ev.user === user.username; }),
      });
    }
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'register') return json_(register_(body));
    if (body.action === 'login') return json_(login_(body));
    if (body.action === 'append') {
      const user = userByKey_(body.key);
      if (!user) return json_({ ok: false, error: 'bad key' });
      return json_({ ok: true, added: appendEvents_(body.events || [], user.username) });
    }
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

// ───────────────────────── accounts ─────────────────────────

function usersSheet_() {
  const ss = SpreadsheetApp.openById(progressId_());
  let sh = ss.getSheetByName('NguoiDung');
  if (!sh) {
    sh = ss.insertSheet('NguoiDung');
    sh.getRange('A:E').setNumberFormat('@');
    sh.getRange(1, 1, 1, USER_HEADERS.length).setValues([USER_HEADERS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function readUsers_() {
  const sh = usersSheet_();
  const n = sh.getLastRow() - 1;
  if (n <= 0) return [];
  return sh
    .getRange(2, 1, n, USER_HEADERS.length)
    .getDisplayValues()
    .map(function (r, i) {
      return { row: i + 2, username: r[0], salt: r[1], hash: r[2], key: r[3], createdAt: r[4] };
    })
    .filter(function (u) { return u.username; });
}

function userByKey_(key) {
  if (typeof key !== 'string' || key.length < 32) return null;
  return readUsers_().filter(function (u) { return u.key === key; })[0] || null;
}

function normUser_(s) {
  return String(s || '').trim().toLowerCase();
}

function hash_(salt, password) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + password, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}

function newKey_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function register_(body) {
  if (!authorized_(body.token)) return { ok: false, error: 'bad token' };
  const username = normUser_(body.username);
  const password = String(body.password || '');
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) return { ok: false, error: 'bad username' };
  if (password.length < 4) return { ok: false, error: 'weak password' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const users = readUsers_();
    if (users.some(function (u) { return u.username === username; })) return { ok: false, error: 'username taken' };
    const salt = Utilities.getUuid();
    const key = newKey_();
    const sh = usersSheet_();
    sh.getRange(sh.getLastRow() + 1, 1, 1, USER_HEADERS.length)
      .setNumberFormat('@')
      .setValues([[username, salt, hash_(salt, password), key, new Date().toISOString()]]);
    // The first account inherits progress logged before accounts existed.
    if (!users.length) claimLegacyEvents_(username);
    return { ok: true, user: username, key: key };
  } finally {
    lock.releaseLock();
  }
}

function login_(body) {
  if (!authorized_(body.token)) return { ok: false, error: 'bad token' };
  const username = normUser_(body.username);
  const u = readUsers_().filter(function (x) { return x.username === username; })[0];
  if (!u || hash_(u.salt, String(body.password || '')) !== u.hash) {
    Utilities.sleep(1000); // slow down guessing
    return { ok: false, error: 'bad login' };
  }
  return { ok: true, user: u.username, key: u.key };
}

function claimLegacyEvents_(username) {
  const sh = progressSheet_();
  const n = sh.getLastRow() - 1;
  if (n <= 0) return;
  const range = sh.getRange(2, 7, n, 1);
  const vals = range.getDisplayValues().map(function (r) { return [r[0] || username]; });
  range.setNumberFormat('@').setValues(vals);
}

// ───────────────────────── data ─────────────────────────

function readVocab_() {
  return SpreadsheetApp.openById(VOCAB_SHEET_ID)
    .getSheets()
    .map(function (sh) {
      return { name: sh.getName(), values: sh.getLastRow() > 0 ? sh.getDataRange().getDisplayValues() : [] };
    });
}

function progressId_() {
  const id = PropertiesService.getScriptProperties().getProperty('PROGRESS_ID');
  if (!id) throw new Error('Chưa chạy setup()');
  return id;
}

/** NhatKy tab; adds the `user` column to sheets created by the first version. */
function progressSheet_() {
  const sh = SpreadsheetApp.openById(progressId_()).getSheetByName('NhatKy');
  const head = sh.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
  if (head[6] !== 'user') {
    sh.getRange('G:G').setNumberFormat('@');
    sh.getRange(1, 7).setValue('user');
  }
  return sh;
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
      return { id: r[0], ts: r[1], device: r[2], type: r[3], deckId: r[4], data: r[5] ? JSON.parse(r[5]) : undefined, user: r[6] };
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

function appendEvents_(events, username) {
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
      rows.push([e.id, e.ts, e.device, e.type, e.deckId, e.data === undefined ? '' : JSON.stringify(e.data), username]);
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
