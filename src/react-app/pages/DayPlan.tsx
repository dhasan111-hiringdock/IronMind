import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { WorkoutPlan } from '@/shared/types';
import { ArrowLeft } from 'lucide-react';

export default function DayPlanPage() {
  const navigate = useNavigate();
  const { date } = useParams();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!date) {
        setError('Invalid date');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/workout/by_date?date=${date}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error || 'No plan for this date');
          return;
        }
        setPlan(data.data);
      } catch {
        setError('Failed to load plan');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [date]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading plan...</div>
      </div>
    );
  }

  return (
    <div className="app-bg">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-white/70 hover:text-white mb-4 transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-white">
            {date ? new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Plan'}
          </h1>
          <p className="text-white/60">Scheduled workout overview</p>
        </header>

        {error ? (
          <div className="card-glass p-6">
            <p className="text-fuchsia-300">{error}</p>
          </div>
        ) : plan ? (
          <div className="card-glass p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-white/80">
                <p className="text-sm">Focus</p>
                <p className="text-white font-medium">{plan.focus_label}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-white/70">Estimated Duration</p>
                <p className="text-white font-medium">{plan.estimated_duration_minutes} min</p>
              </div>
            </div>
            <div>
              <button
                onClick={async () => {
                  if (!date) return;
                  try {
                    setStarting(true);
                    const res = await fetch('/api/session/start_for_date', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ date }),
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                      navigate('/today');
                      return;
                    }
                    alert(data.error || 'Failed to start session');
                  } catch {
                    alert('Network error while starting session');
                  } finally {
                    setStarting(false);
                  }
                }}
                disabled={starting}
                className="inline-flex items-center gap-2 px-4 py-2 btn-primary disabled:opacity-50"
              >
                {starting ? 'Starting...' : 'Start Session'}
              </button>
            </div>

            {plan.targetMuscles && plan.targetMuscles.length > 0 && (
              <div>
                <p className="text-white/70 text-sm mb-1">Target Muscles</p>
                <p className="text-white text-sm">{plan.targetMuscles.join(', ')}</p>
              </div>
            )}

            <div>
              <p className="text-white/70 text-sm mb-2">Exercises</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {plan.exercises.map((ex, idx) => (
                  <div key={idx} className="border border-white/10 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-white font-medium text-sm">{ex.exercise_name}</p>
                      <p className="text-white/70 text-xs">
                        {ex.sets}x{ex.reps}
                      </p>
                    </div>
                    <p className="text-white/60 text-xs">
                      Rest {ex.rest_seconds}s · Load {ex.load_kg ?? '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="card-glass p-6">
            <p className="text-white/70">No plan available</p>
          </div>
        )}
      </div>
    </div>
  );
}
