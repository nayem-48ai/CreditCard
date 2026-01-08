const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const { parse } = require('csv-parse/sync'); // For parsing CSV content

// Replace with your actual Bot Token and Admin ID
const BOT_TOKEN = process.env.BOT_TOKEN || '8475878795:AAFTNjSJGdo9GfS3TDPR0X8IUA9ldBLPS3Q'; // Get this from BotFather
const ADMIN_ID = process.env.ADMIN_ID ? parseInt(process.env.ADMIN_ID) : 5967798239; // Replace with your Telegram Admin ID

const bot = new Telegraf(BOT_TOKEN);

// GitHub raw file URLs for the BIN data
const BIN_DATA_URLS = [
    'https://raw.githubusercontent.com/nayem-48ai/nayem-48ai/d985a3bba59c0a36706e71e48630e1ee9c6d3228/bin-list-data0.csv',
    'https://raw.githubusercontent.com/nayem-48ai/nayem-48ai/d985a3bba59c0a36706e71e48630e1ee9c6d3228/bin-list-data1.csv'
];

let binData = new Map();
let isBinDataLoaded = false; // Flag to check if data is loaded

async function loadBinData() {
    if (isBinDataLoaded && binData.size > 0) {
        console.log('BIN data already loaded.');
        return;
    }

    console.log('Loading BIN data from GitHub...');
    binData.clear(); // Clear existing data if any

    try {
        const fetchPromises = BIN_DATA_URLS.map(url => axios.get(url, { responseType: 'text' }));
        const responses = await Promise.all(fetchPromises);

        responses.forEach((response, index) => {
            const fileContent = response.data;
            const records = parse(fileContent, {
                columns: true,
                skip_empty_lines: true
            });

            records.forEach(row => {
                if (row.BIN) {
                    binData.set(row.BIN.trim(), row);
                }
            });
            console.log(`Loaded ${records.length} BINs from ${BIN_DATA_URLS[index]}. Total: ${binData.size}`);
        });
        isBinDataLoaded = true;
        console.log(`Finished loading all BIN data. Total unique BINs: ${binData.size}`);
    } catch (error) {
        console.error('Error loading BIN data from GitHub:', error.message);
        // Attempt to retry after some time or inform admin
        setTimeout(loadBinData, 60000); // Retry after 1 minute
    }
}

// Initial load of BIN data, and ensure it reloads if the function gets cold started
// Vercel serverless functions are stateless, so data might need to be reloaded on each invocation
// For a large dataset, this can be slow. Consider a persistent cache/database if performance is critical.
loadBinData();

// Helper function for Luhn algorithm validation
function validateCardNumber(cardNumber) {
    if (!cardNumber || cardNumber.length < 13 || cardNumber.length > 19) {
        return false;
    }
    const digits = cardNumber.split('').map(Number);
    let sum = 0;
    let isEven = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let digit = digits[i];
        if (isEven) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }
        sum += digit;
        isEven = !isEven;
    }
    return sum % 10 === 0;
}

