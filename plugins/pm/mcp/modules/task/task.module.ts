import { Module } from '@nestjs/common';
import { TaskService } from './task.service.js';
import { TaskRepository } from './task.repository.js';
import { TaskController } from './task.controller.js';

/**
 * TaskModule provides task management functionality
 *
 * Exports:
 * - TaskService: For use by other modules
 *
 * Controllers:
 * - TaskController: MCP tool handlers
 */
@Module({
  providers: [TaskService, TaskRepository],
  controllers: [TaskController],
  exports: [TaskService],
})
export class TaskModule {}
