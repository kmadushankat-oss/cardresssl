import { describe, expect, it } from "vitest";

import type { UserRole } from "@/generated/prisma/enums";
import {
  can,
  canViewAllJobCards,
  isStaffRole,
  PERMISSIONS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  STAFF_ROLES,
  type Permission,
} from "@/lib/permissions";

const ALL_ROLES = Object.keys(ROLE_PERMISSIONS) as UserRole[];

describe("permission table integrity", () => {
  it("has no duplicate permission strings", () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it("grants every role only permissions that exist", () => {
    const known = new Set<string>(PERMISSIONS);
    for (const role of ALL_ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(known, `${role} references unknown permission "${permission}"`).toContain(
          permission,
        );
      }
    }
  });

  it("grants no role a permission twice", () => {
    for (const role of ALL_ROLES) {
      const granted = ROLE_PERMISSIONS[role];
      expect(new Set(granted).size, `${role} has duplicates`).toBe(granted.length);
    }
  });

  it("labels and describes every role", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy();
      expect(ROLE_DESCRIPTIONS[role]).toBeTruthy();
    }
  });
});

describe("OWNER", () => {
  it("holds every permission", () => {
    for (const permission of PERMISSIONS) {
      expect(can("OWNER", permission), `OWNER missing ${permission}`).toBe(true);
    }
  });
});

describe("ADMIN", () => {
  // The owner-only escape hatches: an admin runs the business day to day but
  // must not be able to hand out roles or erase financial history.
  const ownerOnly: Permission[] = ["user:changeRole", "user:delete", "payment:delete"];

  it.each(ownerOnly)("cannot %s", (permission) => {
    expect(can("ADMIN", permission)).toBe(false);
  });

  it("can still manage products, invoices and settings", () => {
    expect(can("ADMIN", "product:update")).toBe(true);
    expect(can("ADMIN", "invoice:send")).toBe(true);
    expect(can("ADMIN", "settings:manage")).toBe(true);
  });
});

describe("CUSTOMER", () => {
  it("holds no permissions at all", () => {
    expect(ROLE_PERMISSIONS.CUSTOMER).toHaveLength(0);
  });

  it("is not a staff role and cannot reach the dashboard", () => {
    expect(isStaffRole("CUSTOMER")).toBe(false);
    expect(can("CUSTOMER", "dashboard:view")).toBe(false);
  });
});

describe("MECHANIC", () => {
  it("cannot write to the catalogue", () => {
    expect(can("MECHANIC", "product:create")).toBe(false);
    expect(can("MECHANIC", "product:update")).toBe(false);
    expect(can("MECHANIC", "product:delete")).toBe(false);
  });

  it("cannot see cost prices or financial reports", () => {
    expect(can("MECHANIC", "product:viewCost")).toBe(false);
    expect(can("MECHANIC", "reports:financial")).toBe(false);
  });

  it("cannot touch invoices, payments or users", () => {
    expect(can("MECHANIC", "invoice:create")).toBe(false);
    expect(can("MECHANIC", "payment:record")).toBe(false);
    expect(can("MECHANIC", "user:view")).toBe(false);
  });

  it("sees only their own job cards", () => {
    expect(can("MECHANIC", "jobcard:viewAssigned")).toBe(true);
    expect(can("MECHANIC", "jobcard:view")).toBe(false);
    expect(canViewAllJobCards("MECHANIC")).toBe(false);
  });

  it("can update the job cards they are working on", () => {
    expect(can("MECHANIC", "jobcard:update")).toBe(true);
  });
});

describe("ACCOUNTANT", () => {
  it("cannot change roles or manage staff", () => {
    expect(can("ACCOUNTANT", "user:changeRole")).toBe(false);
    expect(can("ACCOUNTANT", "user:create")).toBe(false);
  });

  it("cannot write to the catalogue but can read it with costs", () => {
    expect(can("ACCOUNTANT", "product:update")).toBe(false);
    expect(can("ACCOUNTANT", "product:view")).toBe(true);
    expect(can("ACCOUNTANT", "product:viewCost")).toBe(true);
  });

  it("owns invoicing and payments", () => {
    expect(can("ACCOUNTANT", "invoice:create")).toBe(true);
    expect(can("ACCOUNTANT", "invoice:send")).toBe(true);
    expect(can("ACCOUNTANT", "payment:record")).toBe(true);
    expect(can("ACCOUNTANT", "reports:financial")).toBe(true);
  });
});

describe("STOREKEEPER", () => {
  it("manages stock but not money or people", () => {
    expect(can("STOREKEEPER", "inventory:adjust")).toBe(true);
    expect(can("STOREKEEPER", "supplier:manage")).toBe(true);
    expect(can("STOREKEEPER", "invoice:create")).toBe(false);
    expect(can("STOREKEEPER", "payment:record")).toBe(false);
    expect(can("STOREKEEPER", "user:view")).toBe(false);
  });
});

describe("SERVICE_ADVISOR", () => {
  it("runs the front desk", () => {
    expect(can("SERVICE_ADVISOR", "booking:create")).toBe(true);
    expect(can("SERVICE_ADVISOR", "jobcard:create")).toBe(true);
    expect(can("SERVICE_ADVISOR", "customer:create")).toBe(true);
    expect(can("SERVICE_ADVISOR", "invoice:send")).toBe(true);
  });

  it("cannot see margins or manage staff and settings", () => {
    expect(can("SERVICE_ADVISOR", "product:viewCost")).toBe(false);
    expect(can("SERVICE_ADVISOR", "reports:financial")).toBe(false);
    expect(can("SERVICE_ADVISOR", "user:view")).toBe(false);
    expect(can("SERVICE_ADVISOR", "settings:manage")).toBe(false);
  });
});

describe("sensitive permissions are tightly held", () => {
  const expectHolders = (permission: Permission, holders: UserRole[]) => {
    const actual = ALL_ROLES.filter((role) => can(role, permission)).sort();
    expect(actual).toEqual([...holders].sort());
  };

  it("restricts role changes to the owner", () => {
    expectHolders("user:changeRole", ["OWNER"]);
  });

  it("restricts deleting payments to the owner", () => {
    expectHolders("payment:delete", ["OWNER"]);
  });

  it("restricts deleting users to the owner", () => {
    expectHolders("user:delete", ["OWNER"]);
  });

  it("restricts settings changes to owner and admin", () => {
    expectHolders("settings:manage", ["OWNER", "ADMIN"]);
  });

  it("restricts cost-price visibility to roles that need margins", () => {
    expectHolders("product:viewCost", [
      "OWNER",
      "ADMIN",
      "MANAGER",
      "ACCOUNTANT",
      "STOREKEEPER",
    ]);
  });

  it("restricts the audit log to owner and admin", () => {
    expectHolders("audit:view", ["OWNER", "ADMIN"]);
  });
});

describe("staff roles", () => {
  it("covers every role except CUSTOMER", () => {
    expect([...STAFF_ROLES].sort()).toEqual(
      ALL_ROLES.filter((r) => r !== "CUSTOMER").sort(),
    );
  });

  it("gives every staff role a way into the dashboard", () => {
    for (const role of STAFF_ROLES) {
      expect(can(role, "dashboard:view"), `${role} cannot view the dashboard`).toBe(
        true,
      );
    }
  });
});
