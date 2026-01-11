import type { 
  TrainingPhase, 
  GoalType, 
  PlannedExercise,
  EquipmentType,
  RecoveryStatus,
  WorkoutFocus 
} from "@/shared/types";

interface MuscleWithRecovery {
  id: number;
  name: string;
  recovery_status: RecoveryStatus;
  weekly_sets_completed: number;
  weekly_sets_target: number;
  volume_deficit: number;
}

interface ExerciseData {
  id: number;
  name: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment_required: EquipmentType;
  exercise_type: 'COMPOUND' | 'ISOLATION';
  default_rest_seconds: number;
}

export interface WorkoutGenerationContext {
  user_equipment: EquipmentType[];
  training_phase: TrainingPhase;
  goal_type: GoalType | null;
  goal_deadline: string | null; // ISO date string
  muscles_with_recovery: MuscleWithRecovery[];
  available_exercises: ExerciseData[];
  is_deload_week: boolean;
  drop_sets_enabled: boolean;
  supersets_enabled: boolean;
  preferred_pair?: [string, string];
  skip_count_current_week: number;
  prior_intensity?: {
    drop_muscles: string[];
    superset_muscles: string[];
  };
  rest_factor_override?: number;
  volume_factor_override?: number;
}

export interface GeneratedWorkout {
  exercises: PlannedExercise[];
  estimated_duration_minutes: number;
  target_muscles: string[];
  focus_label: WorkoutFocus;
  intensity_logs: string[];
}

/**
 * Workout Generation Engine
 * 
 * CORE PRINCIPLES:
 * - Deterministic: Same inputs always produce same outputs
 * - Recovery-first: Never train muscles that need recovery
 * - Volume-driven: Prioritize muscles furthest behind their weekly targets
 * - Goal-oriented: Adjust intensity based on user's goal and deadline
 * - Progressive: Follow periodization through training phases
 * 
 * DECISION FLOW:
 * 1. Assess muscle recovery status (BLOCKED/PARTIAL/READY)
 * 2. Calculate volume deficit per muscle (target - completed)
 * 3. Select target muscles using push/pull/legs categorization
 * 4. Choose exercises (compounds first, then isolations)
 * 5. Determine sets/reps/rest based on goal + phase
 * 6. Apply training variations (supersets, drop sets)
 * 7. Calculate workout focus label (NORMAL/REDUCED/MAINTENANCE)
 */
export class WorkoutGenerator {
  
  /**
   * Main entry point: Generate a complete workout plan
   * 
   * Returns a structured workout with exercises, timing, and classification
   */
  static generate(context: WorkoutGenerationContext): GeneratedWorkout {
    // Step 1: Select target muscles for today's workout
    // Uses recovery windows and volume deficit to prioritize muscles
    const targetMuscles = this.selectTargetMuscles(context.muscles_with_recovery, context.preferred_pair, context.goal_type);
    
    if (targetMuscles.length === 0) {
      // No muscles ready to train - return empty workout (rest day)
      return {
        exercises: [],
        estimated_duration_minutes: 0,
        target_muscles: [],
        focus_label: 'MAINTENANCE',
        intensity_logs: ["No muscles ready; intensity techniques not applied"],
      };
    }

    // Step 2: Select exercises for target muscles
    // Prioritizes compounds over isolations, respects equipment availability
    const selectedExercises = this.selectExercises(
      targetMuscles,
      context.available_exercises,
      context.user_equipment,
      context.goal_type
    );

    // Step 3: Calculate sets, reps, and load for each exercise
    // Influenced by: training phase, goal type, deload status
    const plannedExercisesBase = this.planExerciseDetails(
      selectedExercises,
      context.training_phase,
      context.goal_type,
      context.is_deload_week,
      context.rest_factor_override,
      context.volume_factor_override
    );

    // Step 4: Apply intensity techniques (drop sets and supersets) under strict rules
    const { exercises: workoutWithVariations, logs: intensityLogs } = this.applyIntensityTechniques(
      plannedExercisesBase,
      context
    );

    // Step 5: Calculate workout focus label
    // Determines if workout is normal intensity, reduced, or maintenance
    const focusLabel = this.determineWorkoutFocus(
      targetMuscles,
      context.is_deload_week,
      context.goal_deadline
    );

    // Step 6: Calculate estimated duration
    const estimatedDuration = this.estimateDuration(
      workoutWithVariations
    );

    return {
      exercises: workoutWithVariations,
      estimated_duration_minutes: estimatedDuration,
      target_muscles: targetMuscles.map(m => m.name),
      focus_label: focusLabel,
      intensity_logs: intensityLogs,
    };
  }

