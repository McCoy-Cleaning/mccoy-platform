import { afterEach, describe, expect, it } from "vitest";
import {
  blockedGraphQuery,
  graphQueryShape,
  illegalGraphMailQueryReason,
  parseGraphQuery,
  recordGraphQueryFailure,
  resetGraphQueryCircuitForTests,
} from "./graph-query-guard";

afterEach(() => {
  resetGraphQueryCircuitForTests();
});

describe("illegalGraphMailQueryReason", () => {
  it("rejects contains(subject) $filter", () => {
    const parsed = parseGraphQuery(
      "/users/info%40mccoy.nl/messages?$filter=contains(subject,'WR-2026-00042')&$select=id,subject&$top=25",
    );
    expect(illegalGraphMailQueryReason(parsed)).toMatch(/contains\(subject\)/);
    expect(parsed.filter).toBe("contains(subject,'WR-2026-00042')");
    expect(parsed.select).toBe("id,subject");
  });

  it("rejects $search mixed with $filter or $orderby", () => {
    expect(
      illegalGraphMailQueryReason(
        parseGraphQuery(
          '/users/x/messages?$search=%22WR-1%22&$filter=hasAttachments%20eq%20true',
        ),
      ),
    ).toMatch(/\$search cannot be combined with \$filter/);
    expect(
      illegalGraphMailQueryReason(
        parseGraphQuery(
          '/users/x/messages?$search=%22WR-1%22&$select=id,subject',
        ),
      ),
    ).toMatch(/\$search cannot be combined with \$select/);
    expect(
      illegalGraphMailQueryReason(
        parseGraphQuery(
          '/users/x/messages?$search=%22WR-1%22&$orderby=receivedDateTime%20desc',
        ),
      ),
    ).toMatch(/\$search cannot be combined with \$orderby/);
  });

  it("rejects attachment: and subject:/body: KQL", () => {
    expect(
      illegalGraphMailQueryReason(
        parseGraphQuery('/users/x/messages?$search=attachment%3A%22cv.pdf%22'),
      ),
    ).toMatch(/attachment:/);
    expect(
      illegalGraphMailQueryReason(
        parseGraphQuery('/users/x/messages?$search=subject%3A%22WR-1%22'),
      ),
    ).toMatch(/quoted phrase/);
  });

  it("rejects attachments $select contentBytes and expand+select", () => {
    expect(
      illegalGraphMailQueryReason(
        parseGraphQuery(
          "/users/x/messages/abc/attachments?$select=id,name,contentBytes",
        ),
      ),
    ).toMatch(/contentBytes/);
    expect(
      illegalGraphMailQueryReason(
        parseGraphQuery(
          "/users/x/messages/abc?$select=id,hasAttachments&$expand=attachments",
        ),
      ),
    ).toMatch(/\$expand=attachments/);
  });

  it("allows a quoted $search phrase alone and a receivedDateTime filter", () => {
    expect(
      illegalGraphMailQueryReason(
        parseGraphQuery('/users/x/messages?$search=%22WR-2026-00042%22&$top=15'),
      ),
    ).toBeNull();
    expect(
      illegalGraphMailQueryReason(
        parseGraphQuery(
          "/users/x/messages?$filter=receivedDateTime%20ge%202026-01-01T00:00:00Z&$orderby=receivedDateTime%20desc&$select=id,subject",
        ),
      ),
    ).toBeNull();
    expect(
      illegalGraphMailQueryReason(
        parseGraphQuery("/users/x/messages/abc/attachments"),
      ),
    ).toBeNull();
  });
});

describe("Graph 400 circuit", () => {
  it("does not retry the same 400 query shape", () => {
    const first = parseGraphQuery(
      '/users/x/messages?$search=%22WR-2026-00007%22&$select=id,subject',
    );
    const second = parseGraphQuery(
      '/users/x/messages?$search=%22WR-2026-00099%22&$select=id,subject',
    );
    expect(graphQueryShape(first)).toBe(graphQueryShape(second));
    expect(blockedGraphQuery(first)).toBeNull();
    recordGraphQueryFailure(first, 400, "BadRequest");
    expect(blockedGraphQuery(second)).toEqual({ status: 400, code: "BadRequest" });
  });

  it("does not circuit-break GET attachments without query params (bad id vs bad query)", () => {
    const parsed = parseGraphQuery("/users/x/messages/abc/attachments");
    recordGraphQueryFailure(parsed, 400, "BadRequest");
    expect(blockedGraphQuery(parsed)).toBeNull();
  });
});
