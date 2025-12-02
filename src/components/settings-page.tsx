"use client";

import React, { useState, useEffect } from 'react';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { getProductionTeam, setProductionTeam } from '@/lib/teams';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { XIcon, PlusIcon, Palette } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ui/glass-card';

export default function SettingsPage() {
  const [team, setTeam] = useState<string[]>([]);
  const [newMember, setNewMember] = useState('');
  const { toast } = useToast();
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    setTeam(getProductionTeam());
  }, []);

  const handleAddMember = () => {
    if (newMember.trim() && !team.includes(newMember.trim())) {
      const updatedTeam = [...team, newMember.trim()];
      setTeam(updatedTeam);
      setProductionTeam(updatedTeam);
      setNewMember('');
       toast({
        title: "Member Added",
        description: `${newMember.trim()} has been added to the team.`,
      });
    } else if (team.includes(newMember.trim())) {
        toast({
            variant: "destructive",
            title: "Member Exists",
            description: `${newMember.trim()} is already in the team.`,
        });
    }
  };

  const handleRemoveMember = (memberToRemove: string) => {
    const updatedTeam = team.filter((member) => member !== memberToRemove);
    setTeam(updatedTeam);
    setProductionTeam(updatedTeam);
    toast({
        title: "Member Removed",
        description: `${memberToRemove} has been removed from the team.`,
    });
  };
  
  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleAddMember();
    }
  };
  
  const themes = [
    { name: 'light', colors: ['#ECEFF1', '#3F51B5', '#FFAB40'] },
    { name: 'dark', colors: ['#111827', '#60A5FA', '#FBBF24'] },
    { name: 'rose', colors: ['#FFF1F2', '#F43F5E', '#FB923C'] },
    { name: 'slate', colors: ['#0F172A', '#64748B', '#FBBF24'] },
    { name: 'curida', colors: ['#FFF3F0', '#E93420', '#250704'] },
  ];

  return (
    <div className="relative min-h-screen w-full p-10 flex flex-col gap-8 items-center overflow-hidden">
       {/* Swirly Mist Background */}
       <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] animate-mist opacity-60" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-accent/20 rounded-full blur-[100px] animate-mist opacity-60" style={{ animationDelay: '-10s', animationDuration: '25s' }} />
          <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] bg-secondary/30 rounded-full blur-[80px] animate-mist opacity-40" style={{ animationDelay: '-5s', animationDuration: '15s' }} />
       </div>

       <GlassCard className="w-full max-w-2xl p-8 z-10">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Palette className="h-6 w-6" />
                    Appearance
                </CardTitle>
                <CardDescription>Customize the look and feel of your dashboard.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <Label>Color Theme</Label>
                    <div className="flex gap-4 flex-wrap">
                        {themes.map((t) => (
                            <div key={t.name} onClick={() => setTheme(t.name)} className={cn("cursor-pointer rounded-md border-2 p-1", theme === t.name && "border-primary")}>
                                <div className="flex gap-1">
                                    {t.colors.map(color => (
                                        <div key={color} style={{ backgroundColor: color }} className="h-8 w-8 rounded-sm"/>
                                    ))}
                                </div>
                                <p className="text-sm text-center pt-1 capitalize">{t.name}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </GlassCard>
        <GlassCard className="w-full max-w-2xl p-8 z-10">
            <CardHeader>
                <CardTitle>Team Management</CardTitle>
                <CardDescription>Manage your production team members.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Production Team Members</h3>
                    <p className="text-sm text-muted-foreground">
                        Add or remove members from the Production Team. This list is used to filter data across all modules.
                    </p>
                    <div className="flex items-center gap-2">
                        <Input 
                            placeholder="New member name"
                            value={newMember}
                            onChange={(e) => setNewMember(e.target.value)}
                            onKeyDown={handleInputKeyDown}
                            className="max-w-xs"
                        />
                        <Button onClick={handleAddMember} size="sm">
                            <PlusIcon className="mr-2 h-4 w-4"/>
                            Add Member
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-4">
                        {team.map((member) => (
                            <Badge key={member} variant="secondary" className="flex items-center gap-2">
                                {member}
                                <button onClick={() => handleRemoveMember(member)} className="rounded-full hover:bg-muted-foreground/20">
                                    <XIcon className="h-3 w-3"/>
                                </button>
                            </Badge>
                        ))}
                    </div>
                </div>
            </CardContent>
        </GlassCard>
    </div>
  );
}
