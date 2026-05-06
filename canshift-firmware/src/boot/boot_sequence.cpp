// boot_sequence.cpp — Power-on initialization sequence

#include "boot_sequence.h"
#include "app_config.h"
#include "board_config.h"

#include "diag/logger.h"
#include "hal/display/display_driver.h"
#include "hal/touch/touch_driver.h"
#include "hal/storage/storage_driver.h"
#include "hal/storage/lvgl_fs_driver.h"
#include "hal/usb/usb_comm.h"
#include "config/config_loader.h"
#include "runtime/signal_store.h"
#include "runtime/alert_engine.h"
#include "ui/page_manager.h"
#include "ui/theme_manager.h"
#include "ui/font_manager.h"

#if !APP_SIMULATION_MODE
    #include "can/can_manager.h"
#endif

#include <Arduino.h>
#include <esp_heap_caps.h>
#include <lvgl.h>

// Diagnostic — log free heap and largest contiguous block at a named boot stage.
// Helps pinpoint memory pressure without needing a debugger.
static void logHeap(const char *stage) {
    const uint32_t free = ESP.getFreeHeap();
    const uint32_t largest = heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);
    LOG_INFO("HEAP", "%s: free=%u largest=%u", stage,
             static_cast<unsigned>(free), static_cast<unsigned>(largest));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

static void initDisplayAndLVGL() {
    LOG_INFO("BOOT", "Initializing display...");
    DisplayDriver::init();

    LOG_INFO("BOOT", "Initializing LVGL...");
    lv_init();
    DisplayDriver::registerWithLVGL();

    LOG_INFO("BOOT", "Display + LVGL ready");
}

// Boot screen is intentionally minimal: black background while init runs
// (~1.5 s), then the dashboard takes over. The previous splash with logo +
// progress bar was removed at the user's request — felt cluttered for the
// short boot duration.

static void paintBlackBackground() {
    lv_obj_t *scr = lv_scr_act();
    lv_obj_set_style_bg_color(scr, lv_color_hex(0x000000), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_clear_flag(scr, LV_OBJ_FLAG_SCROLLABLE);
    lv_task_handler();
}

// Shown when the SD card is absent or fails to mount.
// Halts — the dashboard cannot run without the SD card.
static void showSDError() {
    paintBlackBackground();
    lv_obj_t *scr = lv_scr_act();

    lv_obj_t *icon = lv_label_create(scr);
    lv_label_set_text(icon, "!");
    lv_obj_set_style_text_color(icon, lv_color_hex(0xFF4444), 0);
    lv_obj_align(icon, LV_ALIGN_CENTER, 0, 10);

    lv_obj_t *msg = lv_label_create(scr);
    lv_label_set_text(msg, "SD card missing\nInsert SD and restart");
    lv_obj_set_style_text_color(msg, lv_color_hex(0xCCCCCC), 0);
    lv_label_set_long_mode(msg, LV_LABEL_LONG_WRAP);
    lv_obj_set_width(msg, 280);
    lv_obj_set_style_text_align(msg, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(msg, LV_ALIGN_CENTER, 0, 40);

    lv_task_handler();
    LOG_ERROR("BOOT", "SD card missing — dashboard halted");

    while (true) {
        lv_task_handler();
        delay(100);
    }
}

// Returns false if SD is absent — caller must halt.
static bool initStorage() {
    LOG_INFO("BOOT", "Initializing SD card...");
    if (!StorageDriver::init()) {
        return false;
    }
    LvglFsDriver::init();
    FontManager::init();
    return true;
}

static void loadConfig() {
    LOG_INFO("BOOT", "Loading configuration...");
    ConfigLoader::LoadResult result = ConfigLoader::loadAll();

    if (!result.dashboardOk) {
        LOG_WARN("BOOT", "dashboard.json missing or invalid — using built-in defaults");
    }
    if (!result.signalsOk) {
        LOG_WARN("BOOT", "signals.json missing or invalid — CAN parsing disabled");
    }
}

static void buildUI() {
    LOG_INFO("BOOT", "Building UI...");
    ThemeManager::apply();
    PageManager::init();
    PageManager::navigateTo(PageManager::getDefaultPageId());
    LOG_INFO("BOOT", "UI ready");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

void BootSequence::run() {
    logHeap("entry");
    // 1. Display + LVGL must come early so the screen is at least black
    initDisplayAndLVGL();
    logHeap("after lv_init");
    paintBlackBackground();

    // 2. Touch controller
    LOG_INFO("BOOT", "Initializing touch...");
    TouchDriver::init();

    // 3. Storage — fatal if SD missing
    if (!initStorage()) {
        showSDError(); // halts
    }

    // 4. Config
    logHeap("before loadConfig");
    loadConfig();
    logHeap("after loadConfig");

    // 5. Runtime
    SignalStore::init();
    AlertEngine::init();

    // 6. CAN hardware (skip in simulation mode)
#if !APP_SIMULATION_MODE
    LOG_INFO("BOOT", "Initializing CAN/TWAI...");
    CanManager::initHardware();
#else
    LOG_INFO("BOOT", "Simulation mode — skipping CAN init");
#endif

    // 7. USB comm
    LOG_INFO("BOOT", "Initializing USB comm...");
    UsbComm::init();

    // 8. Build the UI from config
    logHeap("before buildUI");
    buildUI();
    logHeap("after buildUI");

    LOG_INFO("BOOT", "Boot sequence complete");
}
