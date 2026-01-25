import { redirect } from "next/navigation";

export default function Home() {
  // Middleware handles auth check and redirects appropriately
  redirect("/dashboard");
}
