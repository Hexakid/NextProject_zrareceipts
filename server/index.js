import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
const PORT = Number(process.env.PORT || (IS_PROD ? 3000 : 8787));
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 25);
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 30000);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_FALLBACK_MODELS = (
  process.env.GEMINI_FALLBACK_MODELS ||
  'gemini-2.0-flash,gemini-2.0-flash-001,gemini-2.0-flash-lite'
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const AUTH_USERNAME = process.env.AUTH_USERNAME || 'admin';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'admin123';
const AUTH_COOKIE_NAME = 'vat_auth';
const AUTH_SESSION_TTL_HOURS = Number(process.env.AUTH_SESSION_TTL_HOURS || 12);
const sessions = new Map();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');
const dataDir = path.resolve(process.env.DATA_DIR || path.resolve(__dirname, '../data'));
const dataFilePath = path.join(dataDir, 'entries-store.json');

app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(compression());
app.use(express.json({ limit: `${MAX_UPLOAD_MB}mb` }));
app.use(cookieParser());

function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + AUTH_SESSION_TTL_HOURS * 60 * 60 * 1000;
  sessions.set(token, { username, expiresAt });
  return { token, expiresAt };
}

function getActiveSession(req) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function requireAuth(req, res, next) {
  const session = getActiveSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  req.user = { username: session.username };
  return next();
}

async function ensureDataStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dataFilePath, 'utf8');
  } catch {
    await writeFile(dataFilePath, JSON.stringify({ users: {} }, null, 2), 'utf8');
  }
}

async function readStore() {
  await ensureDataStore();
  try {
    const raw = await readFile(dataFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.users && typeof parsed.users === 'object') {
      return parsed;
    }
    return { users: {} };
  } catch {
    return { users: {} };
  }
}

async function writeStore(store) {
  await ensureDataStore();
  const tmpPath = `${dataFilePath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(store, null, 2), 'utf8');
  await rename(tmpPath, dataFilePath);
}

function normalizeEntry(raw = {}, idx = 0) {
  return {
    id: raw.id ? String(raw.id) : crypto.randomUUID(),
    tpinOfSupplier: raw.tpinOfSupplier ? String(raw.tpinOfSupplier) : '',
    nameOfSupplier: raw.nameOfSupplier ? String(raw.nameOfSupplier) : '',
    invoiceNumber: raw.invoiceNumber ? String(raw.invoiceNumber) : '',
    invoiceDate: raw.invoiceDate ? String(raw.invoiceDate) : '',
    descriptionOfSupply: raw.descriptionOfSupply ? String(raw.descriptionOfSupply) : '',
    amountBeforeVat: raw.amountBeforeVat ? String(raw.amountBeforeVat) : '',
    vatCharged: raw.vatCharged ? String(raw.vatCharged) : '',
    imageDataUrl: raw.imageDataUrl ? String(raw.imageDataUrl) : null,
    createdAt: raw.createdAt ? String(raw.createdAt) : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _order: typeof raw._order === 'number' ? raw._order : idx
  };
}

function sanitizeEntriesPayload(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry, idx) => normalizeEntry(entry, idx));
}

setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}, 5 * 60 * 1000).unref();

const extractionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.EXTRACT_RATE_LIMIT_PER_MIN || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many extraction requests. Please try again shortly.' }
});

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

function sanitizeExtractionOutput(raw = {}) {
  const asString = (v) => (v == null ? '' : String(v).trim());
  return {
    tpinOfSupplier: asString(raw.tpinOfSupplier).replace(/\D/g, '').slice(0, 10),
    nameOfSupplier: asString(raw.nameOfSupplier),
    invoiceNumber: asString(raw.invoiceNumber),
    invoiceDate: asString(raw.invoiceDate),
    descriptionOfSupply: asString(raw.descriptionOfSupply),
    amountBeforeVat: asString(raw.amountBeforeVat).replace(/[^0-9.]/g, ''),
    vatCharged: asString(raw.vatCharged).replace(/[^0-9.]/g, '')
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    env: NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime())
  });
});

app.get('/api/auth/session', (req, res) => {
  const session = getActiveSession(req);
  if (!session) return res.json({ authenticated: false });
  return res.json({ authenticated: true, username: session.username });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const isValid = String(username) === AUTH_USERNAME && String(password) === AUTH_PASSWORD;
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const { token } = createSession(String(username));
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: AUTH_SESSION_TTL_HOURS * 60 * 60 * 1000,
    path: '/'
  });
  return res.json({ ok: true, username: String(username) });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (token) sessions.delete(token);
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
  return res.json({ ok: true });
});

app.get('/api/entries', requireAuth, async (req, res) => {
  try {
    const store = await readStore();
    const userEntries = Array.isArray(store.users?.[req.user.username])
      ? store.users[req.user.username]
      : [];
    return res.json({ entries: userEntries });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to load entries from server.',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

app.put('/api/entries', requireAuth, async (req, res) => {
  try {
    const payloadEntries = sanitizeEntriesPayload(req.body?.entries);
    const store = await readStore();
    store.users[req.user.username] = payloadEntries;
    await writeStore(store);
    return res.json({ ok: true, count: payloadEntries.length });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to save entries on server.',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

app.post('/api/entries/sync', requireAuth, async (req, res) => {
  try {
    const localEntries = sanitizeEntriesPayload(req.body?.entries);
    const store = await readStore();
    const remoteEntries = Array.isArray(store.users?.[req.user.username])
      ? store.users[req.user.username]
      : [];

    const byId = new Map();
    for (const entry of remoteEntries) byId.set(String(entry.id), entry);
    for (const entry of localEntries) {
      if (!byId.has(String(entry.id))) byId.set(String(entry.id), entry);
    }

    const mergedEntries = Array.from(byId.values()).map((entry, idx) => ({
      ...normalizeEntry(entry, idx),
      _order: idx
    }));

    store.users[req.user.username] = mergedEntries;
    await writeStore(store);

    return res.json({ entries: mergedEntries, merged: true, count: mergedEntries.length });
  } catch (err) {
    return res.status(500).json({
      error: 'Failed to sync entries with server.',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

// Lists Gemini models available for the configured API key.
// Useful for diagnosing which models you can actually use.
app.get('/api/models', requireAuth, async (_req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not set.' });
  }
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`
    );
    const json = await response.json();
    if (!response.ok) {
      return res.status(502).json({ error: 'Gemini ListModels failed.', details: json });
    }
    // Return only models that support generateContent, sorted by name.
    const models = (json.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m) => ({ name: m.name, displayName: m.displayName, description: m.description }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return res.json({ models, configuredPrimary: GEMINI_MODEL, configuredFallbacks: GEMINI_FALLBACK_MODELS });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch models.', details: err.message });
  }
});

