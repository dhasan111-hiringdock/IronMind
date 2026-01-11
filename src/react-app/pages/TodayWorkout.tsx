import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Dumbbell, Play, RefreshCw, Clock, Target, Zap, Pause, CheckCircle, StopCircle } from 'lucide-react';
import type { WorkoutPlan, GoalRealism } from '@/shared/types';
import { MuscleThumbnail, getMuscleGroupFromLabel } from '@/react-app/components/Body3D';
import { getWarmupCooldownForTargets } from '@/shared/warmup-cooldown';

/**
 * Today Screen - Daily Workout Generation Feature
 * 
 * FEATURE OVERVIEW:
 * Displays the automatically generated workout plan for today.
 * The system decides which muscles to train, which exercises to perform,
 * and all parameters (sets, reps, rest, intensity variations).
 * 
 * USER CANNOT:
 * - Browse exercises
 * - Manually select exercises
 * - Change the generated plan (only regenerate)
 * 
 * DISPLAYS:
 * - Ordered exercise list (compounds first, isolations later)
 * - Sets, reps, rest periods
 * - Training variations (supersets, drop sets)
 * - Workout focus label (NORMAL/REDUCED/MAINTENANCE)
 * - Estimated duration
 * - Target muscle groups
 * 
 * INTERACTIONS:
 * - Generate workout (if none exists)
 * - Regenerate workout (replaces current plan)
 * - Start workout (transitions to execution - not implemented yet)
 */