// Helper to generate a valid card number for a given BIN
function generateCardNumber(bin) {
    let cardNumber = bin;
    while (cardNumber.length < 15) {
        cardNumber += Math.floor(Math.random() * 10);
    }
    let sum = 0;
    let isEven = false;
    for (let i = cardNumber.length - 1; i >= 0; i--) {
        let digit = parseInt(cardNumber[i], 10);
        if (isEven) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        isEven = !isEven;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return cardNumber + checkDigit;
}

// Helper for generating random MM, YYYY, CVV
function getRandomCardDetails() {
    const currentYear = new Date().getFullYear();
    const mm = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const yy = String(currentYear + Math.floor(Math.random() * 5) + 1).slice(-2); // Next 1-5 years, 2-digit
    const cvv = String(Math.floor(Math.random() * 900) + 100).padStart(3, '0');
    return { mm, yy, cvv };
}

// Middleware to ensure BIN data is loaded before processing commands
bot.use(async (ctx, next) => {
    if (!isBinDataLoaded) {
        await ctx.reply('BIN ডেটা লোড হচ্ছে, অনুগ্রহ করে একটু অপেক্ষা করুন...');
        await loadBinData(); // Try to load again if not loaded
        if (!isBinDataLoaded) {
            return ctx.reply('BIN ডেটা লোড করতে ব্যর্থ হয়েছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন।');
        } else {
            ctx.reply('BIN ডেটা সফলভাবে লোড হয়েছে। এখন আপনি আপনার কমান্ড ব্যবহার করতে পারেন।');
        }
    }
    return next();
});

// --- Bot Commands ---

bot.start((ctx) => {
    ctx.reply('স্বাগতম! ক্রেডিট কার্ড টুলস বট-এ আপনাকে স্বাগতম। /menu লিখে কমান্ডগুলো দেখতে পারেন।');
});

bot.command('menu', (ctx) => {
    const menuText = `
📜 BOT COMMANDS MENU

💳 BIN Info or check
├ Command : \`/bin {6-digit}\`
└ Example : \`/bin 412236\`

🔐 CC Generator
├ Command : \`/gen BIN|MM|YYYY|CVV\`
└ Example : \`/gen 412236xxxx|xx|2025|xxx\`
(\`/gen 412236xxxx\` for Random MM|YYYY|CVV)

✅ CC Validator (one or Bulk/multiple)
├ Command : \`/ck CARD_NUMBER|MM|YYYY|CVV\`
└ Example : \`/ck 4122361234567890|12|2025|123\`
(Multiple cards, one per line)

🔥 Validated CC Generator (Generates valid card numbers for a BIN)
├ Command : \`/gck BIN\`
└ Example : \`/gck 412236\`

ℹ️ IBAN Generator (Not implemented in this version)
├ Command : \`/iban COUNTRY_CODE\`
└ Example : \`/iban de\`

📍 Fake Address (Not implemented in this version)
├ Command : \`/fake {country_code}\`
├ Example : \`/fake bd\`
└ Example : \`/fake us\`

👤 Profile Info
└ Command : \`/me\`

📌 Menu
└ Command : \`/menu\` / \`/help\`

${ctx.from.id === ADMIN_ID ? '\n*For Admin:*\n`/broadcast <text or file>`' : ''}
    `;
    ctx.replyWithMarkdown(menuText);
});

bot.help((ctx) => ctx.replyWithMarkdown('আপনি /menu লিখে কমান্ডগুলো দেখতে পারেন।'));

bot.command('bin', async (ctx) => {
    const binInput = ctx.message.text.split(' ')[1];
    if (!binInput || binInput.length < 6 || !/^\d+$/.test(binInput)) {
        return ctx.reply('অনুগ্রহ করে একটি বৈধ ৬-সংখ্যার BIN দিন। উদাহরণ: `/bin 412236`', Markup.forceReply());
    }

    const bin = binInput.substring(0, 6);
    const info = binData.get(bin);

    if (info) {
        const message = `
💳 *BIN Information*
*BIN:* \`${bin}\`
*Brand:* \`${info.Brand || 'Unknown'}\`
*Type:* \`${info.Type || 'Unknown'}\`
*Category:* \`${info.Category || 'Unknown'}\`
*Issuer:* \`${info.Issuer || 'Unknown'}\`
*Country:* \`${info.CountryName || 'Unknown'}\`
        `;
        ctx.replyWithMarkdown(message);
    } else {
        ctx.replyWithMarkdown(`দুঃখিত, \`${bin}\` BIN-এর কোনো তথ্য পাওয়া যায়নি।`);
    }
});

bot.command('gen', (ctx) => {
    const input = ctx.message.text.substring('/gen '.length).trim();
    if (!input) {
        return ctx.reply('অনুগ্রহ করে BIN, MM, YYYY, CVV ফর্ম্যাটে ইনপুট দিন। উদাহরণ: `/gen 412236xxxx|xx|2025|xxx` অথবা `/gen 412236xxxx`', Markup.forceReply());
    }

    const parts = input.split('|');
    const binPrefix = parts[0] ? parts[0].replace(/\D/g, '').substring(0, 6) : '';

    if (binPrefix.length < 6) {
        return ctx.reply('অনুগ্রহ করে একটি বৈধ ৬-সংখ্যার BIN দিন। উদাহরণ: `/gen 412236xxxx|xx|2025|xxx`', Markup.forceReply());
    }

    let mm = parts[1] ? parts[1].replace(/\D/g, '').substring(0, 2) : '';
    let yy = parts[2] ? parts[2].replace(/\D/g, '').substring(0, 4) : ''; // Allow 4-digit year
    let cvv = parts[3] ? parts[3].replace(/\D/g, '').substring(0, 3) : '';

    const generatedCards = [];
    const currentYear = new Date().getFullYear();

    for (let i = 0; i < 5; i++) { // Generate 5 cards by default
        const cardNumber = generateCardNumber(binPrefix);

        let finalMM = mm;
        let finalYY = yy;
        let finalCVV = cvv;

        // If MM, YY, CVV are not provided, randomize them
        if (!finalMM || !finalYY || !finalCVV) {
            const randomDetails = getRandomCardDetails();
            if (!finalMM) finalMM = randomDetails.mm;
            if (!finalYY) finalYY = randomDetails.yy;
            if (!finalCVV) finalCVV = randomDetails.cvv;
        }

        // Ensure MM is valid
        finalMM = String(Math.min(parseInt(finalMM || '01'), 12)).padStart(2, '0');

        // Ensure YY is 4-digit and not in the past
        let parsedYY = parseInt(finalYY);
        if (parsedYY < 100) { // Convert 2-digit year to 4-digit
            parsedYY = (parsedYY < 70 ? 2000 + parsedYY : 1900 + parsedYY);
        }
        finalYY = String(Math.max(parsedYY, currentYear));

        // Ensure CVV is 3-digit
        finalCVV = String(parseInt(finalCVV || '100')).padStart(3, '0');

        generatedCards.push(`\`${cardNumber}|${finalMM}|${finalYY}|${finalCVV}\``);
    }

    ctx.replyWithMarkdown(`
*Generated Cards (${binPrefix}):*
${generatedCards.join('\n')}
`);
});

bot.command('ck', (ctx) => {
    const input = ctx.message.text.substring('/ck '.length).trim();
    if (!input) {
        return ctx.reply('অনুগ্রহ করে কার্ড নম্বর, MM, YYYY, CVV ফর্ম্যাটে ইনপুট দিন। একাধিক কার্ডের জন্য প্রতি লাইনে একটি করে কার্ড দিন। উদাহরণ: `/ck 4122361234567890|12|2025|123`', Markup.forceReply());
    }

    const cards = input.split('\n').filter(line => line.trim());
    const results = [];

    cards.forEach(cardStr => {
        const parts = cardStr.split('|');
        const cardNumber = parts[0] ? parts[0].replace(/\D/g, '') : '';
        const mm = parts[1] ? parts[1].replace(/\D/g, '') : '';
        const yy = parts[2] ? parts[2].replace(/\D/g, '') : '';
        const cvv = parts[3] ? parts[3].replace(/\D/g, '') : '';

        let status, message;
        if (!cardNumber || cardNumber.length < 13 || cardNumber.length > 19) {
            status = '❌ INVALID';
            message = 'Invalid Card Number Length';
        } else if (!mm || !yy || !cvv) {
            status = '⚠️ PARTIAL';
            message = 'Missing Expiry/CVV (Luhn check only)';
            if (validateCardNumber(cardNumber)) {
                status = '✅ LIVE (Luhn)';
                message = 'Valid Card Number (Luhn)';
            } else {
                status = '❌ DEAD (Luhn)';
                message = 'Invalid Card Number (Luhn)';
            }
        } else {
            if (validateCardNumber(cardNumber)) {
                status = '✅ LIVE';
                message = 'Valid Card Number (Luhn)';
            } else {
                status = '❌ DEAD';
                message = 'Invalid Card Number (Luhn)';
            }
        }
        results.push(`\`${cardNumber}|${mm}|${yy}|${cvv}\` - ${status} - _${message}_`);
    });

    ctx.replyWithMarkdown(`
*Card Validation Results:*
${results.join('\n')}
    `);
});

bot.command('gck', (ctx) => {
    const binInput = ctx.message.text.split(' ')[1];
    if (!binInput || binInput.length < 6 || !/^\d+$/.test(binInput)) {
        return ctx.reply('অনুগ্রহ করে একটি বৈধ ৬-সংখ্যার BIN দিন। উদাহরণ: `/gck 412236`', Markup.forceReply());
    }

    const binPrefix = binInput.substring(0, 6);
    const generatedCards = [];

    for (let i = 0; i < 5; i++) { // Generate 5 validated cards
        const { mm, yy, cvv } = getRandomCardDetails();
        const cardNumber = generateCardNumber(binPrefix);
        generatedCards.push(`\`${cardNumber}|${mm}|${yy}|${cvv}\``);
    }

    ctx.replyWithMarkdown(`
*Validated Generated Cards (${binPrefix}):*
${generatedCards.join('\n')}
`);
});

bot.command('iban', (ctx) => {
    ctx.reply('IBAN Generator এই মুহূর্তে উপলব্ধ নয়।');
});

bot.command('fake', (ctx) => {
    ctx.reply('Fake Address Generator এই মুহূর্তে উপলব্ধ নয়।');
});

bot.command('me', (ctx) => {
    const user = ctx.from;
    const message = `
*আপনার প্রোফাইল তথ্য:*
*ID:* \`${user.id}\`
*প্রথম নাম:* \`${user.first_name || 'N/A'}\`
*শেষ নাম:* \`${user.last_name || 'N/A'}\`
*ইউজারনেম:* \`@${user.username || 'N/A'}\`
    `;
    ctx.replyWithMarkdown(message);
});

// Admin Broadcast functionality
bot.command('broadcast', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) {
        return ctx.reply('আপনার এই কমান্ড ব্যবহার করার অনুমতি নেই।');
    }

    const messageContent = ctx.message.text.substring('/broadcast '.length).trim();
    if (!messageContent && !ctx.message.document && !ctx.message.photo) {
        return ctx.reply('অনুগ্রহ করে ব্রডকাস্ট করার জন্য টেক্সট অথবা ফাইল দিন।');
    }

    let broadcastMessage = 'ব্রডকাস্ট মেসেজ:';
    if (messageContent) {
        broadcastMessage += `\n\n${messageContent}`;
    }

    try {
        // This part needs a database to get all user IDs.
        // For simplicity, we'll just log here or inform the admin.
        // In a real bot, you would query your database for all chat IDs.
        console.log("Admin initiated broadcast:", broadcastMessage);
        ctx.reply('ব্রডকাস্ট শুরু হয়েছে। (প্রকৃত ব্রডকাস্টের জন্য ডাটাবেস ইন্টিগ্রেশন প্রয়োজন)।');
    } catch (error) {
        console.error('Broadcast error:', error);
        ctx.reply('ব্রডকাস্ট করার সময় একটি ত্রুটি হয়েছে।');
    }
});


// Set up webhook for Vercel
module.exports = async (req, res) => {
    try {
        await bot.webhookCallback(`/${BOT_TOKEN}`)(req, res);
    } catch (error) {
        console.error('Webhook error:', error.message);
        res.status(200).send('OK');
    }
};

bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}`, err);
    ctx.reply('দুঃখিত, একটি অভ্যন্তরীণ ত্রুটি ঘটেছে।');
});
