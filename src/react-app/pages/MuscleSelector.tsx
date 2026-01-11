import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Dumbbell, CheckCircle, AlertCircle, XCircle, ArrowRight } from 'lucide-react';
import type { MuscleRecoveryStatus, MuscleSelectionResult, RecoveryStatus } from '@/shared/types';

/**
 * Muscle Selector Page - Feature 2: 3D Body Muscle Selector
 * 
 * FEATURE OVERVIEW:
 * Allows user to select a muscle group and request a workout for that muscle.
 * The system validates the request and makes the final decision.
 * 
 * DECISION OUTCOMES:
 * - APPROVED_FULL: Generate full intensity workout
 * - APPROVED_REDUCED: Generate reduced intensity workout
 * - DISCOURAGED: Recommend alternative muscle or rest
 * 
 * USER FLOW:
 * 1. View muscle groups with recovery status
 * 2. Select a muscle to train
 * 3. System evaluates request (recovery, volume, goals)
 * 4. System responds with decision + reasoning
 * 5. If approved, workout is generated
 * 6. If discouraged, alternative is suggested
 * 
 * NOTE: This is a 2D grid placeholder for a future 3D body model.
 * The logic and API are designed to support 3D interaction.
 */
export default function MuscleSelectorPage() {
  const navigate = useNavigate();
  const [muscles, setMuscles] = useState<MuscleRecoveryStatus[]>([]);
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<MuscleSelectionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadMuscles();
  }, []);

  const loadMuscles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/recovery/status');
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMuscles(data.data);
        }
      }
    } catch (err) {
      console.error('Failed to load muscles:', err);
    } finally {
      setLoading(false);
    }
  };

  const requestMuscleWorkout = async (muscleName: string, forceOverride = false) => {
    try {
      setProcessing(true);
      setSelectedMuscle(muscleName);
      setEvaluationResult(null);

      const response = await fetch('/api/muscle/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          muscle_name: muscleName,
          force_override: forceOverride,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(data.error || 'Failed to process muscle request');
        setSelectedMuscle(null);
        return;
      }

      setEvaluationResult(data.data);
    } catch (err) {
      console.error('Muscle request error:', err);
      alert('Network error while processing request');
      setSelectedMuscle(null);
    } finally {
      setProcessing(false);
    }
  };

  const handleOverride = async () => {
    if (!selectedMuscle) return;
    await requestMuscleWorkout(selectedMuscle, true);
  };

  const handleAlternative = async () => {
    if (!evaluationResult?.alternative_muscle) return;
    await requestMuscleWorkout(evaluationResult.alternative_muscle, false);
  };

  const getMuscleStatusConfig = (status: RecoveryStatus) => {
    switch (status) {
      case 'READY':
        return {
          icon: CheckCircle,
          color: 'text-cyan-500',
          bgColor: 'bg-cyan-500/20',
          borderColor: 'border-cyan-500/50',
          label: 'Ready',
        };
      case 'PARTIAL':
        return {
          icon: AlertCircle,
          color: 'text-orange-400',
          bgColor: 'bg-orange-400/20',
          borderColor: 'border-orange-400/50',
          label: 'Partial',
        };
      case 'BLOCKED':
        return {
          icon: XCircle,
          color: 'text-fuchsia-500',
          bgColor: 'bg-fuchsia-500/20',
          borderColor: 'border-fuchsia-500/50',
          label: 'Blocked',
        };
    }
  };

  const getDecisionConfig = (decision: string) => {
    switch (decision) {
      case 'APPROVED_FULL':
        return {
          color: 'text-indigo-500',
          bgColor: 'bg-indigo-500/20',
          borderColor: 'border-indigo-500/50',
          icon: CheckCircle,
          title: 'Workout Approved',
        };
      case 'APPROVED_REDUCED':
        return {
          color: 'text-cyan-500',
          bgColor: 'bg-cyan-500/20',
          borderColor: 'border-cyan-500/50',
          icon: AlertCircle,
          title: 'Reduced Workout Approved',
        };
      case 'DISCOURAGED':
        return {
          color: 'text-fuchsia-500',
          bgColor: 'bg-fuchsia-500/20',
          borderColor: 'border-fuchsia-500/50',
          icon: XCircle,
          title: 'Training Not Recommended',
        };
      default:
        return {
          color: 'text-slate-400',
          bgColor: 'bg-slate-500/20',
          borderColor: 'border-slate-500/50',
          icon: AlertCircle,
          title: 'Unknown',
        };
    }
  };

  // Group muscles by category for better organization
  const muscleGroups = {
    'Upper Push': muscles.filter(m => ['Chest', 'Shoulders', 'Triceps'].includes(m.muscle_name)),
    'Upper Pull': muscles.filter(m => ['Back', 'Biceps'].includes(m.muscle_name)),
    'Legs': muscles.filter(m => ['Quads', 'Hamstrings', 'Glutes', 'Calves'].includes(m.muscle_name)),
    'Core': muscles.filter(m => ['Abs'].includes(m.muscle_name)),
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading muscles...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-950">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-white/70 hover:text-white mb-4 transition-colors"
          >
            ← Back to Dashboard
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-fuchsia-500/50">
              <Dumbbell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Muscle Selector</h1>
              <p className="text-white/60 text-sm">Request a workout for a specific muscle group</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Muscle Selection Grid */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 shadow-xl">
              <h2 className="text-xl font-semibold text-white mb-4">Select Muscle Group</h2>
              <p className="text-white/70 text-sm mb-6">
                Click a muscle to request training. The system will evaluate recovery status and volume limits.
              </p>

              {/* Muscle Groups */}
              <div className="space-y-6">
                {Object.entries(muscleGroups).map(([groupName, groupMuscles]) => (
                  <div key={groupName}>
                    <h3 className="text-white/70 font-medium mb-3">{groupName}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {groupMuscles.map((muscle) => {
                        const config = getMuscleStatusConfig(muscle.status);
                        const Icon = config.icon;
                        const isSelected = selectedMuscle === muscle.muscle_name;

                        return (
                          <button
                            key={muscle.muscle_name}
                            onClick={() => requestMuscleWorkout(muscle.muscle_name)}
                            disabled={processing}
                            className={`${config.bgColor} ${config.borderColor} border-2 rounded-lg p-4 hover:bg-white/20 transition-all disabled:opacity-50 ${
                              isSelected ? 'ring-2 ring-fuchsia-500' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className={`w-4 h-4 ${config.color}`} />
                              <span className="text-white font-medium text-sm">{muscle.muscle_name}</span>
                            </div>
                            <div className="text-left">
                              <p className={`text-xs ${config.color} font-medium`}>{config.label}</p>
                              {muscle.hours_until_ready > 0 && (
                                <p className="text-xs text-white/70 mt-1">
                                  {muscle.hours_until_ready.toFixed(1)}h until ready
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Note: 3D Body Placeholder */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 shadow-xl">
              <div className="text-center py-8">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
                  <Dumbbell className="w-12 h-12 text-white/60" />
                </div>
                <p className="text-white/70 text-sm">3D Body Model</p>
                <p className="text-white/60 text-xs mt-1">Coming soon - interactive 3D muscle selection</p>
              </div>
            </div>
          </div>

          {/* Evaluation Result Panel */}
          <div className="space-y-6">
            {evaluationResult ? (
              <>
                {/* Decision Card */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 shadow-xl">
                  {(() => {
                    const config = getDecisionConfig(evaluationResult.decision);
                    const Icon = config.icon;
                    
                    return (
                      <>
                        <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 mb-4`}>
                          <div className="flex items-center gap-3 mb-2">
                            <Icon className={`w-6 h-6 ${config.color}`} />
                            <h3 className={`font-semibold ${config.color}`}>{config.title}</h3>
                          </div>
                          <p className="text-white text-sm">{selectedMuscle}</p>
                        </div>

                        {/* Reasoning */}
                        <div className="space-y-4">
                          <div>
                            <p className="text-white/70 text-sm mb-1">Reason:</p>
                            <p className="text-white text-sm">{evaluationResult.reason}</p>
                          </div>

                          <div>
                            <p className="text-white/70 text-sm mb-1">Recommendation:</p>
                            <p className="text-white text-sm">{evaluationResult.recommended_action}</p>
                          </div>

                          {evaluationResult.volume_reduction_percentage && (
                            <div>
                              <p className="text-white/70 text-sm mb-1">Volume Adjustment:</p>
                              <p className="text-orange-400 text-sm font-medium">
                                {evaluationResult.volume_reduction_percentage}% reduction
                              </p>
                            </div>
                          )}

                          {evaluationResult.warning_message && (
                            <div className="bg-orange-400/20 border border-orange-400/50 rounded-lg p-3">
                              <p className="text-orange-300 text-xs">{evaluationResult.warning_message}</p>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="mt-6 space-y-3">
                          {evaluationResult.workout_plan && (
                            <button
                              onClick={() => navigate('/today')}
                              className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white py-3 rounded-lg font-semibold shadow-lg shadow-indigo-500/50 hover:shadow-indigo-500/70 transition-all flex items-center justify-center gap-2"
                            >
                              View Generated Workout
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          )}

                          {evaluationResult.decision === 'DISCOURAGED' && evaluationResult.alternative_muscle && (
                            <button
                              onClick={handleAlternative}
                              disabled={processing}
                              className="w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
                            >
                              {processing ? 'Processing...' : `Try ${evaluationResult.alternative_muscle} Instead`}
                            </button>
                          )}

                          {evaluationResult.decision === 'DISCOURAGED' && evaluationResult.can_override && (
                            <button
                              onClick={handleOverride}
                              disabled={processing}
                              className="w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
                            >
                              {processing ? 'Processing...' : 'Override and Train Anyway'}
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedMuscle(null);
                              setEvaluationResult(null);
                            }}
                            className="w-full bg-white/10 hover:bg-white/20 text-white/80 py-3 rounded-lg font-medium transition-colors"
                          >
                            Select Different Muscle
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </>
            ) : (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 shadow-xl">
                <div className="text-center py-12">
                  <p className="text-white/70">Select a muscle to see evaluation</p>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6 shadow-xl">
              <h3 className="text-white font-semibold mb-4">Recovery Status</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-cyan-500" />
                  <div>
                    <p className="text-white text-sm font-medium">Ready</p>
                    <p className="text-white/70 text-xs">Fully recovered, optimal for training</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 text-orange-400" />
                  <div>
                    <p className="text-white text-sm font-medium">Partial</p>
                    <p className="text-white/70 text-xs">36+ hours recovered, reduced volume</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <XCircle className="w-4 h-4 text-fuchsia-500" />
                  <div>
                    <p className="text-white text-sm font-medium">Blocked</p>
                    <p className="text-white/70 text-xs">Still recovering, rest recommended</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
