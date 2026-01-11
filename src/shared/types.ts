// Core Data Types

export type TrainingAge = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type GoalType = 'WEIGHT_LOSS' | 'MUSCLE_GAIN' | 'STRENGTH' | 'ENDURANCE';
export type GoalStatus = 'ACTIVE' | 'ACHIEVED' | 'MISSED' | 'ABANDONED';
export type WorkoutStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
export type TrainingPhase = 'VOLUME' | 'REPS' | 'LOAD' | 'DELOAD';
export type ExerciseType = 'COMPOUND' | 'ISOLATION';
export type EquipmentType = 'BARBELL' | 'DUMBBELLS' | 'CABLE' | 'MACHINE' | 'BODYWEIGHT';
export type WorkoutFocus = 'NORMAL' | 'REDUCED' | 'MAINTENANCE';

export interface User {
  id: number;
  equipment_available: string[]; // JSON array
  training_days_per_week: number;
  current_training_age: TrainingAge;
  drop_sets_enabled: boolean;
  supersets_enabled: boolean;
  height_cm?: number | null;
  weight_kg?: number | null;
  age_years?: number | null;
  sex?: 'MALE' | 'FEMALE' | 'UNKNOWN';
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: number;
  user_id: number;
  type: GoalType;
  target_value: number;
  baseline_value: number;
  deadline: string; // ISO date string
  status: GoalStatus;
  created_at: string;
  updated_at: string;
}

export interface Muscle {
  id: number;
  name: string;
  last_trained_at: string | null;
  recovery_hours_required: number;
  weekly_sets_completed: number;
  weekly_sets_target: number;
  created_at: string;
  updated_at: string;
}

export interface Exercise {
  id: number;
  name: string;
  primary_muscles: string[]; // JSON array
  secondary_muscles: string[]; // JSON array
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  equipment_required: EquipmentType;
  exercise_type: ExerciseType;
  default_rest_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface PlannedExercise {
  exercise_id: number;
  exercise_name: string;
  sets: number;
  reps: number;
  load_kg: number | null;
  rest_seconds: number;
  primary_muscles: string[];
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  is_superset?: boolean; // Paired with next exercise
  has_drop_set?: boolean; // Final set is a drop set
}

export interface CompletedSet {
  set_number: number;
  reps_completed: number;
  load_kg: number | null;
  rpe: number | null; // Rate of Perceived Exertion (1-10)
}

export interface CompletedExercise {
  exercise_id: number;
  exercise_name: string;
  sets: CompletedSet[];
}

export interface WorkoutPlan {
  id: number;
  user_id: number;
  goal_id: number | null;
  generated_at: string;
  scheduled_date: string; // ISO date string
  status: WorkoutStatus;
  estimated_duration_minutes: number;
  exercises: PlannedExercise[]; // JSON array
  focus_label: WorkoutFocus;
  targetMuscles?: string[];
  created_at: string;
  updated_at: string;
}

export interface WorkoutSession {
  id: number;
  workout_plan_id: number;
  started_at: string;
  completed_at: string | null;
  completed_exercises: CompletedExercise[]; // JSON array
  notes: string | null;
  overall_difficulty: number | null; // 1-10 scale
  created_at: string;
  updated_at: string;
}

export interface TrainingState {
  id: number;
  user_id: number;
  current_week: number;
  current_phase: TrainingPhase;
  cycle_start_date: string; // ISO date string
  skip_count_current_week: number;
  last_deload_date: string | null; // ISO date string
  created_at: string;
  updated_at: string;
}

// Progression Types
export type ProgressionChangeType = 'NONE' | 'VOLUME' | 'REPS' | 'LOAD' | 'DELOAD';

export interface MuscleProgressionUpdate {
  muscle_name: string;
  change: ProgressionChangeType;
  previous_weekly_target: number;
  new_weekly_target: number;
  rationale: string;
}

export interface ProgressionResult {
  applied_week: number;
  phase_changed_to?: TrainingPhase;
  deload_triggered: boolean;
  muscle_updates: MuscleProgressionUpdate[];
  logs: string[];
}

// Goal Alignment Types
export type GoalRealism = 'SAFE' | 'AGGRESSIVE' | 'RISKY';

export interface TrainingBiasRecommendation {
  frequency_recommended: number;
  volume_factor: number;
  exercise_emphasis: 'COMPOUND' | 'BALANCED' | 'ISOLATION';
  rest_factor: number;
  deload_frequency_weeks: number;
  reduce_intensity_techniques: boolean;
}

export interface GoalAlignmentResult {
  realism: GoalRealism;
  required_weekly_rate_kg: number;
  calories_maintenance: number;
  calories_target_min: number;
  calories_target_max: number;
  training_bias: TrainingBiasRecommendation;
  behind_schedule: boolean;
  suggested_extension_weeks?: number;
  logs: string[];
}

// Recovery Status Types
export type RecoveryStatus = 'READY' | 'PARTIAL' | 'BLOCKED';

export interface MuscleRecoveryStatus {
  muscle_name: string;
  status: RecoveryStatus;
  hours_since_training: number;
  hours_until_ready: number;
}

// Muscle Selection Types
export type MuscleSelectionDecision = 'APPROVED_FULL' | 'APPROVED_REDUCED' | 'DISCOURAGED';

export interface MuscleSelectionResult {
  decision: MuscleSelectionDecision;
  reason: string;
  recommended_action: string;
  alternative_muscle?: string;
  volume_reduction_percentage?: number;
  can_override: boolean;
  warning_message?: string;
  workout_plan?: WorkoutPlan; // Generated workout if approved
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
