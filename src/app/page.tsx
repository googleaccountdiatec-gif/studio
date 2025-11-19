"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import CapaDashboard from '@/components/capa-dashboard';
import ChangeActionDashboard from "@/components/change-action-dashboard";
import NonConformanceDashboard from "@/components/non-conformance-dashboard";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6">
          <h1 className="text-xl font-semibold tracking-tight text-primary">KPI Insights</h1>
        </header>

        <main className="flex-1 p-4 sm:p-6 space-y-6">
          <Tabs defaultValue="capa">
            <TabsList>
              <TabsTrigger value="capa">CAPA</TabsTrigger>
              <TabsTrigger value="change-action">Change Action</TabsTrigger>
              <TabsTrigger value="non-conformance">Non-conformance</TabsTrigger>
            </TabsList>

            <TabsContent value="capa">
              <CapaDashboard />
            </TabsContent>
            <TabsContent value="change-action">
              <ChangeActionDashboard />
            </TabsContent>
            <TabsContent value="non-conformance">
               <NonConformanceDashboard />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </main>
  );
}
