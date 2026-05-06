// touch_driver.cpp — XPT2046 resistive touch HAL (LovyanGFX backend)
// In sim mode: dummy input device that always reports "released".
// In hardware mode: XPT2046 via the shared LGFX panel.
// Calibration data persisted in NVS (namespace "touch", key "cal", 16 bytes).

#include "touch_driver.h"
#include "app_config.h"
#include "diag/logger.h"

#include <lvgl.h>

static lv_indev_drv_t s_indevDrv;

#if !APP_SIMULATION_MODE

    #include "board_config.h"
    #include "hardware_profile.h"
    #include "hal/display/display_driver.h"
    #include <Preferences.h>

    #define s_lcd DisplayDriver::getDisplay()

static constexpr char NVS_NS[]        = "touch";
static constexpr char NVS_KEY_CAL[]   = "cal";
// LovyanGFX calibration: 8 uint16_t (4 corner pairs). Old TFT_eSPI builds
// stored 10 bytes (5 uint16_t) — those entries fail this size check and
// fall back to defaults, prompting the user to recalibrate once.
static constexpr size_t CAL_DATA_SIZE = 8 * sizeof(uint16_t); // 16 bytes

void TouchDriver::readCallback(lv_indev_drv_t * /*drv*/, lv_indev_data_t *data) {
    int32_t x = 0, y = 0;
    const bool pressed = s_lcd.getTouch(&x, &y);

    if (pressed) {
        data->point.x = static_cast<lv_coord_t>(x);
        data->point.y = static_cast<lv_coord_t>(y);
        data->state = LV_INDEV_STATE_PRESSED;
    } else {
        data->state = LV_INDEV_STATE_RELEASED;
    }
}

void TouchDriver::init() {
    LOG_INFO("TOUCH", "Initializing touch controller...");

    Preferences p;
    p.begin(NVS_NS, /*readOnly=*/true);
    if (p.getBytesLength(NVS_KEY_CAL) == CAL_DATA_SIZE) {
        uint16_t calData[8] = {};
        p.getBytes(NVS_KEY_CAL, calData, CAL_DATA_SIZE);
        p.end();
        s_lcd.setTouchCalibrate(calData);
        LOG_INFO("TOUCH", "Calibration loaded from NVS");
    } else {
        p.end();
        LOG_WARN("TOUCH",
                 "No NVS calibration — touch may be inaccurate. "
                 "Run Settings → Calibrate Touch.");
    }

    lv_indev_drv_init(&s_indevDrv);
    s_indevDrv.type = LV_INDEV_TYPE_POINTER;
    s_indevDrv.read_cb = readCallback;
    s_indevDrv.gesture_limit = 40;
    s_indevDrv.gesture_min_velocity = 3;

    lv_indev_drv_register(&s_indevDrv);
    LOG_INFO("TOUCH", "Touch driver registered");
}

void TouchDriver::poll() {
    // lv_task_handler() calls all registered read callbacks automatically.
}

bool TouchDriver::isCalibrated() {
    Preferences p;
    p.begin(NVS_NS, /*readOnly=*/true);
    const bool has = (p.getBytesLength(NVS_KEY_CAL) == CAL_DATA_SIZE);
    p.end();
    return has;
}

void TouchDriver::calibrate() {
    LOG_INFO("TOUCH", "Starting touch calibration...");
    uint16_t calData[8] = {};
    // LovyanGFX shows 4 corner crosshairs and fills calData[8].
    s_lcd.calibrateTouch(calData, TFT_WHITE, TFT_BLACK, std::max(s_lcd.width(), s_lcd.height()) >> 3);

    Preferences p;
    p.begin(NVS_NS, /*readOnly=*/false);
    p.putBytes(NVS_KEY_CAL, calData, CAL_DATA_SIZE);
    p.end();

    s_lcd.setTouchCalibrate(calData);
    LOG_INFO("TOUCH", "Calibration complete and saved to NVS");
}

void TouchDriver::resetCalibration() {
    Preferences p;
    p.begin(NVS_NS, /*readOnly=*/false);
    p.remove(NVS_KEY_CAL);
    p.end();
    LOG_INFO("TOUCH", "Calibration data cleared from NVS");
}

#else // APP_SIMULATION_MODE

void TouchDriver::readCallback(lv_indev_drv_t * /*drv*/, lv_indev_data_t *data) {
    data->state = LV_INDEV_STATE_RELEASED;
}

void TouchDriver::init() {
    lv_indev_drv_init(&s_indevDrv);
    s_indevDrv.type = LV_INDEV_TYPE_POINTER;
    s_indevDrv.read_cb = readCallback;
    lv_indev_drv_register(&s_indevDrv);
    LOG_INFO("TOUCH", "Sim mode — touch stub active (always released)");
}

void TouchDriver::poll() {}

bool TouchDriver::isCalibrated() { return false; }
void TouchDriver::calibrate() {}
void TouchDriver::resetCalibration() {}

#endif // APP_SIMULATION_MODE
