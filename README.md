# Dr. Terrace

Dr. Terrace is a comprehensive mobile application designed for waterproofing field services and customer management. It streamlines operations for field workers and administrators by providing tools to:
- **Manage Appointments**: Track upcoming, ongoing, and completed site visits.
- **Generate Quotations**: Create multi-tier service quotations (Basic, Medium, High Quality) directly from the field.
- **Process Payments**: Record initial, mid-term, and final payments, generating dynamic receipts on the go.
- **Issue Warranties**: Generate formal PDF warranty letters and share them instantly with clients via WhatsApp.
- **Employee Management**: A dedicated admin panel for adding and managing field employees and policies.

## 🚀 How to Run and Preview the App

### 1. Preview on Your System (Web, iOS Simulator, Android Emulator)

To run the application locally on your computer for development and preview:

**Prerequisites:** Ensure you have [Node.js](https://nodejs.org/) installed on your system.

```bash
# Navigate to the project directory
cd frontend

# Install dependencies
npm install

# Start the Expo development server
npx expo start
```

Once the server is running, you can press the following keys in your terminal to launch the app:
- Press **`w`** to open the app in a web browser.
- Press **`i`** to open the app in an iOS Simulator (requires Xcode installed on macOS).
- Press **`a`** to open the app in an Android Emulator (requires Android Studio).

### 2. Preview on Your Physical Phone

The easiest way to test the app directly on your smartphone is by using the **Expo Go** app.

1. Download the **Expo Go** app from the [Apple App Store](https://apps.apple.com/us/app/expo-go/id982107779) (for iOS) or [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent) (for Android).
2. Start the development server on your computer:
   ```bash
   npx expo start
   ```
3. A large QR code will appear in your terminal.
4. **On iOS**: Open your phone's default Camera app and scan the QR code. Tap the notification to open it in Expo Go.
5. **On Android**: Open the Expo Go app and tap "Scan QR Code" to scan the code from your terminal.

*Note: Your computer and your phone must be connected to the same Wi-Fi network.*

## 📦 Generating APKs for Android

If you want to generate a standalone `.apk` file that you can distribute and install directly on Android devices without needing Expo Go, you can use Expo Application Services (EAS).

1. Install the EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```
2. Log in to your Expo account:
   ```bash
   eas login
   ```
3. Initialize your project with EAS (if not already done):
   ```bash
   eas build:configure
   ```
4. Build the Android APK (it builds in the cloud):
   ```bash
   eas build -p android --profile preview
   ```

*(For this to work, ensure your `eas.json` file has a `preview` profile with `"buildType": "apk"`)*.

Once the build finishes on Expo's servers, it will provide a direct download link to your `.apk` file which you can share via WhatsApp or Email and install on any Android device.
