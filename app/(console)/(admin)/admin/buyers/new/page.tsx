import type { Metadata } from "next";

import { BuyerRegistrationForm } from "@/components/admin/buyer-form";
import { AdminPageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Register buyer · Admin" };

export default function NewBuyerPage() {
  return (
    <>
      <AdminPageHeader
        title="Register a buyer"
        description="Franchise or independent bulk buyer. The account is created pending review and cannot place orders until operations approves it."
      />
      <BuyerRegistrationForm />
    </>
  );
}
