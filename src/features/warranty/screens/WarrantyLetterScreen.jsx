import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appointmentRepository } from '../../appointments/api/appointmentRepository';
import { clientRepository } from '../../clients/api/clientRepository';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import InnerHeader from '../../../shared/components/InnerHeader';

export default function WarrantyLetterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { id } = useLocalSearchParams();
  const [appointment, setAppointment] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    const cleanId = String(id).replace(/^DR/i, '').trim();
    appointmentRepository.getAppointmentById(cleanId).then((res) => {
      if (res?.success && res.appointment) {
        setAppointment(res.appointment);
      } else {
        clientRepository.getClientById(cleanId).then((cRes) => {
          if (cRes?.success && (cRes.client || cRes.data)) {
            setAppointment(cRes.client || cRes.data);
          }
        });
      }
    }).finally(() => {
      setIsLoading(false);
    });
  }, [id]);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: isDark ? '#fff' : '#000' }}>Loading warranty...</Text>
      </View>
    );
  }

  if (!appointment) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: isDark ? '#fff' : '#000' }}>Warranty not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: '#0052CC' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '.');

  const refNo = `Dr.217${appointment.id}`;
  const serviceType = appointment.serviceType || 'Terrace Waterproofing';
  const prefix = appointment.clientName.trim().toLowerCase().startsWith('mr.') ? '' : 'Mr.';
  const clientName = `${prefix}${appointment.clientName}`;
  const address = appointment.address || appointment.location || "Chennai";

  const completedDate = appointment.warranty?.completedDate || 'N/A';
  const validYears = appointment.warranty?.validYears || '10 Years';
  const serviceWarranties = appointment.warranty?.serviceWarranties || [];

  const generateAndSharePDF = async () => {
    const warrantyItemsHtml = serviceWarranties.length > 0
      ? serviceWarranties.map(sw => `<p><span class="bold">Warranty Valid:</span> <span class="bold underline">${sw.duration}</span> for <span class="bold underline">${sw.serviceName}</span> from the Date of Work Completion.</p>`).join('')
      : `<p><span class="bold">Warranty Valid:</span> <span class="bold underline">${validYears}</span> for <span class="bold underline">${serviceType}</span> from the Date of Work Completion.</p>`;

    const htmlContent = `
      <html>
        <head>
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            @page { margin: 40px; }
            body { font-family: 'Plus Jakarta Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0052CC; padding-bottom: 15px; }
            .header h1 { color: #0052CC; margin: 0; font-size: 28px; }
            .header h2 { color: #475569; margin: 5px 0 0 0; font-size: 18px; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 30px; font-weight: bold; }
            .content p { margin-bottom: 16px; text-align: justify; }
            .bold { font-weight: bold; }
            .underline { text-decoration: underline; }
            .note { border-left: 4px solid #0052CC; background-color: #f8fafc; padding: 15px; margin: 25px 0; font-size: 13px; font-weight: bold; }
            .footer { margin-top: 60px; }
            .signature { margin-top: 40px; display: inline-block; text-align: center; }
            .signature .name { border-top: 1px solid #000; padding-top: 5px; font-weight: bold; margin-top: 10px; }
            .footer-info { margin-top: 40px; border-top: 1px dashed #94a3b8; padding-top: 15px; font-size: 12px; color: #475569; text-align: left; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Dr. Terrace Waterproofing</h1>
            <h2>Warranty Certificate</h2>
          </div>
          <div class="meta">
            <div>Date : ${currentDate}</div>
            <div>Warranty Reference No : ${refNo}</div>
          </div>
          <div class="content">
            <p>This is to certify that we have done a <span class="bold underline">${serviceType}</span> in the below mentioned building if require in future in order to claim the warranty please submit this along with your building leaking pictures.</p>
            
            <p><span class="bold">Warranty For:</span> <span class="underline">${clientName} ,</span> ${address}.</p>
            
            <p><span class="bold">Work Completed:</span> ${serviceType} Completed on <span class="bold underline">${completedDate}</span></p>
            
            ${warrantyItemsHtml}
            
            <p><span class="bold">Warranty Including:</span> We will give free service to fix the leak which including Labour wages, Transportation, Consultation, Site Engineer allowance and salary.</p>
            
            <p><span class="bold">Warranty Exclusion for:</span> Customer who has due, Leakages through untreated places, Plumbing, electrical pipes related problems, physically damaged area and for the work which was done as a complementary.</p>
            
            <p>Kindly mail to service team our service team would give free visit/ service within 30 working days from the date of mail received from the client, required material has to be supplied by the client as a applicator the service which we give would be absolutely with free of cost.</p>
            
            <p>Requested you to raise a complaint only through mail with photos with scanned copy of bills and warranty letter in future for fast action on the same. Kindly don't give oral complaint to our Supervisor and Sales Managers; Service Team is responsible only for mail complaint which they directly received from client to admin@drterrace.com this will have records for both the ends.</p>
            
            <p>Rs 500/Day Per visit would be charged for analysing the site against complaint</p>
          </div>
          
          <div class="note">
            Note: We have done open Terrace Waterproofing, warranty not applicable when there is any floor mat or flower pot on the Coating.<br/><br/>
            We don't provide duplicate copies, so kindly ensure you keep this invoice safe and secure.
          </div>
          
          <div class="footer">
            <div class="signature">
              <div style="font-family: cursive; font-size: 24px; color: #475569; font-style: italic;">Dr. Terrace</div>
              <div class="name">Dr.Terrace Waterproofing</div>
            </div>
            
            <div class="footer-info">
              <span class="bold" style="color:#0f172a;">Dr.Terrace Waterproofing</span><br/>
              Parsn commercial complex, #C13, B13, 2nd floor, Kodambakkam High Road, Nungambakkam, Chennai-600006, admin@drterrace.com
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      console.error("Error generating PDF", error);
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
        <View style={[styles.certificatePage, isDark && styles.certificatePageDark]}>

          {/* Top Row: Date & Ref */}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}><Text style={styles.boldText}>Date :</Text> {currentDate}</Text>
            <Text style={styles.metaText}><Text style={styles.boldText}>Warranty Reference No :</Text> {refNo}</Text>
          </View>

          <Text style={styles.paragraphText}>
            This is to certify that we have done a <Text style={styles.boldUnderlineText}>{serviceType}</Text> in the below mentioned building if require in future in order to claim the warranty please submit this along with your building leaking pictures.
          </Text>

          <Text style={styles.paragraphText}>
            <Text style={styles.boldText}>Warranty For:</Text> <Text style={styles.underlineText}>{clientName} ,</Text> {address}.
          </Text>

          <Text style={styles.paragraphText}>
            <Text style={styles.boldText}>Work Completed:</Text> {serviceType} Completed on <Text style={styles.boldUnderlineText}>{completedDate}</Text>
          </Text>

          {serviceWarranties.length > 0 ? (
            serviceWarranties.map((sw, idx) => (
              <Text key={idx} style={styles.paragraphText}>
                <Text style={styles.boldText}>Warranty Valid:</Text> <Text style={styles.boldUnderlineText}>{sw.duration}</Text> for <Text style={styles.boldUnderlineText}>{sw.serviceName}</Text> from the Date of Work Completion.
              </Text>
            ))
          ) : (
            <Text style={styles.paragraphText}>
              <Text style={styles.boldText}>Warranty Valid:</Text> <Text style={styles.boldUnderlineText}>{validYears}</Text> for <Text style={styles.boldUnderlineText}>{serviceType}</Text> from the Date of Work Completion.
            </Text>
          )}

          <Text style={styles.paragraphText}>
            <Text style={styles.boldText}>Warranty Including:</Text> We will give free service to fix the leak which including Labour wages, Transportation, Consultation, Site Engineer allowance and salary.
          </Text>

          <Text style={styles.paragraphText}>
            <Text style={styles.boldText}>Warranty Exclusion for:</Text> Customer who has due, Leakages through untreated places, Plumbing, electrical pipes related problems, physically damaged area and for the work which was done as a complementary.
          </Text>

          <Text style={styles.paragraphText}>
            Kindly mail to service team our service team would give free visit/ service within 30 working days from the date of mail received from the client, required material has to be supplied by the client as a applicator the service which we give would be absolutely with free of cost.
          </Text>

          <Text style={styles.paragraphText}>
            Requested you to raise a complaint only through mail with photos with scanned copy of bills and warranty letter in future for fast action on the same. Kindly don&apos;t give oral complaint to our Supervisor and Sales Managers; Service Team is responsible only for mail complaint which they directly received from client to admin@drterrace.com this will have records for both the ends.
          </Text>

          <Text style={styles.paragraphText}>
            Rs 500/Day Per visit would be charged for analysing the site against complaint
          </Text>

          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              <Text style={styles.boldText}>Note: </Text>
              We have done open Terrace Waterproofing, warranty not applicable when there is any floor mat or flower pot on the Coating.
            </Text>
            <Text style={[styles.noteText, { marginTop: 12 }]}>
              We don&apos;t provide duplicate copies, so kindly ensure you keep this invoice safe and secure.
            </Text>
          </View>

          {/* Signature Area */}
          <View style={styles.signatureSection}>
            {/* Signature Placeholder - using text as mockup */}
            <Text style={styles.signatureScript}>Dr.Terrace</Text>
            <Text style={styles.signatureLabel}>Dr.Terrace Waterproofing</Text>
          </View>

          <View style={styles.dashedDivider} />

          {/* Footer */}
          <View style={styles.footerInfo}>
            <Text style={styles.footerBold}>Dr.Terrace Waterproofing</Text>
            <Text style={styles.footerText}>
              Parsn commercial complex, #C13, B13, 2nd floor, Kodambakkam High Road, Nungambakkam, Chennai-600006, admin@drterrace.com
            </Text>
          </View>

        </View>
      </ScrollView>
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

  scrollContent: {
    padding: 16,
  },
  certificatePage: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 24,
  },
  certificatePageDark: {
    backgroundColor: '#1E293B',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  metaText: {
    fontSize: 12,
    color: '#0F172A',
  },
  paragraphText: {
    fontSize: 12,
    color: '#1E293B',
    lineHeight: 18,
    marginBottom: 16,
    textAlign: 'justify',
  },
  boldText: {
    fontWeight: '800',
    color: '#0F172A',
  },
  underlineText: {
    textDecorationLine: 'underline',
  },
  boldUnderlineText: {
    fontWeight: '800',
    textDecorationLine: 'underline',
    color: '#0F172A',
  },
  noteBox: {
    marginVertical: 12,
  },
  noteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 16,
  },
  signatureSection: {
    marginTop: 24,
    alignItems: 'flex-start',
  },
  signatureScript: {
    fontFamily: 'Cursive', // Note: Cursive may not render on all devices exactly as desired, but serves as placeholder
    fontSize: 24,
    color: '#475569',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  signatureLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  dashedDivider: {
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderStyle: 'dashed',
    marginVertical: 24,
  },
  footerInfo: {
    marginTop: 8,
  },
  footerBold: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  footerText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
});
