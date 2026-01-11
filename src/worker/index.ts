import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { 
  TrainingAge, 
  EquipmentType, 
  ApiResponse, 
  User, 
  TrainingState,
  WorkoutPlan,
  RecoveryStatus,
  GoalType,
  GoalRealism,
  MuscleSelectionResult,
  WorkoutStatus,
  WorkoutFocus
} from "@/shared/types";
import { WorkoutGenerator } from "./engines/workout-generator";
import { resolveSkip, type SkipResolutionResult } from "./engines/skip-resolution";
import { GoalEngine } from "./engines/goal-engine";

type AvailableExercise = {
  id: number;
  name: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment_required: string;
  exercise_type: 'COMPOUND' | 'ISOLATION';
  default_rest_seconds: number;
};

type ExerciseRow = {
  id: number;
  name: string;
  primary_muscles: string;
  secondary_muscles: string;
  equipment_required: string;
  exercise_type: 'COMPOUND' | 'ISOLATION';
  default_rest_seconds: number;
};

type CompletedExerciseLocal = {
  exercise_id: number;
  exercise_name: string;
  sets: Array<{ set_number: number; reps_completed: number; load_kg: number | null; rpe: number | null }>;
  skipped?: boolean;
  skip_reason?: string;
};

type WorkoutPlanRow = {
  exercises: string;
  user_id: number;
};

type WorkoutPlanRowFull = {
  id: number;
  user_id: number;
  goal_id: number | null;
  generated_at: string;
  scheduled_date: string;
  status: WorkoutStatus;
  estimated_duration_minutes: number;
  exercises: string;
  focus_label: WorkoutFocus;
  created_at: string;
  updated_at: string;
};

type UserRow = {
  id: number;
  email?: string | null;
  equipment_available: string;
  training_days_per_week: number;
  current_training_age: TrainingAge;
  drop_sets_enabled: number | boolean;
  supersets_enabled: number | boolean;
  height_cm?: number | null;
  weight_kg?: number | null;
  age_years?: number | null;
  sex?: 'MALE' | 'FEMALE' | 'UNKNOWN' | null;
  password_hash?: string | null;
  password_salt?: string | null;
  password_iterations?: number | null;
  created_at: string;
  updated_at: string;
};

type DbMuscle = {
  id: number;
  name: string;
  last_trained_at: string | null;
  recovery_hours_required: number;
  weekly_sets_completed: number;
  weekly_sets_target: number;
};

 

type MuscleWithRecoveryLocal = {
  id: number;
  name: string;
  recovery_status: 'READY' | 'PARTIAL' | 'BLOCKED';
  weekly_sets_completed: number;
  weekly_sets_target: number;
  volume_deficit: number;
};
import { MuscleSelector } from "./engines/muscle-selector";
import { ProgressionEngine } from "./engines/progression-engine";
import type { ProgressionResult } from "@/shared/types";

type Bindings = {
  DB: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

const DEVICE_COOKIE_NAME = "device_token";

async function sha256Base64(s: string): Promise<string> {
  const enc = new TextEncoder();
  const bytes = enc.encode(s);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const out = new Uint8Array(digest);
  let b64 = "";
  for (let i = 0; i < out.length; i++) b64 += String.fromCharCode(out[i]);
  return btoa(b64);
}

async function deriveHash(password: string, salt: ArrayBuffer, iterations: number): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
  const bytes = new Uint8Array(bits);
  let b64 = "";
  for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i]);
  return btoa(b64);
}

function randomBytes(len: number): Uint8Array {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return arr;
}

