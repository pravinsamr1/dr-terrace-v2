/**
 * WhatsApp Business (Cloud API) settings.
 *
 * The values come from the project's .env file (EXPO_PUBLIC_* variables), which is not committed to git.
 * See .env.example for the list.
 *
 * SECURITY: EXPO_PUBLIC_* values are compiled into the app, so the access token can be read by anyone who
 * has the APK. Keep the token's permissions to WhatsApp messaging only, set a spending limit in Meta
 * Business settings, and rotate the token if a phone or build is lost.
 *
 * When the token or the phone number ID is missing, the feature is off and the "Send via WhatsApp" buttons
 * keep opening the normal share sheet.
 */
// Small typos in .env (quotes, spaces, a "+" in front of the ID) must not silently break every request
const clean = (value) => String(value || '').trim().replace(/^["']|["']$/g, '').trim();
const digitsOnly = (value) => clean(value).replace(/\D/g, '');

export const WHATSAPP_BUSINESS = {
  accessToken: clean(process.env.EXPO_PUBLIC_WHATSAPP_ACCESS_TOKEN),
  // The phone number ID is a number (not the phone number itself)
  phoneNumberId: digitsOnly(process.env.EXPO_PUBLIC_WHATSAPP_PHONE_NUMBER_ID),
  // Use the Graph API version shown in your Meta app dashboard
  apiVersion: clean(process.env.EXPO_PUBLIC_WHATSAPP_API_VERSION) || 'v23.0',
  // Must match the language the templates were approved in (for example en, en_US, en_GB)
  languageCode: clean(process.env.EXPO_PUBLIC_WHATSAPP_TEMPLATE_LANGUAGE) || 'en',

  /**
   * Approved message templates. Each one needs a DOCUMENT header and exactly these body variables:
   *   quotation: {{1}} customer name, {{2}} quotation number
   *   receipt:   {{1}} customer name, {{2}} document name (receipt / tax invoice / cash bill / proforma invoice),
   *              {{3}} document number
   *   warranty:  {{1}} customer name
   */
  templates: {
    quotation: clean(process.env.EXPO_PUBLIC_WHATSAPP_TEMPLATE_QUOTATION) || 'quotation_document',
    receipt: clean(process.env.EXPO_PUBLIC_WHATSAPP_TEMPLATE_RECEIPT) || 'receipt_document',
    warranty: clean(process.env.EXPO_PUBLIC_WHATSAPP_TEMPLATE_WARRANTY) || 'warranty_document',
  },
};

export const isWhatsAppBusinessConfigured = () =>
  Boolean(WHATSAPP_BUSINESS.accessToken && WHATSAPP_BUSINESS.phoneNumberId);