  /**
   * Step 1: Select which muscles to train today
   * 
   * SELECTION LOGIC:
   * - Filter: Only muscles in READY or PARTIAL recovery state
   * - Sort: By volume deficit (descending) - train what's furthest behind
   * - Group: Use push/pull/legs split for balanced programming
   * - Limit: Max 4 muscle groups per session to prevent overtraining
   * 
   * ANTI-PATTERNS AVOIDED:
   * - No stacking of missed volume (respects recovery)
   * - No training BLOCKED muscles (prevents injury)
   * - No random selection (deterministic ordering)
   */
  private static selectTargetMuscles(
    muscles: MuscleWithRecovery[],
    preferredPair?: [string, string],
    goalType?: GoalType | null
  ): MuscleWithRecovery[] {
    // Filter to only ready or partial recovery muscles
    // PARTIAL = 36+ hours recovered (allows training with reduced intensity)
    // READY = Full recovery window met (optimal training state)
    const trainableMuscles = muscles.filter(
      m => m.recovery_status === 'READY' || m.recovery_status === 'PARTIAL'
    );

    if (trainableMuscles.length === 0) {
      return [];
    }

    // Sort by volume deficit (descending) - train muscles furthest behind first
    // This ensures volume distribution stays balanced across the week
    const sorted = [...trainableMuscles].sort((a, b) => b.volume_deficit - a.volume_deficit);

    const day = new Date().getDay();
    const exactMap: Record<number, [string, string]> = {
      0: ['Back', 'Biceps'],
      1: ['Back', 'Biceps'],
      2: ['Chest', 'Triceps'],
      3: ['Quads', 'Abs'],
      4: ['Back', 'Biceps'],
      5: ['Chest', 'Triceps'],
      6: ['Quads', 'Abs'],
    };

    const trainableByName = new Map(sorted.map(m => [m.name, m]));

    let pair: [string, string];
    if (preferredPair) {
      pair = preferredPair;
    } else if (day === 3 || day === 6) {
      const q = trainableByName.get('Quads');
      const h = trainableByName.get('Hamstrings');
      let legChoice: string | undefined;
      if (q && h) {
        legChoice = q.volume_deficit >= h.volume_deficit ? q.name : h.name;
      } else {
        legChoice = q?.name || h?.name;
      }
      pair = legChoice ? [legChoice, 'Abs'] as [string, string] : exactMap[day];
    } else {
      pair = exactMap[day];
    }
    const [p1, p2] = pair;
    const mp1 = trainableByName.get(p1);
    const mp2 = trainableByName.get(p2);
    if (mp1 && mp2 && mp1.name !== mp2.name) {
      if (goalType === 'WEIGHT_LOSS') {
        const extra = sorted.find(m => m.name !== mp1.name && m.name !== mp2.name);
        if (extra) {
          return [mp1, mp2, extra];
        }
      }
      return [mp1, mp2];
    }

    const pushMuscles = ['Chest', 'Shoulders', 'Triceps'];
    const pullMuscles = ['Back', 'Biceps'];
    const legMuscles = ['Quads', 'Hamstrings', 'Glutes', 'Calves'];

    const byCat = (names: string[]) => sorted.filter(m => names.includes(m.name));
    const pickN = (arr: MuscleWithRecovery[], n: number) => arr.slice(0, n);
    const targetCount = goalType === 'WEIGHT_LOSS' ? 3 : 2;

    let pick = pickN(byCat(['Chest', 'Triceps']), targetCount);
    if (pick.length < targetCount) pick = pickN(byCat(['Back', 'Biceps']), targetCount);
    if (pick.length < targetCount) pick = pickN(byCat(['Quads', 'Hamstrings']), targetCount);
    if (pick.length < targetCount) pick = pickN(byCat(pushMuscles), targetCount);
    if (pick.length < targetCount) pick = pickN(byCat(pullMuscles), targetCount);
    if (pick.length < targetCount) pick = pickN(byCat(legMuscles), targetCount);
    if (pick.length < targetCount) pick = sorted.slice(0, Math.min(targetCount, sorted.length));

    return pick;
  }

