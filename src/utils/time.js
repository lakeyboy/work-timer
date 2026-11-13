/**
 * 工时计算的纯函数集合。
 * 不依赖 Vue / DOM / 浏览器全局对象，可被组件、单测直接复用。
 */

export const DEFAULT_CONFIG = Object.freeze({
    startTime: "09:00",
    endTime: "18:00",
    restStart: "12:00",
    restEnd: "13:00",
});

/** 解析 "HH:MM"（允许 1~2 位小时），非法返回 null */
export function parseTimeStr(value) {
    if (typeof value !== "string") return null;
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    return { hour, minute };
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function atTime(base, { hour, minute }) {
    const date = new Date(base);
    date.setHours(hour, minute, 0, 0);
    return date;
}

/** 以 base 所在的日期为起点，求该班次的结束时刻（结束早于开始则视为次日） */
function shiftEndAt(base, start, end) {
    const startDate = atTime(base, start);
    const endDate = atTime(base, end);
    if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);
    return endDate;
}

/**
 * 在 shiftStart 这一天附近寻找午休窗口。
 * 同时尝试当天与次日，取与班次重叠最多的一组，兼容夜班与跨零点的午休。
 */
function resolveRestWindow(shiftStart, shiftEnd, restStart, restEnd) {
    let best = null;
    let bestOverlap = 0;
    for (const offset of [0, 1]) {
        const base = addDays(shiftStart, offset);
        const start = atTime(base, restStart);
        let end = atTime(base, restEnd);
        if (end <= start) end = addDays(end, 1);

        const overlap = Math.max(
            0,
            Math.min(end.getTime(), shiftEnd.getTime()) -
                Math.max(start.getTime(), shiftStart.getTime()),
        );
        if (!best || overlap > bestOverlap) {
            best = { start, end };
            bestOverlap = overlap;
        }
    }
    return best;
}

/**
 * 计算某一时刻的班次详情。
 * @returns {{status: '上班中'|'未上班'|'已下班', shiftStart: Date|null, shiftEnd: Date|null, nextEnd: Date|null}|null}
 */
export function computeDetails(now, startStr, endStr) {
    const start = parseTimeStr(startStr);
    const end = parseTimeStr(endStr);
    if (!start || !end) return null;

    // 当前是否正处于某个班次中（考虑昨天跨零点过来的夜班）
    let current = null;
    for (const offset of [-1, 0]) {
        const base = addDays(now, offset);
        const shiftStart = atTime(base, start);
        const shiftEnd = shiftEndAt(base, start, end);
        if (now >= shiftStart && now < shiftEnd) {
            current = { shiftStart, shiftEnd };
            break;
        }
    }

    // 最近一次「下班」时刻，用于未上班时的倒计时
    let nextEnd = null;
    for (const offset of [-1, 0, 1]) {
        const candidate = shiftEndAt(addDays(now, offset), start, end);
        if (candidate > now && (!nextEnd || candidate < nextEnd)) {
            nextEnd = candidate;
        }
    }

    if (current) {
        return {
            status: "上班中",
            shiftStart: current.shiftStart,
            shiftEnd: current.shiftEnd,
            nextEnd: current.shiftEnd,
        };
    }

    const shiftStartToday = atTime(now, start);
    return {
        status: now < shiftStartToday ? "未上班" : "已下班",
        shiftStart: null,
        shiftEnd: null,
        nextEnd,
    };
}

/**
 * 已工作秒数：从班次开始到 now（不超过班次结束），扣掉与午休窗口的重叠部分。
 * now 落在午休中时自然只算到午休开始。
 */
export function calculateWorkedSeconds(
    now,
    shiftStart,
    shiftEnd,
    restStartStr,
    restEndStr,
) {
    if (!shiftStart || !shiftEnd) return 0;
    if (now <= shiftStart) return 0;

    const workedEnd = new Date(
        Math.min(now.getTime(), shiftEnd.getTime()),
    );
    let workedMs = workedEnd.getTime() - shiftStart.getTime();

    const restStart = parseTimeStr(restStartStr);
    const restEnd = parseTimeStr(restEndStr);
    if (restStart && restEnd) {
        const rest = resolveRestWindow(
            shiftStart,
            shiftEnd,
            restStart,
            restEnd,
        );
        const from = Math.max(rest.start.getTime(), shiftStart.getTime());
        const to = Math.min(rest.end.getTime(), workedEnd.getTime());
        workedMs -= Math.max(0, to - from);
    }

    return Math.max(0, Math.floor(workedMs / 1000));
}

/** 校验配置，返回需要提示给用户的警告项 */
export function validateConfig(config) {
    const warnings = { timeConflict: false, restOutOfRange: false };

    const start = parseTimeStr(config.startTime);
    const end = parseTimeStr(config.endTime);
    if (!start || !end) return warnings;

    const base = new Date(2000, 0, 1);
    const shiftStart = atTime(base, start);
    const shiftEnd = shiftEndAt(base, start, end);

    warnings.timeConflict =
        end.hour * 60 + end.minute <= start.hour * 60 + start.minute;

    const restStart = parseTimeStr(config.restStart);
    const restEnd = parseTimeStr(config.restEnd);
    if (restStart && restEnd) {
        const rest = resolveRestWindow(
            shiftStart,
            shiftEnd,
            restStart,
            restEnd,
        );
        warnings.restOutOfRange =
            rest.start < shiftStart || rest.end > shiftEnd;
    }

    return warnings;
}

/** 秒 → "1天2小时3分4秒" */
export function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const dayPart = days > 0 ? `${days}天` : "";
    return `${dayPart}${hours}小时${minutes}分${secs}秒`;
}

/** 毫秒 → 倒计时文案 */
export function formatRemaining(ms) {
    return formatDuration(Math.max(0, ms) / 1000);
}

/** Date → "2026/11/13 09:00:00" */
export function formatClock(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return (
        `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
}
