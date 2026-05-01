function pickFirst(text, patterns) {
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m?.[1]) return m[1].trim();
  }
  return '';
}

function parseDateToIso(raw) {
  if (!raw) return '';
  const cleaned = raw.replace(/\s+/g, '').replace(/[.]/g, '/');

  // yyyy-mm-dd or yyyy/mm/dd
  let m = cleaned.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // dd-mm-yyyy or dd/mm/yyyy
  m = cleaned.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  return '';
}

export function inferInvoiceFieldsFromOcrText(text = '') {
  const normalized = String(text)
    .replace(/\u00A0/g, ' ')
    .replace(/[|]/g, 'I')
    .replace(/\s+/g, ' ')
    .trim();

  const tpin = pickFirst(normalized, [
    /\bTPIN(?:\s*(?:No|Number)?)?\s*[:#.-]?\s*(\d{10})\b/i,
    /\b(\d{10})\b/
  ]).replace(/\D/g, '').slice(0, 10);

  const invoiceNumber = pickFirst(normalized, [
    /\bInv\s*No\.?\s*[:#-]?\s*([A-Z0-9/-]{3,})\b/i, // Shoprite SDC style
    /\bInvoice\s*(?:No\.?|#)\s*[:#-]?\s*([A-Z0-9/-]{3,})\b/i,
    /\bReceipt\s*(?:No\.?|#)\s*[:#-]?\s*([A-Z0-9/-]{3,})\b/i
  ]);

  const invoiceDateRaw = pickFirst(normalized, [
    /\b(?:Invoice\s*Date|Date)\s*[:#-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/i,
    /\b(\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/,
    /\b(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/
  ]);

  const amountBeforeVat = pickFirst(normalized, [
    /\b(?:Taxable\s*Amount|Amount\s*Before\s*VAT|Sub\s*Total|Subtotal|Net\s*Amount)\s*[:#-]?\s*([0-9][0-9,]*\.?[0-9]{0,2})\b/i
  ]).replace(/,/g, '');

  const vatCharged = pickFirst(normalized, [
    /\b(?:VAT(?:\s*Amount)?|Tax\s*Amount)\s*[:#-]?\s*([0-9][0-9,]*\.?[0-9]{0,2})\b/i
  ]).replace(/,/g, '');

  return {
    tpinOfSupplier: tpin,
    nameOfSupplier: '',
    invoiceNumber,
    invoiceDate: parseDateToIso(invoiceDateRaw),
    descriptionOfSupply: '',
    amountBeforeVat,
    vatCharged
  };
}
