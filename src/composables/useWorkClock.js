import {
    computed,
    onMounted,
    onUnmounted,
    reactive,
    ref,
} from "vue";
import {
    DEFAULT_CONFIG,
    calculateWorkedSeconds,
    computeDetails,
    formatClock,
    formatDuration,
    formatRemaining,
    parseTimeStr,
    validateConfig,
} from "../utils/time.js";

/** 沿用旧 key，保证老用户已保存的配置不丢失 */
const STORAGE_KEY = "workTimeConfigV5";
const ACTIVE_INTERVAL = 1000;
const HIDDEN_INTERVAL = 5000;

/** 工时时钟：配置持久化、每秒刷新、状态与倒计时派生值 */
export function useWorkClock() {
    const config = reactive({ ...DEFAULT_CONFIG });
    /** 输入框被清空时用于回滚的最近一次合法值 */
    const lastValidTimes = reactive({ ...DEFAULT_CONFIG });

    const currentTime = ref("");
    const status = ref("未上班");
    const countdownText = ref("");
    const workedSeconds = ref(0);
    const showCountdown = ref(true);
    const warnings = reactive({ timeConflict: false, restOutOfRange: false });

    const workedText = computed(() => formatDuration(workedSeconds.value));

    let timer = null;
    let visibilityHandler = null;

    function persist() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    start: config.startTime,
                    end: config.endTime,
                    restStart: config.restStart,
                    restEnd: config.restEnd,
                }),
            );
        } catch (error) {
            console.warn("保存配置失败：", error);
        }
    }

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;

            const saved = JSON.parse(raw);
            const fields = {
                start: "startTime",
                end: "endTime",
                restStart: "restStart",
                restEnd: "restEnd",
            };

            for (const [key, field] of Object.entries(fields)) {
                const value = saved?.[key];
                if (parseTimeStr(value)) {
                    config[field] = value;
                    lastValidTimes[field] = value;
                }
            }
        } catch (error) {
            console.warn("加载配置失败，使用默认值：", error);
        }
    }

    function syncWarnings() {
        Object.assign(warnings, validateConfig(config));
    }

    /** 每秒重算：状态判定必须每帧执行，不能缓存 */
    function refresh() {
        const now = new Date();
        currentTime.value = formatClock(now);

        if (!config.startTime || !config.endTime) {
            status.value = "等待输入";
            countdownText.value = "请设置时间";
            showCountdown.value = true;
            workedSeconds.value = 0;
            return;
        }

        const details = computeDetails(
            now,
            config.startTime,
            config.endTime,
        );
        if (!details) {
            status.value = "错误";
            countdownText.value = "时间格式有误";
            showCountdown.value = true;
            workedSeconds.value = 0;
            return;
        }

        status.value = details.status;

        if (details.status === "上班中") {
            showCountdown.value = true;
            countdownText.value = formatRemaining(
                details.shiftEnd - now,
            );
            workedSeconds.value = calculateWorkedSeconds(
                now,
                details.shiftStart,
                details.shiftEnd,
                config.restStart,
                config.restEnd,
            );
            return;
        }

        workedSeconds.value = 0;
        if (details.status === "未上班") {
            // 未上班时展示距离下一次下班的剩余时间
            showCountdown.value = true;
            countdownText.value = details.nextEnd
                ? formatRemaining(details.nextEnd - now)
                : "计算异常";
            return;
        }

        showCountdown.value = false;
        countdownText.value = formatDuration(0);
    }

    function startTimer(interval) {
        if (timer) clearInterval(timer);
        timer = setInterval(refresh, interval);
    }

    /** 写入输入值；返回 false 表示该值不合法、已回滚 */
    function updateTime(field, value) {
        if (!value) {
            config[field] = lastValidTimes[field];
            return false;
        }
        config[field] = value;
        if (parseTimeStr(value)) {
            lastValidTimes[field] = value;
        }
        return true;
    }

    /** 输入结束后落库并立刻刷新显示 */
    function commitTimes() {
        persist();
        syncWarnings();
        refresh();
    }

    function resetToDefault() {
        Object.assign(config, DEFAULT_CONFIG);
        Object.assign(lastValidTimes, DEFAULT_CONFIG);
        commitTimes();
    }

    onMounted(() => {
        load();
        syncWarnings();
        refresh();
        startTimer(ACTIVE_INTERVAL);

        visibilityHandler = () => {
            startTimer(
                document.hidden ? HIDDEN_INTERVAL : ACTIVE_INTERVAL,
            );
            if (!document.hidden) refresh();
        };
        document.addEventListener("visibilitychange", visibilityHandler);
    });

    onUnmounted(() => {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        if (visibilityHandler) {
            document.removeEventListener(
                "visibilitychange",
                visibilityHandler,
            );
            visibilityHandler = null;
        }
    });

    return {
        config,
        currentTime,
        status,
        countdownText,
        workedText,
        showCountdown,
        warnings,
        updateTime,
        commitTimes,
        resetToDefault,
        refresh,
    };
}
