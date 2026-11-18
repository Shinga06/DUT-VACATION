"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, hashPassword, requirePermission } from "@/lib/auth";
import { ROOM_OP_STATUSES, ROOM_TYPES, SEASONS } from "@/lib/constants";
import { ALL_PERMISSIONS } from "@/lib/permissions";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const residenceSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().min(5),
  campus: z.string().trim().optional(),
  address: z.string().trim().optional(),
  facilities: z.string().trim().optional(),
});

export async function createResidence(formData: FormData) {
  const user = await requirePermission("residences.manage");
  const d = residenceSchema.parse(Object.fromEntries(formData));
  const created = await db.residence.create({
    data: {
      name: d.name,
      slug: slugify(d.name),
      description: d.description,
      campus: d.campus || null,
      address: d.address || null,
      facilities: (d.facilities ?? "").split(",").map((s) => s.trim()).filter(Boolean).join(","),
    },
  });
  await audit({ actorId: user.id, action: "residence.create", entity: "Residence", entityId: created.id, after: created });
  revalidatePath("/admin/residences");
}

export async function toggleResidence(formData: FormData) {
  const user = await requirePermission("residences.manage");
  const id = String(formData.get("id"));
  const before = await db.residence.findUniqueOrThrow({ where: { id } });
  const after = await db.residence.update({ where: { id }, data: { isActive: !before.isActive } });
  await audit({
    actorId: user.id, action: "residence.toggle", entity: "Residence", entityId: id,
    before: { isActive: before.isActive }, after: { isActive: after.isActive },
  });
  revalidatePath("/admin/residences");
}

const roomSchema = z.object({
  residenceId: z.string().min(1),
  roomNumber: z.string().trim().min(1),
  floor: z.string().trim().optional(),
  type: z.enum(ROOM_TYPES),
  capacity: z.coerce.number().int().min(1).max(20),
});

export async function createRoom(formData: FormData) {
  const user = await requirePermission("residences.manage");
  const d = roomSchema.parse(Object.fromEntries(formData));
  const room = await db.room.create({
    data: {
      residenceId: d.residenceId,
      roomNumber: d.roomNumber,
      floor: d.floor || null,
      type: d.type,
      capacity: d.capacity,
      isAccessible: formData.get("isAccessible") === "on",
      beds: {
        create: Array.from({ length: d.capacity }, (_, i) => ({ label: String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : "") })),
      },
    },
  });
  await audit({ actorId: user.id, action: "room.create", entity: "Room", entityId: room.id, after: room });
  revalidatePath("/admin/residences");
}

export async function toggleRoom(formData: FormData) {
  const user = await requirePermission("residences.manage");
  const id = String(formData.get("id"));
  const before = await db.room.findUniqueOrThrow({ where: { id } });
  const after = await db.room.update({ where: { id }, data: { isActive: !before.isActive } });
  await audit({
    actorId: user.id, action: "room.toggle", entity: "Room", entityId: id,
    before: { isActive: before.isActive }, after: { isActive: after.isActive },
  });
  revalidatePath("/admin/residences");
}

/** FR-103/FR-104: only authorised staff change operational status. */
export async function setRoomStatus(formData: FormData) {
  const user = await requirePermission("operations.manage");
  const id = String(formData.get("id"));
  const status = z.enum(ROOM_OP_STATUSES).parse(formData.get("status"));
  const before = await db.room.findUniqueOrThrow({ where: { id } });
  await db.room.update({ where: { id }, data: { opStatus: status } });
  await audit({
    actorId: user.id, action: "room.status", entity: "Room", entityId: id,
    before: { opStatus: before.opStatus }, after: { opStatus: status },
  });
  revalidatePath("/admin/residences");
}

const pricingSchema = z.object({
  name: z.string().trim().min(2),
  residenceId: z.string().optional(),
  roomType: z.string().optional(),
  season: z.string().optional(),
  pricePerBedPerNight: z.coerce.number().positive(),
  minNights: z.coerce.number().int().min(1).optional(),
  maxNights: z.coerce.number().int().min(1).optional(),
  minGroupSize: z.coerce.number().int().min(2).optional(),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  priority: z.coerce.number().int().default(0),
});

