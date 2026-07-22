import { useLocation } from 'wouter';
import { AlertTriangle, LockKeyhole, ServerCrash, RefreshCw, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { queryClient } from '@/lib/queryClient';

interface AdminErrorStateProps {
  error: Error | unknown;
  queryKey?: unknown[];
  className?: string;
}

function parseStatus(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const match = error.message.match(/^(\d{3}):/);
  return match ? parseInt(match[1], 10) : null;
}

export default function AdminErrorState({ error, queryKey, className = '' }: AdminErrorStateProps) {
  const [, navigate] = useLocation();
  const status = parseStatus(error);

  const is401 = status === 401;
  const is403 = status === 403;

  if (is401) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 gap-4 text-center ${className}`} data-testid="error-state-401">
        <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
          <LogIn className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
        </div>
        <div>
          <p className="font-semibold text-sm">Session Expired</p>
          <p className="text-xs text-muted-foreground mt-1">Your session has expired. Please sign in again to continue.</p>
        </div>
        <Button size="sm" onClick={() => {
          localStorage.removeItem('adminAuth');
          navigate('/admin/login');
        }}>
          Sign In Again
        </Button>
      </div>
    );
  }

  if (is403) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 gap-4 text-center ${className}`} data-testid="error-state-403">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <LockKeyhole className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <p className="font-semibold text-sm">Access Denied</p>
          <p className="text-xs text-muted-foreground mt-1">You don't have permission to access this resource. Contact your super admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center py-16 gap-4 text-center ${className}`} data-testid="error-state-generic">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <ServerCrash className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="font-semibold text-sm">Failed to Load</p>
        <p className="text-xs text-muted-foreground mt-1">
          {error instanceof Error ? error.message : 'An unexpected error occurred.'}
        </p>
      </div>
      {queryKey && (
        <Button size="sm" variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey })}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Try Again
        </Button>
      )}
    </div>
  );
}

export { parseStatus };