function base64Of(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

async function getAuthenticatedUser(c: Context<{ Bindings: Bindings }>): Promise<UserRow | null> {
  const token = getCookie(c, DEVICE_COOKIE_NAME);
  if (!token) return null;
  const hashed = await sha256Base64(token);
  const device = await c.env.DB.prepare("SELECT user_id, expires_at FROM devices WHERE token = ?").bind(hashed).first<{ user_id: number; expires_at: string }>();
  if (!device) return null;
  const exp = new Date(device.expires_at);
  if (exp.getTime() < Date.now()) return null;
  await c.env.DB.prepare("UPDATE devices SET last_seen_at = CURRENT_TIMESTAMP WHERE token = ?").bind(hashed).run();
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(device.user_id).first<UserRow>();
  return user || null;
}

async function getUserOrDefault(c: Context<{ Bindings: Bindings }>): Promise<UserRow | null> {
  const authed = await getAuthenticatedUser(c);
  if (authed) return authed;
  const user = await c.env.DB.prepare("SELECT * FROM users LIMIT 1").first<UserRow>();
  return user || null;
}


app.post("/api/auth/register", async (c) => {
  try {
    const body = await c.req.json<{ email: string; password: string; training_days_per_week?: number; equipment_available?: EquipmentType[]; current_training_age?: TrainingAge }>();
    const email = (body.email || "").toLowerCase().trim();
    const password = body.password || "";
    if (!email || !password) {
      return c.json({ success: false, error: "Email and password are required" }, 400);
    }
    const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: number }>();
    if (existing) {
      return c.json({ success: false, error: "Email already registered" }, 409);
    }
    const saltBytes = randomBytes(16);
    const iterations = 150000;
    const hash = await deriveHash(password, saltBytes.buffer as ArrayBuffer, iterations);
    const equip = JSON.stringify(body.equipment_available || []);
    const tdays = body.training_days_per_week ?? 4;
    const age = body.current_training_age ?? "BEGINNER";
    const result = await c.env.DB.prepare(
      "INSERT INTO users (email, password_hash, password_salt, password_iterations, equipment_available, training_days_per_week, current_training_age) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(email, hash, base64Of(saltBytes), iterations, equip, tdays, age).run();
    const userId = result.meta.last_row_id;
    await c.env.DB.prepare(
      "INSERT INTO training_states (user_id, current_week, current_phase, cycle_start_date) VALUES (?, 1, 'VOLUME', DATE('now'))"
    ).bind(userId).run();
    const tokenBytes = randomBytes(32);
    const token = base64Of(tokenBytes);
    const ua = c.req.header("User-Agent") || "";
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString();
    const hashed = await sha256Base64(token);
    await c.env.DB.prepare(
      "INSERT INTO devices (user_id, token, device_info, expires_at) VALUES (?, ?, ?, ?)"
    ).bind(userId, hashed, ua, expires).run();
    setCookie(c, DEVICE_COOKIE_NAME, token, { httpOnly: true, secure: true, sameSite: "Lax", maxAge: 60 * 60 * 24 * 180, path: "/" });
    const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<UserRow>();
    const response: ApiResponse<User> = {
      success: true,
      data: {
        id: user!.id,
        equipment_available: JSON.parse(user!.equipment_available) as string[],
        training_days_per_week: user!.training_days_per_week,
        current_training_age: user!.current_training_age,
        drop_sets_enabled: Boolean(user!.drop_sets_enabled),
        supersets_enabled: Boolean(user!.supersets_enabled),
        height_cm: user!.height_cm ?? null,
        weight_kg: user!.weight_kg ?? null,
        age_years: user!.age_years ?? null,
        sex: user!.sex ?? 'UNKNOWN',
        created_at: user!.created_at,
        updated_at: user!.updated_at,
      },
    };
    return c.json(response);
  } catch {
    return c.json({ success: false, error: "Failed to register" }, 500);
  }
});

app.post("/api/auth/login", async (c) => {
  try {
    const body = await c.req.json<{ email: string; password: string }>();
    const email = (body.email || "").toLowerCase().trim();
    const password = body.password || "";
    const user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
    if (!user || !user.password_hash || !user.password_salt || !user.password_iterations) {
      return c.json({ success: false, error: "Invalid credentials" }, 401);
    }
    const saltBytes = Uint8Array.from(atob(user.password_salt), c => c.charCodeAt(0));
    const hash = await deriveHash(password, saltBytes.buffer as ArrayBuffer, user.password_iterations!);
    if (hash !== user.password_hash) {
      return c.json({ success: false, error: "Invalid credentials" }, 401);
    }
    const tokenBytes = randomBytes(32);
    const token = base64Of(tokenBytes);
    const ua = c.req.header("User-Agent") || "";
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString();
    const hashed = await sha256Base64(token);
    await c.env.DB.prepare("INSERT INTO devices (user_id, token, device_info, expires_at) VALUES (?, ?, ?, ?)").bind(user.id, hashed, ua, expires).run();
    setCookie(c, DEVICE_COOKIE_NAME, token, { httpOnly: true, secure: true, sameSite: "Lax", maxAge: 60 * 60 * 24 * 180, path: "/" });
    return c.json({ success: true });
  } catch {
    return c.json({ success: false, error: "Failed to login" }, 500);
  }
});

app.post("/api/auth/logout", async (c) => {
  try {
    const token = getCookie(c, DEVICE_COOKIE_NAME);
    if (token) {
      const hashed = await sha256Base64(token);
      await c.env.DB.prepare("DELETE FROM devices WHERE token = ?").bind(hashed).run();
      deleteCookie(c, DEVICE_COOKIE_NAME, { path: "/" });
    }
    return c.json({ success: true });
  } catch {
    return c.json({ success: false, error: "Failed to logout" }, 500);
  }
});

app.get("/api/auth/me", async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) return c.json({ success: false, error: "Not authenticated" }, 401);
  return c.json({ success: true, data: { id: user.id, email: user.email ?? null } });
});
app.get("/api/auth/google/start", async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const redirectUri = c.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return c.json({ success: false, error: "Google OAuth not configured" }, 500);
  }
  const state = base64Of(randomBytes(16));
  setCookie(c, "oauth_state", state, { httpOnly: true, secure: true, sameSite: "Lax", maxAge: 600, path: "/" });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    include_granted_scopes: "true",
    access_type: "online",
  });
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return c.redirect(url);
});
app.get("/api/auth/google/callback", async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = c.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return c.json({ success: false, error: "Google OAuth not configured" }, 500);
  }
  const url = new URL(c.req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = getCookie(c, "oauth_state");
  if (!code || !state || !cookieState || state !== cookieState) {
    return c.json({ success: false, error: "Invalid OAuth state" }, 400);
  }
  deleteCookie(c, "oauth_state", { path: "/" });
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenRes.ok) {
    return c.json({ success: false, error: "Token exchange failed" }, 400);
  }
  const tokenJson = await tokenRes.json() as { access_token?: string };
  const access = tokenJson.access_token;
  if (!access) {
    return c.json({ success: false, error: "Access token missing" }, 400);
  }
  const userinfoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!userinfoRes.ok) {
    return c.json({ success: false, error: "Failed to fetch user info" }, 400);
  }
  const userinfo = await userinfoRes.json() as { email?: string; sub?: string; name?: string };
  const email = (userinfo.email || "").toLowerCase().trim();
  if (!email) {
    return c.json({ success: false, error: "Email not available" }, 400);
  }
  let user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
  let isNew = false;
  if (!user) {
    const result = await c.env.DB.prepare(
      "INSERT INTO users (email, equipment_available, training_days_per_week, current_training_age) VALUES (?, '[]', 4, 'BEGINNER')"
    ).bind(email).run();
    const userId = result.meta.last_row_id;
    await c.env.DB.prepare(
      "INSERT INTO training_states (user_id, current_week, current_phase, cycle_start_date) VALUES (?, 1, 'VOLUME', DATE('now'))"
    ).bind(userId).run();
    user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<UserRow>();
    isNew = true;
  }
  const tokenBytes = randomBytes(32);
  const deviceToken = base64Of(tokenBytes);
  const hashed = await sha256Base64(deviceToken);
  const ua = c.req.header("User-Agent") || "";
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString();
  await c.env.DB.prepare("INSERT INTO devices (user_id, token, device_info, expires_at) VALUES (?, ?, ?, ?)").bind(user!.id, hashed, ua, expires).run();
  setCookie(c, DEVICE_COOKIE_NAME, deviceToken, { httpOnly: true, secure: true, sameSite: "Lax", maxAge: 60 * 60 * 24 * 180, path: "/" });
  return c.redirect(isNew ? "/setup" : "/dashboard");
});
app.post("/api/goal/evaluate", async (c) => {
  try {
    const userRow = await getUserOrDefault(c);
    if (!userRow) {
      return c.json({ success: false, error: "User not found" }, 404);
    }
    const state = await c.env.DB.prepare(
      "SELECT * FROM training_states WHERE user_id = ?"
    ).bind(userRow.id).first<TrainingState>();
    if (!state) {
      return c.json({ success: false, error: "Training state not found" }, 404);
    }
    const goalRow = await c.env.DB.prepare(
      "SELECT id, type, target_value, deadline FROM goals WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1"
    ).bind(userRow.id).first<{ id: number; type: GoalType; target_value: number; deadline: string }>();
    if (!goalRow) {
      return c.json({ success: false, error: "Active goal not found" }, 404);
    }
    const muscles = await c.env.DB.prepare(
      "SELECT weekly_sets_completed FROM muscles"
    ).all<{ weekly_sets_completed: number }>();
    const weeklyVolume = muscles.results.reduce((sum, m) => sum + (m.weekly_sets_completed || 0), 0);
    const lastProgress = await c.env.DB.prepare(
      "SELECT current_weight, recorded_at FROM goal_progress WHERE goal_id = ? ORDER BY recorded_at DESC LIMIT 1"
    ).bind(goalRow.id).first<{ current_weight: number; recorded_at: string }>();
    const ctx = {
      current_weight_kg: Number(userRow.weight_kg ?? 0),
      target_weight_kg: goalRow.target_value,
      height_cm: Number(userRow.height_cm ?? 0),
      age_years: Number(userRow.age_years ?? 0),
      sex: (userRow.sex ?? 'UNKNOWN') as 'MALE' | 'FEMALE' | 'UNKNOWN',
      training_days_per_week: userRow.training_days_per_week,
      goal_type: goalRow.type,
      deadline_iso: goalRow.deadline,
      last_progress_weight_kg: lastProgress?.current_weight,
      last_progress_date: lastProgress?.recorded_at,
      skip_count_current_week: state.skip_count_current_week,
    };
    const result = GoalEngine.evaluate(ctx);
    const alignmentStatus = result.behind_schedule ? 'BEHIND' : 'ON_TRACK';
    await c.env.DB.prepare(
      "INSERT INTO goal_progress (goal_id, current_weight, weekly_volume, alignment_status) VALUES (?, ?, ?, ?)"
    ).bind(goalRow.id, ctx.current_weight_kg, weeklyVolume, alignmentStatus).run();
    return c.json({ success: true, data: result });
  } catch (error) {
    console.error("Goal evaluation error:", error);
    return c.json({ success: false, error: "Failed to evaluate goal alignment" }, 500);
  }
});
/**
 * Feature 3: Exercise Execution & Checklist System
 * 
 * Session Endpoints:
 * - POST /api/session/start: begin a workout session for a plan
 * - POST /api/session/complete_set: append a completed set in strict order
 * - POST /api/session/finish: mark session complete and update recovery/volume
 */
