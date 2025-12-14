// src/courier/courier.service.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ICourierAdapter } from './interface/courier.interface';

@Injectable()
export class CourierService {
  private adapters: Map<string, ICourierAdapter> = new Map();

  constructor(
    // We inject all registered adapters as an array
    @Inject('COURIER_ADAPTERS')
    private readonly registeredAdapters: ICourierAdapter[],
  ) {
    // Index them by ID for O(1) lookup
    this.registeredAdapters.forEach((adapter) => {
      this.adapters.set(adapter.providerId, adapter);
    });
  }

  /**
   * Factory Method: Selects the correct strategy
   */
  getAdapter(providerId: string): ICourierAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      throw new NotFoundException(
        `Courier provider '${providerId}' is not supported.`,
      );
    }
    return adapter;
  }

  /**
   * Helper: List all available providers
   */
  getAllProviders() {
    return Array.from(this.adapters.values()).map((adapter) => ({
      id: adapter.providerId,
      capabilities: adapter.capabilities,
    }));
  }
}
