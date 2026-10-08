require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const stationRoutes = require("./routes/stations");
const trainRoutes = require("./routes/trains");
const routeRoutes = require("./routes/routes");
const bookingRoutes = require("./routes/bookings");
const passengerRoutes = require("./routes/passengers");
const userRoutes = require("./routes/users");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "railway-reservation-backend",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/stations", stationRoutes);
app.use("/api/trains", trainRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/passengers", passengerRoutes);
app.use("/api/users", userRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Railway Reservation API running on http://localhost:${PORT}`);
});