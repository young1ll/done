import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service.js';
import { EventStoreService } from '../../core/events/event-store.service.js';
import { TaskRepository as LegacyTaskRepository } from '../../lib/projections.js';

/**
 * TaskRepository wraps the legacy TaskRepository
 * and provides it as a NestJS injectable service
 */
@Injectable()
export class TaskRepository {
  private legacyRepo: LegacyTaskRepository;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly eventStoreService: EventStoreService
  ) {
    this.legacyRepo = new LegacyTaskRepository(
      this.databaseService.getManager(),
      this.eventStoreService.getStore()
    );
  }

  /**
   * Sync task from events (used after creating/updating events)
   */
  syncFromEvents(taskId: string) {
    return this.legacyRepo.syncFromEvents(taskId);
  }

  /**
   * Get task by ID
   */
  getById(taskId: string) {
    return this.legacyRepo.getById(taskId);
  }

  /**
   * Get task by project and sequence number
   */
  getBySeq(projectId: string, seq: number) {
    return this.legacyRepo.getBySeq(projectId, seq);
  }

  /**
   * Find task by ID or seq
   */
  findTask(projectId: string, idOrSeq: string) {
    return this.legacyRepo.findTask(projectId, idOrSeq);
  }

  /**
   * List tasks with filters
   */
  list(filters?: Record<string, any>) {
    return this.legacyRepo.list(filters);
  }

  /**
   * Update task (direct DB update)
   */
  update(taskId: string, updates: Record<string, any>) {
    return this.legacyRepo.update(taskId, updates);
  }

  /**
   * Get task board view (grouped by status)
   */
  getByStatus(projectId?: string, sprintId?: string) {
    // ProjectId is required by legacy repo, use empty string as fallback
    return this.legacyRepo.getByStatus(projectId || '', sprintId);
  }
}

