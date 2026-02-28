export interface Agent {
  id: string;
  name: string;
  description: string;
  role: string;
  status: 'active' | 'idle' | 'offline';
  permissions: string[];
}

let agents: Agent[] = [
  { id: '1', name: 'Commander', description: 'Planning & Routing', role: 'Planner', status: 'idle', permissions: ['all'] },
  { id: '2', name: 'Developer', description: 'Code & Build', role: 'Engineer', status: 'idle', permissions: ['read', 'write'] },
  { id: '3', name: 'Automation', description: 'Workflows & APIs', role: 'Executor', status: 'idle', permissions: ['execute'] },
  { id: '4', name: 'Research', description: 'Data & Search', role: 'Analyst', status: 'idle', permissions: ['read'] }
];

export function getAgents() {
  return agents;
}

export function getAgentById(id: string) {
  return agents.find(a => a.id === id);
}

export function createAgent(agent: Omit<Agent, 'id'>) {
  const newAgent = { ...agent, id: Math.random().toString(36).substring(7) };
  agents.push(newAgent);
  return newAgent;
}

export function updateAgent(id: string, updates: Partial<Agent>) {
  const index = agents.findIndex(a => a.id === id);
  if (index !== -1) {
    agents[index] = { ...agents[index], ...updates };
    return agents[index];
  }
  return null;
}

export function deleteAgent(id: string) {
  agents = agents.filter(a => a.id !== id);
}
