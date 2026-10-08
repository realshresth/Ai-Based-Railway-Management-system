-- ============================================================
-- Railway Reservation Management System — Database Schema
-- MySQL 8+ recommended
-- ============================================================

CREATE DATABASE IF NOT EXISTS railway_reservation;
USE railway_reservation;

-- ---------- Stations ----------
CREATE TABLE stations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100)
);

-- ---------- Trains ----------
CREATE TABLE trains (
  id INT AUTO_INCREMENT PRIMARY KEY,
  train_number VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  source_station_id INT NOT NULL,
  destination_station_id INT NOT NULL,
  departure_time TIME NOT NULL,
  arrival_time TIME NOT NULL,
  duration VARCHAR(20) NOT NULL,
  days_of_operation VARCHAR(60) DEFAULT 'Daily',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_station_id) REFERENCES stations(id),
  FOREIGN KEY (destination_station_id) REFERENCES stations(id)
);

-- ---------- Train routes (intermediate stops) ----------
CREATE TABLE train_routes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  train_id INT NOT NULL,
  station_id INT NOT NULL,
  stop_number INT NOT NULL,
  arrival_offset_min INT DEFAULT 0,
  departure_offset_min INT DEFAULT 0,
  FOREIGN KEY (train_id) REFERENCES trains(id) ON DELETE CASCADE,
  FOREIGN KEY (station_id) REFERENCES stations(id)
);

-- ---------- Train classes / fares ----------
CREATE TABLE train_classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  train_id INT NOT NULL,
  class_code VARCHAR(5) NOT NULL,      -- SL, 3A, 2A, 1A
  class_name VARCHAR(50) NOT NULL,
  fare DECIMAL(10,2) NOT NULL,
  total_seats INT NOT NULL,
  booked_seats INT DEFAULT 0,
  FOREIGN KEY (train_id) REFERENCES trains(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_train_class (train_id, class_code)
);

-- ---------- Users (passengers + admin) ----------
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(15),
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user','admin') DEFAULT 'user',
  reset_token VARCHAR(255) DEFAULT NULL,
  reset_token_expires DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- Saved passengers (passenger management page) ----------
CREATE TABLE passengers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  age INT NOT NULL,
  gender ENUM('M','F','O') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------- Bookings ----------
CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pnr VARCHAR(15) UNIQUE NOT NULL,
  user_id INT NOT NULL,
  train_id INT NOT NULL,
  class_code VARCHAR(5) NOT NULL,
  journey_date DATE NOT NULL,
  total_fare DECIMAL(10,2) NOT NULL,
  status ENUM('Confirmed','Waiting','Cancelled') DEFAULT 'Confirmed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (train_id) REFERENCES trains(id)
);

-- ---------- Passengers attached to a specific booking ----------
CREATE TABLE booking_passengers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  age INT NOT NULL,
  gender ENUM('M','F','O') NOT NULL,
  seat_number VARCHAR(10),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- ============================================================
-- Sample data
-- ============================================================

INSERT INTO stations (code, name, city, state) VALUES
('LKO','Lucknow Charbagh','Lucknow','Uttar Pradesh'),
('NDLS','New Delhi','New Delhi','Delhi'),
('CNB','Kanpur Central','Kanpur','Uttar Pradesh'),
('MMCT','Mumbai Central','Mumbai','Maharashtra'),
('MAS','Chennai Central','Chennai','Tamil Nadu'),
('HWH','Howrah Junction','Kolkata','West Bengal'),
('SBC','Bengaluru City','Bengaluru','Karnataka'),
('PNBE','Patna Junction','Patna','Bihar'),
('ADI','Ahmedabad Junction','Ahmedabad','Gujarat'),
('BSB','Varanasi Junction','Varanasi','Uttar Pradesh'),
('JP','Jaipur Junction','Jaipur','Rajasthan'),
('PUNE','Pune Junction','Pune','Maharashtra');

-- Admin user — password is "admin123" (bcrypt hash generated at seed time by seed.js)
-- See backend/utils/seedAdmin.js — this file only creates schema + reference data.