app.post('/api/extract', requireAuth, extractionLimiter, async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body ?? {};

    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'Missing base64Data or mimeType.' });
    }

    if (!allowedMimeTypes.has(String(mimeType).toLowerCase())) {
      return res.status(400).json({ error: 'Unsupported file type for extraction.' });
    }

    if (typeof base64Data !== 'string' || base64Data.length < 100) {
      return res.status(400).json({ error: 'Invalid base64Data payload.' });
    }

    const estimatedBytes = Math.ceil((base64Data.length * 3) / 4);
    if (estimatedBytes > MAX_UPLOAD_MB * 1024 * 1024) {
      return res.status(413).json({ error: `Payload too large. Max ${MAX_UPLOAD_MB}MB allowed.` });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Server is missing GEMINI_API_KEY. Add it to your environment before scanning.'
      });
    }

    const modelCandidates = Array.from(new Set([GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS]));
    const prompt = 'Extract the invoice details from this document to match the schema. If a value is missing, leave it as an empty string. For TPIN, ensure it is exactly 10 digits if found. Format dates as YYYY-MM-DD. For amounts, only return numbers and decimals, strip out currency symbols.';

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            tpinOfSupplier: { type: 'STRING' },
            nameOfSupplier: { type: 'STRING' },
            invoiceNumber: { type: 'STRING' },
            invoiceDate: { type: 'STRING' },
            descriptionOfSupply: { type: 'STRING' },
            amountBeforeVat: { type: 'STRING' },
            vatCharged: { type: 'STRING' }
          }
        }
      }
    };

    let result = null;
    let lastFailure = null;

    for (const model of modelCandidates) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), GEMINI_TIMEOUT_MS);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: timeoutController.signal
      }).finally(() => clearTimeout(timeoutId));

      if (response.ok) {
        result = await response.json();
        lastFailure = null;
        break;
      }

      let detailsText = await response.text();
      let detailsParsed = null;
      try { detailsParsed = JSON.parse(detailsText); } catch (_) { /* ignore */ }
      lastFailure = { model, status: response.status, details: detailsParsed ?? detailsText };

      // Retry with fallback models for:
      //   404 = model not available for this key
      //   429 = quota exhausted (fallback may have separate quota)
      //   503 = model overloaded
      const retryStatuses = new Set([404, 429, 503]);
      if (!retryStatuses.has(response.status)) break;
    }

    if (!result) {
      const lastStatus = lastFailure?.status;
      const geminiCode = lastFailure?.details?.error?.code;
      const geminiMsg  = lastFailure?.details?.error?.message ?? '';

      // Human-readable top-level error message
      let friendlyError;
      if (lastStatus === 429 || geminiCode === 429) {
        friendlyError = 'Gemini API quota exceeded for all available models. Please wait a few minutes and try again, or upgrade your Google AI plan at https://ai.dev/rate-limit.';
      } else if (lastStatus === 404) {
        friendlyError = 'None of the configured Gemini models are available for your API key. Update GEMINI_MODEL / GEMINI_FALLBACK_MODELS in your environment.';
      } else if (lastStatus === 401 || lastStatus === 403) {
        friendlyError = 'Gemini API key is invalid or lacks permission. Check GEMINI_API_KEY in your environment.';
      } else {
        friendlyError = `Gemini request failed (HTTP ${lastStatus}). Check GEMINI_MODEL, GEMINI_FALLBACK_MODELS and API key permissions.`;
      }

      return res.status(502).json({
        error: friendlyError,
        triedModels: modelCandidates,
        geminiStatus: lastStatus,
        geminiMessage: geminiMsg || undefined
      });
    }

    const extractedText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!extractedText) {
      return res.status(422).json({ error: 'No extraction result returned.' });
    }

    const parsed = JSON.parse(extractedText.replace(/```json/g, '').replace(/```/g, '').trim());
    const sanitized = sanitizeExtractionOutput(parsed);
    return res.json({ data: sanitized });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return res.status(504).json({ error: 'Extraction timed out. Please try again.' });
    }
    return res.status(500).json({
      error: 'Extraction failed.',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (${NODE_ENV})`);
  if (!process.env.GEMINI_API_KEY && IS_PROD) {
    console.warn('Warning: GEMINI_API_KEY is not set. AI extraction endpoint will fail.');
  }
  if (IS_PROD && AUTH_USERNAME === 'admin' && AUTH_PASSWORD === 'admin123') {
    console.warn('Warning: using default AUTH_USERNAME/AUTH_PASSWORD. Set strong values in production.');
  }
});
