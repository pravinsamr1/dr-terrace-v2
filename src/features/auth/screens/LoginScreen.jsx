import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authRepository } from '../api/authRepository';
import { MaterialAlertModal, MaterialOverlayLoader } from '../../../shared/components/material';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollViewRef = useRef(null);
  const [alertModal, setAlertModal] = useState({
    visible: false,
    type: 'error',
    title: '',
    message: '',
  });

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 80);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleInputFocus = () => {
    setKeyboardVisible(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const validateForm = () => {
    const newErrors = {};
    const trimmedMobile = mobileNumber.trim();
    const trimmedPass = password.trim();

    if (!trimmedMobile) {
      newErrors.mobileNumber = 'Mobile number or username is required';
    }
    if (!trimmedPass) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm() || isLoading) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await authRepository.login(mobileNumber.trim(), password);
      if (result.success) {
        router.replace('/(tabs)');
      } else {
        const rawMsg = result.message || '';
        const isTechnical =
          rawMsg.includes('/api/') ||
          rawMsg.includes('POST ') ||
          rawMsg.includes('GET ') ||
          rawMsg.includes('Route ') ||
          rawMsg.includes('status code');

        const cleanMsg = isTechnical
          ? 'Unable to connect to the server. Please check the network or try again later.'
          : rawMsg || 'Invalid credentials. Please try again.';

        setAlertModal({
          visible: true,
          type: 'error',
          title: 'Login Failed',
          message: cleanMsg,
        });
      }
    } catch (_err) {
      setAlertModal({
        visible: true,
        type: 'error',
        title: 'Connection Error',
        message: 'Unable to connect to the server. Please check your internet connection and try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../../../../assets/images/login_bg.png')}
      style={styles.container}
      imageStyle={styles.backgroundImage}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={styles.overlay} pointerEvents="none" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContainer}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Top Section - Welcome Header */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View
              style={[
                styles.headerSection,
                { paddingTop: keyboardVisible ? Math.max(insets.top + 16, 32) : Math.max(insets.top + 28, 64) },
              ]}
            >
              <Text style={styles.helloText}>Hello !</Text>
              <Text style={styles.welcomeText}>NEXA Login</Text>
            </View>
          </TouchableWithoutFeedback>

          {/* Bottom Section - Docked Bottom Sheet Card */}
          <View
            style={[
              styles.loginCard,
              { paddingBottom: keyboardVisible ? 24 : Math.max(insets.bottom + 24, 34) },
            ]}
          >
            <Text style={styles.loginTitle}>Login</Text>

            {/* Mobile Number / Username Input */}
            <View style={[styles.inputWrapper, errors.mobileNumber && styles.inputWrapperError]}>
              <Ionicons name="call" size={20} color={errors.mobileNumber ? '#EF4444' : '#555555'} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Admin Mobile or Username"
                placeholderTextColor="#999999"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                value={mobileNumber}
                onFocus={handleInputFocus}
                onChangeText={(val) => {
                  setMobileNumber(val);
                  if (errors.mobileNumber) setErrors((prev) => ({ ...prev, mobileNumber: null }));
                }}
              />
            </View>
            {errors.mobileNumber && <Text style={styles.errorText}>{errors.mobileNumber}</Text>}

            {/* Password Input */}
            <View style={[styles.inputWrapper, errors.password && styles.inputWrapperError]}>
              <Ionicons name="lock-closed" size={20} color={errors.password ? '#EF4444' : '#555555'} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#999999"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                value={password}
                onFocus={handleInputFocus}
                onChangeText={(val) => {
                  setPassword(val);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                }}
              />
              <TouchableOpacity
                style={{ padding: 4 }}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.loginButtonText}>Login</Text>
              )}
            </TouchableOpacity>

            {/* Footer Text */}
            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>
                Having issues logging in?{' '}
                <Text
                  style={styles.forgotPasswordText}
                  onPress={() => {
                    setAlertModal({
                      visible: true,
                      type: 'info',
                      title: 'Forgot Password?',
                      message: 'Please contact your system administrator or IT support to reset your account password.',
                    });
                  }}
                >
                  Forgot password
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <MaterialOverlayLoader
        visible={isLoading}
        title="Signing In..."
        subtitle="Verifying credentials and logging in"
      />

      <MaterialAlertModal
        visible={alertModal.visible}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        onClose={() => setAlertModal((prev) => ({ ...prev, visible: false }))}
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#0F172A',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  keyboardAvoidingView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.20)', // Subtle overlay for optimal contrast and readability
  },
  headerSection: {
    paddingHorizontal: 30,
    paddingBottom: 24,
  },
  helloText: {
    fontSize: 42,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    marginBottom: 6,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  welcomeText: {
    fontSize: 22,
    color: '#FF8A00', // NEXA logo warm amber accent
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  loginCard: {
    backgroundColor: '#EBF4FE', // Ice blue surface matching NEXA theme
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 28,
    paddingTop: 36,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  loginTitle: {
    fontSize: 30,
    color: '#002D72', // Deep navy matching NEXA brand
    alignSelf: 'flex-start',
    marginBottom: 26,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#D8EAFD',
    shadowColor: '#002D72',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#0F172A',
    fontSize: 16,
  },
  inputWrapperError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
    marginBottom: 6,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '500',
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginBottom: 12,
  },
  loginButton: {
    backgroundColor: '#0052CC', // NEXA Royal Blue
    width: '100%',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    shadowColor: '#0052CC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  footerContainer: {
    marginTop: 28,
  },
  footerText: {
    color: '#475569',
    fontSize: 14,
  },
  forgotPasswordText: {
    color: '#0052CC',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});
