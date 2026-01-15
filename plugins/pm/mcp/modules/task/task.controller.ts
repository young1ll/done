import { Controller } from '@nestjs/common';
import { TaskService } from './task.service.js';
import { MCPTool } from '../../core/common/decorators/mcp-tool.decorator.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto.js';
import { ListTasksDto } from './dto/list-tasks.dto.js';

/**
 * TaskController handles MCP tool requests for task operations
 */
@Controller()
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @MCPTool({
    name: 'pm_task_create',
    description: 'Create a new task',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        projectId: { type: 'string', description: 'Project UUID' },
        description: { type: 'string' },
        type: {
          type: 'string',
          enum: ['epic', 'story', 'task', 'bug', 'subtask'],
          default: 'task',
        },
        priority: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
          default: 'medium',
        },
        sprintId: { type: 'string' },
        parentId: { type: 'string' },
        estimatePoints: { type: 'number' },
        estimateHours: { type: 'number' },
        assignee: { type: 'string' },
        dueDate: { type: 'string', format: 'date-time' },
      },
      required: ['title', 'projectId'],
    },
  })
  async createTask(args: CreateTaskDto) {
    const task = await this.taskService.create(args);
    return {
      content: [
        {
          type: 'text',
          text: task ? `Task created: ${task.title} (#${task.seq})` : 'Task creation failed',
        },
      ],
    };
  }

  @MCPTool({
    name: 'pm_task_get',
    description: 'Get task by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task UUID' },
      },
      required: ['id'],
    },
  })
  async getTask(args: { id: string }) {
    const task = await this.taskService.get(args.id);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(task, null, 2),
        },
      ],
    };
  }

  @MCPTool({
    name: 'pm_task_list',
    description: 'List tasks with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        sprintId: { type: 'string' },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'in_review', 'done', 'blocked'],
        },
        type: {
          type: 'string',
          enum: ['epic', 'story', 'task', 'bug', 'subtask'],
        },
        limit: { type: 'number', default: 50 },
      },
    },
  })
  async listTasks(args: ListTasksDto) {
    const tasks = await this.taskService.list(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(tasks, null, 2),
        },
      ],
    };
  }

  @MCPTool({
    name: 'pm_task_update',
    description: 'Update task fields',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task UUID' },
        title: { type: 'string' },
        description: { type: 'string' },
        priority: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
        },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'in_review', 'done', 'blocked'],
        },
        sprintId: { type: 'string' },
        estimatePoints: { type: 'number' },
        estimateHours: { type: 'number' },
        actualHours: { type: 'number' },
        assignee: { type: 'string' },
        labels: { type: 'array', items: { type: 'string' } },
        dueDate: { type: 'string', format: 'date-time' },
        blockedBy: { type: 'string' },
      },
      required: ['id'],
    },
  })
  async updateTask(args: UpdateTaskDto) {
    const task = await this.taskService.update(args);
    return {
      content: [
        {
          type: 'text',
          text: `Task updated: ${task.title} (#${task.seq})`,
        },
      ],
    };
  }

  @MCPTool({
    name: 'pm_task_status',
    description: 'Update task status',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task UUID' },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'in_review', 'done', 'blocked'],
        },
        reason: { type: 'string' },
      },
      required: ['id', 'status'],
    },
  })
  async updateTaskStatus(args: UpdateTaskStatusDto) {
    const task = await this.taskService.updateStatus(args);
    return {
      content: [
        {
          type: 'text',
          text: task ? `Task status updated: ${task.title} -> ${args.status}` : 'Task status update failed',
        },
      ],
    };
  }

  @MCPTool({
    name: 'pm_task_board',
    description: 'Get task board (grouped by status)',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        sprintId: { type: 'string' },
      },
    },
  })
  async getBoard(args: { projectId?: string; sprintId?: string }) {
    const board = await this.taskService.getBoard(args.projectId, args.sprintId);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(board, null, 2),
        },
      ],
    };
  }
}
