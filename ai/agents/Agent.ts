import { GoogleGenAI, Type } from '@google/genai';
import { MemorySystem } from '../core/Memory.ts';
import { ToolRegistry } from '../tools/ToolRegistry.ts';

export abstract class Agent {
  protected ai: GoogleGenAI;
  protected memory: MemorySystem;
  protected tools: ToolRegistry;
  protected name: string;
  protected type: string;

  constructor(ai: GoogleGenAI, memory: MemorySystem, tools: ToolRegistry, name: string, type: string) {
    this.ai = ai;
    this.memory = memory;
    this.tools = tools;
    this.name = name;
    this.type = type;
  }

  public abstract execute(task: string): Promise<{ summary: string; data?: any }>;

  protected async generateResponse(prompt: string, systemInstruction: string, tools?: any[]) {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        systemInstruction,
        tools: tools ? [{ functionDeclarations: tools }] : undefined,
      },
    });

    return response;
  }
}
