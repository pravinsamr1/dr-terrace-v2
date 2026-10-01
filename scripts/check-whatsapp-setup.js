/**
 * WhatsApp Business setup check (read-only: it never sends a message).
 *
 * Reads .env and asks Meta whether:
 *   1. the access token and phone number ID are accepted
 *   2. the three message templates exist, are approved, and have the shape the app sends
 *      (needs WHATSAPP_BUSINESS_ACCOUNT_ID in .env; this value is only used by this script)
 *
 * Run with:  npm run check:whatsapp
 * The access token is sent only in the Authorization header and is never printed.
 */

const fs = require('fs');
const path = require('path');

// npm runs scripts from the project root
const ENV_PATH = path.join(process.cwd(), '.env');

const readEnv = () => {
  if (!fs.existsSync(ENV_PATH)) return null;
  const env = {};
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '').trim();
  }
  return env;
};

// What the app sends for each document type (see src/features/whatsapp/config/whatsappBusinessConfig.js)
const REQUIRED_TEMPLATES = [
  {
    envKey: 'EXPO_PUBLIC_WHATSAPP_TEMPLATE_QUOTATION',
    fallbackName: 'quotation_document',
    variables: 2,
    usedFor: 'quotations',
    sampleBody: 'Dear {{1}}, please find your quotation {{2}} from Dr. Terrace Water Proofing attached.',
  },
  {
    envKey: 'EXPO_PUBLIC_WHATSAPP_TEMPLATE_RECEIPT',
    fallbackName: 'receipt_document',
    variables: 3,
    usedFor: 'receipts, tax invoices, cash bills and proforma invoices',
    sampleBody: 'Dear {{1}}, please find your {{2}} (No. {{3}}) from Dr. Terrace Water Proofing attached.',
  },
  {
    envKey: 'EXPO_PUBLIC_WHATSAPP_TEMPLATE_WARRANTY',
    fallbackName: 'warranty_document',
    variables: 1,
    usedFor: 'warranty letters',
    sampleBody: 'Dear {{1}}, please find your warranty letter from Dr. Terrace Water Proofing attached.',
  },
];

let failures = 0;
let warnings = 0;
let templatesChecked = false;
const pass = (text) => console.log(`  PASS  ${text}`);
const fail = (text, fix) => {
  failures += 1;
  console.log(`  FAIL  ${text}`);
  if (fix) console.log(`        -> ${fix}`);
};
const warn = (text, fix) => {
  warnings += 1;
  console.log(`  WARN  ${text}`);
  if (fix) console.log(`        -> ${fix}`);
};

