/* =====================================================
   CodeVise — Frontend Script
   All AI calls go through the backend (server.js)
   API key is NEVER in frontend code
   ===================================================== */

// ── Session ID ─────────────────────────────────────────
// Each browser gets a unique session ID stored in localStorage
// This is how we identify a user without requiring login
var SESSION_ID = localStorage.getItem('cv_session');
if (!SESSION_ID) {
  SESSION_ID = 'u_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
  localStorage.setItem('cv_session', SESSION_ID);
}

// ── API Helper ─────────────────────────────────────────
// All requests go to our Node.js backend
function api(path, method, body) {
  var options = {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);

  return fetch(CONFIG.API_URL + path, options)
    .then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error(d.error || 'Server error ' + r.status);
        return d;
      });
    });
}

// ── Compatibility layer ────────────────────────────────
// The UI markup was refreshed, but this script still uses legacy IDs.
// Keep the logic stable by mapping the old selectors to the current DOM.
var nativeGetElementById = document.getElementById.bind(document);
var ID_ALIASES = {
  'page-analyze': 'mode-analyze',
  'page-convert': 'mode-convert',
  'tab-analyze': 'nav-analyze',
  'tab-convert': 'nav-convert',
  'code-in': 'code-input',
  'lang-sel': 'lang-select',
  'lnums': 'line-numbers',
  'meta': 'char-count',
  'det-label': 'detected-lang',
  'err-bar': 'error-bar',
  'btn-analyze': 'analyze-btn',
  'conv-in': 'conv-input',
  'conv-lnums': 'conv-in-lnums',
  'btn-convert': 'convert-btn',
  'conv-err': 'conv-err-bar',
  'btn-example': 'example-btn',
  'btn-clear': 'clear-btn',
  'btn-conv-ex': 'conv-example-btn',
  'btn-conv-clear': 'conv-clear-btn',
  'btn-copy-fixed': 'copy-fixed-btn',
  'fixed-out': 'fixed-code',
  'changes-out': 'fixed-changes',
  'ring': 'score-prog',
  'score-num': 'big-score',
  'verdict': 'score-verdict',
  'metrics': 'breakdown-grid',
  'lines-out': 'lines-table',
  'errors-out': 'errors-list',
  'tips-out': 'sug-grid',
  'cx-out': 'complexity-card',
  'sum-out': 'summary-card',
  'btn-copy-conv': 'copy-conv-btn',
  'conv-out': 'conv-output',
  'conv-from-lbl': 'conv-from-label',
  'conv-to-lbl': 'conv-to-label',
  'conv-notes': 'conv-notes-card',
  'hist-badge': 'history-count',
  'modal-history': 'history-modal',
  'h-chart': 'history-chart',
  'h-list': 'history-list',
  'h-detail': 'history-detail',
  'modal-interview': 'interview-modal',
  'iv-content': 'interview-content'
};

document.getElementById = function (id) {
  return nativeGetElementById(id) || nativeGetElementById(ID_ALIASES[id]) || null;
};

function normalizeCurrentMarkup() {
  var convNotesWrap = nativeGetElementById('conv-notes-wrap');
  var convNotesCard = nativeGetElementById('conv-notes-card');

  if (convNotesWrap && convNotesCard) {
    convNotesWrap.classList.remove('hidden');
    convNotesCard.classList.add('hidden');
  }

  ['conv-out-lnums', 'conv-output', 'copy-conv-btn'].forEach(function (id) {
    var el = nativeGetElementById(id);
    if (el && el.style.display === 'none') {
      el.style.display = '';
      el.classList.add('hidden');
    }
  });
}

normalizeCurrentMarkup();

// ── Mode Switch ────────────────────────────────────────
function switchMode(t) {
  document.getElementById('mode-analyze').classList.toggle('hidden', t !== 'analyze');
  document.getElementById('mode-convert').classList.toggle('hidden', t !== 'convert');
  document.getElementById('nav-analyze').classList.toggle('active', t === 'analyze');
  document.getElementById('nav-convert').classList.toggle('active', t === 'convert');
}

var switchTab = switchMode;
window.switchMode = switchMode;

// ── Example Code ───────────────────────────────────────
var EX = {
  Python:
    "def calculate_average(numbers):\n" +
    "    total = 0\n" +
    "    for n in numbers:\n" +
    "        total = total + n\n" +
    "    avg = total / len(numbers)\n" +
    "    return avg\n\n" +
    "scores = [85, 92, 78, 95, 88]\n" +
    "print('Average:', calculate_average(scores))",

  JavaScript:
    "function findMax(arr) {\n" +
    "  var max = arr[0];\n" +
    "  for (var i = 0; i < arr.length; i++) {\n" +
    "    if (arr[i] > max) max = arr[i];\n" +
    "  }\n" +
    "  return max;\n" +
    "}\n" +
    "console.log(findMax([3, 7, 1, 9, 4]));",

  Java:
    "public class Fibonacci {\n" +
    "    public static void main(String[] args) {\n" +
    "        int n = 10, a = 0, b = 1;\n" +
    "        System.out.print(a + \" \" + b);\n" +
    "        for (int i = 2; i < n; i++) {\n" +
    "            int c = a + b;\n" +
    "            System.out.print(\" \" + c);\n" +
    "            a = b; b = c;\n" +
    "        }\n" +
    "    }\n" +
    "}",

  "C++":
    "#include <iostream>\n" +
    "using namespace std;\n\n" +
    "bool isPrime(int n) {\n" +
    "    if (n < 2) return false;\n" +
    "    for (int i = 2; i <= n/2; i++)\n" +
    "        if (n % i == 0) return false;\n" +
    "    return true;\n" +
    "}\n\n" +
    "int main() {\n" +
    "    for (int i = 2; i <= 20; i++)\n" +
    "        if (isPrime(i)) cout << i << \" \";\n" +
    "    return 0;\n" +
    "}",

  C:
    "#include <stdio.h>\n\n" +
    "int factorial(int n) {\n" +
    "    if (n == 0) return 1;\n" +
    "    return n * factorial(n - 1);\n" +
    "}\n\n" +
    "int main() {\n" +
    "    printf(\"Factorial of 5 = %d\\n\", factorial(5));\n" +
    "    return 0;\n" +
    "}"
};

// ── DOM Refs ───────────────────────────────────────────
var codeIn    = document.getElementById('code-in');
var langSel   = document.getElementById('lang-sel');
var lnums     = document.getElementById('lnums');
var metaEl    = document.getElementById('meta');
var detLabel  = document.getElementById('det-label');
var errBar    = document.getElementById('err-bar');
var results   = document.getElementById('results');
var btnAn     = document.getElementById('btn-analyze');
var convIn    = document.getElementById('conv-in');
var convLnums = document.getElementById('conv-lnums');
var btnConv   = document.getElementById('btn-convert');
var convErr   = document.getElementById('conv-err');

hideErr(errBar);
hideErr(convErr);
document.getElementById('kb-hint').innerHTML =
  'Shortcuts <kbd>Ctrl</kbd><span>+</span><kbd>Enter</kbd><span>analyze</span> <kbd>Ctrl</kbd><span>+</span><kbd>K</kbd><span>clear</span> <kbd>Esc</kbd><span>close modals</span>';