export async function createPricingRule(formData: FormData) {
  const user = await requirePermission("pricing.manage");
  const raw = Object.fromEntries(formData);
  const d = pricingSchema.parse({
    ...raw,
    minNights: raw.minNights ? raw.minNights : undefined,
    maxNights: raw.maxNights ? raw.maxNights : undefined,
    minGroupSize: raw.minGroupSize ? raw.minGroupSize : undefined,
  });
  const created = await db.pricingRule.create({
    data: {
      name: d.name,
      residenceId: d.residenceId || null,
      roomType: d.roomType && ROOM_TYPES.includes(d.roomType as (typeof ROOM_TYPES)[number]) ? d.roomType : null,
      season: d.season && SEASONS.includes(d.season as (typeof SEASONS)[number]) ? d.season : null,
      pricePerBedPerNight: d.pricePerBedPerNight,
      minNights: d.minNights ?? null,
      maxNights: d.maxNights ?? null,
      minGroupSize: d.minGroupSize ?? null,
      discountPercent: d.discountPercent,
      priority: d.priority,
    },
  });
  await audit({ actorId: user.id, action: "pricing.create", entity: "PricingRule", entityId: created.id, after: created });
  revalidatePath("/admin/pricing");
}

export async function togglePricingRule(formData: FormData) {
  const user = await requirePermission("pricing.manage");
  const id = String(formData.get("id"));
  const before = await db.pricingRule.findUniqueOrThrow({ where: { id } });
  const after = await db.pricingRule.update({ where: { id }, data: { isActive: !before.isActive } });
  await audit({
    actorId: user.id, action: "pricing.toggle", entity: "PricingRule", entityId: id,
    before: { isActive: before.isActive }, after: { isActive: after.isActive },
  });
  revalidatePath("/admin/pricing");
}

