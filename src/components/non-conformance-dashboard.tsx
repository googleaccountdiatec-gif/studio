"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUp } from 'lucide-react';

export default function NonConformanceDashboard() {
  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Non-Conformance Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
                 <div className="flex flex-col items-center justify-center text-center py-20 px-4 rounded-lg border-2 border-dashed border-muted-foreground/30">
                    <FileUp className="h-16 w-16 text-muted-foreground mb-4"/>
                    <h2 className="text-2xl font-semibold mb-2">Upload Your Non-Conformance Data</h2>
                    <p className="text-muted-foreground mb-6 max-w-md">This module is under construction. Click the "Choose file" button to upload a .csv or .tsv file to visualize your Non-Conformances.</p>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
