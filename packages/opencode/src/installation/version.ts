import semver from "semver"

declare global {
  const SPADAKCODE_VERSION: string
  const SPADAKCODE_CHANNEL: string
}

export const InstallationVersion = typeof SPADAKCODE_VERSION === "string" ? SPADAKCODE_VERSION : "local"
export const InstallationChannel = typeof SPADAKCODE_CHANNEL === "string" ? SPADAKCODE_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"

// InstallationVersion is an install identity (local / desktop-<hash> / release semver),
// not an npm dist-tag. /plugin installs only pin when that identity is a valid
// semver string; otherwise omit the version so npm resolves latest.
export function pluginSdkNpmVersion(version: string, local: boolean): string | undefined {
  if (local) return undefined
  return semver.valid(version) ? version : undefined
}

export const PluginSdkNpmVersion = pluginSdkNpmVersion(InstallationVersion, InstallationLocal)
