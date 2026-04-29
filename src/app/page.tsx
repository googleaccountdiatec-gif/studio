"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import CapaDashboard from '@/components/capa-dashboard';
import ChangesDashboard from "@/components/changes-dashboard";
import ChangeActionDashboard from "@/components/change-action-dashboard";
import NonConformanceDashboard from "@/components/non-conformance-dashboard";
import TrainingDashboard from "@/components/training-dashboard";
import BatchReleaseDashboard from "@/components/batch-release-dashboard";
import CompendiumDashboard from "@/components/compendium-dashboard";
import SettingsPage from "@/components/settings-page";
import DocumentsInFlowDashboard from "@/components/documents-in-flow-dashboard";
import { SyncNowButton } from "@/components/sync-now-button";
import { BizzmineEmptyState } from "@/components/bizzmine-empty-state";
import { useData } from "@/contexts/data-context";
import Image from 'next/image';

function DashboardSlot({ children }: { children: React.ReactNode }) {
  const { hasEverSynced } = useData();
  if (!hasEverSynced) return <BizzmineEmptyState />;
  return <>{children}</>;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex h-10 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Company Logo" width={120} height={120} />
            <h1 className="text-xl font-semibold tracking-tight text-primary">KPI Insights</h1>
          </div>
          <SyncNowButton />
        </header>

        <main className="flex-1 p-4 sm:p-6 space-y-6">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Total Overview</TabsTrigger>
              <TabsTrigger value="batch-release">Batch Release</TabsTrigger>
              <TabsTrigger value="capa">CAPA</TabsTrigger>
              <TabsTrigger value="changes">Changes</TabsTrigger>
              <TabsTrigger value="change-action">Change Action</TabsTrigger>
              <TabsTrigger value="documents-in-flow">Documents in Flow</TabsTrigger>
              <TabsTrigger value="non-conformance">Non-conformance</TabsTrigger>
              <TabsTrigger value="training">Training</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <DashboardSlot><CompendiumDashboard /></DashboardSlot>
            </TabsContent>
            <TabsContent value="batch-release">
              <DashboardSlot><BatchReleaseDashboard /></DashboardSlot>
            </TabsContent>
            <TabsContent value="capa">
              <DashboardSlot><CapaDashboard /></DashboardSlot>
            </TabsContent>
            <TabsContent value="changes">
              <DashboardSlot><ChangesDashboard /></DashboardSlot>
            </TabsContent>
            <TabsContent value="change-action">
              <DashboardSlot><ChangeActionDashboard /></DashboardSlot>
            </TabsContent>
            <TabsContent value="documents-in-flow">
              <DashboardSlot><DocumentsInFlowDashboard /></DashboardSlot>
            </TabsContent>
            <TabsContent value="non-conformance">
              <DashboardSlot><NonConformanceDashboard /></DashboardSlot>
            </TabsContent>
            <TabsContent value="training">
              <DashboardSlot><TrainingDashboard /></DashboardSlot>
            </TabsContent>
            <TabsContent value="settings">
              <SettingsPage />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </main>
  );
}
