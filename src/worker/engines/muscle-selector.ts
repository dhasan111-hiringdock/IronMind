import type { 
  RecoveryStatus,
  GoalType
} from "@/shared/types";

/**
 * Muscle Selection Decision Types
 */
export type MuscleSelectionDecision = 
  | 'APPROVED_FULL'      // Full intensity workout approved
  | 'APPROVED_REDUCED'   // Reduced intensity workout approved
  | 'DISCOURAGED';       // Training not recommended

export interface MuscleSelectionRequest {
  muscle_name: string;
  recovery_status: RecoveryStatus;
  hours_since_last_trained: number | null;
  recovery_hours_required: number;
  weekly_sets_completed: number;
  weekly_sets_target: number;
  goal_type: GoalType | null;
  goal_deadline: string | null;
}

export interface MuscleSelectionResult {
  decision: MuscleSelectionDecision;
  reason: string;
  recommended_action: string;
  alternative_muscle?: string;
  volume_reduction_percentage?: number; // For APPROVED_REDUCED
  can_override: boolean; // Whether user can force training anyway
  warning_message?: string; // Shown if user overrides
}

/**
 * Muscle Selection Validation Engine
 * 
 * CORE PRINCIPLE:
 * User can request to train a specific muscle, but the system makes the final decision.
 * The system validates recovery status, volume limits, and goal alignment before approval.
 * 
 * DECISION FLOW:
 * 1. Check if muscle is BLOCKED (in recovery window) → DISCOURAGED
 * 2. Check if weekly volume is already at/above target → DISCOURAGED
 * 3. Check if muscle is PARTIAL (partially recovered) → APPROVED_REDUCED
 * 4. Check goal deadline urgency → May affect intensity
 * 5. Default to APPROVED_FULL if all checks pass
 * 
 * ANTI-PATTERNS PREVENTED:
 * - Training muscles that need recovery (injury prevention)
 * - Exceeding weekly volume limits (overtraining prevention)
 * - Ignoring goal priorities (intelligent programming)
 */
export class MuscleSelector {
  
  /**
   * Evaluate a muscle selection request
   * 
   * Returns a decision with reasoning and recommendations.
   * The decision is deterministic based on current training state.
   */
  static evaluateRequest(
    request: MuscleSelectionRequest,
    allMuscles: Array<{
      name: string;
      recovery_status: RecoveryStatus;
      volume_deficit: number;
    }>
  ): MuscleSelectionResult {
    
    // RULE 1: Check recovery window
    // If muscle is BLOCKED (< 36 hours), strongly discourage training
    if (request.recovery_status === 'BLOCKED') {
      const hoursUntilReady = request.recovery_hours_required - (request.hours_since_last_trained || 0);
      
      // Find alternative muscle that's ready to train
      const alternativeMuscle = this.findBestAlternative(request.muscle_name, allMuscles);
      
      return {
        decision: 'DISCOURAGED',
        reason: `${request.muscle_name} is still recovering and needs ${Math.round(hoursUntilReady)} more hours of rest.`,
        recommended_action: alternativeMuscle 
          ? `Train ${alternativeMuscle} instead, which is fully recovered.`
          : 'Take a rest day or train a different muscle group that is fully recovered.',
        alternative_muscle: alternativeMuscle,
        can_override: false, // Hard block - training would risk injury
        warning_message: 'Training this muscle now may lead to overtraining or injury.',
      };
    }

    // RULE 2: Check weekly volume limits
    // If muscle has already hit weekly target, discourage additional volume
    const volumeDeficit = request.weekly_sets_target - request.weekly_sets_completed;
    
    if (volumeDeficit <= 0) {
      const alternativeMuscle = this.findBestAlternative(request.muscle_name, allMuscles);
      
      return {
        decision: 'DISCOURAGED',
        reason: `${request.muscle_name} has already completed ${request.weekly_sets_completed}/${request.weekly_sets_target} weekly sets (${Math.round((request.weekly_sets_completed / request.weekly_sets_target) * 100)}% of target).`,
        recommended_action: alternativeMuscle
          ? `Train ${alternativeMuscle} instead, which has ${allMuscles.find(m => m.name === alternativeMuscle)?.volume_deficit || 0} sets remaining.`
          : 'Focus on muscles that are behind on weekly volume.',
        alternative_muscle: alternativeMuscle,
        can_override: true, // Soft block - user can override if they want extra volume
        warning_message: 'Adding more volume may lead to diminishing returns or overtraining.',
      };
    }

    // RULE 3: Check for PARTIAL recovery
    // If muscle is partially recovered (36-48 hours), approve reduced volume
    if (request.recovery_status === 'PARTIAL') {
      return {
        decision: 'APPROVED_REDUCED',
        reason: `${request.muscle_name} is partially recovered (${request.hours_since_last_trained} hours since last training).`,
        recommended_action: 'Approved with 60% volume reduction to allow continued recovery while maintaining stimulus.',
        volume_reduction_percentage: 60,
        can_override: true,
        warning_message: 'Training at full volume while partially recovered may impede recovery.',
      };
    }

    // RULE 4: Check goal deadline urgency
    // If goal deadline is very close, may recommend reduced volume to prevent burnout
    if (request.goal_deadline) {
      const deadline = new Date(request.goal_deadline);
      const now = new Date();
      const daysUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      // If deadline is within 7 days, recommend reduced volume to peak for deadline
      if (daysUntilDeadline > 0 && daysUntilDeadline <= 7) {
        return {
          decision: 'APPROVED_REDUCED',
          reason: `Goal deadline is in ${Math.round(daysUntilDeadline)} days. Tapering volume for peak performance.`,
          recommended_action: 'Approved with 50% volume reduction to allow for optimal recovery before deadline.',
          volume_reduction_percentage: 50,
          can_override: true,
          warning_message: 'High volume close to deadline may compromise performance.',
        };
      }
    }

    // RULE 5: Check if volume is very low
    // If muscle is way behind on weekly volume, encourage training
    if (volumeDeficit >= 8) {
      return {
        decision: 'APPROVED_FULL',
        reason: `${request.muscle_name} is ${volumeDeficit} sets behind weekly target. Priority muscle for training.`,
        recommended_action: 'Full intensity workout approved to catch up on weekly volume.',
        can_override: false,
      };
    }

    // DEFAULT: All checks passed, approve full training
    return {
      decision: 'APPROVED_FULL',
      reason: `${request.muscle_name} is fully recovered with ${volumeDeficit} sets remaining in weekly target.`,
      recommended_action: 'Full intensity workout approved.',
      can_override: false,
    };
  }