INSERT INTO trains (train_number, name, source_station_id, destination_station_id, departure_time, arrival_time, duration, days_of_operation) VALUES
('12430','Sarthi Rajdhani Express', 1, 2, '21:40:00', '06:10:00', '8h 30m', 'Daily'),
('12002','Shatabdi Sprint', 2, 1, '06:15:00', '12:35:00', '6h 20m', 'Mon,Wed,Fri,Sun'),
('12951','Coastal Mumbai Mail', 4, 5, '23:00:00', '20:15:00', '21h 15m', 'Daily'),
('12305','Ganga Howrah Express', 8, 6, '14:20:00', '22:05:00', '7h 45m', 'Tue,Thu,Sat'),
('12622','Southern Bengaluru Express', 5, 7, '07:00:00', '12:30:00', '5h 30m', 'Daily'),
('12916','Ashram Ahmedabad Express', 9, 2, '17:25:00', '09:40:00', '16h 15m', 'Daily'),
('13005','Varanasi Amritsar Mail', 10, 2, '19:10:00', '09:55:00', '14h 45m', 'Daily'),
('12138','Punjab Mail', 4, 2, '19:35:00', '18:35:00', '23h 00m', 'Daily');

-- Route stops (offsets in minutes from origin departure)
INSERT INTO train_routes (train_id, station_id, stop_number, arrival_offset_min, departure_offset_min) VALUES
(1,1,1,0,0),(1,3,2,60,65),(1,2,3,510,510),
(2,2,1,0,0),(2,3,2,310,315),(2,1,3,380,380),
(3,4,1,0,0),(3,7,2,660,665),(3,5,3,1275,1275),
(4,8,1,0,0),(4,6,2,465,465),
(5,5,1,0,0),(5,7,2,330,330),
(6,9,1,0,0),(6,11,2,420,425),(6,2,3,975,975),
(7,10,1,0,0),(7,1,2,210,215),(7,3,3,270,275),(7,2,4,885,885),
(8,4,1,0,0),(8,12,2,90,95),(8,2,3,1380,1380);

-- Fares / classes per train
INSERT INTO train_classes (train_id, class_code, class_name, fare, total_seats, booked_seats) VALUES
(1,'SL','Sleeper', 435, 372, 260),(1,'3A','AC 3-Tier',1088,223,156),(1,'2A','AC 2-Tier',1595,130,120),(1,'1A','AC First',2755,45,45),
(2,'SL','Sleeper', 330,288,190),(2,'3A','AC 3-Tier',825,168,155),(2,'2A','AC 2-Tier',1210,101,93),(2,'1A','AC First',2090,35,35),
(3,'SL','Sleeper', 555,420,290),(3,'3A','AC 3-Tier',1388,245,225),(3,'2A','AC 2-Tier',2035,140,129),(3,'1A','AC First',3515,50,50),
(4,'SL','Sleeper', 285,324,180),(4,'3A','AC 3-Tier',713,189,132),(4,'2A','AC 2-Tier',1045,108,99),(4,'1A','AC First',1805,38,38),
(5,'SL','Sleeper', 234,276,150),(5,'3A','AC 3-Tier',585,161,148),(5,'2A','AC 2-Tier',858,92,84),(5,'1A','AC First',1482,32,32),
(6,'SL','Sleeper', 480,360,255),(6,'3A','AC 3-Tier',1200,210,193),(6,'2A','AC 2-Tier',1760,120,110),(6,'1A','AC First',3040,42,42),
(7,'SL','Sleeper', 375,336,240),(7,'3A','AC 3-Tier',938,196,182),(7,'2A','AC 2-Tier',1375,112,103),(7,'1A','AC First',2375,39,39),
(8,'SL','Sleeper', 470,300,205),(8,'3A','AC 3-Tier',1175,175,161),(8,'2A','AC 2-Tier',1725,100,92),(8,'1A','AC First',2980,35,35);
