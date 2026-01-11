# Feature 2: 3D Body Muscle Selector - Implementation Documentation

## Overview

Feature 2 allows users to request training for a specific muscle group through a visual interface. Unlike manual exercise selection, the user only requests a muscle - the system validates the request and makes the final decision on whether to approve, reduce, or discourage training.

## Architecture

### 1. Muscle Selection Validation Engine (`muscle-selector.ts`)

**Location**: `src/worker/engines/muscle-selector.ts`

**Purpose**: Evaluates muscle training requests using deterministic rule-based logic.

#### Decision Flow

```
User Selects Muscle
        ↓
[Check Recovery Window]
        ↓
    BLOCKED? → DISCOURAGED (suggest alternative)
        ↓ NO
[Check Weekly Volume]
        ↓
   At/Above Target? → DISCOURAGED (suggest alternative)
        ↓ NO
[Check Recovery Status]
        ↓
    PARTIAL? → APPROVED_REDUCED (60% volume)
        ↓ NO
[Check Goal Deadline]
        ↓
  Within 7 Days? → APPROVED_REDUCED (50% volume)
        ↓ NO
[Check Volume Deficit]
        ↓
   High Deficit? → APPROVED_FULL (priority)
        ↓
    DEFAULT → APPROVED_FULL (normal)
```

#### Decision Types

1. **APPROVED_FULL**
   - Muscle is fully recovered
   - Weekly volume has room to grow
   - No deadline constraints
   - **Action**: Generate full intensity workout

2. **APPROVED_REDUCED**
   - Muscle is partially recovered (36-48 hours)
   - OR goal deadline is within 7 days (tapering)
   - **Action**: Generate workout with 50-60% volume reduction
   - **Override**: User can force full volume (with warning)

3. **DISCOURAGED**
   - Muscle is blocked (in recovery window)
   - OR weekly volume already at/above target
   - **Action**: Suggest alternative muscle or rest
   - **Override**: Depends on reason
     - Recovery block: Cannot override (injury prevention)
     - Volume block: Can override (soft limit)

#### Alternative Muscle Selection

When training is discouraged, the system suggests an alternative muscle:

**Selection Criteria** (in priority order):
1. Must be in READY state (fully recovered)
2. Must have positive volume deficit (room to grow)
3. Prefer synergistic muscles (e.g., if user requested Chest, suggest Shoulders or Triceps)
4. Otherwise suggest muscle with highest volume deficit

**Synergy Map**:
```typescript
{
  'Chest': ['Shoulders', 'Triceps'],     // Push muscles
  'Back': ['Biceps', 'Shoulders'],       // Pull muscles
  'Shoulders': ['Chest', 'Triceps'],     // Push muscles
  'Biceps': ['Back'],                    // Pull muscles
  'Triceps': ['Chest', 'Shoulders'],     // Push muscles
  'Quads': ['Hamstrings', 'Glutes'],     // Leg muscles
  'Hamstrings': ['Quads', 'Glutes'],     // Leg muscles
  'Glutes': ['Quads', 'Hamstrings'],     // Leg muscles
}
```

### 2. Backend API Endpoint

**Location**: `src/worker/index.ts`

**Endpoint**: `POST /api/muscle/request`

**Request Body**:
```typescript
{
  muscle_name: string;        // e.g., "Chest"
  force_override?: boolean;   // Default false
}
```

**Response**:
```typescript
{
  success: boolean;
  data: {
    decision: 'APPROVED_FULL' | 'APPROVED_REDUCED' | 'DISCOURAGED';
    reason: string;
    recommended_action: string;
    alternative_muscle?: string;
    volume_reduction_percentage?: number;
    can_override: boolean;
    warning_message?: string;
    workout_plan?: WorkoutPlan;  // Only if approved
  }
}
```

#### Request Processing Logic

1. **Load User Context**
   - User preferences (equipment, training age)
   - Training state (current phase, week)
   - Active goal (type, deadline)

2. **Calculate Recovery Status**
   - For requested muscle: READY / PARTIAL / BLOCKED
   - For all muscles: Used for alternative suggestions

3. **Build Request Context**
   - Muscle name
   - Recovery hours since last training
   - Weekly volume completed vs target
   - Goal type and deadline

4. **Evaluate Request**
   - Call `MuscleSelector.evaluateRequest()`
   - Returns decision with reasoning

5. **Handle Decision**
   - **DISCOURAGED + No Override**: Return decision only (no workout)
   - **APPROVED or Override**: Generate focused workout
   - **Hard Block + Override Attempt**: Reject with error

6. **Generate Workout** (if approved)
   - Filter exercises to requested muscle
   - Apply volume reduction if APPROVED_REDUCED
   - Use standard `WorkoutGenerator.generate()`
   - Store workout plan in database
   - Return decision + workout plan

