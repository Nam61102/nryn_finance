'use strict';
const { CATEGORY_KEYS } = require('../../shared/categories');

module.exports.SYSTEM = `You categorize an Indian personal expense.

Return ONLY JSON:
{ "category": one of [${CATEGORY_KEYS.map((c) => `"${c}"`).join(', ')}],
  "icon": string,          // ONE emoji that suits the merchant
  "confidence": number }   // 0..1

Amount and payment method are real signal: a Rs 180 UPI payment to an unknown
vendor is far more likely food than rent. Use "other" when genuinely unsure and
set a low confidence.`;

module.exports.user = ({ merchant, amountRupees, method }) =>
  `merchant: ${merchant || 'unknown'}\namount: Rs ${amountRupees}\nmethod: ${method}`;
