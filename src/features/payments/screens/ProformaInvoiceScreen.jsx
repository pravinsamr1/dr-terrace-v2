import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTabBar } from '../../../core/context/TabBarContext';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import { createPdfFile, sharePdfFile, toSafeFileName } from '../../../core/utils/pdfShare';
import { sendDocumentOnWhatsApp } from '../../whatsapp/utils/sendDocumentOnWhatsApp';
import InnerHeader from '../../../shared/components/InnerHeader';
import { MaterialOverlayLoader, MaterialPageLoader } from '../../../shared/components/material';
import { quotationRepository } from '../../quotations/api/quotationRepository';
import { PROFORMA_DOC_TITLE, buildProformaReceiptData, getProformaInvoiceNumber } from '../utils/proformaInvoice';
import { generateTaxInvoiceHTML } from './ReceiptScreen';

// The invoice is laid out on fixed A4 pages (210mm). For the phone preview, fit that width to the screen
// (pinch to zoom in) and separate the pages; the exported PDF uses the original HTML untouched.
const toPreviewHtml = (html) =>
  html
    .replace(
      /<meta\s+name="viewport"[\s\S]*?\/>/,
      '<meta name="viewport" content="width=794, minimum-scale=0.3, maximum-scale=4, user-scalable=yes" />'
    )
    .replace('</head>', '<style>html, body { background: #E2E8F0; } .invoice-page { margin: 0 auto 12px; }</style></head>');

// A4 at 72dpi
const A4_WIDTH = 595;
const A4_HEIGHT = 842;