### 3. Frontend UI

**Location**: `src/react-app/pages/MuscleSelector.tsx`

**Route**: `/select-muscle`

#### UI Components

1. **Muscle Selection Grid**
   - Organized by muscle group categories:
     - Upper Push (Chest, Shoulders, Triceps)
     - Upper Pull (Back, Biceps)
     - Legs (Quads, Hamstrings, Glutes, Calves)
     - Core (Abs)
   - Each muscle shows:
     - Recovery status (Ready/Partial/Blocked)
     - Hours until ready (if applicable)
     - Visual color coding

2. **3D Body Placeholder**
   - Currently shows placeholder message
   - Architecture ready for future 3D integration
   - API endpoints designed for 3D interaction

3. **Evaluation Result Panel**
   - Shows decision with reasoning
   - Displays recommended action
   - Presents volume reduction if applicable
   - Shows warning messages
   - Provides action buttons:
     - View generated workout (if approved)
     - Try alternative muscle (if suggested)
     - Override and train anyway (if allowed)
     - Select different muscle

#### User Flow

1. User views muscle grid with recovery status
2. User clicks on a muscle
3. System sends request to `/api/muscle/request`
4. System evaluates and responds with decision
5. UI displays decision + reasoning
6. User can:
   - View workout (if approved)
   - Try alternative (if suggested)
   - Override (if allowed)
   - Select different muscle

## Rule-Based Decision Logic

### Rule 1: Recovery Window (Hard Block)

**Condition**: `hours_since_training < 36`

**Status**: BLOCKED

**Decision**: DISCOURAGED

**Can Override**: NO

**Reasoning**: Training muscles in early recovery window risks injury and impairs growth. This is a safety constraint that cannot be overridden.

**Example**:
```
User requests: Chest
Last trained: 18 hours ago
Recovery required: 48 hours
→ DISCOURAGED: "Chest is still recovering and needs 30 more hours of rest"
→ Alternative: Shoulders (ready, synergistic)
```

### Rule 2: Weekly Volume Limit (Soft Block)

**Condition**: `weekly_sets_completed >= weekly_sets_target`

**Decision**: DISCOURAGED

**Can Override**: YES

**Reasoning**: Volume targets are guidelines. Exceeding them may cause overtraining, but experienced users may benefit from extra volume.

**Example**:
```
User requests: Quads
Volume completed: 14 sets
Volume target: 12 sets
→ DISCOURAGED: "Quads has already completed 14/12 weekly sets (117% of target)"
→ Alternative: Hamstrings (8 sets remaining)
→ Override available: User can train anyway with warning
```

### Rule 3: Partial Recovery (Approved with Reduction)

**Condition**: `36 ≤ hours_since_training < recovery_hours_required`

**Status**: PARTIAL

**Decision**: APPROVED_REDUCED (60% volume reduction)

**Can Override**: YES (to full volume)

**Reasoning**: Muscle has partially recovered. Training is safe but should be limited to allow continued recovery.

**Example**:
```
User requests: Back
Last trained: 40 hours ago
Recovery required: 48 hours
→ APPROVED_REDUCED: 60% volume reduction
→ Normal: 4 sets compound + 3 sets isolation
→ Reduced: 2 sets compound + 1 set isolation
```

### Rule 4: Goal Deadline Tapering (Approved with Reduction)

**Condition**: `days_until_deadline < 7`

**Decision**: APPROVED_REDUCED (50% volume reduction)

**Reasoning**: When approaching a goal deadline, reduce training volume to allow peak recovery and performance.

**Example**:
```
User requests: Shoulders
Goal deadline: 5 days away
→ APPROVED_REDUCED: "Goal deadline is in 5 days. Tapering volume for peak performance"
→ 50% volume reduction
```

### Rule 5: High Volume Deficit (Approved, Priority)

**Condition**: `volume_deficit >= 8 sets`

**Decision**: APPROVED_FULL

**Reasoning**: Muscle is significantly behind on weekly volume. Prioritize training this muscle.

**Example**:
```
User requests: Biceps
Volume completed: 2 sets
Volume target: 12 sets
Volume deficit: 10 sets
→ APPROVED_FULL: "Biceps is 10 sets behind weekly target. Priority muscle for training"
```

### Rule 6: Default (Approved, Normal)

**Condition**: All checks passed

**Decision**: APPROVED_FULL

**Reasoning**: Muscle is ready, has room for volume, no constraints.

**Example**:
```
User requests: Triceps
Status: READY
Volume: 5/12 sets (7 remaining)
→ APPROVED_FULL: "Triceps is fully recovered with 7 sets remaining in weekly target"
```

## Integration with Existing Systems

### Workout Generation Engine

