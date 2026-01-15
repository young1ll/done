import { Module } from '@nestjs/common';
import { DatabaseModule } from './core/database/database.module.js';
import { EventsModule } from './core/events/events.module.js';
import { TaskModule } from './modules/task/task.module.js';

/**
 * Root application module
 *
 * This module imports all feature modules and provides
 * the NestJS application context for the MCP server.
 */
@Module({
  imports: [
    // Core modules
    DatabaseModule,
    EventsModule,

    // Feature modules
    TaskModule,

    // To be added:
    // ProjectModule,
    // SprintModule,
    // GitModule,
    // GitHubModule,
    // SyncModule,
  ],
})
export class AppModule {}
