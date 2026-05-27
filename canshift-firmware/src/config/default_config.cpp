// default_config.cpp — Embed + write baked-in default configs on first boot.
//
// Symbol naming: PlatformIO's embed_files generates `_binary_<munged_path>`
// where the munged path is the file path with non-identifier characters
// replaced by underscores. Embed sources live under `data/config/` (see
// platformio.ini), giving e.g. `_binary_data_config_dashboard_json_start`.
//
// JSON payloads are linked in via PlatformIO `board_build.embed_files`. Each
// embedded blob exposes `_binary_<munged_path>_start` / `_end` symbols. We
// reference them with `extern "C"` declarations and let the linker fill in
// the addresses (see https://docs.platformio.org/en/latest/platforms/espressif32.html).

#include "default_config.h"

#include "app_config.h"
#include "board_config.h"
#include "config/config_types.h"
#include "diag/error_store.h"
#include "diag/logger.h"
#include "hal/storage/storage_driver.h"

#include <Arduino.h>
#include <string.h>

// Suffix used by writeFileAtomic for the rotated previous version of a file.
// Mirrored from config_loader.cpp's kBakSuffix — kept local here to avoid
// a cross-translation-unit include for a 4-byte constant.
static constexpr const char *kBakSuffix = ".bak";
// CFG_MAX_PATH_LEN + ".bak" (4) + null terminator (1).
static constexpr size_t kBakPathLen = CFG_MAX_PATH_LEN + 5;

// Neither dashboard.json nor signals.json are embedded — both are now hosted
// on canshift-flasher (canshift.tmbk.ch). The user picks an ECU profile and
// a dashboard layout during the USB flash flow; the flasher merges them into
// the SPIFFS image before write. First boot without a dashboard.json shows
// an empty dash and the Studio web (canshift.local) can push one; same for
// signals.json (loadSignals() logs an error and widgets fall back to "--").
// Saves ~25 KB flash (dashboard 17 KB + signals 7 KB) on top of the build's
// other optimisations.

namespace {

struct EmbeddedBlob {
    const char *path;
    const uint8_t *start;
    const uint8_t *end;
    const char *label;
};

// Empty — no embedded baseline configs. Provisioning happens entirely via
// the SPIFFS image uploaded at flash time (carrier of the user's pick) or
// at runtime via Studio web / mobile OTA push.
const EmbeddedBlob kEmbedded[] = {};

bool buildBakPath(char *out, size_t outLen, const char *base) {
    if (!out || !base || outLen == 0)
        return false;
    const size_t baseLen = strlen(base);
    const size_t suffixLen = strlen(kBakSuffix);
    if (baseLen + suffixLen + 1 > outLen)
        return false;
    memcpy(out, base, baseLen);
    memcpy(out + baseLen, kBakSuffix, suffixLen);
    out[baseLen + suffixLen] = '\0';
    return true;
}

// Returns true when `path` should be (re)provisioned with the embedded
// default. Preserves any user data:
//   - missing primary AND missing .bak  → provision
//   - empty primary (size == 0)         → provision
//   - anything else                     → skip
bool needsProvision(const char *path) {
    if (!StorageDriver::fileExists(path)) {
        char bakPath[kBakPathLen];
        if (!buildBakPath(bakPath, sizeof(bakPath), path)) {
            // Path too long for a .bak — fall back to "missing means provision"
            // rather than risk clobbering. CFG_MAX_PATH_LEN already bounds
            // every config path so this branch is defensive only.
            return true;
        }
        return !StorageDriver::fileExists(bakPath);
    }

    // Primary exists — only provision when it's a zero-byte placeholder.
    // Use the heap-free fileSize() probe so a 20 KB existing config doesn't
    // trigger a contiguous malloc(20 KB) on a tight boot heap (issue #576).
    return StorageDriver::fileSize(path) == 0;
}

// Write one embedded blob to its canonical path. Returns true on success.
bool writeOne(const EmbeddedBlob &blob) {
    const size_t length = static_cast<size_t>(blob.end - blob.start);
    if (length == 0) {
        LOG_ERROR("CFG", "Embedded default %s is empty — build misconfigured", blob.label);
        ErrorStore::push(ERROR_SRC_CONFIG, "EMBED_EMPTY", blob.label);
        return false;
    }
    const bool ok = StorageDriver::writeFileAtomic(blob.path, blob.start, length);
    if (!ok) {
        LOG_ERROR("CFG", "Default-provision write failed: %s", blob.path);
        ErrorStore::push(ERROR_SRC_CONFIG, "PROVISION_FAIL", blob.label);
        return false;
    }
    LOG_INFO("CFG", "Provisioned default %s (%u bytes)", blob.label, static_cast<unsigned>(length));
    return true;
}

} // namespace

DefaultConfig::ProvisionResult DefaultConfig::provisionMissingFiles() {
    ProvisionResult result = {0, 0, 0};
    for (const EmbeddedBlob &blob : kEmbedded) {
        if (!needsProvision(blob.path)) {
            ++result.skipped;
            continue;
        }
        if (writeOne(blob)) {
            ++result.written;
        } else {
            ++result.failed;
        }
    }
    return result;
}
