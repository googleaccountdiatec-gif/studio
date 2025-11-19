"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getProductionTeam, setProductionTeam } from '@/lib/teams';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { XIcon, PlusIcon } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const [team, setTeam] = useState<string[]>([]);
  const [newMember, setNewMember] = useState('');
  const { toast } = useToast();

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

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>Manage your application settings and configurations.</CardDescription>
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
        </Card>
    </div>
  );
}
