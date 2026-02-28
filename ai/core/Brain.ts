import { GoogleGenAI, Type } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import db from '../../db/index.ts';
import { Agent } from '../agents/Agent.ts';
import { CommanderAgent } from '../agents/CommanderAgent.ts';
import { DeveloperAgent } from '../agents/DeveloperAgent.ts';
import { AutomationAgent } from '../agents/AutomationAgent.ts';
import { MemorySystem } from './Memory.ts';
import { ToolRegistry } from '../tools/ToolRegistry.ts';

export class AIBrain {
  private ai: GoogleGenAI;
  private agents: Map<string, Agent> = new Map();
  private memory: MemorySystem;
  private tools: ToolRegistry;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
    this.memory = new MemorySystem();
    this.tools = new ToolRegistry();
    this.initializeAgents();
  }

  private initializeAgents() {
    this.agents.set('commander', new CommanderAgent(this.ai, this.memory, this.tools));
    this.agents.set('developer', new DeveloperAgent(this.ai, this.memory, this.tools));
    this.agents.set('automation', new AutomationAgent(this.ai, this.memory, this.tools));

    for (const [type, agent] of this.agents.entries()) {
      const existing = db.prepare('SELECT id FROM agents WHERE type = ?').get(type);
      if (!existing) {
        db.prepare('INSERT INTO agents (id, name, type, permissions) VALUES (?, ?, ?, ?)').run(
          uuidv4(),
          `${type.charAt(0).toUpperCase() + type.slice(1)} Agent`,
          type,
          JSON.stringify(['all'])
        );
      }
    }
  }

  public async processTask(taskId: string, userPrompt: string, onProgress?: (msg: string) => void) {
    onProgress?.(`[Brain] Received task: ${userPrompt}`);
    
    const commander = this.agents.get('commander') as CommanderAgent;
    if (!commander) throw new Error('Commander agent not found');

    onProgress?.(`[Brain] Routing task to Commander...`);
    const plan = await commander.createPlan(userPrompt);
    onProgress?.(`[Brain] Plan created: ${plan.steps.length} steps.`);

    for (const step of plan.steps) {
      onProgress?.(`[Brain] Executing step: ${step.description} (Agent: ${step.assignedAgent})`);
      const agent = this.agents.get(step.assignedAgent);
      
      if (!agent) {
        onProgress?.(`[Error] Agent ${step.assignedAgent} not found. Skipping step.`);
        continue;
      }

      try {
        const result = await agent.execute(step.description);
        onProgress?.(`[${step.assignedAgent}] Result: ${result.summary}`);
        
        const evaluation = await commander.evaluateResult(step.description, result.summary);
        if (!evaluation.success) {
          onProgress?.(`[Warning] Evaluation failed: ${evaluation.reason}. Retrying...`);
        }
      } catch (error: any) {
        onProgress?.(`[Error] Step execution failed: ${error.message}`);
        throw error;
      }
    }

    onProgress?.(`[Brain] Task completed successfully.`);
    return { status: 'completed', plan };
  }

  public getAgent(type: string): Agent | undefined {
    return this.agents.get(type);
  }
}
