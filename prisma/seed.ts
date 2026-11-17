import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ROLE_PERMISSIONS } from "../src/lib/permissions";
import { SYSTEM_ROLES } from "../src/lib/constants";

const db = new PrismaClient();

async function main() {
  // Roles (SRS 3.2)
  const roles: Record<string, string> = {};
  for (const name of SYSTEM_ROLES) {
    const r = await db.role.upsert({
      where: { name },
      update: { permissions: DEFAULT_ROLE_PERMISSIONS[name].join(","), isSystem: true },
      create: {
        name,
        isSystem: true,
        permissions: DEFAULT_ROLE_PERMISSIONS[name].join(","),
        description: `${name} (built-in)`,
      },
    });
    roles[name] = r.id;
  }

  // Demo staff accounts - CHANGE OR REMOVE BEFORE PRODUCTION
  const demoPassword = await bcrypt.hash("ChangeMe!2026", 12);
  const staff = [
    ["admin@dut-amp.local", "System", "Administrator", "Super Administrator"],
    ["housing@dut-amp.local", "Student", "Housing", "Student Housing Administrator"],
    ["finance@dut-amp.local", "Finance", "Officer", "Finance Officer"],
    ["officer@dut-amp.local", "Accommodation", "Officer", "Accommodation Officer"],
  ] as const;
  for (const [email, firstName, lastName, role] of staff) {
    await db.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        firstName,
        lastName,
        passwordHash: demoPassword,
        emailVerified: true,
        roleId: roles[role],
      },
    });
  }

  // Residences (sample data - replace with approved DUT accommodation info)
  const residences = [
    {
      name: "Ritson Campus Residence",
      slug: "ritson",
      description: "Self-catering student residence close to the Ritson campus and the Durban CBD.",
      campus: "Ritson",
      address: "Ritson Road, Berea, Durban",
      facilities: "Wi-Fi,Shared kitchen,Laundry,Study lounge,24h security",
      floors: ["1", "2", "3"],
      perFloor: 8,
    },
    {
      name: "Steve Biko Campus Residence",
      slug: "steve-biko",
      description: "Modern residence with single and shared rooms near the Steve Biko campus.",
      campus: "Steve Biko",
      address: "Steve Biko Road, Musgrave, Durban",
      facilities: "Wi-Fi,Shared kitchen,Common room,Parking,24h security",
      floors: ["1", "2"],
      perFloor: 10,
    },
    {
      name: "ML Sultan Guest House",
      slug: "ml-sultan",
      description: "University guest accommodation suitable for visiting delegations.",
      campus: "ML Sultan",
      address: "Centenary Road, Durban",
      facilities: "Wi-Fi,Breakfast room,Conference room,24h security",
      floors: ["G", "1"],
      perFloor: 6,
    },
  ];

  const types = ["SINGLE", "DOUBLE", "SHARING"] as const;
  const caps = { SINGLE: 1, DOUBLE: 2, SHARING: 4 } as const;

  for (const r of residences) {
    const existing = await db.residence.findUnique({ where: { slug: r.slug } });
    if (existing) continue;
    const residence = await db.residence.create({
      data: {
        name: r.name,
        slug: r.slug,
        description: r.description,
        campus: r.campus,
        address: r.address,
        facilities: r.facilities,
      },
    });
    let n = 0;
    for (const floor of r.floors) {
      for (let i = 1; i <= r.perFloor; i++) {
        const type = types[n % types.length];
        const roomNumber = `${floor}${String(i).padStart(2, "0")}`;
        const room = await db.room.create({
          data: {
            residenceId: residence.id,
            roomNumber,
            floor,
            type,
            capacity: caps[type],
            isAccessible: floor === r.floors[0] && i <= 2,
          },
        });
        for (let b = 0; b < caps[type]; b++) {
          await db.bed.create({ data: { roomId: room.id, label: String.fromCharCode(65 + b) } });
        }
        n++;
      }
    }
  }

  // Pricing (sample ZAR rates - DUT determines real prices, SRS assumption 3)
  if ((await db.pricingRule.count()) === 0) {
    await db.pricingRule.createMany({
      data: [
        { name: "Standard - Single", roomType: "SINGLE", pricePerBedPerNight: 350, minNights: 1, priority: 0 },
        { name: "Standard - Double", roomType: "DOUBLE", pricePerBedPerNight: 280, minNights: 1, priority: 0 },
        { name: "Standard - Sharing", roomType: "SHARING", pricePerBedPerNight: 200, minNights: 1, priority: 0 },
        {
          name: "December peak - Single",
          roomType: "SINGLE",
          season: "DECEMBER",
          pricePerBedPerNight: 420,
          minNights: 2,
          priority: 1,
        },
        {
          name: "Group discount (10+)",
          roomType: "SHARING",
          pricePerBedPerNight: 200,
          minGroupSize: 10,
          discountPercent: 10,
          priority: 1,
        },
      ],
    });
  }

  // Approved public booking periods (BR-002)
  if ((await db.bookingPeriod.count()) === 0) {
    await db.bookingPeriod.createMany({
      data: [
        { name: "June 2027 Holiday", season: "JUNE", startDate: new Date("2027-06-01"), endDate: new Date("2027-06-30") },
        { name: "December 2026 Holiday", season: "DECEMBER", startDate: new Date("2026-12-01"), endDate: new Date("2027-01-15") },
      ],
    });
  }

  // Cancellation policy
  if ((await db.cancellationPolicy.count()) === 0) {
    await db.cancellationPolicy.createMany({
      data: [
        { name: "14+ days before check-in", daysBeforeStay: 14, refundPercent: 100 },
        { name: "7-13 days before check-in", daysBeforeStay: 7, refundPercent: 50 },
      ],
    });
  }

  if ((await db.faq.count()) === 0) {
    await db.faq.createMany({
      data: [
        {
          question: "When can the public book accommodation?",
          answer: "Public bookings are open during approved June and December holiday periods.",
          sort: 1,
        },
        {
          question: "Can institutions book outside the holidays?",
          answer: "Yes. Institutional coordinators can submit requests all year, subject to availability and Student Housing approval.",
          sort: 2,
        },
        {
          question: "How do I pay?",
          answer: "Pay online or by EFT using your booking-specific reference, then upload proof of payment for verification.",
          sort: 3,
        },
      ],
    });
  }

  // Demo Guest & Institutional Coordinator accounts + Realistic Sample Bookings
  const guestUser = await db.user.upsert({
    where: { email: "guest@dut-amp.local" },
    update: {},
    create: {
      email: "guest@dut-amp.local",
      firstName: "Thabo",
      lastName: "Mokoena",
      phone: "082 555 0192",
      passwordHash: demoPassword,
      emailVerified: true,
      roleId: roles["Public Guest"],
    },
  });

  const coordUser = await db.user.upsert({
    where: { email: "coordinator@ukzn.ac.za" },
    update: {},
    create: {
      email: "coordinator@ukzn.ac.za",
      firstName: "Naledi",
      lastName: "Dlamini",
      phone: "083 444 9811",
      institution: "University of KwaZulu-Natal (UKZN)",
      passwordHash: demoPassword,
      emailVerified: true,
      roleId: roles["Institutional Coordinator"],
    },
  });

  if ((await db.booking.count()) === 0) {
    const ritson = await db.residence.findUniqueOrThrow({ where: { slug: "ritson" }, include: { rooms: { include: { beds: true } } } });
    const biko = await db.residence.findUniqueOrThrow({ where: { slug: "steve-biko" }, include: { rooms: { include: { beds: true } } } });
    const sultan = await db.residence.findUniqueOrThrow({ where: { slug: "ml-sultan" }, include: { rooms: { include: { beds: true } } } });

    // 1. Confirmed Public Holiday Booking with verified online payment & bed allocation
    const bk1 = await db.booking.create({
      data: {
        reference: "DUT-DEC26-001",
        type: "PUBLIC",
        status: "CONFIRMED",
        paymentStatus: "PAID",
        userId: guestUser.id,
        residenceId: ritson.id,
        checkIn: new Date("2026-12-10"),
        checkOut: new Date("2026-12-15"),
        occupants: 1,
        roomType: "SINGLE",
        agreedTotal: 2100,
        amountPaid: 2100,
        guests: {
          create: {
            firstName: "Thabo",
            lastName: "Mokoena",
            email: "guest@dut-amp.local",
            phone: "082 555 0192",
            idNumber: "9204125800081",
            emergencyName: "Lerato Mokoena",
            emergencyPhone: "082 555 0199",
            rulesAcceptedAt: new Date(),
            detailsConfirmedAt: new Date(),
          },
        },
        payments: {
          create: {
            method: "ONLINE",
            amount: 2100,
            reference: "DUT-DEC26-001-PAY",
            status: "VERIFIED",
            verifiedAt: new Date(),
            receiptNo: "RCP-2026-001",
          },
        },
      },
    });
    const singleRoom = ritson.rooms.find((r) => r.type === "SINGLE") ?? ritson.rooms[0];
    await db.allocation.create({
      data: {
        bookingId: bk1.id,
        roomId: singleRoom.id,
        bedId: singleRoom.beds[0]?.id ?? null,
        startDate: new Date("2026-12-10"),
        endDate: new Date("2026-12-15"),
        isActive: true,
      },
    });

    // 2. Institutional Conference Delegation awaiting Student Housing review & EFT verification
    await db.booking.create({
      data: {
        reference: "DUT-CONF-002",
        type: "INSTITUTIONAL",
        status: "PENDING_REVIEW",
        paymentStatus: "PENDING_VERIFICATION",
        userId: coordUser.id,
        residenceId: sultan.id,
        checkIn: new Date("2026-11-24"),
        checkOut: new Date("2026-11-28"),
        occupants: 6,
        roomType: "DOUBLE",
        institution: "University of KwaZulu-Natal (UKZN)",
        eventName: "KZN Higher Education Research Summit 2026",
        agreedTotal: 6720,
        amountPaid: 0,
        guests: {
          create: [
            { firstName: "Naledi", lastName: "Dlamini", email: "coordinator@ukzn.ac.za", studentOrStaffNo: "STF-401", institution: "UKZN" },
            { firstName: "Sipho", lastName: "Ndlovu", email: "sipho@ukzn.ac.za", studentOrStaffNo: "STF-402", institution: "UKZN" },
            { firstName: "Zanele", lastName: "Khumalo", email: "zanele@ukzn.ac.za", studentOrStaffNo: "STF-403", institution: "UKZN" },
          ],
        },
        preferences: {
          create: {
            kind: "ACCESSIBILITY",
            details: "Ground floor rooms requested for 2 senior delegates",
            status: "PENDING",
          },
        },
        payments: {
          create: {
            method: "EFT",
            amount: 6720,
            reference: "DUT-CONF-002-PAY",
            proofUrl: "Standard Bank EFT #SB-994120",
            status: "PENDING",
          },
        },
      },
    });

    // 3. Checked-out Stay with 5-star Guest Feedback & Pending Room Cleaning Inspection
    await db.booking.create({
      data: {
        reference: "DUT-NOV26-003",
        type: "INSTITUTIONAL",
        status: "CHECKED_OUT",
        paymentStatus: "PAID",
        userId: coordUser.id,
        residenceId: biko.id,
        checkIn: new Date("2026-11-10"),
        checkOut: new Date("2026-11-14"),
        occupants: 2,
        roomType: "DOUBLE",
        institution: "University of KwaZulu-Natal (UKZN)",
        eventName: "Inter-Varsity Athletics Meet",
        agreedTotal: 2240,
        amountPaid: 2240,
        payments: {
          create: {
            method: "EFT",
            amount: 2240,
            reference: "DUT-NOV26-003-PAY",
            status: "VERIFIED",
            verifiedAt: new Date(),
            receiptNo: "RCP-2026-002",
          },
        },
        feedback: {
          create: {
            rating: 5,
            cleanliness: 5,
            facilities: 4,
            service: 5,
            comment: "Clean rooms, seamless check-in at Steve Biko reception, and helpful security team.",
          },
        },
      },
    });

    const bikoRoom = biko.rooms[0];
    await db.room.update({ where: { id: bikoRoom.id }, data: { opStatus: "CLEANING" } });
    await db.cleaningTask.create({
      data: { roomId: bikoRoom.id, status: "PENDING", inspectionNote: "Post-checkout deep clean scheduled" },
    });

    const bikoMaintRoom = biko.rooms[1];
    await db.room.update({ where: { id: bikoMaintRoom.id }, data: { opStatus: "UNDER_MAINTENANCE" } });
    await db.maintenanceRequest.create({
      data: {
        roomId: bikoMaintRoom.id,
        title: "Replace study desk lamp & test wall socket",
        priority: "MEDIUM",
        status: "OPEN",
      },
    });

    await db.notification.createMany({
      data: [
        {
          toEmail: "guest@dut-amp.local",
          subject: "Booking Confirmed: DUT-DEC26-001 (Ritson Campus Residence)",
          body: "Your holiday booking for 10 Dec – 15 Dec 2026 is confirmed and Room 101 Bed A has been allocated.",
          status: "SENT",
        },
        {
          toEmail: "coordinator@ukzn.ac.za",
          subject: "Institutional Request Received: DUT-CONF-002",
          body: "Your delegation request for KZN Higher Education Research Summit 2026 is pending Student Housing review and EFT verification.",
          status: "SENT",
        },
      ],
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
