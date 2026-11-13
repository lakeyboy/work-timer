import test from "node:test";
import assert from "node:assert/strict";
import {
    convertGlassByDay,
    convertGlassByDots,
    convertGlassByMonthCount,
    convertGlassYearOnly,
    formatMonthCN,
    glassYearCandidates,
    isoWeekRange,
    parseTireCode,
} from "../src/utils/carDate.js";

/** 固定"今天"，避免测试结果随当前日期漂移 */
const NOW = new Date(2026, 10, 13);

const isoDate = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

test("轮胎：3523 表示 2023 年第 35 周", () => {
    const result = parseTireCode("3523", NOW);
    assert.equal(result.ok, true);
    assert.equal(result.week, 35);
    assert.equal(result.year, 2023);
    // ISO 第 35 周：2023-08-28（周一）~ 2023-09-03（周日）
    assert.equal(isoDate(result.range.start), "2023-08-28");
    assert.equal(isoDate(result.range.end), "2023-09-03");
    assert.deepEqual(result.warnings, []);
});

test("轮胎：可从完整 DOT 中自动截取后四位", () => {
    const result = parseTireCode("DOT 1AB 3523", NOW);
    assert.equal(result.ok, true);
    assert.equal(result.code, "3523");
    assert.match(result.warnings.join(), /最后 4 位/);
});

test("轮胎：非法输入给出明确原因", () => {
    assert.equal(parseTireCode("", NOW).ok, false);
    assert.match(parseTireCode("123", NOW).error, /至少需要 4 位/);
    assert.match(parseTireCode("5423", NOW).error, /生产周/);
    assert.match(parseTireCode("3527", NOW).error, /年份晚于今年/);
    // 2021 年只有 52 周
    assert.match(parseTireCode("5321", NOW).error, /没有第 53 周/);
});

test("ISO 周范围：跨年与不存在的第 53 周", () => {
    // 2020 年有第 53 周
    const week53 = isoWeekRange(2020, 53);
    assert.equal(isoDate(week53.start), "2020-12-28");
    assert.equal(isoDate(week53.end), "2021-01-03");
    // 2026 年第 1 周从 2025-12-29 开始
    const week1 = isoWeekRange(2026, 1);
    assert.equal(isoDate(week1.start), "2025-12-29");
    assert.equal(isoWeekRange(2021, 53), null);
    assert.equal(isoWeekRange(2026, 0), null);
});

test("玻璃：年份个位候选年份", () => {
    assert.deepEqual(glassYearCandidates(3, 2026), [2023, 2013, 2003, 1993]);
    assert.deepEqual(glassYearCandidates(6, 2026), [2026, 2016, 2006, 1996]);
    assert.deepEqual(glassYearCandidates("x", 2026), []);
});

test("玻璃单排点：点在前用 7 减，点在后用 13 减", () => {
    assert.deepEqual(
        convertGlassByDots({
            yearDigit: 3,
            dots: 2,
            position: "before",
            year: 2023,
        }),
        { ok: true, year: 2023, month: 5 },
    );
    assert.deepEqual(
        convertGlassByDots({
            yearDigit: 3,
            dots: 1,
            position: "after",
            year: 2023,
        }),
        { ok: true, year: 2023, month: 12 },
    );
    assert.equal(
        convertGlassByDots({
            yearDigit: 3,
            dots: 2,
            position: "before",
            year: 2013,
        }).ok,
        true,
    );
    // 年份与个位不一致
    assert.match(
        convertGlassByDots({
            yearDigit: 3,
            dots: 2,
            position: "before",
            year: 2024,
        }).error,
        /不一致/,
    );
    // 点数超范围
    assert.match(
        convertGlassByDots({
            yearDigit: 3,
            dots: 7,
            position: "before",
            year: 2023,
        }).error,
        /1–6/,
    );
});

test("玻璃双排点：月份 + 大点 10 天 + 小点 1 天", () => {
    assert.deepEqual(
        convertGlassByDay({
            monthDots: 5,
            bigDots: 2,
            smallDots: 3,
            year: 2023,
        }),
        { ok: true, year: 2023, month: 5, day: 23 },
    );
    assert.match(
        convertGlassByDay({
            monthDots: 2,
            bigDots: 3,
            smallDots: 1,
            year: 2023,
        }).error,
        /没有 31 日/,
    );
    assert.match(
        convertGlassByDay({
            monthDots: 13,
            bigDots: 0,
            smallDots: 1,
            year: 2023,
        }).error,
        /1–12/,
    );
});

test("玻璃点数即月份：1–12 个点", () => {
    assert.deepEqual(
        convertGlassByMonthCount({ yearDigit: 5, dots: 5, year: 2025 }),
        { ok: true, year: 2025, month: 5 },
    );
    assert.match(
        convertGlassByMonthCount({ yearDigit: 5, dots: 13, year: 2025 })
            .error,
        /1–12/,
    );
    assert.match(
        convertGlassByMonthCount({ yearDigit: 5, dots: 3, year: 2024 })
            .error,
        /不一致/,
    );
});

test("玻璃只有年份数字：只能判断年份", () => {
    assert.deepEqual(convertGlassYearOnly({ yearDigit: 8, year: 2018 }), {
        ok: true,
        year: 2018,
    });
    assert.match(
        convertGlassYearOnly({ yearDigit: 8, year: 2023 }).error,
        /不一致/,
    );
});

test("月份格式化", () => {
    assert.equal(formatMonthCN(2023, 5), "2023年5月");
});
