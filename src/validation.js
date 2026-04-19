import { z } from 'zod';

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

const invoiceSchema = z.object({
  tpinOfSupplier: z.string().trim().regex(/^\d{10}$/, 'TPIN must be exactly 10 digits.'),
  nameOfSupplier: z.string().trim().min(1, 'Supplier name is required.'),
  invoiceNumber: z.string().trim().min(1, 'Invoice number is required.'),
  invoiceDate: z.string().regex(isoDateRegex, 'Invoice date must be in YYYY-MM-DD format.'),
  descriptionOfSupply: z.string().trim().min(1, 'Description is required.'),
  amountBeforeVat: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, 'Amount before VAT must be a valid number.'),
  vatCharged: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, 'VAT charged must be a valid number.')
});

export function normalizeFormData(formData) {
  return {
    tpinOfSupplier: String(formData.tpinOfSupplier ?? '').replace(/\D/g, '').slice(0, 10),
    nameOfSupplier: String(formData.nameOfSupplier ?? '').trim(),
    invoiceNumber: String(formData.invoiceNumber ?? '').trim(),
    invoiceDate: String(formData.invoiceDate ?? '').trim(),
    descriptionOfSupply: String(formData.descriptionOfSupply ?? '').trim(),
    amountBeforeVat: String(formData.amountBeforeVat ?? '').replace(/[^0-9.]/g, ''),
    vatCharged: String(formData.vatCharged ?? '').replace(/[^0-9.]/g, '')
  };
}

export function validateInvoiceEntry(formData, entries, currentEditId) {
  const normalized = normalizeFormData(formData);
  const parsed = invoiceSchema.safeParse(normalized);

  if (!parsed.success) {
    const firstError = parsed.error.issues?.[0]?.message ?? 'Invalid invoice data.';
    return { valid: false, message: firstError, data: normalized };
  }

  const today = new Date().toISOString().split('T')[0];
  if (parsed.data.invoiceDate > today) {
    return { valid: false, message: 'Future dates are not allowed for invoices.', data: normalized };
  }

  const duplicate = entries.some(
    (entry) =>
      entry.tpinOfSupplier === parsed.data.tpinOfSupplier &&
      entry.invoiceNumber === parsed.data.invoiceNumber &&
      entry.id !== currentEditId
  );

  if (duplicate) {
    return {
      valid: false,
      message: 'An invoice with this number already exists for this Supplier TPIN.',
      data: normalized
    };
  }

  return { valid: true, data: parsed.data };
}
