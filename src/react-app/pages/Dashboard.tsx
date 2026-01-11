import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Dumbbell, Play, RefreshCw, ArrowRight, ArrowLeft, Target, LogOut } from 'lucide-react';
import type { WorkoutPlan, MuscleRecoveryStatus } from '@/shared/types';
import { MuscleThumbnail, getMuscleGroupFromLabel } from '@/react-app/components/Body3D';
import { getWarmupCooldownForTargets } from '@/shared/warmup-cooldown';

export default function DashboardPage() {
  const focusMap: Record<string, string> = {
    'incline dumbbell curl': 'Biceps brachii (long head)',
    'barbell curl': 'Biceps brachii',
    'cable curl': 'Biceps brachii',
    'hammer curl': 'Brachialis and brachioradialis',
    'bench press': 'Pectoralis major',
    'dumbbell bench press': 'Pectoralis major',
    'incline dumbbell press': 'Pectoralis major (clavicular head)',
    'dumbbell fly': 'Pectoralis major',
    'cable crossover': 'Pectoralis major',
    'close-grip bench press': 'Triceps brachii',
    'skull crusher': 'Triceps brachii (long head)',
    'overhead triceps extension': 'Triceps brachii (long head)',
    'cable triceps pushdown': 'Triceps brachii (lateral head)',
    'barbell row': 'Latissimus dorsi',
    'seated cable row': 'Middle trapezius and rhomboids',
    'lat pulldown': 'Latissimus dorsi',
    'face pull': 'Posterior deltoid and rotator cuff',
    'back squat': 'Quadriceps (vastus lateralis, medialis)',
    'leg press': 'Quadriceps',
    'lunge': 'Quadriceps and gluteus maximus',
    'leg extension': 'Quadriceps (rectus femoris)',
    'hanging leg raise': 'Rectus abdominis (lower)',
    'cable crunch': 'Rectus abdominis',
    'plank': 'Transverse abdominis',
    'ab wheel rollout': 'Rectus abdominis (anti-extension)',
    'incline push-ups': 'Pectoralis major (clavicular head)',
    'bodyweight lunges': 'Quadriceps and gluteus maximus',
  };
  const normalizeName = (s: string) => s.toLowerCase().trim();
  const labelFromPrimary = (muscles: string[]) => {
    const m = muscles[0]?.toLowerCase() || '';
    if (m.includes('bicep')) return 'Biceps brachii';
    if (m.includes('tricep')) return 'Triceps brachii';
    if (m.includes('chest') || m.includes('pect')) return 'Pectoralis major';
    if (m.includes('back') || m.includes('lat')) return 'Latissimus dorsi';
    if (m.includes('quad') || m.includes('quadriceps')) return 'Quadriceps';
    if (m.includes('hamstring')) return 'Hamstrings';
    if (m.includes('glute')) return 'Gluteus maximus';
    if (m.includes('calf')) return 'Gastrocnemius and soleus';
    if (m.includes('abs') || m.includes('core')) return 'Rectus abdominis';
    if (m.includes('shoulder') || m.includes('deltoid')) return 'Deltoid (anterior/posterior)';
    return muscles.join(', ');
  };
  const specificFocus = (ex: { exercise_name: string; primary_muscles: string[]; primaryMuscle?: string }) => {
    const key = normalizeName(ex.exercise_name);
    return focusMap[key] || ex.primaryMuscle || labelFromPrimary(ex.primary_muscles);
  };
  const instructionMap: Record<string, { steps: string[]; cues: string[] }> = {
    'bench press': {
      steps: [
        'Lie on bench, feet planted and eyes under bar',
        'Grip slightly wider than shoulders, wrists straight',
        'Unrack, lower to mid-chest with elbows ~45°',
        'Pause lightly, press bar up and slightly back',
        'Keep shoulder blades retracted throughout',
      ],
      cues: ['Brace core', 'Scapula back and down', 'Touch chest, no bounce', 'Full lockout'],
    },
    'incline dumbbell press': {
      steps: [
        'Set bench to 30–45° incline',
        'Start dumbbells over shoulders, palms forward',
        'Lower to upper chest, elbows ~45°',
        'Press up, bring bells slightly together',
      ],
      cues: ['Don’t flare elbows', 'Neutral wrist', 'Slow 2–3s lower', 'Squeeze at top'],
    },
    'dumbbell bench press': {
      steps: [
        'Lie flat, dumbbells over chest',
        'Lower to chest with controlled elbows',
        'Press up to full extension',
      ],
      cues: ['Scapula set', 'No bouncing', 'Even path each side'],
    },
    'barbell row': {
        steps: [
          'Hinge to ~45° torso, bar over mid-foot',
          'Grip just outside shoulders',
          'Row to lower chest/upper abs',
          'Control down without losing hinge',
        ],
        cues: ['Neutral spine', 'Drive elbows back', 'No jerking', 'Keep bar close'],
    },
    'seated cable row': {
      steps: [
        'Sit tall, slight lean',
        'Pull handle to navel while squeezing shoulder blades',
        'Control forward to full stretch',
      ],
      cues: ['Chest up', 'Elbows track close', 'No shrugging'],
    },
    'lat pulldown': {
      steps: [
        'Grip just outside shoulders',
        'Pull bar to upper chest',
        'Keep torso mostly upright',
        'Control up to full stretch',
      ],
      cues: ['Drive elbows down', 'Don’t lean excessively', 'Avoid wrist bending'],
    },
    'face pull': {
      steps: [
        'Set rope at eye level',
        'Pull to face, elbows high',
        'Rotate thumbs back to ears',
      ],
      cues: ['Light weight', 'Squeeze rear delts', 'No lower back arch'],
    },
    'incline dumbbell curl': {
      steps: [
        'Set bench 45°, let arms hang',
        'Curl without moving upper arm',
        'Squeeze at top, control down',
      ],
      cues: ['Elbows stay behind torso', 'No swinging', 'Slow eccentric'],
    },
    'barbell curl': {
      steps: ['Stand tall, bar at thighs', 'Curl bar while keeping elbows near sides', 'Control down to full extension'],
      cues: ['No back swing', 'Wrists neutral', 'Full ROM'],
    },
    'hammer curl': {
      steps: ['Neutral grip', 'Curl keeping elbows close', 'Control down'],
      cues: ['No shoulder sway', 'Slow lower', 'Squeeze forearms'],
    },
    'cable curl': {
      steps: ['Stand tall, elbows pinned', 'Curl handle to chin', 'Control down'],
      cues: ['Constant tension', 'No swinging', 'Full stretch'],
    },
    'close-grip bench press': {
      steps: ['Hands shoulder-width', 'Elbows tuck ~30–45°', 'Lower to lower chest', 'Press to lockout'],
      cues: ['Scapula set', 'No flare', 'Controlled tempo'],
    },
    'skull crusher': {
      steps: ['Lie flat, arms vertical', 'Lower to forehead or behind head', 'Press to full extension'],
      cues: ['Elbows stay in', 'No shoulder movement', 'Light load first'],
    },
    'overhead triceps extension': {
      steps: ['Arms overhead', 'Lower behind head', 'Extend to lockout'],
      cues: ['Ribs down', 'Elbows in', 'Controlled stretch'],
    },
    'cable triceps pushdown': {
      steps: ['Elbows pinned', 'Press handle down', 'Full extension and controlled return'],
      cues: ['No shoulder sway', 'Neutral wrist', 'Squeeze triceps'],
    },
    'back squat': {
      steps: ['Feet shoulder-width', 'Brace, sit back and down', 'Knees track over toes', 'Stand up driving mid-foot'],
      cues: ['Neutral spine', 'Depth to parallel', 'No knee cave', 'Brace hard'],
    },
    'leg press': {
      steps: ['Feet mid-sled', 'Lower to ~90° knee bend', 'Press without locking knees hard'],
      cues: ['Mid-foot pressure', 'No hips tilt', 'Controlled tempo'],
    },
    'lunge': {
      steps: ['Step forward', 'Lower until rear knee near floor', 'Push back through front leg'],
      cues: ['Torso tall', 'Knee over toes', 'Balance steady'],
    },
    'leg extension': {
      steps: ['Adjust pad above ankle', 'Extend knees to full squeeze', 'Control down slowly'],
      cues: ['No swing', 'Don’t lock hard', 'Full quad squeeze'],
    },
    'hanging leg raise': {
      steps: ['Hang tall', 'Tilt pelvis, raise legs to 90°', 'Control down'],
      cues: ['No momentum', 'Posterior tilt first', 'Core tight'],
    },
    'cable crunch': {
      steps: ['Kneel with rope', 'Crunch by rounding spine', 'Control up to neutral'],
      cues: ['Elbows down', 'No hip flexion', 'Feel abs'],
    },
    'plank': {
      steps: ['Elbows under shoulders', 'Body straight line', 'Hold with steady breathing'],
      cues: ['Glutes tight', 'Ribs down', 'No hip sag'],
    },
    'ab wheel rollout': {
      steps: ['Kneel, wheel under shoulders', 'Roll forward keeping core tight', 'Return by pulling through abs'],
      cues: ['No lumbar arch', 'Small range at first', 'Control tempo'],
    },
    'incline push-ups': {
      steps: ['Hands on bench', 'Lower chest to edge', 'Press to lockout'],
      cues: ['Elbows ~45°', 'Scapula set', 'Straight body'],
    },
    'bodyweight lunges': {
      steps: ['Step forward', 'Lower under control', 'Return to start'],
      cues: ['Torso tall', 'Knee tracks', 'Balance steady'],
    },
  };
  const instructionsFor = (ex: { exercise_name: string }) => {
    const key = normalizeName(ex.exercise_name);
    return (
      instructionMap[key] || {
        steps: ['Set up safely', 'Move through full range', 'Control tempo', 'Breathe and brace'],
        cues: ['Neutral spine', 'No bouncing', 'Slow eccentric', 'Stable base'],
      }
    );
  };
  const navigate = useNavigate();
  const [todayWorkout, setTodayWorkout] = useState<WorkoutPlan | null>(null);
  const [recoveryStatus, setRecoveryStatus] = useState<MuscleRecoveryStatus[]>([]);
  const [volumeData, setVolumeData] = useState<{ total_completed: number; total_target: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<null | {
    skip_detected: boolean;
    recommended_action: 'PERFORM_SKIPPED' | 'MAINTENANCE' | 'CONTINUE';
    reason: string;
    volume_reduction_percentage?: number;
  }>(null);
  const [scheduleOverride, setScheduleOverride] = useState<null | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY'>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [attendance, setAttendance] = useState<Set<string>>(new Set());
  const [summaryByDate, setSummaryByDate] = useState<Map<string, { sessions: number; minutes: number }>>(new Map());
  const [monthTotals, setMonthTotals] = useState<{ sessions: number; minutes: number; longestStreak: number; currentStreak: number } | null>(null);
  const [weekPlan, setWeekPlan] = useState<{ week_start: string; days: Array<{ date: string; planned: boolean; plan?: WorkoutPlan }> } | null>(null);
  const daysOfWeek = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const monthLabel = (() => {
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${monthNames[calendarMonth.getMonth()]} ${calendarMonth.getFullYear()}`;
  })();

  useEffect(() => {
    loadDashboardData();
  }, []);
  const loadAttendanceForMonth = useCallback(async () => {
    const start = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).toISOString().split('T')[0];
    const end = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).toISOString().split('T')[0];
    try {
      const r = await fetch(`/api/sessions/attendance?start=${start}&end=${end}`);
      const data = await r.json();
      if (data.success) {
        const visited = new Set<string>((data.data?.dates ?? []) as string[]);
        setAttendance(visited);
        const summary = new Map<string, { sessions: number; minutes: number }>();
        for (const d of visited) {
          summary.set(d, { sessions: 1, minutes: 0 });
        }
        setSummaryByDate(summary);
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let longest = 0;
        let streak = 0;
        for (let day = 1; day <= daysInMonth; day++) {
          const key = new Date(year, month, day).toISOString().split('T')[0];
          if (visited.has(key)) {
            streak += 1;
            if (streak > longest) longest = streak;
          } else {
            streak = 0;
          }
        }
        let currentStreak = 0;
        for (let day = daysInMonth; day >= 1; day--) {
          const key = new Date(year, month, day).toISOString().split('T')[0];
          if (visited.has(key)) {
            currentStreak += 1;
          } else {
            break;
          }
        }
        setMonthTotals({ sessions: visited.size, minutes: 0, longestStreak: longest, currentStreak });
      }
    } catch {
      void 0;
    }
  }, [calendarMonth]);
  useEffect(() => {
    loadAttendanceForMonth();
  }, [loadAttendanceForMonth]);
  useEffect(() => {
    const handler = () => {
      loadAttendanceForMonth();
    };
    const h = handler as unknown as EventListener;
    window.addEventListener('ironmind:attendanceUpdated', h);
    return () => {
      window.removeEventListener('ironmind:attendanceUpdated', h);
    };
  }, [loadAttendanceForMonth]);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      navigate('/login');
    }
  };
  const buildMonthDays = () => {
    const firstDayIdx = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const prevMonthDays = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 0).getDate();
    const cells: Array<{ date: Date; inMonth: boolean; key: string }> = [];
    for (let i = 0; i < firstDayIdx; i++) {
      const d = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, prevMonthDays - firstDayIdx + i + 1);
      cells.push({ date: d, inMonth: false, key: d.toISOString().split('T')[0] });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
      cells.push({ date: d, inMonth: true, key: d.toISOString().split('T')[0] });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      cells.push({ date: d, inMonth: false, key: d.toISOString().split('T')[0] });
    }
    return cells;
  };
  const prevMonth = () => {
    setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  };
  const intensityAlpha = (key: string) => {
    return attendance.has(key) ? 0.32 : 0.05;
  };
  const getWeekStart = (d: Date): Date => {
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const base = new Date(d);
    base.setDate(d.getDate() + diff);
    base.setHours(0, 0, 0, 0);
    return base;
  };
  const loadWeekPlan = async (date: Date) => {
    const start = getWeekStart(date);
    const startStr = start.toISOString().split('T')[0];
    try {
      const res = await fetch(`/api/workout/week?start=${startStr}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setWeekPlan(data.data);
      }
    } catch {
      void 0;
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch today's workout
      const workoutRes = await fetch('/api/workout/today');
      if (workoutRes.ok) {
        const workoutData = await workoutRes.json();
        if (workoutData.success) {
          setTodayWorkout(workoutData.data);
          setRecommendation(null);
        }
      }

      // Fetch recovery status
      const recoveryRes = await fetch('/api/recovery/status');
      if (recoveryRes.ok) {
        const recoveryData = await recoveryRes.json();
        if (recoveryData.success) {
          setRecoveryStatus(recoveryData.data);
        }
      }

      // Fetch volume data
      const volumeRes = await fetch('/api/training/volume');
      if (volumeRes.ok) {
        const volumeDataRes = await volumeRes.json();
        if (volumeDataRes.success) {
          setVolumeData(volumeDataRes.data);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateWorkout = async () => {
    try {
      setGenerating(true);
      setError(null);

      const response = await fetch('/api/workout/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleOverride ? { schedule_override: scheduleOverride } : {}),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to generate workout');
        return;
      }

      setRecommendation(data.recommendation ?? null);
      try {
        const todayRes = await fetch('/api/workout/today');
        if (todayRes.ok) {
          const todayData = await todayRes.json();
          if (todayData.success) {
            setTodayWorkout(todayData.data);
          }
        }
      } catch (e) {
        console.error('Failed to refresh today workout:', e);
        setTodayWorkout(data.data);
      }
    } catch (err) {
      setError('Network error while generating workout');
      console.error('Generate workout error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const getRecoveryStatusColor = (status: string) => {
    switch (status) {
      case 'READY':
        return 'text-cyan-500';
      case 'PARTIAL':
        return 'text-orange-400';
      case 'BLOCKED':
        return 'text-fuchsia-500';
      default:
        return 'text-slate-400';
    }
  };
  const getRecommendationConfig = (action: 'PERFORM_SKIPPED' | 'MAINTENANCE' | 'CONTINUE') => {
    switch (action) {
      case 'PERFORM_SKIPPED':
        return {
          color: 'text-emerald-500',
          bgColor: 'bg-emerald-500/20',
          borderColor: 'border-emerald-500/50',
        };
      case 'MAINTENANCE':
        return {
          color: 'text-cyan-500',
          bgColor: 'bg-cyan-500/20',
          borderColor: 'border-cyan-500/50',
        };
      case 'CONTINUE':
        return {
          color: 'text-slate-300',
          bgColor: 'bg-slate-500/20',
          borderColor: 'border-slate-500/40',
        };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="app-bg">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="brand-chip">
                <Dumbbell className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white">IronMind</h1>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-1.5 btn-secondary text-sm"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
          <p className="text-white/60">Your training dashboard</p>
        </header>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-fuchsia-500/20 border border-fuchsia-500/50 rounded-xl p-4">
            <p className="text-fuchsia-300">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Workout Card */}
          <div className="lg:col-span-2 card-glass p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-white">Today's Workout</h2>
              {todayWorkout && (
                <button
                  onClick={generateWorkout}
                  disabled={generating}
                  className="flex items-center gap-2 px-3 py-1.5 btn-secondary text-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setScheduleOverride('MONDAY')}
                className={`px-2 py-1 rounded ${scheduleOverride === 'MONDAY' ? 'bg-indigo-500 text-white' : 'btn-secondary'}`}
              >
                Mon
              </button>
              <button
                onClick={() => setScheduleOverride('TUESDAY')}
                className={`px-2 py-1 rounded ${scheduleOverride === 'TUESDAY' ? 'bg-indigo-500 text-white' : 'btn-secondary'}`}
              >
                Tue
              </button>
              <button
                onClick={() => setScheduleOverride('WEDNESDAY')}
                className={`px-2 py-1 rounded ${scheduleOverride === 'WEDNESDAY' ? 'bg-indigo-500 text-white' : 'btn-secondary'}`}
              >
                Wed
              </button>
            </div>

            {!todayWorkout ? (
                <div className="text-center py-12">
                  <p className="text-white/70 mb-6">No workout generated yet</p>
                  <div className="flex flex-col items-center gap-3">
                    <button
                      onClick={generateWorkout}
                      disabled={generating}
                      className="inline-flex items-center gap-2 px-6 py-3 btn-primary font-medium disabled:opacity-50"
                    >
                      {generating ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          Generating...
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5" />
                        Generate Workout
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => navigate('/today')}
                    className="text-white/80 hover:text-white text-sm transition-colors"
                  >
                    View today's workout page →
                  </button>
                  <button
                    onClick={() => navigate('/select-muscle')}
                    className="text-fuchsia-400 hover:text-fuchsia-300 text-sm transition-colors flex items-center gap-1"
                  >
                    <Target className="w-3 h-3" />
                    Or select specific muscle →
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {recommendation && (() => {
                  const cfg = getRecommendationConfig(recommendation.recommended_action);
                  return (
                    <div className={`${cfg.bgColor} ${cfg.borderColor} border rounded-lg p-4`}>
                      <div className="flex items-center gap-2">
                        <Target className={`w-5 h-5 ${cfg.color}`} />
                        <p className={`font-medium ${cfg.color}`}>
                          Recommendation: {recommendation.recommended_action.replace('_', ' ')}
                        </p>
                      </div>
                      <p className="text-white/70 text-sm mt-1">{recommendation.reason}</p>
                    </div>
                  );
                })()}
                {/* Workout Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white/10 rounded-lg p-4">
                  <div>
                    <p className="text-slate-400 text-sm">Duration</p>
                    <p className="text-white font-semibold text-lg">{todayWorkout.estimated_duration_minutes} min</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Exercises</p>
                    <p className="text-white font-semibold text-lg">{todayWorkout.exercises.length}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Focus</p>
                    <p className={`font-semibold text-lg ${
                      todayWorkout.focus_label === 'NORMAL' ? 'text-indigo-500' :
                      todayWorkout.focus_label === 'REDUCED' ? 'text-cyan-500' :
                      'text-blue-500'
                    }`}>
                      {todayWorkout.focus_label}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Status</p>
                    <p className="text-cyan-500 font-semibold text-lg capitalize">{todayWorkout.status.toLowerCase()}</p>
                  </div>
                </div>
                <div className="mt-3 bg-white/10 rounded-lg p-4">
                  <p className="text-slate-400 text-sm">Target Muscles</p>
                  <p className="text-white font-semibold text-lg">{(todayWorkout.targetMuscles ?? []).join(', ') || '—'}</p>
                </div>
                <div className="mt-3 bg-white/10 rounded-lg p-4">
                  <p className="text-white font-semibold mb-2">Warm-Up & Cool-Down</p>
                  {(() => {
                    const plan = getWarmupCooldownForTargets(todayWorkout.targetMuscles ?? []);
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                          <p className="text-white/80 text-sm mb-1">Warm-Up</p>
                          <ul className="list-disc list-inside text-white/70 text-xs">
                            {plan.warmup.slice(0, 3).map((item, idx) => (
                              <li key={`dw-wu-${idx}`}>{item.title} {item.duration ? `(${item.duration})` : item.reps ? `(${item.reps})` : ''}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                          <p className="text-white/80 text-sm mb-1">Cool-Down</p>
                          <ul className="list-disc list-inside text-white/70 text-xs">
                            {plan.cooldown.slice(0, 3).map((item, idx) => (
                              <li key={`dw-cd-${idx}`}>{item.title} {item.duration ? `(${item.duration})` : item.reps ? `(${item.reps})` : ''}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Exercise List */}
                <div className="space-y-3">
                  {todayWorkout.exercises.map((exercise, idx) => (
                    <div
                      key={idx}
                      className={`bg-white/10 rounded-lg p-4 hover:bg-white/20 transition-colors ${
                        exercise.is_superset ? 'border-l-4 border-violet-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-white font-medium">{exercise.exercise_name}</h3>
                            {exercise.is_superset && (
                              <span className="px-2 py-0.5 bg-violet-500/20 text-violet-300 text-xs rounded">
                                Superset
                              </span>
                            )}
                            {exercise.has_drop_set && (
                              <span className="px-2 py-0.5 bg-pink-500/20 text-pink-300 text-xs rounded">
                                Drop Set
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 text-xs rounded">
                              {exercise.primary_muscles.join(', ')}
                            </span>
                            {Array.isArray(exercise.secondaryMuscles) && exercise.secondaryMuscles.length > 0 && (
                              <span className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs rounded">
                                {exercise.secondaryMuscles.join(', ')}
                              </span>
                            )}
                          </div>
                          {(() => {
                            const focusText = specificFocus(exercise);
                            const group = getMuscleGroupFromLabel(focusText, exercise.primary_muscles);
                            return (
                              <p className="mt-1">
                                <span className="inline-flex items-center gap-3">
                                  <span className="rounded-xl p-1 bg-white/5 border border-white/10 ring-2 ring-indigo-400/60">
                                    <MuscleThumbnail group={group} className="w-16 h-16" />
                                  </span>
                                  <span className="text-white/80 text-sm">Focus: {focusText}</span>
                                </span>
                              </p>
                            );
                          })()}
                          {(() => {
                            const info = instructionsFor(exercise);
                            const videoUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise.exercise_name} form`)}`;
                            return (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-white/80 text-xs">
                                  How to perform
                                </summary>
                                <div className="mt-2 bg-white/5 rounded-lg p-3 border border-white/10">
                                  <p className="text-white/70 text-xs mb-1">Steps</p>
                                  <ul className="list-disc list-inside text-white/80 text-xs">
                                    {info.steps.map((s, i) => (
                                      <li key={i}>{s}</li>
                                    ))}
                                  </ul>
                                  <p className="text-white/70 text-xs mt-2 mb-1">Form cues</p>
                                  <ul className="list-disc list-inside text-white/80 text-xs">
                                    {info.cues.map((s, i) => (
                                      <li key={i}>{s}</li>
                                    ))}
                                  </ul>
                                  <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-indigo-400 hover:text-indigo-300 text-xs">
                                    Watch video guide
                                  </a>
                                </div>
                              </details>
                            );
                          })()}
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-indigo-500 font-semibold">
                            {exercise.sets} × {exercise.reps}
                          </p>
                          <p className="text-white/60 text-xs">
                            {exercise.rest_seconds}s rest
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* View Details Button */}
                <button
                  onClick={() => navigate('/today')}
                  className="w-full btn-primary py-4 font-semibold transition-all flex items-center justify-center gap-2"
                >
                  View Full Workout
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recovery Status Card */}
            <div className="card-glass p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Recovery Status</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {[...recoveryStatus].sort((a, b) => {
                  const order = (s: string) => (s === 'READY' ? 0 : s === 'PARTIAL' ? 1 : 2);
                  return order(a.status) - order(b.status);
                }).map((muscle, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2">
                    <span className="text-white/70 text-sm">{muscle.muscle_name}</span>
                    <div className="text-right">
                      <span className={`text-xs font-medium ${getRecoveryStatusColor(muscle.status)}`}>
                        {muscle.status}
                      </span>
                      {muscle.hours_until_ready > 0 && (
                        <p className="text-white/60 text-xs">
                          {muscle.hours_until_ready}h until ready
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly Progress Card */}
            <div className="card-glass p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Weekly Progress</h2>
              {volumeData && (
                <>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/70 text-sm">Total Volume</span>
                      <span className="text-white font-medium">
                        {volumeData.total_completed} / {volumeData.total_target} sets
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (volumeData.total_completed / volumeData.total_target) * 100)}%`,
                          backgroundImage: 'linear-gradient(to right, #22d3ee, #60a5fa, #6366f1)',
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-white/70 text-sm">
                    {Math.round((volumeData.total_completed / volumeData.total_target) * 100)}% complete
                  </p>
                </>
              )}
            </div>
            <div className="card-glass p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Attendance Calendar</h2>
                <div className="flex items-center gap-2">
                  <button onClick={prevMonth} className="p-2 btn-secondary">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button onClick={nextMonth} className="p-2 btn-secondary">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-white/70 text-sm mb-1">{monthLabel}</p>
              {monthTotals && (
                <p className="text-white/60 text-xs mb-3">
                  {monthTotals.sessions} sessions · {monthTotals.minutes} min · Longest streak {monthTotals.longestStreak}d · Current streak {monthTotals.currentStreak}d
                </p>
              )}
              <div className="grid grid-cols-7 gap-2 text-center">
                {daysOfWeek.map((d) => (
                  <div key={d} className="text-white/60 text-xs">{d}</div>
                ))}
                {buildMonthDays().map(({ date, inMonth, key }) => {
                  const visited = attendance.has(key);
                  const isToday = key === new Date().toISOString().split('T')[0];
                  const isFuture = date > new Date();
                  const base = inMonth ? 'text-white' : 'text-white/40';
                  const todayBorder = isToday ? 'ring-2 ring-indigo-400/70' : '';
                  const bgStyle = visited ? { backgroundColor: `rgba(34,197,94, ${intensityAlpha(key)})` } : { backgroundColor: 'rgba(255,255,255,0.05)' };
                  const title = visited ? `${summaryByDate.get(key)?.minutes || 0} min` : undefined;
                  return (
                    <div
                      key={key}
                      className={`relative border border-white/10 rounded-md py-2 ${todayBorder} ${isFuture ? 'cursor-pointer hover:bg-white/20' : ''}`}
                      style={bgStyle}
                      title={title}
                      onClick={isFuture ? () => loadWeekPlan(date) : undefined}
                    >
                      <span className={`text-xs ${base}`}>{date.getDate()}</span>
                      {visited && (
                        <span className="absolute right-1 bottom-1 w-2 h-2 rounded-full bg-green-400"></span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {weekPlan && (
              <div className="card-glass p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-semibold text-white">Week Plan</h2>
                  <p className="text-white/70 text-sm">Week of {weekPlan.week_start}</p>
                </div>
                <div className="space-y-3">
                  {weekPlan.days.map((d) => (
                    <div key={d.date} className="border border-white/10 rounded-md p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-white/80 text-sm">
                          {new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className={`text-xs font-medium ${d.planned ? 'text-cyan-400' : 'text-white/60'}`}>
                          {d.planned ? 'Planned' : 'Rest'}
                        </span>
                      </div>
                      {d.planned && d.plan && (
                        <div className="mt-2 text-white/80 text-sm">
                          <p className="mb-1">Focus: {d.plan.focus_label}</p>
                          <p className="mb-1">Targets: {(d.plan.targetMuscles || []).join(', ')}</p>
                          <p className="mb-1">Exercises: {d.plan.exercises.length} · {d.plan.estimated_duration_minutes} min</p>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                            {d.plan.exercises.slice(0, 4).map((ex, idx) => (
                              <div key={idx} className="text-white/70 text-xs">
                                {ex.exercise_name} · {ex.sets}x{ex.reps}
                              </div>
                            ))}
                          </div>
                          <div className="mt-3">
                            <button
                              onClick={() => navigate(`/plan/${d.date}`)}
                              className="px-3 py-1.5 btn-secondary text-xs"
                            >
                              View Day Plan
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
