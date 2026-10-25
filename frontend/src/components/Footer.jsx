export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <h4>RailReserve</h4>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, maxWidth: 280 }}>
              Book your journey. Travel with confidence. A full-stack railway
              reservation platform for searching trains, booking tickets and
              managing your trips end to end.
            </p>
          </div>
          <div>
            <h4>Explore</h4>
            <a href="/schedule">Train Schedule</a>
            <a href="/vacant-seats">Vacant Seats</a>
            <a href="/train-status">Train Status</a>
            <a href="/booking">Book Tickets</a>
            <a href="/plan-travel">Plan Travel</a>
            <a href="/pnr-status">PNR Status</a>
            <a href="/my-bookings">My Bookings</a>
          </div>
          <div>
            <h4>Account</h4>
            <a href="/login">Client Sign In / Sign Up</a>
            <a href="/admin-login">Admin Sign In / Sign Up</a>
            <a href="/forgot-password">Forgot Password</a>
          </div>
          <div>
            <h4>Support</h4>
            <a href="#">Help Center</a>
            <a href="#">Contact Us</a>
            <a href="#">Terms of Service</a>
            <a href="#">Privacy Policy</a>
          </div>
        </div>
        <div className="footer-bottom">
          © 2026 @RailReserve Thank You for Visiting Our Website.
        </div>
      </div>
    </footer>
  );
}
