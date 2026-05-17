require('dotenv').config();

const path     = require('path');
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const fetch    = require('node-fetch');
const Analysis = require('./models/Analysis');

const app  = express();
const PORT = process.env.PORT || 5050;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const DB_ENABLED = Boolean(process.env.MONGO_URI);
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const CONFIGURED_FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || '')
  .split(',')
  .map(function (model) { return model.trim(); })
  .filter(Boolean);
const DEFAULT_MODEL_CHAIN = [
  GEMINI_MODEL,
  (CONFIGURED_FALLBACK_MODELS.length ? null : 'gemini-2.5-flash-lite'),
  (CONFIGURED_FALLBACK_MODELS.length ? null : 'gemini-2.5-pro')
].concat(CONFIGURED_FALLBACK_MODELS)
  .filter(function (model, index, list) {
    return model && list.indexOf(model) === index;
  });

// ── CORS ──────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(FRONTEND_DIR));

// ── MongoDB ───────────────────────────────────
if (DB_ENABLED) {
  mongoose.connect(process.env.MONGO_URI)
    .then(function () { console.log('✅ MongoDB connected'); })
    .catch(function (e) { console.error('❌ MongoDB error:', e.message); });
} else {
  console.warn('⚠️ MongoDB disabled: MONGO_URI is not set. History will be unavailable.');
}

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

const CODE_INPUT_ERROR = 'Please paste actual code. Plain English, questions, or simple math expressions are not supported.';

