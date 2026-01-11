import type { GoalType, GoalAlignmentResult, TrainingBiasRecommendation, GoalRealism } from "@/shared/types";

export interface GoalContext {
  current_weight_kg: number;
  target_weight_kg: number;
  height_cm: number;
  age_years: number;
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN';
  training_days_per_week: number;
  goal_type: GoalType;
  deadline_iso: string;
  last_progress_weight_kg?: number;
  last_progress_date?: string;
  skip_count_current_week: number;
}

/**
 * Goal & Deadline Engine
 *
 * PURPOSE:
 * - Classify goal realism and compute weekly rate required
 * - Provide training bias recommendations to keep user on track
 * - Compute calorie guidance (maintenance and target range) using training load
 * - Evaluate weekly alignment and suggest extensions calmly if needed
 *
 * DETERMINISM:
 * - Pure rule-based outputs based on numeric thresholds
 */
export class GoalEngine {
  static evaluate(ctx: GoalContext): GoalAlignmentResult {
    const {
      current_weight_kg,
      target_weight_kg,
      height_cm,
      age_years,
      sex,
      training_days_per_week,
      goal_type,
      deadline_iso,
      last_progress_weight_kg,
      last_progress_date,
      skip_count_current_week,
    } = ctx;

    const logs: string[] = [];
    const today = new Date();
    const deadline = new Date(deadline_iso);
    const daysUntilDeadline = Math.max(0, Math.floor((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    const weeksRemaining = Math.max(1, Math.ceil(daysUntilDeadline / 7));

    const deltaKg = (goal_type === 'WEIGHT_LOSS')
      ? Math.max(0, current_weight_kg - target_weight_kg)
      : Math.max(0, target_weight_kg - current_weight_kg);

    const requiredWeeklyRate = Number((deltaKg / weeksRemaining).toFixed(2));
    const realism = this.classifyRealism(goal_type, requiredWeeklyRate);
    logs.push(`Goal realism classified as ${realism} with required ${requiredWeeklyRate} kg/week`);

    const maintenanceCalories = Math.round(this.estimateMaintenanceCalories(
      current_weight_kg, height_cm, age_years, sex, training_days_per_week
    ));

    const { min: targetMin, max: targetMax } = this.targetCalorieRange(maintenanceCalories, goal_type, realism);
    logs.push(`Calorie guidance: maintenance=${maintenanceCalories}, target_range=[${targetMin}, ${targetMax}]`);

    const trainingBias = this.trainingBias(goal_type, realism, training_days_per_week, skip_count_current_week);
    logs.push(`Training bias computed: freq=${trainingBias.frequency_recommended}, vol_factor=${trainingBias.volume_factor}, emphasis=${trainingBias.exercise_emphasis}`);

    // Weekly alignment: check trajectory using last progress marker
    let behindSchedule = false;
    let suggestedExtensionWeeks: number | undefined;
    if (last_progress_weight_kg && last_progress_date) {
      const lastDate = new Date(last_progress_date);
      const weeksSince = Math.max(1, Math.ceil((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24 * 7)));
      const deltaSince = (goal_type === 'WEIGHT_LOSS')
        ? (last_progress_weight_kg - current_weight_kg)
        : (current_weight_kg - last_progress_weight_kg);
      const actualRate = deltaSince / weeksSince;
      behindSchedule = actualRate < (requiredWeeklyRate * 0.75); // 75% of required pace
      if (behindSchedule) {
        suggestedExtensionWeeks = Math.ceil((requiredWeeklyRate - actualRate) > 0 ? deltaKg / Math.max(0.1, actualRate) : 2);
        logs.push(`Behind schedule: actual=${actualRate.toFixed(2)} kg/week vs required=${requiredWeeklyRate} kg/week`);
      } else {
        logs.push(`On track: actual pace matches requirement within tolerance`);
      }
    } else {
      logs.push("No progress markers available; alignment status inferred from required rate only");
    }

    return {
      realism,
      required_weekly_rate_kg: requiredWeeklyRate,
      calories_maintenance: maintenanceCalories,
      calories_target_min: targetMin,
      calories_target_max: targetMax,
      training_bias: trainingBias,
      behind_schedule: behindSchedule,
      suggested_extension_weeks: suggestedExtensionWeeks,
      logs,
    };
  }

  private static classifyRealism(goal: GoalType, rateKgPerWeek: number): GoalRealism {
    if (goal === 'WEIGHT_LOSS') {
      if (rateKgPerWeek <= 0.5) return 'SAFE';
      if (rateKgPerWeek <= 0.75) return 'AGGRESSIVE';
      return 'RISKY';
    }
    if (goal === 'MUSCLE_GAIN') {
      if (rateKgPerWeek <= 0.25) return 'SAFE';
      if (rateKgPerWeek <= 0.5) return 'AGGRESSIVE';
      return 'RISKY';
    }
    // For strength/endurance goals, treat as maintenance for bodyweight
    return 'SAFE';
  }

  private static estimateMaintenanceCalories(
    weightKg: number,
    heightCm: number,
    ageYears: number,
    sex: 'MALE' | 'FEMALE' | 'UNKNOWN',
    trainingDaysPerWeek: number
  ): number {
    const base = (sex === 'FEMALE')
      ? (10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161)
      : (10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5);
    const activity = trainingDaysPerWeek >= 6 ? 1.9
      : trainingDaysPerWeek === 5 ? 1.725
      : trainingDaysPerWeek === 4 ? 1.55
      : trainingDaysPerWeek === 3 ? 1.375
      : 1.2;
    return base * activity;
  }

  private static targetCalorieRange(maintenance: number, goal: GoalType, realism: GoalRealism): { min: number; max: number } {
    if (goal === 'WEIGHT_LOSS') {
      const deficit = realism === 'SAFE' ? [0.10, 0.20] : realism === 'AGGRESSIVE' ? [0.15, 0.25] : [0.20, 0.30];
      const min = Math.round(maintenance * (1 - deficit[1]));
      const max = Math.round(maintenance * (1 - deficit[0]));
      return { min, max };
    }
    if (goal === 'MUSCLE_GAIN') {
      const surplus = realism === 'SAFE' ? [0.08, 0.12] : realism === 'AGGRESSIVE' ? [0.10, 0.15] : [0.12, 0.18];
      const min = Math.round(maintenance * (1 + surplus[0]));
      const max = Math.round(maintenance * (1 + surplus[1]));
      return { min, max };
    }
    return { min: Math.round(maintenance * 0.95), max: Math.round(maintenance * 1.05) };
  }

  private static trainingBias(
    goal: GoalType,
    realism: GoalRealism,
    trainingDaysPerWeek: number,
    skipCountCurrentWeek: number
  ): TrainingBiasRecommendation {
    if (goal === 'WEIGHT_LOSS') {
      const freq = Math.max(trainingDaysPerWeek, 4);
      const volFactor = skipCountCurrentWeek >= 2 ? 0.85 : 0.9;
      const deloadFreq = realism === 'RISKY' ? 4 : 5;
      return {
        frequency_recommended: freq,
        volume_factor: volFactor,
        exercise_emphasis: 'COMPOUND',
        rest_factor: 0.9,
        deload_frequency_weeks: deloadFreq,
        reduce_intensity_techniques: false,
      };
    }
    if (goal === 'MUSCLE_GAIN') {
      const freq = Math.max(trainingDaysPerWeek, 4);
      const volFactor = skipCountCurrentWeek >= 2 ? 1.0 : 1.1;
      const deloadFreq = realism === 'RISKY' ? 5 : 6;
      return {
        frequency_recommended: freq,
        volume_factor: volFactor,
        exercise_emphasis: 'BALANCED',
        rest_factor: 1.15,
        deload_frequency_weeks: deloadFreq,
        reduce_intensity_techniques: true,
      };
    }
    return {
      frequency_recommended: trainingDaysPerWeek,
      volume_factor: 1.0,
      exercise_emphasis: 'BALANCED',
      rest_factor: 1.0,
      deload_frequency_weeks: 6,
      reduce_intensity_techniques: false,
    };
  }
}
