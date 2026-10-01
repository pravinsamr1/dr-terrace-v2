# React Native / Expo PDF → WhatsApp Preview Fix

## Task

Fix the PDF sharing flow in my React Native Expo app.

I have a **Proforma Invoice** screen. The invoice HTML renders correctly in a `WebView`, and `expo-print` successfully generates the PDF. However, sharing the generated PDF to WhatsApp fails in the current Expo Go environment because the PDF URI returned by `expo-print` is not readable by `expo-file-system` / `expo-sharing`.

I need you to modify the screen so that:

1. The PDF is generated successfully.
2. The generated PDF can be shared to WhatsApp on Android.
3. The PDF is sent as a real `application/pdf` document.
4. Avoid the inaccessible Expo Go `Print/...pdf` file URI problem.
5. Do not generate the PDF twice.
6. Do not break the existing invoice preview, loading, navigation, or UI.
7. Use the safest/recommended approach for the actual Expo SDK/version in this project.
8. If a native module is required, clearly identify it and make the implementation compatible with an Expo development build rather than assuming Expo Go supports it.
9. Do not use a fake or guessed URI.
10. WhatsApp should receive the PDF as a document and, where WhatsApp/Android supports it, display the PDF thumbnail/preview.

---

## Current environment / important observation

The logs show:

```text
Starting PDF generation...

Generated PDF:
file:///data/user/0/host.exp.exponent/cache/Print/4b392757-55d0-4b01-a37d-90aa93a24454.pdf

Copying PDF to:
file:///data/user/0/host.exp.exponent/cache/ExperienceData/%2540pravinsamr1%252Ffrontend/Mr_Zhjsj_Proforma_PI-1380.pdf

ERROR:
Call to function 'ExponentFileSystem.copyAsync' has been rejected.

Caused by:
java.io.IOException:
Location 'file:///data/user/0/host.exp.exponent/cache/Print/4b392757-55d0-4b01-a37d-90aa93a24454.pdf' isn't readable.
```

An earlier attempt also produced:

```text
ERROR:
Call to function 'ExpoSharing.shareAsync' has been rejected.

Caused by:
Not allowed to read file under given URL.
```

The path contains:

```text
/data/user/0/host.exp.exponent/
```

which indicates the app is currently being run in Expo Go.

The important conclusion is:

- `expo-print` IS generating the PDF.
- The failure happens when JavaScript tries to read/copy/share the returned `file://.../cache/Print/...pdf`.
- Therefore, simply changing the destination filename does not solve the root problem.
- Do not continue trying to `copyAsync()` from the inaccessible `Print` URI.

---

## Current problematic implementation

The current screen imports:

```js
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
```

The current PDF generation/sharing flow is approximately:

```js
const getPdfUri = async () => {
  if (!invoice?.html) {
    throw new Error('Invoice HTML is not available.');
  }

  console.log('Starting PDF generation...');

  const result = await Print.printToFileAsync({
    html: invoice.html,
    base64: false,
  });

  if (!result?.uri) {
    throw new Error('PDF was generated but no file URI was returned.');
  }

  console.log('PDF generated successfully:', result.uri);

  return result.uri;
};
```

Then:

```js
const result = await Print.printToFileAsync({
  html: invoice.html,
  base64: false,
});

const fileName =
  `${invoice.clientName || 'Customer'}_Proforma_${invoice.invoiceNo}.pdf`
    .replace(/[^a-zA-Z0-9._-]/g, '_');

const shareUri =
  `${FileSystem.cacheDirectory}${fileName}`;

await FileSystem.copyAsync({
  from: result.uri,
  to: shareUri,
});

await Sharing.shareAsync(shareUri, {
  mimeType: 'application/pdf',
  dialogTitle: `Share Proforma Invoice - ${invoice.invoiceNo}`,
  UTI: 'com.adobe.pdf',
});
```

This fails at `copyAsync()` because the `Print/...pdf` source is not readable.

---

## Previous attempted approach

We considered using:

```js
const result = await Print.printToFileAsync({
  html: invoice.html,
  base64: true,
});
```

and then sharing the Base64 PDF directly through `react-native-share`.

However, **do not blindly assume this is the correct solution**.

First inspect the project's actual Expo SDK and package versions and verify which APIs are supported.

If `react-native-share` is the appropriate solution, use it correctly and explain the required native/development build setup.

If there is a better Expo-native solution for the project's SDK, use that instead.

---

## Existing screen behavior that MUST remain

The screen:

- Loads quotation data from:

```js
quotationRepository.getQuotationPdfView(quoteId)
```

- Validates:

```js
quotation.isTaxCustomer === true
```

- Generates invoice HTML using:

```js
generateTaxInvoiceHTML(
  null,
  quotation.customerGstNumber || '',
  buildProformaReceiptData(quotation),
  {
    isFullServiceReceipt: 'true',
    docTitle: PROFORMA_DOC_TITLE,
  },
  null
);
```

- Stores:

```js
{
  html,
  invoiceNo: getProformaInvoiceNumber(quotation),
  clientName: String(
    quotation.customer?.name || 'Customer'
  ).trim(),
}
```

- Displays the invoice in a React Native `WebView`.

- Has two buttons:
  - `Send via WhatsApp`
  - `Share PDF`

Both currently call the same `handleSharePDF()` function.

- Uses `isSharing` to prevent multiple simultaneous share operations.

