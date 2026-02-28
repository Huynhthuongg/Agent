export class ToolRegistry {
  private tools: Map<string, any> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  private registerDefaultTools() {
    this.tools.set('fileSystem_read', {
      name: 'fileSystem_read',
      description: 'Read a file from the file system',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'Path to the file' },
        },
        required: ['path'],
      },
    });

    this.tools.set('fileSystem_write', {
      name: 'fileSystem_write',
      description: 'Write content to a file',
      parameters: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING', description: 'Path to the file' },
          content: { type: 'STRING', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    });

    this.tools.set('terminal_run', {
      name: 'terminal_run',
      description: 'Run a terminal command',
      parameters: {
        type: 'OBJECT',
        properties: {
          command: { type: 'STRING', description: 'Command to run' },
        },
        required: ['command'],
      },
    });

    this.tools.set('api_fetch', {
      name: 'api_fetch',
      description: 'Fetch data from an API',
      parameters: {
        type: 'OBJECT',
        properties: {
          url: { type: 'STRING', description: 'URL to fetch' },
          method: { type: 'STRING', description: 'HTTP method' },
        },
        required: ['url'],
      },
    });

    this.tools.set('workflow_run', {
      name: 'workflow_run',
      description: 'Run a specific workflow',
      parameters: {
        type: 'OBJECT',
        properties: {
          workflowId: { type: 'STRING', description: 'ID of the workflow to run' },
        },
        required: ['workflowId'],
      },
    });
  }

  public getTool(name: string) {
    return this.tools.get(name);
  }

  public getAllTools() {
    return Array.from(this.tools.values());
  }
}
