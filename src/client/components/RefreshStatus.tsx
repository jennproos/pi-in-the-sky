import { isSameDay } from 'date-fns';
import type { FeedStatus } from '../../shared/types';
import { formatTime } from '../lib/dates';

interface Props {
  now: Date;
  /** Set when the server itself could not be reached. */
  error: string | null;
  lastSuccess: Date | null;
  failedFeeds: FeedStatus[];
  onRetry: () => void;
}

function when(d: Date, now: Date): string {
  return isSameDay(d, now) ? formatTime(d) : d.toLocaleDateString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

function joinNames(names: string[]): string {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** Explains what failed to refresh and how old the data is. Renders nothing when all is well. */
export function describeRefreshProblem(p: Omit<Props, 'onRetry'>): string | null {
  if (p.error) {
    return p.lastSuccess
      ? `Can't reach the calendar server. Showing events from ${when(p.lastSuccess, p.now)}.`
      : `Can't reach the calendar server. Retrying every few minutes.`;
  }
  if (p.failedFeeds.length === 0) return null;
  const names = joinNames(p.failedFeeds.map((f) => f.name));
  const noun = p.failedFeeds.length === 1 ? 'calendar' : 'calendars';
  const neverLoaded = p.failedFeeds.filter((f) => !f.lastSuccess);
  if (neverLoaded.length === p.failedFeeds.length) {
    return `${names} ${noun} couldn't load. Check the link in config.json.`;
  }
  const oldest = p.failedFeeds
    .map((f) => (f.lastSuccess ? new Date(f.lastSuccess) : null))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime())[0]!;
  return `${names} ${noun} didn't update. Showing events from ${when(oldest, p.now)}.`;
}

export function RefreshStatus(props: Props) {
  const message = describeRefreshProblem(props);
  return (
    <div className="refresh-status" aria-live="polite">
      {message && (
        <button type="button" className="refresh-warning" onClick={props.onRetry} title="Tap to try again">
          <span className="warn-dot" aria-hidden="true" />
          {message}
        </button>
      )}
    </div>
  );
}
