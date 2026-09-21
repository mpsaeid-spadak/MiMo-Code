import { describe, expect, test } from "bun:test"
import path from "path"
import { resolveSpadakcodeHome } from "@spadak/shared/global"

describe("resolveSpadakcodeHome", () => {
  test("with SPADAKCODE_HOME set, resolves 4 subdirs under root", () => {
    const result = resolveSpadakcodeHome({
      SPADAKCODE_HOME: "/tmp/profile-a",
    })
    expect(result.mode).toBe("spadakcode_home")
    expect(result.root).toBe("/tmp/profile-a")
    expect(result.config).toBe(path.join("/tmp/profile-a", "config"))
    expect(result.data).toBe(path.join("/tmp/profile-a", "data"))
    expect(result.state).toBe(path.join("/tmp/profile-a", "state"))
    expect(result.cache).toBe(path.join("/tmp/profile-a", "cache"))
  })

  test("without SPADAKCODE_HOME, falls through to xdg mode", () => {
    const result = resolveSpadakcodeHome({})
    expect(result.mode).toBe("xdg")
    expect(result.root).toBeUndefined()
    // xdg paths end with "/spadakcode"
    expect(result.config.endsWith(path.join("", "spadakcode"))).toBe(true)
    expect(result.data.endsWith(path.join("", "spadakcode"))).toBe(true)
    expect(result.state.endsWith(path.join("", "spadakcode"))).toBe(true)
    expect(result.cache.endsWith(path.join("", "spadakcode"))).toBe(true)
  })

  test("empty SPADAKCODE_HOME string is treated as unset (xdg mode)", () => {
    const result = resolveSpadakcodeHome({ SPADAKCODE_HOME: "" })
    expect(result.mode).toBe("xdg")
  })

  test("relative SPADAKCODE_HOME path throws with clear error", () => {
    expect(() => resolveSpadakcodeHome({ SPADAKCODE_HOME: "./foo" })).toThrow(
      /SPADAKCODE_HOME must be an absolute path/,
    )
    expect(() => resolveSpadakcodeHome({ SPADAKCODE_HOME: "foo/bar" })).toThrow(
      /SPADAKCODE_HOME must be an absolute path/,
    )
  })

  test("tilde-prefixed SPADAKCODE_HOME throws (not treated as absolute)", () => {
    expect(() => resolveSpadakcodeHome({ SPADAKCODE_HOME: "~/profiles/a" })).toThrow(
      /SPADAKCODE_HOME must be an absolute path/,
    )
  })

  test("error message includes the offending value", () => {
    expect(() => resolveSpadakcodeHome({ SPADAKCODE_HOME: "./relative" })).toThrow(
      /\.\/relative/,
    )
  })
})
