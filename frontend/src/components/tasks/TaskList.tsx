import { Task } from '@/types/flowpilot';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Play, ExternalLink, Github, FileText } from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  onStartSession?: (taskId: string) => void;
  onToggleComplete?: (taskId: string, completed: boolean) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelect?: (taskId: string) => void;
}

export function TaskList({
  tasks,
  onStartSession,
  onToggleComplete,
  selectable,
  selectedIds = [],
  onSelect,
}: TaskListProps) {
  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low':
        return 'bg-success/20 text-success border-success/30';
      case 'medium':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'high':
        return 'bg-destructive/20 text-destructive border-destructive/30';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-secondary/50 mb-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No Tasks</h3>
        <p className="text-sm text-muted-foreground">
          Add tasks to start planning your day
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className={`group flex items-center gap-4 rounded-lg border p-4 transition-all duration-200 ${
            task.status === 'completed'
              ? 'border-border/30 bg-secondary/20 opacity-60'
              : 'border-border/50 bg-card/50 hover:border-border hover:bg-card/70'
          } ${selectedIds.includes(task.id) ? 'border-primary/50 bg-primary/5' : ''}`}
        >
          {selectable && onSelect && (
            <Checkbox
              checked={selectedIds.includes(task.id)}
              onCheckedChange={() => onSelect(task.id)}
              className="shrink-0"
            />
          )}

          {onToggleComplete && (
            <Checkbox
              checked={task.status === 'completed'}
              onCheckedChange={(checked) => onToggleComplete(task.id, checked as boolean)}
              className="shrink-0"
            />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4
                className={`font-medium truncate ${
                  task.status === 'completed' ? 'line-through text-muted-foreground' : ''
                }`}
              >
                {task.title}
              </h4>
              {task.source === 'github' && (
                <Github className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs ${getComplexityColor(task.estimated_complexity)}`}
              >
                {task.estimated_complexity}
              </Badge>
              {task.labels?.map((label) => (
                <Badge key={label} variant="secondary" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {task.url && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100"
                asChild
              >
                <a href={task.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
            {onStartSession && task.status !== 'completed' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:bg-primary/20 hover:text-primary"
                onClick={() => onStartSession(task.id)}
              >
                <Play className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
