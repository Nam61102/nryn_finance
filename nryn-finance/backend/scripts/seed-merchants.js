'use strict';
/** ~200 common Indian merchants, WITH icons (§6.4). `npm run db:seed` */
require('dotenv').config();
const { connect, mongoose } = require('../src/db/mongo');
const Merchant = require('../src/db/models/Merchant');

const S = (names, category, icon) => names.map((n) => ({ n, category, icon }));

const SEED = [
  ...S(['Swiggy', 'Zomato', 'Dominos', 'Pizza Hut', 'McDonalds', 'Burger King', 'KFC', 'Subway', 'Starbucks', 'Chaayos', 'Third Wave Coffee', 'Blue Tokai', 'Barbeque Nation', 'Haldirams', 'Faasos', 'Behrouz', 'Ovenstory', 'Box8', 'Freshmenu', 'EatFit', 'Cafe Coffee Day', 'Wow Momo', 'Biryani By Kilo', 'Theobroma'], 'food', '🍔'),
  ...S(['Blinkit', 'Zepto', 'Instamart', 'BigBasket', 'Dmart', 'Reliance Fresh', 'More Supermarket', 'Spencers', 'Nature Basket', 'Licious', 'Country Delight', 'Milkbasket', 'Jiomart', 'Star Bazaar'], 'groceries', '🛒'),
  ...S(['Uber', 'Ola', 'Rapido', 'Namma Yatri', 'IRCTC', 'Indian Railways', 'RedBus', 'Shell', 'HP Petrol', 'Indian Oil', 'Bharat Petroleum', 'Fastag', 'Paytm Fastag', 'Park Plus', 'Bounce', 'Yulu', 'Blu Smart', 'Metro', 'DMRC', 'BMTC'], 'transport', '🚕'),
  ...S(['Amazon', 'Flipkart', 'Myntra', 'Ajio', 'Nykaa', 'Meesho', 'Tata Cliq', 'Decathlon', 'Ikea', 'Croma', 'Reliance Digital', 'Lenskart', 'Boat', 'Pepperfry', 'Urban Ladder', 'Snapdeal', 'Shoppers Stop', 'Lifestyle', 'Westside', 'Zara', 'HM', 'Uniqlo', 'Bata', 'Titan', 'Tanishq'], 'shopping', '🛍️'),
  ...S(['Jio', 'Airtel', 'Vi', 'Vodafone', 'BSNL', 'ACT Fibernet', 'Hathway', 'Tata Play', 'Adani Electricity', 'Tata Power', 'BESCOM', 'MSEB', 'Mahanagar Gas', 'Indane', 'HP Gas', 'Bharat Gas', 'Torrent Power', 'BSES', 'Municipal Corporation'], 'bills_utilities', '💡'),
  ...S(['Netflix', 'Amazon Prime', 'Hotstar', 'Disney Hotstar', 'Sony Liv', 'Zee5', 'Jio Cinema', 'Spotify', 'Gaana', 'Wynk', 'YouTube Premium', 'BookMyShow', 'PVR', 'Inox', 'Cinepolis', 'Steam', 'PlayStation', 'Xbox'], 'entertainment', '🎬'),
  ...S(['Apollo Pharmacy', 'PharmEasy', 'Netmeds', 'Tata 1mg', 'Practo', 'Cult Fit', 'Cultfit', 'Gold Gym', 'Dr Lal Pathlabs', 'Thyrocare', 'Manipal Hospital', 'Fortis', 'Apollo Hospital', 'Max Healthcare', 'Wellness Forever'], 'health', '💊'),
  ...S(['Byjus', 'Unacademy', 'Vedantu', 'Coursera', 'Udemy', 'Upgrad', 'Physics Wallah', 'Scaler', 'Great Learning', 'Whitehat Jr', 'Kindersports'], 'education', '📚'),
  ...S(['MakeMyTrip', 'Goibibo', 'Cleartrip', 'Yatra', 'EaseMyTrip', 'Airbnb', 'OYO', 'Booking', 'Agoda', 'Indigo', 'Air India', 'Vistara', 'SpiceJet', 'Akasa Air', 'Treebo', 'FabHotels'], 'travel', '✈️'),
  ...S(['Nobroker', 'Nestaway', 'Housing', 'Magicbricks', 'Rent Payment', 'Society Maintenance'], 'rent', '🏠'),
  ...S(['Zerodha', 'Groww', 'Upstox', 'Kuvera', 'Coin', 'Angel One', 'ICICI Direct', 'HDFC Securities', 'Smallcase', 'INDmoney', 'NPS', 'PPF', 'SIP', 'Mutual Fund'], 'investment', '📈'),
  ...S(['LIC', 'HDFC Life', 'ICICI Prudential', 'Policybazaar', 'Acko', 'Digit Insurance', 'Star Health'], 'bills_utilities', '🛡️'),
  ...S(['Salary', 'Payroll', 'Interest Credit', 'Dividend', 'Cashback'], 'income', '💰'),
];

(async () => {
  await connect();
  const { merchantKey } = require('../src/parse/normalize');

  let upserted = 0;
  for (const { n, category, icon } of SEED) {
    const key = merchantKey(n);
    if (!key) continue;
    await Merchant.updateOne(
      { userId: null, key },
      { $set: { displayName: n, category, icon, source: 'seed' }, $setOnInsert: { userId: null, key } },
      { upsert: true },
    );
    upserted++;
  }
  console.log(`\n  seeded ${upserted} merchants with icons\n`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
