'use strict';
/**
 * DLT sender IDs vary by operator and change over time: AD-HDFCBK today can be
 * JM-HDFCBK tomorrow (§11.3). So we match on the 4–8 letter BODY of the header,
 * never the full string.
 */
const BANK_BY_TOKEN = {
  HDFCBK: 'HDFC Bank', HDFCBN: 'HDFC Bank',
  ICICIB: 'ICICI Bank', ICICIT: 'ICICI Bank',
  SBIINB: 'SBI', SBIUPI: 'SBI', ATMSBI: 'SBI', SBICRD: 'SBI Card', SBIPSG: 'SBI',
  AXISBK: 'Axis Bank', AXISBN: 'Axis Bank',
  KOTAKB: 'Kotak Bank', KOTAK: 'Kotak Bank',
  PNBSMS: 'PNB', PNBBNK: 'PNB',
  BOIIND: 'Bank of India', CANBNK: 'Canara Bank', UBOIND: 'Union Bank',
  IDFCFB: 'IDFC First', INDUSB: 'IndusInd', YESBNK: 'Yes Bank',
  AUBANK: 'AU Bank', RBLBNK: 'RBL Bank', FEDBNK: 'Federal Bank',
  PAYTMB: 'Paytm', PYTMPB: 'Paytm', GPAYIN: 'Google Pay', PHONPE: 'PhonePe',
  AMZNPY: 'Amazon Pay', BHIMPE: 'BHIM',
};

/** 'AD-HDFCBK' / 'VM-ICICIB' / 'JD-SBIUPI' → 'HDFCBK' */
function senderToken(sender) {
  if (!sender) return null;
  const s = String(sender).toUpperCase().replace(/[^A-Z-]/g, '');
  const m = s.match(/(?:^|-)([A-Z]{4,8})$/);
  return m ? m[1] : (/^[A-Z]{4,8}$/.test(s) ? s : null);
}

const bankFor = (sender) => BANK_BY_TOKEN[senderToken(sender)] || null;

/** Loose gate — the strict filter runs on the phone (§3.3). */
const looksLikeBankSender = (sender) =>
  Boolean(senderToken(sender)) || /@(?:[a-z0-9-]+\.)*(?:bank|hdfcbank|icicibank|sbi|axisbank|kotak)\b/i.test(String(sender || ''));

module.exports = { BANK_BY_TOKEN, senderToken, bankFor, looksLikeBankSender };
