import { Metadata } from "next";
import { requireOwner } from "@/lib/auth/session";
import { getHomepageConfig } from "@/lib/settings/homepage-config";
import { HomepageConfigEditor } from "@/components/admin/homepage-config-editor";

export const metadata: Metadata = {
  title: "Anasayfa & Vitrin Yönetimi | Admin",
  description: "Anasayfa hero slider ve vitrin raflarını platform, filtre ve sıralama kriterlerine göre yönetin.",
};

export const dynamic = "force-dynamic";

export default async function AdminHomepagePage() {
  await requireOwner();
  const config = await getHomepageConfig();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <HomepageConfigEditor initialConfig={config} />
    </div>
  );
}
