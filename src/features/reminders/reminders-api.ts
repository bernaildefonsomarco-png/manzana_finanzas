import { ApiClientError } from "@/features/movements/movements-api";
import type { NudgeType } from "@/shared/types/domain";

type ApiResponse<T> =
  | { ok: true; data: T; meta: { trace_id: string } }
  | { ok: false; error: { code: string; message: string }; meta: { trace_id: string } };

export type Reminder = {
  id: string;
  kind: string;
  title: string;
  body: string;
  action_url: string | null;
  status: string;
  created_at: string;
  expires_at: string;
};

export async function listReminders(estado?: "abiertos" | "cerrados"): Promise<Reminder[]> {
  const query = estado ? `?estado=${estado}` : "";
  const data = await request<{ reminders: Reminder[] }>(`/api/v1/reminders${query}`);
  return data.reminders;
}

export async function markReminderRead(id: string): Promise<void> {
  await request(`/api/v1/reminders/${id}/read`, { method: "POST" });
}

export async function markAllRead(): Promise<void> {
  await request(`/api/v1/reminders/read-all`, { method: "POST" });
}

export async function snoozeReminder(id: string, until: string): Promise<void> {
  await request(`/api/v1/reminders/${id}/snooze`, writeInit({ until }));
}

export async function dismissReminder(id: string): Promise<void> {
  await request(`/api/v1/reminders/${id}/dismiss`, { method: "POST" });
}

export type ReminderPreference = { nudge_type: NudgeType; channel: "dashboard" | "email"; enabled: boolean };

export async function getReminderPreferences(): Promise<{ preferences: ReminderPreference[]; paused_until: string | null }> {
  return request(`/api/v1/reminder-preferences`);
}

export async function setReminderPreference(input: {
  nudge_type: NudgeType;
  channel: "dashboard" | "email";
  enabled: boolean;
}): Promise<void> {
  await request(`/api/v1/reminder-preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function pauseReminders(): Promise<{ paused_until: string }> {
  return request(`/api/v1/reminder-preferences/pause`, { method: "POST" });
}

export async function resumeReminders(): Promise<void> {
  await request(`/api/v1/reminder-preferences/resume`, { method: "POST" });
}

function writeInit(body: Record<string, unknown>): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", ...init });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) {
    throw new ApiClientError(payload.error.code, payload.error.message, response.status, payload.meta?.trace_id ?? null, {});
  }
  return payload.data;
}
