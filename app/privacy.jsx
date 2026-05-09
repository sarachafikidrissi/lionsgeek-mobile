import { ScrollView, View } from 'react-native';
import AppLayout from '@/components/layout/AppLayout';
import { LegalBullet, LegalH2, LegalMeta, LegalP } from '@/components/legal/LegalTypography';

export default function PrivacyScreen() {
  return (
    <AppLayout showNavbar={false} className="flex-1 bg-light dark:bg-dark">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-12 pt-2"
        showsVerticalScrollIndicator={false}
      >
        <LegalMeta>Last updated: May 9, 2026 · LionsGeek Mobile</LegalMeta>

        <LegalH2>1. Introduction</LegalH2>
        <LegalP>
          LionsGeek (“we”, “us”) respects your privacy. This Privacy Policy explains how we collect, use, store,
          and share personal information when you use our mobile application and related services. By using the
          App, you acknowledge this Policy.
        </LegalP>

        <LegalH2>2. Information we collect</LegalH2>
        <LegalP>We may collect:</LegalP>
        <LegalBullet>
          Account data: name, email, username, profile photo, cohort or promotion, and roles.
        </LegalBullet>
        <LegalBullet>
          Usage data: app interactions, device type, OS version, crash logs, and approximate diagnostics to improve
          stability.
        </LegalBullet>
        <LegalBullet>
          Training & attendance: check-ins, reservations, session participation where applicable.
        </LegalBullet>
        <LegalBullet>
          Communications: messages sent through in-app features and support requests.
        </LegalBullet>
        <LegalBullet>
          Notifications: preferences and tokens needed to deliver push notifications where enabled.
        </LegalBullet>
        <View className="h-2" />

        <LegalH2>3. How we use information</LegalH2>
        <LegalP>We use personal data to:</LegalP>
        <LegalBullet>Provide, secure, and improve the App and Services.</LegalBullet>
        <LegalBullet>Authenticate you and personalize your experience.</LegalBullet>
        <LegalBullet>Send operational notices, announcements, and (where allowed) marketing.</LegalBullet>
        <LegalBullet>Comply with legal obligations and enforce our Terms.</LegalBullet>
        <View className="h-2" />

        <LegalH2>4. Legal bases (where applicable)</LegalH2>
        <LegalP>
          Depending on your region, we rely on contract performance, legitimate interests (e.g. security and
          product improvement), consent (e.g. optional notifications), and legal obligation as appropriate.
        </LegalP>

        <LegalH2>5. Sharing & processors</LegalH2>
        <LegalP>
          We may share data with service providers who assist us (hosting, analytics, messaging, push delivery)
          under strict agreements. We may disclose information if required by law or to protect rights and safety.
          We do not sell your personal information as traditionally defined in applicable privacy laws.
        </LegalP>

        <LegalH2>6. Retention</LegalH2>
        <LegalP>
          We retain information as long as your account is active or as needed to provide the Services, comply with
          law, resolve disputes, and enforce agreements. Some logs may be kept in aggregated or anonymized form.
        </LegalP>

        <LegalH2>7. Security</LegalH2>
        <LegalP>
          We implement technical and organizational measures designed to protect your data. No method of
          transmission over the internet is 100% secure; use strong passwords and protect your device.
        </LegalP>

        <LegalH2>8. Your rights</LegalH2>
        <LegalP>
          Depending on your location, you may have rights to access, rectify, delete, restrict, or object to certain
          processing, and to data portability. You may withdraw consent where processing is consent-based. Contact
          us to exercise rights; you may also lodge a complaint with your local data protection authority.
        </LegalP>

        <LegalH2>9. Children</LegalH2>
        <LegalP>
          The Services are not directed at children under the age where parental consent is required for data
          processing in your region. If you believe we have collected such data, contact us and we will take
          appropriate steps.
        </LegalP>

        <LegalH2>10. International transfers</LegalH2>
        <LegalP>
          If we transfer data across borders, we use appropriate safeguards such as standard contractual clauses
          or other mechanisms permitted by law.
        </LegalP>

        <LegalH2>11. Changes</LegalH2>
        <LegalP>
          We may update this Policy. We will post the new version in the App and adjust the “Last updated” date.
          Material changes may be communicated via the App or email where appropriate.
        </LegalP>

        <LegalH2>12. Contact</LegalH2>
        <LegalP>
          For privacy requests or questions, use the Support section in the App or the official contact details on
          lionsgeek.com.
        </LegalP>
      </ScrollView>
    </AppLayout>
  );
}
