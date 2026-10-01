import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';
import { WHATSAPP_BUSINESS, isWhatsAppBusinessConfigured } from '../config/whatsappBusinessConfig';

/**
 * WhatsApp Business Cloud API calls (graph.facebook.com).
 *
 * These deliberately do NOT go through the app's apiClient: that client attaches the user's own login token
 * to every request, and it must never be sent to Meta. Requests here carry only the WhatsApp access token.
 */
const GRAPH_BASE_URL = 'https://graph.facebook.com';

const endpoint = (resource) =>
  `${GRAPH_BASE_URL}/${WHATSAPP_BUSINESS.apiVersion}/${WHATSAPP_BUSINESS.phoneNumberId}/${resource}`;

const authHeader = () => ({ Authorization: `Bearer ${WHATSAPP_BUSINESS.accessToken}` });

const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch (_e) {
    return null;
  }
};

/** Plain-language reasons for the errors staff are most likely to meet. */
const FRIENDLY_ERRORS = {
  190: 'The WhatsApp access token is invalid or has expired. Please update it.',
  131026: 'This number cannot receive the message. It may not be on WhatsApp.',
  131030: 'This number is not in the allowed test list of the WhatsApp Business account.',
  131047:
    'The customer has not messaged the business number in the last 24 hours, so WhatsApp only allows an approved template. Use "Send via WhatsApp" instead.',
  132000: 'The message template has a different number of variables than the app sends.',
  132001: 'The message template was not found in this language. Check the template name and language.',
  130429: 'Too many messages were sent in a short time. Please try again in a minute.',
};

const toApiError = (data, status) => {
  const apiError = data?.error;
  const code = apiError?.code;
  const message =
    FRIENDLY_ERRORS[code] ||
    apiError?.error_data?.details ||
    apiError?.message ||
    `WhatsApp did not accept the request (HTTP ${status}).`;
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
};

/**
 * Indian mobile number in the form the Cloud API expects: country code + number, digits only
 * (for example 919876543210). Returns '' when the number cannot be used.
 */
export const toWhatsAppNumber = (rawPhone) => {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return '';
};

/**
 * WhatsApp treats "English", "English (US)" and "English (UK)" as different template languages, and it is easy to
 * pick another one than the app is set to. When the configured language is English and the template is not found
 * in it, the other English variants are tried, and the one that works is remembered for the next sends.
 */
const ENGLISH_VARIANTS = ['en', 'en_US', 'en_GB'];
let workingLanguage = null;

const languagesToTry = () => {
  const configured = WHATSAPP_BUSINESS.languageCode;
  const candidates = [workingLanguage, configured];
  if (ENGLISH_VARIANTS.includes(configured)) candidates.push(...ENGLISH_VARIANTS);
  return [...new Set(candidates.filter(Boolean))];
};

const TEMPLATE_NOT_FOUND = 132001;

/** Template variables may not contain line breaks, tabs or long runs of spaces, and may not be empty. */
const toTemplateText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim() || '-';

/** POSTs one message to WhatsApp and returns its message id. */
const postMessage = async (payload) => {
  const response = await fetch(endpoint('messages'), {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });
  const data = parseJson(await response.text());
  const messageId = data?.messages?.[0]?.id;
  if (!response.ok || !messageId) {
    throw toApiError(data, response.status);
  }
  return messageId;
};

export const whatsappBusinessRepository = {
  /** Uploads a PDF from the phone to WhatsApp and returns its media id. */
  uploadPdf: async (fileUri) => {
    const response = await uploadAsync(endpoint('media'), fileUri, {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: 'application/pdf',
      parameters: { messaging_product: 'whatsapp', type: 'application/pdf' },
      headers: authHeader(),
    });
    const data = parseJson(response.body);
    if (response.status < 200 || response.status >= 300 || !data?.id) {
      throw toApiError(data, response.status);
    }
    return data.id;
  },

  /** Sends an approved template whose header is the uploaded PDF. Returns WhatsApp's message id. */
  sendDocumentTemplate: async ({ to, templateName, languageCode, mediaId, fileName, bodyParams = [] }) => {
    const components = [
      { type: 'header', parameters: [{ type: 'document', document: { id: mediaId, filename: fileName } }] },
    ];
    if (bodyParams.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParams.map((value) => ({ type: 'text', text: toTemplateText(value) })),
      });
    }

    return postMessage({
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode || WHATSAPP_BUSINESS.languageCode },
        components,
      },
    });
  },

  /**
   * Sends the uploaded PDF as a plain document message, without a template.
   * WhatsApp only delivers this when the customer has messaged the business number in the last 24 hours.
   */
  sendDocumentMessage: async ({ to, mediaId, fileName, caption }) => {
    const document = { id: mediaId, filename: fileName };
    if (caption) document.caption = String(caption);
    return postMessage({ to, type: 'document', document });
  },

  /**
   * Uploads the PDF and sends it as a plain document (no template). `to` must be in Cloud API form.
   * Resolving means WhatsApp ACCEPTED the message; delivery to the phone is not confirmed here.
   */
  sendPdfWithoutTemplate: async ({ to, fileUri, fileName, caption }) => {
    if (!isWhatsAppBusinessConfigured()) {
      throw new Error('WhatsApp Business is not set up in this app.');
    }
    const mediaId = await whatsappBusinessRepository.uploadPdf(fileUri);
    const messageId = await whatsappBusinessRepository.sendDocumentMessage({ to, mediaId, fileName, caption });
    return { messageId };
  },

  /**
   * Uploads the PDF and sends it with the template for `documentType` ('quotation' | 'receipt' | 'warranty').
   * `to` must already be in Cloud API form (see toWhatsAppNumber).
   * Resolving means WhatsApp ACCEPTED the message; delivery to the phone is not confirmed here.
   */
  sendPdfDocument: async ({ documentType, to, fileUri, fileName, bodyParams }) => {
    if (!isWhatsAppBusinessConfigured()) {
      throw new Error('WhatsApp Business is not set up in this app.');
    }
    const templateName = WHATSAPP_BUSINESS.templates[documentType];
    if (!templateName) {
      throw new Error(`No WhatsApp template is set for "${documentType}".`);
    }
    const mediaId = await whatsappBusinessRepository.uploadPdf(fileUri);

    const languages = languagesToTry();
    for (const languageCode of languages) {
      try {
        const messageId = await whatsappBusinessRepository.sendDocumentTemplate({
          to,
          templateName,
          languageCode,
          mediaId,
          fileName,
          bodyParams,
        });
        workingLanguage = languageCode;
        return { messageId, languageCode };
      } catch (error) {
        // Only "template not found in this language" is worth retrying in another language
        if (error?.code !== TEMPLATE_NOT_FOUND) throw error;
      }
    }

    const notFound = new Error(
      `WhatsApp has no approved template named "${templateName}" (languages tried: ${languages.join(', ')}). ` +
        'Create it in Meta and wait for approval, or correct the template name in the app settings.'
    );
    notFound.code = TEMPLATE_NOT_FOUND;
    throw notFound;
  },
};

export default whatsappBusinessRepository;