When a muscle request is approved, the system:

1. Filters `muscles_with_recovery` to only the requested muscle
2. Applies volume reduction if APPROVED_REDUCED (via `is_deload_week` flag)
3. Calls `WorkoutGenerator.generate()` with filtered context
4. Returns focused workout for requested muscle

**Example**:
```typescript
// Request approved for Chest with 60% reduction
const generatedWorkout = WorkoutGenerator.generate({
  user_equipment: ['BARBELL', 'DUMBBELLS'],
  training_phase: 'VOLUME',
  goal_type: 'MUSCLE_GAIN',
  muscles_with_recovery: [chest_muscle_only],  // Filtered to requested muscle
  available_exercises: chest_exercises,         // Filtered to chest
  is_deload_week: true,                        // Triggers volume reduction
  drop_sets_enabled: true,
  supersets_enabled: false,
});
```

### Volume & Progression Engine

Muscle selection respects volume tracking:
- Checks `weekly_sets_completed` vs `weekly_sets_target`
- Prioritizes muscles with higher volume deficit
- Prevents exceeding weekly limits (with override option)

### Muscle Recovery Engine

Recovery status drives decision-making:
- **BLOCKED**: Training denied (hard block)
- **PARTIAL**: Training allowed with reduction
- **READY**: Training fully approved

### Goal & Deadline Engine

Goal deadline affects volume prescription:
- Deadline within 7 days: Reduce volume to taper
- Deadline > 7 days: Normal volume
- No deadline: Normal volume

## Future Enhancements

### 3D Body Model Integration

The current implementation uses a 2D grid placeholder. Future 3D integration:

1. **Visual Selection**: Click on 3D body part instead of grid
2. **Hover Information**: Show recovery status on hover
3. **Color Coding**: Visual representation of READY/PARTIAL/BLOCKED
4. **Rotation**: View body from multiple angles
5. **Muscle Highlighting**: Show synergistic muscles

**API Compatibility**: Current `/api/muscle/request` endpoint is ready for 3D interaction. Simply pass `muscle_name` from 3D click event.

### Advanced Features

1. **Muscle Group Requests**: Request multiple synergistic muscles (e.g., "Upper Push")
2. **Time-Based Recommendations**: Suggest best muscle based on time available
3. **Equipment-Based Filtering**: Only show muscles trainable with current equipment
4. **Historical Analysis**: Track which muscles user most frequently requests

## Testing Scenarios

### Scenario 1: Blocked Muscle Request

```
Input: Request Quads (last trained 12 hours ago)
Expected: DISCOURAGED
Reason: Still recovering (needs 36 more hours)
Alternative: Chest (ready, different muscle group)
Override: Not allowed
```

### Scenario 2: Volume Limit Reached

```
Input: Request Shoulders (14/12 sets completed)
Expected: DISCOURAGED
Reason: Weekly volume already at 117% of target
Alternative: Triceps (4/12 sets, high deficit)
Override: Allowed (with warning)
```

### Scenario 3: Partial Recovery

```
Input: Request Back (last trained 40 hours ago, needs 48)
Expected: APPROVED_REDUCED
Reason: Partially recovered
Volume Reduction: 60%
Override: Can increase to full volume
```

### Scenario 4: Approaching Deadline

```
Input: Request Chest (deadline in 5 days)
Expected: APPROVED_REDUCED
Reason: Tapering for goal deadline
Volume Reduction: 50%
```

### Scenario 5: Normal Approval

```
Input: Request Biceps (ready, 4/12 sets)
Expected: APPROVED_FULL
Reason: Fully recovered, volume available
Workout Generated: Full intensity
```

## Code Quality

### Deterministic Logic

All decisions are deterministic and rule-based:
- Same inputs always produce same outputs
- No randomness or ML models
- Clear if/else decision tree
- Fully testable

### Extensibility

The system is designed for easy extension:
- New rules can be added to evaluation logic
- Decision types can be expanded
- Alternative selection can be customized
- Volume reduction percentages are configurable

### Safety

Multiple safety mechanisms:
- Hard blocks prevent injury-risk scenarios
- Soft blocks warn but allow override
- Clear warning messages explain risks
- Alternative suggestions guide safe choices

## Summary

Feature 2 successfully implements muscle-specific workout requests while maintaining system control over final decisions. The implementation:

✅ Validates recovery status before approving training
✅ Respects weekly volume limits
✅ Provides alternative muscle suggestions
✅ Supports volume reduction for partial recovery
✅ Integrates with existing workout generation engine
✅ Uses deterministic rule-based logic
✅ Provides clear user feedback with reasoning
✅ Allows safe overrides where appropriate
✅ Prevents unsafe training decisions

The architecture is ready for future 3D body model integration while currently functioning with a 2D grid interface.
