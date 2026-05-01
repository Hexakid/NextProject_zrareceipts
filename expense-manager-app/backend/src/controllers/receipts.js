import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createWorker } from 'tesseract.js';
import Receipt from '../models/Receipt.js';

const uploadDir = process.env.FILE_UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});

export const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || 5242880) },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(allowed.includes(file.mimetype) ? null : new Error('Invalid file type'), allowed.includes(file.mimetype));
  }
});

export const uploadReceipt = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const imagePath = req.file.path;
    let extractedFields = {};
    let extractedVia = 'manual';

    // Try OCR extraction
    try {
      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(imagePath);
      await worker.terminate();

      extractedFields = parseReceiptText(text);
      extractedVia = 'ocr_tesseract';
    } catch (ocrError) {
      console.error('OCR failed, storing receipt without extraction:', ocrError.message);
    }

    const receipt = await Receipt.create({
      imagePath,
      extractedFields,
      extractedVia,
      merchantName: extractedFields.merchantName || null,
      invoiceNumber: extractedFields.invoiceNumber || null,
      invoiceDate: extractedFields.invoiceDate || null,
      tpin: extractedFields.tpin || null
    });

    res.status(201).json({
      message: 'Receipt uploaded successfully',
      receipt,
      extractedFields
    });
  } catch (error) {
    next(error);
  }
};

export const getReceipt = async (req, res, next) => {
  try {
    const { id } = req.params;
    const receipt = await Receipt.findByPk(id);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    res.json(receipt);
  } catch (error) {
    next(error);
  }
};

export const getReceiptImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const receipt = await Receipt.findByPk(id);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });

    if (!fs.existsSync(receipt.imagePath)) {
      return res.status(404).json({ error: 'Image file not found' });
    }

    res.sendFile(path.resolve(receipt.imagePath));
  } catch (error) {
    next(error);
  }
};

// Import VAT collector receipt into this system
export const importVatCollectorReceipt = async (req, res, next) => {
  try {
    const { vatCollectorReceiptId, extractedFields, imagePath } = req.body;

    const existing = await Receipt.findOne({ where: { vatCollectorReceiptId } });
    if (existing) {
      return res.json({ message: 'Receipt already imported', receipt: existing });
    }

    const receipt = await Receipt.create({
      vatCollectorReceiptId,
      extractedFields,
      imagePath: imagePath || '',
      merchantName: extractedFields?.merchantName || null,
      invoiceNumber: extractedFields?.invoiceNumber || null,
      invoiceDate: extractedFields?.invoiceDate || null,
      tpin: extractedFields?.tpin || null,
      extractedVia: extractedFields?.extractedVia || 'gemini_ai'
    });

    res.status(201).json({ message: 'VAT receipt imported successfully', receipt });
  } catch (error) {
    next(error);
  }
};

// Parse OCR text to extract invoice fields
function parseReceiptText(text = '') {
  const pick = (patterns) => {
    for (const p of patterns) {
      const m = text.match(p);
      if (m?.[1]) return m[1].trim();
    }
    return null;
  };

  return {
    invoiceNumber: pick([/inv(?:oice)?[\s#:]*([A-Z0-9\-\/]+)/i, /SDC InvNo[\s:]*([A-Z0-9\-\/]+)/i]),
    tpin: pick([/tpin[\s:]*(\d{10})/i, /tax\s*(?:payer)?\s*id[\s:]*(\d{10})/i]),
    invoiceDate: pick([/date[\s:]*([\d\/\-]+)/i]),
    merchantName: text.split('\n').find(l => l.trim().length > 3)?.trim() || null,
    amountTotal: pick([/total[\s:]*([0-9,]+\.?\d*)/i, /amount[\s:]*([0-9,]+\.?\d*)/i]),
    vatAmount: pick([/vat[\s:]*([0-9,]+\.?\d*)/i, /tax[\s:]*([0-9,]+\.?\d*)/i])
  };
}
