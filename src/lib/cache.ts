import { revalidatePath } from "next/cache";

/**
 * One place to declare what an admin write invalidates.
 *
 * Admin screens are dynamic, so `revalidatePath` is all they need. The public
 * catalogue in phase 3 will be cached and tagged, and Next 16's
 * `revalidateTag(tag, profile)` takes a cache-life profile — so that wiring
 * belongs here too rather than scattered across every server action.
 */

export function revalidateProducts(productId?: string) {
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/review");
  if (productId) revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin");
}

export function revalidateServices(serviceId?: string) {
  revalidatePath("/admin/services");
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`);
  revalidatePath("/admin");
}

export function revalidateCategories() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
}

export function revalidateSettings() {
  revalidatePath("/admin/settings");
}

export function revalidateBookings(bookingId?: string) {
  revalidatePath("/admin/bookings");
  if (bookingId) revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin");
}

export function revalidateEnquiries() {
  revalidatePath("/admin/enquiries");
  revalidatePath("/admin");
}

export function revalidateUsers() {
  revalidatePath("/admin/users");
}
