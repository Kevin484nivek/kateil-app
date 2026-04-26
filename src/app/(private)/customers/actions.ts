"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { getOptionalString, getRequiredString } from "@/lib/utils/form";

export async function createCustomerAction(formData: FormData) {
  const name = getRequiredString(formData, "name");

  if (!name) {
    throw new Error("Customer name is required");
  }

  await prisma.customer.create({
    data: {
      name,
      phone: getOptionalString(formData, "phone"),
      email: getOptionalString(formData, "email")?.toLowerCase() ?? null,
      notes: getOptionalString(formData, "notes"),
    },
  });

  revalidatePath("/customers");
  revalidatePath("/dashboard");
}

export async function toggleCustomerAction(formData: FormData) {
  const customerId = getRequiredString(formData, "customerId");
  const nextState = String(formData.get("nextState")) === "true";

  await prisma.customer.update({
    where: { id: customerId },
    data: { isActive: nextState },
  });

  revalidatePath("/customers");
  revalidatePath("/dashboard");
}
