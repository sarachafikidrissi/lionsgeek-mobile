/**
 * In-app notification types (see app/(tabs)/notifications.jsx).
 * Preferences are stored on-device until a server API exists.
 */
export const NOTIFICATION_TYPE_PREF_SECTIONS = [
  {
    title: 'Training',
    items: [
      {
        type: 'discipline_change',
        label: 'Discipline updates',
        description: 'Changes to your training discipline',
      },
      {
        type: 'exercise_review',
        label: 'Exercise reviews',
        description: 'When an exercise needs your attention',
      },
    ],
  },
  {
    title: 'Projects',
    items: [
      { type: 'project_submission', label: 'Project submissions', description: 'New work submitted for review' },
      { type: 'project_status', label: 'Project approvals', description: 'Approved or rejected projects' },
      { type: 'task_assignment', label: 'Task assignments', description: 'Tasks assigned to you' },
      { type: 'project_message', label: 'Project messages', description: 'Chat on your projects' },
    ],
  },
  {
    title: 'Community',
    items: [
      { type: 'post_interaction', label: 'Post interactions', description: 'Activity on your posts' },
      { type: 'post_report', label: 'Moderation & reports', description: 'Reports linked to your content' },
      { type: 'follow', label: 'New followers', description: 'When someone follows you' },
    ],
  },
  {
    title: 'Access & bookings',
    items: [
      { type: 'access_request', label: 'Access requests', description: 'Requests for space or resources' },
      {
        type: 'access_request_response',
        label: 'Access decisions',
        description: 'Approved or denied access requests',
      },
      { type: 'reservation', label: 'Reservations', description: 'Coworking and related bookings' },
      { type: 'appointment', label: 'Appointments', description: 'Scheduled appointment updates' },
    ],
  },
];

export const ALL_NOTIFICATION_PREF_TYPES = NOTIFICATION_TYPE_PREF_SECTIONS.flatMap((s) =>
  s.items.map((i) => i.type),
);

export function defaultNotificationTypePrefs() {
  return Object.fromEntries(ALL_NOTIFICATION_PREF_TYPES.map((t) => [t, true]));
}

/** @param {string|null|undefined} type */
export function isNotificationTypeEnabledInPrefs(type, prefs) {
  if (!type || typeof prefs !== 'object') return true;
  if (!(type in prefs)) return true;
  return prefs[type] !== false;
}
