/**
 * Where "Book a call" / "Get a quote" buttons go (Done For You is quote-only).
 * Set BOOKING_URL to your Calendly, Cal.com or contact page.
 */
export function bookingUrl(): string {
  return process.env.BOOKING_URL || "mailto:hello@aeogrowthlead.com?subject=Done-for-you%20AEO%20quote";
}