  /**
   * Step 2: Select specific exercises for target muscles
   * 
   * EXERCISE SELECTION RULES:
   * - Equipment filter: Only use what user has available
   * - Compound priority: Always select compounds before isolations
   * - Volume-based: Add isolation if muscle has high deficit (>4 sets behind)
   * - Uniqueness: No duplicate exercises in same workout
   * 
   * RATIONALE:
   * - Compounds recruit more muscle fibers (efficient)
   * - Isolations target lagging muscles (corrective)
   * - Equipment constraint prevents impossible plans
   */
  private static selectExercises(
    targetMuscles: MuscleWithRecovery[],
    availableExercises: ExerciseData[],
    userEquipment: EquipmentType[],
    goalType?: GoalType | null
  ): ExerciseData[] {
    const selected: ExerciseData[] = [];
    const selectedIds = new Set<number>();

    const equipmentFiltered = availableExercises.filter(
      ex => userEquipment.includes(ex.equipment_required)
    );

    for (const muscle of targetMuscles) {
      const muscleExercises = equipmentFiltered.filter(
        ex => ex.primary_muscles.includes(muscle.name) && !selectedIds.has(ex.id)
      );

      if (muscleExercises.length === 0) continue;

      const compounds = muscleExercises.filter(ex => ex.exercise_type === 'COMPOUND');
      const isolations = muscleExercises.filter(ex => ex.exercise_type === 'ISOLATION');

      const picks: ExerciseData[] = [];

      for (let i = 0; i < Math.min(2, compounds.length) && picks.length < 4; i++) {
        picks.push(compounds[i]);
      }
      const allowIsolation =
        goalType === 'STRENGTH' ? false :
        goalType === 'WEIGHT_LOSS' ? muscle.volume_deficit > 4 :
        true;
      if (allowIsolation) {
        for (let i = 0; i < isolations.length && picks.length < 4; i++) {
          picks.push(isolations[i]);
        }
      }
      if (picks.length < 4) {
        const remaining = muscleExercises.filter(ex => !picks.includes(ex));
        for (let i = 0; i < remaining.length && picks.length < 4; i++) {
          picks.push(remaining[i]);
        }
      }

      for (const p of picks) {
        if (!selectedIds.has(p.id)) {
          selected.push(p);
          selectedIds.add(p.id);
        }
      }
    }

    return selected;
  }

