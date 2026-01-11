# GYM APP - SYSTEM BLUEPRINT
## Offline-First Deterministic Workout Planning Application

---

## CORE APP PURPOSE

The application acts as a professional personal trainer that:
- Generates daily workouts automatically using deterministic, rule-based logic
- Adapts training based on recovery windows, training volume, missed sessions, and goal deadlines
- Operates entirely offline without AI/ML APIs or external intelligence services
- Removes decision fatigue by deciding what to train each day
- Provides calm, predictable, and scientifically-grounded training plans

**Key Principle**: The user should never need to decide what to train. The system decides.

---

## NON-NEGOTIABLE CONSTRAINTS

1. **Offline-First Architecture**: All logic runs locally, no external dependencies
2. **Deterministic Logic Only**: If/else rules, thresholds, calculations only
3. **No AI/ML Models**: No machine learning, no neural networks, no AI APIs
4. **No External Intelligence Services**: No OpenAI, no Gemini, no cloud-based decision engines
5. **No Lifestyle Tracking**: No sleep, mood, or journaling features
6. **No Food Logging**: No meal planning or calorie tracking
7. **Goal-Driven Training**: All training adapts to meet specific user goals with deadlines
8. **Training Adapts Before Diet**: System assumes nutrition is handled separately
9. **Weekly Evaluation Windows**: Plans are evaluated weekly, not daily

---

## CORE SYSTEM ENGINES

### 1. Workout Generation Engine

**Responsibility**: Produces the complete daily workout plan

**Core Functions**:
- Selects muscle groups to train based on recovery status and weekly volume targets
- Chooses exercises from a curated set based on muscle targets and equipment availability
- Calculates sets, reps, and load based on goal type and progression rules
- Determines rest periods based on exercise type and intensity
- Generates a complete, executable workout plan each morning

**Inputs**:
- Current recovery state of all muscles
- Weekly volume accumulation per muscle
- User's goal type and deadline
- Last workout completion status
- Current week in training cycle

**Outputs**:
- Ordered list of exercises with muscle targets
- Sets × Reps @ Load for each exercise
- Rest periods between sets
- Estimated workout duration

**Key Rules**:
- Only trains muscles that meet minimum recovery threshold
- Prioritizes muscles furthest behind weekly volume targets
- Adjusts exercise selection based on equipment availability
- Follows goal-specific rep ranges (strength: 3-6, hypertrophy: 8-12, endurance: 15+)
- Balances push/pull/legs across the week

---

### 2. Muscle Recovery Engine

**Responsibility**: Tracks recovery status and enforces recovery windows

**Core Functions**:
- Maintains last-trained timestamp for each muscle group
- Calculates hours since last training session
- Enforces minimum recovery windows before retraining
- Prevents overtraining by blocking premature muscle reuse

**Recovery Windows** (hours since last training):
- **Full Recovery** (ready to train): 48+ hours
- **Partial Recovery** (trainable at reduced volume): 36-48 hours
- **Insufficient Recovery** (blocked): <36 hours

**Muscle Groups Tracked**:
- Chest
- Back
- Shoulders
- Biceps
- Triceps
- Quads
- Hamstrings
- Glutes
- Calves
- Abs
- Lower Back

**Inputs**:
- Workout completion events (muscle, timestamp)
- Current time

**Outputs**:
- Recovery status per muscle (Ready, Partial, Blocked)
- Hours until ready for each muscle
- List of trainable muscles for today

**Key Rules**:
- Minimum 36 hours between sessions per muscle
- Optimal 48+ hours for full recovery
- Compound exercises affect multiple muscles
- Recovery windows are non-negotiable (no overrides)

---

### 3. Volume & Progression Engine

**Responsibility**: Tracks weekly training volume and applies progression rules

**Core Functions**:
- Tracks total sets per muscle per week
- Calculates volume accumulation toward weekly targets
- Applies progressive overload based on goal type
- Detects when deload is needed
- Executes deload weeks when accumulated fatigue exceeds threshold

**Volume Targets** (sets per muscle per week):
- **Maintenance**: 6-8 sets
- **Hypertrophy**: 12-18 sets
- **Strength**: 8-12 sets
- **Endurance**: 15-20 sets

**Progression Rules**:
1. **Week 1-3**: Increase volume (add sets)
2. **Week 4**: Evaluate performance
   - If all workouts completed: Progress to intensity phase
   - If skips occurred: Repeat volume phase
