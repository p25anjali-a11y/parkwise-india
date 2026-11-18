export interface ApiError { status: number; message: string }

/** Maps Postgres errors from the reservation functions to driver-facing responses. */
export function mapReservationError(e: { code?: string; message?: string }): ApiError {
  switch (e.code) {
    case "23514": return { status: 409, message: "Sorry, no reservable bays are left for that zone." };
    case "23505": return { status: 409, message: "You already have a reservation for this price." };
    case "42501": return { status: 403, message: "That price quote is not yours." };
    case "P0002": return { status: 404, message: "Price quote not found." };
    case "P0001": return { status: 409, message: e.message ?? "This price is no longer valid. Please get a new one." };
    default: return { status: 500, message: "Could not reserve right now." };
  }
}
