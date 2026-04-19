import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
const PORT = Number(process.env.PORT || (IS_PROD ? 3000 : 8787));
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 25);
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 30000);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-1.5-flash')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(compression());
app.use(express.json({ limit: `${MAX_UPLOAD_MB}mb` }));

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

app.post('/api/extract', extractionLimiter, async (req, res) => {
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

      const details = await response.text();
      lastFailure = { model, status: response.status, details };

      // Retry with fallback only for model-not-found style failures.
      if (response.status !== 404) break;
    }

    if (!result) {
      return res.status(502).json({
        error: 'Gemini request failed. Check GEMINI_MODEL, GEMINI_FALLBACK_MODELS and API key permissions.',
        triedModels: modelCandidates,
        details: lastFailure
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
});
