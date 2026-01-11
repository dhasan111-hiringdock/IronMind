import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { mochaPlugins } from "@getmocha/vite-plugins";
import type { User } from "./src/shared/types";
import type { WorkoutPlan, PlannedExercise, MuscleRecoveryStatus, MuscleSelectionResult } from "./src/shared/types";

export default defineConfig(({ command }) => {
  const isDev = command === "serve";
  const useWorkerProxy = isDev && process.env.USE_WORKER_PROXY === "true";
  const plugins = [...mochaPlugins(process.env as Record<string, string | undefined>), react()];
  if (isDev) {
    let savedUser: User | null = null;
    let savedWorkoutPlan: WorkoutPlan | null = null;
    let devSessionCounter = 1;
    let devSession: { id: number; workout_plan_id: number; completed_exercises: Array<{ exercise_id: number; exercise_name: string; sets: Array<{ set_number: number; reps_completed: number; load_kg: number | null; rpe: number | null }>; skipped?: boolean; skip_reason?: string }> } | null = null;
    const devMuscles = [
      {
        name: "Chest",
        status: "READY" as const,
        hours_since_training: 48,
        hours_until_ready: 0,
        weekly_sets_completed: 8,
        weekly_sets_target: 16,
        recovery_hours_required: 48,
      },
      {
        name: "Back",
        status: "PARTIAL" as const,
        hours_since_training: 30,
        hours_until_ready: 6,
        weekly_sets_completed: 12,
        weekly_sets_target: 16,
        recovery_hours_required: 48,
      },
      {
        name: "Legs",
        status: "BLOCKED" as const,
        hours_since_training: 12,
        hours_until_ready: 36,
        weekly_sets_completed: 16,
        weekly_sets_target: 16,
        recovery_hours_required: 48,
      },
    ];
    plugins.push({
      name: "dev-api-mock",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith("/api/auth")) {
            if (useWorkerProxy) {
              next();
              return;
            }
            if (req.url.startsWith("/api/auth/google/start") && req.method === "GET") {
              const state = Math.random().toString(36).slice(2, 10);
              res.statusCode = 302;
              res.setHeader("Set-Cookie", `oauth_state=${state}; HttpOnly; Path=/; SameSite=Lax; Max-Age=600`);
              res.setHeader("Location", `/api/auth/google/callback?code=dev&state=${state}`);
              res.end();
              return;
            }
            if (req.url.startsWith("/api/auth/google/callback") && req.method === "GET") {
              try {
                const url = new URL(`http://local${req.url}`);
                const code = url.searchParams.get("code");
                const state = url.searchParams.get("state");
                const cookies = (req.headers.cookie || "").split(";").map((c) => c.trim());
                const cookieState = cookies.find((c) => c.startsWith("oauth_state="))?.split("=")[1];
                if (!code || !state || !cookieState || state !== cookieState) {
                  res.statusCode = 400;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ success: false, error: "Invalid OAuth state" }));
                  return;
                }
                res.statusCode = 302;
                res.setHeader("Set-Cookie", [
                  "oauth_state=; Path=/; Max-Age=0; SameSite=Lax",
                  "ironmind_device=dev-mock-device; HttpOnly; Path=/; SameSite=Lax; Max-Age=15552000",
                ]);
                res.setHeader("Location", "/dashboard");
                res.end();
              } catch {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: "Auth callback failed" }));
              }
              return;
            }
            if (req.url.startsWith("/api/auth/me") && req.method === "GET") {
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true, data: { id: 1, email: "dev@example.com" } }));
              return;
            }
            if (req.url.startsWith("/api/auth/logout") && req.method === "POST") {
              res.statusCode = 200;
              res.setHeader("Set-Cookie", "ironmind_device=; Path=/; Max-Age=0; SameSite=Lax");
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true }));
              return;
            }
          }
          if (req.url?.startsWith("/api/session/start") && req.method === "POST") {
            let data = "";
            req.on("data", (chunk) => (data += chunk));
            req.on("end", () => {
              try {
                const body = JSON.parse(data || "{}");
                const planId = Number(body.workout_plan_id);
                if (!planId || !savedWorkoutPlan || savedWorkoutPlan.id !== planId) {
                  res.statusCode = 404;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ success: false, error: "Workout plan not found" }));
                  return;
                }
                devSession = {
                  id: devSessionCounter++,
                  workout_plan_id: planId,
                  completed_exercises: [],
                };
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true, data: { session_id: devSession.id } }));
              } catch {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: "Failed to start session" }));
              }
            });
            return;
          }
          if (req.url?.startsWith("/api/session/complete_set") && req.method === "POST") {
            let data = "";
            req.on("data", (chunk) => (data += chunk));
            req.on("end", () => {
              try {
                const body = JSON.parse(data || "{}");
                const { session_id, exercise_id, set_number, reps_completed, load_kg, rpe } = body;
                if (!devSession || devSession.id !== Number(session_id)) {
                  res.statusCode = 404;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ success: false, error: "Session not found" }));
                  return;
                }
                const planned = savedWorkoutPlan?.exercises.find((e) => e.exercise_id === Number(exercise_id));
                if (!planned) {
                  res.statusCode = 400;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ success: false, error: "Exercise not in plan" }));
                  return;
                }
                let ex = devSession.completed_exercises.find((e) => e.exercise_id === Number(exercise_id));
                if (!ex) {
                  const name = savedWorkoutPlan?.exercises.find((e) => e.exercise_id === Number(exercise_id))?.exercise_name || `Exercise ${exercise_id}`;
                  ex = { exercise_id: Number(exercise_id), exercise_name: name, sets: [] };
                  devSession.completed_exercises.push(ex);
                }
                const expectedNextSet = ex.sets.length + 1;
                if (Number(set_number) !== expectedNextSet) {
                  res.statusCode = 400;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ success: false, error: `Set must be completed in order. Expected set ${expectedNextSet}` }));
                  return;
                }
                if (expectedNextSet > planned.sets) {
                  res.statusCode = 400;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ success: false, error: "Set number exceeds planned sets" }));
                  return;
                }
                ex.sets.push({ set_number: Number(set_number), reps_completed: Number(reps_completed), load_kg: load_kg ?? null, rpe: rpe ?? null });
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({
                  success: true,
                  data: { rest_seconds: planned.rest_seconds, completed_sets: ex.sets.length, total_sets: planned.sets },
                }));
              } catch {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: "Failed to record set" }));
              }
            });
            return;
          }
          if (req.url?.startsWith("/api/session/finish") && req.method === "POST") {
            let data = "";
            req.on("data", (chunk) => (data += chunk));
            req.on("end", () => {
              try {
                const body = JSON.parse(data || "{}");
                const { session_id } = body;
                if (!devSession || devSession.id !== Number(session_id)) {
                  res.statusCode = 404;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ success: false, error: "Session not found" }));
                  return;
                }
                const completed_at = new Date().toISOString();
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true, data: { completed_at } }));
              } catch {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: "Failed to finish session" }));
              }
            });
            return;
          }
          if (req.url?.startsWith("/api/muscle/request") && req.method === "POST") {
            let data = "";
            req.on("data", (chunk) => {
              data += chunk;
            });
            req.on("end", () => {
              try {
                const body = JSON.parse(data || "{}");
                const muscleName = String(body.muscle_name || "");
                const forceOverride = Boolean(body.force_override);
                if (!muscleName) {
                  res.statusCode = 400;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ success: false, error: "Muscle name is required" }));
                  return;
                }
                const m = devMuscles.find((dm) => dm.name === muscleName);
                if (!m) {
                  res.statusCode = 404;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ success: false, error: "Muscle not found" }));
                  return;
                }
                let evaluation: MuscleSelectionResult;
                const volumeDeficit = m.weekly_sets_target - m.weekly_sets_completed;
                if (m.status === "BLOCKED") {
                  const ready = devMuscles
                    .filter((x) => x.status === "READY" && x.name !== muscleName)
                    .sort(
                      (a, b) =>
                        (a.weekly_sets_target - a.weekly_sets_completed) -
                        (b.weekly_sets_target - b.weekly_sets_completed)
                    )
                    .reverse();
                  const alt = ready[0]?.name;
                  evaluation = {
                    decision: "DISCOURAGED",
                    reason: `${muscleName} is still recovering and needs ${Math.round(m.hours_until_ready)} more hours of rest.`,
                    recommended_action: alt
                      ? `Train ${alt} instead, which is fully recovered.`
                      : "Take a rest day or train a different muscle group that is fully recovered.",
                    alternative_muscle: alt,
                    can_override: false,
                    warning_message: "Training this muscle now may lead to overtraining or injury.",
                  };
                } else if (volumeDeficit <= 0) {
                  const ready = devMuscles
                    .filter((x) => x.status === "READY" && x.name !== muscleName)
                    .sort(
                      (a, b) =>
                        (a.weekly_sets_target - a.weekly_sets_completed) -
                        (b.weekly_sets_target - b.weekly_sets_completed)
                    )
                    .reverse();
                  const alt = ready[0]?.name;
                  evaluation = {
                    decision: "DISCOURAGED",
                    reason: `${muscleName} has already completed ${m.weekly_sets_completed}/${m.weekly_sets_target} weekly sets.`,
                    recommended_action: alt
                      ? `Train ${alt} instead, which has ${(ready[0]?.weekly_sets_target ?? 0) - (ready[0]?.weekly_sets_completed ?? 0)} sets remaining.`
                      : "Focus on muscles that are behind on weekly volume.",
                    alternative_muscle: alt,
                    can_override: true,
                    warning_message: "Adding more volume may lead to diminishing returns or overtraining.",
                  };
                } else if (m.status === "PARTIAL") {
                  evaluation = {
                    decision: "APPROVED_REDUCED",
                    reason: `${muscleName} is partially recovered (${m.hours_since_training} hours since last training).`,
                    recommended_action: "Approved with 60% volume reduction to allow continued recovery while maintaining stimulus.",
                    volume_reduction_percentage: 60,
                    can_override: true,
                    warning_message: "Training at full volume while partially recovered may impede recovery.",
                  };
                } else if (volumeDeficit >= 8) {
                  evaluation = {
                    decision: "APPROVED_FULL",
                    reason: `${muscleName} is ${volumeDeficit} sets behind weekly target. Priority muscle for training.`,
                    recommended_action: "Full intensity workout approved to catch up on weekly volume.",
                    can_override: false,
                  };
                } else {
                  evaluation = {
                    decision: "APPROVED_FULL",
                    reason: `${muscleName} is fully recovered with ${volumeDeficit} sets remaining in weekly target.`,
                    recommended_action: "Full intensity workout approved.",
                    can_override: false,
                  };
                }
                if (evaluation.decision === "DISCOURAGED" && !evaluation.can_override && forceOverride) {
                  res.statusCode = 400;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ success: false, error: "Cannot override this restriction - muscle needs recovery to prevent injury" }));
                  return;
                }
                if (evaluation.decision === "DISCOURAGED" && !forceOverride) {
                  res.statusCode = 200;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ success: true, data: evaluation }));
                  return;
                }
                if (forceOverride) {
                  console.warn(`[override] Muscle request override used for ${muscleName}`);
                }
                const now = new Date();
                const today = now.toISOString().split("T")[0];
                const exercises: PlannedExercise[] = [
                  {
                    exercise_id: 2001,
                    exercise_name: muscleName === "Chest" ? "Bench Press" : muscleName === "Back" ? "Barbell Row" : "Back Squat",
                    sets: evaluation.decision === "APPROVED_REDUCED" ? 3 : 4,
                    reps: 10,
                    load_kg: muscleName === "Chest" ? 40 : muscleName === "Back" ? 50 : 60,
                    rest_seconds: 90,
                    primary_muscles: [muscleName.toUpperCase()],
                    primaryMuscle: muscleName,
                    secondaryMuscles: muscleName === "Chest" ? ["Triceps", "Shoulders"] : muscleName === "Back" ? ["Biceps"] : ["Hamstrings", "Glutes"],
                  },
                  {
                    exercise_id: 2002,
                    exercise_name: muscleName === "Chest" ? "Dumbbell Fly" : muscleName === "Back" ? "Lat Pulldown" : "Leg Extension",
                    sets: evaluation.decision === "APPROVED_REDUCED" ? 2 : 3,
                    reps: 12,
                    load_kg: muscleName === "Chest" ? 20 : muscleName === "Back" ? 35 : 30,
                    rest_seconds: 60,
                    primary_muscles: [muscleName.toUpperCase()],
                    primaryMuscle: muscleName,
                    secondaryMuscles: muscleName === "Chest" ? ["Triceps", "Shoulders"] : muscleName === "Back" ? ["Biceps"] : ["Hamstrings", "Glutes"],
                  },
                ];
                const targetMuscles = Array.from(new Set(exercises.map(e => e.primaryMuscle || (e.primary_muscles?.[0] || muscleName))));
                savedWorkoutPlan = {
                  id: 2,
                  user_id: 1,
                  goal_id: null,
                  generated_at: now.toISOString(),
                  scheduled_date: today,
                  status: "PENDING",
                  estimated_duration_minutes: evaluation.decision === "APPROVED_REDUCED" ? 35 : 50,
                  exercises,
                  focus_label: evaluation.decision === "APPROVED_REDUCED" ? "REDUCED" : "NORMAL",
                  targetMuscles,
                  created_at: now.toISOString(),
                  updated_at: now.toISOString(),
                };
                const response = {
                  success: true,
                  data: {
                    ...evaluation,
                    workout_plan: savedWorkoutPlan,
                  },
                };
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(response));
              } catch {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: "Failed to process muscle request" }));
              }
            });
            return;
          }
          if (req.url?.startsWith("/api/workout/generate") && req.method === "POST") {
            let data = "";
            req.on("data", (chunk) => (data += chunk));
            req.on("end", () => {
              try {
                const body = JSON.parse(data || "{}");
                const now = new Date();
                const today = now.toISOString().split("T")[0];
                const day = now.getDay(); // 0=Sun..6=Sat
                const override = body.schedule_override as 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | undefined;
                const pickDay = override === 'MONDAY' ? 1 : override === 'TUESDAY' ? 2 : override === 'WEDNESDAY' ? 3 : day;
                let exercises: PlannedExercise[] = [];
                if (pickDay === 1 || pickDay === 4 || pickDay === 0) {
                  exercises = [
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
                  exercises = [
                    { exercise_id: 2001, exercise_name: "Bench Press", sets: 4, reps: 8, load_kg: 40, rest_seconds: 90, primary_muscles: ["CHEST"], primaryMuscle: "Chest", secondaryMuscles: ["Triceps", "Shoulders"] },
                    { exercise_id: 2002, exercise_name: "Incline Dumbbell Press", sets: 3, reps: 10, load_kg: 22, rest_seconds: 90, primary_muscles: ["CHEST"], primaryMuscle: "Chest", secondaryMuscles: ["Triceps", "Shoulders"] },
                    { exercise_id: 2003, exercise_name: "Dumbbell Fly", sets: 3, reps: 12, load_kg: 14, rest_seconds: 60, primary_muscles: ["CHEST"], primaryMuscle: "Chest", secondaryMuscles: ["Shoulders"] },
                    { exercise_id: 2004, exercise_name: "Cable Crossover", sets: 3, reps: 12, load_kg: 20, rest_seconds: 60, primary_muscles: ["CHEST"], primaryMuscle: "Chest", secondaryMuscles: ["Shoulders"] },
                    { exercise_id: 2301, exercise_name: "Close-Grip Bench Press", sets: 4, reps: 8, load_kg: 35, rest_seconds: 90, primary_muscles: ["TRICEPS"], primaryMuscle: "Triceps", secondaryMuscles: ["Chest"] },
                    { exercise_id: 2302, exercise_name: "Skull Crusher", sets: 3, reps: 10, load_kg: 25, rest_seconds: 75, primary_muscles: ["TRICEPS"], primaryMuscle: "Triceps", secondaryMuscles: [] },
                    { exercise_id: 2303, exercise_name: "Cable Triceps Pushdown", sets: 3, reps: 12, load_kg: 30, rest_seconds: 60, primary_muscles: ["TRICEPS"], primaryMuscle: "Triceps", secondaryMuscles: [] },
                    { exercise_id: 2304, exercise_name: "Overhead Triceps Extension", sets: 3, reps: 12, load_kg: 20, rest_seconds: 60, primary_muscles: ["TRICEPS"], primaryMuscle: "Triceps", secondaryMuscles: [] },
                  ];
                } else if (pickDay === 3 || pickDay === 6) {
                  exercises = [
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
                const targetMuscles = Array.from(new Set(exercises.map(e => e.primaryMuscle || (e.primary_muscles?.[0] || '')))).filter(Boolean);
                savedWorkoutPlan = {
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
                const recommendation = {
                  skip_detected: false,
                  recommended_action: 'CONTINUE',
                  reason: 'No missed workout detected; continue schedule.',
                };
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true, data: savedWorkoutPlan, recommendation }));
              } catch {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: "Failed to generate workout" }));
              }
            });
            return;
          }
          if (req.url?.startsWith("/api/workout/today") && req.method === "GET") {
            if (!savedWorkoutPlan) {
              res.statusCode = 404;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: false, error: "No workout planned for today" }));
              return;
            }
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true, data: savedWorkoutPlan }));
            return;
          }
          if (req.url?.startsWith("/api/exercise/alternate") && req.method === "POST") {
            let data = "";
            req.on("data", (chunk) => (data += chunk));
            req.on("end", () => {
              try {
                const body = JSON.parse(data || "{}");
                const planId = Number(body.workout_plan_id);
                const currentExerciseId = Number(body.current_exercise_id);
                if (!savedWorkoutPlan || savedWorkoutPlan.id !== planId) {
                  res.statusCode = 404;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ success: false, error: "Workout plan not found" }));
                  return;
                }
                const idx = savedWorkoutPlan.exercises.findIndex((e) => e.exercise_id === currentExerciseId);
                if (idx === -1) {
                  res.statusCode = 400;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ success: false, error: "Exercise not in plan" }));
                  return;
                }
                const current = savedWorkoutPlan.exercises[idx];
                const altMap: Record<number, { id: number; name: string; primary_muscles: string[] }> = {
                  1001: { id: 1003, name: "Incline Push-Ups", primary_muscles: ["CHEST", "TRICEPS"] },
                  1002: { id: 1004, name: "Bodyweight Lunges", primary_muscles: ["QUADRICEPS", "GLUTES"] },
                  2001: { id: 2003, name: "Dumbbell Bench Press", primary_muscles: ["CHEST", "TRICEPS"] },
                  2002: { id: 2004, name: "Cable Fly", primary_muscles: ["CHEST"] },
                };
                const alt = altMap[current.exercise_id] || {
                  id: current.exercise_id + 1000,
                  name: `${current.exercise_name} (Alternate)`,
                  primary_muscles: current.primary_muscles,
                };
                const replacement: PlannedExercise = {
                  exercise_id: alt.id,
                  exercise_name: alt.name,
                  sets: current.sets,
                  reps: current.reps,
                  load_kg: current.load_kg ?? null,
                  rest_seconds: current.rest_seconds,
                  primary_muscles: alt.primary_muscles,
                };
                savedWorkoutPlan.exercises[idx] = replacement;
                savedWorkoutPlan.updated_at = new Date().toISOString();
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true, data: savedWorkoutPlan }));
              } catch {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: "Failed to generate alternate exercise" }));
              }
            });
            return;
          }
          if (req.url?.startsWith("/api/session/skip_exercise") && req.method === "POST") {
            let data = "";
            req.on("data", (chunk) => (data += chunk));
            req.on("end", () => {
              try {
                const body = JSON.parse(data || "{}");
                const { session_id, exercise_id, reason } = body;
                if (!devSession || devSession.id !== Number(session_id)) {
                  res.statusCode = 404;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ success: false, error: "Session not found" }));
                  return;
                }
                const name = savedWorkoutPlan?.exercises.find((e) => e.exercise_id === Number(exercise_id))?.exercise_name || `Exercise ${exercise_id}`;
                let ex = devSession.completed_exercises.find((e) => e.exercise_id === Number(exercise_id));
                if (!ex) {
                  ex = { exercise_id: Number(exercise_id), exercise_name: name, sets: [] };
                  devSession.completed_exercises.push(ex);
                }
                ex.skipped = true;
                if (reason) ex.skip_reason = String(reason);
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true, data: { skipped: true } }));
              } catch {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: "Failed to skip exercise" }));
              }
            });
            return;
          }
          if (req.url?.startsWith("/api/session/unskip_exercise") && req.method === "POST") {
            let data = "";
            req.on("data", (chunk) => (data += chunk));
            req.on("end", () => {
              try {
                const body = JSON.parse(data || "{}");
                const { session_id, exercise_id } = body;
                if (!devSession || devSession.id !== Number(session_id)) {
                  res.statusCode = 404;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ success: false, error: "Session not found" }));
                  return;
                }
                const ex = devSession.completed_exercises.find((e) => e.exercise_id === Number(exercise_id));
                if (ex) {
                  delete ex.skipped;
                  delete ex.skip_reason;
                }
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true, data: { skipped: false } }));
              } catch {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: "Failed to unskip exercise" }));
              }
            });
            return;
          }
          if (req.url?.startsWith("/api/recovery/status") && req.method === "GET") {
            const recovery: MuscleRecoveryStatus[] = devMuscles.map((m) => ({
              muscle_name: m.name,
              status: m.status,
              hours_since_training: m.hours_since_training,
              hours_until_ready: m.hours_until_ready,
            }));
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true, data: recovery }));
            return;
          }
          if (req.url?.startsWith("/api/training/volume") && req.method === "GET") {
            const total_completed = 24;
            const total_target = 60;
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true, data: { total_completed, total_target, muscles: [] } }));
            return;
          }
          if (req.url?.startsWith("/api/user/setup") && req.method === "POST") {
            let data = "";
            req.on("data", (chunk) => {
              data += chunk;
            });
            req.on("end", () => {
              try {
                const body = JSON.parse(data || "{}");
                const { training_age, training_days_per_week, equipment_available } = body;
                if (!training_age || !training_days_per_week || !equipment_available) {
                  res.statusCode = 400;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ success: false, error: "Missing required fields" }));
                  return;
                }
                if (training_days_per_week < 3 || training_days_per_week > 6) {
                  res.statusCode = 400;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ success: false, error: "Training days must be between 3 and 6" }));
                  return;
                }
                savedUser = {
                  id: 1,
                  equipment_available: equipment_available as string[],
                  training_days_per_week,
                  current_training_age: training_age,
                  drop_sets_enabled: false,
                  supersets_enabled: false,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true, data: savedUser }));
              } catch {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: "Failed to save user settings" }));
              }
            });
            return;
          }
          next();
        });
      },
    });
  }
  if (!isDev) plugins.push(cloudflare());
  return {
    plugins,
    server: {
      allowedHosts: true,
      proxy: useWorkerProxy
        ? {
            "/api": "http://127.0.0.1:8787",
          }
        : undefined,
    },
    build: {
      chunkSizeWarningLimit: 5000,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
