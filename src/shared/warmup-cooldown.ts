export type PrepItem = {
  title: string;
  duration?: string;
  reps?: string;
  steps: string[];
};

export type PrepPlan = {
  warmup: PrepItem[];
  cooldown: PrepItem[];
};

const library: Record<string, PrepPlan> = {
  Chest: {
    warmup: [
      { title: "Scapular Push-Ups", reps: "2×12", steps: ["Hands under shoulders", "Protract and retract without elbow bend"] },
      { title: "Band External Rotations", reps: "2×12/side", steps: ["Elbow at side", "Rotate forearm outward with control"] },
      { title: "Empty Bar Bench Press", reps: "2×8", steps: ["Controlled tempo", "Focus on bar path and scapular set"] },
    ],
    cooldown: [
      { title: "Doorway Pec Stretch", duration: "2×30s", steps: ["Elbow at 90° on frame", "Step forward until chest opens"] },
      { title: "Thoracic Extension Roller", duration: "2×30s", steps: ["Mid-back over roller", "Extend gently and breathe"] },
    ],
  },
  Back: {
    warmup: [
      { title: "Cat–Cow", reps: "2×10", steps: ["Alternate flexion and extension", "Smooth breathing"] },
      { title: "Dead Hang", duration: "30–45s", steps: ["Relax shoulders", "Gentle traction"] },
      { title: "Band Rows", reps: "2×15", steps: ["Squeeze shoulder blades", "Neutral spine"] },
    ],
    cooldown: [
      { title: "Child’s Pose", duration: "2×30s", steps: ["Hips back", "Arms long"] },
      { title: "Lat Wall Stretch", duration: "2×30s/side", steps: ["Palm on wall", "Lean hips away"] },
    ],
  },
  Shoulders: {
    warmup: [
      { title: "Arm Circles", reps: "2×10 each", steps: ["Small to large circles", "Both directions"] },
      { title: "Band Face Pulls", reps: "2×12", steps: ["Elbows high", "External rotation at end"] },
      { title: "YTWL", reps: "1×8 each", steps: ["Light load", "Slow controlled reps"] },
    ],
    cooldown: [
      { title: "Cross-Body Shoulder Stretch", duration: "2×30s/side", steps: ["Arm across chest", "Gentle pull at elbow"] },
      { title: "Doorway Front Delt Stretch", duration: "2×30s", steps: ["Arm straight on frame", "Step forward lightly"] },
    ],
  },
  Biceps: {
    warmup: [
      { title: "Light Dumbbell Curls", reps: "2×12", steps: ["Full range", "No swing"] },
      { title: "Wrist Flex–Extend", reps: "2×12 each", steps: ["Slow control", "Neutral shoulder"] },
    ],
    cooldown: [
      { title: "Standing Biceps Stretch", duration: "2×30s", steps: ["Hands behind on surface", "Elbows straight, chest open"] },
      { title: "Forearm Flexor Stretch", duration: "2×30s/side", steps: ["Palm up, fingers back", "Gentle pressure"] },
    ],
  },
  Triceps: {
    warmup: [
      { title: "Band Pressdowns", reps: "2×15", steps: ["Elbows pinned", "Full lockout"] },
      { title: "Shoulder Circles", reps: "2×10", steps: ["Relaxed motion", "No shrugging"] },
    ],
    cooldown: [
      { title: "Overhead Triceps Stretch", duration: "2×30s/side", steps: ["Elbow up", "Gentle pull behind head"] },
    ],
  },
  Quads: {
    warmup: [
      { title: "Leg Swings", reps: "2×12 each", steps: ["Front–back", "Controlled arc"] },
      { title: "Bodyweight Squats", reps: "2×10", steps: ["Depth and tempo", "Knees track over toes"] },
      { title: "Glute Bridges", reps: "2×12", steps: ["Squeeze at top", "Neutral spine"] },
    ],
    cooldown: [
      { title: "Standing Quad Stretch", duration: "2×30s/side", steps: ["Heel to glute", "Knees together"] },
      { title: "Couch Stretch", duration: "2×30s/side", steps: ["Shin on pad near wall", "Upright torso"] },
    ],
  },
  Hamstrings: {
    warmup: [
      { title: "Dynamic Toe Touches", reps: "2×10", steps: ["Alternating legs", "Flat back"] },
      { title: "Hip Hinge Patterning", reps: "2×10", steps: ["Soft knees", "Push hips back"] },
      { title: "Leg Swings (front–back)", reps: "2×12 each", steps: ["Controlled motion", "No lumbar arch"] },
    ],
    cooldown: [
      { title: "Seated Hamstring Stretch", duration: "2×30s/side", steps: ["Hinge at hips", "Long spine"] },
      { title: "Supine Strap Stretch", duration: "2×30s/side", steps: ["Knee soft", "Ankle neutral"] },
    ],
  },
  Glutes: {
    warmup: [
      { title: "Glute Bridges", reps: "2×12", steps: ["Heels near glutes", "Squeeze at top"] },
      { title: "Clamshells", reps: "2×12/side", steps: ["Hips stacked", "No back rotation"] },
    ],
    cooldown: [
      { title: "Figure-Four Stretch", duration: "2×30s/side", steps: ["Ankle over knee", "Pull leg gently"] },
    ],
  },
  Abs: {
    warmup: [
      { title: "Dead Bug", reps: "2×8/side", steps: ["Ribs down", "Slow opposite arm–leg"] },
      { title: "Bird Dog", reps: "2×8/side", steps: ["Hips level", "Reach long"] },
    ],
    cooldown: [
      { title: "Cobra Pose", duration: "2×30s", steps: ["Elbows under shoulders", "Chest open"] },
      { title: "Child’s Pose", duration: "2×30s", steps: ["Hips back", "Relax belly"] },
    ],
  },
  Calves: {
    warmup: [
      { title: "Ankle Circles", reps: "2×10 each", steps: ["Slow range", "Both directions"] },
      { title: "Bodyweight Calf Raises", reps: "2×15", steps: ["Pause at top", "Full stretch at bottom"] },
    ],
    cooldown: [
      { title: "Standing Calf Stretch", duration: "2×30s/side", steps: ["Foot back", "Heel down"] },
      { title: "Wall Gastrocnemius Stretch", duration: "2×30s/side", steps: ["Knee straight", "Lean forward"] },
    ],
  },
};

