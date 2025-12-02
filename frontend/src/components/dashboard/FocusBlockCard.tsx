import { FocusBlock, Task } from '@/types/flowpilot';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Clock, Zap, Coffee } from 'lucide-react';

interface FocusBlockCardProps {
  block: FocusBlock;
  tasks: Task[];
  onStartSession: (taskId: string) => void;
  isCurrentBlock?: boolean;
}

export function FocusBlockCard({ block, tasks, onStartSession, isCurrentBlock }: FocusBlockCardProps) {
  const formatTime = (time: string) => {
    const date = new Date(time);

    if (!Number.isNaN(date.getTime())) {
      const hour = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const formattedHour = hour % 12 || 12;
      return `${formattedHour}:${minutes} ${ampm}`;
    }

    // Fallback for non-ISO times like "09:00"
    const [rawHours, rawMinutes] = time.split(':');
    const hourFallback = parseInt(rawHours, 10) || 0;
    const minutesFallback = (rawMinutes ?? '00').padStart(2, '0');
    const ampmFallback = hourFallback >= 12 ? 'PM' : 'AM';
    const formattedHourFallback = hourFallback % 12 || 12;
    return `${formattedHourFallback}:${minutesFallback} ${ampmFallback}`;
  };

  const blockTasks = tasks.filter(t => block.task_ids?.includes(t.id));
  const isDeepWork = block.mode === 'DEEP_WORK';

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border transition-all duration-300 ${
        isCurrentBlock
          ? 'border-primary/50 bg-gradient-deep shadow-glow'
          : 'border-border/50 bg-card/50 hover:border-border hover:bg-card/70'
      }`}
    >
      {isCurrentBlock && (
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent animate-pulse" />
      )}
      
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <Badge
                variant="secondary"
                className={isDeepWork ? 'deep-work-indicator' : 'shallow-work-indicator'}
              >
                {isDeepWork ? (
                  <><Zap className="h-3 w-3 mr-1" /> Deep Work</>
                ) : (
                  <><Coffee className="h-3 w-3 mr-1" /> Shallow</>
                )}
              </Badge>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(block.start_time)} - {formatTime(block.end_time)}
              </span>
            </div>
            
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {block.label}
            </h3>
            
            {block.notes && (
              <p className="text-sm text-muted-foreground mb-3">
                {block.notes}
              </p>
            )}

            {blockTasks.length > 0 && (
              <div className="space-y-2 mt-4">
                {blockTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg bg-secondary/50 p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {task.estimated_complexity} complexity
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 ml-2 hover:bg-primary/20 hover:text-primary"
                      onClick={() => onStartSession(task.id)}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