3. **Week 5-7**: Increase reps (keep sets constant)
4. **Week 8**: Evaluate performance
   - If all workouts completed: Progress to load phase
   - If skips occurred: Repeat reps phase
5. **Week 9-11**: Increase load (reduce reps slightly)
6. **Week 12**: Deload (50% volume, same exercises)
7. **Cycle repeats**

**Deload Triggers**:
- Scheduled every 12 weeks
- 3+ consecutive skipped workouts
- User-requested via manual override

**Inputs**:
- Completed workout sessions
- Current week in cycle
- Goal type and targets
- Skip history

**Outputs**:
- Weekly volume per muscle
- Current phase (volume/reps/load/deload)
- Next progression step
- Deload recommendation flag

**Key Rules**:
- One variable changes at a time (volume OR reps OR load)
- Deload is mandatory, not optional
- Volume accumulated weekly, resets Monday
- Missed weeks do not carry over volume debt

---

### 4. Skip-Day Resolution Engine

**Responsibility**: Detects missed workouts and rebalances training intelligently

**Core Functions**:
- Detects when a generated workout was not completed
- Calculates impact on weekly volume targets
- Produces ONE recommended next action
- Rebalances training without stacking excessive volume
- Prevents panic-driven overtraining

**Skip Detection**:
- Workout generated but not started by midnight
- Workout started but abandoned mid-session

**Resolution Strategies**:
1. **Single Skip** (1 missed day):
   - Continue with next planned workout
   - Slightly increase volume in remaining days if possible
   
2. **Multiple Skips** (2 consecutive days):
   - Generate abbreviated "catch-up" workout
   - Focus on muscles furthest behind volume targets
   - Reduced sets per exercise
   
3. **Extended Break** (3+ consecutive days):
   - Treat as unplanned rest week
   - Next workout starts fresh with reduced volume (-20%)
   - Gradually ramp back to normal over 3 workouts

**Inputs**:
- Workout generation timestamp
- Workout completion status
- Current weekly volume per muscle
- Skip history for current week

**Outputs**:
- Single recommended action (continue, catch-up, or fresh start)
- Modified volume targets if needed
- Updated training calendar

**Key Rules**:
- Never stack 2+ missed workouts into one session
- Never train a muscle before minimum recovery (36h)
- Prioritize consistency over compensation
- Three skips trigger automatic deload consideration
- Resolution happens once per skip event, not continuously

---

### 5. Goal & Deadline Engine

**Responsibility**: Evaluates goal realism and adapts training to meet deadlines

**Core Functions**:
- Validates goal feasibility based on deadline
- Calculates required weekly rate of change
- Adjusts training structure (volume, intensity, frequency) to meet goals
- Warns when goals are unrealistic
- Recommends deadline extensions when necessary

**Supported Goals**:
- **Weight Loss**: Lose X kg by date
- **Muscle Gain**: Gain X kg by date
- **Strength**: Lift X kg in exercise Y by date
- **Endurance**: Complete X reps of exercise Y by date

**Feasibility Checks**:
- **Weight Loss**: Max 0.5-1% body weight per week
- **Muscle Gain**: Max 0.25-0.5% body weight per week (varies by training age)
- **Strength**: Progression based on exercise type and current level
- **Endurance**: Rep increases limited by recovery capacity

**Training Adaptations**:
1. Calculate weeks until deadline
2. Calculate required weekly progress rate
3. If rate exceeds safe threshold:
   - Flag goal as "aggressive"
   - Recommend deadline extension
   - Allow user to proceed with warning
4. If rate is safe:
   - Adjust training volume to match required progression
   - Increase frequency if needed (up to 6 days/week max)
   - Modify exercise selection for goal specificity

**Inputs**:
- User goal specification (type, target, deadline)
- Current baseline measurement
- Weeks until deadline
- Historical progress rate

**Outputs**:
- Goal status (realistic, aggressive, unrealistic)
- Required weekly progress rate
- Recommended training adjustments
- Alternative deadline if needed

**Key Rules**:
- Unrealistic goals are rejected (e.g., lose 20kg in 4 weeks)
- Aggressive goals proceed with documented user acceptance
- Training structure adapts to goal, not vice versa
- Weekly evaluation compares actual vs required progress
- Goals can be adjusted mid-cycle with system recalculation