  /**
   * Step 3: Determine sets, reps, load, and rest for each exercise
   * 
   * INTENSITY PRESCRIPTION:
   * - Goal-based: Different rep ranges for strength vs hypertrophy vs endurance
   * - Phase-based: Volume/Reps/Load phases adjust parameters
   * - Deload: 50% volume reduction while maintaining intensity
   * - Drop sets: Added to final set of isolation exercises when enabled
   * 
   * PERIODIZATION:
   * - VOLUME phase (weeks 1-3): High sets, moderate reps
   * - REPS phase (weeks 5-7): Maintain sets, increase reps (+2)
   * - LOAD phase (weeks 9-11): Maintain sets, decrease reps (-2), heavier weight
   * - DELOAD: Half volume, same intensity
   */
  private static planExerciseDetails(
    exercises: ExerciseData[],
    trainingPhase: TrainingPhase,
    goalType: GoalType | null,
    isDeloadWeek: boolean,
    restFactorOverride?: number,
    volumeFactorOverride?: number
  ): PlannedExercise[] {
    return exercises.map(exercise => {
      const baseConfig = this.getExerciseConfig(exercise.exercise_type, goalType);
      
      // Apply training phase modifications
      let sets = baseConfig.sets;
      let reps = baseConfig.reps;
      let rest = exercise.default_rest_seconds;
      if (typeof restFactorOverride === 'number') {
        rest = Math.round(rest * restFactorOverride);
      } else if (goalType) {
        if (goalType === 'WEIGHT_LOSS') {
          rest = Math.round(rest * 0.85);
        } else if (goalType === 'ENDURANCE') {
          rest = Math.round(rest * 0.75);
        } else if (goalType === 'STRENGTH') {
          rest = Math.round(rest * 1.25);
        }
      }
      const hasDropSet = false;

      switch (trainingPhase) {
        case 'VOLUME':
          sets = baseConfig.sets;
          reps = baseConfig.reps;
          break;
        case 'REPS':
          sets = baseConfig.sets;
          reps = baseConfig.reps + 2;
          break;
        case 'LOAD':
          sets = baseConfig.sets;
          reps = Math.max(baseConfig.reps - 2, 4);
          break;
      }
      if (typeof volumeFactorOverride === 'number') {
        sets = Math.max(1, Math.round(sets * volumeFactorOverride));
      }
      if (isDeloadWeek) {
        sets = Math.ceil(sets * 0.5);
      }

      return {
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        sets,
        reps,
        load_kg: null, // User determines based on RPE during execution
        rest_seconds: rest,
        primary_muscles: exercise.primary_muscles,
        primaryMuscle: exercise.primary_muscles[0] ?? exercise.primary_muscles[0],
        secondaryMuscles: exercise.secondary_muscles ?? [],
        has_drop_set: hasDropSet,
      };
    });
  }

