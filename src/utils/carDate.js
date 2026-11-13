/**
 * 购车小工具：轮胎与汽车玻璃生产日期换算。
 * 纯函数，不依赖 Vue / DOM。
 */

const DAY_MS = 86400000;

function isoWeekInfo(date) {
    const d = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayFromMonday = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dayFromMonday + 3); // 该周周四，决定年份归属

    const weekYear = d.getUTCFullYear();
    const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
    const firstDayFromMonday = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(
        firstThursday.getUTCDate() - firstDayFromMonday + 3,
    );

    return {
        week: 1 + Math.round((d - firstThursday) / (7 * DAY_MS)),
        weekYear,
    };
}

/** ISO 周 → 该周的周一 ~ 周日；该年不存在这一周时返回 null */
export function isoWeekRange(year, week) {
    if (!Number.isInteger(year) || !Number.isInteger(week)) return null;

    const jan4 = new Date(year, 0, 4);
    const mondayOffset = (jan4.getDay() + 6) % 7;
    const week1Monday = new Date(year, 0, 4 - mondayOffset);
    const start = new Date(
        week1Monday.getFullYear(),
        week1Monday.getMonth(),
        week1Monday.getDate() + (week - 1) * 7,
    );

    const info = isoWeekInfo(start);
    if (info.week !== week || info.weekYear !== year) return null;

    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end };
}

/**
 * 轮胎 DOT 编码（后四位：生产周 + 年份）。
 * 允许直接粘贴完整 DOT，自动取最后四位数字。
 */
export function parseTireCode(raw, now = new Date()) {
    const digits = String(raw ?? "").replace(/\D/g, "");

    if (!digits) {
        return { ok: false, error: "请输入轮胎侧面的 DOT 后四位数字" };
    }
    if (digits.length < 4) {
        return { ok: false, error: "至少需要 4 位数字，例如 3523" };
    }

    const code = digits.slice(-4);
    const week = Number(code.slice(0, 2));
    const year = 2000 + Number(code.slice(2));

    if (week < 1 || week > 53) {
        return {
            ok: false,
            error: `前两位是生产周，应为 01–53，当前为 ${code.slice(0, 2)}`,
        };
    }
    if (year > now.getFullYear()) {
        return {
            ok: false,
            error: "年份晚于今年，请确认编码（最后两位是年份）",
        };
    }

    const range = isoWeekRange(year, week);
    if (!range) {
        return {
            ok: false,
            error: `${year} 年没有第 ${week} 周，请核对编码`,
        };
    }

    const warnings = [];
    if (range.start > now) {
        warnings.push("该周尚未到来，请确认编码是否输错");
    }
    if (digits.length > 4) {
        warnings.push(`已自动取最后 4 位：${code}`);
    }

    return { ok: true, code, week, year, range, warnings };
}

/**
 * 玻璃年份个位的候选年份（默认取不晚于今年的最近一年，再往前每 10 年）。
 */
export function glassYearCandidates(
    yearDigit,
    currentYear = new Date().getFullYear(),
) {
    const digit = Number(yearDigit);
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) return [];

    const offset = ((currentYear - digit) % 10 + 10) % 10;
    const latest = currentYear - offset;

    const years = [];
    for (let i = 0; i < 4; i += 1) {
        const year = latest - i * 10;
        if (year >= 1980) years.push(year);
    }
    return years;
}

/**
 * 单排圆点规则：数字代表年份个位，
 * 圆点在数字前 → 月份 = 7 − 点数；圆点在数字后 → 月份 = 13 − 点数。
 */
export function convertGlassByDots({ yearDigit, dots, position, year }) {
    const digit = Number(yearDigit);
    const count = Number(dots);
    const targetYear = Number(year);

    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
        return { ok: false, error: "年份个位应为 0–9 的数字" };
    }
    if (!Number.isInteger(count) || count < 1 || count > 6) {
        return { ok: false, error: "圆点数量通常为 1–6 个" };
    }
    if (
        !Number.isInteger(targetYear) ||
        targetYear % 10 !== digit
    ) {
        return { ok: false, error: "所选年份与年份个位不一致" };
    }

    const month = position === "before" ? 7 - count : 13 - count;
    if (month < 1 || month > 12) {
        return {
            ok: false,
            error: "圆点位置与数量不匹配，请再核对玻璃上的编码",
        };
    }

    return { ok: true, year: targetYear, month };
}

/**
 * 双排圆点规则（部分品牌）：第一排点数 = 月份，
 * 第二排大点 = 10 天、小点 = 1 天，用于精确到日。
 */
export function convertGlassByDay({ monthDots, bigDots, smallDots, year }) {
    const month = Number(monthDots);
    const big = Number(bigDots);
    const small = Number(smallDots);
    const targetYear = Number(year);

    if (!Number.isInteger(month) || month < 1 || month > 12) {
        return { ok: false, error: "第一排点数应为 1–12（代表月份）" };
    }
    if (!Number.isInteger(big) || big < 0 || big > 3) {
        return { ok: false, error: "大点数量通常为 0–3 个" };
    }
    if (!Number.isInteger(small) || small < 0 || small > 9) {
        return { ok: false, error: "小点数量应为 0–9 个" };
    }
    if (!Number.isInteger(targetYear)) {
        return { ok: false, error: "请选择年份" };
    }

    const day = big * 10 + small;
    if (day < 1) {
        return { ok: false, error: "日期不能为 0，请检查小点数量" };
    }

    const date = new Date(targetYear, month - 1, day);
    if (date.getMonth() !== month - 1) {
        return { ok: false, error: `${month} 月没有 ${day} 日` };
    }

    return { ok: true, year: targetYear, month, day };
}

/**
 * 点数直接等于月份（部分进口 / 韩系玻璃，1–12 个点）。
 */
export function convertGlassByMonthCount({ yearDigit, dots, year }) {
    const digit = Number(yearDigit);
    const count = Number(dots);
    const targetYear = Number(year);

    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
        return { ok: false, error: "年份个位应为 0–9 的数字" };
    }
    if (!Number.isInteger(count) || count < 1 || count > 12) {
        return { ok: false, error: "点数应为 1–12 个（直接代表月份）" };
    }
    if (!Number.isInteger(targetYear) || targetYear % 10 !== digit) {
        return { ok: false, error: "所选年份与年份个位不一致" };
    }

    return { ok: true, year: targetYear, month: count };
}

/**
 * 玻璃上只有年份数字、没有月份点：只能判断年份。
 */
export function convertGlassYearOnly({ yearDigit, year }) {
    const digit = Number(yearDigit);
    const targetYear = Number(year);

    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
        return { ok: false, error: "年份个位应为 0–9 的数字" };
    }
    if (!Number.isInteger(targetYear) || targetYear % 10 !== digit) {
        return { ok: false, error: "所选年份与年份个位不一致" };
    }

    return { ok: true, year: targetYear };
}

/** Date → "2023年8月28日" */export function formatDateCN(date) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/** 年 + 月 → "2023年5月" */
export function formatMonthCN(year, month) {
    return `${year}年${month}月`;
}
