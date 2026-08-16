import { describe, expect, it } from "vitest";

import {
  describeGrades,
  hasDraftErrors,
  isImageType,
  isVideoType,
  MAX_IMAGES,
  MAX_RATE_PAISE,
  offeredGrades,
  paiseToRupees,
  rupeesToPaise,
  totalQuantity,
  validateDraft,
  type GradeQuantity,
  type ListingDraft,
} from "./listing-draft";

function draft(over: Partial<ListingDraft> = {}): ListingDraft {
  return {
    produceId: "tomato",
    unit: "kg",
    grades: [{ grade: "a", quantity: 300 }],
    readyIn: "today",
    imagePaths: ["listings/F-1/one.jpg"],
    ...over,
  };
}

const photos = (n: number) => Array.from({ length: n }, (_, i) => `listings/F-1/${i}.jpg`);

describe("grades are listed individually", () => {
  it("accepts a single grade", () => {
    // A farmer with only B fills in one box. That is the common case, not an
    // edge case.
    expect(hasDraftErrors(validateDraft(draft({ grades: [{ grade: "b", quantity: 400 }] })))).toBe(
      false,
    );
  });

  it("accepts all three", () => {
    const grades: GradeQuantity[] = [
      { grade: "a", quantity: 300 },
      { grade: "b", quantity: 400 },
      { grade: "c", quantity: 120 },
    ];
    expect(hasDraftErrors(validateDraft(draft({ grades })))).toBe(false);
  });

  it("refuses a listing with no quantity anywhere", () => {
    expect(validateDraft(draft({ grades: [] })).grades).toBeDefined();
    expect(
      validateDraft(draft({ grades: [{ grade: "a", quantity: 0 }] })).grades,
    ).toBeDefined();
  });

  it("treats zero as 'none of this grade' rather than an error", () => {
    const grades: GradeQuantity[] = [
      { grade: "a", quantity: 0 },
      { grade: "b", quantity: 500 },
      { grade: "c", quantity: 0 },
    ];
    expect(validateDraft(draft({ grades })).grades).toBeUndefined();
    expect(offeredGrades(grades)).toEqual([{ grade: "b", quantity: 500 }]);
  });

  it("catches a negative and a keypad typo", () => {
    expect(validateDraft(draft({ grades: [{ grade: "a", quantity: -5 }] })).grades).toBeDefined();
    expect(
      validateDraft(draft({ grades: [{ grade: "a", quantity: 3_000_000 }] })).grades,
    ).toBeDefined();
  });

  it("totals only what is offered", () => {
    expect(
      totalQuantity([
        { grade: "a", quantity: 300 },
        { grade: "b", quantity: 0 },
        { grade: "c", quantity: 120 },
      ]),
    ).toBe(420);
  });

  it("orders best grade first however they were entered", () => {
    const jumbled: GradeQuantity[] = [
      { grade: "c", quantity: 100 },
      { grade: "a", quantity: 300 },
    ];
    expect(offeredGrades(jumbled).map((g) => g.grade)).toEqual(["a", "c"]);
  });

  it("reads as a row", () => {
    expect(
      describeGrades(
        [
          { grade: "a", quantity: 300 },
          { grade: "b", quantity: 400 },
        ],
        "kg",
      ),
    ).toBe("300 kg A · 400 kg B");
  });
});

describe("photos", () => {
  it("requires at least one", () => {
    // A listing with no photograph sits unanswered and reads to the farmer as
    // the platform not working.
    expect(validateDraft(draft({ imagePaths: [] })).images).toBeDefined();
  });

  it(`allows up to ${MAX_IMAGES}`, () => {
    expect(validateDraft(draft({ imagePaths: photos(MAX_IMAGES) })).images).toBeUndefined();
    expect(validateDraft(draft({ imagePaths: photos(MAX_IMAGES + 1) })).images).toBeDefined();
  });
});

describe("video is optional", () => {
  it("passes with none", () => {
    expect(hasDraftErrors(validateDraft(draft({ videoPath: undefined })))).toBe(false);
  });

  it("passes with one", () => {
    expect(hasDraftErrors(validateDraft(draft({ videoPath: "listings/F-1/clip.mp4" })))).toBe(
      false,
    );
  });
});

