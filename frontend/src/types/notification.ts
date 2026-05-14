export interface Notification {
  notification_id: string;
  user_id: string;
  itinerary_id?: string | null;
  activity_id?: string | null;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  created_at: string;
  read: boolean;
}
