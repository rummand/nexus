import { redirect } from "next/navigation";
import { DEMO_WORKSPACE_SLUG } from "@/db/seed";

export default function Home() {
  redirect(`/w/${DEMO_WORKSPACE_SLUG}`);
}
