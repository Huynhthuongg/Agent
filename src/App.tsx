/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bot, Terminal, Activity, Settings, Play, CheckCircle2, CircleDashed, LogIn, Github, LogOut, Shield, Edit2, Trash2, Plus, X, Search, Filter, SortAsc, SortDesc, HelpCircle } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface LogEntry {
  taskId: string;
  message: string;
  timestamp: string;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'developer' | 'user';
}

interface Agent {
  id: string;
  name: string;
  description: string;
  role: string;
  status: 'active' | 'idle' | 'offline';
  permissions: string[];
}

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  
  // Sort and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'status'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const logsEndRef = useRef<HTMLDivElement>(null);

  const filteredAndSortedAgents = useMemo(() => {
    return agents
      .filter(agent => {
        const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              agent.role.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'name') {
          comparison = a.name.localeCompare(b.name);
        } else if (sortBy === 'role') {
          comparison = a.role.localeCompare(b.role);
        } else if (sortBy === 'status') {
          comparison = a.status.localeCompare(b.status);
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [agents, searchQuery, statusFilter, sortBy, sortOrder]);

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  };

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const session = await res.json();
      if (session && session.user) {
        setIsAuthenticated(true);
        setUser(session.user);
        fetchAgents();
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch session', error);
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
    });

    newSocket.on('task_log', (log: LogEntry) => {
      setLogs((prev) => [...prev, log]);
    });

    newSocket.on('task_update', (update) => {
      if (update.status === 'started') {
        setLogs((prev) => [...prev, { taskId: update.taskId, message: update.message, timestamp: new Date().toISOString() }]);
      }
    });

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        checkSession();
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      newSocket.disconnect();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleRunTask = async () => {
    if (!prompt) return;
    setLoading(true);
    setResult(null);
    setLogs([]);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to run task');
      setResult(data);
    } catch (error: any) {
      console.error(error);
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (provider: string) => {
    try {
      const response = await fetch(`/api/auth/url?provider=${provider}`);
      if (!response.ok) throw new Error('Failed to get auth URL');
      const { url } = await response.json();
      
      window.open(
        url,
        'oauth_popup',
        'width=600,height=700'
      );
    } catch (error) {
      console.error('OAuth error:', error);
      alert('Failed to initiate login.');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    setUser(null);
    setIsAuthenticated(false);
  };

  const handleSaveAgent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const agentData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      role: formData.get('role') as string,
      status: formData.get('status') as 'active' | 'idle' | 'offline',
      permissions: (formData.get('permissions') as string).split(',').map(p => p.trim()).filter(Boolean),
    };

    try {
      const url = editingAgent ? `/api/agents/${editingAgent.id}` : '/api/agents';
      const method = editingAgent ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentData),
      });

      if (res.ok) {
        fetchAgents();
        setShowAgentModal(false);
        setEditingAgent(null);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save agent');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to save agent');
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAgents();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete agent');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to delete agent');
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full flex flex-col items-center gap-6 shadow-xl">
          <div className="w-16 h-16 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-center shadow-inner">
            <Bot className="w-8 h-8 text-emerald-400" />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">Super AI System</h1>
            <p className="text-sm text-zinc-400">Sign in to access the AI automation platform.</p>
          </div>
          
          <div className="w-full space-y-3 mt-4">
            <button 
              onClick={() => handleLogin('google')}
              className="w-full bg-white text-zinc-900 hover:bg-zinc-200 px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-3 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
            <button 
              onClick={() => handleLogin('github')}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-3 transition-colors"
            >
              <Github className="w-5 h-5" />
              Continue with GitHub
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6 text-emerald-400" />
          <h1 className="text-xl font-semibold tracking-tight">Super AI System</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <span className="flex items-center gap-1">
            <Activity className="w-4 h-4 text-emerald-500" /> 
            {socket?.connected ? 'System Active' : 'Connecting...'}
          </span>
          <div className="flex items-center gap-3 pl-4 border-l border-zinc-800">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.name || 'User'} className="w-8 h-8 rounded-full border border-zinc-700" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                {user.name?.[0] || user.email[0]}
              </div>
            )}
            <div className="flex flex-col hidden sm:flex">
              <span className="text-zinc-200 font-medium leading-none">{user.name || user.email}</span>
              <span className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                <Shield className="w-3 h-3" /> {user.role}
              </span>
            </div>
            <button onClick={() => setShowHelpModal(true)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors ml-2" title="Help & FAQ">
              <HelpCircle className="w-4 h-4 text-zinc-400 hover:text-indigo-400" />
            </button>
            <button onClick={handleLogout} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors" title="Logout">
              <LogOut className="w-4 h-4 text-zinc-400 hover:text-red-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Input & Logs */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4 shadow-sm">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-400" />
              New Task
            </h2>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="E.g., Create a new React component for a user profile..."
              className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 resize-none"
            />
            <div className="flex justify-end">
              <button
                onClick={handleRunTask}
                disabled={loading || !prompt}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 px-5 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <CircleDashed className="w-4 h-4 animate-spin" /> Processing...
                  </span>
                ) : (
                  <>
                    <Play className="w-4 h-4" /> Execute Task
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Real-time Logs */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col flex-1 overflow-hidden shadow-sm min-h-[300px]">
            <div className="border-b border-zinc-800 p-4 bg-zinc-900/80">
              <h2 className="text-sm font-medium flex items-center gap-2 text-zinc-300">
                <Activity className="w-4 h-4" /> Execution Logs
              </h2>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-zinc-950 font-mono text-xs space-y-2">
              {logs.length === 0 ? (
                <div className="text-zinc-600 italic">Waiting for tasks...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex gap-3 text-zinc-300">
                    <span className="text-zinc-600 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={log.message.includes('[Error]') ? 'text-red-400' : log.message.includes('[Warning]') ? 'text-yellow-400' : ''}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Result Area */}
          {result && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Execution Result
                </h2>
                <button 
                  onClick={() => setShowConfirmDialog(true)}
                  className="text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  Mark as Completed
                </button>
              </div>
              <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-xs font-mono text-zinc-300 overflow-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Right Column: Agents Status */}
        <div className="flex flex-col gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Active Agents</h2>
              {user.role === 'admin' && (
                <button 
                  onClick={() => { setEditingAgent(null); setShowAgentModal(true); }}
                  className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors"
                  title="Add Agent"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Filters and Sorting */}
            <div className="flex flex-col gap-3 mb-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search by name or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 pl-9 pr-3 text-xs focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Filter className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 pl-7 pr-2 text-xs focus:outline-none focus:border-emerald-500/50 appearance-none"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="idle">Idle</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>
                <div className="relative flex-1">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-2 text-xs focus:outline-none focus:border-emerald-500/50 appearance-none"
                  >
                    <option value="name">Sort by Name</option>
                    <option value="role">Sort by Role</option>
                    <option value="status">Sort by Status</option>
                  </select>
                </div>
                <button
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="px-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors flex items-center justify-center"
                  title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                >
                  {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
              {filteredAndSortedAgents.length === 0 ? (
                <div className="text-sm text-zinc-500 italic text-center py-4">No agents found</div>
              ) : (
                filteredAndSortedAgents.map((agent) => {
                  const isActive = agent.status === 'active' || (agent.name === 'Commander' && loading);
                  return (
                    <div key={agent.id} className="flex flex-col p-3 bg-zinc-950 border border-zinc-800 rounded-lg group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-zinc-200">{agent.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={`flex items-center gap-1.5 text-xs ${isActive ? 'text-emerald-400' : agent.status === 'offline' ? 'text-red-400' : 'text-zinc-500'}`}>
                            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : agent.status === 'offline' ? 'bg-red-500' : 'bg-zinc-600'}`}></span>
                            {isActive ? 'Active' : agent.status === 'offline' ? 'Offline' : 'Idle'}
                          </span>
                          {user.role === 'admin' && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingAgent(agent); setShowAgentModal(true); }} className="p-1 text-zinc-400 hover:text-indigo-400 transition-colors">
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button onClick={() => handleDeleteAgent(agent.id)} className="p-1 text-zinc-400 hover:text-red-400 transition-colors">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-zinc-500 mb-2">{agent.description}</span>
                      <div className="flex flex-wrap gap-1">
                        {agent.permissions.map(p => (
                          <span key={p} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px] uppercase tracking-wider">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-medium mb-4">System Resources</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">Memory Usage</span>
                  <span className="text-zinc-300">45%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 w-[45%]"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">CPU Load</span>
                  <span className="text-zinc-300">12%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[12%]"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">Active Workflows</span>
                  <span className="text-zinc-300">3</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 w-[30%]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold mb-2 text-zinc-100">Confirm Completion</h3>
            <p className="text-zinc-400 text-sm mb-6">
              Are you sure you want to mark this task as completed? This will clear the current result and logs. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setResult(null);
                  setLogs([]);
                  setPrompt('');
                  setShowConfirmDialog(false);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-zinc-950 hover:bg-emerald-600 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Agent Modal */}
      {showAgentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-zinc-100">
                {editingAgent ? 'Edit Agent' : 'Create Agent'}
              </h3>
              <button onClick={() => setShowAgentModal(false)} className="text-zinc-400 hover:text-zinc-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveAgent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">Name</label>
                <input 
                  type="text" 
                  name="name" 
                  defaultValue={editingAgent?.name} 
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">Role</label>
                <input 
                  type="text" 
                  name="role" 
                  defaultValue={editingAgent?.role} 
                  required
                  placeholder="e.g., Engineer, Analyst"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">Description</label>
                <input 
                  type="text" 
                  name="description" 
                  defaultValue={editingAgent?.description} 
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">Status</label>
                <select 
                  name="status" 
                  defaultValue={editingAgent?.status || 'idle'}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                >
                  <option value="active">Active</option>
                  <option value="idle">Idle</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1">Permissions (comma separated)</label>
                <input 
                  type="text" 
                  name="permissions" 
                  defaultValue={editingAgent?.permissions.join(', ')} 
                  placeholder="read, write, execute"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button"
                  onClick={() => setShowAgentModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-zinc-950 hover:bg-emerald-600 transition-colors"
                >
                  Save Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-400" />
                Help & FAQ
              </h3>
              <button onClick={() => setShowHelpModal(false)} className="text-zinc-400 hover:text-zinc-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto pr-2 space-y-6 flex-1">
              <section>
                <h4 className="text-md font-medium text-emerald-400 mb-2">Getting Started</h4>
                <p className="text-sm text-zinc-400 mb-2">
                  Welcome to the Super AI System. You can use this platform to execute automated tasks, manage AI agents, and monitor system resources.
                </p>
              </section>
              
              <section className="space-y-4">
                <h4 className="text-md font-medium text-emerald-400">Frequently Asked Questions</h4>
                
                <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-zinc-200 mb-1">How do I run a new task?</h5>
                  <p className="text-xs text-zinc-400">
                    Enter your task description in the "New Task" text area and click "Execute Task". The system will process your request and display real-time logs below.
                  </p>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-zinc-200 mb-1">How do I manage agents?</h5>
                  <p className="text-xs text-zinc-400">
                    If you have admin privileges, you can click the "+" button in the "Active Agents" panel to create a new agent. You can also edit or delete existing agents using the icons that appear when hovering over an agent.
                  </p>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                  <h5 className="text-sm font-medium text-zinc-200 mb-1">What do the agent statuses mean?</h5>
                  <p className="text-xs text-zinc-400">
                    <span className="text-emerald-400">Active:</span> The agent is currently processing a task.<br/>
                    <span className="text-zinc-500">Idle:</span> The agent is online but not currently assigned a task.<br/>
                    <span className="text-red-400">Offline:</span> The agent is disconnected or disabled.
                  </p>
                </div>
              </section>

              <section>
                <h4 className="text-md font-medium text-emerald-400 mb-2">Support</h4>
                <p className="text-sm text-zinc-400">
                  If you need further assistance or encounter any issues, please contact the system administrator or open an issue on our GitHub repository.
                </p>
              </section>
            </div>
            <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-end">
              <button 
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