---

### 6. User Intent Adjustment Engine

**Responsibility**: Accepts structured user suggestions and applies safe changes

**Core Functions**:
- Receives user override requests (e.g., "increase sets", "swap exercise")
- Validates changes against safety rules
- Applies changes only if rules allow
- Logs all overrides for system learning
- Prevents chaotic or unsafe modifications

**Allowed Adjustments**:
- Increase/decrease sets per exercise (±1-2 sets)
- Swap exercise for same muscle group
- Adjust rest period (±30 seconds)
- Skip specific exercise (redistributes volume)
- Request earlier deload

**Blocked Adjustments**:
- Train muscle under recovery threshold
- Exceed maximum weekly volume limits
- Reduce rest below safety minimums
- Remove all exercises for a muscle group
- Override goal-driven progression rules

**Override Processing**:
1. User selects adjustment type
2. System validates against current state and rules
3. If valid: Apply and log adjustment
4. If invalid: Explain why and suggest alternative
5. All overrides logged with timestamp and reason

**Inputs**:
- User adjustment request
- Current workout plan
- Recovery state
- Volume accumulation
- Goal constraints

**Outputs**:
- Modified workout plan (if approved)
- Rejection reason (if denied)
- Override log entry
- Alternative suggestion (if applicable)

**Key Rules**:
- User can adjust tactics, not principles
- Safety rules are non-negotiable
- Overrides do not compound (max 2 per workout)
- System remains authoritative on progression
- Frequent overrides trigger "check-in" prompt

---

### 7. Execution & Completion Engine

**Responsibility**: Enforces set-by-set execution and manages workout flow

**Core Functions**:
- Presents exercises one at a time
- Enforces set-by-set completion with rest timers
- Tracks completion status (reps completed, load used)
- Locks workouts after completion to prevent re-editing
- Records performance data for progression calculations

**Execution Flow**:
1. **Pre-Workout**: Display full workout overview, estimated duration
2. **Exercise Loop**:
   - Show current exercise, target reps, recommended load
   - User completes set and logs actual reps + load
   - Start rest timer
   - Repeat for all sets
3. **Between Exercises**: Brief transition (15 seconds)
4. **Post-Workout**: Mark complete, record timestamp, update recovery state

**Rest Timer Rules**:
- Display countdown timer
- Allow early skip with confirmation
- Vibrate/sound alert when rest complete
- Rest periods: 60s (isolation), 90s (compound), 120s (heavy compound)

**Completion Validation**:
- Workout marked complete only when all exercises finished
- Partial completion allowed (saves progress)
- Completion triggers recovery timestamps for trained muscles
- Completed workouts are immutable (cannot edit past sessions)

**Inputs**:
- Generated workout plan
- User set completion (reps, load, RPE)
- Real-time execution state

**Outputs**:
- Exercise-by-exercise UI flow
- Completed workout record
- Performance data for progression
- Updated recovery timestamps

**Key Rules**:
- Cannot skip ahead to later exercises
- Must complete current set before starting timer
- Partial workouts save progress for potential resume
- Completed workouts lock permanently
- Execution data feeds Volume & Progression Engine

---

## DATA MODELS (HIGH LEVEL)

### User
**Purpose**: Stores user profile and training preferences

**Key Fields**:
- `id`: Unique identifier
- `created_at`: Account creation timestamp
- `equipment_available`: List of available equipment (barbell, dumbbells, etc.)
- `training_days_per_week`: Preferred frequency (3-6)
- `current_training_age`: Beginner/Intermediate/Advanced

### Goal
**Purpose**: Represents a training goal with deadline

**Key Fields**:
- `id`: Unique identifier
- `user_id`: Foreign key to User
- `type`: WEIGHT_LOSS | MUSCLE_GAIN | STRENGTH | ENDURANCE
- `target_value`: Numeric target (kg, reps, etc.)
- `baseline_value`: Starting measurement
- `deadline`: Target completion date
- `status`: ACTIVE | ACHIEVED | MISSED | ABANDONED
- `created_at`: Goal start date

**Relationships**:
- Belongs to one User
- Has many WorkoutPlans (generated to achieve this goal)

### Muscle
**Purpose**: Defines trainable muscle groups and recovery status