export default function ProformaInvoiceScreen() {
  const router = useRouter();
  const { id, quoteId } = useLocalSearchParams();
  const { setTabBarVisible } = useTabBar();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const [invoice, setInvoice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  React.useEffect(() => {
    setTabBarVisible(false);
    return () => setTabBarVisible(true);
  }, [setTabBarVisible]);

  React.useEffect(() => {
    let isMounted = true;
    const loadInvoice = async () => {
      let nextInvoice = null;
      let nextError = null;
      try {
        if (!quoteId) throw new Error('No quotation was selected. Please go back and try again.');
        const res = await quotationRepository.getQuotationPdfView(quoteId);
        const quotation = res?.quotation;
        if (!res?.success || !quotation) {
          throw new Error(res?.message || 'Quotation data could not be loaded from server. Please go back and try again.');
        }
        if (quotation.isTaxCustomer !== true) {
          throw new Error('A proforma invoice is only available for tax customers.');
        }
        // Built once so the preview and the shared PDF carry the same date
        const html = generateTaxInvoiceHTML(
          null,
          quotation.customerGstNumber || '',
          buildProformaReceiptData(quotation),
          { isFullServiceReceipt: 'true', docTitle: PROFORMA_DOC_TITLE },
          null
        );
        nextInvoice = {
          html,
          invoiceNo: getProformaInvoiceNumber(quotation),
          clientName: String(quotation.customer?.name || 'Customer').trim(),
          phone: quotation.customer?.mobile || quotation.mobileNumber || quotation.phone,
        };
      } catch (err) {
        nextError = err?.message || 'Could not load the proforma invoice.';
      }
      if (!isMounted) return;
      setInvoice(nextInvoice);
      setLoadError(nextError);
      setIsLoading(false);
    };
    loadInvoice();
    return () => {
      isMounted = false;
    };
  }, [quoteId]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else if (id) {
      router.replace({ pathname: '/customer-detail', params: { id, initialTab: 'payments' } });
    } else {
      router.replace('/(tabs)');
    }
  }, [id, router]);

  React.useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [handleBack]);

  // One PDF per share, written to the app cache under a fixed name (a repeat share replaces it)
  const preparePdf = async () => {
    if (!invoice?.html) {
      throw new Error('Invoice HTML is not available.');
    }
    const fileName = `${toSafeFileName(invoice.clientName, 'Customer')}_Proforma_${toSafeFileName(invoice.invoiceNo, 'Invoice')}.pdf`;
    const shareUri = await createPdfFile({ html: invoice.html, fileName, width: A4_WIDTH, height: A4_HEIGHT });
    return { shareUri, fileName };
  };

  const handleSharePDF = async () => {
    if (!invoice || isSharing) return;
    try {
      setIsSharing(true);
      const { shareUri } = await preparePdf();
      await sharePdfFile({ uri: shareUri, title: `Share Proforma Invoice - ${invoice.invoiceNo}` });
    } catch (error) {
      Alert.alert('Error', `Failed to share the proforma invoice:\n${error?.message || String(error)}`);
    } finally {
      setIsSharing(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!invoice || isSharing) return;
    try {
      setIsSharing(true);
      // Sends from the business WhatsApp number when WhatsApp Business is set up; otherwise opens the share sheet
      await sendDocumentOnWhatsApp({
        documentType: 'receipt',
        documentLabel: 'proforma invoice',
        customerName: invoice.clientName,
        phone: invoice.phone,
        bodyParams: [invoice.clientName, 'proforma invoice', invoice.invoiceNo],
        onBusyChange: setIsSendingWhatsApp,
        buildPdf: async () => {
          const { shareUri, fileName } = await preparePdf();
          return { uri: shareUri, fileName };
        },
        fallbackShare: async () => {
          const { shareUri } = await preparePdf();
          await sharePdfFile({ uri: shareUri, title: `Send Proforma Invoice - ${invoice.invoiceNo} via WhatsApp` });
        },
      });
    } catch (error) {
      Alert.alert('Error', `Failed to share the proforma invoice:\n${error?.message || String(error)}`);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <InnerHeader title="Proforma Invoice" onBack={handleBack} paddingTop={insets.top} isDark={isDark} />

      <View style={{ flex: 1, backgroundColor: '#E2E8F0' }}>
        {isLoading ? (
          <MaterialPageLoader
            title="Loading Proforma Invoice..."
            subtitle="Fetching quotation details & invoice preview"
            fullScreen={false}
          />
        ) : loadError ? (
          <View style={styles.loaderContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Failed to Load</Text>
            <Text style={styles.errorMessage}>{loadError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleBack}>
              <Text style={styles.retryButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            key={`proforma-${quoteId}-${invoice.html.length}`}
            originWhitelist={['*']}
            source={{ html: toPreviewHtml(invoice.html) }}
            style={{ flex: 1, backgroundColor: '#E2E8F0' }}
            scrollEnabled={true}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
            showsHorizontalScrollIndicator={false}
            bounces={true}
            textZoom={100}
            overScrollMode="always"
          />
        )}
      </View>

      {/* Bottom Action Controls */}
      {!isLoading && !loadError && (
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 14,
            backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF',
            borderTopWidth: 1,
            borderColor: isDark ? '#334155' : '#E2E8F0',
            paddingBottom: Math.max(insets.bottom, 16) + 85,
            flexDirection: 'row',
            gap: 12,
            zIndex: 1000,
          }}
        >
          <TouchableOpacity
            style={{
              flex: 1.2,
              backgroundColor: '#25D366',
              paddingVertical: 14,
              borderRadius: 12,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: isSharing ? 0.7 : 1,
            }}
            onPress={handleSendWhatsApp}
            disabled={isSharing}
            activeOpacity={0.85}
          >
            {isSharing ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
            )}
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>
              {isSharing ? 'Preparing...' : 'Send via WhatsApp'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flex: 0.8,
              backgroundColor: isDark ? '#334155' : '#0052CC',
              paddingVertical: 14,
              borderRadius: 12,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: isSharing ? 0.7 : 1,
            }}
            onPress={handleSharePDF}
            disabled={isSharing}
            activeOpacity={0.85}
          >
            <Ionicons name="share-social-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>Share PDF</Text>
          </TouchableOpacity>
        </View>
      )}
      <MaterialOverlayLoader
        visible={isSendingWhatsApp}
        title="Sending on WhatsApp..."
        subtitle="Preparing the PDF and sending it to the customer"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF5FD',
  },
  containerDark: {
    backgroundColor: '#080808',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#0052CC',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});