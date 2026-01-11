import { useNavigate } from 'react-router';
import { Dumbbell, Target, TrendingUp, Shield } from 'lucide-react';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="app-bg">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0" />
        
        <div className="relative max-w-7xl mx-auto px-4 py-20 sm:py-32">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 mb-8 brand-chip">
              <Dumbbell className="w-10 h-10 text-white" />
            </div>
            
            <h1 className="text-5xl sm:text-7xl font-bold text-white mb-6 tracking-tight">
              IronMind
            </h1>
            
            <p className="text-xl sm:text-2xl text-white/80 mb-4 max-w-3xl mx-auto">
              Your deterministic personal training system
            </p>
            
            <p className="text-lg text-white/60 mb-12 max-w-2xl mx-auto">
              Stop guessing. Start progressing. Let the system decide your workouts based on science, recovery, and your goals.
            </p>
            
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => navigate('/setup')}
                className="inline-flex items-center px-8 py-4 btn-primary text-lg font-semibold"
              >
                Get Started
              </button>
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center px-8 py-4 btn-secondary"
              >
                Login
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="card-glass rounded-2xl p-8 transition-shadow">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mb-6">
              <Target className="w-7 h-7 text-indigo-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Goal-Driven Training</h3>
            <p className="text-white/70">
              Set your goal and deadline. The system calculates the required progression and adapts your training to meet it.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="card-glass rounded-2xl p-8 transition-shadow">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mb-6">
              <TrendingUp className="w-7 h-7 text-purple-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Adaptive Programming</h3>
            <p className="text-white/70">
              Daily decisions based on recovery, volume, and goals ensure optimal progress without burnout.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="card-glass rounded-2xl p-8 transition-shadow">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mb-6">
              <Shield className="w-7 h-7 text-indigo-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Recovery-Aware</h3>
            <p className="text-white/70">
              The system protects you from overtraining by managing rest and volume intelligently.
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start gap-4 card-glass rounded-xl p-6">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
              1
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Set Your Goal</h3>
              <p className="text-white/70">Define what you want to achieve and when. Weight loss, muscle gain, strength, or endurance.</p>
            </div>
          </div>

          <div className="flex items-start gap-4 card-glass rounded-xl p-6">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
              2
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Daily Workout Generation</h3>
              <p className="text-white/70">Each day, the system generates your workout based on recovery status, weekly volume targets, and goal progression.</p>
            </div>
          </div>

          <div className="flex items-start gap-4 card-glass rounded-xl p-6">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
              3
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Execute Set-by-Set</h3>
              <p className="text-white/70">Follow the workout with built-in rest timers. Log your performance for automatic progression tracking.</p>
            </div>
          </div>

          <div className="flex items-start gap-4 card-glass rounded-xl p-6">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
              4
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Automatic Adaptation</h3>
              <p className="text-white/70">The system adjusts volume, intensity, and exercise selection based on your performance and recovery.</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="card-glass rounded-3xl p-12">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to start training smarter?</h2>
          <p className="text-white/80 mb-8 text-lg">No more guesswork. No more decision fatigue. Just consistent progress.</p>
          <button
            onClick={() => navigate('/setup')}
            className="inline-flex items-center px-8 py-4 btn-primary text-lg font-semibold"
          >
            Begin Your Journey
          </button>
          <div className="mt-4">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center px-8 py-3 btn-secondary"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
