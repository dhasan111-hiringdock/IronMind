import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import type { TrainingAge, EquipmentType } from '@/shared/types';

export default function SetupPage() {
  const navigate = useNavigate();
  const [trainingAge, setTrainingAge] = useState<TrainingAge>('BEGINNER');
  const [trainingDays, setTrainingDays] = useState(4);
  const [equipment, setEquipment] = useState<EquipmentType[]>(['BODYWEIGHT']);

  const equipmentOptions: EquipmentType[] = ['BARBELL', 'DUMBBELLS', 'CABLE', 'MACHINE', 'BODYWEIGHT'];

  const toggleEquipment = (item: EquipmentType) => {
    if (equipment.includes(item)) {
      setEquipment(equipment.filter(e => e !== item));
    } else {
      setEquipment([...equipment, item]);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (!(res.ok && data.success)) {
          navigate('/login');
        }
      } catch {
        navigate('/login');
      }
    };
    checkAuth();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const setupRes = await fetch('/api/user/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          training_age: trainingAge,
          training_days_per_week: trainingDays,
          equipment_available: equipment,
        }),
      });

      if (setupRes.ok) {
        navigate('/dashboard');
        return;
      }

      if (setupRes.status === 401) {
        navigate('/login');
        return;
      }
      
      const errData = await setupRes.json().catch(() => ({ error: 'Setup failed' }));
      throw new Error(errData.error || 'Setup failed');
      
    } catch (error) {
      console.error('Setup error:', error);
    }
  };

  return (
    <div className="app-bg flex items-center justify-center p-4">
      <div className="max-w-2xl w-full card-glass rounded-2xl p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Welcome to IronMind</h1>
          <p className="text-white/70">Let's set up your training parameters</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Training Age */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-3">
              Training Experience
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as TrainingAge[]).map((age) => (
                <button
                  key={age}
                  type="button"
                  onClick={() => setTrainingAge(age)}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    trainingAge === age
                      ? 'btn-primary'
                      : 'btn-secondary'
                  }`}
                >
                  {age.charAt(0) + age.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Training Days */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-3">
              Training Days Per Week: {trainingDays}
            </label>
            <input
              type="range"
              min="3"
              max="6"
              value={trainingDays}
              onChange={(e) => setTrainingDays(parseInt(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-white/60 mt-1">
              <span>3 days</span>
              <span>6 days</span>
            </div>
          </div>

          {/* Equipment */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-3">
              Available Equipment
            </label>
            <div className="grid grid-cols-2 gap-3">
              {equipmentOptions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleEquipment(item)}
                  className={`px-4 py-3 rounded-lg font-medium transition-all ${
                    equipment.includes(item)
                      ? 'btn-primary'
                      : 'btn-secondary'
                  }`}
                >
                  {item.charAt(0) + item.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={equipment.length === 0}
            className="w-full btn-primary text-white py-4 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Begin Training
          </button>
        </form>
      </div>
    </div>
  );
}
