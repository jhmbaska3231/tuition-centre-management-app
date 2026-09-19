// backend/src/modules/notifications/index.ts

export { notificationsRouter } from './routes';
export { dispatchPending } from './dispatcher';
export { enqueueSessionReminders } from './reminders';
export { invalidateEmailProvider } from './providers/email';
export * from './outbox';