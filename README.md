# ZidShip Architecture Documentation

## Overview

This document describes the architectural design of the ZidShip courier integration framework. The system is designed to provide a unified interface for managing shipments across multiple courier providers (e.g., SMSA, Aramex) while keeping the core business logic decoupled from provider-specific implementations.

## Design Goals

1.  **Extensibility**: Easily add new couriers without modifying the core system.
2.  **Unified Interface**: Expose a single, consistent API for the rest of the ZidShip system.
3.  **Resilience**: Handle network failures and external API flakiness gracefully.
4.  **Observability**: Track shipment lifecycle events consistently.

## Core Components

### 1. Courier Integration Framework (Strategy & Adapter Patterns)

The heart of the solution combines the **Strategy Pattern** with the **Adapter Pattern**:

*   **Strategy**: The system defines a family of algorithms (courier integrations), encapsulates each one, and makes them interchangeable. `CourierService` selects the appropriate strategy at runtime based on the `providerId`.
*   **Adapter**: Each strategy implementation acts as an adapter, translating the unified `ICourierAdapter` interface calls into the specific API calls required by the third-party courier (e.g., SMSA, Aramex).

*   **Interface (`ICourierAdapter`)**: Defines the contract that all couriers must adhere to.
    *   `createWaybill`: Generates a label and tracking number.
    *   `trackShipment`: Returns standardized status and history.
    *   `mapStatus`: Converts specific courier statuses (e.g., "With Courier") to the system's unified `ShipmentStatus` enum.
    *   `capabilities`: A feature flag object indicating if the courier supports optional features like `cancellation` or `printLabel`.

*   **Registry (`CourierService`)**:
    *   Acts as the factory and registry for adapters.
    *   Injects all adapters using the `COURIER_ADAPTERS` token.
    *   Provides `getAdapter(providerId)` to dynamically select the correct implementation at runtime.

### 2. Shipment Orchestration (`ShipmentService`)

This service acts as the orchestration layer between the API/User and the Courier Framework.

*   **Lifecycle Management**: Handles the DB transactions and state transitions.
    1.  **Validation**: Checks if the courier exists and supports the requested operation.
    2.  **Persistence**: Saves the shipment in `PENDING` state before calling the external API.
    3.  **Execution**: Calls the selected Courier Adapter.
    4.  **Completion**: Updates the DB with the tracking number and label URL, or marks as `FAILED` on error.
*   **Abstraction**: The controller never talks to adapters directly; it only interacts with `ShipmentService`.

### 3. Resilience & Utilities

*   **Retry Mechanism (`@Retryable`)**:
    *   A custom decorator using interceptor-like logic to automatically retry failed operations.
    *   Configurable backoff strategies (delay, retries).
    *   Essential for external HTTP integrations where transient network issues are common.

### 4. Data Layer (Prisma & PostgreSQL)

*   **Schema**:
    *   `Shipment`: Stores core data (addresses, dimensions) and provider metadata (courierId, trackingNumber).
    *   `ShipmentStatus` (Enum): A normalized list of statuses (CREATED, PICKED_UP, DELIVERED, etc.) that acts as the "Ubiquitous Language" of the domain.
*   **JSON Fields**: `senderDetails` and `receiverDetails` are stored as JSON to allow flexibility if address formats change between regions without schema migrations.

## Tradeoffs & Decisions

### Synchronous vs. Asynchronous Processing
*   **Current Decision**: Operations like `createWaybill` are implemented **synchronously**.
    *   *Pros*: Simpler implementation; immediate feedback to the client.
    *   *Cons*: Latency is tied to the external provider. If SMSA takes 5 seconds, our API takes 5 seconds.
*   **Future Improvement**: Move shipment creation to a **Message Queue** (e.g., BullMQ/Redis). The API would return "Accepted" immediately, and workers would handle the external API calls, updating the status via Webhooks.

### Status Mapping
*   **Challenge**: Every courier has different status codes/strings.
*   **Solution**: The `mapStatus` method in every adapter allows us to normalize this data at the edge. The core system only ever sees `ShipmentStatus`.
*   **Tradeoff**: Some granularity might be lost if a courier has very specific statuses that don't map cleanly to the standard enum.

### Dependency Injection Strategy
*   **Decision**: We use a multi-provider injection token `COURIER_ADAPTERS` to inject an array of adapters into `CourierService`.
*   **Why**: This avoids a giant `switch` statement or manual registration. To add a new courier, simply create the class, decorate it with `@Injectable`, and add it to the `providers` array in `CourierModule`.

## Adding a New Courier

1.  Create a new adapter class in `src/courier/adapters/` (e.g., `DhlAdapter`).
2.  Implement `ICourierAdapter`.
4.  Register the new class in `CourierModule`.

## API Documentation

The API follows RESTful conventions:

*   `POST /shipments`: Create a new shipment.
*   `GET /shipments/:trackingNumber/track`: Get latest status and history.
*   `GET /shipments/:trackingNumber/label`: Get the label url (idealy should be pdf buffer stream).
*   `POST /shipments/:trackingNumber/cancel`: Cancel a shipment (if supported).
