import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { TaskRepository } from './task.repository.js';
import { EventStoreService } from '../../core/events/event-store.service.js';
import { createTaskEvent } from '../../../storage/lib/events.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto.js';
import { ListTasksDto } from './dto/list-tasks.dto.js';

/**
 * TaskService handles task business logic
 * Uses event sourcing pattern: create events → sync projections
 */
@Injectable()
export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly eventStoreService: EventStoreService
  ) {}

  /**
   * Create a new task
   */
  async create(dto: CreateTaskDto) {
    const taskId = randomUUID();
    const eventStore = this.eventStoreService.getStore();

    // Create TaskCreated event
    createTaskEvent(eventStore, 'TaskCreated', taskId, {
      title: dto.title,
      description: dto.description,
      projectId: dto.projectId,
      type: dto.type || 'task',
      priority: dto.priority || 'medium',
      parentId: dto.parentId,
    });

    // Create TaskEstimated event if estimate provided
    if (dto.estimatePoints) {
      createTaskEvent(eventStore, 'TaskEstimated', taskId, {
        points: dto.estimatePoints,
      });
    }

    // Create TaskAddedToSprint event if sprint provided
    if (dto.sprintId) {
      createTaskEvent(eventStore, 'TaskAddedToSprint', taskId, {
        sprintId: dto.sprintId,
      });
    }

    // Sync projection from events
    const task = this.taskRepository.syncFromEvents(taskId);
    return task;
  }

  /**
   * Get task by ID
   */
  async get(id: string) {
    const task = this.taskRepository.getById(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }
    return task;
  }

  /**
   * List tasks with filters
   */
  async list(dto: ListTasksDto) {
    return this.taskRepository.list({
      projectId: dto.projectId,
      sprintId: dto.sprintId,
      status: dto.status,
      type: dto.type,
      limit: dto.limit,
    });
  }

  /**
   * Update task
   */
  async update(dto: UpdateTaskDto) {
    const { id, ...updates } = dto;
    const eventStore = this.eventStoreService.getStore();

    // Create TaskUpdated event
    createTaskEvent(eventStore, 'TaskUpdated', id, {
      title: updates.title,
      description: updates.description,
      priority: updates.priority,
      assignee: updates.assignee,
    });

    // Create TaskEstimated event if estimate changed
    if (updates.estimatePoints !== undefined) {
      createTaskEvent(eventStore, 'TaskEstimated', id, {
        points: updates.estimatePoints,
      });
    }

    // Sync projection from events
    const task = this.taskRepository.syncFromEvents(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    return task;
  }

  /**
   * Update task status
   */
  async updateStatus(dto: UpdateTaskStatusDto) {
    const currentTask = this.taskRepository.getById(dto.id);
    if (!currentTask) {
      throw new Error(`Task not found: ${dto.id}`);
    }

    const eventStore = this.eventStoreService.getStore();

    // Create TaskStatusChanged event
    createTaskEvent(eventStore, 'TaskStatusChanged', dto.id, {
      from: currentTask.status,
      to: dto.status,
      reason: dto.reason,
    });

    // Sync projection from events
    const task = this.taskRepository.syncFromEvents(dto.id);
    return task;
  }

  /**
   * Get task board (grouped by status)
   */
  async getBoard(projectId?: string, sprintId?: string) {
    return this.taskRepository.getByStatus(projectId, sprintId);
  }
}

