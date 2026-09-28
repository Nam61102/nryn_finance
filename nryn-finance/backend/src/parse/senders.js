'use strict';
/**
 * DLT sender IDs vary by operator and change over time: AD-HDFCBK today can be
 * JM-HDFCBK tomorrow (§11.3). So we match on the 4–8 letter BODY of the header,
 * never the full string.
 */
const BANK_BY_TOKEN = {
  HDFCBK: 'HDFC Bank', HDFCBN: 'HDFC Bank', HDFC: 'HDFC Bank',
  ICICIB: 'ICICI Bank', ICICIT: 'ICICI Bank', ICICI: 'ICICI Bank',
  SBI: 'SBI', SBIINB: 'SBI', SBIUPI: 'SBI', ATMSBI: 'SBI', SBICRD: 'SBI Card', SBIPSG: 'SBI', CBSSBI: 'SBI',
  AXISBK: 'Axis Bank', AXISBN: 'Axis Bank', AXIS: 'Axis Bank',
  KOTAKB: 'Kotak Bank', KOTAK: 'Kotak Bank',
  PNB: 'PNB', PNBSMS: 'PNB', PNBBNK: 'PNB',
  BOI: 'Bank of India', BOIIND: 'Bank of India',
  BOB: 'Bank of Baroda', BOBTXN: 'Bank of Baroda', BARODA: 'Bank of Baroda',
  CANBNK: 'Canara Bank', CANARA: 'Canara Bank',
  UBOIND: 'Union Bank', UNIONB: 'Union Bank', UBI: 'Union Bank',
  CBI: 'Central Bank of India', CENTBK: 'Central Bank of India',
  IOB: 'Indian Overseas Bank',
  IDFCFB: 'IDFC First', IDFC: 'IDFC First',
  INDUSB: 'IndusInd', INDUS: 'IndusInd',
  YESBNK: 'Yes Bank', YES: 'Yes Bank',
  AUBANK: 'AU Bank', RBLBNK: 'RBL Bank', FEDBNK: 'Federal Bank',
  PAYTM: 'Paytm', PAYTMB: 'Paytm', PYTMPB: 'Paytm',
  GPAY: 'Google Pay', GPAYIN: 'Google Pay',
  PHONPE: 'PhonePe', PHONEPE: 'PhonePe',
  AMZNPY: 'Amazon Pay',
  BHIM: 'BHIM', BHIMPE: 'BHIM',
};

/** 'AD-HDFCBK' / 'VM-ICICIB' / 'AD-SBI' / 'JD-SBIUPI' → 'HDFCBK' / 'SBI' */
function senderToken(sender) {
  if (!sender) return null;
  const s = String(sender).toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const m = s.match(/(?:^|-)([A-Z0-9]{3,10})$/);
  return m ? m[1] : (/^[A-Z0-9]{3,10}$/.test(s) ? s : null);
}

const bankFor = (sender) => BANK_BY_TOKEN[senderToken(sender)] || null;

/** Loose gate — the strict filter runs on the phone (§3.3). */
const looksLikeBankSender = (sender) =>
  Boolean(senderToken(sender)) || /@(?:[a-z0-9-]+\.)*(?:bank|hdfcbank|icicibank|sbi|axisbank|kotak)\b/i.test(String(sender || ''));

module.exports = { BANK_BY_TOKEN, senderToken, bankFor, looksLikeBankSender };
