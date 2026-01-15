import { Injectable } from '@nestjs/common';
import { EventStore, type EventType, type BaseEvent } from '../../../storage/lib/events.js';

/**
 * EventStoreService wraps the existing EventStore
 * and provides it as a NestJS injectable service
 */
@Injectable()
export class EventStoreService {
  private eventStore: EventStore;

  constructor() {
    const dbPath = process.env.PM_DB_PATH || '.claude/pm.db';
    this.eventStore = new EventStore(dbPath);
  }

  /**
   * Get the underlying EventStore instance
   */
  getStore(): EventStore {
    return this.eventStore;
  }

  /**
   * Append an event to the store
   */
  append(
    eventType: EventType,
    aggregateType: BaseEvent['aggregateType'],
    aggregateId: string,
    payload: Record<string, unknown>,
    metadata?: BaseEvent['metadata']
  ): BaseEvent {
    return this.eventStore.append(eventType, aggregateType, aggregateId, payload, metadata);
  }

  /**
   * Get all events for an aggregate
   */
  getEvents(aggregateType: string, aggregateId: string, fromVersion?: number) {
    return this.eventStore.getEvents(aggregateType, aggregateId, fromVersion);
  }

  /**
   * Get events by type
   */
  getEventsByType(eventType: EventType) {
    return this.eventStore.getEventsByType(eventType);
  }
}