**Key Fields**:
- `id`: Unique identifier
- `name`: Chest, Back, Shoulders, etc.
- `last_trained_at`: Timestamp of last training session
- `recovery_hours_required`: Minimum recovery time (36-48)
- `weekly_sets_completed`: Current week accumulation
- `weekly_sets_target`: Goal sets for current week

**Relationships**:
- Trained by many Exercises
- Tracked in many WorkoutSessions

### Exercise
**Purpose**: Curated library of exercises with muscle targets

**Key Fields**:
- `id`: Unique identifier
- `name`: Bench Press, Squat, Deadlift, etc.
- `primary_muscles`: Array of primary muscle IDs
- `secondary_muscles`: Array of secondary muscle IDs
- `equipment_required`: Barbell, Dumbbells, Bodyweight, etc.
- `exercise_type`: COMPOUND | ISOLATION
- `default_rest_seconds`: 60-120

**Relationships**:
- Targets multiple Muscles
- Included in many WorkoutPlans

### WorkoutPlan
**Purpose**: Generated daily workout specification

**Key Fields**:
- `id`: Unique identifier
- `user_id`: Foreign key to User
- `goal_id`: Foreign key to Goal
- `generated_at`: Creation timestamp
- `scheduled_date`: Intended execution date
- `status`: PENDING | IN_PROGRESS | COMPLETED | SKIPPED
- `estimated_duration_minutes`: Time estimate
- `exercises`: Array of planned exercises with sets/reps/load

**Relationships**:
- Belongs to one User
- Belongs to one Goal
- Has one WorkoutSession (if executed)

### WorkoutSession
**Purpose**: Records actual workout execution and performance

**Key Fields**:
- `id`: Unique identifier
- `workout_plan_id`: Foreign key to WorkoutPlan
- `started_at`: Execution start timestamp
- `completed_at`: Execution end timestamp
- `completed_exercises`: Array of executed exercises with actual reps/load
- `notes`: Optional user notes
- `overall_difficulty`: User-reported RPE (1-10)

**Relationships**:
- Belongs to one WorkoutPlan
- Updates multiple Muscle recovery timestamps
- Feeds data to Volume & Progression Engine

### TrainingState
**Purpose**: Tracks current position in training cycle

**Key Fields**:
- `id`: Unique identifier
- `user_id`: Foreign key to User
- `current_week`: Week number in 12-week cycle
- `current_phase`: VOLUME | REPS | LOAD | DELOAD
- `cycle_start_date`: First day of current cycle
- `skip_count_current_week`: Number of skips this week
- `last_deload_date`: Most recent deload week

**Relationships**:
- Belongs to one User
- Updated by Volume & Progression Engine
- Consulted by Workout Generation Engine

---

## STATE MACHINE

### States

#### 1. IDLE
**Description**: No workout planned for today, waiting for generation

**Entry Conditions**:
- New day has started
- Previous workout completed or skipped
- No active workout session

**Available Actions**:
- Generate today's workout
- View goal progress
- Adjust settings

**Exit Transition**: User triggers workout generation → TODAY_PLAN_GENERATED

---

#### 2. TODAY_PLAN_GENERATED
**Description**: Workout has been generated and is ready to execute

**Entry Conditions**:
- Workout Generation Engine completed successfully
- Recovery checks passed
- Volume targets calculated

**Available Actions**:
- Start workout
- View workout details
- Request adjustments (via User Intent Adjustment Engine)
- Skip workout (with confirmation)

**Exit Transitions**:
- User starts workout → EXECUTION_MODE
- User skips workout → IDLE (triggers Skip-Day Resolution Engine)
- Day ends without action → IDLE (auto-skip)

---

#### 3. EXECUTION_MODE
**Description**: Actively executing workout, set-by-set

**Entry Conditions**:
- User started workout
- Workout plan loaded
- First exercise displayed

**Available Actions**:
- Complete current set
- Start/view rest timer
- Log reps and load
- Pause workout (saves progress)
- Abandon workout (confirmation required)

**Exit Transitions**:
- All exercises completed → COMPLETED
- User pauses/abandons → PARTIAL_COMPLETION
- Last set of final exercise → COMPLETED

**Active Engines**:
- Execution & Completion Engine (manages flow)
- Muscle Recovery Engine (tracks effort)

---

#### 4. PARTIAL_COMPLETION
**Description**: Workout paused or abandoned mid-session

