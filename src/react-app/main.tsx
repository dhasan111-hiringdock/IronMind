import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/react-app/index.css";
import App from "@/react-app/App.tsx";
import type { User, WorkoutPlan, PlannedExercise, MuscleRecoveryStatus, MuscleSelectionResult } from "@/shared/types";

const originalFetch = window.fetch.bind(window);
function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
function write(key: string, val: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch { void 0; }
}
function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch { void 0; }
}
async function parseBody(init?: RequestInit): Promise<Record<string, unknown>> {
  if (!init || !init.body) return {};
  if (typeof init.body === "string") {
    try {
      return JSON.parse(init.body);
    } catch {
      return {};
    }
  }
  return {};
}
function nextSessionId(): number {
  const n = read<number>("ironmind_session_counter") ?? 1;
  write("ironmind_session_counter", n + 1);
  return n;
}
type LocalSet = { set_number: number; reps_completed: number; load_kg: number | null; rpe: number | null };
type LocalCompletedExercise = { exercise_id: number; exercise_name: string; sets: LocalSet[]; skipped?: boolean; skip_reason?: string };
type LocalSession = { id: number; workout_plan_id: number; completed_exercises: LocalCompletedExercise[]; started_at: string; completed_at: string | null };
type LocalRecoveryMuscle = { muscle_name: string; status: "READY" | "PARTIAL" | "BLOCKED"; hours_since_training: number; hours_until_ready: number; weekly_sets_completed?: number };
function defaultRecovery(): LocalRecoveryMuscle[] {
  return [
    { muscle_name: "Chest", status: "READY", hours_since_training: 48, hours_until_ready: 0, weekly_sets_completed: 8 },
    { muscle_name: "Back", status: "PARTIAL", hours_since_training: 30, hours_until_ready: 6, weekly_sets_completed: 12 },
    { muscle_name: "Legs", status: "BLOCKED", hours_since_training: 12, hours_until_ready: 36, weekly_sets_completed: 16 },
  ];
}
function generateExercises(pickDay: number) {
  if (pickDay === 1 || pickDay === 4 || pickDay === 0) {
    return [
      { exercise_id: 2101, exercise_name: "Barbell Row", sets: 4, reps: 8, load_kg: 50, rest_seconds: 90, primary_muscles: ["BACK"], primaryMuscle: "Back", secondaryMuscles: ["Biceps"] },
      { exercise_id: 2102, exercise_name: "Lat Pulldown", sets: 3, reps: 12, load_kg: 40, rest_seconds: 75, primary_muscles: ["BACK"], primaryMuscle: "Back", secondaryMuscles: ["Biceps"] },
      { exercise_id: 2103, exercise_name: "Seated Cable Row", sets: 3, reps: 12, load_kg: 45, rest_seconds: 75, primary_muscles: ["BACK"], primaryMuscle: "Back", secondaryMuscles: ["Biceps"] },
      { exercise_id: 2104, exercise_name: "Face Pull", sets: 3, reps: 15, load_kg: 20, rest_seconds: 60, primary_muscles: ["BACK"], primaryMuscle: "Back", secondaryMuscles: ["Rear Delts"] },
      { exercise_id: 2201, exercise_name: "Barbell Curl", sets: 3, reps: 10, load_kg: 30, rest_seconds: 60, primary_muscles: ["BICEPS"], primaryMuscle: "Biceps", secondaryMuscles: [] },
      { exercise_id: 2202, exercise_name: "Incline Dumbbell Curl", sets: 3, reps: 12, load_kg: 16, rest_seconds: 60, primary_muscles: ["BICEPS"], primaryMuscle: "Biceps", secondaryMuscles: [] },
      { exercise_id: 2203, exercise_name: "Cable Curl", sets: 3, reps: 12, load_kg: 25, rest_seconds: 60, primary_muscles: ["BICEPS"], primaryMuscle: "Biceps", secondaryMuscles: [] },
      { exercise_id: 2204, exercise_name: "Hammer Curl", sets: 3, reps: 12, load_kg: 18, rest_seconds: 60, primary_muscles: ["BICEPS"], primaryMuscle: "Biceps", secondaryMuscles: ["Forearms"] },
    ];
  } else if (pickDay === 2 || pickDay === 5) {
    return [
      { exercise_id: 2001, exercise_name: "Bench Press", sets: 4, reps: 8, load_kg: 40, rest_seconds: 90, primary_muscles: ["CHEST"], primaryMuscle: "Chest", secondaryMuscles: ["Triceps", "Shoulders"] },
      { exercise_id: 2002, exercise_name: "Incline Dumbbell Press", sets: 3, reps: 10, load_kg: 22, rest_seconds: 90, primary_muscles: ["CHEST"], primaryMuscle: "Chest", secondaryMuscles: ["Triceps", "Shoulders"] },
      { exercise_id: 2003, exercise_name: "Dumbbell Fly", sets: 3, reps: 12, load_kg: 14, rest_seconds: 60, primary_muscles: ["CHEST"], primaryMuscle: "Chest", secondaryMuscles: ["Shoulders"] },
      { exercise_id: 2004, exercise_name: "Cable Crossover", sets: 3, reps: 12, load_kg: 20, rest_seconds: 60, primary_muscles: ["CHEST"], primaryMuscle: "Chest", secondaryMuscles: ["Shoulders"] },
      { exercise_id: 2301, exercise_name: "Close-Grip Bench Press", sets: 4, reps: 8, load_kg: 35, rest_seconds: 90, primary_muscles: ["TRICEPS"], primaryMuscle: "Triceps", secondaryMuscles: ["Chest"] },
      { exercise_id: 2302, exercise_name: "Skull Crusher", sets: 3, reps: 10, load_kg: 25, rest_seconds: 75, primary_muscles: ["TRICEPS"], primaryMuscle: "Triceps", secondaryMuscles: [] },
      { exercise_id: 2303, exercise_name: "Cable Triceps Pushdown", sets: 3, reps: 12, load_kg: 30, rest_seconds: 60, primary_muscles: ["TRICEPS"], primaryMuscle: "Triceps", secondaryMuscles: [] },
      { exercise_id: 2304, exercise_name: "Overhead Triceps Extension", sets: 3, reps: 12, load_kg: 20, rest_seconds: 60, primary_muscles: ["TRICEPS"], primaryMuscle: "Triceps", secondaryMuscles: [] },
    ];
  } else {
    return [
      { exercise_id: 3101, exercise_name: "Back Squat", sets: 4, reps: 8, load_kg: 60, rest_seconds: 120, primary_muscles: ["QUADRICEPS"], primaryMuscle: "Quads", secondaryMuscles: ["Glutes", "Hamstrings"] },
      { exercise_id: 3102, exercise_name: "Leg Press", sets: 4, reps: 10, load_kg: 120, rest_seconds: 90, primary_muscles: ["QUADRICEPS"], primaryMuscle: "Quads", secondaryMuscles: ["Glutes"] },
      { exercise_id: 3103, exercise_name: "Lunge", sets: 3, reps: 12, load_kg: 30, rest_seconds: 60, primary_muscles: ["QUADRICEPS"], primaryMuscle: "Quads", secondaryMuscles: ["Glutes", "Hamstrings"] },
      { exercise_id: 3104, exercise_name: "Leg Extension", sets: 3, reps: 12, load_kg: 50, rest_seconds: 60, primary_muscles: ["QUADRICEPS"], primaryMuscle: "Quads", secondaryMuscles: [] },
      { exercise_id: 4101, exercise_name: "Hanging Leg Raise", sets: 3, reps: 12, load_kg: null, rest_seconds: 60, primary_muscles: ["ABS"], primaryMuscle: "Abs", secondaryMuscles: [] },
      { exercise_id: 4102, exercise_name: "Cable Crunch", sets: 3, reps: 15, load_kg: 25, rest_seconds: 60, primary_muscles: ["ABS"], primaryMuscle: "Abs", secondaryMuscles: [] },
      { exercise_id: 4103, exercise_name: "Plank", sets: 3, reps: 60, load_kg: null, rest_seconds: 60, primary_muscles: ["ABS"], primaryMuscle: "Abs", secondaryMuscles: [] },
      { exercise_id: 4104, exercise_name: "Ab Wheel Rollout", sets: 3, reps: 12, load_kg: null, rest_seconds: 60, primary_muscles: ["ABS"], primaryMuscle: "Abs", secondaryMuscles: [] },
    ];
  }
}
window.fetch = async (input, init) => {
  try {
    const raw = typeof input === "string" ? input : input instanceof Request ? input.url : (input as URL).toString();
    const url = new URL(raw, window.location.origin);
    if (!url.pathname.startsWith("/api")) {
      return originalFetch(raw, init);
    }
    const method = (init?.method || "GET").toUpperCase();
    if (url.pathname.startsWith("/api/auth/me") && method === "GET") {
      const u = read<User>("ironmind_user");
      return jsonResponse({ success: true, data: u ? { id: 1, email: "local@example.com" } : { id: 1, email: "local@example.com" } });
    }
    if (url.pathname.startsWith("/api/auth/logout") && method === "POST") {
      remove("ironmind_user");
      return jsonResponse({ success: true });
    }
    if (url.pathname.startsWith("/api/user/setup") && method === "POST") {
      const body = await parseBody(init);
      const b = body as Record<string, unknown>;
      const trainingAge = typeof b.training_age === "string" ? b.training_age : null;
      const trainingDays = typeof b.training_days_per_week === "number" ? b.training_days_per_week : Number(b.training_days_per_week ?? NaN);
      const equipment = Array.isArray(b.equipment_available) ? (b.equipment_available as unknown[]).map((x) => String(x)) : null;
      if (!trainingAge || !trainingDays || !equipment) {
        return jsonResponse({ success: false, error: "Missing required fields" }, 400);
      }
      if (trainingDays < 3 || trainingDays > 6) {
        return jsonResponse({ success: false, error: "Training days must be between 3 and 6" }, 400);
      }
      const u = {
        id: 1,
        equipment_available: equipment,
        training_days_per_week: trainingDays,
        current_training_age: trainingAge,
        drop_sets_enabled: false,
        supersets_enabled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      write("ironmind_user", u);
      return jsonResponse({ success: true, data: u });
    }
    if (url.pathname.startsWith("/api/workout/generate") && method === "POST") {
      const body = await parseBody(init);
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const day = now.getDay();
      const override = typeof body.schedule_override === "string" ? (body.schedule_override as "MONDAY" | "TUESDAY" | "WEDNESDAY") : undefined;
      const pickDay = override === "MONDAY" ? 1 : override === "TUESDAY" ? 2 : override === "WEDNESDAY" ? 3 : day;
      const exercises = generateExercises(pickDay);
      const targetMuscles = Array.from(new Set(exercises.map((e) => e.primaryMuscle || (e.primary_muscles?.[0] || "")))).filter(Boolean);
      const plan: WorkoutPlan = {
        id: 1,
        user_id: 1,
        goal_id: null,
        generated_at: now.toISOString(),
        scheduled_date: today,
        status: "PENDING",
        estimated_duration_minutes: 45,
        exercises,
        focus_label: "NORMAL",
        targetMuscles,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
      write("ironmind_today_workout", plan);
      const recommendation = { skip_detected: false, recommended_action: "CONTINUE", reason: "No missed workout detected; continue schedule." };
      return jsonResponse({ success: true, data: plan, recommendation });
    }
    if (url.pathname.startsWith("/api/workout/today") && method === "GET") {
      const plan = read<WorkoutPlan>("ironmind_today_workout");
      if (!plan) return jsonResponse({ success: false, error: "No workout planned for today" }, 404);
      return jsonResponse({ success: true, data: plan });
    }
    if (url.pathname.startsWith("/api/exercise/alternate") && method === "POST") {
      const body = await parseBody(init);
      const plan = read<WorkoutPlan>("ironmind_today_workout");
      const planId = typeof body.workout_plan_id === "number" ? body.workout_plan_id : Number(body.workout_plan_id ?? NaN);
      const currentExerciseId = typeof body.current_exercise_id === "number" ? body.current_exercise_id : Number(body.current_exercise_id ?? NaN);
      if (!plan || plan.id !== planId) return jsonResponse({ success: false, error: "Workout plan not found" }, 404);
      const idx = plan.exercises.findIndex((e: PlannedExercise) => e.exercise_id === currentExerciseId);
      if (idx === -1) return jsonResponse({ success: false, error: "Exercise not in plan" }, 400);
      const current = plan.exercises[idx];
      const altMap: Record<number, { id: number; name: string; primary_muscles: string[] }> = {
        1001: { id: 1003, name: "Incline Push-Ups", primary_muscles: ["CHEST", "TRICEPS"] },
        1002: { id: 1004, name: "Bodyweight Lunges", primary_muscles: ["QUADRICEPS", "GLUTES"] },
        2001: { id: 2003, name: "Dumbbell Bench Press", primary_muscles: ["CHEST", "TRICEPS"] },
        2002: { id: 2004, name: "Cable Fly", primary_muscles: ["CHEST"] },
      };
      const alt = altMap[current.exercise_id] || { id: current.exercise_id + 1000, name: `${current.exercise_name} (Alternate)`, primary_muscles: current.primary_muscles };
      const replacement = {
        exercise_id: alt.id,
        exercise_name: alt.name,
        sets: current.sets,
        reps: current.reps,
        load_kg: current.load_kg ?? null,
        rest_seconds: current.rest_seconds,
        primary_muscles: alt.primary_muscles,
      };
      plan.exercises[idx] = replacement;
      plan.updated_at = new Date().toISOString();
      write("ironmind_today_workout", plan);
      return jsonResponse({ success: true, data: plan });
    }
    if (url.pathname.startsWith("/api/session/start") && method === "POST") {
      const body = await parseBody(init);
      const planId = typeof body.workout_plan_id === "number" ? body.workout_plan_id : Number(body.workout_plan_id ?? NaN);
      const plan = read<WorkoutPlan>("ironmind_today_workout");
      if (!plan || plan.id !== planId) return jsonResponse({ success: false, error: "Workout plan not found" }, 404);
      const sid = nextSessionId();
      const session: LocalSession = { id: sid, workout_plan_id: planId, completed_exercises: [], started_at: new Date().toISOString(), completed_at: null };
      write("ironmind_session_current", session);
      return jsonResponse({ success: true, data: { session_id: sid } });
    }
    if (url.pathname.startsWith("/api/session/complete_set") && method === "POST") {
      const body = await parseBody(init);
      const sessionId = typeof body.session_id === "number" ? body.session_id : Number(body.session_id ?? NaN);
      const exerciseId = typeof body.exercise_id === "number" ? body.exercise_id : Number(body.exercise_id ?? NaN);
      const setNumber = typeof body.set_number === "number" ? body.set_number : Number(body.set_number ?? NaN);
      const repsCompleted = typeof body.reps_completed === "number" ? body.reps_completed : Number(body.reps_completed ?? NaN);
      const loadKg = typeof body.load_kg === "number" ? body.load_kg : null;
      const rpeVal = typeof body.rpe === "number" ? body.rpe : null;
      const session = read<LocalSession>("ironmind_session_current");
      const plan = read<WorkoutPlan>("ironmind_today_workout");
      if (!session || session.id !== Number(sessionId)) return jsonResponse({ success: false, error: "Session not found" }, 404);
      const planned = plan?.exercises?.find((e: PlannedExercise) => e.exercise_id === Number(exerciseId));
      if (!planned) return jsonResponse({ success: false, error: "Exercise not in plan" }, 400);
      let ex = session.completed_exercises.find((e: LocalCompletedExercise) => e.exercise_id === Number(exerciseId));
      if (!ex) {
        ex = { exercise_id: Number(exerciseId), exercise_name: planned.exercise_name, sets: [] as LocalSet[] };
        session.completed_exercises.push(ex);
      }
      const expectedNextSet = ex.sets.length + 1;
      if (Number(setNumber) !== expectedNextSet) return jsonResponse({ success: false, error: `Set must be completed in order. Expected set ${expectedNextSet}` }, 400);
      if (expectedNextSet > planned.sets) return jsonResponse({ success: false, error: "Set number exceeds planned sets" }, 400);
      ex.sets.push({ set_number: Number(setNumber), reps_completed: Number(repsCompleted), load_kg: loadKg, rpe: rpeVal });
      write("ironmind_session_current", session);
      return jsonResponse({ success: true, data: { rest_seconds: planned.rest_seconds, completed_sets: ex.sets.length, total_sets: planned.sets } });
    }
    if (url.pathname.startsWith("/api/session/finish") && method === "POST") {
      const body = await parseBody(init);
      const session = read<LocalSession>("ironmind_session_current");
      const sessionId = typeof body.session_id === "number" ? body.session_id : Number(body.session_id ?? NaN);
      if (!session || session.id !== Number(sessionId)) return jsonResponse({ success: false, error: "Session not found" }, 404);
      const plan = read<WorkoutPlan>("ironmind_today_workout");
      const dateKey = typeof plan?.scheduled_date === "string" && plan.scheduled_date ? plan.scheduled_date : new Date().toISOString().split("T")[0];
      session.completed_at = new Date(`${dateKey}T00:00:00.000Z`).toISOString();
      write("ironmind_session_current", session);
      const all = read<LocalSession[]>("ironmind_sessions_archive") ?? [];
      all.push(session);
      write("ironmind_sessions_archive", all);
      try {
        window.dispatchEvent(new Event("ironmind:attendanceUpdated"));
      } catch { void 0; }
      return jsonResponse({ success: true, data: { completed_at: session.completed_at } });
    }
    if (url.pathname.startsWith("/api/session/skip_exercise") && method === "POST") {
      const body = await parseBody(init);
      const session = read<LocalSession>("ironmind_session_current");
      const sessionId = typeof body.session_id === "number" ? body.session_id : Number(body.session_id ?? NaN);
      const exerciseId = typeof body.exercise_id === "number" ? body.exercise_id : Number(body.exercise_id ?? NaN);
      if (!session || session.id !== Number(sessionId)) return jsonResponse({ success: false, error: "Session not found" }, 404);
      const name = (read<WorkoutPlan>("ironmind_today_workout")?.exercises || []).find((e: PlannedExercise) => e.exercise_id === Number(exerciseId))?.exercise_name || `Exercise ${exerciseId}`;
      let ex = session.completed_exercises.find((e: LocalCompletedExercise) => e.exercise_id === Number(exerciseId));
      if (!ex) {
        ex = { exercise_id: Number(exerciseId), exercise_name: name, sets: [] as LocalSet[] };
        session.completed_exercises.push(ex);
      }
      ex.skipped = true;
      if (typeof body.reason === "string") ex.skip_reason = String(body.reason);
      write("ironmind_session_current", session);
      return jsonResponse({ success: true, data: { skipped: true } });
    }
    if (url.pathname.startsWith("/api/session/unskip_exercise") && method === "POST") {
      const body = await parseBody(init);
      const session = read<LocalSession>("ironmind_session_current");
      const sessionId = typeof body.session_id === "number" ? body.session_id : Number(body.session_id ?? NaN);
      const exerciseId = typeof body.exercise_id === "number" ? body.exercise_id : Number(body.exercise_id ?? NaN);
      if (!session || session.id !== Number(sessionId)) return jsonResponse({ success: false, error: "Session not found" }, 404);
      const ex = session.completed_exercises.find((e: LocalCompletedExercise) => e.exercise_id === Number(exerciseId));
      if (ex) {
        delete ex.skipped;
        delete ex.skip_reason;
      }
      write("ironmind_session_current", session);
      return jsonResponse({ success: true, data: { skipped: false } });
    }
    if (url.pathname.startsWith("/api/recovery/status") && method === "GET") {
      const rec = read<LocalRecoveryMuscle[]>("ironmind_muscles") ?? defaultRecovery();
      write("ironmind_muscles", rec);
      const data: MuscleRecoveryStatus[] = rec.map((m) => ({ muscle_name: m.muscle_name, status: m.status, hours_since_training: m.hours_since_training, hours_until_ready: m.hours_until_ready }));
      return jsonResponse({ success: true, data });
    }
    if (url.pathname.startsWith("/api/training/volume") && method === "GET") {
      const sessions = read<LocalSession[]>("ironmind_sessions_archive") ?? [];
      let total_completed = 0;
      for (const s of sessions) {
        for (const ex of s.completed_exercises || []) total_completed += (ex.sets || []).length;
      }
      const total_target = 60;
      return jsonResponse({ success: true, data: { total_completed, total_target, muscles: [] } });
    }
    if (url.pathname.startsWith("/api/sessions/attendance") && method === "GET") {
      const startStr = url.searchParams.get("start");
      const endStr = url.searchParams.get("end");
      const sessions = read<LocalSession[]>("ironmind_sessions_archive") ?? [];
      const toDateKey = (iso: string | null): string => {
        if (!iso) return "";
        const parts = iso.split("T");
        return parts[0] || "";
      };
      const datesSet = new Set<string>();
      for (const s of sessions) {
        const key = toDateKey(s.completed_at);
        if (!key) continue;
        if (startStr && endStr) {
          if (key >= startStr && key <= endStr) datesSet.add(key);
        } else {
          datesSet.add(key);
        }
      }
      return jsonResponse({ success: true, data: { dates: Array.from(datesSet) } });
    }
    if (url.pathname.startsWith("/api/workout/week") && method === "GET") {
      const startParam = url.searchParams.get("start");
      const parseISO = (s: string | null): Date | null => {
        if (!s) return null;
        const parts = s.split("-");
        if (parts.length !== 3) return null;
        const y = Number(parts[0]);
        const m = Number(parts[1]) - 1;
        const d = Number(parts[2]);
        const dt = new Date(y, m, d);
        return isNaN(dt.getTime()) ? null : dt;
      };
      const mondayOf = (d: Date): Date => {
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const base = new Date(d);
        base.setDate(d.getDate() + diff);
        base.setHours(0, 0, 0, 0);
        return base;
      };
      const startDate = parseISO(startParam) ?? mondayOf(new Date());
      const weekStart = mondayOf(startDate);
      const weekStartStr = weekStart.toISOString().split("T")[0];
      const u = read<User>("ironmind_user");
      const trainingDays = Number(u?.training_days_per_week ?? 4);
      const schedule: number[] =
        trainingDays >= 6
          ? [1, 2, 3, 4, 5, 6]
          : trainingDays === 5
          ? [1, 2, 3, 4, 5]
          : trainingDays === 4
          ? [1, 2, 4, 6]
          : [1, 3, 5];
      const daysOut: Array<{ date: string; planned: boolean; plan?: WorkoutPlan }> = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const key = d.toISOString().split("T")[0];
        const dow = d.getDay();
        const planned = schedule.includes(dow);
        if (planned) {
          const exercises = generateExercises(dow);
          const targetMuscles = Array.from(new Set(exercises.map((e) => e.primaryMuscle || (e.primary_muscles?.[0] || "")))).filter(Boolean);
          const plan: WorkoutPlan = {
            id: Number(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`),
            user_id: 1,
            goal_id: null,
            generated_at: new Date().toISOString(),
            scheduled_date: key,
            status: "PENDING",
            estimated_duration_minutes: 45,
            exercises,
            focus_label: "NORMAL",
            targetMuscles,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          write(`ironmind_workout_${key}`, plan);
          daysOut.push({ date: key, planned: true, plan });
        } else {
          daysOut.push({ date: key, planned: false });
        }
      }
      return jsonResponse({ success: true, data: { week_start: weekStartStr, days: daysOut } });
    }
    if (url.pathname.startsWith("/api/workout/by_date") && method === "GET") {
      const date = url.searchParams.get("date");
      if (!date) return jsonResponse({ success: false, error: "Date is required" }, 400);
      const plan = read<WorkoutPlan>(`ironmind_workout_${date}`);
      if (!plan) return jsonResponse({ success: false, error: "No workout plan for given date" }, 404);
      return jsonResponse({ success: true, data: plan });
    }
    if (url.pathname.startsWith("/api/session/start_for_date") && method === "POST") {
      const body = await parseBody(init);
      const date = typeof body.date === "string" ? body.date : "";
      if (!date) return jsonResponse({ success: false, error: "Date is required" }, 400);
      const plan = read<WorkoutPlan>(`ironmind_workout_${date}`);
      if (!plan) return jsonResponse({ success: false, error: "Workout plan not found for date" }, 404);
      write("ironmind_today_workout", plan);
      const sid = nextSessionId();
      const session: LocalSession = { id: sid, workout_plan_id: plan.id, completed_exercises: [], started_at: new Date().toISOString(), completed_at: null };
      write("ironmind_session_current", session);
      return jsonResponse({ success: true, data: { session_id: sid } });
    }
    if (url.pathname.startsWith("/api/muscle/request") && method === "POST") {
      const body = await parseBody(init);
      const b = body as Record<string, unknown>;
      const muscleName = typeof b.muscle_name === "string" ? b.muscle_name : "";
      const forceOverride = Boolean(b.force_override);
      if (!muscleName) return jsonResponse({ success: false, error: "Muscle name is required" }, 400);
      const rec = read<LocalRecoveryMuscle[]>("ironmind_muscles") ?? defaultRecovery();
      const m = rec.find((x) => x.muscle_name === muscleName);
      if (!m) return jsonResponse({ success: false, error: "Muscle not found" }, 404);
      const volumeDeficit = 16 - ((m.weekly_sets_completed ?? 0) as number);
      let evaluation: MuscleSelectionResult;
      if (m.status === "BLOCKED") {
        const ready = rec.filter((x) => x.status === "READY" && x.muscle_name !== muscleName);
        const alt = ready[0]?.muscle_name;
        evaluation = { decision: "DISCOURAGED", reason: `${muscleName} is still recovering and needs ${Math.round(m.hours_until_ready)} more hours of rest.`, recommended_action: alt ? `Train ${alt} instead, which is fully recovered.` : "Take a rest day or train a different muscle group that is fully recovered.", alternative_muscle: alt, can_override: false, warning_message: "Training this muscle now may lead to overtraining or injury." };
      } else if (volumeDeficit <= 0) {
        const ready = rec.filter((x) => x.status === "READY" && x.muscle_name !== muscleName);
        const alt = ready[0]?.muscle_name;
        evaluation = { decision: "DISCOURAGED", reason: `${muscleName} has already completed ${(m.weekly_sets_completed ?? 0)}/16 weekly sets.`, recommended_action: alt ? `Train ${alt} instead, which has ${(16 - (ready[0]?.weekly_sets_completed ?? 0))} sets remaining.` : "Focus on muscles that are behind on weekly volume.", alternative_muscle: alt, can_override: true, warning_message: "Adding more volume may lead to diminishing returns or overtraining." };
      } else if (m.status === "PARTIAL") {
        evaluation = { decision: "APPROVED_REDUCED", reason: `${muscleName} is partially recovered (${m.hours_since_training} hours since last training).`, recommended_action: "Approved with 60% volume reduction to allow continued recovery while maintaining stimulus.", volume_reduction_percentage: 60, can_override: true, warning_message: "Training at full volume while partially recovered may impede recovery." };
      } else if (volumeDeficit >= 8) {
        evaluation = { decision: "APPROVED_FULL", reason: `${muscleName} is ${volumeDeficit} sets behind weekly target. Priority muscle for training.`, recommended_action: "Full intensity workout approved to catch up on weekly volume.", can_override: false };
      } else {
        evaluation = { decision: "APPROVED_FULL", reason: `${muscleName} is fully recovered with ${volumeDeficit} sets remaining in weekly target.`, recommended_action: "Full intensity workout approved.", can_override: false };
      }
      if (evaluation.decision === "DISCOURAGED" && !evaluation.can_override && forceOverride) return jsonResponse({ success: false, error: "Cannot override this restriction - muscle needs recovery to prevent injury" }, 400);
      if (evaluation.decision === "DISCOURAGED" && !forceOverride) return jsonResponse({ success: true, data: evaluation });
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const exercises = [
        { exercise_id: 2001, exercise_name: muscleName === "Chest" ? "Bench Press" : muscleName === "Back" ? "Barbell Row" : "Back Squat", sets: evaluation.decision === "APPROVED_REDUCED" ? 3 : 4, reps: 10, load_kg: muscleName === "Chest" ? 40 : muscleName === "Back" ? 50 : 60, rest_seconds: 90, primary_muscles: [muscleName.toUpperCase()], primaryMuscle: muscleName, secondaryMuscles: muscleName === "Chest" ? ["Triceps", "Shoulders"] : muscleName === "Back" ? ["Biceps"] : ["Hamstrings", "Glutes"] },
        { exercise_id: 2002, exercise_name: muscleName === "Chest" ? "Dumbbell Fly" : muscleName === "Back" ? "Lat Pulldown" : "Leg Extension", sets: evaluation.decision === "APPROVED_REDUCED" ? 2 : 3, reps: 12, load_kg: muscleName === "Chest" ? 20 : muscleName === "Back" ? 35 : 30, rest_seconds: 60, primary_muscles: [muscleName.toUpperCase()], primaryMuscle: muscleName, secondaryMuscles: muscleName === "Chest" ? ["Triceps", "Shoulders"] : muscleName === "Back" ? ["Biceps"] : ["Hamstrings", "Glutes"] },
      ];
      const targetMuscles = Array.from(new Set(exercises.map((e) => e.primaryMuscle || (e.primary_muscles?.[0] || muscleName))));
      const plan: WorkoutPlan = { id: 2, user_id: 1, goal_id: null, generated_at: now.toISOString(), scheduled_date: today, status: "PENDING", estimated_duration_minutes: evaluation.decision === "APPROVED_REDUCED" ? 35 : 50, exercises, focus_label: evaluation.decision === "APPROVED_REDUCED" ? "REDUCED" : "NORMAL", targetMuscles, created_at: now.toISOString(), updated_at: now.toISOString() };
      write("ironmind_today_workout", plan);
      return jsonResponse({ success: true, data: { ...evaluation, workout_plan: plan } });
    }
    return jsonResponse({ success: false, error: "Not found" }, 404);
  } catch {
    return jsonResponse({ success: false, error: "Local handler error" }, 500);
  }
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
