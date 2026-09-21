// backend/src/modules/notifications/templates.ts
//
// one function per template key. keep them plain: a subject, a text body and a minimal
// html body. anything that needs the org timezone or currency gets it from ctx

import { DateTime } from 'luxon';
import { config } from '../../config';
import { RenderedEmail } from './types';

export interface TemplateContext { firstName: string; orgName: string; timezone: string; currency: string }
type Template = (p: Record<string, any>, ctx: TemplateContext) => RenderedEmail;

const when = (iso: string | Date, tz: string) => DateTime.fromJSDate(new Date(iso)).setZone(tz).toFormat('ccc d LLL yyyy, h:mm a');
const day = (d: string) => DateTime.fromISO(d).toFormat('d LLL yyyy');
const money = (cents: number, currency: string) => `${currency} ${(cents / 100).toFixed(2)}`;
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const appUrl = () => config.http.corsOrigins[0];

const wrap = (ctx: TemplateContext, subject: string, lines: string[]): RenderedEmail => {
  const text = [`Hi ${ctx.firstName},`, '', ...lines, '', ctx.orgName].join('\n');
  const html = `<p>Hi ${escape(ctx.firstName)},</p>${lines.map(l => `<p>${escape(l)}</p>`).join('')}<p>${escape(ctx.orgName)}</p>`;
  return { subject, text, html };
};

const templates: Record<string, Template> = {
  account_created_v1: (_p, ctx) => wrap(ctx, `Welcome to ${ctx.orgName}`, ['Your account has been created. You can now add your children and browse classes.']),

  password_reset_v1: (p, ctx) => wrap(ctx, `Reset your password`, [
    `Use this link to reset your password. It expires in one hour.`,
    `${appUrl()}/reset-password?token=${encodeURIComponent(p.resetToken)}`,
    `If you did not request this, you can ignore this email.`]),

  session_reminder_v1: (p, ctx) => wrap(ctx, `Reminder: ${p.courseName} tomorrow`, [
    `${p.studentName} has ${p.courseName} on ${when(p.startsAt, ctx.timezone)} at ${p.branchName}${p.classroomName ? `, ${p.classroomName}` : ''}.`]),

  session_cancelled_v1: (p, ctx) => wrap(ctx, `Cancelled: ${p.courseName} on ${when(p.startsAt, ctx.timezone)}`, [
    `The ${p.courseName} session on ${when(p.startsAt, ctx.timezone)} has been cancelled.`, `Reason: ${p.reason}`,
    `If a make-up credit applies it will appear in your account.`]),

  session_rescheduled_v1: (p, ctx) => wrap(ctx, `Rescheduled: ${p.courseName}`, [
    `The ${p.courseName} session originally on ${when(p.from, ctx.timezone)} is now on ${when(p.to, ctx.timezone)}.`]),

  tutor_changed_v1: (p, ctx) => wrap(ctx, `Tutor change: ${p.courseName}`, [
    `The ${p.courseName} session on ${when(p.startsAt, ctx.timezone)} will be taught by ${p.tutorName ?? 'a different tutor'}.`]),

  tutor_assigned_v1: (p, ctx) => wrap(ctx, `You have been assigned: ${p.courseName}`, [
    `You are now teaching ${p.courseName} on ${when(p.startsAt, ctx.timezone)}.`]),

  student_absent_v1: (p, ctx) => wrap(ctx, `${p.studentName} was marked absent`, [
    `${p.studentName} was marked absent from ${p.courseName} on ${when(p.startsAt, ctx.timezone)}.`,
    `If this is unexpected, please contact the centre.`]),

  invoice_issued_v1: (p, ctx) => wrap(ctx, `Invoice ${p.invoiceNumber} from ${ctx.orgName}`, [
    `A new invoice ${p.invoiceNumber} for ${money(p.totalCents, ctx.currency)} is due on ${day(p.dueOn)}.`,
    `View it here: ${appUrl()}/parent/invoices/${p.invoiceId}`]),

  invoice_overdue_v1: (p, ctx) => wrap(ctx, `Overdue: invoice ${p.invoiceNumber}`, [
    `Invoice ${p.invoiceNumber} was due on ${day(p.dueOn)} and has an outstanding balance of ${money(p.balanceCents, ctx.currency)}.`,
    `View it here: ${appUrl()}/parent/invoices/${p.invoiceId}`]),

  waitlist_offer_v1: (p, ctx) => wrap(ctx, `A seat is available in ${p.courseName}`, [
    `A seat has opened in ${p.courseName}. The offer expires on ${when(p.expiresAt, ctx.timezone)}.`,
    `Accept it here: ${appUrl()}/parent/classes`]),

  leave_request_submitted_v1: (p, ctx) => wrap(ctx, `Leave request from ${p.requester}`, [
    `${p.requester} has requested leave from ${day(p.startsOn)} to ${day(p.endsOn)}.`, `Review it here: ${appUrl()}/admin/leave`]),

  leave_request_decided_v1: (p, ctx) => wrap(ctx, `Your leave request was ${p.decision}`, [
    `Your leave request has been ${p.decision}.`, ...(p.note ? [`Note: ${p.note}`] : [])]),
};

export const render = (template: string, payload: Record<string, any>, ctx: TemplateContext): RenderedEmail => {
  const fn = templates[template];
  if (!fn) throw new Error(`Unknown template: ${template}`);
  return fn(payload, ctx);
};

export const hasTemplate = (template: string) => template in templates;