// ── Language Detection (runs locally — no API call) ────
var LP = [
  { lang: 'Python',     rx: [/^\s*def\s+\w+\s*\(/m, /^\s*import\s+\w/m, /\bprint\s*\(/m, /^\s*(if|elif|else|for|while|try|except|with|class)\b.*:\s*$/m] },
  { lang: 'JavaScript', rx: [/\bconsole\.log\b/, /\bfunction\s+\w+\s*\(/, /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*/, /=>\s*[{(]?/] },
  { lang: 'TypeScript', rx: [/:\s*(string|number|boolean|void|any)\b/, /interface\s+\w+/, /type\s+\w+\s*=/] },
  { lang: 'Java',       rx: [/public\s+class\s+\w+/, /public\s+static\s+void\s+main/, /System\.out\./] },
  { lang: 'C++',        rx: [/#include\s*<iostream>/, /std::/, /cout\s*<</, /using\s+namespace/] },
  { lang: 'C',          rx: [/#include\s*<stdio\.h>/, /printf\s*\(/, /scanf\s*\(/, /int\s+main\s*\(/] },
  { lang: 'Go',         rx: [/^package\s+\w+/m, /func\s+\w+\s*\(/, /fmt\./, /:=\s*/] },
  { lang: 'Rust',       rx: [/fn\s+main\s*\(\)/, /let\s+mut\s+/, /println!\s*\(/] },
  { lang: 'PHP',        rx: [/<\?php/, /\$\w+\s*=/, /echo\s+/] },
  { lang: 'Swift',      rx: [/func\s+\w+\s*\(/, /var\s+\w+\s*:/, /let\s+\w+\s*:/] }
];

var CODE_INPUT_ERROR = 'Please paste actual code. Plain English, questions, or simple math expressions are not supported.';

function detectLang(code) {
  if (!code.trim()) return null;
  var best = null, top = 0;
  LP.forEach(function (p) {
    var s = p.rx.filter(function (r) { return r.test(code); }).length;
    if (s > top) { top = s; best = p.lang; }
  });
  return top >= 1 ? best : null;
}

function looksLikeStructuredData(text) {
  if (!/^\s*[{[][\s\S]*[}\]]\s*$/.test(text)) return false;
  return /["'][^"']+["']\s*:/.test(text) || /\[[^\]]*(,|{|\[)/.test(text);
}

function isLikelyCodeInput(text) {
  var value = String(text || '').trim();
  var score = 0;

  if (!value) return false;
  if (detectLang(value)) return true;
  if (/<\/?[a-z][\w:-]*[^>]*>/i.test(value)) return true;
  if (looksLikeStructuredData(value)) return true;
  if (/\b(select|insert|update|delete|create|alter|drop)\b[\s\S]+\b(from|into|table|where|values|set)\b/i.test(value)) return true;

  if (/\b[A-Za-z_$][\w$]*\s*=\s*[^=\s]/.test(value)) score += 2;
  if (/\b[A-Za-z_$][\w$]*\s*\([^)]*\)/.test(value)) score += 2;
  if (/=>|==|!=|<=|>=|&&|\|\||::|->|<-|:=/.test(value)) score += 2;
  if (/[{};]/.test(value)) score += 1;
  if (/\b(if|else|for|while|return|class|def|func|switch|case|try|catch|const|let|var|public|private|package|import|from|using|namespace)\b/.test(value)) score += 1;
  if (/\b[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*/.test(value)) score += 1;

  return score >= 2;
}

function getCodeInputError(text, emptyMessage) {
  var value = String(text || '').trim();
  if (!value) return emptyMessage;
  if (!isLikelyCodeInput(value)) return CODE_INPUT_ERROR;
  return '';
}

function refreshDetect() {
  if (langSel.value === 'auto') {
    var d = detectLang(codeIn.value);
    detLabel.textContent = d ? '→ ' + d + ' detected' : '→ paste to detect';
    detLabel.style.color = d ? 'var(--mint-h)' : 'var(--t2)';
  } else {
    detLabel.textContent = '';
  }
}

// ── Editor helpers ─────────────────────────────────────
function updateEditor() {
  var lines = codeIn.value.split('\n');
  lnums.textContent = lines.map(function (_, i) { return i + 1; }).join('\n');
  metaEl.textContent = lines.length + ' lines · ' + codeIn.value.length + ' chars';
}

function updateConvNums() {
  var lines = convIn.value.split('\n');
  convLnums.textContent = lines.map(function (_, i) { return i + 1; }).join('\n');
}

updateEditor();
updateConvNums();

codeIn.addEventListener('input',  function () { updateEditor(); refreshDetect(); });
codeIn.addEventListener('scroll', function () { lnums.scrollTop = codeIn.scrollTop; });
langSel.addEventListener('change', refreshDetect);
convIn.addEventListener('input',  updateConvNums);
convIn.addEventListener('scroll', function () { convLnums.scrollTop = convIn.scrollTop; });

// ── Tabs ───────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(function (t) {
  t.addEventListener('click', function () {
    document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
    document.querySelectorAll('.tab-panel').forEach(function (x) { x.classList.remove('active'); });
    t.classList.add('active');
    document.getElementById('tab-' + t.dataset.tab).classList.add('active');
  });
});

// ── Example / Clear ────────────────────────────────────
document.getElementById('btn-example').addEventListener('click', function () {
  var lang = langSel.value === 'auto' ? 'Python' : langSel.value;
  codeIn.value = EX[lang] || EX.Python;
  updateEditor(); refreshDetect();
});

document.getElementById('btn-clear').addEventListener('click', function () {
  codeIn.value = ''; updateEditor();
  detLabel.textContent = '';
  hideErr(errBar);
  results.classList.add('hidden');
});

document.getElementById('btn-conv-ex').addEventListener('click', function () {
  var lang = document.getElementById('conv-from').value;
  if (lang === 'auto') lang = 'Python';
  convIn.value = EX[lang] || EX.Python;
  updateConvNums();
});

document.getElementById('btn-conv-clear').addEventListener('click', function () {
  convIn.value = ''; updateConvNums();
  resetConvOut(); hideErr(convErr);
});

// ── Utility ────────────────────────────────────────────
function setLoad(btn, on) {
  btn.disabled = on;
  btn.classList.toggle('loading', on);
}

function showErr(bar, msg) {
  if (!bar) return;
  bar.textContent = '⚠ ' + msg;
  bar.classList.remove('hidden');
  bar.classList.add('show');
}

function hideErr(bar) {
  if (!bar) return;
  bar.classList.remove('show');
  bar.classList.add('hidden');
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeCodeBlockText(text) {
  var value = String(text || '');
  if (!value) return '';
  if (value.indexOf('\n') >= 0 || value.indexOf('\r') >= 0) return value;
  if (value.indexOf('\\n') < 0 && value.indexOf('\\r') < 0 && value.indexOf('\\t') < 0) return value;

  return value
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, '\t');
}

// ── Copy buttons ───────────────────────────────────────
document.getElementById('btn-copy-fixed').addEventListener('click', function () {
  var text = document.getElementById('fixed-out').textContent;
  navigator.clipboard.writeText(text).then(function () {
    var btn = document.getElementById('btn-copy-fixed');
    btn.textContent = '✓ Copied!';
    setTimeout(function () { btn.textContent = 'Copy'; }, 2000);
  });
});

document.getElementById('btn-copy-conv').addEventListener('click', function () {
  var text = document.getElementById('conv-out').textContent;
  navigator.clipboard.writeText(text).then(function () {
    var btn = document.getElementById('btn-copy-conv');
    btn.textContent = '✓ Copied!';
    setTimeout(function () { btn.textContent = 'Copy'; }, 2000);
  });
});

// ── Keyboard shortcuts ─────────────────────────────────
document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (!btnAn.disabled) btnAn.click(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k')     { e.preventDefault(); document.getElementById('btn-clear').click(); }
  if (e.key === 'Escape') { closeHistory(); closeInterview(); }
});

// ══════════════════════════════════════════════════════
//   SYNTAX HIGHLIGHTER (runs locally)
// ══════════════════════════════════════════════════════
var KW = {
  Python:     ['def','return','if','elif','else','for','while','import','from','as','class','in','not','and','or','True','False','None','lambda','pass','break','continue','with','try','except','finally','raise','yield'],
  JavaScript: ['function','return','if','else','for','while','var','let','const','class','new','this','import','export','from','async','await','try','catch','throw','typeof','instanceof','in','of','break','continue','switch','case','default','null','undefined','true','false'],
  TypeScript: ['function','return','if','else','for','while','var','let','const','class','new','this','import','export','async','await','interface','type','enum','public','private','protected','readonly','null','undefined','true','false'],
  Java:       ['public','private','protected','class','interface','extends','implements','return','if','else','for','while','new','this','super','static','void','final','abstract','try','catch','finally','throw','import','null','true','false','int','long','double','float','boolean','char','String'],
  'C++':      ['int','long','double','float','char','bool','void','return','if','else','for','while','class','struct','public','private','new','delete','namespace','using','const','static','true','false','nullptr','auto','break','continue'],
  C:          ['int','long','double','float','char','void','return','if','else','for','while','struct','typedef','sizeof','static','const','break','continue','switch','case','default','NULL'],
  Go:         ['func','return','if','else','for','var','const','type','struct','interface','package','import','go','chan','select','case','default','defer','range','map','make','new','nil','true','false','break','continue','switch'],
  Rust:       ['fn','return','if','else','for','while','let','mut','const','struct','impl','trait','pub','use','mod','match','loop','break','continue','true','false','None','Some','Ok','Err','self'],
  PHP:        ['function','return','if','else','elseif','for','foreach','while','class','new','echo','null','true','false','public','private','protected','static','extends','namespace','use','try','catch','throw'],
  Swift:      ['func','return','if','else','for','while','var','let','class','struct','enum','import','switch','case','default','break','continue','true','false','nil','guard','self','override','init']
};

function highlight(code, lang) {
  var kws = KW[lang] || [];
  return code.split('\n').map(function (line) { return hlLine(line, lang, kws); }).join('\n');
}

function hlLine(line, lang, kws) {
  var cmtChar = lang === 'Python' ? '#' : '//';
  var trimmed = line.trimLeft();
  if (trimmed.indexOf(cmtChar) === 0) {
    return '<span class="tok-cmt">' + esc(line) + '</span>';
  }
  var cmtIdx = -1, inStr = false, strCh = '';
  for (var i = 0; i < line.length - 1; i++) {
    var c = line[i];
    if (!inStr && (c === '"' || c === "'")) { inStr = true; strCh = c; }
    else if (inStr && c === strCh && line[i - 1] !== '\\') { inStr = false; }
    else if (!inStr && line.substr(i, cmtChar.length) === cmtChar) { cmtIdx = i; break; }
    else if (!inStr && lang === 'Python' && c === '#') { cmtIdx = i; break; }
  }
  var codePart = cmtIdx >= 0 ? line.substring(0, cmtIdx) : line;
  var cmtPart  = cmtIdx >= 0 ? '<span class="tok-cmt">' + esc(line.substring(cmtIdx)) + '</span>' : '';
  return tokenize(codePart, kws) + cmtPart;
}

function tokenize(code, kws) {
  var out = '', i = 0;
  while (i < code.length) {
    var c = code[i];
    if (c === '"' || c === "'") {
      var q = c, j = i + 1;
      while (j < code.length && !(code[j] === q && code[j - 1] !== '\\')) j++;
      out += '<span class="tok-str">' + esc(code.substring(i, j + 1)) + '</span>';
      i = j + 1; continue;
    }
    if (/[0-9]/.test(c) && (i === 0 || /\W/.test(code[i - 1]))) {
      var j = i;
      while (j < code.length && /[0-9._xXbBoO]/.test(code[j])) j++;
      out += '<span class="tok-num">' + esc(code.substring(i, j)) + '</span>';
      i = j; continue;
    }
    if (/[a-zA-Z_$]/.test(c)) {
      var j = i;
      while (j < code.length && /[a-zA-Z0-9_$]/.test(code[j])) j++;
      var word  = code.substring(i, j);
      var after = code.substring(j).trimLeft();
      if (kws.indexOf(word) >= 0)  out += '<span class="tok-kw">'   + esc(word) + '</span>';
      else if (after[0] === '(')   out += '<span class="tok-fn">'   + esc(word) + '</span>';
      else                         out += '<span class="tok-base">' + esc(word) + '</span>';
      i = j; continue;
    }
    if (/[+\-*/%=<>!&|^~?:.]/.test(c)) {
      out += '<span class="tok-op">' + esc(c) + '</span>';
      i++; continue;
    }
    out += esc(c); i++;
  }
  return out;
}

// ══════════════════════════════════════════════════════
//   ANALYZER
// ══════════════════════════════════════════════════════
var lastData = null, lastCode = '', lastLang = '';

btnAn.addEventListener('click', function () {
  var code = codeIn.value.trim();
  var analyzeError = getCodeInputError(code, 'Please paste some code first.');
  if (analyzeError) { showErr(errBar, analyzeError); return; }

  var lang = langSel.value;
  if (lang === 'auto') {
    lang = detectLang(code) || 'Unknown';
    detLabel.textContent = '→ ' + lang + ' detected';
    detLabel.style.color = 'var(--mint-h)';
  }

  lastCode = code; lastLang = lang;
  setLoad(btnAn, true);
  hideErr(errBar);
  results.classList.add('hidden');

  // POST to backend — backend calls Gemini and saves to MongoDB
  api('/api/analyze', 'POST', { code: code, language: lang, sessionId: SESSION_ID })
    .then(function (res) {
      lastData = res.data;
      saveLocalAnalysis(res.data, code, lang);
      renderAll(res.data);
      loadHistBadge();
    })
    .catch(function (e) { showErr(errBar, e.message); })
    .finally(function () { setLoad(btnAn, false); });
});

// ── Render all results ─────────────────────────────────
function renderAll(d) {
  renderScore(d);
  renderLines(d.lines || []);
  renderErrors(d.errors || []);
  renderTips(d.suggestions || []);
  renderFixed(d.fixed_code || '', d.changes || []);
  renderCX(d.complexity || null);
  renderSummary(d.summary || {});

  // Reset to Lines tab
  document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
  document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
  document.querySelector('.tab[data-tab="lines"]').classList.add('active');
  document.getElementById('tab-lines').classList.add('active');

  results.classList.remove('hidden');
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderScore(d) {
  var score = Math.min(10, Math.max(0, d.score || 0));
  var circ  = 314;
  var ring  = document.getElementById('ring');
  ring.style.strokeDashoffset = circ;
  setTimeout(function () { ring.style.strokeDashoffset = circ - (score / 10) * circ; }, 80);

  var numEl = document.getElementById('score-num');
  var cur = 0;
  var timer = setInterval(function () {
    cur = Math.min(cur + 0.2, score);
    numEl.textContent = cur.toFixed(1);
    if (cur >= score) { numEl.textContent = score.toFixed(1); clearInterval(timer); }
  }, 25);

  var verd = document.getElementById('verdict');
  var v    = d.verdict || (score >= 8 ? 'Excellent' : score >= 6 ? 'Good' : score >= 4 ? 'Average' : score >= 2 ? 'Needs Work' : 'Poor');
  var col  = score >= 8 ? 'var(--mint-h)' : score >= 5 ? 'var(--amber)' : 'var(--red)';
  var bg   = score >= 8 ? 'rgba(45,212,191,0.1)' : score >= 5 ? 'rgba(245,200,66,0.1)' : 'rgba(240,96,128,0.1)';
  verd.textContent = v; verd.style.color = col; verd.style.borderColor = col; verd.style.background = bg;

  var m = d.metrics || {};
  var rows = [
    { k: 'readability',    l: 'Readability',    c: 'var(--blue)' },
    { k: 'efficiency',     l: 'Efficiency',      c: 'var(--purple)' },
    { k: 'best_practices', l: 'Best Practices',  c: 'var(--mint-h)' },
    { k: 'documentation',  l: 'Documentation',   c: 'var(--amber)' }
  ];
  document.getElementById('metrics').innerHTML = rows.map(function (r) {
    return '<div class="metric-item">'
      + '<span class="metric-name">' + r.l + '</span>'
      + '<div class="metric-bar-bg"><div class="metric-bar" id="mb-' + r.k + '" style="background:' + r.c + '"></div></div>'
      + '<span class="metric-val" style="color:' + r.c + '">' + (m[r.k] != null ? m[r.k] : '—') + '/10</span>'
      + '</div>';
  }).join('');

  setTimeout(function () {
    rows.forEach(function (r) {
      var el = document.getElementById('mb-' + r.k);
      if (el) el.style.width = ((m[r.k] || 0) / 10 * 100) + '%';
    });
  }, 200);
}

function renderLines(lines) {
  var tc = { info: 'ti', good: 'tg', warn: 'tw', error: 'te' };
  var c  = document.getElementById('lines-out');
  c.innerHTML = lines.map(function (l) {
    var copyCode = JSON.stringify(String(l.code || ''));
    return '<div class="line-row">'
      + '<div class="ln">' + l.line_number + '</div>'
      + '<div class="lb">'
      + '<div class="lcode-row"><code class="lcode">' + esc(l.code) + '</code>'
      + '<button class="copy-line-btn" onclick=\'navigator.clipboard.writeText(' + copyCode + ');this.textContent="✓";var t=this;setTimeout(function(){t.textContent="⎘";},1500)\'>⎘</button></div>'
      + '<span class="ltag ' + (tc[l.tag] || 'ti') + '">' + (l.tag || 'info').toUpperCase() + '</span>'
      + '<div class="lexpl">' + esc(l.explanation) + '</div>'
      + '</div></div>';
  }).join('') || '<div style="padding:22px;color:var(--t2);text-align:center">No lines returned.</div>';
}

function renderErrors(errors) {
  var c = document.getElementById('errors-out');
  if (!errors || !errors.length) {
    c.innerHTML = '<div class="no-err"><span>✅</span>No errors found!</div>'; return;
  }
  c.innerHTML = errors.map(function (e) {
    var icon = e.icon || (e.type === 'warning' ? '🟡' : e.type === 'info' ? '🔵' : '🔴');
    var cls  = 'erow' + (e.type === 'warning' ? ' ew' : e.type === 'info' ? ' ei' : '');
    return '<div class="' + cls + '">'
      + '<div class="eico">' + icon + '</div>'
      + '<div class="ebody">'
      + '<div class="emeta">' + (e.line_number ? 'Line ' + e.line_number : 'General') + ' · ' + (e.type || 'error').toUpperCase() + '</div>'
      + '<div class="emsg">' + esc(e.message) + '</div>'
      + '<div class="efix">Fix: ' + esc(e.fix) + '</div>'
      + '</div></div>';
  }).join('');
}

function renderTips(sugs) {
  var pm = { high: 'ph', med: 'pm', low: 'pl' };
  var pb = { high: 'prih', med: 'prim', low: 'pril' };
  document.getElementById('tips-out').innerHTML = (sugs || []).map(function (s) {
    return '<div class="sug-card ' + (pm[s.priority] || 'pl') + '">'
      + '<div class="sh">'
      + '<span class="si">' + (s.icon || '💡') + '</span>'
      + '<span class="st">' + esc(s.title) + '</span>'
      + '<span class="pri ' + (pb[s.priority] || 'pril') + '">' + (s.priority || 'low').toUpperCase() + '</span>'
      + '</div>'
      + '<div class="sb">' + esc(s.body) + '</div>'
      + '</div>';
  }).join('') || '<div style="padding:22px;color:var(--t2);text-align:center">No suggestions returned.</div>';
}

function renderFixed(code, changes) {
  var el = document.getElementById('fixed-out');
  var nu = document.getElementById('fixed-lnums');
  var ch = document.getElementById('changes-out');
  code = normalizeCodeBlockText(code).trim();
  if (!code) {
    el.innerHTML = '<span style="color:var(--t3)">// No corrections needed.</span>';
    nu.textContent = '1'; ch.innerHTML = ''; return;
  }
  var lines = code.split('\n');
  nu.textContent = lines.map(function (_, i) { return i + 1; }).join('\n');
  var lang = langSel.value === 'auto' ? (detectLang(code) || 'Python') : langSel.value;
  el.innerHTML = highlight(code, lang);
  if (changes && changes.length) {
    ch.innerHTML = '<div class="changes-ttl">What Changed</div>'
      + changes.map(function (c) {
          return '<div class="chg"><span class="chg-ln">' + esc(String(c.line || 'General')) + '</span><span class="chg-desc">' + esc(c.description) + '</span></div>';
        }).join('');
  } else { ch.innerHTML = ''; }
}

function boc(n) {
  if (!n) return 'var(--t2)';
  var s = String(n).toLowerCase();
  if (s === 'o(1)') return 'var(--mint-h)';
  if (s.indexOf('log') >= 0) return 'var(--mint-h)';
  if (s === 'o(n)') return 'var(--blue)';
  if (s.indexOf('n log') >= 0) return 'var(--amber)';
  if (s.indexOf('n^2') >= 0 || s.indexOf('n*n') >= 0) return 'var(--red)';
  if (s.indexOf('2^n') >= 0 || s.indexOf('n!') >= 0) return 'var(--red)';
  return 'var(--purple)';
}

function renderCX(cx) {
  var el = document.getElementById('cx-out');
  if (!cx) { el.innerHTML = '<div style="padding:28px;text-align:center;color:var(--t2)">No complexity data.</div>'; return; }
  var t = cx.time || {}, sp = cx.space || {}, bd = cx.breakdown || [];
  var tc = boc(t.overall), sc = boc(sp.overall);
  var cases = [
    { l: 'Best',    v: t.best,    c: 'var(--mint-h)' },
    { l: 'Average', v: t.average, c: 'var(--amber)' },
    { l: 'Worst',   v: t.worst,   c: 'var(--red)' }
  ];
  var bdH = '';
  if (bd.length) {
    bdH = '<div class="cx-bk-ttl">Function Breakdown</div><div class="cx-bk">'
      + bd.map(function (b) {
          var bc = boc(b.time), sc2 = boc(b.space);
          return '<div class="cx-bk-row">'
            + '<span class="cx-bk-name">' + esc(b.section || '—') + '</span>'
            + '<span class="cx-badge" style="color:' + bc + ';border-color:' + bc + ';background:rgba(0,0,0,0.2)">T: ' + esc(b.time || '—') + '</span>'
            + '<span class="cx-badge" style="color:' + sc2 + ';border-color:' + sc2 + ';background:rgba(0,0,0,0.2)">S: ' + esc(b.space || '—') + '</span>'
            + '<span class="cx-bk-note">' + esc(b.note || '') + '</span>'
            + '</div>';
        }).join('') + '</div>';
  }
  var tipH = cx.optimization_tip
    ? '<div class="cx-tip"><span class="cx-tip-ico">⚡</span><div><div class="cx-tip-ttl">Optimization Tip</div><div class="cx-tip-body">' + esc(cx.optimization_tip) + '</div></div></div>'
    : '';

  el.innerHTML = '<div class="cx-hero">'
    + '<div class="cx-bb"><div class="cx-lbl">Time Complexity</div><div class="cx-val" style="color:' + tc + '">' + esc(t.overall || '—') + '</div><div class="cx-sub">Overall</div></div>'
    + '<div class="cx-div"></div>'
    + '<div class="cx-bb"><div class="cx-lbl">Space Complexity</div><div class="cx-val" style="color:' + sc + '">' + esc(sp.overall || '—') + '</div><div class="cx-sub">Overall</div></div>'
    + '</div>'
    + '<div class="cx-cases">' + cases.map(function (c) { return '<div class="cx-case"><div class="cx-case-lbl">' + c.l + '</div><div class="cx-case-val" style="color:' + c.c + '">' + esc(c.v || '—') + '</div></div>'; }).join('') + '</div>'
    + '<div class="cx-explains">'
    + '<div class="cx-exp"><div class="cx-exp-ttl">Time Explained</div><div class="cx-exp-body">' + esc(t.explanation || '') + '</div></div>'
    + '<div class="cx-exp"><div class="cx-exp-ttl">Space Explained</div><div class="cx-exp-body">' + esc(sp.explanation || '') + '</div></div>'
    + '</div>'
    + bdH + tipH;
}

function renderSummary(s) {
  document.getElementById('sum-out').innerHTML =
    '<div class="sum-s"><div class="sum-lbl">Overview</div><div class="sum-body">'     + esc(s.overview   || '') + '</div></div>'
    + '<div class="sum-s"><div class="sum-lbl">Strengths</div><div class="sum-body">' + esc(s.strengths  || '') + '</div></div>'
    + '<div class="sum-s"><div class="sum-lbl">Weaknesses</div><div class="sum-body">'+ esc(s.weaknesses || '') + '</div></div>';
}

// ══════════════════════════════════════════════════════
//   CONVERTER
// ══════════════════════════════════════════════════════
function resetConvOut() {
  document.getElementById('conv-ph').classList.remove('hidden');
  document.getElementById('conv-out-lnums').classList.add('hidden');
  document.getElementById('conv-out').classList.add('hidden');
  document.getElementById('conv-out').innerHTML = '';
  document.getElementById('conv-out-lnums').textContent = '1';
  document.getElementById('btn-copy-conv').classList.add('hidden');
  document.getElementById('conv-to-lbl').textContent = 'Converted Code';
  document.getElementById('conv-notes').classList.add('hidden');
  document.getElementById('conv-notes').innerHTML = '';
}

document.getElementById('conv-from').addEventListener('change', function () {
  document.getElementById('conv-from-lbl').textContent = (this.value === 'auto' ? 'Input' : this.value) + ' Code';
});
document.getElementById('conv-to').addEventListener('change', function () {
  document.getElementById('conv-to-lbl').textContent = this.value + ' (Converted)';
});

btnConv.addEventListener('click', function () {
  var code = convIn.value.trim();
  var convertError = getCodeInputError(code, 'Paste some code to convert.');
  if (convertError) { showErr(convErr, convertError); return; }
  var from = document.getElementById('conv-from').value;
  if (from === 'auto') from = detectLang(code) || 'Unknown';
  var to = document.getElementById('conv-to').value;
  if (from === to) { showErr(convErr, 'Source and target are the same language.'); return; }

  setLoad(btnConv, true); hideErr(convErr); resetConvOut();

  // POST to backend
  api('/api/convert', 'POST', { code: code, from: from, to: to })
    .then(function (res) {
      var d     = res.data;
      var code2 = normalizeCodeBlockText(d.converted_code || '').trim();
      if (!code2) { showErr(convErr, 'Conversion returned empty. Try again.'); document.getElementById('conv-ph').classList.remove('hidden'); return; }

      var lines = code2.split('\n');
      var ol    = document.getElementById('conv-out-lnums');
      var op    = document.getElementById('conv-out');
      ol.textContent = lines.map(function (_, i) { return i + 1; }).join('\n');
      op.innerHTML   = highlight(code2, to);

      document.getElementById('conv-ph').classList.add('hidden');
      ol.classList.remove('hidden');
      op.classList.remove('hidden');
      document.getElementById('btn-copy-conv').classList.remove('hidden');
      document.getElementById('conv-to-lbl').textContent = to + ' (Converted)';

      var notes = d.notes || [], warns = d.warnings || [];
      if (notes.length || warns.length) {
        var nc = document.getElementById('conv-notes');
        nc.classList.remove('hidden');
        nc.innerHTML = '<div class="notes-box"><div class="notes-ttl">✦ Notes — ' + from + ' → ' + to + '</div>'
          + notes.map(function (n) { return '<div class="note-row"><span style="color:var(--blue)">ℹ</span>' + esc(n) + '</div>'; }).join('')
          + warns.map(function (w) { return '<div class="note-row"><span style="color:var(--amber)">⚠</span>' + esc(w) + '</div>'; }).join('')
          + '</div>';
      }
    })
    .catch(function (e) { showErr(convErr, e.message); document.getElementById('conv-ph').classList.remove('hidden'); })
    .finally(function () { setLoad(btnConv, false); });
});

// ══════════════════════════════════════════════════════
//   HISTORY — fetched from MongoDB via backend
// ══════════════════════════════════════════════════════
var historyState = {
  list: [],
  details: {},
  selectedId: null
};

var LOCAL_HISTORY_KEY = 'cv_history_v2_' + SESSION_ID;

function readLocalHistory() {
  try {
    var raw = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

function writeLocalHistory(list) {
  localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify((list || []).slice(0, 20)));
}

function historyFingerprint(entry) {
  var code = String((entry && (entry.sourceCode || entry.code)) || '').trim();
  return [
    String((entry && entry.language) || 'Unknown'),
    String((entry && entry.verdict) || ''),
    Number((entry && entry.score) || 0).toFixed(1),
    code
  ].join('||');
}

function saveLocalAnalysis(data, code, language) {
  var cx = (data && data.complexity) || {};
  var item = {
    _id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    __source: 'local',
    language: language || 'Unknown',
    code: String(code || '').substring(0, 500),
    sourceCode: String(code || ''),
    score: Number((data && data.score) || 0),
    verdict: String((data && data.verdict) || ''),
    lineCount: String(code || '').split('\n').length,
    errorCount: ((data && data.errors) || []).length,
    timeComplex: cx.time ? (cx.time.overall || '') : '',
    spaceComplex: cx.space ? (cx.space.overall || '') : '',
    snapshotVersion: 1,
    analysisData: data || null,
    createdAt: new Date().toISOString()
  };

  var next = [item].concat(readLocalHistory().filter(function (entry) {
    return historyFingerprint(entry) !== historyFingerprint(item);
  }));

  writeLocalHistory(next);
}

function clearLocalHistory() {
  localStorage.removeItem(LOCAL_HISTORY_KEY);
}

function mergeHistoryEntries(serverHistory) {
  var merged = [];
  var seen = {};

  function addEntry(entry) {
    var normalized = normalizeHistoryEntry(entry);
    var key = historyFingerprint(normalized);
    if (!seen[key]) {
      seen[key] = normalized;
      merged.push(normalized);
      return;
    }

    if (!seen[key].analysisData && normalized.analysisData) {
      var idx = merged.indexOf(seen[key]);
      if (idx >= 0) merged[idx] = normalized;
      seen[key] = normalized;
    }
  }

  (serverHistory || []).forEach(addEntry);
  readLocalHistory().forEach(addEntry);

  return merged.sort(function (a, b) {
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
}

function normalizeHistoryEntry(entry, index) {
  entry = entry || {};
  entry.__id = String(entry._id || entry.__id || ('hist_' + index));
  entry.__source = entry.__source || (String(entry.__id).indexOf('local_') === 0 ? 'local' : 'server');
  return entry;
}

function historyScoreColor(score) {
  return score >= 8 ? 'var(--mint-h)' : score >= 5 ? 'var(--amber)' : 'var(--red)';
}

function historySnippet(code) {
  var text = String(code || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'No preview saved for this run.';
  return text.substring(0, 96) + (text.length > 96 ? '…' : '');
}

function historyDate(value) {
  return value ? new Date(value).toLocaleString() : 'Unknown time';
}

function hasOption(select, value) {
  return Array.prototype.some.call(select.options, function (opt) {
    return opt.value === value;
  });
}

function getHistorySummaryEntry(id) {
  return historyState.list.filter(function (entry) {
    return entry.__id === id;
  })[0] || null;
}

function renderHistoryEmpty(message) {
  document.getElementById('history-chart').innerHTML = '';
  document.getElementById('history-list').innerHTML =
    '<div class="history-empty">' + esc(message) + '</div>';
  document.getElementById('history-detail').innerHTML =
    '<div class="history-detail-empty"><div class="history-detail-empty-title">No saved report selected</div><div class="history-detail-empty-copy">Run an analysis and it will appear here with the full saved snapshot.</div></div>';
  document.getElementById('history-summary').textContent = '0 saved analyses';
}

function renderHistoryShell(hist) {
  var chart = document.getElementById('history-chart');
  var list = document.getElementById('history-list');
  var summary = document.getElementById('history-summary');

  if (!hist.length) {
    renderHistoryEmpty('No history yet. Analyze some code first!');
    return;
  }

  var avg = hist.reduce(function (sum, entry) {
    return sum + Number(entry.score || 0);
  }, 0) / hist.length;
  summary.textContent = hist.length + ' saved analyses · avg ' + avg.toFixed(1) + '/10';

  chart.innerHTML = hist.slice().reverse().map(function (entry) {
    var p = Math.max(6, Number(entry.score || 0) / 10 * 100);
    var c = historyScoreColor(Number(entry.score || 0));
    return '<button type="button" class="hc-bar-wrap js-history-select" data-history-id="' + entry.__id + '" title="' + esc(entry.language || 'Unknown') + ' — ' + Number(entry.score || 0).toFixed(1) + '/10">'
      + '<div class="hc-bar" style="height:' + p + '%;background:' + c + '"></div>'
      + '<div class="hc-label">' + Number(entry.score || 0).toFixed(1) + '</div></button>';
  }).join('');

  list.innerHTML = hist.map(function (entry) {
    var c = historyScoreColor(Number(entry.score || 0));
    return '<button type="button" class="h-entry js-history-select" data-history-id="' + entry.__id + '">'
      + '<div class="h-score" style="color:' + c + '">' + Number(entry.score || 0).toFixed(1) + '</div>'
      + '<div class="h-info">'
      + '<div class="h-top"><span class="h-lang">' + esc(entry.language || 'Unknown') + '</span><span class="h-verdict">' + esc(entry.verdict || 'Saved run') + '</span><span class="h-lines">' + Number(entry.lineCount || 0) + ' lines</span></div>'
      + '<div class="h-snippet">' + esc(historySnippet(entry.code)) + '</div>'
      + '<div class="h-date-row"><span class="h-date">' + historyDate(entry.createdAt) + '</span><span class="h-state">' + (entry.snapshotVersion ? 'Full report' : 'Summary only') + '</span></div>'
      + '</div></button>';
  }).join('');
}

function setHistoryActiveState() {
  document.querySelectorAll('.js-history-select').forEach(function (el) {
    el.classList.toggle('active', el.getAttribute('data-history-id') === historyState.selectedId);
  });
}

function renderHistoryDetailLoading(entry) {
  var title = entry ? esc(entry.language || 'Saved run') : 'Saved run';
  document.getElementById('history-detail').innerHTML =
    '<div class="history-detail-empty"><div class="history-detail-empty-title">Loading ' + title + ' report...</div><div class="history-detail-empty-copy">Pulling the full saved analysis so you can reopen every section.</div></div>';
}

function renderHistorySummaryCards(summary) {
  var cards = [
    { label: 'Overview', body: summary.overview || 'No overview saved.' },
    { label: 'Strengths', body: summary.strengths || 'No strengths saved.' },
    { label: 'Weaknesses', body: summary.weaknesses || 'No weaknesses saved.' }
  ];

  return '<div class="history-summary-grid">' + cards.map(function (card) {
    return '<div class="history-summary-card"><div class="history-summary-label">' + card.label + '</div><div class="history-summary-body">' + esc(card.body) + '</div></div>';
  }).join('') + '</div>';
}

function renderHistoryMetrics(metrics) {
  var rows = [
    { key: 'readability', label: 'Readability' },
    { key: 'efficiency', label: 'Efficiency' },
    { key: 'best_practices', label: 'Best Practices' },
    { key: 'documentation', label: 'Docs' }
  ];

  return '<div class="history-metrics-grid">' + rows.map(function (row) {
    var value = Number(metrics[row.key] || 0);
    return '<div class="history-metric"><div class="history-metric-top"><span>' + row.label + '</span><strong>' + value.toFixed(1) + '/10</strong></div><div class="history-metric-bar"><div class="history-metric-fill" style="width:' + (value * 10) + '%"></div></div></div>';
  }).join('') + '</div>';
}

function renderHistoryErrors(errors) {
  if (!errors.length) {
    return '<div class="history-empty-note">No issues were flagged in this saved run.</div>';
  }

  return '<div class="history-stack">' + errors.map(function (item) {
    return '<div class="history-note-card history-note-card-error">'
      + '<div class="history-note-head">' + esc(item.message || 'Issue') + '</div>'
      + '<div class="history-note-sub">' + esc((item.line_number ? 'Line ' + item.line_number + ' · ' : '') + (item.type || 'error').toUpperCase()) + '</div>'
      + '<div class="history-note-body">' + esc(item.fix || '') + '</div>'
      + '</div>';
  }).join('') + '</div>';
}

function renderHistorySuggestions(suggestions) {
  if (!suggestions.length) {
    return '<div class="history-empty-note">No extra suggestions were saved for this run.</div>';
  }

  return '<div class="history-stack">' + suggestions.map(function (item) {
    return '<div class="history-note-card history-note-card-tip">'
      + '<div class="history-note-head">' + esc((item.icon || '💡') + ' ' + (item.title || 'Suggestion')) + '</div>'
      + '<div class="history-note-sub">' + esc((item.priority || 'low').toUpperCase() + ' priority') + '</div>'
      + '<div class="history-note-body">' + esc(item.body || '') + '</div>'
      + '</div>';
  }).join('') + '</div>';
}

function renderHistoryChanges(changes) {
  if (!changes.length) {
    return '<div class="history-empty-note">No change log was saved for this run.</div>';
  }

  return '<div class="history-stack">' + changes.map(function (item) {
    return '<div class="history-note-card history-note-card-change">'
      + '<div class="history-note-head">' + esc(String(item.line || 'General')) + '</div>'
      + '<div class="history-note-body">' + esc(item.description || '') + '</div>'
      + '</div>';
  }).join('') + '</div>';
}

function renderHistoryComplexityBlock(cx) {
  if (!cx) {
    return '<div class="history-empty-note">No complexity analysis was saved for this run.</div>';
  }

  var time = cx.time || {};
  var space = cx.space || {};
  var breakdown = cx.breakdown || [];

  return '<div class="history-complexity-grid">'
    + '<div class="history-complexity-card"><div class="history-section-kicker">Time</div><div class="history-complexity-value">' + esc(time.overall || '—') + '</div><div class="history-complexity-body">' + esc(time.explanation || 'No explanation saved.') + '</div></div>'
    + '<div class="history-complexity-card"><div class="history-section-kicker">Space</div><div class="history-complexity-value">' + esc(space.overall || '—') + '</div><div class="history-complexity-body">' + esc(space.explanation || 'No explanation saved.') + '</div></div>'
    + '</div>'
    + (breakdown.length
        ? '<div class="history-breakdown">' + breakdown.map(function (item) {
            return '<div class="history-breakdown-row"><strong>' + esc(item.section || 'Section') + '</strong><span>T: ' + esc(item.time || '—') + '</span><span>S: ' + esc(item.space || '—') + '</span><p>' + esc(item.note || '') + '</p></div>';
          }).join('') + '</div>'
        : '')
    + (cx.optimization_tip
        ? '<div class="history-optimization-tip">' + esc(cx.optimization_tip) + '</div>'
        : '');
}

function renderHistoryCodeCard(title, code, lang) {
  code = normalizeCodeBlockText(code);
  if (!code) {
    return '<div class="history-empty-note">No code snapshot was saved here.</div>';
  }

  return '<div class="history-code-card">' + (title ? '<div class="history-section-title">' + title + '</div>' : '') + '<pre class="history-code-block">' + highlight(code, lang || 'Unknown') + '</pre></div>';
}

function renderHistoryLines(lines) {
  if (!lines.length) {
    return '<div class="history-empty-note">No line-by-line notes were saved for this run.</div>';
  }

  return '<details class="history-lines-panel"><summary>Line-by-line notes (' + lines.length + ')</summary>'
    + '<div class="history-lines-list">' + lines.map(function (line) {
        return '<div class="history-line-row"><div class="history-line-num">' + esc(String(line.line_number || '—')) + '</div><div><div class="history-line-code">' + esc(line.code || '') + '</div><div class="history-line-tag">' + esc((line.tag || 'info').toUpperCase()) + '</div><div class="history-line-body">' + esc(line.explanation || '') + '</div></div></div>';
      }).join('') + '</div></details>';
}

function renderHistoryDetail(entry) {
  var detail = document.getElementById('history-detail');
  var data = entry.analysisData || null;
  var sourceCode = entry.sourceCode || entry.code || '';
  var hasSnapshot = Boolean(data);
  var scoreColor = historyScoreColor(Number(entry.score || 0));

  if (!hasSnapshot) {
    detail.innerHTML = '<div class="history-detail-card">'
      + '<div class="history-detail-top">'
      + '<div><div class="history-section-kicker">Saved run</div><div class="history-detail-title">' + esc(entry.language || 'Unknown') + '</div><div class="history-detail-meta">' + esc(historyDate(entry.createdAt) + ' · ' + Number(entry.lineCount || 0) + ' lines · ' + Number(entry.errorCount || 0) + ' issues') + '</div></div>'
      + '<div class="history-score-badge" style="color:' + scoreColor + ';border-color:' + scoreColor + '">' + Number(entry.score || 0).toFixed(1) + '<span>/10</span></div>'
      + '</div>'
      + '<div class="history-detail-empty history-detail-empty-inline"><div class="history-detail-empty-title">Full report not available for this older item</div><div class="history-detail-empty-copy">New analyses now save the complete snapshot. Re-run this code once if you want the full drill-down view in history.</div></div>'
      + renderHistoryCodeCard('Saved Code Preview', sourceCode, entry.language)
      + '</div>';
    return;
  }

  detail.innerHTML = '<div class="history-detail-card">'
    + '<div class="history-detail-top">'
    + '<div><div class="history-section-kicker">Saved analysis</div><div class="history-detail-title">' + esc(entry.language || 'Unknown') + ' · ' + esc(entry.verdict || 'Saved run') + '</div><div class="history-detail-meta">' + esc(historyDate(entry.createdAt) + ' · ' + Number(entry.lineCount || 0) + ' lines · ' + Number(entry.errorCount || 0) + ' issues') + '</div></div>'
    + '<div class="history-score-badge" style="color:' + scoreColor + ';border-color:' + scoreColor + '">' + Number(entry.score || 0).toFixed(1) + '<span>/10</span></div>'
    + '</div>'
    + '<div class="history-detail-actions">'
    + '<button type="button" class="primary-btn history-open-btn" id="history-open-report">Open Full Report</button>'
    + '<button type="button" class="xbtn history-copy-btn" id="history-copy-source">Copy Source</button>'
    + '</div>'
    + renderHistoryMetrics(data.metrics || {})
    + renderHistorySummaryCards(data.summary || {})
    + '<div class="history-section-group"><div class="history-section-title">Original Code</div>' + renderHistoryCodeCard('', sourceCode, entry.language) + '</div>'
    + '<div class="history-section-group"><div class="history-section-title">Fixed Code</div>' + renderHistoryCodeCard('', data.fixed_code || '', entry.language) + '</div>'
    + '<div class="history-section-group"><div class="history-section-title">Issues</div>' + renderHistoryErrors(data.errors || []) + '</div>'
    + '<div class="history-section-group"><div class="history-section-title">Suggestions</div>' + renderHistorySuggestions(data.suggestions || []) + '</div>'
    + '<div class="history-section-group"><div class="history-section-title">What Changed</div>' + renderHistoryChanges(data.changes || []) + '</div>'
    + '<div class="history-section-group"><div class="history-section-title">Complexity</div>' + renderHistoryComplexityBlock(data.complexity || null) + '</div>'
    + '<div class="history-section-group">' + renderHistoryLines(data.lines || []) + '</div>'
    + '</div>';

  document.getElementById('history-open-report').addEventListener('click', function () {
    restoreHistoryAnalysis(entry.__id);
  });
  document.getElementById('history-copy-source').addEventListener('click', function () {
    var btn = this;
    navigator.clipboard.writeText(sourceCode).then(function () {
      btn.textContent = '✓ Copied';
      setTimeout(function () { btn.textContent = 'Copy Source'; }, 1600);
    });
  });
}

function renderHistoryDetailError(entry, message) {
  document.getElementById('history-detail').innerHTML =
    '<div class="history-detail-empty"><div class="history-detail-empty-title">Could not load this saved report</div><div class="history-detail-empty-copy">' + esc(message || 'Unknown error') + '</div>'
    + (entry ? '<div class="history-empty-note">' + esc(historySnippet(entry.code)) + '</div>' : '')
    + '</div>';
}

function selectHistoryEntry(id) {
  historyState.selectedId = id;
  setHistoryActiveState();

  var summaryEntry = getHistorySummaryEntry(id);
  var cachedEntry = historyState.details[id];
  if (cachedEntry) {
    renderHistoryDetail(cachedEntry);
    return;
  }

  renderHistoryDetailLoading(summaryEntry);

  api('/api/history/' + SESSION_ID + '/' + id)
    .then(function (res) {
      var merged = Object.assign({}, summaryEntry || {}, normalizeHistoryEntry(res.entry || {}, 0));
      historyState.details[id] = merged;
      if (historyState.selectedId === id) {
        renderHistoryDetail(merged);
      }
    })
    .catch(function (e) {
      if (historyState.selectedId === id) {
        renderHistoryDetailError(summaryEntry, e.message);
      }
    });
}

function restoreHistoryAnalysis(id) {
  var entry = historyState.details[id];
  if (!entry || !entry.analysisData) return;

  lastData = entry.analysisData;
  lastCode = entry.sourceCode || entry.code || '';
  lastLang = entry.language || 'Unknown';

  codeIn.value = lastCode;
  updateEditor();

  if (hasOption(langSel, lastLang)) {
    langSel.value = lastLang;
  } else {
    langSel.value = 'auto';
  }
  refreshDetect();

  renderAll(entry.analysisData);
  closeHistory();
}

document.getElementById('h-chart').addEventListener('click', function (e) {
  var btn = e.target.closest('.js-history-select');
  if (btn) selectHistoryEntry(btn.getAttribute('data-history-id'));
});

document.getElementById('h-list').addEventListener('click', function (e) {
  var btn = e.target.closest('.js-history-select');
  if (btn) selectHistoryEntry(btn.getAttribute('data-history-id'));
});

function loadHistBadge() {
  api('/api/history/' + SESSION_ID)
    .then(function (res) {
      document.getElementById('hist-badge').textContent = mergeHistoryEntries(res.history || []).length;
    })
    .catch(function () {
      document.getElementById('hist-badge').textContent = readLocalHistory().length;
    });
}
loadHistBadge();

function openHistory() {
  document.getElementById('modal-history').classList.remove('hidden');
  document.getElementById('h-chart').innerHTML = '<div class="history-empty">Loading history...</div>';
  document.getElementById('h-list').innerHTML  = '';
  document.getElementById('h-detail').innerHTML =
    '<div class="history-detail-empty"><div class="history-detail-empty-title">Select a saved run</div><div class="history-detail-empty-copy">We will show the full stored analysis here.</div></div>';
  document.getElementById('history-summary').textContent = 'Loading history...';

  api('/api/history/' + SESSION_ID)
    .then(function (res) {
      var hist = mergeHistoryEntries(res.history || []);
      historyState.list = hist;
      historyState.details = {};
      hist.forEach(function (entry) {
        if (entry.analysisData) {
          historyState.details[entry.__id] = entry;
        }
      });
      historyState.selectedId = hist.length ? hist[0].__id : null;
      renderHistoryShell(hist);
      document.getElementById('hist-badge').textContent = hist.length;
      if (hist.length) {
        selectHistoryEntry(hist[0].__id);
      }
    })
    .catch(function (e) {
      var hist = mergeHistoryEntries([]);
      historyState.list = hist;
      historyState.details = {};
      hist.forEach(function (entry) {
        if (entry.analysisData) {
          historyState.details[entry.__id] = entry;
        }
      });
      historyState.selectedId = hist.length ? hist[0].__id : null;

      if (hist.length) {
        renderHistoryShell(hist);
        document.getElementById('hist-badge').textContent = hist.length;
        selectHistoryEntry(hist[0].__id);
      } else {
        renderHistoryEmpty('Could not load history right now.');
        document.getElementById('history-detail').innerHTML =
          '<div class="history-detail-empty"><div class="history-detail-empty-title">History failed to load</div><div class="history-detail-empty-copy">' + esc(e.message) + '</div></div>';
      }
    });
}

function closeHistory() { document.getElementById('modal-history').classList.add('hidden'); }

function clearHistory() {
  clearLocalHistory();

  api('/api/history/' + SESSION_ID, 'DELETE')
    .then(function () {
      document.getElementById('hist-badge').textContent = '0';
      historyState.list = [];
      historyState.details = {};
      historyState.selectedId = null;
      openHistory();
    })
    .catch(function () {
      document.getElementById('hist-badge').textContent = '0';
      historyState.list = [];
      historyState.details = {};
      historyState.selectedId = null;
      openHistory();
    });
}

// ══════════════════════════════════════════════════════
//   INTERVIEW MODE — via backend
// ══════════════════════════════════════════════════════
function openInterview() {
  var code = codeIn.value.trim();
  var interviewError = getCodeInputError(code, 'Paste some code first, then run Interview Mode.');
  if (interviewError) { showErr(errBar, interviewError); return; }
  var lang = lastLang || langSel.value;
  if (lang === 'auto') lang = detectLang(code) || 'Unknown';

  document.getElementById('modal-interview').classList.remove('hidden');
  document.getElementById('iv-content').innerHTML =
    '<div class="interview-loading"><div class="iv-spinner"></div><div>Evaluating your code as a tech interviewer...</div></div>';

  api('/api/interview', 'POST', { code: code, language: lang })
    .then(function (res) { renderInterview(res.data); })
    .catch(function (e) {
      document.getElementById('iv-content').innerHTML =
        '<div style="color:var(--red);padding:20px">Error: ' + esc(e.message) + '</div>';
    });
}

function closeInterview() { document.getElementById('modal-interview').classList.add('hidden'); }

function renderInterview(d) {
  var v   = d.verdict || 'BORDERLINE';
  var vc  = v === 'HIRE' ? 'var(--mint-h)' : v === 'NO HIRE' ? 'var(--red)' : 'var(--amber)';
  var vb  = v === 'HIRE' ? 'rgba(45,212,191,0.1)' : v === 'NO HIRE' ? 'rgba(240,96,128,0.1)' : 'rgba(245,200,66,0.1)';
  var ve  = v === 'HIRE' ? '✅' : v === 'NO HIRE' ? '❌' : '⚠️';
  var cats = d.category_scores || {};
  var catList = [
    { l: 'Problem Solving', k: 'problem_solving' },
    { l: 'Code Quality',    k: 'code_quality' },
    { l: 'Efficiency',      k: 'efficiency' },
    { l: 'Edge Cases',      k: 'edge_cases' },
    { l: 'Communication',   k: 'communication' }
  ];
  var qs = (d.follow_up_questions || []).map(function (q, i) {
    return '<div class="iv-q"><span class="iv-qnum">Q' + (i + 1) + '</span>' + esc(q) + '</div>';
  }).join('');

  document.getElementById('iv-content').innerHTML =
    '<div class="iv-verdict" style="background:' + vb + ';border-color:' + vc + ';color:' + vc + '">' + ve + ' &nbsp;' + v + '</div>'
    + '<div class="iv-overall">Overall: <strong>' + (d.overall_score || 0) + '/10</strong></div>'
    + '<div class="iv-cats">' + catList.map(function (c) {
        var val = cats[c.k] || 0;
        var col = val >= 8 ? 'var(--mint-h)' : val >= 5 ? 'var(--amber)' : 'var(--red)';
        return '<div class="iv-cat"><span class="iv-cat-label">' + c.l + '</span><div class="iv-cat-bar-bg"><div class="iv-cat-bar" style="width:' + (val * 10) + '%;background:' + col + '"></div></div><span class="iv-cat-val" style="color:' + col + '">' + val + '</span></div>';
      }).join('') + '</div>'
    + '<div class="iv-section"><div class="iv-section-title">Interviewer Notes</div><div class="iv-section-body">' + esc(d.interviewer_notes || '') + '</div></div>'
    + '<div class="iv-section"><div class="iv-section-title">What Impressed</div><div class="iv-section-body">'   + esc(d.what_impressed  || '') + '</div></div>'
    + '<div class="iv-section"><div class="iv-section-title">What Failed</div><div class="iv-section-body">'      + esc(d.what_failed     || '') + '</div></div>'
    + (qs ? '<div class="iv-section"><div class="iv-section-title">Follow-up Questions</div><div class="iv-section-body">' + qs + '</div></div>' : '')
    + '<div class="iv-final" style="border-color:' + vc + ';color:' + vc + '">' + esc(d.hire_reason || '') + '</div>';
}

// ══════════════════════════════════════════════════════
//   EXPORT PDF (client-side, uses lastData)
// ══════════════════════════════════════════════════════
function exportPDF() {
  if (!lastData) { alert('Run an analysis first!'); return; }
  var d = lastData, m = d.metrics || {}, s = d.summary || {}, cx = d.complexity || {}, t = cx.time || {}, sp = cx.space || {};
  var win = window.open('', '_blank');
  win.document.write(
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>CodeVise Report</title>'
    + '<style>'
    + 'body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#111}'
    + 'h1{font-size:2rem;font-weight:800;margin-bottom:4px}'
    + '.sub{color:#666;font-size:0.88rem;margin-bottom:28px}'
    + '.sr{display:flex;align-items:center;gap:28px;margin-bottom:28px;padding:22px;background:#f5f7ff;border-radius:14px;border:1px solid #dde2ff}'
    + '.big{font-size:3.5rem;font-weight:900;color:#5b7fff;line-height:1}'
    + '.mets{flex:1}'
    + '.mrow{display:flex;align-items:center;gap:10px;margin-bottom:8px}'
    + '.mlbl{font-size:0.78rem;color:#555;width:115px;flex-shrink:0}'
    + '.mbar{height:7px;background:#e5e7eb;border-radius:4px;flex:1;overflow:hidden}'
    + '.mfill{height:100%;border-radius:4px;background:#5b7fff}'
    + '.mnum{font-size:0.78rem;font-weight:700;width:26px;text-align:right}'
    + 'h2{font-size:1rem;font-weight:700;margin:24px 0 9px;border-bottom:2px solid #f0f0f0;padding-bottom:4px}'
    + '.box{background:#f5f7ff;border-radius:10px;padding:14px;margin-bottom:12px;font-size:0.85rem;line-height:1.7;color:#444;border:1px solid #dde2ff}'
    + '.er{padding:10px;border-radius:8px;margin-bottom:7px;border-left:4px solid #f06080;background:#fff5f7;font-size:0.82rem}'
    + '.sr2{padding:10px;border-radius:8px;margin-bottom:7px;border-left:4px solid #5b7fff;background:#f0f4ff;font-size:0.82rem}'
    + 'pre{background:#111827;color:#a8c0d8;padding:18px;border-radius:10px;font-size:0.77rem;overflow-x:auto;line-height:1.75}'
    + '.cxr{display:flex;gap:14px;margin-bottom:12px}'
    + '.cxb{flex:1;background:#f5f7ff;border:1px solid #dde2ff;border-radius:10px;padding:13px;text-align:center}'
    + '.cxv{font-size:1.5rem;font-weight:800;color:#5b7fff}'
    + '.cxl{font-size:0.67rem;color:#888;text-transform:uppercase;letter-spacing:0.1em}'
    + '.footer{margin-top:40px;text-align:center;color:#aaa;font-size:0.77rem;border-top:1px solid #eee;padding-top:16px}'
    + '</style></head><body>'
    + '<h1>CodeVise Analysis Report</h1>'
    + '<div class="sub">Language: ' + lastLang + ' &nbsp;·&nbsp; ' + new Date().toLocaleString() + '</div>'
    + '<div class="sr"><div><div class="big">' + (d.score || 0).toFixed(1) + '<span style="font-size:1.2rem;color:#999">/10</span></div><div style="font-weight:700;color:#666;margin-top:5px">' + (d.verdict || '') + '</div></div>'
    + '<div class="mets">' + ['readability','efficiency','best_practices','documentation'].map(function (k) { var v = m[k] || 0; return '<div class="mrow"><span class="mlbl">' + k.replace('_', ' ') + '</span><div class="mbar"><div class="mfill" style="width:' + (v * 10) + '%"></div></div><span class="mnum">' + v + '</span></div>'; }).join('') + '</div></div>'
    + '<h2>Summary</h2><div class="box"><b>Overview:</b> ' + (s.overview || '') + '<br><br><b>Strengths:</b> ' + (s.strengths || '') + '<br><br><b>Weaknesses:</b> ' + (s.weaknesses || '') + '</div>'
    + (t.overall ? '<h2>Complexity</h2><div class="cxr"><div class="cxb"><div class="cxv">' + (t.overall || '—') + '</div><div class="cxl">Time</div></div><div class="cxb"><div class="cxv">' + (sp.overall || '—') + '</div><div class="cxl">Space</div></div></div>' : '')
    + ((d.errors || []).length ? '<h2>Errors</h2>' + (d.errors || []).map(function (e) { return '<div class="er"><b>' + (e.message || '') + '</b><br>' + (e.fix || '') + '</div>'; }).join('') : '')
    + '<h2>Suggestions</h2>' + ((d.suggestions || []).map(function (s) { return '<div class="sr2"><b>' + (s.icon || '') + ' ' + (s.title || '') + '</b> [' + (s.priority || '').toUpperCase() + ']<br>' + (s.body || '') + '</div>'; }).join('') || '<p>None</p>')
    + '<h2>Original Code</h2><pre>' + lastCode.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</pre>'
    + '<div class="footer">Generated by CodeVise — AI Code Analyzer</div>'
    + '</body></html>'
  );
  win.document.close();
  setTimeout(function () { win.print(); }, 500);
}

window.openHistoryModal = openHistory;
window.closeHistoryModal = closeHistory;
window.openInterviewModal = openInterview;
window.closeInterviewModal = closeInterview;
