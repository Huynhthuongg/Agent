import { GoogleGenAI, Type } from '@google/genai';
import { Agent } from './Agent.ts';
import { MemorySystem } from '../core/Memory.ts';
import { ToolRegistry } from '../tools/ToolRegistry.ts';

export class DeveloperAgent extends Agent {
  constructor(ai: GoogleGenAI, memory: MemorySystem, tools: ToolRegistry) {
    super(ai, memory, tools, 'Developer', 'developer');
  }

  public async execute(task: string): Promise<{ summary: string; data?: any }> {
    const systemInstruction = `You are the Developer Agent of the Super AI System.
Your job is to write code, fix bugs, build apps, and deploy them.
You have access to the File System Tool and Terminal Tool.
Task: ${task}

Execute the task using your tools. Return a summary of what you did.`;

    const tools = [
      this.tools.getTool('fileSystem_read'),
      this.tools.getTool('fileSystem_write'),
      this.tools.getTool('terminal_run'),
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
        if (call.name === 'fileSystem_read') {
          console.log(`[Developer] Reading file: ${call.args.path}`);
        } else if (call.name === 'fileSystem_write') {
          console.log(`[Developer] Writing file: ${call.args.path}`);
        } else if (call.name === 'terminal_run') {
          console.log(`[Developer] Running command: ${call.args.command}`);
        }
      }
    }

    return { summary: response.text || 'Task completed by Developer Agent.' };
  }
}
