require("dotenv").config();
require("express-async-errors"); // so a failing async route returns 500 instead of hanging
const express = require("express");
const cors = require("cors");

const initDb = require("./utils/initDb");
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

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "dev-only-secret-change-me";
  console.warn("WARNING: JWT_SECRET not set in .env - using an insecure dev default.");
}
if (!process.env.ADMIN_SIGNUP_CODE) process.env.ADMIN_SIGNUP_CODE = "change_this_secret_code";

app.get("/api/health", async (req, res) => {
  try {
    await require("./config/db").query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (e) {
    res.status(503).json({ status: "error", db: "unreachable", detail: e.message });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/stations", stationRoutes);
app.use("/api/trains", trainRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/passengers", passengerRoutes);
app.use("/api/users", userRoutes);

app.use((req, res) => res.status(404).json({ error: "Route not found." }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const PORT = process.env.PORT || 5000;
initDb()
  .catch((err) => {
    console.error("\n!! Could not set up the MySQL database: " + err.message);
    console.error("!! Check that MySQL is running and DB_USER / DB_PASSWORD in backend/.env are correct.\n");
  })
  .finally(() => {
    app.listen(PORT, () => console.log(`Railway Reservation API running on http://localhost:${PORT}`));
  });