const periodSchema = z.object({
  name: z.string().trim().min(2),
  season: z.enum(["JUNE", "DECEMBER"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

export async function createBookingPeriod(formData: FormData) {
  const user = await requirePermission("pricing.manage");
  const d = periodSchema.parse(Object.fromEntries(formData));
  const created = await db.bookingPeriod.create({
    data: {
      name: d.name,
      season: d.season,
      startDate: new Date(d.startDate),
      endDate: new Date(d.endDate),
    },
  });
  await audit({ actorId: user.id, action: "period.create", entity: "BookingPeriod", entityId: created.id, after: created });
  revalidatePath("/admin/pricing");
}

export async function toggleBookingPeriod(formData: FormData) {
  const user = await requirePermission("pricing.manage");
  const id = String(formData.get("id"));
  const before = await db.bookingPeriod.findUniqueOrThrow({ where: { id } });
  const after = await db.bookingPeriod.update({ where: { id }, data: { isActive: !before.isActive } });
  await audit({
    actorId: user.id, action: "period.toggle", entity: "BookingPeriod", entityId: id,
    before: { isActive: before.isActive }, after: { isActive: after.isActive },
  });
  revalidatePath("/admin/pricing");
}

export async function updateCleaningTask(formData: FormData) {
  const user = await requirePermission("operations.manage");
  const id = String(formData.get("id"));
  const status = z.enum(["PENDING", "IN_PROGRESS", "DONE", "INSPECTED", "FAILED"]).parse(formData.get("status"));
  const inspectionNote = String(formData.get("inspectionNote") ?? "").trim() || null;

  const task = await db.cleaningTask.update({
    where: { id },
    data: {
      status,
      inspectionNote,
      completedAt: status === "INSPECTED" || status === "DONE" ? new Date() : null,
    },
  });

  // FR-104: When inspection passes, mark room AVAILABLE again
  if (status === "INSPECTED") {
    await db.room.update({ where: { id: task.roomId }, data: { opStatus: "AVAILABLE" } });
  }

  await audit({
    actorId: user.id,
    action: "cleaning.update",
    entity: "CleaningTask",
    entityId: id,
    after: { status, inspectionNote },
  });
  revalidatePath("/admin/operations");
  revalidatePath("/admin");
}

export async function createMaintenanceRequest(formData: FormData) {
  const user = await requirePermission("operations.manage");
  const roomId = String(formData.get("roomId"));
  const title = String(formData.get("title")).trim();
  const priority = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).parse(formData.get("priority"));
  const assignedTo = String(formData.get("assignedTo") ?? "").trim() || null;

  const req = await db.maintenanceRequest.create({
    data: { roomId, title, priority, assignedTo },
  });
  await db.room.update({ where: { id: roomId }, data: { opStatus: "UNDER_MAINTENANCE" } });

  await audit({
    actorId: user.id,
    action: "maintenance.create",
    entity: "MaintenanceRequest",
    entityId: req.id,
    after: req,
  });
  revalidatePath("/admin/operations");
  revalidatePath("/admin");
}

export async function resolveMaintenanceRequest(formData: FormData) {
  const user = await requirePermission("operations.manage");
  const id = String(formData.get("id"));
  const req = await db.maintenanceRequest.update({
    where: { id },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
  await db.room.update({ where: { id: req.roomId }, data: { opStatus: "AVAILABLE" } });
  await audit({
    actorId: user.id,
    action: "maintenance.resolve",
    entity: "MaintenanceRequest",
    entityId: id,
  });
  revalidatePath("/admin/operations");
  revalidatePath("/admin");
}

/** FR-013: Temporary room restriction. */
export async function setRoomRestriction(formData: FormData) {
  const user = await requirePermission("residences.manage");
  const id = String(formData.get("id"));
  const restrictedUntilStr = String(formData.get("restrictedUntil") ?? "").trim();
  const restrictionNote = String(formData.get("restrictionNote") ?? "").trim() || null;
  const restrictedUntil = restrictedUntilStr ? new Date(restrictedUntilStr) : null;

  await db.room.update({
    where: { id },
    data: { restrictedUntil, restrictionNote },
  });
  await audit({
    actorId: user.id,
    action: "room.restrict",
    entity: "Room",
    entityId: id,
    after: { restrictedUntil, restrictionNote },
  });
  revalidatePath("/admin/residences");
}

/** FR-007: Authorised administrators activate or deactivate user accounts. */
export async function toggleUserActive(formData: FormData) {
  const actor = await requirePermission("users.manage");
  const id = String(formData.get("id"));
  const before = await db.user.findUniqueOrThrow({ where: { id } });
  const after = await db.user.update({
    where: { id },
    data: { isActive: !before.isActive },
  });
  await audit({
    actorId: actor.id,
    action: "user.toggle_active",
    entity: "User",
    entityId: id,
    before: { isActive: before.isActive },
    after: { isActive: after.isActive },
  });
  revalidatePath("/admin/users");
}

/** SRS 3.2: Assign user role and optional residence scope restriction. */
export async function updateUserRoleAndScope(formData: FormData) {
  const actor = await requirePermission("users.manage");
  const id = String(formData.get("id"));
  const roleId = String(formData.get("roleId"));
  const scopedResidenceId = String(formData.get("scopedResidenceId") ?? "").trim() || null;

  const before = await db.user.findUniqueOrThrow({ where: { id } });
  const after = await db.user.update({
    where: { id },
    data: { roleId, scopedResidenceId },
  });
  await audit({
    actorId: actor.id,
    action: "user.update_role_scope",
    entity: "User",
    entityId: id,
    before: { roleId: before.roleId, scopedResidenceId: before.scopedResidenceId },
    after: { roleId: after.roleId, scopedResidenceId: after.scopedResidenceId },
  });
  revalidatePath("/admin/users");
}

/** SRS 3.2: Super Administrator configures custom roles and permissions. */
export async function createCustomRole(formData: FormData) {
  const actor = await requirePermission("roles.manage");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) {
    redirect(`/admin/users?error=${encodeURIComponent("Role name is required.")}`);
  }

  const selected = formData
    .getAll("permissions")
    .map(String)
    .filter((p) => (ALL_PERMISSIONS as readonly string[]).includes(p));

  const role = await db.role.create({
    data: {
      name,
      description,
      isSystem: false,
      permissions: selected.join(","),
    },
  });

  await audit({
    actorId: actor.id,
    action: "role.create",
    entity: "Role",
    entityId: role.id,
    after: role,
  });
  revalidatePath("/admin/users");
}

/** FR-118: Authorised Student Housing administrators review submitted feedback. */
export async function markFeedbackReviewed(formData: FormData) {
  const actor = await requirePermission("feedback.review");
  const id = String(formData.get("id"));
  await db.feedback.update({ where: { id }, data: { reviewed: true } });
  await audit({
    actorId: actor.id,
    action: "feedback.reviewed",
    entity: "Feedback",
    entityId: id,
  });
  revalidatePath("/admin/reports");
}

export async function createCancellationPolicy(formData: FormData) {
  const user = await requirePermission("pricing.manage");
  const name = String(formData.get("name") ?? "").trim();
  const daysBeforeStay = z.coerce.number().int().min(0).parse(formData.get("daysBeforeStay"));
  const refundPercent = z.coerce.number().min(0).max(100).parse(formData.get("refundPercent"));
  if (!name) {
    redirect(`/admin/pricing?error=${encodeURIComponent("Policy name is required.")}`);
  }

  const policy = await db.cancellationPolicy.create({
    data: { name, daysBeforeStay, refundPercent },
  });
  await audit({
    actorId: user.id,
    action: "policy.create",
    entity: "CancellationPolicy",
    entityId: policy.id,
    after: policy,
  });
  revalidatePath("/admin/pricing");
}

export async function toggleCancellationPolicy(formData: FormData) {
  const user = await requirePermission("pricing.manage");
  const id = String(formData.get("id"));
  const before = await db.cancellationPolicy.findUniqueOrThrow({ where: { id } });
  const after = await db.cancellationPolicy.update({
    where: { id },
    data: { isActive: !before.isActive },
  });
  await audit({
    actorId: user.id,
    action: "policy.toggle",
    entity: "CancellationPolicy",
    entityId: id,
    before: { isActive: before.isActive },
    after: { isActive: after.isActive },
  });
  revalidatePath("/admin/pricing");
}

/** Edit existing residence details (description, address, campus, facilities, photo URL). */
export async function updateResidence(formData: FormData) {
  const user = await requirePermission("residences.manage");
  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const campus = String(formData.get("campus") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  const facilities = String(formData.get("facilities") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(",");
  const photos = String(formData.get("photos") ?? "").trim();

  if (!name || !description) {
    redirect(`/admin/residences?error=${encodeURIComponent("Residence name and description are required.")}`);
  }

  const before = await db.residence.findUniqueOrThrow({ where: { id } });
  const after = await db.residence.update({
    where: { id },
    data: { name, campus, description, address, facilities, photos },
  });

  await audit({
    actorId: user.id,
    action: "residence.update",
    entity: "Residence",
    entityId: id,
    before: {
      name: before.name,
      campus: before.campus,
      description: before.description,
      address: before.address,
      facilities: before.facilities,
      photos: before.photos,
    },
    after: {
      name: after.name,
      campus: after.campus,
      description: after.description,
      address: after.address,
      facilities: after.facilities,
      photos: after.photos,
    },
  });

  revalidatePath("/admin/residences");
  revalidatePath("/residences");
  revalidatePath(`/residences/${after.slug}`);
  revalidatePath("/");
}

/** Activate or deactivate an individual Bed inside a Room. */
export async function toggleBed(formData: FormData) {
  const user = await requirePermission("residences.manage");
  const id = String(formData.get("id"));
  const before = await db.bed.findUniqueOrThrow({ where: { id } });
  const after = await db.bed.update({
    where: { id },
    data: { isActive: !before.isActive },
  });

  await audit({
    actorId: user.id,
    action: "bed.toggle",
    entity: "Bed",
    entityId: id,
    before: { isActive: before.isActive },
    after: { isActive: after.isActive },
  });

  revalidatePath("/admin/residences");
}

/** Super Admin directly onboards a Staff or User account with role and residence scope. */
export async function createStaffUser(formData: FormData) {
  const actor = await requirePermission("users.manage");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const password = String(formData.get("password") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  const scopedResidenceId = String(formData.get("scopedResidenceId") ?? "").trim() || null;

  if (!firstName || !lastName || !email || !roleId) {
    redirect(`/admin/users?error=${encodeURIComponent("First name, last name, email, and role are required.")}`);
  }
  if (password.length < 10) {
    redirect(`/admin/users?error=${encodeURIComponent("Initial password must be at least 10 characters.")}`);
  }
  if (await db.user.findUnique({ where: { email } })) {
    redirect(`/admin/users?error=${encodeURIComponent(`An account with email ${email} already exists.`)}`);
  }

  const created = await db.user.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      passwordHash: await hashPassword(password),
      roleId,
      scopedResidenceId,
      emailVerified: true,
    },
  });

  await audit({
    actorId: actor.id,
    action: "user.staff_create",
    entity: "User",
    entityId: created.id,
    after: { email: created.email, roleId, scopedResidenceId },
  });

  revalidatePath("/admin/users");
}





