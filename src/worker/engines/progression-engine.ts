import type { TrainingPhase, GoalType, RecoveryStatus, TrainingState, ProgressionResult, MuscleProgressionUpdate } from "@/shared/types";

type DbMuscle = {
  id: number;
  name: string;
  last_trained_at: string | null;
  recovery_hours_required: number;
  weekly_sets_completed: number;
  weekly_sets_target: number;
};

export interface ProgressionContext {
  muscles: DbMuscle[];
  training_state: TrainingState;
  goal_type: GoalType | null;
  today_iso: string;
}

/**
 * Progression Engine
 *
 * PURPOSE:
 * - Evaluate weekly trends and apply slow, evidence-based adaptations
 * - Change only ONE variable at a time (Volume → Reps → Load)
 * - Trigger deload when fatigue patterns emerge
 *
 * EVALUATION WINDOW:
 * - Runs at most once per 7 days (based on cycle_start_date and current_week)
 *
 * DETERMINISM:
 * - Given the same inputs (muscles + training state), outputs are deterministic
 */
export class ProgressionEngine {
  static evaluateWeekly(ctx: ProgressionContext): ProgressionResult {
    const { muscles, training_state, today_iso } = ctx;

    // Compute current week index since cycle start (1-based)
    const cycleStart = new Date(training_state.cycle_start_date);
    const today = new Date(today_iso);
    const days = Math.floor((today.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
    const computedWeek = Math.max(1, Math.floor(days / 7) + 1);

    // Enforce weekly evaluation window: no changes if already evaluated this week
    if (computedWeek <= training_state.current_week) {
      return {
        applied_week: training_state.current_week,
        deload_triggered: false,
        muscle_updates: [],
        logs: [
          "No progression applied: current week already evaluated"
        ],
      };
    }

    // Detect fatigue: high percentage of muscles not meeting recovery or adherence
    const readyOrPartialCount = muscles.filter(m => {
      // READY if 100% recovered; PARTIAL if 36+ hours recovered (approx)
      const status = this.estimateRecoveryStatus(m, today);
      return status === 'READY' || status === 'PARTIAL';
    }).length;

    const blockedCount = muscles.length - readyOrPartialCount;
    const adherenceGoodCount = muscles.filter(m => m.weekly_sets_completed >= Math.floor(m.weekly_sets_target * 0.8)).length;
    const adherencePoorCount = muscles.length - adherenceGoodCount;

    const logs: string[] = [];
    let phaseChangedTo: TrainingPhase | undefined;
    let deloadTriggered = false;
    const muscleUpdates: MuscleProgressionUpdate[] = [];

    // Automatic deload conditions:
    // - ≥ 50% muscles blocked OR
    // - Adherence poor across majority AND last deload > 4 weeks ago
    const weeksSinceLastDeload = training_state.last_deload_date
      ? Math.floor((today.getTime() - new Date(training_state.last_deload_date).getTime()) / (1000 * 60 * 60 * 24 * 7))
      : Number.POSITIVE_INFINITY;
    const shouldDeload = (blockedCount / muscles.length) >= 0.5 || ((adherencePoorCount / muscles.length) >= 0.5 && weeksSinceLastDeload > 4);

    if (shouldDeload) {
      deloadTriggered = true;
      phaseChangedTo = 'DELOAD';
      logs.push("Deload triggered: fatigue patterns detected (blocked or poor adherence)");
      for (const m of muscles) {
        const newTarget = Math.max(4, Math.ceil(m.weekly_sets_target * 0.7)); // Reduce volume 30%, floor at 4 sets/week
        if (newTarget !== m.weekly_sets_target) {
          muscleUpdates.push({
            muscle_name: m.name,
            change: 'DELOAD',
            previous_weekly_target: m.weekly_sets_target,
            new_weekly_target: newTarget,
            rationale: "Deload reduces volume to promote recovery while preserving frequency",
          });
        }
      }

      return {
        applied_week: computedWeek,
        phase_changed_to: phaseChangedTo,
        deload_triggered: deloadTriggered,
        muscle_updates: muscleUpdates,
        logs,
      };
    }

    // Progression priority: Volume → Reps → Load
    // Change only ONE variable per evaluation window across the system.
    const VOLUME_CAP = 20; // Recoverable volume safeguard

    // Determine candidates for volume increase
    const volumeCandidates = muscles.filter((m) => {
      const status = this.estimateRecoveryStatus(m, today);
      const adherenceGood = m.weekly_sets_completed >= Math.floor(m.weekly_sets_target * 0.8);
      return status === 'READY' && adherenceGood && m.weekly_sets_target < VOLUME_CAP;
    });

    if (volumeCandidates.length > 0) {
      logs.push("Progression applied: Volume increases for adherent, recovered muscles (+2 sets)");
      for (const m of muscles) {
        const isCandidate = volumeCandidates.some(vc => vc.name === m.name);
        if (isCandidate) {
          const newTarget = Math.min(VOLUME_CAP, m.weekly_sets_target + 2);
          muscleUpdates.push({
            muscle_name: m.name,
            change: 'VOLUME',
            previous_weekly_target: m.weekly_sets_target,
            new_weekly_target: newTarget,
            rationale: "Adherence met with adequate recovery; increasing weekly sets by +2",
          });
        } else {
          muscleUpdates.push({
            muscle_name: m.name,
            change: 'NONE',
            previous_weekly_target: m.weekly_sets_target,
            new_weekly_target: m.weekly_sets_target,
            rationale: "No change: not a volume candidate this week",
          });
        }
      }
      return {
        applied_week: computedWeek,
        phase_changed_to: undefined,
        deload_triggered: false,
        muscle_updates: muscleUpdates,
        logs,
      };
    }

    // If no volume change, consider phase shift to REPS
    const repsEligible = muscles.some((m) => {
      const status = this.estimateRecoveryStatus(m, today);
      const adherenceGood = m.weekly_sets_completed >= Math.floor(m.weekly_sets_target * 0.8);
      const canIncreaseVolume = status === 'READY' && adherenceGood && m.weekly_sets_target < VOLUME_CAP;
      return (status === 'PARTIAL' && adherenceGood) || (!canIncreaseVolume && adherenceGood);
    });

    if (repsEligible) {
      phaseChangedTo = 'REPS';
      logs.push("Progression applied: Phase changed to REPS to progress via repetition range");
      for (const m of muscles) {
        muscleUpdates.push({
          muscle_name: m.name,
          change: 'NONE',
          previous_weekly_target: m.weekly_sets_target,
          new_weekly_target: m.weekly_sets_target,
          rationale: "REPS phase shift applied globally; volume unchanged",
        });
      }
      return {
        applied_week: computedWeek,
        phase_changed_to: phaseChangedTo,
        deload_triggered: false,
        muscle_updates: muscleUpdates,
        logs,
      };
    }

    // Else consider phase shift to LOAD when volume capped and adherence excellent
    const loadEligible = muscles.some((m) => {
      const status = this.estimateRecoveryStatus(m, today);
      const adherenceGood = m.weekly_sets_completed >= Math.floor(m.weekly_sets_target * 0.9);
      return adherenceGood && status === 'READY' && m.weekly_sets_target >= VOLUME_CAP;
    });

    if (loadEligible) {
      phaseChangedTo = 'LOAD';
      logs.push("Progression applied: Phase changed to LOAD to progress intensity while volume is capped");
      for (const m of muscles) {
        muscleUpdates.push({
          muscle_name: m.name,
          change: 'NONE',
          previous_weekly_target: m.weekly_sets_target,
          new_weekly_target: m.weekly_sets_target,
          rationale: "LOAD phase shift applied globally; volume unchanged",
        });
      }
      return {
        applied_week: computedWeek,
        phase_changed_to: phaseChangedTo,
        deload_triggered: false,
        muscle_updates: muscleUpdates,
        logs,
      };
    }

    // No changes this week; record rationale per muscle
    for (const m of muscles) {
      muscleUpdates.push({
        muscle_name: m.name,
        change: 'NONE',
        previous_weekly_target: m.weekly_sets_target,
        new_weekly_target: m.weekly_sets_target,
        rationale: "No progression conditions met this week",
      });
    }

    // If no phase change determined, keep existing phase
    return {
      applied_week: computedWeek,
      phase_changed_to: phaseChangedTo,
      deload_triggered: false,
      muscle_updates: muscleUpdates,
      logs,
    };
  }

  private static estimateRecoveryStatus(m: DbMuscle, today: Date): RecoveryStatus {
    if (!m.last_trained_at) return 'READY';
    const last = new Date(m.last_trained_at);
    const hours = (today.getTime() - last.getTime()) / (1000 * 60 * 60);
    if (hours >= m.recovery_hours_required) return 'READY';
    if (hours >= 36) return 'PARTIAL';
    return 'BLOCKED';
  }
}
