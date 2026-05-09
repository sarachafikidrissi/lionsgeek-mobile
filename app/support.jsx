import { ScrollView, Text, TouchableOpacity, Linking, View } from 'react-native';
import AppLayout from '@/components/layout/AppLayout';
import { Ionicons } from '@expo/vector-icons';
import { LegalH2, LegalMeta, LegalP } from '@/components/legal/LegalTypography';
import { Colors } from '@/constants/Colors';

const SUPPORT_EMAIL = 'support@lionsgeek.com';

export default function SupportScreen() {
  const openMail = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=LionsGeek%20Mobile%20support`).catch(() => {});
  };

  return (
    <AppLayout showNavbar={false} className="flex-1 bg-light dark:bg-dark">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-12 pt-2"
        showsVerticalScrollIndicator={false}
      >
        <LegalMeta>We typically reply within 1–2 business days.</LegalMeta>

        <LegalH2>Get help</LegalH2>
        <LegalP>
          Use this screen for guidance on common topics. If your issue isn’t listed, email us or reach out through
          your coach or admin channel when available.
        </LegalP>

        <LegalH2>Frequently asked questions</LegalH2>
        <LegalP>
          <Text className="font-semibold text-beta dark:text-white">I can’t log in.</Text>
          {'\n'}
          Check your email and password, reset via “Forgot password”, and ensure your cohort account is active. If
          problems persist, contact support with your registered email.
        </LegalP>
        <LegalP>
          <Text className="font-semibold text-beta dark:text-white">Push notifications don’t work.</Text>
          {'\n'}
          Enable notifications for LionsGeek in system settings. Note: push behavior may differ in Expo Go or
          simulator builds.
        </LegalP>
        <LegalP>
          <Text className="font-semibold text-beta dark:text-white">Training or QR check-in fails.</Text>
          {'\n'}
          Confirm session times, location permissions for camera if scanning QR codes, and stable connectivity.
          Contact staff if attendance still doesn’t register.
        </LegalP>
        <LegalP>
          <Text className="font-semibold text-beta dark:text-white">Wrong profile or missing data.</Text>
          {'\n'}
          Pull to refresh on profile and More. If data looks incorrect after a refresh, email support with a short
          description and screenshots if possible.
        </LegalP>

        <LegalH2>Contact</LegalH2>
        <TouchableOpacity
          onPress={openMail}
          activeOpacity={0.75}
          className="mb-4 flex-row items-center rounded-2xl border border-black/10 bg-white px-4 py-4 dark:border-white/10 dark:bg-dark_gray"
        >
          <View className="mr-3 h-11 w-11 items-center justify-center rounded-xl bg-alpha/15">
            <Ionicons name="mail-outline" size={22} color={Colors.alpha} />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-white/50">
              Email support
            </Text>
            <Text className="mt-0.5 text-base font-semibold text-beta dark:text-white">{SUPPORT_EMAIL}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.alpha} />
        </TouchableOpacity>

        <LegalP>
          For legal requests related to privacy, see the Privacy Policy from the More screen. For contractual or
          billing matters, refer to your program administrator.
        </LegalP>
      </ScrollView>
    </AppLayout>
  );
}
