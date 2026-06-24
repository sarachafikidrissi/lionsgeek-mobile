import { ScrollView } from 'react-native';
import AppLayout from '@/components/layout/AppLayout';
import { LegalH2, LegalMeta, LegalP } from '@/components/legal/LegalTypography';

export default function LicensesScreen() {
  return (
    <AppLayout showNavbar={false} className="flex-1 bg-light dark:bg-dark">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-12 pt-2"
        showsVerticalScrollIndicator={false}
      >
        <LegalMeta>
          The LionsGeek app bundles open-source software. Below are notices for major dependencies; full license
          texts are available from each project’s repository.
        </LegalMeta>

        <LegalH2>React & React Native</LegalH2>
        <LegalP>
          Copyright Meta Platforms, Inc. and contributors. Licensed under the MIT License.
        </LegalP>

        <LegalH2>Expo</LegalH2>
        <LegalP>
          Copyright © Expo and contributors. Licensed under the MIT License.
        </LegalP>

        <LegalH2>React Navigation</LegalH2>
        <LegalP>
          Copyright © Software Mansion and contributors. Licensed under the MIT License.
        </LegalP>

        <LegalH2>NativeWind / Tailwind CSS</LegalH2>
        <LegalP>
          NativeWind and Tailwind-related tooling are subject to their respective licenses (MIT and compatible open
          licenses). See upstream packages for full text.
        </LegalP>

        <LegalH2>Ionicons / vector icons</LegalH2>
        <LegalP>
          Icons may be subject to the Ionicons or MIT-style licenses as published by their authors.
        </LegalP>

        <LegalH2>Disclaimer</LegalH2>
        <LegalP>
          THE OPEN-SOURCE COMPONENTS ARE PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND. This notice does not
          replace the full license terms shipped with each dependency in node_modules.
        </LegalP>
      </ScrollView>
    </AppLayout>
  );
}