const LANGUAGE_PATTERNS = [
  [/^\s*def\s+\w+\s*\(/m, /^\s*import\s+\w/m, /\bprint\s*\(/m, /^\s*(if|elif|else|for|while|try|except|with|class)\b.*:\s*$/m],
  [/\bconsole\.log\b/, /\bfunction\s+\w+\s*\(/, /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*/, /=>\s*[{(]?/],
  [/:\s*(string|number|boolean|void|any)\b/, /interface\s+\w+/, /type\s+\w+\s*=/],
  [/public\s+class\s+\w+/, /public\s+static\s+void\s+main/, /System\.out\./],
  [/#include\s*<iostream>/, /std::/, /cout\s*<</, /using\s+namespace/],
  [/#include\s*<stdio\.h>/, /printf\s*\(/, /scanf\s*\(/, /int\s+main\s*\(/],
  [/^package\s+\w+/m, /func\s+\w+\s*\(/, /fmt\./, /:=\s*/],
  [/fn\s+main\s*\(\)/, /let\s+mut\s+/, /println!\s*\(/],
  [/<\?php/, /\$\w+\s*=/, /echo\s+/],
  [/func\s+\w+\s*\(/, /var\s+\w+\s*:/, /let\s+\w+\s*:/]
];

function detectCodeSignals(text) {
  var value = String(text || '').trim();
  if (!value) return 0;

  var best = 0;
  LANGUAGE_PATTERNS.forEach(function (group) {
    var matches = group.filter(function (rx) { return rx.test(value); }).length;
    if (matches > best) best = matches;
  });

  return best;
}

function looksLikeStructuredData(text) {
  var value = String(text || '').trim();
  if (!/^\s*[{[][\s\S]*[}\]]\s*$/.test(value)) return false;
  return /["'][^"']+["']\s*:/.test(value) || /\[[^\]]*(,|{|\[)/.test(value);
}

function isLikelyCodeInput(text) {
  var value = String(text || '').trim();
  var score = 0;

  if (!value) return false;
  if (detectCodeSignals(value) >= 1) return true;
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

// ── Gemini helper ─────────────────────────────
function stripJsonFences(raw) {
  return String(raw || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function parseGeminiResponse(data) {
  var raw = '';
  try { raw = data.candidates[0].content.parts[0].text; } catch (e) {}
  return stripJsonFences(raw);
}

function normalizeModelJsonText(text) {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function extractJsonPayload(text) {
  var start = -1;
  var stack = [];
  var inString = false;
  var isEscaped = false;

  for (var i = 0; i < text.length; i++) {
    var ch = text[i];

    if (start < 0) {
      if (ch === '{' || ch === '[') {
        start = i;
        stack.push(ch);
      }
      continue;
    }

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === '\\') {
        isEscaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{' || ch === '[') {
      stack.push(ch);
      continue;
    }

    if (ch === '}' || ch === ']') {
      var open = stack.pop();
      if (
        (open === '{' && ch !== '}') ||
        (open === '[' && ch !== ']')
      ) {
        return text.trim();
      }
      if (!stack.length) {
        return text.slice(start, i + 1).trim();
      }
    }
  }

  return text.trim();
}

function stripTrailingCommas(text) {
  return text.replace(/,\s*([}\]])/g, '$1');
}

function escapeControlCharsInStrings(text) {
  var out = '';
  var inString = false;
  var isEscaped = false;

  for (var i = 0; i < text.length; i++) {
    var ch = text[i];

    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }

    if (isEscaped) {
      out += ch;
      isEscaped = false;
      continue;
    }

    if (ch === '\\') {
      out += ch;
      isEscaped = true;
      continue;
    }

    if (ch === '"') {
      out += ch;
      inString = false;
      continue;
    }

    if (ch === '\n') {
      out += '\\n';
      continue;
    }

    if (ch === '\r') {
      out += '\\r';
      continue;
    }

    if (ch === '\t') {
      out += '\\t';
      continue;
    }

    if (ch.charCodeAt(0) < 32) {
      out += '\\u' + ('000' + ch.charCodeAt(0).toString(16)).slice(-4);
      continue;
    }

    out += ch;
  }

  return out;
}

function parseModelJson(raw, label) {
  var cleaned = normalizeModelJsonText(stripJsonFences(raw));
  var extracted = extractJsonPayload(cleaned);
  var candidates = [];
  var seen = {};
  var lastErr = null;

  function addCandidate(value) {
    if (!value || seen[value]) return;
    seen[value] = true;
    candidates.push(value);
  }

  addCandidate(cleaned);
  addCandidate(extracted);
  [cleaned, extracted].forEach(function (candidate) {
    if (!candidate) return;
    addCandidate(stripTrailingCommas(candidate));
    addCandidate(escapeControlCharsInStrings(candidate));
    addCandidate(stripTrailingCommas(escapeControlCharsInStrings(candidate)));
  });

  for (var i = 0; i < candidates.length; i++) {
    try {
      return JSON.parse(candidates[i]);
    } catch (e) {
      lastErr = e;
    }
  }

  console.error(
    '[Gemini] Could not parse ' + label + ' JSON:',
    lastErr ? lastErr.message : 'unknown parse error',
    '\nPreview:',
    cleaned.slice(0, 700)
  );
  throw new Error(label + ' response was not valid JSON. Please try again.');
}

function callGeminiModel(prompt, model) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + model
    + ':generateContent?key='
    + process.env.GEMINI_API_KEY;

  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.15,
        maxOutputTokens: 8000,
        responseMimeType: 'application/json'
      }
    })
  })
  .then(function (r) {
    if (!r.ok) {
      return r.json().catch(function () { return {}; }).then(function (e) {
        var msg = (e.error && e.error.message) || '';
        var lowMsg = msg.toLowerCase();
        if (
          r.status === 404 ||
          r.status === 429 ||
          r.status === 503 ||
          lowMsg.indexOf('high demand') >= 0 ||
          lowMsg.indexOf('overloaded') >= 0 ||
          lowMsg.indexOf('not found for api version') >= 0 ||
          lowMsg.indexOf('not supported for generatecontent') >= 0
        ) {
          var retryErr = new Error(msg || ('Temporary Gemini error ' + r.status));
          retryErr.retryable = true;
          retryErr.model = model;
          throw retryErr;
        }
        if (r.status === 403) throw new Error('Invalid Gemini API key.');
        throw new Error(msg || 'Gemini error ' + r.status);
      });
    }
    return r.json();
  })
  .then(parseGeminiResponse);
}

function callGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) {
    return Promise.reject(new Error('GEMINI_API_KEY is not configured. Copy backend/.env.example to backend/.env and add your key.'));
  }

  function attempt(index, lastErr) {
    if (index >= DEFAULT_MODEL_CHAIN.length) {
      if (lastErr && lastErr.retryable) {
        return Promise.reject(new Error('No fallback Gemini model succeeded. Try another 2.5 model or update GEMINI_FALLBACK_MODELS in backend/.env.'));
      }
      return Promise.reject(lastErr || new Error('No Gemini models configured.'));
    }

    var model = DEFAULT_MODEL_CHAIN[index];
    if (lastErr && lastErr.retryable) {
      console.warn('[Gemini] ' + (lastErr.model || model) + ' unavailable, trying next model...');
    }

    console.log('[Gemini] Trying ' + model);
    return callGeminiModel(prompt, model).catch(function (err) {
      if (!err.retryable) throw err;
      return attempt(index + 1, err);
    });
  }

  return attempt(0, null);
}

// ── Prompts ───────────────────────────────────
function analyzePrompt(code, lang) {
  return 'You are CodeVise, an expert AI code reviewer.\n'
    + 'Analyze this ' + lang + ' code. Reply ONLY with strict RFC 8259 JSON — no markdown, no extra text.\n'
    + 'Use double-quoted property names, no trailing commas, and escape newline characters inside JSON strings as \\\\n.\n\n'
    + 'JSON:\n{\n'
    + '  "score":<0-10>,\n'
    + '  "verdict":"<Excellent|Good|Average|Needs Work|Poor>",\n'
    + '  "metrics":{"readability":<0-10>,"efficiency":<0-10>,"best_practices":<0-10>,"documentation":<0-10>},\n'
    + '  "summary":{"overview":"...","strengths":"...","weaknesses":"..."},\n'
    + '  "lines":[{"line_number":<int>,"code":"<trimmed>","tag":"<info|good|warn|error>","explanation":"<beginner explanation>"}],\n'
    + '  "errors":[{"line_number":<int|null>,"type":"<error|warning|info>","icon":"<emoji>","message":"<title>","fix":"<how to fix>"}],\n'
    + '  "suggestions":[{"title":"...","body":"...","icon":"<emoji>","priority":"<high|med|low>"}],\n'
    + '  "fixed_code":"<complete corrected code as one JSON string using \\\\n escapes>",\n'
    + '  "changes":[{"line":"<line or General>","description":"..."}],\n'
    + '  "complexity":{\n'
    + '    "time":{"overall":"<O(?)>","best":"<O(?)>","average":"<O(?)>","worst":"<O(?)>","explanation":"..."},\n'
    + '    "space":{"overall":"<O(?)>","explanation":"..."},\n'
    + '    "breakdown":[{"section":"<fn name>","time":"<O(?)>","space":"<O(?)>","note":"..."}],\n'
    + '    "optimization_tip":"..."\n'
    + '  }\n'
    + '}\n\n'
    + 'Rules: ALL non-empty lines must be in lines[]. fixed_code is the FULL corrected code as a JSON string. 3-6 suggestions. Beginner-friendly explanations.\n\n'
    + 'Code (' + lang + '):\n```' + lang + '\n' + code + '\n```';
}

function convertPrompt(code, from, to) {
  return 'Convert this ' + from + ' code to ' + to + '.\n'
    + 'Reply ONLY with strict RFC 8259 JSON — no markdown.\n'
    + 'Use double-quoted keys, no trailing commas, and escape newline characters inside JSON strings as \\\\n.\n'
    + '{"converted_code":"<complete ' + to + ' code as one JSON string with \\\\n escapes and NO inline comments>","notes":["<key difference>"],"warnings":["<anything that could not convert perfectly>"]}\n'
    + 'Do NOT add inline comments in the converted code.\n\n'
    + 'Code:\n```' + from + '\n' + code + '\n```';
}

function interviewPrompt(code, lang) {
  return 'You are a senior engineer at Google/Amazon/Microsoft doing a live code interview.\n'
    + 'Evaluate this ' + lang + ' code strictly. Reply ONLY with strict RFC 8259 JSON.\n'
    + 'Use double-quoted property names, no trailing commas, and escape newlines inside JSON strings as \\\\n.\n'
    + '{"verdict":"<HIRE|BORDERLINE|NO HIRE>","overall_score":<0-10>,'
    + '"category_scores":{"problem_solving":<0-10>,"code_quality":<0-10>,"efficiency":<0-10>,"edge_cases":<0-10>,"communication":<0-10>},'
    + '"interviewer_notes":"<3-4 honest sentences>","what_impressed":"...","what_failed":"...",'
    + '"follow_up_questions":["<q1>","<q2>","<q3>"],"hire_reason":"<one sentence>"}\n\n'
    + 'Code (' + lang + '):\n```' + lang + '\n' + code + '\n```';
}

// ══════════════════════════════════════════════
//  ROUTES
// ══════════════════════════════════════════════

// Health check
app.get('/api/health', function (req, res) {
  res.json({
    ok: true,
    db: DB_ENABLED ? (isDbConnected() ? 'connected' : 'disconnected') : 'disabled'
  });
});

// Frontend entry
app.get('/', function (req, res) {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// ── Analyze ───────────────────────────────────
app.post('/api/analyze', function (req, res) {
  var code      = (req.body.code || '').trim();
  var language  = req.body.language || 'Unknown';
  var sessionId = req.body.sessionId;

  if (!code)      return res.status(400).json({ error: 'code is required' });
  if (!isLikelyCodeInput(code)) return res.status(400).json({ error: CODE_INPUT_ERROR });
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  callGemini(analyzePrompt(code, language))
    .then(function (raw) {
      var data = parseModelJson(raw, 'Analysis');

      // Save a lightweight summary plus the full snapshot for detail views.
      var cx = data.complexity || {};
      var doc = new Analysis({
        sessionId:    sessionId,
        language:     language,
        code:         code.substring(0, 500),
        sourceCode:   code,
        score:        data.score || 0,
        verdict:      data.verdict || '',
        lineCount:    code.split('\n').length,
        errorCount:   (data.errors || []).length,
        timeComplex:  cx.time ? cx.time.overall : '',
        spaceComplex: cx.space ? cx.space.overall : '',
        snapshotVersion: 1,
        analysisData: data
      });

      var saveAnalysis = isDbConnected() ? doc.save() : Promise.resolve();

      return saveAnalysis.then(function () {
        res.json({ ok: true, data: data });
      });
    })
    .catch(function (e) {
      console.error('analyze error:', e.message);
      res.status(500).json({ error: e.message });
    });
});

// ── Convert ───────────────────────────────────
app.post('/api/convert', function (req, res) {
  var code = (req.body.code || '').trim();
  var from = req.body.from;
  var to   = req.body.to;

  if (!code) return res.status(400).json({ error: 'code is required' });
  if (!isLikelyCodeInput(code)) return res.status(400).json({ error: CODE_INPUT_ERROR });
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
  if (from === to)  return res.status(400).json({ error: 'from and to must be different' });

  callGemini(convertPrompt(code, from, to))
    .then(function (raw) {
      res.json({ ok: true, data: parseModelJson(raw, 'Conversion') });
    })
    .catch(function (e) {
      console.error('convert error:', e.message);
      res.status(500).json({ error: e.message });
    });
});

// ── Interview ─────────────────────────────────
app.post('/api/interview', function (req, res) {
  var code     = (req.body.code || '').trim();
  var language = req.body.language || 'Unknown';

  if (!code) return res.status(400).json({ error: 'code is required' });
  if (!isLikelyCodeInput(code)) return res.status(400).json({ error: CODE_INPUT_ERROR });

  callGemini(interviewPrompt(code, language))
    .then(function (raw) {
      res.json({ ok: true, data: parseModelJson(raw, 'Interview') });
    })
    .catch(function (e) {
      console.error('interview error:', e.message);
      res.status(500).json({ error: e.message });
    });
});

// ── History GET ───────────────────────────────
app.get('/api/history/:sessionId', function (req, res) {
  if (!isDbConnected()) {
    return res.json({ ok: true, history: [] });
  }

  Analysis
    .find({ sessionId: req.params.sessionId })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('language score verdict lineCount errorCount timeComplex spaceComplex code createdAt snapshotVersion')
    .lean()
    .then(function (docs) {
      res.json({ ok: true, history: docs });
    })
    .catch(function (e) {
      res.status(500).json({ error: e.message });
    });
});

// ── History detail GET ────────────────────────
app.get('/api/history/:sessionId/:analysisId', function (req, res) {
  if (!isDbConnected()) {
    return res.status(404).json({ error: 'History details are unavailable right now.' });
  }

  Analysis
    .findOne({
      _id: req.params.analysisId,
      sessionId: req.params.sessionId
    })
    .select('language score verdict lineCount errorCount timeComplex spaceComplex code sourceCode createdAt snapshotVersion analysisData')
    .lean()
    .then(function (doc) {
      if (!doc) {
        return res.status(404).json({ error: 'History item not found.' });
      }
      res.json({ ok: true, entry: doc });
    })
    .catch(function (e) {
      res.status(500).json({ error: e.message });
    });
});

// ── History DELETE ────────────────────────────
app.delete('/api/history/:sessionId', function (req, res) {
  if (!isDbConnected()) {
    return res.json({ ok: true, deleted: 0 });
  }

  Analysis
    .deleteMany({ sessionId: req.params.sessionId })
    .then(function (r) {
      res.json({ ok: true, deleted: r.deletedCount });
    })
    .catch(function (e) {
      res.status(500).json({ error: e.message });
    });
});

// ── Start server ──────────────────────────────
app.listen(PORT, function () {
  console.log('🚀 CodeVise backend → http://localhost:' + PORT);
});
