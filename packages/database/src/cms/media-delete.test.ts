import { describe, expect, it, vi, beforeEach } from "vitest";

const { fakeRef } = vi.hoisted(() => ({
  fakeRef: {
    current: null as null | {
      schema: (name: string) => unknown;
      storage: { from: (bucket: string) => { remove: (paths: string[]) => Promise<{ error: null | { message: string } }> } };
    },
  },
}));

vi.mock("../supabase", () => ({
  createSupabaseServiceClient: () => fakeRef.current,
  getSupabasePublicConfig: () => ({ url: "https://example.supabase.co", publishableKey: "pk" }),
}));

vi.mock("../staff", () => ({
  writeStaffAudit: vi.fn(async () => undefined),
}));

const { deleteCmsMediaAsset, normalizeCmsMediaSourcePath } = await import("./media");

describe("normalizeCmsMediaSourcePath", () => {
  it("normalizes relative and absolute /images paths", () => {
    expect(normalizeCmsMediaSourcePath("/images/cms/a.jpg")).toBe("/images/cms/a.jpg");
    expect(normalizeCmsMediaSourcePath("images/cms/a.jpg")).toBe("/images/cms/a.jpg");
    expect(normalizeCmsMediaSourcePath("  /images/x.png  ")).toBe("/images/x.png");
  });
});

describe("deleteCmsMediaAsset", () => {
  beforeEach(() => {
    fakeRef.current = null;
  });

  it("is idempotent when catalog status is already deleted", async () => {
    const removed: string[] = [];
    fakeRef.current = {
      schema: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
                    site_id: "00000000-0000-4000-8000-000000000001",
                    bucket_id: "cms-media",
                    storage_path: "media/site/a.webp",
                    content_hash: "abc",
                    original_filename: "a.webp",
                    mime_type: "image/webp",
                    byte_size: 10,
                    width: 1,
                    height: 1,
                    alt_default: "",
                    tags: [],
                    profile: "photo",
                    status: "deleted",
                    idempotency_key: null,
                    created_by_user_id: null,
                    created_at: "2026-01-01T00:00:00.000Z",
                    updated_at: "2026-01-01T00:00:00.000Z",
                    archived_at: null,
                    archive_reason: null,
                    deleted_at: "2026-01-02T00:00:00.000Z",
                    delete_reason: "gone",
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
      storage: {
        from: () => ({
          remove: async (paths: string[]) => {
            removed.push(...paths);
            return { error: null };
          },
        }),
      },
    };

    const result = await deleteCmsMediaAsset({
      assetId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      references: [],
      siteId: "00000000-0000-4000-8000-000000000001",
    });
    expect(result).toEqual({ ok: true });
    expect(removed).toEqual([]);
  });

  it("removes the Storage object then tombstones the catalog row", async () => {
    const removed: string[] = [];
    let updated: Record<string, unknown> | null = null;
    const row = {
      id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      site_id: "00000000-0000-4000-8000-000000000001",
      bucket_id: "cms-media",
      storage_path: "media/site/a.webp",
      content_hash: "abc",
      original_filename: "a.webp",
      mime_type: "image/webp",
      byte_size: 10,
      width: 1,
      height: 1,
      alt_default: "",
      tags: [],
      profile: "photo",
      status: "active",
      idempotency_key: null,
      created_by_user_id: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      archived_at: null,
      archive_reason: null,
      deleted_at: null,
      delete_reason: null,
    };

    fakeRef.current = {
      schema: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: row, error: null }),
              }),
            }),
          }),
          update: (patch: Record<string, unknown>) => {
            updated = patch;
            return {
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            };
          },
        }),
      }),
      storage: {
        from: (bucket: string) => ({
          remove: async (paths: string[]) => {
            expect(bucket).toBe("cms-media");
            removed.push(...paths);
            return { error: null };
          },
        }),
      },
    };

    const result = await deleteCmsMediaAsset({
      assetId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      references: [],
      siteId: "00000000-0000-4000-8000-000000000001",
    });
    expect(result).toEqual({ ok: true });
    expect(removed).toEqual(["media/site/a.webp"]);
    expect(updated).toMatchObject({ status: "deleted", delete_reason: null });
  });

  it("stores an optional delete reason when provided", async () => {
    const removed: string[] = [];
    let updated: Record<string, unknown> | null = null;
    const row = {
      id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      site_id: "00000000-0000-4000-8000-000000000001",
      bucket_id: "cms-media",
      storage_path: "media/site/a.webp",
      content_hash: "abc",
      original_filename: "a.webp",
      mime_type: "image/webp",
      byte_size: 10,
      width: 1,
      height: 1,
      alt_default: "",
      tags: [],
      profile: "photo",
      status: "active",
      idempotency_key: null,
      created_by_user_id: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      archived_at: null,
      archive_reason: null,
      deleted_at: null,
      delete_reason: null,
    };

    fakeRef.current = {
      schema: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: row, error: null }),
              }),
            }),
          }),
          update: (patch: Record<string, unknown>) => {
            updated = patch;
            return {
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            };
          },
        }),
      }),
      storage: {
        from: () => ({
          remove: async (paths: string[]) => {
            removed.push(...paths);
            return { error: null };
          },
        }),
      },
    };

    const result = await deleteCmsMediaAsset({
      assetId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      reason: "copyright",
      references: [],
      siteId: "00000000-0000-4000-8000-000000000001",
    });
    expect(result).toEqual({ ok: true });
    expect(removed).toEqual(["media/site/a.webp"]);
    expect(updated).toMatchObject({ status: "deleted", delete_reason: "copyright" });
  });

  it("refuses delete when references exist and force is false", async () => {
    const removed: string[] = [];
    fakeRef.current = {
      schema: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
                    site_id: "00000000-0000-4000-8000-000000000001",
                    bucket_id: "cms-media",
                    storage_path: "media/site/a.webp",
                    content_hash: "abc",
                    original_filename: "a.webp",
                    mime_type: "image/webp",
                    byte_size: 10,
                    width: 1,
                    height: 1,
                    alt_default: "",
                    tags: [],
                    profile: "photo",
                    status: "active",
                    idempotency_key: null,
                    created_by_user_id: null,
                    created_at: "2026-01-01T00:00:00.000Z",
                    updated_at: "2026-01-01T00:00:00.000Z",
                    archived_at: null,
                    archive_reason: null,
                    deleted_at: null,
                    delete_reason: null,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
      storage: {
        from: () => ({
          remove: async (paths: string[]) => {
            removed.push(...paths);
            return { error: null };
          },
        }),
      },
    };

    const result = await deleteCmsMediaAsset({
      assetId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      references: [{ pageId: "p1", pageTitle: "Home", state: "draft" }],
      siteId: "00000000-0000-4000-8000-000000000001",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("referenced");
    expect(removed).toEqual([]);
  });
});
