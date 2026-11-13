import test from "node:test";
import assert from "node:assert/strict";
import {
    calculateWorkedSeconds,
    computeDetails,
    formatDuration,
    formatRemaining,
    parseTimeStr,
    validateConfig,
} from "../src/utils/time.js";

/** 2026-11-13（周五）的某个时刻，避免依赖当前时间 */
const at = (hour, minute, second = 0) =>
    new Date(2026, 10, 13, hour, minute, second);

const DAY = {
    startTime: "09:00",
    endTime: "18:00",
    restStart: "12:00",
    restEnd: "13:00",
};
const NIGHT = {
    startTime: "22:00",
    endTime: "06:00",
    restStart: "02:00",
    restEnd: "03:00",
};

test("parseTimeStr 只接受合法的 HH:MM", () => {
    assert.deepEqual(parseTimeStr("09:30"), { hour: 9, minute: 30 });
    assert.deepEqual(parseTimeStr("9:05"), { hour: 9, minute: 5 });
    assert.deepEqual(parseTimeStr(" 23:59 "), { hour: 23, minute: 59 });
    for (const bad of ["", "24:00", "12:60", "12", "12:5", "abc", null]) {
        assert.equal(parseTimeStr(bad), null, `${bad} 应被拒绝`);
    }
});

test("白天班：状态随时间正确切换（回归：不再卡在首屏状态）", () => {
    const before = computeDetails(at(8, 59), DAY.startTime, DAY.endTime);
    const working = computeDetails(at(9, 0), DAY.startTime, DAY.endTime);
    const off = computeDetails(at(18, 0), DAY.startTime, DAY.endTime);
    const evening = computeDetails(at(20, 0), DAY.startTime, DAY.endTime);

    assert.equal(before.status, "未上班");
    assert.equal(working.status, "上班中");
    assert.equal(off.status, "已下班");
    assert.equal(evening.status, "已下班");

    // 未上班时倒计时指向当天的下班时间
    assert.equal(
        (before.nextEnd - at(8, 59)) / 1000,
        9 * 3600 + 60,
    );
    // 上班中时倒计时指向当前班次结束
    assert.equal((working.shiftEnd - at(9, 0)) / 1000, 9 * 3600);
});

test("跨零点夜班：凌晨仍处于上班中，早上下班后为未上班", () => {
    const midnightShift = computeDetails(
        at(2, 0),
        NIGHT.startTime,
        NIGHT.endTime,
    );
    assert.equal(midnightShift.status, "上班中");
    assert.equal(midnightShift.shiftStart.getDate(), 12); // 昨天 22:00 开始
    assert.equal(midnightShift.shiftEnd.getHours(), 6);

    const afterShift = computeDetails(
        at(7, 0),
        NIGHT.startTime,
        NIGHT.endTime,
    );
    assert.equal(afterShift.status, "未上班");
    assert.equal(afterShift.nextEnd.getDate(), 14); // 明早 06:00
    assert.equal(afterShift.nextEnd.getHours(), 6);

    const lateNight = computeDetails(
        at(23, 0),
        NIGHT.startTime,
        NIGHT.endTime,
    );
    assert.equal(lateNight.status, "上班中");
});

test("已工作时长：扣除午休，且午休中即时停算", () => {
    const shiftStart = at(9, 0);
    const shiftEnd = at(18, 0);
    const worked = (hour, minute) =>
        calculateWorkedSeconds(
            at(hour, minute),
            shiftStart,
            shiftEnd,
            DAY.restStart,
            DAY.restEnd,
        );

    assert.equal(worked(8, 0), 0); // 上班前
    assert.equal(worked(10, 0), 3600);
    assert.equal(worked(12, 0), 3 * 3600);
    assert.equal(worked(12, 30), 3 * 3600); // 午休中不再增长
    assert.equal(worked(13, 30), 3.5 * 3600);
    assert.equal(worked(20, 0), 8 * 3600); // 封顶到下班
});

test("夜班午休落在次日也能正确扣除", () => {
    const details = computeDetails(at(2, 0), NIGHT.startTime, NIGHT.endTime);
    const seconds = calculateWorkedSeconds(
        at(4, 0),
        details.shiftStart,
        details.shiftEnd,
        NIGHT.restStart,
        NIGHT.restEnd,
    );
    assert.equal(seconds, 5 * 3600); // 22:00→04:00 共 6h，扣掉 02:00→03:00
});

test("配置校验：跨零点与午休越界", () => {
    assert.deepEqual(validateConfig(DAY), {
        timeConflict: false,
        restOutOfRange: false,
    });
    assert.equal(
        validateConfig({ ...DAY, endTime: "08:00" }).timeConflict,
        true,
    );
    assert.equal(
        validateConfig({ ...DAY, restStart: "08:00", restEnd: "09:00" })
            .restOutOfRange,
        true,
    );
    // 夜班配置本身合法，午休也在班次内
    assert.deepEqual(validateConfig(NIGHT), {
        timeConflict: true,
        restOutOfRange: false,
    });
    // 白班配白天午休，对夜班来说属于越界
    assert.equal(
        validateConfig({ ...NIGHT, restStart: "12:00", restEnd: "13:00" })
            .restOutOfRange,
        true,
    );
});

test("时长格式化", () => {
    assert.equal(formatDuration(0), "0小时0分0秒");
    assert.equal(formatDuration(90061), "1天1小时1分1秒");
    assert.equal(formatRemaining(-1000), "0小时0分0秒");
    assert.equal(formatRemaining(3_600_000), "1小时0分0秒");
});
