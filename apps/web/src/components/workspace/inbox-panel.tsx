import {
  getAnnouncements,
  getNotifications,
  markNotificationRead,
  type Announcement,
  type NotificationRow,
} from "@/data/engagement";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function when(value: string) {
  const date = new Date(value);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return date.toLocaleTimeString();
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}

/**
 * What the platform has told this business, and what this member has been asked
 * to look at. Announcements are read-only by design: the API only publishes
 * them, so there is no compose screen to be missing.
 */
export function InboxPanel({ organizationId }: { organizationId: string }) {
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState("");
  const notifications = useAsyncResource(getNotifications, organizationId, [], revision);
  const announcements = useAsyncResource(getAnnouncements, organizationId, [], revision);

  const unread = notifications.data.filter((item) => item.readAt === null).length;

  async function markRead(row: NotificationRow) {
    setBusyId(row.id);
    try {
      await markNotificationRead(organizationId, row.id);
      setRevision((n) => n + 1);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not mark that as read");
    } finally {
      setBusyId("");
    }
  }

  return (
    <>
      {!!announcements.data.length && (
        <section className="workspace-card">
          <h2>Announcements</h2>
          <ul className="workspace-inbox-list">
            {announcements.data.map((item: Announcement) => (
              <li key={item.id} className="workspace-inbox-item">
                <strong>{item.title}</strong>
                {item.body && <p>{item.body}</p>}
                <span className="workspace-inbox-meta">{when(item.publishedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="workspace-card workspace-records">
        <div className="workspace-table-toolbar">
          <h2>
            Notifications {unread > 0 && <span className="workspace-count">{unread} new</span>}
          </h2>
        </div>

        {notifications.error && <p className="workspace-error">{notifications.error}</p>}

        <ul className="workspace-inbox-list">
          {notifications.data.map((row) => (
            <li
              key={row.id}
              className={`workspace-inbox-item${row.readAt === null ? " unread" : ""}`}
            >
              <div>
                <strong>{row.title}</strong>
                {row.body && <p>{row.body}</p>}
                <span className="workspace-inbox-meta">{when(row.createdAt)}</span>
              </div>
              {row.readAt === null && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busyId === row.id}
                  onClick={() => void markRead(row)}
                >
                  Mark read
                </Button>
              )}
            </li>
          ))}
        </ul>

        {!notifications.loading && !notifications.data.length && (
          <p className="inventory-empty">Nothing waiting for you.</p>
        )}
      </section>
    </>
  );
}