app.post("/api/session/start", async (c) => {
  try {
    const body = await c.req.json<{ workout_plan_id: number }>();
    const { workout_plan_id } = body;
    if (!workout_plan_id) {
      return c.json({ success: false, error: "workout_plan_id is required" }, 400);
    }
    const plan = await c.env.DB.prepare(
      "SELECT id FROM workout_plans WHERE id = ?"
    ).bind(workout_plan_id).first<{ id: number }>();
    if (!plan) {
      return c.json({ success: false, error: "Workout plan not found" }, 404);
    }
    const now = new Date().toISOString();
    const result = await c.env.DB.prepare(
      `INSERT INTO workout_sessions (workout_plan_id, started_at, completed_exercises)
       VALUES (?, ?, '[]')`
    ).bind(workout_plan_id, now).run();
    const sessionId = result.meta.last_row_id;
    return c.json({ success: true, data: { session_id: sessionId } });
  } catch (error) {
    console.error("Session start error:", error);
    return c.json({ success: false, error: "Failed to start session" }, 500);
  }
});

app.post("/api/session/unskip_exercise", async (c) => {
  try {
    const body = await c.req.json<{ session_id: number; exercise_id: number }>();
    const { session_id, exercise_id } = body;
    if (!session_id || !exercise_id) {
      return c.json({ success: false, error: "session_id and exercise_id are required" }, 400);
    }
    const session = await c.env.DB.prepare(
      "SELECT workout_plan_id, completed_exercises FROM workout_sessions WHERE id = ?"
    ).bind(session_id).first<{ workout_plan_id: number; completed_exercises: string }>();
    if (!session) {
      return c.json({ success: false, error: "Session not found" }, 404);
    }
    const completed = JSON.parse(session.completed_exercises || "[]") as CompletedExerciseLocal[];
    const ex = completed.find((e) => e.exercise_id === exercise_id);
    if (ex) {
      delete ex.skipped;
      delete ex.skip_reason;
    }
    await c.env.DB.prepare(
      "UPDATE workout_sessions SET completed_exercises = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(JSON.stringify(completed), session_id).run();
    return c.json({ success: true, data: { skipped: false } });
  } catch (error) {
    console.error("Unskip exercise error:", error);
    return c.json({ success: false, error: "Failed to unskip exercise" }, 500);
  }
});

app.post("/api/session/skip_exercise", async (c) => {
  try {
    const body = await c.req.json<{ session_id: number; exercise_id: number; reason?: string }>();
    const { session_id, exercise_id, reason } = body;
    if (!session_id || !exercise_id) {
      return c.json({ success: false, error: "session_id and exercise_id are required" }, 400);
    }
    const session = await c.env.DB.prepare(
      "SELECT workout_plan_id, completed_exercises FROM workout_sessions WHERE id = ?"
    ).bind(session_id).first<{ workout_plan_id: number; completed_exercises: string }>();
    if (!session) {
      return c.json({ success: false, error: "Session not found" }, 404);
    }
    const plan = await c.env.DB.prepare(
      "SELECT exercises FROM workout_plans WHERE id = ?"
    ).bind(session.workout_plan_id).first<{ exercises: string }>();
    if (!plan) {
      return c.json({ success: false, error: "Workout plan not found" }, 404);
    }
    const completed = JSON.parse(session.completed_exercises || "[]") as CompletedExerciseLocal[];
    let ex = completed.find((e) => e.exercise_id === exercise_id);
    if (!ex) {
      const exRow = await c.env.DB.prepare(
        "SELECT name FROM exercises WHERE id = ?"
      ).bind(exercise_id).first<{ name: string }>();
      ex = {
        exercise_id,
        exercise_name: exRow?.name || `Exercise ${exercise_id}`,
        sets: [],
      };
      completed.push(ex);
    }
    ex.skipped = true;
    if (reason) ex.skip_reason = reason;
    await c.env.DB.prepare(
      "UPDATE workout_sessions SET completed_exercises = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(JSON.stringify(completed), session_id).run();
    return c.json({ success: true, data: { skipped: true } });
  } catch (error) {
    console.error("Skip exercise error:", error);
    return c.json({ success: false, error: "Failed to skip exercise" }, 500);
  }
});

app.post("/api/session/complete_set", async (c) => {
  try {
    const body = await c.req.json<{
      session_id: number;
      exercise_id: number;
      set_number: number;
      reps_completed: number;
      load_kg: number | null;
      rpe: number | null;
    }>();
    const { session_id, exercise_id, set_number, reps_completed, load_kg, rpe } = body;
    if (!session_id || !exercise_id || !set_number || !reps_completed) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    const session = await c.env.DB.prepare(
      "SELECT workout_plan_id, completed_exercises FROM workout_sessions WHERE id = ?"
    ).bind(session_id).first<{ workout_plan_id: number; completed_exercises: string }>();
    if (!session) {
      return c.json({ success: false, error: "Session not found" }, 404);
    }
    const plan = await c.env.DB.prepare(
      "SELECT exercises FROM workout_plans WHERE id = ?"
    ).bind(session.workout_plan_id).first<{ exercises: string }>();
    if (!plan) {
      return c.json({ success: false, error: "Workout plan not found" }, 404);
    }
    const plannedExercises = JSON.parse(plan.exercises) as Array<{
      exercise_id: number;
      sets: number;
      reps: number;
      rest_seconds: number;
    }>;
    const planned = plannedExercises.find((e) => e.exercise_id === exercise_id);
    if (!planned) {
      return c.json({ success: false, error: "Exercise not in plan" }, 400);
    }
    const completed = JSON.parse(session.completed_exercises || "[]") as Array<{
      exercise_id: number;
      exercise_name: string;
      sets: Array<{ set_number: number; reps_completed: number; load_kg: number | null; rpe: number | null }>;
    }>;
    let ex = completed.find((e) => e.exercise_id === exercise_id);
    if (!ex) {
      // Look up exercise name for better UX
      const exRow = await c.env.DB.prepare(
        "SELECT name FROM exercises WHERE id = ?"
      ).bind(exercise_id).first<{ name: string }>();
      ex = {
        exercise_id,
        exercise_name: exRow?.name || `Exercise ${exercise_id}`,
        sets: [],
      };
      completed.push(ex);
    }
    const expectedNextSet = ex.sets.length + 1;
    if (set_number !== expectedNextSet) {
      return c.json({ success: false, error: `Set must be completed in order. Expected set ${expectedNextSet}` }, 400);
    }
    if (set_number > planned.sets) {
      return c.json({ success: false, error: "Set number exceeds planned sets" }, 400);
    }
    ex.sets.push({ set_number, reps_completed, load_kg, rpe });
    await c.env.DB.prepare(
      "UPDATE workout_sessions SET completed_exercises = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(JSON.stringify(completed), session_id).run();
    return c.json({
      success: true,
      data: {
        rest_seconds: planned.rest_seconds,
        completed_sets: ex.sets.length,
        total_sets: planned.sets,
      },
    });
  } catch (error) {
    console.error("Complete set error:", error);
    return c.json({ success: false, error: "Failed to record set" }, 500);
  }
});

app.post("/api/session/finish", async (c) => {
  try {
    const body = await c.req.json<{ session_id: number }>();
    const { session_id } = body;
    if (!session_id) {
      return c.json({ success: false, error: "session_id is required" }, 400);
    }
    const session = await c.env.DB.prepare(
      "SELECT workout_plan_id, completed_exercises FROM workout_sessions WHERE id = ?"
    ).bind(session_id).first<{ workout_plan_id: number; completed_exercises: string }>();
    if (!session) {
      return c.json({ success: false, error: "Session not found" }, 404);
    }
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      "UPDATE workout_sessions SET completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(now, session_id).run();
    // Update muscle recovery timestamps and weekly volume
    const completed = JSON.parse(session.completed_exercises || "[]") as Array<{
      exercise_id: number;
      sets: Array<{ set_number: number }>;
    }>;
    for (const ex of completed) {
      const row = await c.env.DB.prepare(
        "SELECT primary_muscles FROM exercises WHERE id = ?"
      ).bind(ex.exercise_id).first<{ primary_muscles: string }>();
      if (!row) continue;
      const primaryMuscles = JSON.parse(row.primary_muscles) as string[];
      for (const muscleName of primaryMuscles) {
        await c.env.DB.prepare(
          "UPDATE muscles SET last_trained_at = CURRENT_TIMESTAMP, weekly_sets_completed = weekly_sets_completed + ? WHERE name = ?"
        ).bind(ex.sets.length, muscleName).run();
      }
    }
    return c.json({ success: true, data: { completed_at: now } });
  } catch (error) {
    console.error("Session finish error:", error);
    return c.json({ success: false, error: "Failed to finish session" }, 500);
  }
});

app.get("/api/sessions/attendance", async (c) => {
  try {
    const u = await getUserOrDefault(c);
    if (!u) {
      return c.json({ success: false, error: "User not found" }, 404);
    }
    const url = new URL(c.req.url);
    const startParam = url.searchParams.get("start");
    const endParam = url.searchParams.get("end");
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const start = startParam || monthStart.toISOString().split("T")[0];
    const end = endParam || monthEnd.toISOString().split("T")[0];
    const rows = await c.env.DB.prepare(
      `SELECT s.completed_at FROM workout_sessions s
       WHERE s.completed_at IS NOT NULL
         AND s.workout_plan_id IN (
           SELECT id FROM workout_plans WHERE user_id = ?
         )
         AND date(s.completed_at) BETWEEN date(?) AND date(?)`
    ).bind(u.id, start, end).all<{ completed_at: string }>();
    const set = new Set<string>();
    for (const r of rows.results) {
      try {
        const d = new Date(r.completed_at);
        const key = d.toISOString().split("T")[0];
        set.add(key);
      } catch { void 0; }
    }
    return c.json({ success: true, data: { dates: Array.from(set).sort() } });
  } catch (error) {
    console.error("Attendance fetch error:", error);
    return c.json({ success: false, error: "Failed to fetch attendance" }, 500);
  }
});

/**
 * Alternate Exercise Endpoint
 * 
 * Allows replacing a planned exercise with an alternate that targets the same muscle,
 * respects equipment availability, and maintains the planned sets/reps/rest.
 */
app.post("/api/exercise/alternate", async (c) => {
  try {
    const body = await c.req.json<{ workout_plan_id: number; current_exercise_id: number }>();
    const { workout_plan_id, current_exercise_id } = body;
    if (!workout_plan_id || !current_exercise_id) {
      return c.json({ success: false, error: "workout_plan_id and current_exercise_id are required" }, 400);
    }

    const planRow = await c.env.DB.prepare(
      "SELECT * FROM workout_plans WHERE id = ?"
    ).bind(workout_plan_id).first<WorkoutPlanRow>();
    if (!planRow) {
      return c.json({ success: false, error: "Workout plan not found" }, 404);
    }

    const plannedExercises = JSON.parse(planRow.exercises) as Array<{
      exercise_id: number;
      exercise_name: string;
      sets: number;
      reps: number;
      load_kg: number | null;
      rest_seconds: number;
      primary_muscles: string[];
      is_superset?: boolean;
      has_drop_set?: boolean;
    }>;

    const idx = plannedExercises.findIndex((e) => e.exercise_id === current_exercise_id);
    if (idx === -1) {
      return c.json({ success: false, error: "Exercise not in plan" }, 400);
    }
    const currentPlanned = plannedExercises[idx];

    const currentExerciseRow = await c.env.DB.prepare(
      "SELECT exercise_type FROM exercises WHERE id = ?"
    ).bind(current_exercise_id).first<{ exercise_type: string }>();
    const currentType = currentExerciseRow?.exercise_type || "COMPOUND";

    const userRow = await c.env.DB.prepare(
      "SELECT * FROM users WHERE id = ?"
    ).bind(planRow.user_id).first<UserRow>();
    if (!userRow) {
      return c.json({ success: false, error: "User not found" }, 404);
    }
    const userEquipment = JSON.parse(userRow.equipment_available) as string[];
    const dropSetsEnabled = Boolean(userRow.drop_sets_enabled);

    const exRows = await c.env.DB.prepare("SELECT * FROM exercises").all<ExerciseRow>();
    const availableExercises: AvailableExercise[] = exRows.results.map((ex: ExerciseRow) => ({
      id: ex.id as number,
      name: ex.name,
      primary_muscles: JSON.parse(ex.primary_muscles) as string[],
      secondary_muscles: JSON.parse(ex.secondary_muscles) as string[],
      equipment_required: ex.equipment_required,
      exercise_type: ex.exercise_type,
      default_rest_seconds: ex.default_rest_seconds,
    }));

    const usedIds = new Set(plannedExercises.map((e) => e.exercise_id));
    const candidates = availableExercises.filter((ex: AvailableExercise) => {
      const targetsSame = ex.primary_muscles.some((m: string) => currentPlanned.primary_muscles.includes(m));
      const notSame = ex.id !== currentPlanned.exercise_id;
      const notUsed = !usedIds.has(ex.id);
      const hasEquipment = userEquipment.includes(ex.equipment_required);
      return targetsSame && notSame && notUsed && hasEquipment;
    });

    let chosen = candidates.find((ex: AvailableExercise) => ex.exercise_type === currentType);
    if (!chosen) chosen = candidates[0];
    if (!chosen) {
      return c.json({ success: false, error: "No alternate exercise available" }, 400);
    }

    const replacement = {
      exercise_id: chosen.id,
      exercise_name: chosen.name,
      sets: currentPlanned.sets,
      reps: currentPlanned.reps,
      load_kg: null,
      rest_seconds: currentPlanned.rest_seconds,
      primary_muscles: chosen.primary_muscles,
      is_superset: currentPlanned.is_superset,
      has_drop_set: dropSetsEnabled && chosen.exercise_type === "ISOLATION" ? true : false,
    };

    plannedExercises[idx] = replacement;
    await c.env.DB.prepare(
      "UPDATE workout_plans SET exercises = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(JSON.stringify(plannedExercises), workout_plan_id).run();

    const updatedPlan = await c.env.DB.prepare(
      "SELECT * FROM workout_plans WHERE id = ?"
    ).bind(workout_plan_id).first<WorkoutPlanRowFull>();

    const response: ApiResponse<WorkoutPlan> = {
      success: true,
      data: {
        ...updatedPlan!,
        exercises: JSON.parse(updatedPlan!.exercises),
      },
    };
    return c.json(response);
  } catch (error) {
    console.error("Alternate exercise error:", error);
    return c.json({ success: false, error: "Failed to generate alternate exercise" }, 500);
  }
});

// User Setup Endpoint
app.post("/api/user/setup", async (c) => {
  try {
    const body = await c.req.json<{
      training_age: TrainingAge;
      training_days_per_week: number;
      equipment_available: EquipmentType[];
    }>();

    const { training_age, training_days_per_week, equipment_available } = body;

    // Validate input
    if (!training_age || !training_days_per_week || !equipment_available) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }

    if (training_days_per_week < 3 || training_days_per_week > 6) {
      return c.json({ success: false, error: "Training days must be between 3 and 6" }, 400);
    }

    const authed = await getAuthenticatedUser(c);
    if (!authed) {
      return c.json({ success: false, error: "Not authenticated" }, 401);
    }
    const userId = authed.id;
    await c.env.DB.prepare(
      `UPDATE users 
       SET equipment_available = ?, 
           training_days_per_week = ?, 
           current_training_age = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(
      JSON.stringify(equipment_available),
      training_days_per_week,
      training_age,
      userId
    ).run();
    const stateExists = await c.env.DB.prepare("SELECT id FROM training_states WHERE user_id = ?").bind(userId).first<{ id: number }>();
    if (!stateExists) {
      await c.env.DB.prepare(
        `INSERT INTO training_states (user_id, current_week, current_phase, cycle_start_date)
         VALUES (?, 1, 'VOLUME', DATE('now'))`
      ).bind(userId).run();
    }

    const userRow = await c.env.DB.prepare(
      "SELECT * FROM users WHERE id = ?"
    ).bind(userId).first<UserRow>();

    const response: ApiResponse<User> = {
      success: true,
      data: {
        id: userRow!.id,
        equipment_available: JSON.parse(userRow!.equipment_available) as string[],
        training_days_per_week: userRow!.training_days_per_week,
        current_training_age: userRow!.current_training_age,
        drop_sets_enabled: Boolean(userRow!.drop_sets_enabled),
        supersets_enabled: Boolean(userRow!.supersets_enabled),
        created_at: userRow!.created_at,
        updated_at: userRow!.updated_at,
      },
    };

    return c.json(response);
  } catch (error) {
    console.error("Setup error:", error);
    return c.json({ success: false, error: "Failed to save user settings" }, 500);
  }
});

// Get User Profile
app.get("/api/user/profile", async (c) => {
  try {
    const userRow = await getUserOrDefault(c);

    if (!userRow) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    const response: ApiResponse<User> = {
      success: true,
      data: {
        id: userRow.id,
        equipment_available: JSON.parse(userRow.equipment_available) as string[],
        training_days_per_week: userRow.training_days_per_week,
        current_training_age: userRow.current_training_age,
        drop_sets_enabled: Boolean(userRow.drop_sets_enabled),
        supersets_enabled: Boolean(userRow.supersets_enabled),
        created_at: userRow.created_at,
        updated_at: userRow.updated_at,
      },
    };

    return c.json(response);
  } catch (error) {
    console.error("Profile fetch error:", error);
    return c.json({ success: false, error: "Failed to fetch profile" }, 500);
  }
});

// Get Training State
app.get("/api/training/state", async (c) => {
  try {
    const u = await getUserOrDefault(c);

    if (!u) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    const state = await c.env.DB.prepare(
      "SELECT * FROM training_states WHERE user_id = ?"
    ).bind(u.id).first<TrainingState>();

    if (!state) {
      return c.json({ success: false, error: "Training state not found" }, 404);
    }

    const response: ApiResponse<TrainingState> = {
      success: true,
      data: state,
    };

    return c.json(response);
  } catch (error) {
    console.error("Training state fetch error:", error);
    return c.json({ success: false, error: "Failed to fetch training state" }, 500);
  }
});

// Get Muscle Recovery Status
app.get("/api/recovery/status", async (c) => {
  try {
    const muscles = await c.env.DB.prepare(
      "SELECT * FROM muscles ORDER BY name"
    ).all<DbMuscle>();

    const now = new Date();
    const recoveryStatuses = muscles.results.map((muscle: DbMuscle) => {
      if (!muscle.last_trained_at) {
        return {
          muscle_name: muscle.name,
          status: 'READY',
          hours_since_training: null,
          hours_until_ready: 0,
        };
      }

      const lastTrained = new Date(muscle.last_trained_at);
      const hoursSince = (now.getTime() - lastTrained.getTime()) / (1000 * 60 * 60);
      const hoursUntilReady = Math.max(0, muscle.recovery_hours_required - hoursSince);

      let status: 'READY' | 'PARTIAL' | 'BLOCKED';
      if (hoursSince >= muscle.recovery_hours_required) {
        status = 'READY';
      } else if (hoursSince >= 36) {
        status = 'PARTIAL';
      } else {
        status = 'BLOCKED';
      }

      return {
        muscle_name: muscle.name,
        status,
        hours_since_training: Math.round(hoursSince * 10) / 10,
        hours_until_ready: Math.round(hoursUntilReady * 10) / 10,
      };
    });

    return c.json({
      success: true,
      data: recoveryStatuses,
    });
  } catch (error) {
    console.error("Recovery status error:", error);
    return c.json({ success: false, error: "Failed to fetch recovery status" }, 500);
  }
});

// Get Weekly Volume Progress
app.get("/api/training/volume", async (c) => {
  try {
    const muscles = await c.env.DB.prepare(
      "SELECT name, weekly_sets_completed, weekly_sets_target FROM muscles ORDER BY name"
    ).all<{ name: string; weekly_sets_completed: number; weekly_sets_target: number }>();

    const totalCompleted = muscles.results.reduce((sum: number, m) => sum + m.weekly_sets_completed, 0);
    const totalTarget = muscles.results.reduce((sum: number, m) => sum + m.weekly_sets_target, 0);

    return c.json({
      success: true,
      data: {
        total_completed: totalCompleted,
        total_target: totalTarget,
        muscles: muscles.results,
      },
    });
  } catch (error) {
    console.error("Volume fetch error:", error);
    return c.json({ success: false, error: "Failed to fetch volume data" }, 500);
  }
});

// Weekly Progression Evaluation
app.post("/api/progression/evaluate", async (c) => {
  try {
    const userRow = await getUserOrDefault(c);

    if (!userRow) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    const state = await c.env.DB.prepare(
      "SELECT * FROM training_states WHERE user_id = ?"
    ).bind(userRow.id).first<TrainingState>();

    if (!state) {
      return c.json({ success: false, error: "Training state not found" }, 404);
    }

    const muscles = await c.env.DB.prepare(
      "SELECT * FROM muscles ORDER BY name"
    ).all<{
      id: number;
      name: string;
      last_trained_at: string | null;
      recovery_hours_required: number;
      weekly_sets_completed: number;
      weekly_sets_target: number;
    }>();

    const goal = await c.env.DB.prepare(
      "SELECT type, deadline FROM goals WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1"
    ).bind(userRow.id).first<{ type: GoalType; deadline: string }>();

    const todayIso = new Date().toISOString();
    const result: ProgressionResult = ProgressionEngine.evaluateWeekly({
      muscles: muscles.results,
      training_state: state,
      goal_type: goal?.type || null,
      today_iso: todayIso,
    });

    // If no changes this week, return with logs
    if (!result.phase_changed_to && result.muscle_updates.length === 0 && !result.deload_triggered) {
      return c.json({ success: true, data: result });
    }

    // Apply muscle target updates
    for (const u of result.muscle_updates) {
      if (u.new_weekly_target !== u.previous_weekly_target) {
        await c.env.DB.prepare(
          "UPDATE muscles SET weekly_sets_target = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?"
        ).bind(u.new_weekly_target, u.muscle_name).run();
      }
    }

    // Update training phase and week
    if (result.phase_changed_to) {
      if (result.phase_changed_to === 'DELOAD') {
        await c.env.DB.prepare(
          "UPDATE training_states SET current_phase = 'DELOAD', last_deload_date = DATE('now'), current_week = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(result.applied_week, state.id).run();
      } else {
        await c.env.DB.prepare(
          "UPDATE training_states SET current_phase = ?, current_week = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(result.phase_changed_to, result.applied_week, state.id).run();
      }
    } else {
      await c.env.DB.prepare(
        "UPDATE training_states SET current_week = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(result.applied_week, state.id).run();
    }

    return c.json({ success: true, data: result });
  } catch (error) {
    console.error("Progression evaluation error:", error);
    return c.json({ success: false, error: "Failed to evaluate progression" }, 500);
  }
});

// Generate Today's Workout
app.post("/api/workout/generate", async (c) => {
  try {
    let override: { schedule_override?: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' } = {};
    try {
      override = await c.req.json();
    } catch {
      override = {};
    }
    const userRow = await getUserOrDefault(c);

    if (!userRow) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    // Parse equipment
    const userEquipment = JSON.parse(userRow.equipment_available) as EquipmentType[];

    // Get training state
    const state = await c.env.DB.prepare(
      "SELECT * FROM training_states WHERE user_id = ?"
    ).bind(userRow.id).first<TrainingState>();

    if (!state) {
      return c.json({ success: false, error: "Training state not found" }, 404);
    }

    // Get active goal
    const goal = await c.env.DB.prepare(
      "SELECT id, type, deadline FROM goals WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1"
    ).bind(userRow.id).first<{ id: number; type: GoalType; deadline: string }>();

    // Get all muscles with recovery status
    const muscles = await c.env.DB.prepare(
      "SELECT * FROM muscles ORDER BY name"
    ).all<DbMuscle>();

    const now = new Date();
    const musclesWithRecovery: MuscleWithRecoveryLocal[] = muscles.results.map((muscle: DbMuscle) => {
      let recoveryStatus: RecoveryStatus = 'READY';
      
      if (muscle.last_trained_at) {
        const lastTrained = new Date(muscle.last_trained_at);
        const hoursSince = (now.getTime() - lastTrained.getTime()) / (1000 * 60 * 60);
        
        if (hoursSince >= muscle.recovery_hours_required) {
          recoveryStatus = 'READY';
        } else if (hoursSince >= 36) {
          recoveryStatus = 'PARTIAL';
        } else {
          recoveryStatus = 'BLOCKED';
        }
      }

      return {
        id: muscle.id,
        name: muscle.name,
        recovery_status: recoveryStatus,
        weekly_sets_completed: muscle.weekly_sets_completed,
        weekly_sets_target: muscle.weekly_sets_target,
        volume_deficit: muscle.weekly_sets_target - muscle.weekly_sets_completed,
      };
    });

    let preferredPair: [string, string] | undefined;
    if (override.schedule_override === 'MONDAY') {
      preferredPair = ['Back', 'Biceps'];
    } else if (override.schedule_override === 'TUESDAY') {
      preferredPair = ['Chest', 'Triceps'];
    } else if (override.schedule_override === 'WEDNESDAY') {
      const legs = musclesWithRecovery
        .filter(m => m.name === 'Quads' || m.name === 'Hamstrings')
        .sort((a, b) => b.volume_deficit - a.volume_deficit);
      const leg = legs.find(m => m.recovery_status === 'READY' || m.recovery_status === 'PARTIAL') || legs[0];
      if (leg) {
        preferredPair = [leg.name, 'Abs'];
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const previousPlan = await c.env.DB.prepare(
      "SELECT scheduled_date, status, exercises FROM workout_plans WHERE user_id = ? AND scheduled_date < ? ORDER BY scheduled_date DESC LIMIT 1"
    ).bind(userRow.id, today).first<{ scheduled_date: string; status: WorkoutStatus; exercises: string }>();

    let recommendation: SkipResolutionResult = {
      skip_detected: false,
      recommended_action: 'CONTINUE',
      reason: 'No missed workout detected; continue schedule.',
    };

    if (!override.schedule_override) {
      const prevSummary = previousPlan
        ? {
            scheduled_date: previousPlan.scheduled_date,
            status: previousPlan.status,
            exercises: JSON.parse(previousPlan.exercises || '[]') as Array<{ primary_muscles: string[] }>,
          }
        : null;
      recommendation = resolveSkip({
        today,
        previous_plan: prevSummary,
        muscles_with_recovery: musclesWithRecovery,
        goal_type: goal?.type || null,
        goal_deadline: goal?.deadline || null,
      });
      if (recommendation.preferred_pair) {
        preferredPair = recommendation.preferred_pair;
      }
    }

    // Get all available exercises
    const exercises = await c.env.DB.prepare(
      "SELECT * FROM exercises"
    ).all<ExerciseRow>();

    const availableExercises = exercises.results.map((ex: ExerciseRow) => ({
      id: ex.id,
      name: ex.name,
      primary_muscles: JSON.parse(ex.primary_muscles) as string[],
      secondary_muscles: JSON.parse(ex.secondary_muscles) as string[],
      equipment_required: ex.equipment_required as EquipmentType,
      exercise_type: ex.exercise_type,
      default_rest_seconds: ex.default_rest_seconds,
    }));

    // Determine if deload week
    let isDeloadWeek = state.current_phase === 'DELOAD';
    if (recommendation.recommended_action === 'MAINTENANCE') {
      isDeloadWeek = true;
    }

    // Parse user preferences (SQLite stores booleans as 0/1)
    const dropSetsEnabled = Boolean(userRow.drop_sets_enabled);
    const supersetsEnabled = Boolean(userRow.supersets_enabled);

    // Build prior intensity context from previous plan (avoid consecutive intensity on same muscles)
    const prevExercisesFull: Array<{ primary_muscles: string[]; has_drop_set?: boolean; is_superset?: boolean }> =
      previousPlan ? JSON.parse(previousPlan.exercises || '[]') : [];
    const priorDropMuscles = new Set<string>();
    const priorSupersetMuscles = new Set<string>();
    for (const ex of prevExercisesFull) {
      if (ex.has_drop_set) {
        ex.primary_muscles.forEach(m => priorDropMuscles.add(m));
      }
      if (ex.is_superset) {
        ex.primary_muscles.forEach(m => priorSupersetMuscles.add(m));
      }
    }

    let restFactorOverride: number | undefined;
    let volumeFactorOverride: number | undefined;
    let intensityReduced = false;
    let goalRealism: GoalRealism | undefined;
    let behindSchedule: boolean | undefined;
    let suggestedExtensionWeeks: number | undefined;
    let requiredRate: number | undefined;
    if (goal) {
      const goalFull = await c.env.DB.prepare(
        "SELECT id, type, target_value, deadline FROM goals WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1"
      ).bind(userRow.id).first<{ id: number; type: GoalType; target_value: number; deadline: string }>();
      const lastProgress = await c.env.DB.prepare(
        "SELECT current_weight, recorded_at FROM goal_progress WHERE goal_id = ? ORDER BY recorded_at DESC LIMIT 1"
      ).bind(goalFull?.id ?? goal.id).first<{ current_weight: number; recorded_at: string }>();
      const ctx = {
        current_weight_kg: Number(userRow.weight_kg ?? 0),
        target_weight_kg: Number(goalFull?.target_value ?? userRow.weight_kg ?? 0),
        height_cm: Number(userRow.height_cm ?? 0),
        age_years: Number(userRow.age_years ?? 0),
        sex: (userRow.sex ?? 'UNKNOWN') as 'MALE' | 'FEMALE' | 'UNKNOWN',
        training_days_per_week: userRow.training_days_per_week,
        goal_type: goal.type,
        deadline_iso: goal.deadline,
        last_progress_weight_kg: lastProgress?.current_weight,
        last_progress_date: lastProgress?.recorded_at,
        skip_count_current_week: state.skip_count_current_week,
      };
      const evalResult = GoalEngine.evaluate(ctx);
      restFactorOverride = evalResult.training_bias.rest_factor;
      volumeFactorOverride = evalResult.training_bias.volume_factor;
      intensityReduced = evalResult.training_bias.reduce_intensity_techniques;
      goalRealism = evalResult.realism;
      behindSchedule = evalResult.behind_schedule;
      suggestedExtensionWeeks = evalResult.suggested_extension_weeks;
      requiredRate = evalResult.required_weekly_rate_kg;
    }

    // Generate workout using the engine
    const generatedWorkout = WorkoutGenerator.generate({
      user_equipment: userEquipment,
      training_phase: state.current_phase,
      goal_type: goal?.type || null,
      goal_deadline: goal?.deadline || null,
      muscles_with_recovery: musclesWithRecovery,
      available_exercises: availableExercises,
      is_deload_week: isDeloadWeek,
      drop_sets_enabled: intensityReduced ? false : dropSetsEnabled,
      supersets_enabled: supersetsEnabled,
      preferred_pair: preferredPair,
      skip_count_current_week: state.skip_count_current_week,
      prior_intensity: {
        drop_muscles: Array.from(priorDropMuscles),
        superset_muscles: Array.from(priorSupersetMuscles),
      },
      rest_factor_override: restFactorOverride,
      volume_factor_override: volumeFactorOverride,
    });

    if (generatedWorkout.exercises.length === 0) {
      return c.json({
        success: false,
        error: "No muscles ready to train. Rest day recommended.",
      }, 400);
    }

    // Check if workout already exists for today
    const todayDate = new Date().toISOString().split('T')[0];
    const existingPlan = await c.env.DB.prepare(
      "SELECT id FROM workout_plans WHERE user_id = ? AND scheduled_date = ?"
    ).bind(userRow.id, todayDate).first<{ id: number }>();

    let planId: number;

    if (existingPlan) {
      // Update existing plan
      await c.env.DB.prepare(
        `UPDATE workout_plans 
         SET exercises = ?,
             estimated_duration_minutes = ?,
             focus_label = ?,
             status = 'PENDING',
             generated_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(
        JSON.stringify(generatedWorkout.exercises),
        generatedWorkout.estimated_duration_minutes,
        generatedWorkout.focus_label,
        existingPlan.id
      ).run();

      planId = existingPlan.id;
    } else {
      // Create new plan
      const result = await c.env.DB.prepare(
        `INSERT INTO workout_plans (
          user_id, 
          goal_id, 
          scheduled_date, 
          status, 
          estimated_duration_minutes, 
          exercises,
          focus_label
        ) VALUES (?, ?, ?, 'PENDING', ?, ?, ?)`
      ).bind(
        userRow.id,
        goal?.id || null,
        todayDate,
        generatedWorkout.estimated_duration_minutes,
        JSON.stringify(generatedWorkout.exercises),
        generatedWorkout.focus_label
      ).run();

      planId = result.meta.last_row_id;
    }

    // Fetch the created/updated plan
    const plan = await c.env.DB.prepare(
      "SELECT * FROM workout_plans WHERE id = ?"
    ).bind(planId).first<WorkoutPlanRowFull>();

    const parsedExercises = JSON.parse(plan!.exercises);
    const targets = (() => {
      try {
        const exs = parsedExercises as Array<{ primaryMuscle?: string; primary_muscles?: string[] }>;
        const set = new Set<string>();
        for (const ex of exs) {
          const pm = ex.primaryMuscle ?? (Array.isArray(ex.primary_muscles) ? ex.primary_muscles[0] : undefined);
          if (pm) set.add(pm);
        }
        return Array.from(set);
      } catch {
        return [];
      }
    })();
    const response: ApiResponse<WorkoutPlan> = {
      success: true,
      data: {
        ...plan!,
        exercises: parsedExercises,
        targetMuscles: targets,
      },
    };

    return c.json({ 
      ...response, 
      recommendation, 
      intensity_logs: generatedWorkout.intensity_logs,
      training_bias: {
        rest_factor: restFactorOverride ?? 1,
        volume_factor: volumeFactorOverride ?? 1,
        reduce_intensity_techniques: intensityReduced,
        realism: goalRealism ?? 'SAFE',
      },
      goal_alignment: {
        behind_schedule: behindSchedule ?? false,
        suggested_extension_weeks: suggestedExtensionWeeks ?? null,
        required_weekly_rate_kg: typeof requiredRate === 'number' ? requiredRate : null,
      },
    });
  } catch (error) {
    console.error("Workout generation error:", error);
    return c.json({ success: false, error: "Failed to generate workout" }, 500);
  }
});

// Get Today's Workout
app.get("/api/workout/today", async (c) => {
  try {
    const u = await getUserOrDefault(c);

    if (!u) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    const today = new Date().toISOString().split('T')[0];
    const plan = await c.env.DB.prepare(
      "SELECT * FROM workout_plans WHERE user_id = ? AND scheduled_date = ?"
    ).bind(u.id, today).first<WorkoutPlanRowFull>();

    if (!plan) {
      return c.json({ success: false, error: "No workout planned for today" }, 404);
    }

    const parsedExercises = JSON.parse(plan!.exercises);
    const targets = (() => {
      try {
        const exs = parsedExercises as Array<{ primaryMuscle?: string; primary_muscles?: string[] }>;
        const set = new Set<string>();
        for (const ex of exs) {
          const pm = ex.primaryMuscle ?? (Array.isArray(ex.primary_muscles) ? ex.primary_muscles[0] : undefined);
          if (pm) set.add(pm);
        }
        return Array.from(set);
      } catch {
        return [];
      }
    })();
    const response: ApiResponse<WorkoutPlan> = {
      success: true,
      data: {
        ...plan!,
        exercises: parsedExercises,
        targetMuscles: targets,
      },
    };

    return c.json(response);
  } catch (error) {
    console.error("Workout fetch error:", error);
    return c.json({ success: false, error: "Failed to fetch today's workout" }, 500);
  }
});

// Request Muscle-Focused Workout
app.post("/api/muscle/request", async (c) => {
  try {
    const body = await c.req.json<{
      muscle_name: string;
      force_override?: boolean; // Allow user to override soft blocks
    }>();

    const { muscle_name, force_override = false } = body;

    if (!muscle_name) {
      return c.json({ success: false, error: "Muscle name is required" }, 400);
    }

    const userRow = await getUserOrDefault(c);

    if (!userRow) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    // Get training state
    const state = await c.env.DB.prepare(
      "SELECT * FROM training_states WHERE user_id = ?"
    ).bind(userRow.id).first<TrainingState>();

    if (!state) {
      return c.json({ success: false, error: "Training state not found" }, 404);
    }

    // Get active goal
    const goal = await c.env.DB.prepare(
      "SELECT id, type, deadline FROM goals WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1"
    ).bind(userRow.id).first<{ id: number; type: GoalType; deadline: string }>();

    // Get all muscles with recovery calculation
    const muscles = await c.env.DB.prepare(
      "SELECT * FROM muscles ORDER BY name"
    ).all<DbMuscle>();

    interface DbMuscle {
      id: number;
      name: string;
      last_trained_at: string | null;
      recovery_hours_required: number;
      weekly_sets_completed: number;
      weekly_sets_target: number;
    }

    const now = new Date();
    
    // Find the requested muscle
    const requestedMuscle = muscles.results.find((m) => m.name === muscle_name);
    
    if (!requestedMuscle) {
      return c.json({ success: false, error: "Muscle not found" }, 404);
    }

    // Calculate recovery status for requested muscle
    let recoveryStatus: RecoveryStatus = 'READY';
    let hoursSinceTraining: number | null = null;
    
    if (requestedMuscle.last_trained_at) {
      const lastTrained = new Date(requestedMuscle.last_trained_at);
      hoursSinceTraining = (now.getTime() - lastTrained.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceTraining >= requestedMuscle.recovery_hours_required) {
        recoveryStatus = 'READY';
      } else if (hoursSinceTraining >= 36) {
        recoveryStatus = 'PARTIAL';
      } else {
        recoveryStatus = 'BLOCKED';
      }
    }

    // Build request context for all muscles (for alternative suggestions)
    const allMusclesContext = muscles.results.map((muscle) => {
      let status: RecoveryStatus = 'READY';
      
      if (muscle.last_trained_at) {
        const lastTrained = new Date(muscle.last_trained_at);
        const hoursSince = (now.getTime() - lastTrained.getTime()) / (1000 * 60 * 60);
        
        if (hoursSince >= muscle.recovery_hours_required) {
          status = 'READY';
        } else if (hoursSince >= 36) {
          status = 'PARTIAL';
        } else {
          status = 'BLOCKED';
        }
      }

      return {
        name: muscle.name,
        recovery_status: status,
        volume_deficit: muscle.weekly_sets_target - muscle.weekly_sets_completed,
      };
    });

    // Evaluate the muscle selection request
    const evaluation = MuscleSelector.evaluateRequest(
      {
        muscle_name: requestedMuscle.name,
        recovery_status: recoveryStatus,
        hours_since_last_trained: hoursSinceTraining,
        recovery_hours_required: requestedMuscle.recovery_hours_required,
        weekly_sets_completed: requestedMuscle.weekly_sets_completed,
        weekly_sets_target: requestedMuscle.weekly_sets_target,
        goal_type: goal?.type || null,
        goal_deadline: goal?.deadline || null,
      },
      allMusclesContext
    );

    if (evaluation.decision === 'DISCOURAGED' && !evaluation.can_override && force_override) {
      return c.json({
        success: false,
        error: "Cannot override this restriction - muscle needs recovery to prevent injury",
      }, 400);
    }

    // If discouraged and user isn't overriding, return the recommendation without generating workout
    if (evaluation.decision === 'DISCOURAGED' && !force_override) {
      const response: ApiResponse<MuscleSelectionResult> = {
        success: true,
        data: evaluation,
      };
      return c.json(response);
    }

    if (force_override) {
      // Log override warning
      console.warn(`[override] Muscle request override used for ${muscle_name}`);
    }

    // Get available exercises
    const exercises = await c.env.DB.prepare(
      "SELECT * FROM exercises"
    ).all<ExerciseRow>();

    const availableExercises = exercises.results.map((ex: ExerciseRow) => ({
      id: ex.id,
      name: ex.name,
      primary_muscles: JSON.parse(ex.primary_muscles) as string[],
      secondary_muscles: JSON.parse(ex.secondary_muscles) as string[],
      equipment_required: ex.equipment_required as EquipmentType,
      exercise_type: ex.exercise_type,
      default_rest_seconds: ex.default_rest_seconds,
    }));

    // Filter exercises for the selected muscle
    const muscleExercises = availableExercises.filter(ex =>
      ex.primary_muscles.includes(muscle_name)
    );

    if (muscleExercises.length === 0) {
      return c.json({
        success: false,
        error: `No exercises available for ${muscle_name}`,
      }, 400);
    }

    // Parse user preferences
    const userEquipment = JSON.parse(userRow.equipment_available) as EquipmentType[];
    const dropSetsEnabled = Boolean(userRow.drop_sets_enabled);
    const supersetsEnabled = Boolean(userRow.supersets_enabled);

    // Filter by equipment
    const equipmentFiltered = muscleExercises.filter(ex =>
      userEquipment.includes(ex.equipment_required)
    );

    // Calculate volume reduction
    let volumeReduction = 0;
    if (evaluation.decision === 'APPROVED_REDUCED' && evaluation.volume_reduction_percentage) {
      volumeReduction = evaluation.volume_reduction_percentage;
    }

    // Build a focused muscle list (primary muscle + synergistic muscles if needed)
    const musclesWithRecovery = allMusclesContext
      .filter(m => m.name === muscle_name || m.recovery_status === 'READY')
      .map(m => {
        const muscleData = (muscles.results as unknown as DbMuscle[]).find((md) => md.name === m.name);
        if (!muscleData) {
          throw new Error(`Muscle data not found for ${m.name}`);
        }
        return {
          id: muscleData.id,
          name: m.name,
          recovery_status: m.recovery_status,
          weekly_sets_completed: muscleData.weekly_sets_completed,
          weekly_sets_target: muscleData.weekly_sets_target,
          volume_deficit: m.volume_deficit,
        };
      });

    // Determine if deload week
    const isDeloadWeek = state.current_phase === 'DELOAD';

    // Generate workout using the standard engine
    // But force it to focus on the selected muscle by filtering muscles
    const targetMuscleContext = musclesWithRecovery.filter(m => m.name === muscle_name);
    
    const generatedWorkout = WorkoutGenerator.generate({
      user_equipment: userEquipment,
      training_phase: state.current_phase,
      goal_type: goal?.type || null,
      goal_deadline: goal?.deadline || null,
      muscles_with_recovery: targetMuscleContext,
      available_exercises: equipmentFiltered,
      is_deload_week: isDeloadWeek || volumeReduction > 0,
      drop_sets_enabled: dropSetsEnabled,
      supersets_enabled: supersetsEnabled,
      preferred_pair: undefined,
      skip_count_current_week: state.skip_count_current_week,
      prior_intensity: {
        drop_muscles: [],
        superset_muscles: [],
      },
    });

    if (generatedWorkout.exercises.length === 0) {
      return c.json({
        success: false,
        error: "Could not generate workout with available exercises and equipment",
      }, 400);
    }

    // Store the workout plan
    const today = new Date().toISOString().split('T')[0];
    const existingPlan = await c.env.DB.prepare(
      "SELECT id FROM workout_plans WHERE user_id = ? AND scheduled_date = ?"
    ).bind(userRow.id, today).first<{ id: number }>();

    let planId: number;

    if (existingPlan) {
      // Update existing plan
      await c.env.DB.prepare(
        `UPDATE workout_plans 
         SET exercises = ?,
             estimated_duration_minutes = ?,
             focus_label = ?,
             status = 'PENDING',
             generated_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(
        JSON.stringify(generatedWorkout.exercises),
        generatedWorkout.estimated_duration_minutes,
        generatedWorkout.focus_label,
        existingPlan.id
      ).run();

      planId = existingPlan.id;
    } else {
      // Create new plan
      const result = await c.env.DB.prepare(
        `INSERT INTO workout_plans (
          user_id, 
          goal_id, 
          scheduled_date, 
          status, 
          estimated_duration_minutes, 
          exercises,
          focus_label
        ) VALUES (?, ?, ?, 'PENDING', ?, ?, ?)`
      ).bind(
        userRow.id,
        goal?.id || null,
        today,
        generatedWorkout.estimated_duration_minutes,
        JSON.stringify(generatedWorkout.exercises),
        generatedWorkout.focus_label
      ).run();

      planId = result.meta.last_row_id;
    }

    // Fetch the created/updated plan
    const plan = await c.env.DB.prepare(
      "SELECT * FROM workout_plans WHERE id = ?"
    ).bind(planId).first<WorkoutPlanRowFull>();

    const workoutPlan: WorkoutPlan = {
      ...plan!,
      exercises: JSON.parse(plan!.exercises),
      targetMuscles: generatedWorkout.target_muscles,
    };

    // Return evaluation result with generated workout
    const response: ApiResponse<MuscleSelectionResult> = {
      success: true,
      data: {
        ...evaluation,
        workout_plan: workoutPlan,
      },
    };

    return c.json(response);
  } catch (error) {
    console.error("Muscle request error:", error);
    return c.json({ success: false, error: "Failed to process muscle request" }, 500);
  }
});

export default app;