export default function TodayWorkoutPage() {
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
  const [workout, setWorkout] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [recommendation, setRecommendation] = useState<null | {
    skip_detected: boolean;
    recommended_action: 'PERFORM_SKIPPED' | 'MAINTENANCE' | 'CONTINUE';
    reason: string;
    volume_reduction_percentage?: number;
  }>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'executing' | 'paused' | 'completed'>('view');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0); // 0-based
  const [restRemaining, setRestRemaining] = useState<number>(0);
  const [restActive, setRestActive] = useState(false);
  const [restTimerHandle, setRestTimerHandle] = useState<number | null>(null);
  const [changing, setChanging] = useState(false);
  const [altMessage, setAltMessage] = useState<string | null>(null);
  const [showSkipReason, setShowSkipReason] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [undoing, setUndoing] = useState(false);
  const submitSkipRef = useRef<(() => Promise<void>) | null>(null);
  const [scheduleOverride, setScheduleOverride] = useState<null | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY'>(null);
  const [trainingBias, setTrainingBias] = useState<null | { rest_factor: number; volume_factor: number; reduce_intensity_techniques: boolean; realism: GoalRealism }>(null);
  const [goalAlignment, setGoalAlignment] = useState<null | { behind_schedule: boolean; suggested_extension_weeks: number | null; required_weekly_rate_kg: number | null }>(null);
  const [regenDiff, setRegenDiff] = useState<null | { added: string[]; removed: string[]; changed: Array<{ name: string; from: { sets: number; reps: number; rest: number }; to: { sets: number; reps: number; rest: number } }> }>(null);
  const [warmupDone, setWarmupDone] = useState<Set<string>>(new Set());

  const detectPairFromExercises = (exercises: WorkoutPlan['exercises']) => {
    let backBiceps = 0;
    let chestTriceps = 0;
    let legsAbs = 0;
    for (const ex of exercises) {
      for (const m of ex.primary_muscles) {
        if (m === 'BACK' || m === 'BICEPS') backBiceps++;
        if (m === 'CHEST' || m === 'TRICEPS') chestTriceps++;
        if (m === 'QUADRICEPS' || m === 'ABS' || m === 'HAMSTRINGS') legsAbs++;
      }
    }
    if (backBiceps >= chestTriceps && backBiceps >= legsAbs) return 'MONDAY' as const;
    if (chestTriceps >= backBiceps && chestTriceps >= legsAbs) return 'TUESDAY' as const;
    return 'WEDNESDAY' as const;
  };

  const swapMusclePair = async () => {
    const currentKey = workout ? detectPairFromExercises(workout.exercises) : (scheduleOverride ?? 'MONDAY');
    const nextKey = currentKey === 'MONDAY' ? 'TUESDAY' : currentKey === 'TUESDAY' ? 'WEDNESDAY' : 'MONDAY';
    setScheduleOverride(nextKey);
    await generateWorkout();
  };

  useEffect(() => {
    loadTodayWorkout();
  }, []);

  useEffect(() => {
    if (!workout?.id) {
      setWarmupDone(new Set());
      return;
    }
    try {
      const key = `warmup_done_${workout.id}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        setWarmupDone(new Set(arr));
      } else {
        setWarmupDone(new Set());
      }
    } catch {
      setWarmupDone(new Set());
    }
  }, [workout?.id]);
  const loadTodayWorkout = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/workout/today');
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setWorkout(data.data);
          setRecommendation(null);
          setTrainingBias(null);
          setGoalAlignment(null);
        }
      }
    } catch (err) {
      console.error('Failed to load workout:', err);
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
      setTrainingBias(data.training_bias ?? null);
      setGoalAlignment(data.goal_alignment ?? null);
      try {
        const prev = workout;
        const todayRes = await fetch('/api/workout/today');
        if (todayRes.ok) {
          const todayData = await todayRes.json();
          if (todayData.success) {
            setWorkout(todayData.data);
            setWarmupDone(new Set());
            try {
              const key = prev ? `warmup_done_${prev.id}` : null;
              if (key) {
                localStorage.removeItem(key);
              }
            } catch { void 0; }
            if (prev) {
              const prevNames = prev.exercises.map((e) => e.exercise_name);
              const nextNames = (todayData.data.exercises as typeof prev.exercises).map((e) => e.exercise_name);
              const added = nextNames.filter((n) => !prevNames.includes(n));
              const removed = prevNames.filter((n) => !nextNames.includes(n));
              const changed: Array<{ name: string; from: { sets: number; reps: number; rest: number }; to: { sets: number; reps: number; rest: number } }> = [];
              for (const name of nextNames) {
                const p = prev.exercises.find((e) => e.exercise_name === name);
                const n = (todayData.data.exercises as typeof prev.exercises).find((e) => e.exercise_name === name);
                if (p && n) {
                  if (p.sets !== n.sets || p.reps !== n.reps || p.rest_seconds !== n.rest_seconds) {
                    changed.push({
                      name,
                      from: { sets: p.sets, reps: p.reps, rest: p.rest_seconds },
                      to: { sets: n.sets, reps: n.reps, rest: n.rest_seconds },
                    });
                  }
                }
              }
              setRegenDiff({ added, removed, changed });
            } else {
              setRegenDiff(null);
            }
          }
        }
      } catch (e) {
        console.error('Failed to refresh workout after generation:', e);
        setWorkout(data.data);
        const prev = workout;
        setWarmupDone(new Set());
        try {
          const key = prev ? `warmup_done_${prev.id}` : null;
          if (key) {
            localStorage.removeItem(key);
          }
        } catch { void 0; }
        if (prev) {
          const prevNames = prev.exercises.map((e) => e.exercise_name);
          const nextNames = (data.data.exercises as typeof prev.exercises).map((e) => e.exercise_name);
          const added = nextNames.filter((n) => !prevNames.includes(n));
          const removed = prevNames.filter((n) => !nextNames.includes(n));
          const changed: Array<{ name: string; from: { sets: number; reps: number; rest: number }; to: { sets: number; reps: number; rest: number } }> = [];
          for (const name of nextNames) {
            const p = prev.exercises.find((e) => e.exercise_name === name);
            const n = (data.data.exercises as typeof prev.exercises).find((e) => e.exercise_name === name);
            if (p && n) {
              if (p.sets !== n.sets || p.reps !== n.reps || p.rest_seconds !== n.rest_seconds) {
                changed.push({
                  name,
                  from: { sets: p.sets, reps: p.reps, rest: p.rest_seconds },
                  to: { sets: n.sets, reps: n.reps, rest: n.rest_seconds },
                });
              }
            }
          }
          setRegenDiff({ added, removed, changed });
        } else {
          setRegenDiff(null);
        }
      }
    } catch (err) {
      setError('Network error while generating workout');
      console.error('Generate workout error:', err);
    } finally {
      setGenerating(false);
    }
  };

  // Start Execution: create session and lock plan
  const startExecution = async () => {
    if (!workout) return;
    try {
      const response = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workout_plan_id: workout.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to start session');
        return;
      }
      setSessionId(data.data.session_id);
      try {
        const key = `warmup_done_${workout.id}`;
        localStorage.removeItem(key);
      } catch { void 0; }
      setMode('executing');
      setCurrentExerciseIndex(0);
      setCurrentSetIndex(0);
      setRestRemaining(0);
      setRestActive(false);
    } catch (err) {
      setError('Network error while starting session');
      console.error('Start session error:', err);
    }
  };

  // Complete current set: enforce checklist order and auto-start rest timer
  const completeCurrentSet = async () => {
    if (!workout || sessionId == null) return;
    const ex = workout.exercises[currentExerciseIndex];
    const setNumber = currentSetIndex + 1;
    try {
      const response = await fetch('/api/session/complete_set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          exercise_id: ex.exercise_id,
          set_number: setNumber,
          reps_completed: ex.reps,
          load_kg: null,
          rpe: null,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to record set');
        return;
      }
      // Start rest timer deterministically
      const rest = Number(data.data.rest_seconds ?? ex.rest_seconds);
      setRestRemaining(rest);
      setRestActive(true);
      // Clear previous interval
      if (restTimerHandle) {
        window.clearInterval(restTimerHandle);
      }
      const handle = window.setInterval(() => {
        setRestRemaining((r) => {
          if (r <= 1) {
            window.clearInterval(handle);
            setRestTimerHandle(null);
            setRestActive(false);
            // Advance set/exercise when rest completes
            const nextSet = currentSetIndex + 1;
            if (nextSet < ex.sets) {
              setCurrentSetIndex(nextSet);
            } else {
              // Move to next exercise
              const nextEx = currentExerciseIndex + 1;
              if (nextEx < workout.exercises.length) {
                setCurrentExerciseIndex(nextEx);
                setCurrentSetIndex(0);
              } else {
                // All done; stay ready for finish
              }
            }
          }
          return r - 1;
        });
      }, 1000);
      setRestTimerHandle(handle);
    } catch (err) {
      setError('Network error while recording set');
      console.error('Complete set error:', err);
    }
  };

  // Pause/resume: freeze/unfreeze rest timer
  const togglePause = () => {
    if (mode === 'executing') {
      setMode('paused');
      if (restTimerHandle) {
        window.clearInterval(restTimerHandle);
        setRestTimerHandle(null);
      }
    } else if (mode === 'paused') {
      setMode('executing');
      if (restActive && restRemaining > 0) {
        const handle = window.setInterval(() => {
          setRestRemaining((r) => {
            if (r <= 1) {
              window.clearInterval(handle);
              setRestTimerHandle(null);
              setRestActive(false);
              const ex = workout!.exercises[currentExerciseIndex];
              const nextSet = currentSetIndex + 1;
              if (nextSet < ex.sets) {
                setCurrentSetIndex(nextSet);
              } else {
                const nextEx = currentExerciseIndex + 1;
                if (nextEx < workout!.exercises.length) {
                  setCurrentExerciseIndex(nextEx);
                  setCurrentSetIndex(0);
                } else {
                  // Completed; ready to finish
                }
              }
            }
            return r - 1;
          });
        }, 1000);
        setRestTimerHandle(handle);
      }
    }
  };

  // Finish session: commit completion; mark recovery/volume
  const finishSession = async () => {
    if (sessionId == null) return;
    try {
      const response = await fetch('/api/session/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to finish session');
        return;
      }
      setMode('completed');
    } catch (err) {
      setError('Network error while finishing session');
      console.error('Finish session error:', err);
    }
  };

  const changeCurrentExercise = async () => {
    if (!workout) return;
    try {
      setChanging(true);
      setError(null);
      const current = workout.exercises[currentExerciseIndex];
      const response = await fetch('/api/exercise/alternate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workout_plan_id: workout.id, current_exercise_id: current.exercise_id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to change exercise');
        setChanging(false);
        return;
      }
      setWorkout(data.data);
      const updated = (data.data.exercises as typeof workout.exercises)[currentExerciseIndex];
      setAltMessage(`Replaced with ${updated.exercise_name}`);
      setTimeout(() => setAltMessage(null), 3000);
    } catch {
      setError('Network error while changing exercise');
    } finally {
      setChanging(false);
    }
  };

  const skipCurrentExercise = () => {
    if (!workout) return;
    const proceed = () => {
      setAltMessage('Exercise skipped');
      setTimeout(() => setAltMessage(null), 2000);
      setRestActive(false);
      setRestRemaining(0);
      setCurrentSetIndex(0);
      const nextEx = currentExerciseIndex + 1;
      if (nextEx < workout.exercises.length) {
        setCurrentExerciseIndex(nextEx);
      } else {
        setMode('completed');
      }
    };
    if (sessionId != null) {
      const current = workout.exercises[currentExerciseIndex];
      setShowSkipReason(true);
      const submitSkip = async () => {
        try {
          await fetch('/api/session/skip_exercise', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, exercise_id: current.exercise_id, reason: skipReason || undefined }),
          });
        } finally {
          setShowSkipReason(false);
          setSkipReason('');
          proceed();
        }
      };
      submitSkipRef.current = submitSkip;
    } else {
      proceed();
    }
  };

  const undoSkip = async () => {
    if (!workout || sessionId == null) return;
    try {
      setUndoing(true);
      const current = workout.exercises[currentExerciseIndex];
      const response = await fetch('/api/session/unskip_exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, exercise_id: current.exercise_id }),
      });
      await response.json();
      setAltMessage('Skip undone');
      setTimeout(() => setAltMessage(null), 2000);
    } finally {
      setUndoing(false);
    }
  };

  const getFocusLabelConfig = (label: string) => {
    switch (label) {
      case 'NORMAL':
        return {
          color: 'text-indigo-500',
          bgColor: 'bg-indigo-500/20',
          borderColor: 'border-indigo-500/50',
          icon: Zap,
          description: 'Full intensity - Push your limits',
        };
      case 'REDUCED':
        return {
          color: 'text-cyan-500',
          bgColor: 'bg-cyan-500/20',
          borderColor: 'border-cyan-500/50',
          icon: Target,
          description: 'Reduced intensity - Focus on form',
        };
      case 'MAINTENANCE':
        return {
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/20',
          borderColor: 'border-blue-500/50',
          icon: Clock,
          description: 'Light session - Recovery focused',
        };
      default:
        return {
          color: 'text-slate-400',
          bgColor: 'bg-slate-500/20',
          borderColor: 'border-slate-500/50',
          icon: Target,
          description: 'Standard workout',
        };
    }
  };

  const getRecommendationConfig = (action: 'PERFORM_SKIPPED' | 'MAINTENANCE' | 'CONTINUE') => {
    switch (action) {
      case 'PERFORM_SKIPPED':
        return {
          color: 'text-emerald-500',
          bgColor: 'bg-emerald-500/20',
          borderColor: 'border-emerald-500/50',
          label: 'Recommendation',
        };
      case 'MAINTENANCE':
        return {
          color: 'text-cyan-500',
          bgColor: 'bg-cyan-500/20',
          borderColor: 'border-cyan-500/50',
          label: 'Recommendation',
        };
      case 'CONTINUE':
        return {
          color: 'text-slate-300',
          bgColor: 'bg-slate-500/20',
          borderColor: 'border-slate-500/40',
          label: 'Recommendation',
        };
    }
  };

  if (loading) {
    return (
      <div className="app-bg flex items-center justify-center">
        <div className="text-white text-xl">Loading workout...</div>
      </div>
    );
  }

  return (
    <div className="app-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-white/70 hover:text-white mb-4 transition-colors"
          >
            ← Back to Dashboard
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="brand-chip">
              <Dumbbell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Today's Workout</h1>
              <p className="text-white/60 text-sm">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
        </header>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-fuchsia-500/20 border border-fuchsia-500/50 rounded-xl p-4">
            <p className="text-fuchsia-300">{error}</p>
          </div>
        )}

        {/* No Workout State */}
        {!workout ? (
          <div className="card-glass p-12 text-center">
            <p className="text-white/70 mb-6 text-lg">No workout generated yet for today</p>
            <div className="flex items-center justify-center gap-2 mb-4">
              <button
                onClick={() => setScheduleOverride('MONDAY')}
                className={`px-3 py-2 rounded-lg ${scheduleOverride === 'MONDAY' ? 'bg-indigo-500 text-white' : 'btn-secondary'}`}
              >
                Mon: Back & Biceps
              </button>
              <button
                onClick={() => setScheduleOverride('TUESDAY')}
                className={`px-3 py-2 rounded-lg ${scheduleOverride === 'TUESDAY' ? 'bg-indigo-500 text-white' : 'btn-secondary'}`}
              >
                Tue: Chest & Triceps
              </button>
              <button
                onClick={() => setScheduleOverride('WEDNESDAY')}
                className={`px-3 py-2 rounded-lg ${scheduleOverride === 'WEDNESDAY' ? 'bg-indigo-500 text-white' : 'btn-secondary'}`}
              >
                Wed: Legs & Abs
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 mb-6">
              <button
                onClick={swapMusclePair}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 btn-primary disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                Swap Muscle Pair
              </button>
            </div>
            <button
              onClick={generateWorkout}
              disabled={generating}
              className="inline-flex items-center gap-2 px-8 py-4 btn-primary font-medium transition-all disabled:opacity-50 text-lg"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  Generating Workout...
                </>
              ) : (
                <>
                  <Play className="w-6 h-6" />
                  Generate Today's Workout
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Workout Summary Card */}
            <div className="card-glass p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-white">Workout Overview</h2>
                <div className="flex items-center gap-2">
                  <div className="hidden md:flex items-center gap-2">
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
                  <button
                    onClick={swapMusclePair}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2 btn-primary disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                    Swap Muscle Pair
                  </button>
                  <button
                    onClick={generateWorkout}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2 btn-secondary disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                    Regenerate
                  </button>
                </div>
              </div>

              {/* Focus Label Banner */}
              {workout.focus_label && (() => {
                const config = getFocusLabelConfig(workout.focus_label);
                const Icon = config.icon;
                return (
                  <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 mb-6`}>
                    <div className="flex items-center gap-3">
                      <Icon className={`w-6 h-6 ${config.color}`} />
                      <div>
                        <p className={`font-semibold ${config.color}`}>{workout.focus_label} WORKOUT</p>
                        <p className="text-white/70 text-sm">{config.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Recommendation Banner */}
              {recommendation && (
                <div className={`${getRecommendationConfig(recommendation.recommended_action).bgColor} ${getRecommendationConfig(recommendation.recommended_action).borderColor} border rounded-lg p-4 mb-6`}>
                  <div className="flex items-center gap-3">
                    <Target className={`w-6 h-6 ${getRecommendationConfig(recommendation.recommended_action).color}`} />
                    <div>
                      <p className={`font-semibold ${getRecommendationConfig(recommendation.recommended_action).color}`}>
                        {getRecommendationConfig(recommendation.recommended_action).label}: {recommendation.recommended_action.replace('_', ' ')}
                      </p>
                      <p className="text-white/70 text-sm">{recommendation.reason}</p>
                    </div>
                  </div>
                </div>
              )}
              {regenDiff && (
                <div className="bg-white/10 border border-white/20 rounded-lg p-4 mb-6">
                  <p className="text-white/80 text-sm font-semibold mb-2">Changes after Regenerate</p>
                  <div className="space-y-2">
                    {regenDiff.added.length > 0 && (
                      <p className="text-emerald-300 text-sm">Added: {regenDiff.added.join(', ')}</p>
                    )}
                    {regenDiff.removed.length > 0 && (
                      <p className="text-rose-300 text-sm">Removed: {regenDiff.removed.join(', ')}</p>
                    )}
                    {regenDiff.changed.length > 0 && (
                      <div className="space-y-1">
                        {regenDiff.changed.map((c, idx) => (
                          <p key={idx} className="text-sky-300 text-sm">
                            {c.name}: {c.from.sets}x{c.from.reps}, {c.from.rest}s → {c.to.sets}x{c.to.reps}, {c.to.rest}s
                          </p>
                        ))}
                      </div>
                    )}
                    {regenDiff.added.length === 0 && regenDiff.removed.length === 0 && regenDiff.changed.length === 0 && (
                      <p className="text-white/60 text-sm">No changes detected</p>
                    )}
                  </div>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-slate-400 text-sm mb-1">Duration</p>
                  <p className="text-white font-semibold text-xl">{workout.estimated_duration_minutes} min</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-slate-400 text-sm mb-1">Exercises</p>
                  <p className="text-white font-semibold text-xl">{workout.exercises.length}</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 col-span-2 md:col-span-1">
                  <p className="text-slate-400 text-sm mb-1">Total Sets</p>
                  <p className="text-white font-semibold text-xl">
                    {workout.exercises.reduce((sum, ex) => sum + ex.sets, 0)}
                  </p>
                </div>
              </div>
              <div className="bg-white/10 rounded-lg p-4 mb-6">
                <p className="text-slate-400 text-sm mb-1">Target Muscles</p>
                <p className="text-white font-semibold text-lg">{(workout.targetMuscles ?? []).join(', ') || '—'}</p>
              </div>
              <div className="bg-white/10 rounded-lg p-4 mb-6">
                {(() => {
                  const plan = getWarmupCooldownForTargets(workout.targetMuscles ?? []);
                  const totalWarm = plan.warmup.length;
                  const doneWarm = plan.warmup.filter((i) => warmupDone.has(i.title)).length;
                  return (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                  <p className="text-white/80 text-sm">Warm-Up Progress: {doneWarm}/{totalWarm}</p>
                  {totalWarm > 0 && (
                    <button
                      onClick={() => {
                        const next = new Set(plan.warmup.map((i) => i.title));
                        setWarmupDone(next);
                        try {
                          const key = workout?.id ? `warmup_done_${workout.id}` : null;
                          if (key) {
                            localStorage.setItem(key, JSON.stringify(Array.from(next)));
                          }
                        } catch { void 0; }
                      }}
                      className="px-2 py-1 btn-secondary text-xs"
                    >
                      Mark All Complete
                    </button>
                  )}
                  {totalWarm > 0 && (
                    <button
                      onClick={() => {
                        setWarmupDone(new Set());
                        try {
                          const key = workout?.id ? `warmup_done_${workout.id}` : null;
                          if (key) {
                            localStorage.removeItem(key);
                          }
                        } catch { void 0; }
                      }}
                      className="px-2 py-1 btn-secondary text-xs"
                    >
                      Reset Warm-Up
                    </button>
                          )}
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{
                              width: `${totalWarm === 0 ? 100 : Math.min(100, (doneWarm / totalWarm) * 100)}%`,
                              backgroundImage: 'linear-gradient(to right, #22d3ee, #60a5fa, #6366f1)',
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <p className="text-white font-semibold mb-2">Warm-Up</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {plan.warmup.map((item, idx) => (
                            <div key={`wu-${idx}`} className="bg-white/5 border border-white/10 rounded-lg p-3">
                              <div className="flex items-start justify-between">
                                <p className="text-white/90 text-sm font-medium">{item.title}</p>
                                <label className="inline-flex items-center gap-2 text-xs text-white/70">
                                  <input
                                    type="checkbox"
                                    checked={warmupDone.has(item.title)}
                                    onChange={() => {
                                      setWarmupDone((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(item.title)) next.delete(item.title);
                                        else next.add(item.title);
                                        try {
                                          const key = workout?.id ? `warmup_done_${workout.id}` : null;
                                          if (key) {
                                            localStorage.setItem(key, JSON.stringify(Array.from(next)));
                                          }
                                        } catch { void 0; }
                                        return next;
                                      });
                                    }}
                                  />
                                  Done
                                </label>
                              </div>
                              <p className="text-white/60 text-xs">{item.duration ?? item.reps ?? ''}</p>
                              <ul className="list-disc list-inside text-white/80 text-xs mt-2">
                                {item.steps.map((s, i) => <li key={i}>{s}</li>)}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-white font-semibold mb-2">Cool-Down</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {plan.cooldown.map((item, idx) => (
                            <div key={`cd-${idx}`} className="bg-white/5 border border-white/10 rounded-lg p-3">
                              <p className="text-white/90 text-sm font-medium">{item.title}</p>
                              <p className="text-white/60 text-xs">{item.duration ?? item.reps ?? ''}</p>
                              <ul className="list-disc list-inside text-white/80 text-xs mt-2">
                                {item.steps.map((s, i) => <li key={i}>{s}</li>)}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              {/* 3D visualization removed per request */}
            </div>

            {/* Exercise List */}
            <div className="card-glass p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">Exercises</h2>
              <p className="text-white/70 text-sm mb-6">
                Complete in order. Compounds first, isolations after.
              </p>

              <div className="space-y-4">
                {workout.exercises.map((exercise, idx) => (
                  <div
                    key={idx}
                    className={`bg-white/10 rounded-lg p-5 hover:bg-white/20 transition-colors ${
                      exercise.is_superset ? 'border-l-4 border-violet-500' : ''
                    }`}
                  >
                    {/* Exercise Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-white/60 font-medium text-sm">#{idx + 1}</span>
                          <h3 className="text-white font-semibold text-lg">{exercise.exercise_name}</h3>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 text-xs rounded">
                            {exercise.primary_muscles.join(', ')}
                          </span>
                          {Array.isArray(exercise.secondaryMuscles) && exercise.secondaryMuscles.length > 0 && (
                            <span className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs rounded">
                              {exercise.secondaryMuscles.join(', ')}
                            </span>
                          )}
                          {(() => {
                            const focusText = specificFocus(exercise);
                            const group = getMuscleGroupFromLabel(focusText, exercise.primary_muscles);
                            return (
                              <div className="flex items-center gap-3 mt-1">
                                <div className="rounded-xl p-1 bg-white/5 border border-white/10 ring-2 ring-indigo-400/60">
                                  <MuscleThumbnail group={group} className="w-16 h-16" />
                                </div>
                                <span className="text-white/80 text-sm">Focus: {focusText}</span>
                              </div>
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
                          {exercise.is_superset && (
                            <span className="px-2 py-1 bg-violet-500/20 text-violet-300 text-xs rounded font-medium">
                              Superset
                            </span>
                          )}
                          {exercise.has_drop_set && (
                            <span className="px-2 py-1 bg-pink-500/20 text-pink-300 text-xs rounded font-medium">
                              Drop Set on Last Set
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Exercise Parameters */}
                    <div className="grid grid-cols-3 gap-4 bg-white/10 rounded-lg p-3">
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Sets</p>
                        <p className="text-white font-semibold text-lg">{exercise.sets}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Reps</p>
                        <p className="text-white font-semibold text-lg">{exercise.reps}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs mb-1">Rest</p>
                        <p className="text-white font-semibold text-lg">{exercise.rest_seconds}s</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Start Workout Button */}
            {mode === 'view' && (() => {
              const plan = getWarmupCooldownForTargets(workout.targetMuscles ?? []);
              const allDone = plan.warmup.length === 0 || plan.warmup.every((i) => warmupDone.has(i.title));
              const totalWarm = plan.warmup.length;
              const doneWarm = plan.warmup.filter((i) => warmupDone.has(i.title)).length;
              return (
                <div className="space-y-2">
                  <button
                    onClick={startExecution}
                    disabled={!allDone}
                    className="w-full btn-primary text-white py-5 rounded-xl font-semibold transition-all text-lg disabled:opacity-50"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <Play className="w-6 h-6" />
                      {`Start Workout${totalWarm > 0 ? ` • Warm-Up ${doneWarm}/${totalWarm}` : ''}`}
                    </div>
                  </button>
                  {!allDone && (
                    <p className="text-white/70 text-xs text-center">Complete warm-up items to enable Start</p>
                  )}
                </div>
              );
            })()}

            {/* Execution Panel */}
            {(mode === 'executing' || mode === 'paused' || mode === 'completed') && (
              <div className="card-glass p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-semibold text-white">Execution Mode</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePause}
                    className="px-3 py-2 btn-secondary"
                  >
                    {mode === 'paused' ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={finishSession}
                    className="px-3 py-2 btn-primary"
                  >
                    Finish
                  </button>
                  <button
                    onClick={changeCurrentExercise}
                    disabled={changing || (mode !== 'executing' && mode !== 'paused')}
                    className="px-3 py-2 btn-primary disabled:opacity-50"
                  >
                    {changing ? 'Changing...' : 'Change Exercise'}
                  </button>
                  <button
                    onClick={skipCurrentExercise}
                    disabled={mode !== 'executing' && mode !== 'paused'}
                    className="px-3 py-2 btn-secondary disabled:opacity-50"
                  >
                    Skip
                  </button>
                  <button
                    onClick={undoSkip}
                    disabled={undoing || sessionId == null || (mode !== 'executing' && mode !== 'paused')}
                    className="px-3 py-2 btn-secondary disabled:opacity-50"
                  >
                    {undoing ? 'Undoing...' : 'Undo Skip'}
                  </button>
                </div>
              </div>

              {mode !== 'completed' ? (
                <>
                    {/* Current Exercise */}
                    <div className="bg-white/10 rounded-lg p-4 mb-4">
                      <p className="text-slate-400 text-sm mb-1">Current Exercise</p>
                      <p className="text-white font-semibold text-lg">
                        #{currentExerciseIndex + 1} {workout.exercises[currentExerciseIndex].exercise_name}
                      </p>
                      <div className="mt-2 grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-slate-400 text-xs mb-1">Set</p>
                          <p className="text-white font-semibold">{currentSetIndex + 1} / {workout.exercises[currentExerciseIndex].sets}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs mb-1">Target Reps</p>
                          <p className="text-white font-semibold">{workout.exercises[currentExerciseIndex].reps}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs mb-1">Rest</p>
                          <p className="text-white font-semibold">{workout.exercises[currentExerciseIndex].rest_seconds}s</p>
                        </div>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={completeCurrentSet}
                        disabled={mode !== 'executing' || restActive}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-500/90 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Complete Set
                      </button>
                      <button
                        onClick={togglePause}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg transition-colors"
                      >
                        <Pause className="w-4 h-4" />
                        {mode === 'paused' ? 'Resume' : 'Pause'}
                      </button>
                    </div>

                    {/* Rest Timer */}
                    <div className="mt-4">
                      {restActive ? (
                        <div className="bg-white/10 rounded-lg p-4">
                          <p className="text-slate-400 text-sm mb-1">Rest Timer</p>
                          <p className="text-white text-2xl font-bold">{restRemaining}s</p>
                          <p className="text-white/70 text-xs mt-1">Next set will unlock automatically when timer ends.</p>
                        </div>
                      ) : (
                        <div className="bg-white/10 rounded-lg p-4">
                          <p className="text-slate-400 text-sm mb-1">Status</p>
                          <p className="text-white font-semibold">
                            {currentExerciseIndex >= workout.exercises.length
                              ? 'All exercises complete — finish session.'
                              : 'Ready for next set'}
                          </p>
                        </div>
                      )}
                    </div>
                    {altMessage && (
                      <div className="mt-3 bg-white/10 border border-white/20 rounded-lg p-3">
                        <p className="text-white/70 text-sm">{altMessage}</p>
                      </div>
                    )}
                    {trainingBias && (
                      <div className="mt-3 bg-white/10 border border-white/20 rounded-lg p-3">
                        <p className="text-white/80 text-sm mb-2">Training Bias</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-slate-400 text-xs mb-1">Rest Factor</p>
                            <p className="text-white font-semibold">{trainingBias.rest_factor.toFixed(2)}x</p>
                          </div>
                          <div>
                            <p className="text-slate-400 text-xs mb-1">Volume Factor</p>
                            <p className="text-white font-semibold">{trainingBias.volume_factor.toFixed(2)}x</p>
                          </div>
                          <div>
                            <p className="text-slate-400 text-xs mb-1">Intensity</p>
                            <p className="text-white font-semibold">{trainingBias.reduce_intensity_techniques ? 'Reduced' : 'Normal'}</p>
                          </div>
                        </div>
                        <div className="mt-2">
                          <p className="text-slate-400 text-xs mb-1">Goal Realism</p>
                          <p className="text-white font-semibold">{trainingBias.realism}</p>
                        </div>
                      </div>
                    )}
                    {goalAlignment && (
                      <div className="mt-3 bg-white/10 border border-white/20 rounded-lg p-3">
                        <p className="text-white/80 text-sm mb-2">Goal Alignment</p>
                        <p className="text-white font-semibold">
                          {goalAlignment.behind_schedule
                            ? `Behind schedule${goalAlignment.suggested_extension_weeks ? ` — consider +${goalAlignment.suggested_extension_weeks} week(s)` : ''}`
                            : 'On track'}
                        </p>
                        {typeof goalAlignment.required_weekly_rate_kg === 'number' && (
                          <p className="text-white/80 text-sm mt-1">Required pace: {goalAlignment.required_weekly_rate_kg.toFixed(2)} kg/week</p>
                        )}
                      </div>
                    )}
                  {showSkipReason && (
                    <div className="mt-3 bg-white/10 border border-white/20 rounded-lg p-3">
                      <p className="text-white/80 text-sm mb-2">Reason for skipping (optional)</p>
                      <div className="flex items-center gap-2">
                        <input
                          value={skipReason}
                          onChange={(e) => setSkipReason(e.target.value)}
                          placeholder="e.g., joint discomfort"
                          className="flex-1 px-3 py-2 bg-white/10 text-white rounded-lg border border-white/20 placeholder-white/50"
                        />
                        <button
                          onClick={() => submitSkipRef.current?.()}
                          className="px-3 py-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white rounded-lg"
                        >
                          Confirm Skip
                        </button>
                        <button
                          onClick={() => {
                            setShowSkipReason(false);
                            setSkipReason('');
                          }}
                          className="px-3 py-2 bg-white/10 text-white/80 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  </>
                ) : (
                  <div className="bg-fuchsia-500/20 border border-fuchsia-500/50 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <StopCircle className="w-5 h-5 text-fuchsia-500" />
                      <p className="text-fuchsia-300">Session completed. Great job!</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
