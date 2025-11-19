'use server';
/**
 * @fileOverview A flow to summarize CAPA data.
 *
 * - summarizeCapas - A function that handles the CAPA data summarization process.
 * - SummarizeCapasInput - The input type for the summarizeCapas function.
 * - SummarizeCapasOutput - The return type for the summarizeCapas function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { CapaData } from '@/lib/types';

const SummarizeCapasInputSchema = z.array(z.object({
    'CAPA ID': z.string(),
    'Title': z.string(),
    'Due Date': z.string(),
    'Deadline for effectiveness check': z.string(),
    'Assigned To': z.string(),
    'Pending Steps': z.string(),
    isOverdue: z.boolean().optional(),
    effectiveDueDate: z.date().optional(),
}));

export type SummarizeCapasInput = z.infer<typeof SummarizeCapasInputSchema>;

const SummarizeCapasOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the provided CAPA data, highlighting key trends, overdue items, and top assignees.'),
});

export type SummarizeCapasOutput = z.infer<typeof SummarizeCapasOutputSchema>;

export async function summarizeCapas(input: SummarizeCapasInput): Promise<SummarizeCapasOutput> {
  return summarizeCapasFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeCapasPrompt',
  input: { schema: z.object({capaData: z.string()}) },
  output: { schema: SummarizeCapasOutputSchema },
  prompt: `You are an expert in analyzing Corrective and Preventive Actions (CAPA) data.
You will be given a JSON string of CAPA records.
Your task is to provide a concise summary of the data.
Highlight key trends, the number of overdue items, and mention the people with the most assigned actions.

CAPA Data:
{{{capaData}}}
`,
});

const summarizeCapasFlow = ai.defineFlow(
  {
    name: 'summarizeCapasFlow',
    inputSchema: SummarizeCapasInputSchema,
    outputSchema: SummarizeCapasOutputSchema,
  },
  async (input) => {
    // Stringify the complex input object for the prompt
    const capaDataString = JSON.stringify(input, null, 2);

    const { output } = await prompt({ capaData: capaDataString });
    return output!;
  }
);
