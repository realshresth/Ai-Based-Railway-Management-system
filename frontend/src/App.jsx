import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import SupportChat from "./components/SupportChat";
import { RequireUser, RequireAdmin, RequireAuth } from "./components/RouteGuards";

import Home from "./pages/Home";
import Schedule from "./pages/Schedule";
import Booking from "./pages/Booking";
import PlanTravel from "./pages/PlanTravel";
import PNRStatus from "./pages/PNRStatus";
import MyBookings from "./pages/MyBookings";
import Passengers from "./pages/Passengers";
import VacantSeats from "./pages/VacantSeats";
import WhereIsMyTrain from "./pages/WhereIsMyTrain";
import ClientAuth from "./pages/Login";
import AdminAuth from "./pages/AdminLogin";
import ForgotPassword from "./pages/ForgotPassword";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";

export default function App() {
  return (
    <>
      <Navbar />
      <main style={{ minHeight: "60vh" }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/vacant-seats" element={<VacantSeats />} />
          <Route path="/train-status" element={<WhereIsMyTrain />} />
          <Route path="/where-is-my-train" element={<WhereIsMyTrain />} />
          <Route path="/plan-travel" element={<PlanTravel />} />
          <Route path="/pnr-status" element={<PNRStatus />} />
          <Route path="/login" element={<ClientAuth />} />
          <Route path="/register" element={<ClientAuth />} />
          <Route path="/admin-login" element={<AdminAuth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route path="/my-bookings" element={<RequireUser><MyBookings /></RequireUser>} />
          <Route path="/passengers" element={<RequireUser><Passengers /></RequireUser>} />

          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />

          <Route path="*" element={<div className="container" style={{ padding: 60, textAlign: "center" }}><h2>404 — Page not found</h2></div>} />
        </Routes>
      </main>
      <Footer />
      <SupportChat />
    </>
  );
}
