#include "board_config.h"
#include "config/config_loader.h"
#include "hal/storage/storage_driver.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unity.h>

static char *readFile(const char *path, size_t *lenOut) {
    FILE *f = fopen(path, "rb");
    if (!f) return nullptr;
    fseek(f, 0, SEEK_END);
    long len = ftell(f);
    fseek(f, 0, SEEK_SET);
    char *buf = (char *)malloc((size_t)len + 1);
    fread(buf, 1, (size_t)len, f);
    buf[len] = '\0';
    if (lenOut) *lenOut = (size_t)len;
    fclose(f);
    return buf;
}

void setUp() {}
void tearDown() {}

void test_real_six_page_dashboard_loads() {
    size_t dashLen = 0, sigLen = 0;
    char *dash = readFile("data/config/dashboard.json", &dashLen);
    char *sigs = readFile("data/config/signals.json", &sigLen);
    TEST_ASSERT_NOT_NULL(dash);
    TEST_ASSERT_NOT_NULL(sigs);
    printf("dashboard.json bytes=%zu signals.json bytes=%zu\n", dashLen, sigLen);

    StorageDriver::fakeReset();
    StorageDriver::fakeWrite(CONFIG_PATH_DASHBOARD, dash, dashLen);
    StorageDriver::fakeWrite(CONFIG_PATH_SIGNALS, sigs, sigLen);

    const ConfigLoader::LoadResult result = ConfigLoader::loadAll();
    printf("dashboardOk=%d signalsOk=%d\n", result.dashboardOk ? 1 : 0, result.signalsOk ? 1 : 0);

    const CfgDashboard &d = ConfigLoader::getDashboardConfig();
    printf("loaded=%d pageCount=%u defaultPageId=%s\n", d.loaded ? 1 : 0,
           (unsigned)d.pageCount, d.defaultPageId);
    for (uint8_t i = 0; i < d.pageCount; ++i)
        printf("page[%u] id=%s visible=%d widgets=%u\n", i, d.pages[i].id,
               d.pages[i].visible ? 1 : 0, (unsigned)d.pages[i].widgetCount);

    TEST_ASSERT_TRUE(result.dashboardOk);
    TEST_ASSERT_TRUE(d.loaded);
    TEST_ASSERT_EQUAL_UINT8(6, d.pageCount);
    free(dash);
    free(sigs);
}

int main(int, char **) {
    UNITY_BEGIN();
    RUN_TEST(test_real_six_page_dashboard_loads);
    return UNITY_END();
}
