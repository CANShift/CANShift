// top_bar.cpp — Persistent top status bar
//
// Layout (left to right):
//   [• ECU]  [• CAN]  ......  PAGE NAME  ......  12.4V  ↓  ☀  ⚙
//
// Status sources:
//   ECU dot:  green when SignalIds::RPM is valid (recent ECU frame received)
//   CAN dot:  green when at least one signal has been received recently
//   Voltage:  SignalIds::BATTERY_VOLTS — formatted "12.4V" (— if unknown)
//   Page:     PageManager::getCurrentPageId(), uppercased
//   Download: green when UsbComm reports a recent host command (studio attached)

#include "top_bar.h"
#include "ui/font_manager.h"
#include "ui/page_manager.h"
#include "settings_page.h"
#include "theme_manager.h"
#include "config/config_loader.h"
#include "runtime/signal_store.h"
#include "can/signal_map.h"
#include "hal/usb/usb_comm.h"
#include "diag/logger.h"

#include <lvgl.h>
#include <ctype.h>
#include <stdio.h>

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

static lv_obj_t *s_bar = nullptr;

static lv_obj_t *s_ecuDot = nullptr;
static lv_obj_t *s_ecuLabel = nullptr;
static lv_obj_t *s_canDot = nullptr;
static lv_obj_t *s_canLabel = nullptr;

static lv_obj_t *s_pageLabel = nullptr;
static lv_obj_t *s_voltageLabel = nullptr;
static lv_obj_t *s_usbIcon = nullptr;

static lv_obj_t *s_themeBtn = nullptr;
static lv_obj_t *s_themeLabel = nullptr;
static lv_obj_t *s_gearBtn = nullptr;
static lv_obj_t *s_gearLabel = nullptr;

static int16_t s_height = 30;

static constexpr char ICON_SUN[]  = "\xE2\x98\x80"; // ☀
static constexpr char ICON_MOON[] = "\xE2\x98\xBE"; // ☾

static constexpr uint32_t COLOR_DOT_OK   = 0x33CC44;
static constexpr uint32_t COLOR_DOT_DOWN = 0x444444;
static constexpr uint32_t COLOR_LABEL    = 0xCCCCCC;
static constexpr uint32_t COLOR_MUTED    = 0x666666;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