**Entry Conditions**:
- User paused during execution
- User abandoned workout
- Workout incomplete at end of day

**Available Actions**:
- Resume workout (if same day)
- Abandon and record partial (if next day)
- View completed exercises

**Exit Transitions**:
- User resumes → EXECUTION_MODE
- User abandons → IDLE (triggers Skip-Day Resolution Engine)
- Next day → IDLE (auto-abandon, partial credit)

**Data Saved**:
- Completed exercises and sets
- Muscles partially trained
- Partial volume credit (50% of completed work)

---

#### 5. COMPLETED
**Description**: Workout successfully finished

**Entry Conditions**:
- All exercises completed
- All sets logged
- User confirmed completion

**Available Actions**:
- View workout summary
- Add notes
- Rate difficulty (RPE)
- Return to home

**Exit Transitions**:
- Summary reviewed → RECOVERY_TRACKING
- Automatic after 5 minutes → RECOVERY_TRACKING

**Data Recorded**:
- Full WorkoutSession record
- Muscle recovery timestamps updated
- Volume accumulation updated
- Progression data recorded

---

#### 6. RECOVERY_TRACKING
**Description**: Background state tracking muscle recovery

**Entry Conditions**:
- Workout completed
- Recovery timestamps set

**Available Actions**:
- View recovery status
- See next available training day
- Check weekly volume progress

**Exit Transitions**:
- New day starts → IDLE (if recovery insufficient)
- New day starts → IDLE (if recovery sufficient, ready for generation)

**Active Engines**:
- Muscle Recovery Engine (background)
- Volume & Progression Engine (weekly evaluation)

---

### State Transition Rules

1. **One Active State**: User always in exactly one state
2. **Explicit Transitions**: State changes only via defined triggers
3. **Data Consistency**: State changes commit all pending data before transition
4. **Error Handling**: Failed transitions return to previous stable state
5. **Background Engines**: Recovery and Volume engines run regardless of UI state

---

## RULE DESIGN PHILOSOPHY

### 1. One Decision at a Time
**Principle**: The system makes one clear decision per context

**Application**:
- Workout generation selects exercises one at a time in priority order
- Progression changes one variable per cycle (volume OR reps OR load)
- Skip resolution produces one recommended action, not multiple options

**Rationale**: Reduces complexity, prevents analysis paralysis, ensures predictable behavior

---

### 2. One Variable Changes Per Adaptation
**Principle**: Progressive overload adjusts only one training parameter at once

**Application**:
- Weeks 1-3: Volume increases, reps/load constant
- Weeks 5-7: Reps increase, volume/load constant
- Weeks 9-11: Load increases, volume/reps adjust proportionally

**Rationale**: Isolates cause of progress/regression, prevents overtraining, enables clear progress tracking

---

### 3. Recovery Beats Intensity
**Principle**: When in doubt, prioritize recovery over pushing harder

**Application**:
- Minimum recovery windows are non-negotiable
- Three consecutive skips trigger deload consideration, not volume stacking
- Partial recovery limits volume to 70% of normal
- User cannot override recovery blocks

**Rationale**: Prevents injury, ensures long-term sustainability, avoids burnout

---

### 4. Consistency Beats Optimization
**Principle**: A good plan executed consistently beats a perfect plan executed sporadically

**Application**:
- Skip resolution prioritizes getting back on track over compensating
- Volume targets are realistic and achievable
- Workouts are time-bounded (45-60 min max)
- Deload weeks are scheduled, not skipped

**Rationale**: Builds habits, reduces decision fatigue, maintains motivation

---

### 5. Overrides Allowed But Logged
**Principle**: Users can request changes, but system tracks patterns

**Application**:
- User Intent Adjustment Engine allows limited modifications
- All overrides logged with timestamp and reason
- Frequent overrides trigger system review
- Overrides cannot violate safety rules

**Rationale**: Respects user autonomy while maintaining system authority, enables learning from patterns

---

### 6. System Remains Authoritative
**Principle**: The system is the expert, user is the executor

**Application**:
- Workout generation is automatic, not collaborative
- Progression follows rules, not feelings
- Goal feasibility determined by math, not desire
- Recovery windows are enforced, not negotiated

**Rationale**: Removes decision burden, ensures scientific approach, prevents self-sabotage

---

## OUT OF SCOPE

