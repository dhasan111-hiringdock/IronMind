import type { GoalType, WorkoutStatus } from "@/shared/types";

type RecoveryStatus = 'READY' | 'PARTIAL' | 'BLOCKED';

interface MuscleWithRecovery {
  id: number;
  name: string;
  recovery_status: RecoveryStatus;
  weekly_sets_completed: number;
  weekly_sets_target: number;
  volume_deficit: number;
}

interface PreviousPlanSummary {
  scheduled_date: string;
  status: WorkoutStatus;
  exercises: Array<{
    primary_muscles: string[];
  }>;
}

export type SkipRecommendedAction = 'PERFORM_SKIPPED' | 'MAINTENANCE' | 'CONTINUE';

export interface SkipResolutionResult {
  skip_detected: boolean;
  recommended_action: SkipRecommendedAction;
  reason: string;
  volume_reduction_percentage?: number;
  preferred_pair?: [string, string];
}

function normalizeMuscle(name: string): string {
  const up = name.toUpperCase();
  switch (up) {
    case 'BACK': return 'Back';
    case 'BICEPS': return 'Biceps';
    case 'CHEST': return 'Chest';
    case 'TRICEPS': return 'Triceps';
    case 'QUADRICEPS': return 'Quads';
    case 'HAMSTRINGS': return 'Hamstrings';
    case 'ABS': return 'Abs';
    case 'SHOULDERS': return 'Shoulders';
    default: return name;
  }
}

function detectPairFromExercises(exercises: PreviousPlanSummary['exercises']): [string, string] | null {
  let back = 0, biceps = 0, chest = 0, triceps = 0, quads = 0, hams = 0, abs = 0;
  for (const ex of exercises) {
    for (const m of ex.primary_muscles) {
      const nm = normalizeMuscle(m);
      if (nm === 'Back') back++;
      if (nm === 'Biceps') biceps++;
      if (nm === 'Chest') chest++;
      if (nm === 'Triceps') triceps++;
      if (nm === 'Quads') quads++;
      if (nm === 'Hamstrings') hams++;
      if (nm === 'Abs') abs++;
    }
  }
  const bb = back + biceps;
  const ct = chest + triceps;
  const la = Math.max(quads, hams) + abs;
  if (bb >= ct && bb >= la) return ['Back', 'Biceps'];
  if (ct >= bb && ct >= la) return ['Chest', 'Triceps'];
  if (abs > 0 && (quads > 0 || hams > 0)) {
    const leg = quads >= hams ? 'Quads' : 'Hamstrings';
    return [leg, 'Abs'];
  }
  return null;
}

export function resolveSkip(params: {
  today: string;
  previous_plan: PreviousPlanSummary | null;
  muscles_with_recovery: MuscleWithRecovery[];
  goal_type: GoalType | null;
  goal_deadline: string | null;
}): SkipResolutionResult {
  const { today, previous_plan, muscles_with_recovery, goal_deadline } = params;
  const todayDate = new Date(today);
  let skipDetected = false;
  if (previous_plan) {
    const prevDate = new Date(previous_plan.scheduled_date);
    if (prevDate < todayDate && previous_plan.status !== 'COMPLETED') {
      skipDetected = true;
    }
  }
  if (!skipDetected) {
    return {
      skip_detected: false,
      recommended_action: 'CONTINUE',
      reason: 'No missed workout detected; continue schedule.',
    };
  }

  const pair = previous_plan ? detectPairFromExercises(previous_plan.exercises) : null;
  if (!pair) {
    return {
      skip_detected: true,
      recommended_action: 'CONTINUE',
      reason: 'Skipped workout had no clear muscle pair; continue schedule.',
    };
  }

  const trainable = new Map(muscles_with_recovery.map(m => [m.name, m]));
  const m1 = trainable.get(pair[0]);
  const m2 = trainable.get(pair[1]);
  if (!m1 || !m2) {
    return {
      skip_detected: true,
      recommended_action: 'CONTINUE',
      reason: 'Muscle data unavailable for skipped workout; continue schedule.',
    };
  }

  if (m1.recovery_status === 'BLOCKED' || m2.recovery_status === 'BLOCKED') {
    return {
      skip_detected: true,
      recommended_action: 'CONTINUE',
      reason: 'Skipped muscles are still recovering; avoid training and continue schedule.',
    };
  }

  const totalDeficit = m1.volume_deficit + m2.volume_deficit;
  const allDeficits = muscles_with_recovery.map(m => m.volume_deficit);
  const avgDeficit = allDeficits.reduce((s, v) => s + v, 0) / Math.max(1, allDeficits.length);

  let deadlineNear = false;
  if (goal_deadline) {
    const deadline = new Date(goal_deadline);
    const days = (deadline.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24);
    deadlineNear = days < 14 && days > 0;
  }

  if (m1.recovery_status === 'READY' && m2.recovery_status === 'READY' && totalDeficit > 0 && totalDeficit >= avgDeficit) {
    return {
      skip_detected: true,
      recommended_action: 'PERFORM_SKIPPED',
      reason: 'Both skipped muscles are fully recovered and behind weekly volume; performing the missed workout restores balance.',
      preferred_pair: pair,
    };
  }

  if (m1.recovery_status === 'PARTIAL' || m2.recovery_status === 'PARTIAL' || deadlineNear) {
    return {
      skip_detected: true,
      recommended_action: 'MAINTENANCE',
      reason: 'Recovery is partial or a goal deadline is near; a reduced-volume maintenance session preserves progress without overloading.',
      volume_reduction_percentage: 50,
      preferred_pair: pair,
    };
  }

  return {
    skip_detected: true,
    recommended_action: 'CONTINUE',
    reason: 'Training the skipped muscles now offers limited benefit; continue with the regular schedule.',
  };
}

