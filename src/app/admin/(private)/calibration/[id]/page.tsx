import { redirect } from "next/navigation";

/** Retired UI; retries now live on Story Ideas. */
export default function OldCalibrationDetail() {
  redirect("/admin/ideas");
}
