// burn_overlay.cpp — see header for rationale.

#include "burn_overlay.h"
#include "ui/font_manager.h"

namespace {

lv_obj_t *s_overlay = nullptr;

} // namespace

void BurnOverlay::show() {
    // Re-show is allowed — tear down any previous instance first.
    if (s_overlay) {
        lv_obj_del(s_overlay);
        s_overlay = nullptr;
    }

    // Full-screen container on lv_layer_top so it floats above the active page.
    lv_obj_t *root = lv_obj_create(lv_layer_top());
    lv_obj_set_size(root, LV_HOR_RES, LV_VER_RES);
    lv_obj_set_pos(root, 0, 0);
    lv_obj_clear_flag(root, LV_OBJ_FLAG_SCROLLABLE);
    // Solid black backdrop — read as a deliberate "system busy" state rather
    // than a translucent veil that lets the old config show through and looks
    // like a half-broken render.
    lv_obj_set_style_bg_color(root, lv_color_hex(0x000000), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(root, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_border_width(root, 0, LV_PART_MAIN);
    lv_obj_set_style_radius(root, 0, LV_PART_MAIN);
    lv_obj_set_style_pad_all(root, 0, LV_PART_MAIN);
    // Eat input so the underlying page can't be interacted with mid-write.
    lv_obj_clear_flag(root, LV_OBJ_FLAG_CLICKABLE);

    // Spinner — LVGL's lv_spinner spins on its own (no external anim driver).
    static constexpr int16_t kSpinnerSize = 56;
    lv_obj_t *spinner = lv_spinner_create(root, /*time*/ 1100, /*arc length*/ 80);
    lv_obj_set_size(spinner, kSpinnerSize, kSpinnerSize);
    lv_obj_align(spinner, LV_ALIGN_CENTER, 0, -16);
    // Track ring (dimmer than the indicator)
    lv_obj_set_style_arc_color(spinner, lv_color_hex(0x222222), LV_PART_MAIN);
    lv_obj_set_style_arc_width(spinner, 4, LV_PART_MAIN);
    // Indicator ring — CANShift orange accent, matches the studio modal tone.
    lv_obj_set_style_arc_color(spinner, lv_color_hex(0xE08030), LV_PART_INDICATOR);
    lv_obj_set_style_arc_width(spinner, 4, LV_PART_INDICATOR);

    // Status text
    lv_obj_t *title = lv_label_create(root);
    lv_label_set_text(title, "Saving config…");
    lv_obj_set_style_text_color(title, lv_color_hex(0xFFFFFF), 0);
    lv_obj_set_style_text_font(title, FontManager::get(16), 0);
    lv_obj_align(title, LV_ALIGN_CENTER, 0, 36);

    lv_obj_t *sub = lv_label_create(root);
    lv_label_set_text(sub, "Writing to SD…");
    lv_obj_set_style_text_color(sub, lv_color_hex(0x888888), 0);
    lv_obj_set_style_text_font(sub, FontManager::get(12), 0);
    lv_obj_align(sub, LV_ALIGN_CENTER, 0, 60);

    s_overlay = root;

    // Force a synchronous redraw so the overlay actually paints before the
    // caller starts the long SD write that would otherwise block all
    // rendering for the duration of the transfer.
    lv_refr_now(nullptr);
}

void BurnOverlay::hide() {
    if (!s_overlay)
        return;
    lv_obj_del(s_overlay);
    s_overlay = nullptr;
    lv_refr_now(nullptr);
}
