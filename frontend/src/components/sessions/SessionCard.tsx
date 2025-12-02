import { Link } from 'react-router-dom';
import { Session } from '@/types/flowpilot';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Play, ArrowRight, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface SessionCardProps {
  session: Session;
}

export function SessionCard({ session }: SessionCardProps) {
  const getStatusBadge = () => {
    switch (session.status) {
      case 'active':
        return (
          <Badge className="active-badge">
            <span className="mr-1 h-2 w-2 rounded-full bg-current animate-pulse" />
            Active
          </Badge>
        );
      case 'paused':
        return <Badge className="paused-badge">Paused</Badge>;
      case 'completed':
        return (
          <Badge variant="secondary">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
    }
  };

  const getDuration = () => {
    const start = new Date(session.start_time);
    const end = session.end_time ? new Date(session.end_time) : new Date();
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 p-5 transition-all duration-300 hover:border-border hover:bg-card/70 hover:shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            {getStatusBadge()}
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {getDuration()}
            </span>
          </div>

          <h3 className="text-lg font-semibold text-foreground mb-1 truncate">
            {session.task?.title || 'Untitled Session'}
          </h3>
          
          <p className="text-sm text-muted-foreground mb-3">
            Started {formatDistanceToNow(new Date(session.start_time), { addSuffix: true })}
          </p>

          {session.summary && (
            <p className="text-sm text-secondary-foreground line-clamp-2 mb-3">
              {session.summary}
            </p>
          )}

          {session.next_steps && session.next_steps.length > 0 && (
            <div className="text-sm">
              <span className="text-muted-foreground">Next: </span>
              <span className="text-primary">{session.next_steps[0]}</span>
            </div>
          )}
        </div>

        <Link to={`/session/${session.id}`}>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/20 hover:text-primary"
          >
            {session.status === 'active' ? (
              <Play className="h-5 w-5" />
            ) : (
              <ArrowRight className="h-5 w-5" />
            )}
          </Button>
        </Link>
      </div>

      {session.status === 'active' && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-primary" />
      )}
    </div>
  );
}