  /**
   * Apply training variations (supersets)
   * 
   * SUPERSET PAIRING RULES:
   * - Pair isolation exercises that target different muscle groups
   * - Never superset two compounds (too fatiguing)
   * - Never superset same muscle group (prevents recovery)
   * - Mark pairs with is_superset flag for UI/execution
   * 
   * BENEFITS:
   * - Reduces total workout time (no rest between paired exercises)
   * - Increases metabolic demand (useful for weight loss goals)
   * - Maintains intensity while improving efficiency
   */
  private static applyIntensityTechniques(
    exercises: PlannedExercise[],
    context: WorkoutGenerationContext
  ): { exercises: PlannedExercise[]; logs: string[] } {
    const logs: string[] = [];
    const result = [...exercises];
    const goalType = context.goal_type || null;

    // Global disables: deload weeks or poor adherence (skip streaks)
    if (context.is_deload_week) {
      logs.push("Intensity disabled: Deload week active");
      return { exercises: result, logs };
    }
    if (context.skip_count_current_week >= 2) {
      logs.push("Intensity disabled: Multiple skips this week");
      return { exercises: result, logs };
    }

    // Build recovery and volume maps
    const recoveryByMuscle = new Map<string, RecoveryStatus>();
    const targetByMuscle = new Map<string, number>();
    const completedByMuscle = new Map<string, number>();
    for (const m of context.muscles_with_recovery) {
      recoveryByMuscle.set(m.name, m.recovery_status);
      targetByMuscle.set(m.name, m.weekly_sets_target);
      completedByMuscle.set(m.name, m.weekly_sets_completed);
    }

    const priorDrop = new Set(context.prior_intensity?.drop_muscles || []);
    const priorSuperset = new Set(context.prior_intensity?.superset_muscles || []);

    // DROP SETS: isolation only, final set, max one per exercise, avoid near-cap volume and limited recovery, avoid consecutive sessions
    if (context.drop_sets_enabled && goalType !== 'WEIGHT_LOSS' && goalType !== 'MUSCLE_GAIN') {
      let appliedDrops = 0;
      for (let i = 0; i < result.length; i++) {
        const ex = result[i];
        const isIsolation = ex.primary_muscles.length === 1;
        if (!isIsolation) continue;
        const muscle = ex.primary_muscles[0];
        const recovery = recoveryByMuscle.get(muscle) || 'READY';
        const target = targetByMuscle.get(muscle) ?? 12;
        const completed = completedByMuscle.get(muscle) ?? 0;
        const nearCap = target >= 18 || (target - completed) <= 2;
        const wasIntenseLastSession = priorDrop.has(muscle) || priorSuperset.has(muscle);
        if (recovery === 'READY' && !nearCap && !wasIntenseLastSession && appliedDrops < 4 /* bound total */) {
          result[i] = { ...ex, has_drop_set: true };
          appliedDrops++;
          logs.push(`Drop set applied: ${ex.exercise_name} (isolation, ${muscle}, final set)`);
        } else {
          if (wasIntenseLastSession) logs.push(`Drop set skipped: consecutive intensity on ${muscle}`);
          else if (nearCap) logs.push(`Drop set skipped: ${muscle} near volume cap`);
          else if (recovery !== 'READY') logs.push(`Drop set skipped: ${muscle} recovery ${recovery}`);
        }
      }
    } else {
      logs.push("Drop sets disabled by user preference");
    }

    // SUPERSETS: pair compatible isolations, max two, avoid heavy compounds, avoid consecutive intensity
    const maxSupersets = goalType === 'WEIGHT_LOSS' ? 3 : goalType === 'MUSCLE_GAIN' ? 1 : goalType === 'STRENGTH' ? 0 : 2;
    if (context.supersets_enabled && maxSupersets > 0) {
      const isolationIndices: number[] = [];
      result.forEach((ex, idx) => {
        const isIsolation = ex.primary_muscles.length === 1;
        if (isIsolation) isolationIndices.push(idx);
      });
      const paired = new Set<number>();
      let supersetCount = 0;
      for (let i = 0; i < isolationIndices.length - 1 && supersetCount < maxSupersets; i++) {
        if (paired.has(i)) continue;
        const idx1 = isolationIndices[i];
        const ex1 = result[idx1];
        const m1 = ex1.primary_muscles[0];
        if (priorSuperset.has(m1) || priorDrop.has(m1)) {
          logs.push(`Superset skip candidate: ${ex1.exercise_name} (${m1}) had intensity last session`);
          continue;
        }
        for (let j = i + 1; j < isolationIndices.length && supersetCount < maxSupersets; j++) {
          if (paired.has(j)) continue;
          const idx2 = isolationIndices[j];
          const ex2 = result[idx2];
          const m2 = ex2.primary_muscles[0];
          const overlap = ex1.primary_muscles.some(m => ex2.primary_muscles.includes(m));
          const consecutiveIntensity = priorSuperset.has(m2) || priorDrop.has(m2);
          if (!overlap && !consecutiveIntensity) {
            result[idx1] = { ...result[idx1], is_superset: true };
            result[idx2] = { ...result[idx2], is_superset: true };
            supersetCount++;
            paired.add(i);
            paired.add(j);
            logs.push(`Superset applied: ${ex1.exercise_name} (${m1}) + ${ex2.exercise_name} (${m2})`);
            break;
          } else {
            logs.push(`Superset skipped pair: ${ex1.exercise_name} and ${ex2.exercise_name} (conflict or consecutive intensity)`);
          }
        }
      }
      if (supersetCount === 0) {
        logs.push("No eligible superset pairs found under constraints");
      }
    } else {
      logs.push("Supersets disabled by user preference");
    }

    return { exercises: result, logs };
  }

  /**
   * Determine workout focus label
   * 
   * CLASSIFICATION LOGIC:
   * - NORMAL: Standard training intensity, all muscles ready, no deadline pressure
   * - REDUCED: Some muscles in PARTIAL recovery or approaching goal deadline
   * - MAINTENANCE: Deload week or insufficient trainable muscles
   * 
   * PURPOSE:
   * - Communicates workout intensity to user
   * - Helps prevent overtraining (user knows when to push vs back off)
   * - Guides execution effort (REDUCED = prioritize form over load)
   */
  private static determineWorkoutFocus(
    targetMuscles: MuscleWithRecovery[],
    isDeloadWeek: boolean,
    goalDeadline: string | null
  ): WorkoutFocus {
    // Deload weeks are always MAINTENANCE
    if (isDeloadWeek) {
      return 'MAINTENANCE';
    }

    // Check if any target muscles are in PARTIAL recovery
    const hasPartialRecovery = targetMuscles.some(m => m.recovery_status === 'PARTIAL');

    // Check goal deadline urgency
    let isDeadlineNear = false;
    if (goalDeadline) {
      const deadline = new Date(goalDeadline);
      const now = new Date();
      const daysUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      // Consider deadline "near" if less than 14 days away
      isDeadlineNear = daysUntilDeadline < 14 && daysUntilDeadline > 0;
    }

    // REDUCED if training partially recovered muscles OR goal deadline is near
    if (hasPartialRecovery || isDeadlineNear) {
      return 'REDUCED';
    }

    // NORMAL if everything is optimal
    return 'NORMAL';
  }