function normalizeTarget(name: string): string | null {
  const n = name.trim().toLowerCase();
  if (["chest", "pecs", "pectorals", "pec"].includes(n)) return "Chest";
  if (["back", "lats", "lat"].includes(n)) return "Back";
  if (["shoulders", "delts", "deltoids", "shoulder"].includes(n)) return "Shoulders";
  if (["biceps", "bi", "bicep"].includes(n)) return "Biceps";
  if (["triceps", "tri", "tricep"].includes(n)) return "Triceps";
  if (["quads", "quadriceps", "quad"].includes(n)) return "Quads";
  if (["hamstrings", "hams", "hamstring"].includes(n)) return "Hamstrings";
  if (["glutes", "glute", "gluteals"].includes(n)) return "Glutes";
  if (["abs", "core", "abdominals"].includes(n)) return "Abs";
  if (["calves", "calf"].includes(n)) return "Calves";
  return null;
}

export function getWarmupCooldownForTargets(targets: string[]): PrepPlan {
  const warmup: PrepItem[] = [];
  const cooldown: PrepItem[] = [];
  const seen = new Set<string>();
  for (const t of targets) {
    const key = normalizeTarget(t);
    if (!key) continue;
    const plan = library[key];
    if (!plan) continue;
    for (const item of plan.warmup) {
      const sig = `w:${key}:${item.title}`;
      if (!seen.has(sig)) {
        warmup.push(item);
        seen.add(sig);
      }
    }
    for (const item of plan.cooldown) {
      const sig = `c:${key}:${item.title}`;
      if (!seen.has(sig)) {
        cooldown.push(item);
        seen.add(sig);
      }
    }
  }
  if (warmup.length === 0 && cooldown.length === 0) {
    return {
      warmup: [
        { title: "General Warm-Up", duration: "3–5min", steps: ["Light cardio", "Joint mobility through session ranges"] },
      ],
      cooldown: [
        { title: "General Cool-Down", duration: "3–5min", steps: ["Breathing down", "Light stretching of trained areas"] },
      ],
    };
  }
  return { warmup, cooldown };
}
