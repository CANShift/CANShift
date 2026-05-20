// image_widget.cpp — Static BMP image widget loaded from SPIFFS
//
// Requires the LVGL SPIFFS FS driver to be registered (lvgl_fs_driver.cpp).
// Images must be stored in SPIFFS under /images/ as 24-bit BMP files.
//
// Path stored in cfg.image.imagePath is a SPIFFS path (e.g. "/images/bg.bmp").
// This is prefixed with "S:" to form the LVGL FS path "S:/images/bg.bmp".

#include "image_widget.h"
#include "app_config.h"
#include "ui/theme_manager.h"
#include "ui/widget_label.h"
#include "ui/widget_styles.h"
#include "ui/widgets/widget_helpers.h"
#include "diag/logger.h"

#include <lvgl.h>
#include <string.h>
#include <stdio.h>

// ---------------------------------------------------------------------------
// Tag (stores the path string used as LVGL img src)
// ---------------------------------------------------------------------------

namespace {

// Maximum LVGL path length including "S:" prefix
static constexpr size_t LVGL_PATH_LEN = 2 + CFG_MAX_PATH_LEN;

struct ImageTag {
    char lvglPath[LVGL_PATH_LEN]; // e.g. "S:/images/bg.bmp"
};

// Fixed-size pool of ImageTag slots (F-HI-2). Sized to the per-page widget
// ceiling so a page of nothing-but-image widgets still fits. Pool bookkeeping
// runs under the LVGL UI task (g_lvglMutex) — no extra synchronisation
// needed for s_slotBusy / s_tagPool.
constexpr size_t kImageTagPoolSize = CONFIG_MAX_WIDGETS_PER_PAGE;
ImageTag s_tagPool[kImageTagPoolSize];
bool s_slotBusy[kImageTagPoolSize] = {};

ImageTag *allocTag() {
    for (size_t i = 0; i < kImageTagPoolSize; ++i) {
        if (!s_slotBusy[i]) {
            s_slotBusy[i] = true;
            s_tagPool[i] = ImageTag{};
            return &s_tagPool[i];
        }
    }
    return nullptr;
}

void releaseTag(ImageTag *tag) {
    for (size_t i = 0; i < kImageTagPoolSize; ++i) {
        if (&s_tagPool[i] == tag) {
            s_slotBusy[i] = false;
            return;
        }
    }
}

void imageTagDeleteHandler(lv_event_t *e) {
    auto *t = static_cast<ImageTag *>(lv_event_get_user_data(e));
    if (t)
        releaseTag(t);
}

} // namespace

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

lv_obj_t *ImageWidget::create(lv_obj_t *parent, const CfgWidget &cfg, int16_t yOffset) {
    lv_obj_t *cont = lv_obj_create(parent);
    lv_obj_set_pos(cont, cfg.layout.x, cfg.layout.y + yOffset);
    lv_obj_set_size(cont, cfg.layout.w, cfg.layout.h);
    lv_obj_clear_flag(cont, LV_OBJ_FLAG_SCROLLABLE);
    WidgetStyles::applyContainerBaseNoBorder(cont);

    if (cfg.image.imagePath[0] == '\0') {
        LOG_WARN("IMG", "Image widget has no imagePath — skipping");
        return cont;
    }

    // Build LVGL FS path: "S:" + SPIFFS path
    // SPIFFS path already has leading slash (e.g. "/images/bg.bmp")
    ImageTag *tag = allocTag();
    if (!tag) {
        LOG_WARN("IMG", "Tag pool exhausted for '%s' (all %u slots busy)", cfg.id,
                 static_cast<unsigned>(kImageTagPoolSize));
        return cont;
    }
    snprintf(tag->lvglPath, sizeof(tag->lvglPath), "S:%s", cfg.image.imagePath);

    lv_obj_t *img = lv_img_create(cont);
    lv_img_set_src(img, tag->lvglPath);
    lv_obj_align(img, LV_ALIGN_CENTER, 0, 0);

    // Scale image to fit widget dimensions (LVGL 8.3 integer scale factor)
    // lv_img_set_zoom uses 256 = 1:1. Scale to fit if needed.
    lv_obj_set_user_data(cont, tag);
    lv_obj_add_event_cb(cont, imageTagDeleteHandler, LV_EVENT_DELETE, tag);

    // Optional widget label drawn at the configured corner.
    WidgetLabelOverlay::apply(
        cont, cfg.image.label, cfg.image.labelPosition,
        ThemeManager::getEffectiveTextColor(cfg.style.textColor.rgb, cfg.style.respectDayMode));

    LOG_DEBUG("IMG", "Image widget created: %s", tag->lvglPath);
    return cont;
}
