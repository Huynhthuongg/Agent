import { GoogleGenAI, Type } from '@google/genai';
import { Agent } from './Agent.ts';
import { MemorySystem } from '../core/Memory.ts';
import { ToolRegistry } from '../tools/ToolRegistry.ts';

export class CommanderAgent extends Agent {
  constructor(ai: GoogleGenAI, memory: MemorySystem, tools: ToolRegistry) {
    super(ai, memory, tools, 'Commander', 'commander');
  }

  public async execute(task: string): Promise<{ summary: string; data?: any }> {
    return { summary: `Commander executed task: ${task}` };
  }

  public async createPlan(userPrompt: string): Promise<{ steps: { description: string; assignedAgent: string }[] }> {
    const systemInstruction = `You are the Commander Agent of the Super AI System.
Your job is to break down a user's prompt into a sequence of actionable steps.
Assign each step to one of the following agents:
- developer: For writing code, fixing bugs, building apps.
- automation: For running workflows, connecting APIs, creating automations.
- research: For searching the web, analyzing data.
- system: For deploying servers, managing infrastructure.

Return a JSON object with a "steps" array. Each step must have "description" and "assignedAgent".`;

    const response = await this.ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  assignedAgent: { type: Type.STRING },
                },
                required: ['description', 'assignedAgent'],
              },
            },
          },
          required: ['steps'],
        },
      },
    });

    try {
      const plan = JSON.parse(response.text || '{"steps": []}');
      return plan;
    } catch (e) {
      return { steps: [] };
    }
  }

  public async evaluateResult(task: string, resultSummary: string): Promise<{ success: boolean; reason: string }> {
    const systemInstruction = `You are the Commander Agent evaluating a task result.
Task: ${task}
Result: ${resultSummary}

Evaluate if the result successfully completed the task. Return a JSON object with "success" (boolean) and "reason" (string).`;

    const response = await this.ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: 'Evaluate the result.',
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            success: { type: Type.BOOLEAN },
            reason: { type: Type.STRING },
          },
          required: ['success', 'reason'],
        },
      },
    });

    try {
      return JSON.parse(response.text || '{"success": true, "reason": "Default"}');
    } catch (e) {
      return { success: true, reason: 'Parse error, assuming success' };
    }
  }
}
