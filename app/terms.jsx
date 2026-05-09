import { ScrollView, View } from 'react-native';
import AppLayout from '@/components/layout/AppLayout';
import { LegalBullet, LegalH2, LegalMeta, LegalP } from '@/components/legal/LegalTypography';

export default function TermsScreen() {
  return (
    <AppLayout showNavbar={false} className="flex-1 bg-light dark:bg-dark">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-12 pt-2"
        showsVerticalScrollIndicator={false}
      >
        <LegalMeta>Last updated: May 9, 2026 · LionsGeek Mobile</LegalMeta>

        <LegalH2>1. Acceptance of terms</LegalH2>
        <LegalP>
          By downloading, accessing, or using the LionsGeek mobile application (“App”) and related services
          (“Services”), you agree to be bound by these Terms & Conditions (“Terms”). If you do not agree,
          do not use the App. We may update these Terms from time to time; continued use after changes means you
          accept the revised Terms.
        </LegalP>

        <LegalH2>2. Description of the service</LegalH2>
        <LegalP>
          LionsGeek provides tools for learning, training attendance, reservations, community features,
          notifications, and profile management as made available in the App. Features may vary by cohort,
          region, or account type. We may modify, suspend, or discontinue any part of the Services with
          reasonable notice where practicable.
        </LegalP>

        <LegalH2>3. Accounts & eligibility</LegalH2>
        <LegalP>
          You must provide accurate registration information and keep your credentials confidential. You are
          responsible for all activity under your account. Notify us immediately if you suspect unauthorized
          access. We may suspend or terminate accounts that violate these Terms or pose a risk to the community.
        </LegalP>

        <LegalH2>4. Acceptable use</LegalH2>
        <LegalP>You agree not to:</LegalP>
        <LegalBullet>Misuse the App to harass, abuse, or harm others.</LegalBullet>
        <LegalBullet>Attempt to gain unauthorized access to systems, data, or other users’ accounts.</LegalBullet>
        <LegalBullet>Upload malware, scrape content at scale without permission, or interfere with the Services.</LegalBullet>
        <LegalBullet>Use the Services for unlawful purposes or in violation of applicable laws.</LegalBullet>
        <View className="h-2" />

        <LegalH2>5. Content & intellectual property</LegalH2>
        <LegalP>
          The App, branding, and materials we provide are owned by LionsGeek or its licensors. You retain rights
          to content you submit, but you grant us a limited license to host, display, and process it as needed
          to operate the Services. Respect copyrights and third-party rights when sharing materials.
        </LegalP>

        <LegalH2>6. Third-party services</LegalH2>
        <LegalP>
          The App may integrate third-party services (e.g. analytics, maps, messaging). Those services have
          their own terms and privacy policies; we are not responsible for their practices beyond what we
          reasonably control.
        </LegalP>

        <LegalH2>7. Disclaimers</LegalH2>
        <LegalP>
          The Services are provided “as is” and “as available.” To the fullest extent permitted by law, we
          disclaim warranties of merchantability, fitness for a particular purpose, and non-infringement. We do
          not guarantee uninterrupted or error-free operation.
        </LegalP>

        <LegalH2>8. Limitation of liability</LegalH2>
        <LegalP>
          To the maximum extent permitted by law, LionsGeek and its affiliates shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages, or any loss of profits or data,
          arising from your use of the App. Our total liability for any claim relating to the Services shall not
          exceed the greater of (a) the amounts you paid us for the Services in the twelve months before the
          claim or (b) fifty euros (€50), if no fees apply.
        </LegalP>

        <LegalH2>9. Termination</LegalH2>
        <LegalP>
          You may stop using the App at any time. We may suspend or terminate access if you breach these Terms or
          if required for legal or security reasons. Provisions that by their nature should survive will survive
          termination.
        </LegalP>

        <LegalH2>10. Governing law</LegalH2>
        <LegalP>
          These Terms are governed by the laws applicable in your primary jurisdiction of residence or the
          jurisdiction where LionsGeek operates its contracting entity, without regard to conflict-of-law rules,
          unless mandatory consumer protections in your country require otherwise.
        </LegalP>

        <LegalH2>11. Contact</LegalH2>
        <LegalP>
          For questions about these Terms, contact LionsGeek through the Support section in the App or via the
          official contact channels published on lionsgeek.com.
        </LegalP>
      </ScrollView>
    </AppLayout>
  );
}