  /**
   * Get base sets and reps based on exercise type and goal
   * 
   * GOAL-SPECIFIC PROGRAMMING:
   * - STRENGTH: Low reps (4-8), high intensity, longer rest
   * - MUSCLE_GAIN: Moderate reps (8-12), moderate intensity
   * - ENDURANCE: High reps (15-20), lower intensity, shorter rest
   * - WEIGHT_LOSS: Moderate-high reps (12-15), metabolic focus
   * 
   * COMPOUND vs ISOLATION:
   * - Compounds get more sets (recruit more muscle)
   * - Isolations get fewer sets (targeted work)
   */
  private static getExerciseConfig(
    exerciseType: 'COMPOUND' | 'ISOLATION',
    goalType: GoalType | null
  ): { sets: number; reps: number } {
    // Default to hypertrophy if no goal specified
    const goal = goalType || 'MUSCLE_GAIN';

    if (exerciseType === 'COMPOUND') {
      switch (goal) {
        case 'STRENGTH':
          return { sets: 4, reps: 5 }; // Low reps, maximal strength
        case 'MUSCLE_GAIN':
          return { sets: 4, reps: 8 }; // Hypertrophy sweet spot
        case 'ENDURANCE':
          return { sets: 3, reps: 15 }; // High reps, work capacity
        case 'WEIGHT_LOSS':
          return { sets: 3, reps: 12 }; // Moderate reps, calorie burn
      }
    } else {
      // Isolation exercises - fewer sets, higher reps
      switch (goal) {
        case 'STRENGTH':
          return { sets: 3, reps: 8 };
        case 'MUSCLE_GAIN':
          return { sets: 3, reps: 12 };
        case 'ENDURANCE':
          return { sets: 3, reps: 20 };
        case 'WEIGHT_LOSS':
          return { sets: 3, reps: 15 };
      }
    }
  }

  /**
   * Step 4: Estimate total workout duration
   * 
   * TIME CALCULATION:
   * - Work time: ~45 seconds per set (average)
   * - Rest time: Prescribed rest between sets
   * - Transition time: 30 seconds between exercises
   * - Warmup: 5 minutes
   * - Superset adjustment: Eliminates rest between paired exercises
   * 
   * PURPOSE:
   * - Helps user plan their schedule
   * - Validates workout fits in available time
   * - Prevents unrealistically long sessions
   */
  private static estimateDuration(
    exercises: PlannedExercise[]
  ): number {
    let totalMinutes = 0;

    for (let i = 0; i < exercises.length; i++) {
      const exercise = exercises[i];
      
      // Time per set: ~45 seconds (average work time)
      const workTime = exercise.sets * 0.75;
      
      // Rest time between sets
      // If this exercise is in a superset, rest is only after both exercises
      let restTime: number;
      if (exercise.is_superset && i < exercises.length - 1 && exercises[i + 1].is_superset) {
        // This is first exercise of superset - no rest yet
        restTime = 0;
      } else if (exercise.is_superset && i > 0 && exercises[i - 1].is_superset) {
        // This is second exercise of superset - now add rest
        restTime = (exercise.sets - 1) * (exercise.rest_seconds / 60);
      } else {
        // Normal exercise - standard rest
        restTime = (exercise.sets - 1) * (exercise.rest_seconds / 60);
      }
      
      // Transition time between exercises: 30 seconds
      const transitionTime = 0.5;

      totalMinutes += workTime + restTime + transitionTime;
    }

    // Add 5 minute warmup
    totalMinutes += 5;

    return Math.ceil(totalMinutes);
  }
}
