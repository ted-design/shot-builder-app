import { describe, it, expect } from "vitest"
import {
  callSheetSharesPath,
  callSheetShareDocPath,
  callSheetShareRecipientsPath,
  callSheetShareRecipientDocPath,
  callSheetShareRecipientsCollectionGroup,
} from "../lib/callSheetSharePaths"

describe("callSheetSharePaths", () => {
  describe("callSheetSharesPath", () => {
    it("returns the root collection path", () => {
      expect(callSheetSharesPath()).toEqual(["callSheetShares"])
    })
  })

  describe("callSheetShareDocPath", () => {
    it("returns a doc path under the root collection", () => {
      expect(callSheetShareDocPath("group-1")).toEqual([
        "callSheetShares",
        "group-1",
      ])
    })

    it("preserves the shareGroupId segment verbatim", () => {
      expect(callSheetShareDocPath("AbC123-xyz")).toEqual([
        "callSheetShares",
        "AbC123-xyz",
      ])
    })
  })

  describe("callSheetShareRecipientsPath", () => {
    it("returns a recipients subcollection path nested under a share doc", () => {
      expect(callSheetShareRecipientsPath("group-1")).toEqual([
        "callSheetShares",
        "group-1",
        "recipients",
      ])
    })
  })

  describe("callSheetShareRecipientDocPath", () => {
    it("returns a recipient doc path with both shareGroupId and token segments", () => {
      expect(callSheetShareRecipientDocPath("group-1", "token-abc")).toEqual([
        "callSheetShares",
        "group-1",
        "recipients",
        "token-abc",
      ])
    })

    it("does not collapse distinct shareGroupId + recipientToken", () => {
      const path = callSheetShareRecipientDocPath("g1", "t1")
      expect(path).toHaveLength(4)
      expect(path[1]).toBe("g1")
      expect(path[3]).toBe("t1")
    })
  })

  describe("callSheetShareRecipientsCollectionGroup", () => {
    it("returns the collection-group id used in collectionGroup() queries", () => {
      expect(callSheetShareRecipientsCollectionGroup()).toBe("recipients")
    })
  })
})
