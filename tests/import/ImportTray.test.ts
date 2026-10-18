import { describe, expect, it } from "vitest";
import { ImportTray } from "../../src/import/ImportTray";

const file = (name: string, content = "x", lastModified = 1) => new File([content], name, { lastModified });

describe("ImportTray", () => {
  it("collects .fit files once each and counts the others", () => {
    const tray = new ImportTray();
    tray.add([file("a.fit"), file("b.FIT"), file("notes.txt")]);
    tray.add([file("a.fit")]); // the same file again
    expect(tray.state.files.map((f) => f.name)).toEqual(["a.fit", "b.FIT"]);
    expect(tray.state.skipped).toBe(1);
  });

  it("keeps two different files of the same name", () => {
    const tray = new ImportTray();
    tray.add([file("ride.fit", "x", 1), file("ride.fit", "xy", 2)]);
    expect(tray.count).toBe(2);
  });

  it("hands everything over on take and is empty afterwards", () => {
    const tray = new ImportTray();
    const changes: number[] = [];
    tray.on("changed", (s) => changes.push(s.files.length));
    tray.add([file("a.fit"), file("b.fit")]);
    tray.remove(tray.state.files[0]!);
    expect(tray.take().map((f) => f.name)).toEqual(["b.fit"]);
    expect(tray.count).toBe(0);
    expect(changes).toEqual([2, 1, 0]);
  });
});
