import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  cacheDirectory,
  copyAsync,
  deleteAsync,
  getInfoAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text as RNText,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logoBase64 } from '../../../shared/constants/LogoBase64';
import { appointmentRepository } from '../../appointments/api/appointmentRepository';
import { clientRepository } from '../../clients/api/clientRepository';
import { warrantyRepository } from '../api/warrantyRepository';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import InnerHeader from '../../../shared/components/InnerHeader';
import { formatDateDDMMYY } from '../../../core/utils/dateFormat';
import { transformStyleForJakarta } from '../../../core/theme/initFonts';

const Text = React.forwardRef((props, ref) => (
  <RNText ref={ref} {...props} style={transformStyleForJakarta(props.style, true)} />
));
Text.displayName = 'Text';

export default function WarrantyLetterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { id, quotationId } = useLocalSearchParams();
  const [appointment, setAppointment] = React.useState(null);
  const [officialWarranty, setOfficialWarranty] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      const cleanId = id ? String(id).replace(/^DR/i, '').trim() : null;
      let appData = null;
      if (cleanId) {
        const aRes = await appointmentRepository.getAppointmentById(cleanId);
        if (aRes?.success && aRes.appointment) {
          appData = aRes.appointment;
        } else {
          const cRes = await clientRepository.getClientById(cleanId);
          if (cRes?.success && (cRes.client || cRes.data)) {
            appData = cRes.client || cRes.data;
          }
        }
      }
      setAppointment(appData);

      const targetQuoteId =
        quotationId ||
        appData?.confirmedQuoteId ||
        appData?.activeQuotationId ||
        appData?.quotations?.find?.((q) => q.isConfirmed)?.id;
      if (targetQuoteId) {
        const wRes = await warrantyRepository.getWarranty(targetQuoteId);
        if (wRes?.success && wRes.warranty) {
          setOfficialWarranty(wRes.warranty);
        }
      }
      setIsLoading(false);
    }
    loadData();
  }, [id, quotationId]);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: isDark ? '#fff' : '#000' }}>Loading warranty...</Text>
      </View>
    );
  }

  if (!appointment && !officialWarranty) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: isDark ? '#fff' : '#000' }}>Warranty not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: '#0052CC' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Derived data
  const currentDate = formatDateDDMMYY(new Date());
  const refNo = officialWarranty?.receiptNumber || ('Dr.217' + (appointment?.id || ''));
  const siteEngineerCode = officialWarranty?.siteEngineerCode || appointment?.siteEngineerCode || '';
  const serviceType = appointment?.serviceType || 'Waterproofing System';

  const nameLower = appointment?.clientName?.trim?.().toLowerCase() || '';
  const hasPrefix = ""
  const clientName = appointment?.clientName
    ? ((hasPrefix ? '' : '') + appointment.clientName.toUpperCase())
    : 'VALUED CLIENT';
  const address = (appointment?.address || appointment?.location || 'Chennai').toUpperCase();
  const mobile = appointment?.mobile || appointment?.phone || appointment?.mobileNumber || '';
  const clientLine = [clientName, address, mobile ? ('MOBILE NO. ' + mobile) : '']
    .filter(Boolean)
    .join(', ');

  const completedDate = officialWarranty?.warrantyStartDate
    ? formatDateDDMMYY(officialWarranty.warrantyStartDate)
    : appointment?.warranty?.completedDate
      ? formatDateDDMMYY(appointment.warranty.completedDate)
      : 'N/A';

  const validYears = appointment?.warranty?.validYears;
  const serviceWarranties = appointment?.warranty?.serviceWarranties || [];

  // PDF
  const warrantyItemsHtml =
    officialWarranty?.items?.length > 0
      ? officialWarranty.items
          .map(
            (it) =>
              '<p><span class="lbl">Warranty Valid :</span>&nbsp;&nbsp;<span class="red">' +
              it.years + ' ' + (it.years === 1 ? 'YEAR' : 'YEARS') +
              ' FOR ' + it.serviceTitle.toUpperCase() +
              ' FROM THE DATE OF WORK COMPLETION.</span></p>'
          )
          .join('')
      : serviceWarranties.length > 0
        ? serviceWarranties
            .map(
              (sw) =>
                '<p><span class="lbl">Warranty Valid :</span>&nbsp;&nbsp;<span class="red">' +
                sw.duration.toUpperCase() + ' FOR ' + sw.serviceName.toUpperCase() +
                ' FROM THE DATE OF WORK COMPLETION.</span></p>'
            )
            .join('')
        : '<p><span class="lbl">Warranty Valid :</span>&nbsp;&nbsp;<span class="red">' +
          String(validYears).toUpperCase() + ' FOR ' + serviceType.toUpperCase() +
          ' FROM THE DATE OF WORK COMPLETION.</span></p>';

  const generateAndSharePDF = async () => {
    const htmlContent =
      '<html><head>' +
      '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">' +
      '<style>' +
      '@page{margin:44px 52px;}' +
      'body{font-family:"Plus Jakarta Sans",Helvetica,Arial,sans-serif;font-size:13.5px;color:#1e293b;line-height:1.65;}' +
      '.logo{width:84px;height:auto;object-fit:contain;display:block;}' +
      '.header{display:flex;align-items:center;margin-bottom:8px;}' +
      '.header-side{flex:1 1 0;}' +
      '.meta-row{display:flex;justify-content:space-between;margin-bottom:2px;}' +
      '.meta-r{color:#CC0000;font-weight:700;font-size:13px;}' +
      '.ref-no{flex:0 1 auto;padding:0 12px;text-align:center;color:#CC0000;font-weight:800;font-size:20px;text-decoration:underline;}' +
      '.italic{font-style:italic;}' +
      'hr.thin{border:none;border-top:1px solid #CBD5E1;margin:10px 0 14px 0;}' +
      'p{margin-bottom:13px;text-align:justify;}' +
      '.lbl{font-weight:700;text-decoration:underline;color:#1e293b;}' +
      '.red{color:#CC0000;font-weight:700;}' +
      '.indent{text-indent:40px;}' +
      'hr.dash{border:none;border-top:1px dashed #94a3b8;margin:22px 0 14px 0;}' +
      '.fb{font-weight:800;color:#0f172a;font-size:12px;}' +
      '.fa{font-size:11.5px;color:#374151;line-height:17px;}' +
      '</style></head><body>' +
      '<div class="header"><div class="header-side"><img src="data:image/png;base64,' + logoBase64 + '" class="logo" /></div>' +
      '<div class="ref-no">Warranty reference no-' + refNo + '</div><div class="header-side"></div></div>' +
      '<div class="meta-row"><span>' + currentDate + '</span></div>' +
      '<div class="meta-row">' +
      // '<span class="italic">Warranty Letter</span>' +
      '<span></span>' +
      (siteEngineerCode ? '<span class="meta-r">Site Engineer coad -' + siteEngineerCode + '</span>' : '') +
      '</div><hr class="thin"/>' +
      '<p>This is to certify that we have done a <b>' + serviceType + '</b> in the below mentioned building if require in future in order to claim the warranty please submit this along with your building leaking pictures.</p>' +
      '<p><span class="lbl">Warranty For:</span>&nbsp;&nbsp;<span class="red">' + clientLine + '</span></p>' +
      '<p><span class="lbl">Work Completed:</span> <span class="red">' + serviceType.toUpperCase() + ' COMPLETED ON ' + completedDate + '.</span></p>' +
      warrantyItemsHtml +
      '<p><span class="lbl">Warranty Including :</span> We will give free service to fix the leak which including Labour wages, Transportation, Consultation, Site Engineer allowance and salary.</p>' +
      '<p><span class="lbl">Warranty Exclusion For :</span> Customer who has due, Leakages through untreated places, Plumbing, electrical pipes related problems, Damage Due to crackers, Floor mate and flower pots, physically damaged area and for the work which was done as a complementary.</p>' +
      '<p>Kindly mail to service team our service team would give free visit/ service within 30 working days from the date of mail received from the client, required material has to be supplied by the client as a applicator the service which we give would be absolutely with free of cost.</p>' +
      '<p class="indent">Requested you to raise a complaint only through mail with photos with scanned copy of bills and warranty letter in future for fast action on the same. Kindly don\'t give oral complaint to our Supervisor and Sales Managers; Service Team is responsible only for mail complaint which they directly received from client to <a href="mailto:admin@drterrace.com">admin@drterrace.com</a> this will have records for both the ends.</p>' +
      '<p>Rs 500/Day Per visit would be charged for analysing the site against complaint</p>' +
      '<p><b>Dr.Terrace water Proofing</b></p>' +
      '<p>(Computer Generated hence signature not required)</p>' +
      '<hr class="dash"/>' +
      '<div class="fb">Dr.Terrace Water Proofing</div>' +
      '<div class="fa">Parsn Commercial Complex, #C13, B13, 2nd floor, Kodambakkam High Road, Nungambakkam, Chennai-600006, admin@drterrace.com</div>' +
      '</body></html>';
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Unavailable', 'Sharing is not supported on this device.');
        return;
      }

      const { uri, base64 } = await Print.printToFileAsync({ html: htmlContent, base64: true });
      const cleanClientName = (clientLine || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
      const targetName = `warranty_letter_${cleanClientName}.pdf`;
      const targetUri = cacheDirectory ? `${cacheDirectory}${targetName}` : null;

      let shareUri = uri;

      if (targetUri && base64) {
        try {
          await writeAsStringAsync(targetUri, base64, { encoding: 'base64' });
          shareUri = targetUri;
        } catch (writeErr) {
          console.warn('writeAsStringAsync failed, attempting copyAsync fallback:', writeErr?.message);
        }
      }

      if (shareUri === uri && targetUri && uri) {
        try {
          const fileInfo = await getInfoAsync(targetUri);
          if (fileInfo.exists) {
            await deleteAsync(targetUri, { idempotent: true });
          }
          await copyAsync({
            from: uri,
            to: targetUri,
          });
          shareUri = targetUri;
        } catch (copyErr) {
          console.warn('copyAsync failed, using direct print URI:', copyErr?.message);
        }
      }

      const shareOptions = {
        mimeType: 'application/pdf',
        dialogTitle: `Share Warranty Letter - ${clientLine || 'Customer'}`,
      };
      if (Platform.OS === 'ios') {
        shareOptions.UTI = 'com.adobe.pdf';
      }
      await Sharing.shareAsync(shareUri, shareOptions);
    } catch (error) {
      console.error('Error generating PDF', error);
      Alert.alert('Error', 'Failed to generate and share PDF: ' + (error?.message || error));
    }
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <InnerHeader
        title="Warranty Letter"
        paddingTop={insets.top}
        isDark={isDark}
        right={
          <TouchableOpacity onPress={generateAndSharePDF} activeOpacity={0.7}>
            <Ionicons name="share-social-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 80, 100) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.letterPage, isDark && styles.letterPageDark]}>

          {/* Logo | warranty reference no (centered on the page) */}
          <View style={styles.logoRow}>
            <View style={styles.headerSide}>
              <Image
                source={{ uri: `data:image/png;base64,${logoBase64}` }}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.refNo}>{'Warranty reference no-' + refNo}</Text>
            <View style={styles.headerSide} />
          </View>

          {/* Meta Row 1: date */}
          <View style={styles.metaRow}>
            <Text style={styles.metaLeft}>{currentDate}</Text>
          </View>

          {/* Meta Row 2: Warranty Letter | site engineer */}
          <View style={styles.metaRow}>
            {/* <Text style={styles.warrantyLabel}>Warranty Letter</Text> */}
            {Boolean(siteEngineerCode) && (
              <Text style={styles.metaRight}>{'Site Engineer coad -' + siteEngineerCode}</Text>
            )}
          </View>

          {/* Thin line */}
          <View style={styles.thinLine} />

          {/* Intro */}
          <Text style={styles.body}>
            {'This is to certify that we have done a '}
            <Text style={[styles.body, { fontWeight: '700', color: '#0F172A'}]}>{serviceType}</Text>
            {' in the below mentioned building if require in future in order to claim the warranty please submit this along with your building leaking pictures.'}
          </Text>

          {/* Warranty For */}
          <Text style={styles.body}>
            <Text style={styles.lbl}>{'Warranty For:  '}</Text>
            <Text style={styles.redBold}>{clientLine}</Text>
          </Text>

          {/* Work Completed */}
          <Text style={styles.body}>
            <Text style={styles.lbl}>{'Work Completed: '}</Text>
            <Text style={styles.redBold}>{serviceType.toUpperCase() + ' COMPLETED ON ' + completedDate + '.'}</Text>
          </Text>

          {/* Warranty Valid per service */}
          {officialWarranty?.items?.length > 0 ? (
            officialWarranty.items.map((it, idx) => (
              <Text key={it.id || idx} style={styles.body}>
                <Text style={styles.lbl}>{'Warranty Valid : '}</Text>
                <Text style={styles.redBold}>
                  {it.years + ' ' + (it.years === 1 ? 'YEAR' : 'YEARS') + ' FOR ' + it.serviceTitle.toUpperCase() + ' FROM THE DATE OF WORK COMPLETION.'}
                </Text>
              </Text>
            ))
          ) : serviceWarranties.length > 0 ? (
            serviceWarranties.map((sw, idx) => (
              <Text key={idx} style={styles.body}>
                <Text style={styles.lbl}>{'Warranty Valid : '}</Text>
                <Text style={styles.redBold}>
                  {sw.duration.toUpperCase() + ' FOR ' + sw.serviceName.toUpperCase() + ' FROM THE DATE OF WORK COMPLETION.'}
                </Text>
              </Text>
            ))
          ) : (
            <Text style={styles.body}>
              <Text style={styles.lbl}>{'Warranty Valid : '}</Text>
              <Text style={styles.redBold}>
                {String(validYears).toUpperCase() + ' FOR ' + serviceType.toUpperCase() + ' FROM THE DATE OF WORK COMPLETION.'}
              </Text>
            </Text>
          )}

          {/* Warranty Including */}
          <Text style={styles.body}>
            <Text style={styles.lbl}>{'Warranty Including : '}</Text>
            {'We will give free service to fix the leak which including Labour wages, Transportation, Consultation, Site Engineer allowance and salary.'}
          </Text>

          {/* Warranty Exclusion */}
          <Text style={styles.body}>
            <Text style={styles.lbl}>{'Warranty Exclusion For : '}</Text>
            {'Customer who has due, Leakages through untreated places, Plumbing, electrical pipes related problems, physically damaged area and for the work which was done as a complementary.'}
          </Text>

          {/* Service mail */}
          <Text style={styles.body}>
            {'Kindly mail to service team our service team would give free visit/ service within 30 working days from the date of mail received from the client, required material has to be supplied by the client as a applicator the service which we give would be absolutely with free of cost.'}
          </Text>

          {/* Complaint (indented) */}
          <Text style={styles.body}>
            {'        Requested you to raise a complaint only through mail with photos with scanned copy of bills and warranty letter in future for fast action on the same. Kindly don\u2019t give oral complaint to our Supervisor and Sales Managers; Service Team is responsible only for mail complaint which they directly received from client to '}
            <Text style={styles.link}>{'admin@drterrace.com'}</Text>
            {' this will have records for both the ends.'}
          </Text>

          {/* Visit charge */}
          <Text style={styles.body}>
            {'Rs 500/Day Per visit would be charged for analysing the site against complaint'}
          </Text>

          {/* Sign-off */}
          <Text style={[styles.body, { fontWeight: '700', color: '#0F172A', marginTop: 4, marginBottom: 2 }]}>
            {'Dr.Terrace water Proofing'}
          </Text>
          <Text style={styles.body}>
            {'(Computer Generated hence signature not required)'}
          </Text>

          {/* Dashed divider */}
          <View style={styles.dashedLine} />

          {/* Footer */}
          <Text style={styles.footerBold}>Dr.Terrace Water Proofing</Text>
          <Text style={styles.footerText}>
            {'Parsn Commercial Complex, #C13, B13, 2nd floor, Kodambakkam High Road, Nungambakkam,\nChennai-600006, admin@drterrace.com'}
          </Text>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#9CA3AF' },
  containerDark: { backgroundColor: '#111827' },
  scrollContent: { padding: 14 },

  letterPage: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    paddingHorizontal: 22,
    paddingVertical: 26,
    borderWidth: 2,
    borderColor: '#374151',
  },
  letterPageDark: { backgroundColor: '#1E293B', borderColor: '#475569' },

  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerSide: { flex: 1, minWidth: 84 },
  logoImage: { width: 84, height: 74 },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 },
  metaLeft: { fontSize: 13, color: '#1E293B', fontWeight: '500' },
  metaRight: { fontSize: 12, color: '#CC0000', fontWeight: '700', textAlign: 'right', flex: 1, marginLeft: 8 },
  refNo: { flexShrink: 1, paddingHorizontal: 8, fontSize: 18, color: '#CC0000', fontWeight: '800', textAlign: 'center', textDecorationLine: 'underline' },
  warrantyLabel: { fontSize: 13, fontStyle: 'italic', color: '#1E293B', fontWeight: '500' },

  thinLine: { height: 1, backgroundColor: '#CBD5E1', marginVertical: 10 },
  dashedLine: { borderBottomWidth: 1, borderColor: '#94A3B8', borderStyle: 'dashed', marginVertical: 18 },

  body: { fontSize: 12.5, color: '#1E293B', lineHeight: 19, marginBottom: 12, textAlign: 'justify' },
  bold: { fontWeight: '700', color: '#0F172A' },
  lbl: { fontWeight: '700', color: '#0F172A', textDecorationLine: 'underline' },
  redBold: { color: '#CC0000', fontWeight: '700' },
  link: { color: '#1D4ED8', textDecorationLine: 'underline' },

  footerBold: { fontSize: 12, fontWeight: '800', color: '#0F172A', marginBottom: 3 },
  footerText: { fontSize: 11.5, color: '#374151', lineHeight: 17 },
});
