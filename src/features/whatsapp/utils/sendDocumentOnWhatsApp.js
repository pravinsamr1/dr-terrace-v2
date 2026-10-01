import { Alert } from 'react-native';
import { toWhatsAppNumber, whatsappBusinessRepository } from '../api/whatsappBusinessRepository';
import { isWhatsAppBusinessConfigured } from '../config/whatsappBusinessConfig';

const ask = (title, message, confirmText) =>
  new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });

let sendInProgress = false;

/**
 * "Send via WhatsApp" flow shared by the quotation, receipt, proforma and warranty screens.
 *
 * - WhatsApp Business not set up in this app -> `fallbackShare()` (the normal share sheet, as before).
 * - Otherwise: confirm with the customer's name and number, build the PDF, send it from the business number.
 *   If the number is unusable or the send fails, staff can still share the PDF manually.
 *
 * @param {object} options
 * @param {'quotation'|'receipt'|'warranty'} options.documentType  Which approved template to use
 * @param {string} options.documentLabel   Shown to staff, e.g. "quotation", "tax invoice"
 * @param {string} options.customerName
 * @param {string} options.phone           Customer's number as stored (any format)
 * @param {string[]} options.bodyParams    Template variables, in order
 * @param {() => Promise<{uri: string, fileName: string}>} options.buildPdf
 * @param {() => Promise<void>} options.fallbackShare
 * @param {(busy: boolean) => void} [options.onBusyChange]  true while the PDF is being built and sent
 * @param {boolean} [options.withoutTemplate]  Send the PDF as a plain document instead of a template. WhatsApp
 *   only delivers that when the customer messaged the business number in the last 24 hours.
 * @param {string} [options.caption]  Text shown under the PDF (only used with withoutTemplate)
 */
export async function sendDocumentOnWhatsApp(options) {
  if (!isWhatsAppBusinessConfigured()) {
    return options.fallbackShare();
  }
  // One send at a time: a second tap while a send (or its confirmation) is open must not send twice
  if (sendInProgress) return undefined;
  sendInProgress = true;
  try {
    return await runSend(options);
  } finally {
    sendInProgress = false;
  }
}

async function runSend({
  documentType,
  documentLabel,
  customerName,
  phone,
  bodyParams,
  buildPdf,
  fallbackShare,
  onBusyChange,
  withoutTemplate = false,
  caption,
}) {
  const name = String(customerName || '').trim() || 'the customer';
  const to = toWhatsAppNumber(phone);

  if (!to) {
    const shareInstead = await ask(
      'Phone Number Missing',
      `No valid mobile number is saved for ${name}, so the ${documentLabel} cannot be sent from the business WhatsApp number.`,
      'Share Manually'
    );
    return shareInstead ? fallbackShare() : undefined;
  }

  const confirmed = await ask(
    withoutTemplate ? 'Send Without Template' : 'Send on WhatsApp',
    withoutTemplate
      ? `Send the ${documentLabel} to ${name} (+${to}) from the business WhatsApp number as a plain document?\n\n` +
          'This only reaches the customer if they messaged the business number in the last 24 hours.'
      : `Send the ${documentLabel} to ${name} (+${to}) from the business WhatsApp number?`,
    'Send'
  );
  if (!confirmed) return undefined;

  try {
    onBusyChange?.(true);
    try {
      const { uri, fileName } = await buildPdf();
      if (withoutTemplate) {
        await whatsappBusinessRepository.sendPdfWithoutTemplate({ to, fileUri: uri, fileName, caption });
      } else {
        await whatsappBusinessRepository.sendPdfDocument({ documentType, to, fileUri: uri, fileName, bodyParams });
      }
    } finally {
      onBusyChange?.(false);
    }
    Alert.alert('Sent', `WhatsApp accepted the ${documentLabel} for ${name} (+${to}).`);
  } catch (error) {
    console.warn('[WhatsAppBusiness] send failed:', error?.code ?? error?.status ?? '', error?.message);
    const shareInstead = await ask(
      'Could Not Send',
      `${error?.message || 'WhatsApp did not accept the message.'}\n\nYou can share the PDF manually instead.`,
      'Share Manually'
    );
    if (shareInstead) return fallbackShare();
  }
  return undefined;
}