- Uses Expo Router navigation and a hardware back handler.

Do not remove or rewrite these unrelated parts unless necessary.

---

## Existing preview helper

The invoice preview currently uses:

```js
const toPreviewHtml = (html) =>
  html
    .replace(
      /<meta\s+name="viewport"[\s\S]*?\/>/,
      '<meta name="viewport" content="width=794, minimum-scale=0.3, maximum-scale=4, user-scalable=yes" />'
    )
    .replace(
      '</head>',
      '<style>html, body { background: #E2E8F0; } .invoice-page { margin: 0 auto 12px; }</style></head>'
    );
```

Do not change the invoice HTML itself unless you identify a specific reason that it is preventing PDF thumbnail generation.

---

## Current relevant imports

The screen currently has imports similar to:

```js
import { Ionicons } from '@expo/vector-icons';
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
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { useTabBar } from '../../../core/context/TabBarContext';
import { useColorScheme } from '../../../core/hooks/useColorScheme';

import InnerHeader from '../../../shared/components/InnerHeader';
import { MaterialPageLoader } from '../../../shared/components/material';

import { quotationRepository } from '../../quotations/api/quotationRepository';

import {
  PROFORMA_DOC_TITLE,
  buildProformaReceiptData,
  getProformaInvoiceNumber,
} from '../utils/proformaInvoice';

import { generateTaxInvoiceHTML } from './ReceiptScreen';

import * as FileSystem from 'expo-file-system/legacy';
```

Remove imports that are no longer required after the fix.

---

## Important requirements for the implementation

### 1. Generate the PDF only once

There must be one PDF-generation path.

Avoid having both:

```js
getPdfUri()
```

and another independent:

```js
Print.printToFileAsync(...)
```

inside `handleSharePDF()`.

Use a single helper such as:

```js
generateInvoicePdf()
```

or equivalent.

### 2. Do not rely on the inaccessible Print cache URI

Do not do:

```js
FileSystem.copyAsync({
  from: result.uri,
  to: ...
});
```

when `result.uri` is:

```text
file:///data/user/0/host.exp.exponent/cache/Print/...
```

because this is exactly what is failing.

### 3. Handle Android correctly

The target is Android + WhatsApp.

The sharing implementation must correctly provide:

```text
MIME type: application/pdf
```

and a proper filename ending in:

```text
.pdf
```

### 4. iOS compatibility

If the solution also supports iOS, keep the PDF MIME/type metadata correct.

For iOS, `UTI: 'com.adobe.pdf'` may be appropriate where supported.

Do not claim UTI fixes Android URI permissions; it does not.

### 5. Expo Go vs development build

Be explicit about whether the final solution works in:

- Expo Go
- Expo development build
- Production APK/AAB

If the required native sharing library cannot work in Expo Go, say so clearly and provide the exact setup commands for the development build.

### 6. Do not promise that WhatsApp always creates a thumbnail

The implementation should correctly share a valid PDF document.

A WhatsApp thumbnail is ultimately generated by WhatsApp/Android and can vary by WhatsApp version/device.

Do not modify the PDF merely to "force" a thumbnail unless there is actual evidence that the PDF structure is invalid.

---

## Desired final response from you

Please provide:

### A. The corrected complete screen file

Return the complete replacement `.jsx`/`.tsx` file, not just snippets.

It must preserve all existing UI and invoice loading behavior while fixing the PDF sharing path.

### B. Required package changes

Tell me exactly what I need to run, for example:

```bash
npx expo install ...
```

or:

```bash
npm install ...
```

Do not invent package versions. Use versions compatible with the project's Expo SDK/package.json.

### C. Build requirements

Explain whether I must use:

```bash
npx expo start
```

with Expo Go,

or:

```bash
npx expo run:android
```

or an EAS development build.

Give the exact commands needed.

### D. Explain the root cause briefly

The explanation should make clear why:

```text
Print/...pdf
```

is generated successfully but cannot be read by the JavaScript/FileSystem/share layer in the current environment.

### E. Add useful logging

Keep logs such as:

```text
Starting PDF generation...
PDF generated successfully...
PDF ready for sharing...
```

but don't log the entire Base64 string.

### F. Avoid unnecessary changes

Do not rewrite unrelated invoice rendering or business logic.

---

## Current expected result

When the user taps:

```text
Send via WhatsApp
```

the app should:

```text
Load invoice
   ↓
Generate PDF exactly once
   ↓
Create a valid PDF payload/file
   ↓
Open Android sharing
   ↓
Select WhatsApp
   ↓
WhatsApp receives:
   invoice.pdf
   MIME: application/pdf
```

The PDF should open normally in WhatsApp.

Where supported by WhatsApp/Android, WhatsApp should display the PDF document preview/thumbnail.

---

## Important debugging rule

If the proposed solution still fails, do not randomly change filenames, delays, MIME types, or `UTI`.

Instead identify exactly which boundary is failing:

1. PDF generation
2. PDF data/file creation
3. Android content URI / FileProvider
4. Share intent
5. WhatsApp handling
6. WhatsApp thumbnail generation

Then fix that specific boundary.

---

## Source code context

The original uploaded screen is the source of truth for the existing UI/business logic. Preserve its structure and imports where possible.

The critical current error is:

```text
java.io.IOException:
Location 'file:///data/user/0/host.exp.exponent/cache/Print/....pdf' isn't readable.
```

The user wants this fixed, not merely explained.