const graphGet = async (version, resource, token) => {
  const response = await fetch(`https://graph.facebook.com/${version}/${resource}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let data = null;
  try {
    data = await response.json();
  } catch (_e) {
    data = null;
  }
  return { ok: response.ok && !data?.error, data };
};

const countVariables = (text) => new Set(String(text || '').match(/\{\{\d+\}\}/g) || []).size;

const printTemplateRecipe = (name, language, required) => {
  console.log(`        Create it in Meta > WhatsApp Manager > Message templates:`);
  console.log(`          Name: ${name}   Category: Utility   Language: ${language}`);
  console.log(`          Header: Document (upload any sample PDF)`);
  console.log(`          Body: ${required.sampleBody}`);
};

(async () => {
  console.log('WhatsApp Business setup check (read-only, no message is sent)\n');

  const env = readEnv();
  if (!env) {
    fail('No .env file found.', 'Copy .env.example to .env and fill in the values.');
    process.exit(1);
  }

  const token = env.EXPO_PUBLIC_WHATSAPP_ACCESS_TOKEN || '';
  const rawPhoneId = env.EXPO_PUBLIC_WHATSAPP_PHONE_NUMBER_ID || '';
  const phoneId = rawPhoneId.replace(/\D/g, '');
  const version = env.EXPO_PUBLIC_WHATSAPP_API_VERSION || 'v23.0';
  const language = env.EXPO_PUBLIC_WHATSAPP_TEMPLATE_LANGUAGE || 'en';
  const wabaId = (env.WHATSAPP_BUSINESS_ACCOUNT_ID || '').replace(/\D/g, '');

  console.log('1. Settings in .env');
  if (token) pass('Access token is filled in.');
  else fail('EXPO_PUBLIC_WHATSAPP_ACCESS_TOKEN is empty.', 'Paste the token from Meta into .env.');
  if (phoneId) {
    pass('Phone number ID is filled in.');
    if (rawPhoneId !== phoneId) {
      warn('The phone number ID in .env has extra characters (the app ignores them).', 'Keep digits only.');
    }
  } else {
    fail('EXPO_PUBLIC_WHATSAPP_PHONE_NUMBER_ID is empty.', 'Copy "Phone number ID" from Meta > WhatsApp > API Setup.');
  }
  if (!token || !phoneId) {
    console.log('\nResult: NOT READY. The app keeps using the normal share sheet until both values are set.');
    process.exit(1);
  }

  console.log('\n2. Token and phone number (asked from Meta)');
  const phone = await graphGet(version, `${phoneId}?fields=display_phone_number,verified_name,quality_rating`, token);
  if (!phone.ok) {
    const error = phone.data?.error || {};
    fail(
      `Meta rejected the request: ${error.message || 'unknown error'} (code ${error.code ?? '?'})`,
      error.code === 190
        ? 'The token is invalid or has expired. Create a new one in Meta and update .env.'
        : 'Check that the phone number ID belongs to the same WhatsApp Business Account as the token.'
    );
    console.log('\nResult: NOT READY.');
    process.exit(1);
  }
  pass(`Token accepted. Sending number: ${phone.data.display_phone_number} (${phone.data.verified_name}).`);
  if (/test number/i.test(String(phone.data.verified_name))) {
    warn(
      'This is Meta\'s Test Number.',
      'It can only send to numbers you added and verified under API Setup > "To". Use your own business number for customers.'
    );
  }

  console.log('\n3. Message templates');
  if (!wabaId) {
    warn(
      'Templates were not checked: WHATSAPP_BUSINESS_ACCOUNT_ID is not in .env.',
      'Add WHATSAPP_BUSINESS_ACCOUNT_ID=<the "WhatsApp Business Account ID" from API Setup> to .env and run this again.'
    );
    for (const required of REQUIRED_TEMPLATES) {
      const name = env[required.envKey] || required.fallbackName;
      console.log(`\n  Needed for ${required.usedFor}:`);
      printTemplateRecipe(name, language, required);
    }
  } else {
    const list = await graphGet(
      version,
      `${wabaId}/message_templates?fields=name,status,language,components&limit=250`,
      token
    );
    if (!list.ok) {
      const error = list.data?.error || {};
      fail(
        `Could not read the templates: ${error.message || 'unknown error'} (code ${error.code ?? '?'})`,
        'Check WHATSAPP_BUSINESS_ACCOUNT_ID, and that the token has the whatsapp_business_management permission.'
      );
    } else {
      templatesChecked = true;
      const templates = list.data?.data || [];
      for (const required of REQUIRED_TEMPLATES) {
        const name = env[required.envKey] || required.fallbackName;
        const sameName = templates.filter((t) => t.name === name);
        const template = sameName.find((t) => t.language === language);
        if (sameName.length === 0) {
          fail(`"${name}" (${required.usedFor}) does not exist.`);
          printTemplateRecipe(name, language, required);
          continue;
        }
        if (!template) {
          fail(
            `"${name}" exists only in: ${sameName.map((t) => t.language).join(', ')}; the app asks for "${language}".`,
            `Set EXPO_PUBLIC_WHATSAPP_TEMPLATE_LANGUAGE to one of those, or add the "${language}" language to the template.`
          );
          continue;
        }
        const problems = [];
        const notApproved = template.status !== 'APPROVED';
        const header = (template.components || []).find((c) => c.type === 'HEADER');
        if (!header || header.format !== 'DOCUMENT') problems.push('the header is not a Document');
        const body = (template.components || []).find((c) => c.type === 'BODY');
        const variableCount = countVariables(body?.text);
        if (variableCount !== required.variables) {
          problems.push(`the body has ${variableCount} variable(s); the app sends ${required.variables}`);
        }
        if (problems.length > 0) {
          fail(`"${name}" (${required.usedFor}): ${problems.join('; ')}.`);
          printTemplateRecipe(name, language, required);
        } else if (notApproved) {
          // The template is built correctly; only Meta's review is outstanding
          fail(
            `"${name}" (${required.usedFor}) matches the app, but its status is ${template.status}.`,
            template.status === 'PENDING'
              ? 'Meta is still reviewing it. Nothing to change; run this check again later.'
              : 'It must be APPROVED. Open it in WhatsApp Manager to see why, then edit and resubmit.'
          );
        } else {
          pass(`"${name}" (${required.usedFor}) is approved and matches the app.`);
        }
      }
    }
  }

  let result = 'READY';
  if (failures > 0) result = 'NOT READY';
  else if (!templatesChecked) result = 'TOKEN AND NUMBER ARE OK, BUT THE TEMPLATES WERE NOT CHECKED';
  else if (warnings > 0) result = 'READY WITH WARNINGS';
  console.log(`\nResult: ${result} (${failures} problem(s), ${warnings} warning(s)).`);
  if (failures === 0) console.log('Restart the app with "npx expo start -c" so it reads .env.');
  process.exit(failures > 0 ? 1 : 0);
})().catch((error) => {
  console.error('The check could not run:', error?.message || error);
  process.exit(1);
});