  /**
   * Find the best alternative muscle to train
   * 
   * Selection criteria:
   * 1. Must be READY (fully recovered)
   * 2. Prioritize muscles with highest volume deficit
   * 3. Prefer synergistic muscles if possible
   */
  private static findBestAlternative(
    requestedMuscle: string,
    allMuscles: Array<{
      name: string;
      recovery_status: RecoveryStatus;
      volume_deficit: number;
    }>
  ): string | undefined {
    
    // Filter to only READY muscles
    const readyMuscles = allMuscles.filter(m => 
      m.recovery_status === 'READY' && m.name !== requestedMuscle
    );

    if (readyMuscles.length === 0) {
      return undefined;
    }

    // Define synergistic muscle groups
    const synergies: Record<string, string[]> = {
      'Chest': ['Shoulders', 'Triceps'],
      'Back': ['Biceps', 'Shoulders'],
      'Shoulders': ['Chest', 'Triceps'],
      'Biceps': ['Back'],
      'Triceps': ['Chest', 'Shoulders'],
      'Quads': ['Hamstrings', 'Glutes'],
      'Hamstrings': ['Quads', 'Glutes'],
      'Glutes': ['Quads', 'Hamstrings'],
    };

    // First, try to find a synergistic muscle with high volume deficit
    const synergisticMuscles = synergies[requestedMuscle] || [];
    const readySynergistic = readyMuscles.filter(m => 
      synergisticMuscles.includes(m.name) && m.volume_deficit > 0
    );

    if (readySynergistic.length > 0) {
      // Return synergistic muscle with highest volume deficit
      const sorted = readySynergistic.sort((a, b) => b.volume_deficit - a.volume_deficit);
      return sorted[0].name;
    }

    // If no synergistic muscles available, return muscle with highest volume deficit
    const sorted = readyMuscles
      .filter(m => m.volume_deficit > 0)
      .sort((a, b) => b.volume_deficit - a.volume_deficit);
    
    return sorted.length > 0 ? sorted[0].name : undefined;
  }

  /**
   * Generate a focused workout for the approved muscle
   * 
   * This is a specialized version of workout generation that:
   * - Focuses primarily on the selected muscle
   * - May include synergistic muscles
   * - Respects volume reduction if APPROVED_REDUCED
   */
  static generateFocusedExerciseList(
    targetMuscle: string,
    volumeReduction: number,
    availableExercises: Array<{
      id: number;
      name: string;
      primary_muscles: string[];
      secondary_muscles: string[];
      exercise_type: 'COMPOUND' | 'ISOLATION';
    }>
  ): Array<{ exercise_id: number; exercise_name: string; exercise_type: string }> {
    
    const selected: Array<{ exercise_id: number; exercise_name: string; exercise_type: string }> = [];
    
    // Find exercises for target muscle
    const muscleExercises = availableExercises.filter(ex => 
      ex.primary_muscles.includes(targetMuscle)
    );

    // Separate compounds and isolations
    const compounds = muscleExercises.filter(ex => ex.exercise_type === 'COMPOUND');
    const isolations = muscleExercises.filter(ex => ex.exercise_type === 'ISOLATION');

    // Add 1-2 compound exercises
    const compoundCount = volumeReduction > 0 ? 1 : Math.min(2, compounds.length);
    for (let i = 0; i < compoundCount && i < compounds.length; i++) {
      selected.push({
        exercise_id: compounds[i].id,
        exercise_name: compounds[i].name,
        exercise_type: compounds[i].exercise_type,
      });
    }

    // Add 1-2 isolation exercises
    const isolationCount = volumeReduction > 0 ? 1 : Math.min(2, isolations.length);
    for (let i = 0; i < isolationCount && i < isolations.length; i++) {
      selected.push({
        exercise_id: isolations[i].id,
        exercise_name: isolations[i].name,
        exercise_type: isolations[i].exercise_type,
      });
    }

    return selected;
  }
}
