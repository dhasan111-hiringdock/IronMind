import { BrowserRouter as Router, Routes, Route } from "react-router";
import HomePage from "@/react-app/pages/Home";
import SetupPage from "@/react-app/pages/Setup";
import DashboardPage from "@/react-app/pages/Dashboard";
import TodayWorkoutPage from "@/react-app/pages/TodayWorkout";
import MuscleSelectorPage from "@/react-app/pages/MuscleSelector";
import LoginPage from "@/react-app/pages/Login";
import DayPlanPage from "@/react-app/pages/DayPlan";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/today" element={<TodayWorkoutPage />} />
        <Route path="/select-muscle" element={<MuscleSelectorPage />} />
        <Route path="/plan/:date" element={<DayPlanPage />} />
      </Routes>
    </Router>
  );
}
