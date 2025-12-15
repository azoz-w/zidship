import { Logger } from '@nestjs/common';

interface RetryableOptions {
  retries?: number;
  delayMs?: number;
}

export function Retryable(options?: RetryableOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const logger = new Logger(`Retryable:${propertyKey}`);
    descriptor.value = async function (...args: any[]) {
      const retries = options?.retries ?? 3;
      const delayMs = options?.delayMs ?? 1000;
      let lastError: any;

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error;
          logger.warn(
            `Attempt ${attempt} failed for ${propertyKey}. Error: ${error.message}`,
          );
          const status = error?.response?.status;
          // Retry only for 5xx errors or network issues
          if (status && status >= 400 && status < 500) {
            throw error;
          }
          if (attempt > retries) break;
          logger.warn(
            `Method ${propertyKey} failed. Retrying in ${delayMs}ms... (Attempt ${attempt}/${retries}`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
      throw lastError;
    };
    return descriptor;
  };
}
