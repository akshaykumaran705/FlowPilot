import { FocusBlock, Task } from '@/types/flowpilot';
import { FocusBlockCard } from './FocusBlockCard';

interface TimelineViewProps {
  blocks: FocusBlock[];
  tasks: Task[];
  onStartSession: (taskId: string) => void;
}

export function TimelineView({ blocks, tasks, onStartSession }: TimelineViewProps) {
  const sortedBlocks = [...blocks].sort((a, b) => {
    const aTime = new Date(a.start_time).getTime();
    const bTime = new Date(b.start_time).getTime();
    return aTime - bTime;
  });

  const getCurrentBlockIndex = () => {
    const now = new Date();
    return sortedBlocks.findIndex((block) => {
      const start = new Date(block.start_time);
      const end = new Date(block.end_time);
      return now >= start && now < end;
    });
  };

  const currentBlockIndex = getCurrentBlockIndex();

  if (blocks.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-secondary/50 mb-4">
          <span className="text-4xl">📅</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">No Plan Yet</h3>
        <p className="text-muted-foreground">
          Click "Plan My Day" to generate your focus blocks
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-border to-transparent" />
      
      <div className="space-y-4 pl-10">
        {sortedBlocks.map((block, index) => (
          <div
            key={block.id}
            className="relative animate-slide-up"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {/* Timeline dot */}
            <div
              className={`absolute -left-10 top-6 h-3 w-3 rounded-full border-2 ${
                index === currentBlockIndex
                  ? 'border-primary bg-primary animate-pulse-glow'
                  : index < currentBlockIndex
                  ? 'border-muted-foreground bg-muted'
                  : 'border-border bg-background'
              }`}
            />
            
            <FocusBlockCard
              block={block}
              tasks={tasks}
              onStartSession={onStartSession}
              isCurrentBlock={index === currentBlockIndex}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
