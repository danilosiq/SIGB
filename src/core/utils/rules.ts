import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  startOfDay,
} from "date-fns";
export const dailyFine = () =>
  Math.max(0, Number(process.env.DAILY_FINE_CENTS) || 100);
export function fineAt(dueAt: Date, at = new Date(), rate = dailyFine()) {
  return (
    Math.max(0, differenceInCalendarDays(startOfDay(at), startOfDay(dueAt))) *
    rate
  );
}
export function shouldBlock(borrowedAt: Date, at = new Date()) {
  return at > addMonths(borrowedAt, 2);
}
export function defaultDueAt(now = new Date()) {
  return addDays(now, Number(process.env.LOAN_DAYS) || 14);
}
export function retryDelay(attempt: number) {
  return 60_000 * 2 ** Math.max(0, attempt - 1);
}
