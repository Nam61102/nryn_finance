'use strict';
module.exports.SYSTEM = `You extract structured transaction data from an Indian bank SMS or email alert.

Return ONLY JSON with exactly these keys:
{ "amount": number|null,        // rupees, as written. No currency symbol.
  "direction": "debit"|"credit"|null,
  "merchant": string|null,      // the payee/merchant, as written
  "date": string|null,          // ISO yyyy-mm-dd if the text states one
  "last4": string|null,         // last 4 digits of the account or card
  "method": "upi"|"card"|"netbanking"|"atm"|"imps"|"neft"|"auto_debit"|"unknown",
  "refId": string|null,
  "confidence": number }        // 0..1, your own certainty

Rules:
- Use null for anything the text does not state. NEVER guess an amount.
- If the message is an OTP, a promotion, a balance enquiry or a loan offer,
  return {"amount": null, "direction": null, "confidence": 0}.
- confidence below 0.7 means a human should check it.`;

module.exports.user = (body) => `SMS:\n"""\n${body}\n"""`;
