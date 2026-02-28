import { GoogleGenAI, Type } from '@google/genai';
import { Agent } from './Agent.ts';
import { MemorySystem } from '../core/Memory.ts';
import { ToolRegistry } from '../tools/ToolRegistry.ts';

export class AutomationAgent extends Agent {
  constructor(ai: GoogleGenAI, memory: MemorySystem, tools: ToolRegistry) {
    super(ai, memory, tools, 'Automation', 'automation');
  }

  public async execute(task: string): Promise<{ summary: string; data?: any }> {
    const systemInstruction = `You are the Automation Agent of the Super AI System.
Your job is to run workflows, connect APIs, and create automations.
Task: ${task}

Execute the task using your tools. Return a summary of what you did.`;

    const tools = [
      this.tools.getTool('api_fetch'),
      this.tools.getTool('workflow_run'),
    ].filter(Boolean);

    const response = await this.ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: task,
      config: {
        systemInstruction,
        tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
      },
    });

    if (response.functionCalls && response.functionCalls.length > 0) {
      for (const call of response.functionCalls) {
        if (call.name === 'api_fetch') {
          console.log(`[Automation] Fetching API: ${call.args.url}`);
        } else if (call.name === 'workflow_run') {
          console.log(`[Automation] Running workflow: ${call.args.workflowId}`);
        }
      }
    }

    return { summary: response.text || 'Task completed by Automation Agent.' };
  }
}
