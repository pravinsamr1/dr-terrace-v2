import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '../../../core/hooks/useColorScheme';
import InnerHeader from '../../../shared/components/InnerHeader';
import { MaterialCardSkeleton } from '../../../shared/components/material';
import { termsRepository } from '../api/termsRepository';

const decodeHtmlEntities = (text) => {
  if (!text) return '';
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"');
};

const parseHtmlBlocks = (html) => {
  if (!html) return [];
  const cleaned = String(html).replace(/<br\s*\/?>/gi, '\n');
  const blockRegex = /<(p|li|div|h[1-6])\b[^>]*>(.*?)<\/\1>/gis;
  const blocks = [];
  let match;

  while ((match = blockRegex.exec(cleaned)) !== null) {
    const rawContent = match[2];
    const stripped = decodeHtmlEntities(rawContent.replace(/<[^>]+>/g, '').trim());
    if (stripped) {
      blocks.push(stripped);
    }
  }

  if (blocks.length === 0) {
    const stripped = decodeHtmlEntities(cleaned.replace(/<[^>]+>/g, '').trim());
    if (stripped) {
      const lines = stripped.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      return lines.length > 0 ? lines : [stripped];
    }
    return [];
  }

  return blocks;
};

function FormattedReadingContent({ rawContent, isDark }) {
  const blocks = parseHtmlBlocks(rawContent);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <View style={styles.readingContainer}>
      {blocks.map((block, idx) => {
        // Match numbered item "1. " or "1) "
        const numMatch = block.match(/^(\d+)[\.\)]\s*(.*)$/s);
        if (numMatch) {
          const num = numMatch[1];
          const text = numMatch[2];
          return (
            <View key={idx} style={styles.listItemRow}>
              <View style={[styles.itemNumberCircle, isDark && styles.itemNumberCircleDark]}>
                <Text style={styles.itemNumberText}>{num}</Text>
              </View>
              <Text style={[styles.listItemText, isDark && styles.textDark]}>
                {text}
              </Text>
            </View>
          );
        }

        // Match bullet item "• ", "- ", "* "
        const bulletMatch = block.match(/^[•\-\*]\s*(.*)$/s);
        if (bulletMatch) {
          const text = bulletMatch[1];
          return (
            <View key={idx} style={styles.listItemRow}>
              <View style={styles.bulletDotBox}>
                <Text style={[styles.bulletDot, isDark && styles.bulletDotDark]}>•</Text>
              </View>
              <Text style={[styles.listItemText, isDark && styles.textDark]}>
                {text}
              </Text>
            </View>
          );
        }

        // Regular clean paragraph
        return (
          <Text
            key={idx}
            style={[
              styles.paragraphText,
              isDark && styles.textDark,
              idx > 0 && { marginTop: 10 },
            ]}
          >
            {block}
          </Text>
        );
      })}
    </View>
  );
}

export default function TermsConditionsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [terms, setTerms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTerms = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const res = await termsRepository.getTerms();
      if (res && res.success && Array.isArray(res.data)) {
        setTerms(res.data);
      } else {
        setTerms([]);
      }
    } catch (err) {
      console.warn('Failed to load terms & conditions:', err.message);
      setTerms([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTerms(false);
  }, [fetchTerms]);

  const onRefresh = () => {
    fetchTerms(true);
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header bar */}
      <InnerHeader title="Terms & Conditions" paddingTop={insets.top} isDark={isDark} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? '#FFFFFF' : '#2563EB'}
          />
        }
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: Math.max(insets.bottom + 24, 48) },
        ]}
      >
        {isLoading && !refreshing ? (
          <View style={{ paddingTop: 12 }}>
            <MaterialCardSkeleton count={4} />
          </View>
        ) : terms.length === 0 ? (
          <View style={[styles.emptyContainer, isDark && styles.emptyContainerDark]}>
            <Ionicons
              name="document-text-outline"
              size={52}
              color={isDark ? '#475569' : '#94A3B8'}
              style={{ marginBottom: 12 }}
            />
            <Text style={[styles.emptyTitle, isDark && styles.textDark]}>
              No Terms Configured
            </Text>
            <Text style={[styles.emptySubtitle, isDark && styles.subtextDark]}>
              Terms and conditions will appear here once published from the admin panel.
            </Text>
          </View>
        ) : (
          <View style={styles.termsList}>
            {terms.map((item, index) => {
              const sequenceNum = item.sequence || index + 1;
              return (
                <View
                  key={String(item.id || index)}
                  style={styles.termCard}
                >
                  <View style={[styles.cardHeaderRow, isDark && styles.cardHeaderRowDark]}>
                    <View style={[styles.sequenceBadge, isDark && styles.sequenceBadgeDark]}>
                      <Text style={styles.sequenceBadgeText}>{sequenceNum}</Text>
                    </View>
                    <Text style={[styles.termTitle, isDark && styles.textDark]}>
                      {item.title || 'Terms & Conditions'}
                    </Text>
                  </View>

                  <FormattedReadingContent
                    rawContent={item.description}
                    isDark={isDark}
                  />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#090D16',
  },

  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  termsList: {
    gap: 20,
  },

  termCard: {
    paddingBottom: 8,
  },

  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardHeaderRowDark: {
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  sequenceBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sequenceBadgeDark: {
    backgroundColor: '#3B82F6',
  },
  sequenceBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  termTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },

  readingContainer: {
    gap: 14,
  },

  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemNumberCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  itemNumberCircleDark: {
    backgroundColor: '#1E293B',
  },
  itemNumberText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563EB',
  },
  listItemText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
    color: '#1E293B',
    fontWeight: '400',
  },

  bulletDotBox: {
    width: 20,
    alignItems: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  bulletDot: {
    fontSize: 18,
    color: '#2563EB',
    fontWeight: '800',
  },
  bulletDotDark: {
    color: '#60A5FA',
  },

  paragraphText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#1E293B',
  },

  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyContainerDark: {},
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
  },

  textDark: {
    color: '#F8FAFC',
  },
  subtextDark: {
    color: '#94A3B8',
  },
});
