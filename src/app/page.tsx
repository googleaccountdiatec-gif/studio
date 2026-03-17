"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import CapaDashboard from '@/components/capa-dashboard';
import ChangeActionDashboard from "@/components/change-action-dashboard";
import NonConformanceDashboard from "@/components/non-conformance-dashboard";
import TrainingDashboard from "@/components/training-dashboard";
import BatchReleaseDashboard from "@/components/batch-release-dashboard";
import CompendiumDashboard from "@/components/compendium-dashboard";
import SettingsPage from "@/components/settings-page";
import { MultiUploader } from "@/components/multi-uploader";
import DocumentsInFlowDashboard from "@/components/documents-in-flow-dashboard";
import Image from 'next/image';

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex h-24 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Company Logo" width={120} height={120} />
            <h1 className="text-xl font-semibold tracking-tight text-primary">KPI Insights</h1>
          </div>
          <MultiUploader />
        </header>

        <main className="flex-1 p-4 sm:p-6 space-y-6">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Total Overview</TabsTrigger>
              <TabsTrigger value="batch-release">Batch Release</TabsTrigger>
              <TabsTrigger value="capa">CAPA</TabsTrigger>
              <TabsTrigger value="change-action">Change Action</TabsTrigger>
              <TabsTrigger value="documents-in-flow">Documents in Flow</TabsTrigger>
              <TabsTrigger value="non-conformance">Non-conformance</TabsTrigger>
              <TabsTrigger value="training">Training</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <CompendiumDashboard />
            </TabsContent>
            <TabsContent value="batch-release">
              <BatchReleaseDashboard />
            </TabsContent>
            <TabsContent value="capa">
              <CapaDashboard />
            </TabsContent>
            <TabsContent value="change-action">
              <ChangeActionDashboard />
            </TabsContent>
            <TabsContent value="documents-in-flow">
              <DocumentsInFlowDashboard />
            </TabsContent>
            <TabsContent value="non-conformance">
               <NonConformanceDashboard />
            </TabsContent>
            <TabsContent value="training">
               <TrainingDashboard />
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
