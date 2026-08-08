import { describe, expect, it } from "vitest";

import { ContentNotFoundError } from "@/lib/content";
import {
  ContentAdminUnauthorizedError,
  DocumentExistsError,
  IndexIntegrityError,
  InvalidDocumentInputError,
  UnsupportedVersionError,
  mapAdminContentErrorToResponse,
} from "@/lib/admin/content";

describe("mapAdminContentErrorToResponse", () => {
  it("maps InvalidDocumentInputError to 400 with issues", async () => {
    const error = new InvalidDocumentInputError("invalid document", { issues: ["description: Required"] });
    const response = mapAdminContentErrorToResponse(error);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("CONTENT_ADMIN_INVALID_INPUT");
    expect(body.error.issues).toEqual(["description: Required"]);
  });

  it("maps ContentAdminUnauthorizedError to 401 with a generic message", async () => {
    const error = new ContentAdminUnauthorizedError("no valid admin session");
    const response = mapAdminContentErrorToResponse(error);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.message).toBe("unauthorized");
  });

  it("maps ContentNotFoundError to 404", async () => {
    const error = new ContentNotFoundError('no document for slug "foo"', { slug: "foo", availableSlugs: [] });
    const response = mapAdminContentErrorToResponse(error);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("CONTENT_NOT_FOUND");
  });

  it("maps DocumentExistsError to 409", async () => {
    const error = new DocumentExistsError('document "tools" already exists', { version: "v1", slug: "tools" });
    const response = mapAdminContentErrorToResponse(error);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("CONTENT_ADMIN_DOCUMENT_EXISTS");
  });

  it("maps IndexIntegrityError to 409 with conflicting paths", async () => {
    const error = new IndexIntegrityError('cannot delete "tools"', { conflicts: ["content/docs/v1/legacy-tools.md"] });
    const response = mapAdminContentErrorToResponse(error);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.conflicts).toEqual(["content/docs/v1/legacy-tools.md"]);
  });

  it("maps UnsupportedVersionError to 422", async () => {
    const error = new UnsupportedVersionError('unknown documentation version "v9"', { version: "v9" });
    const response = mapAdminContentErrorToResponse(error);
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("CONTENT_ADMIN_UNSUPPORTED_VERSION");
  });

  it("maps any other error to a generic 500 with no internal details", async () => {
    const response = mapAdminContentErrorToResponse(new Error("some internal database credential leak"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.message).not.toContain("credential");
    expect(body.error.code).toBe("CONTENT_ADMIN_INTERNAL_ERROR");
  });

  it("maps a non-Error thrown value to a generic 500", async () => {
    const response = mapAdminContentErrorToResponse("not an error object");
    expect(response.status).toBe(500);
  });
});