### Explicitly NOT Included

#### 1. Exercise Discovery Library
**Why**: App uses curated exercise set, not browsable database
**Impact**: Reduces decision fatigue, ensures exercise quality

#### 2. Social Features
**Why**: No sharing, leaderboards, or friend challenges
**Impact**: Maintains focus on personal progress, avoids comparison stress

#### 3. Gamification
**Why**: No badges, streaks, points, or achievements
**Impact**: Prevents extrinsic motivation dependency, focuses on intrinsic goals

#### 4. Medical Diagnosis
**Why**: Not a health diagnostic tool
**Impact**: No injury detection, no medical advice, no pain tracking

#### 5. Daily Calorie Burn Chasing
**Why**: No activity tracking, steps, or TDEE calculation
**Impact**: Training focus only, nutrition handled separately

#### 6. Emotional or Motivational AI
**Why**: No mood analysis, no motivational messages, no sentiment tracking
**Impact**: System provides structure, not emotional support

#### 7. Exercise Form Tutorials
**Why**: Assumes user knows proper form or learns elsewhere
**Impact**: App is for planning and tracking, not instruction

#### 8. Equipment Marketplace
**Why**: No shopping features, affiliate links, or product recommendations
**Impact**: Pure training tool, no commercial distractions

#### 9. Wearable Device Integration
**Why**: No heart rate, GPS, or smartwatch sync
**Impact**: Offline-first remains true, no external dependencies

#### 10. Nutrition Tracking
**Why**: No food logging, macro counting, or meal planning
**Impact**: Training-only focus, diet is separate responsibility

---

## ARCHITECTURE PRINCIPLES

### Offline-First Design
- All logic runs in browser/local storage
- No network requests for core functionality
- Data synced only for backup (optional)
- Calculations performed client-side

### Deterministic Logic
- Same inputs always produce same outputs
- No random number generators in core logic
- Pseudo-randomness only for exercise variety (seeded)
- All decisions traceable via logs

### State Immutability
- Completed workouts cannot be edited
- Historical data is append-only
- State changes create new records, not mutations
- Audit trail of all system decisions

### Progressive Enhancement
- Core functionality works without JavaScript enhancements
- Form-based fallbacks for critical actions
- Graceful degradation of timers and animations
- Accessible to screen readers and keyboard navigation

---

## EXTENSIBILITY DESIGN

### Future-Proof Considerations

#### Plugin Architecture
- Engines designed as independent modules
- Clear input/output contracts
- New engines can be added without refactoring core
- Example future engines: Deload Intelligence, Goal Recommendation

#### Data Model Flexibility
- JSON fields for extensible attributes
- Version flags on records for schema migration
- Backward-compatible data structures
- Migration scripts for adding new fields

#### Rule System
- Rules stored as data, not hardcoded
- New rules can be added via configuration
- Rule priority system for conflict resolution
- User-level rule customization (advanced mode)

#### API-Ready (Optional)
- System can be backend service in future
- Clear separation of business logic and UI
- RESTful endpoint mapping already defined
- Optional cloud sync without losing offline capability

---

## SUCCESS METRICS

### System Performance
- Workout generation: <1 second
- Recovery calculation: <100ms
- State transitions: <200ms
- Database queries: <50ms

### User Experience
- Daily workout ready by 6 AM (scheduled generation)
- Zero decision points in workout flow
- Automatic progression without user intervention
- Clear explanation for every system decision

### Training Effectiveness
- 90%+ workout completion rate
- Progressive overload every 4 weeks
- Goal achievement within 10% of deadline
- Injury rate: 0% (no overtraining patterns)

---

## SYSTEM BLUEPRINT COMPLETE

This blueprint provides:
✓ Complete engine definitions
✓ Data model architecture
✓ State machine specification
✓ Rule design philosophy
✓ Clear scope boundaries
✓ Extensibility framework

**Next Steps**:
- Phase 1: Implement data models and database schema
- Phase 2: Build Workout Generation Engine
- Phase 3: Develop Execution & Completion Engine
- Phase 4: Integrate Recovery tracking
- Phase 5: Add Volume & Progression logic
- Phase 6: Build Goal & Deadline system
- Phase 7: Implement Skip-Day Resolution
- Phase 8: Add User Intent Adjustment layer

**Foundation is stable and ready for implementation.**
