import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { uploadReceipt, getReceipt, getReceiptImage, importVatCollectorReceipt, upload } from '../controllers/receipts.js';

const router = express.Router();

router.post('/upload', authenticate, upload.single('receipt'), uploadReceipt);
router.get('/:id', authenticate, getReceipt);
router.get('/:id/image', authenticate, getReceiptImage);
router.post('/import-vat', authenticate, importVatCollectorReceipt);

export default router;