static lv_obj_t *makeStatusDot(lv_obj_t *parent) {
    lv_obj_t *dot = lv_obj_create(parent);
    lv_obj_set_size(dot, 8, 8);
    lv_obj_set_style_radius(dot, LV_RADIUS_CIRCLE, LV_PART_MAIN);
    lv_obj_set_style_border_width(dot, 0, LV_PART_MAIN);
    lv_obj_set_style_pad_all(dot, 0, LV_PART_MAIN);
    lv_obj_set_style_bg_color(dot, lv_color_hex(COLOR_DOT_DOWN), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(dot, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_clear_flag(dot, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_clear_flag(dot, LV_OBJ_FLAG_CLICKABLE);
    return dot;
}

static lv_obj_t *makeBarLabel(lv_obj_t *parent, const char *text, uint32_t color) {
    lv_obj_t *lbl = lv_label_create(parent);
    lv_label_set_text(lbl, text);
    lv_obj_set_style_text_color(lbl, lv_color_hex(color), 0);
    lv_obj_set_style_text_font(lbl, FontManager::get(12), 0);
    return lbl;
}

static void uppercaseCopy(char *dst, size_t dstLen, const char *src) {
    if (dstLen == 0) return;
    size_t i = 0;
    for (; src[i] && i + 1 < dstLen; i++) {
        dst[i] = static_cast<char>(toupper(static_cast<unsigned char>(src[i])));
    }
    dst[i] = '\0';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

void TopBar::init() {
    const CfgDashboard &dash = ConfigLoader::getDashboardConfig();
    const CfgTopBar &cfg = dash.topBar;
    s_height = cfg.height > 0 ? cfg.height : 30;

    s_bar = lv_obj_create(lv_layer_top());
    lv_obj_set_size(s_bar, LV_HOR_RES, s_height);
    lv_obj_align(s_bar, LV_ALIGN_TOP_MID, 0, 0);
    lv_obj_set_style_bg_color(s_bar, lv_color_hex(cfg.bgColor.rgb), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(s_bar, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_border_width(s_bar, 0, LV_PART_MAIN);
    lv_obj_set_style_radius(s_bar, 0, LV_PART_MAIN);
    lv_obj_set_style_pad_all(s_bar, 4, LV_PART_MAIN);
    lv_obj_clear_flag(s_bar, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_clear_flag(s_bar, LV_OBJ_FLAG_CLICKABLE);

    // ---- Left: ECU + CAN status indicators ----
    s_ecuDot = makeStatusDot(s_bar);
    lv_obj_align(s_ecuDot, LV_ALIGN_LEFT_MID, 0, 0);

    s_ecuLabel = makeBarLabel(s_bar, "ECU", COLOR_LABEL);
    lv_obj_align_to(s_ecuLabel, s_ecuDot, LV_ALIGN_OUT_RIGHT_MID, 4, 0);

    s_canDot = makeStatusDot(s_bar);
    lv_obj_align_to(s_canDot, s_ecuLabel, LV_ALIGN_OUT_RIGHT_MID, 8, 0);

    s_canLabel = makeBarLabel(s_bar, "CAN", COLOR_LABEL);
    lv_obj_align_to(s_canLabel, s_canDot, LV_ALIGN_OUT_RIGHT_MID, 4, 0);

    // ---- Center: current page name ----
    s_pageLabel = makeBarLabel(s_bar, "", COLOR_LABEL);
    lv_obj_align(s_pageLabel, LV_ALIGN_CENTER, 0, 0);

    // ---- Right cluster: gear (rightmost), theme, usb icon, voltage ----
    s_gearBtn = lv_btn_create(s_bar);
    lv_obj_set_size(s_gearBtn, s_height - 4, s_height - 4);
    lv_obj_align(s_gearBtn, LV_ALIGN_RIGHT_MID, 0, 0);
    lv_obj_set_style_bg_opa(s_gearBtn, LV_OPA_TRANSP, LV_PART_MAIN);
    lv_obj_set_style_border_width(s_gearBtn, 0, LV_PART_MAIN);
    lv_obj_set_style_shadow_width(s_gearBtn, 0, LV_PART_MAIN);
    lv_obj_set_style_pad_all(s_gearBtn, 0, LV_PART_MAIN);
    s_gearLabel = lv_label_create(s_gearBtn);
    lv_label_set_text(s_gearLabel, LV_SYMBOL_SETTINGS);
    lv_obj_set_style_text_color(s_gearLabel, lv_color_hex(COLOR_LABEL), 0);
    lv_obj_center(s_gearLabel);
    lv_obj_add_event_cb(
        s_gearBtn,
        [](lv_event_t * /*e*/) {
            LOG_INFO("UI", "Gear/close button clicked");
            bool nowOpen = SettingsPage::toggle();
            lv_label_set_text(s_gearLabel, nowOpen ? LV_SYMBOL_CLOSE : LV_SYMBOL_SETTINGS);
            lv_obj_set_style_text_color(s_gearLabel,
                                        lv_color_hex(nowOpen ? 0xCC3333 : COLOR_LABEL), 0);
        },
        LV_EVENT_CLICKED, nullptr);

    s_themeBtn = lv_btn_create(s_bar);
    lv_obj_set_size(s_themeBtn, s_height - 4, s_height - 4);
    lv_obj_align(s_themeBtn, LV_ALIGN_RIGHT_MID, -(s_height - 2), 0);
    lv_obj_set_style_bg_opa(s_themeBtn, LV_OPA_TRANSP, LV_PART_MAIN);
    lv_obj_set_style_border_width(s_themeBtn, 0, LV_PART_MAIN);
    lv_obj_set_style_shadow_width(s_themeBtn, 0, LV_PART_MAIN);
    lv_obj_set_style_pad_all(s_themeBtn, 0, LV_PART_MAIN);
    s_themeLabel = lv_label_create(s_themeBtn);
    lv_label_set_text(s_themeLabel, ThemeManager::isDayMode() ? ICON_MOON : ICON_SUN);
    lv_obj_set_style_text_color(s_themeLabel, lv_color_hex(COLOR_LABEL), 0);
    lv_obj_center(s_themeLabel);
    if (dash.hasDayTheme) {
        lv_obj_add_event_cb(
            s_themeBtn,
            [](lv_event_t * /*e*/) { ThemeManager::toggleDayMode(); },
            LV_EVENT_CLICKED, nullptr);
    } else {
        lv_obj_add_flag(s_themeBtn, LV_OBJ_FLAG_HIDDEN);
    }

    // USB / download icon — left of the theme button
    s_usbIcon = lv_label_create(s_bar);
    lv_label_set_text(s_usbIcon, LV_SYMBOL_DOWNLOAD);
    lv_obj_set_style_text_color(s_usbIcon, lv_color_hex(COLOR_DOT_DOWN), 0);
    lv_obj_set_style_text_font(s_usbIcon, FontManager::get(12), 0);
    lv_obj_align(s_usbIcon, LV_ALIGN_RIGHT_MID, -(s_height * 2), 0);

    // Voltage — left of the USB icon
    s_voltageLabel = makeBarLabel(s_bar, "--.-V", COLOR_LABEL);
    lv_obj_align(s_voltageLabel, LV_ALIGN_RIGHT_MID, -(s_height * 2 + 22), 0);

    SettingsPage::init(s_height, static_cast<int16_t>(LV_VER_RES - s_height));

    LOG_INFO("UI", "Top bar initialized (height=%dpx)", s_height);
}

void TopBar::reapplyTheme() {
    if (!s_bar) return;
    const CfgTopBar &cfg = ConfigLoader::getDashboardConfig().topBar;
    lv_obj_set_style_bg_color(s_bar, lv_color_hex(cfg.bgColor.rgb), LV_PART_MAIN);
    if (s_themeLabel) {
        lv_label_set_text(s_themeLabel, ThemeManager::isDayMode() ? ICON_MOON : ICON_SUN);
    }
}

void TopBar::update() {
    if (!s_bar) return;

    // ECU dot — green when RPM (or another canonical ECU signal) is valid
    if (s_ecuDot) {
        const bool ecuOk = SignalStore::isValid(SignalIds::RPM);
        lv_obj_set_style_bg_color(s_ecuDot,
                                  lv_color_hex(ecuOk ? COLOR_DOT_OK : COLOR_DOT_DOWN),
                                  LV_PART_MAIN);
    }

    // CAN dot — green when any of a few well-known signals is valid
    if (s_canDot) {
        const bool canOk = SignalStore::isValid(SignalIds::RPM)
                        || SignalStore::isValid(SignalIds::COOLANT_TEMP_C)
                        || SignalStore::isValid(SignalIds::BATTERY_VOLTS);
        lv_obj_set_style_bg_color(s_canDot,
                                  lv_color_hex(canOk ? COLOR_DOT_OK : COLOR_DOT_DOWN),
                                  LV_PART_MAIN);
    }

    // Page name — uppercase the current page id
    if (s_pageLabel) {
        const char *pageId = PageManager::getCurrentPageId();
        if (pageId) {
            char buf[16];
            uppercaseCopy(buf, sizeof(buf), pageId);
            lv_label_set_text(s_pageLabel, buf);
        }
    }

    // Voltage — show "--.-V" while the signal is timed out
    if (s_voltageLabel) {
        if (SignalStore::isValid(SignalIds::BATTERY_VOLTS)) {
            float v = SignalStore::read(SignalIds::BATTERY_VOLTS, 0.0f);
            char buf[8];
            snprintf(buf, sizeof(buf), "%.1fV", v);
            lv_label_set_text(s_voltageLabel, buf);
            lv_obj_set_style_text_color(s_voltageLabel, lv_color_hex(COLOR_LABEL), 0);
        } else {
            lv_label_set_text(s_voltageLabel, "--.-V");
            lv_obj_set_style_text_color(s_voltageLabel, lv_color_hex(COLOR_MUTED), 0);
        }
    }

    // USB icon — green when the studio host has been active recently
    if (s_usbIcon) {
        const bool active = UsbComm::isHostActive();
        lv_obj_set_style_text_color(s_usbIcon,
                                    lv_color_hex(active ? COLOR_DOT_OK : COLOR_DOT_DOWN), 0);
    }
}

int16_t TopBar::getHeight() {
    return s_height;
}