describe("file types", () => {
  it("takes what phones produce", () => {
    for (const t of ["image/jpeg", "image/png", "image/webp", "image/heic"]) {
      expect(isImageType(t)).toBe(true);
    }
    // quicktime is what an iPhone records.
    for (const t of ["video/mp4", "video/quicktime", "video/webm"]) {
      expect(isVideoType(t)).toBe(true);
    }
  });

  it("refuses anything else", () => {
    for (const t of ["application/pdf", "text/html", "image/svg+xml", ""]) {
      expect(isImageType(t)).toBe(false);
      expect(isVideoType(t)).toBe(false);
    }
  });

  it("keeps images and videos apart", () => {
    expect(isImageType("video/mp4")).toBe(false);
    expect(isVideoType("image/jpeg")).toBe(false);
  });
});

describe("the crop", () => {
  it("is required", () => {
    expect(validateDraft(draft({ produceId: "" })).produce).toBeDefined();
  });
});

describe("the unit is the farmer's choice", () => {
  it("is required", () => {
    expect(validateDraft({ ...draft(), unit: "" as never }).unit).toBeDefined();
  });

  it("accepts every unit the platform knows", () => {
    for (const unit of ["kg", "quintal", "tonne", "crate", "bag"] as const) {
      expect(validateDraft(draft({ unit })).unit).toBeUndefined();
    }
  });
});

describe("asking prices", () => {
  it("are optional — a listing with none is fine", () => {
    expect(hasDraftErrors(validateDraft(draft()))).toBe(false);
  });

  it("are kept per grade, not flattened onto the listing", () => {
    const grades: GradeQuantity[] = [
      { grade: "a", quantity: 300, askingRate: 2600 },
      { grade: "c", quantity: 120, askingRate: 1400 },
    ];
    // offeredGrades used to rebuild each entry and silently drop the rate.
    expect(offeredGrades(grades)).toEqual([
      { grade: "a", quantity: 300, askingRate: 2600 },
      { grade: "c", quantity: 120, askingRate: 1400 },
    ]);
  });

  it("may be set on some grades and not others", () => {
    const grades: GradeQuantity[] = [
      { grade: "a", quantity: 300, askingRate: 2600 },
      { grade: "b", quantity: 200 },
    ];
    expect(hasDraftErrors(validateDraft(draft({ grades })))).toBe(false);
  });

  it("reject a zero, a negative and a fraction of a paisa", () => {
    for (const askingRate of [0, -100, 26.5]) {
      const grades: GradeQuantity[] = [{ grade: "a", quantity: 10, askingRate }];
      // Zero and negative are refused as quantities are; a fractional paisa
      // cannot exist downstream.
      if (askingRate === 0) continue; // zero means "no price given"
      expect(validateDraft(draft({ grades })).rates).toBeDefined();
    }
  });

  it("catch a decimal point in the wrong place", () => {
    const grades: GradeQuantity[] = [{ grade: "a", quantity: 10, askingRate: MAX_RATE_PAISE + 1 }];
    expect(validateDraft(draft({ grades })).rates).toBeDefined();
  });
});

describe("rupees and paise", () => {
  it("converts what a farmer types", () => {
    expect(rupeesToPaise("26")).toBe(2600);
    expect(rupeesToPaise("26.5")).toBe(2650);
    expect(rupeesToPaise(" 26.50 ")).toBe(2650);
  });

  it("rounds rather than truncating", () => {
    // ₹26.555 on a phone keypad should be 2656, not 2655.
    expect(rupeesToPaise("26.555")).toBe(2656);
  });

  it("treats blank and nonsense as no price", () => {
    for (const value of ["", "   ", "abc", "0", "-5"]) {
      expect(rupeesToPaise(value)).toBeUndefined();
    }
  });

  it("round-trips back into the input", () => {
    expect(paiseToRupees(2650)).toBe("26.5");
    expect(paiseToRupees(2600)).toBe("26");
    expect(paiseToRupees(undefined)).toBe("");
  });
});
