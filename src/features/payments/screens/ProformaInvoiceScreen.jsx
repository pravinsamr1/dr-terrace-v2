import { Ionicons } from '@expo/vector-icons';
import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TurboModuleRegistry,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTabBar } from '../../../core/context/TabBarContext';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import InnerHeader from '../../../shared/components/InnerHeader';
import { MaterialPageLoader } from '../../../shared/components/material';
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

  const getPdfUri = async () => {
    const { uri, base64 } = await Print.printToFileAsync({ html: invoice.html, base64: true });
    const cleanClientName = invoice.clientName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetUri = cacheDirectory ? `${cacheDirectory}${cleanClientName}_Proforma_${invoice.invoiceNo}.pdf` : null;
    if (targetUri && base64) {
      try {
        await writeAsStringAsync(targetUri, base64, { encoding: 'base64' });
        return targetUri;
      } catch (writeErr) {
        console.warn('Proforma PDF write failed, using the generated file:', writeErr?.message);
      }
    }
    return uri;
  };

  const handleSharePDF = async () => {
    if (!invoice || isSharing) return;
    try {
      setIsSharing(true);
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Unavailable', 'Sharing is not supported on this device.');
        return;
      }
      const fileUri = await getPdfUri();
      try {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Proforma Invoice - ${invoice.invoiceNo}`,
          UTI: 'com.adobe.pdf',
        });
      } catch (shareErr) {
        // expo-sharing can refuse a file path on some Android devices; react-native-share reads it through its own provider
        console.warn('Proforma share via expo-sharing failed:', fileUri, shareErr?.message);
        if (!TurboModuleRegistry.get('RNShare')) throw shareErr;
        const Share = require('react-native-share').default;
        await Share.open({ url: fileUri, type: 'application/pdf', failOnCancel: false });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share the proforma invoice: ' + (error?.message || error));
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
        <View style={{
          paddingHorizontal: 16,
          paddingTop: 14,
          backgroundColor: isDark ? '#1C1C1C' : '#FFFFFF',
          borderTopWidth: 1,
          borderColor: isDark ? '#334155' : '#E2E8F0',
          paddingBottom: Math.max(insets.bottom, 16) + 85,
          flexDirection: 'row',
          gap: 12,
          zIndex: 1000,
        }}>
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
            onPress={handleSharePDF}
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
