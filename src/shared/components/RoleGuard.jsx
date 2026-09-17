import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authRepository, isAdminRole } from '../../features/auth/api/authRepository';

/**
 * AdminOnlyGuard
 * Wraps screens that should only be accessible to Admins.
 * Field Employees see a branded "Access Restricted" screen.
 */
export function AdminOnlyGuard({ children }) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    authRepository.getUser().then((user) => {
      setIsAdmin(user?.isAdmin === true || isAdminRole(user?.role));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0052CC" />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Ionicons name="shield-outline" size={64} color="#EF4444" style={{ marginBottom: 16 }} />
        <Text style={styles.title}>Access Restricted</Text>
        <Text style={styles.subtitle}>
          This screen is only available to system administrators.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.buttonText}>Go Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#0052CC',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
