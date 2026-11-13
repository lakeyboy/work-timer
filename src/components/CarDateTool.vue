<template>
    <Teleport to="body">
        <div class="tool-overlay" @click.self="close">
            <section
                class="tool-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="carToolTitle"
            >
                <button
                    ref="closeButton"
                    class="tool-close"
                    @click="close"
                    aria-label="关闭购车工具"
                >
                    ×
                </button>

                <h2 id="carToolTitle">🚗 购车工具</h2>
                <p class="tool-sub">
                    换算轮胎、玻璃的生产日期，快速判断是否被换过件
                </p>

                <div class="tool-tabs" role="tablist" aria-label="换算项目">
                    <button
                        id="tab-tire"
                        role="tab"
                        :aria-selected="tab === 'tire'"
                        :class="{ active: tab === 'tire' }"
                        @click="tab = 'tire'"
                    >
                        轮胎日期
                    </button>
                    <button
                        id="tab-glass"
                        role="tab"
                        :aria-selected="tab === 'glass'"
                        :class="{ active: tab === 'glass' }"
                        @click="tab = 'glass'"
                    >
                        玻璃日期
                    </button>
                </div>

                <div
                    v-show="tab === 'tire'"
                    role="tabpanel"
                    aria-labelledby="tab-tire"
                    class="tool-pane"
                >
                    <label class="field">
                        <span class="field-label">轮胎 DOT 后四位</span>
                        <input
                            v-model="tireCode"
                            class="field-input"
                            inputmode="numeric"
                            autocomplete="off"
                            placeholder="例如 3523"
                        />
                    </label>
                    <p class="field-hint">
                        前两位是生产周（01–53），后两位是年份。可粘贴完整
                        DOT，自动取最后 4 位。
                    </p>

                    <div v-if="tireResult?.ok" class="result">
                        <p class="result-main">
                            {{ tireResult.year }} 年第
                            {{ tireResult.week }} 周
                        </p>
                        <p class="result-sub">
                            {{ formatDateCN(tireResult.range.start) }} ~
                            {{ formatDateCN(tireResult.range.end) }}
                        </p>
                        <p class="result-note">
                            轮胎通常在该周内生产，装车日期一般略晚于此
                        </p>
                    </div>
                    <p v-else-if="tireResult" class="error">
                        {{ tireResult.error }}
                    </p>

                    <p
                        v-for="warning in tireResult?.warnings ?? []"
                        :key="warning"
                        class="warn"
                    >
                        ⚠️ {{ warning }}
                    </p>
                </div>

                <div
                    v-show="tab === 'glass'"
                    role="tabpanel"
                    aria-labelledby="tab-glass"
                    class="tool-pane"
                >
                    <div class="field-row">
                        <label class="field">
                            <span class="field-label">年份个位</span>
                            <select
                                v-model.number="glass.yearDigit"
                                class="field-input"
                            >
                                <option
                                    v-for="digit in 10"
                                    :key="digit"
                                    :value="digit - 1"
                                >
                                    {{ digit - 1 }}
                                </option>
                            </select>
                        </label>
                        <label class="field">
                            <span class="field-label">年份</span>
                            <select
                                v-model.number="glass.year"
                                class="field-input"
                            >
                                <option
                                    v-for="year in yearOptions"
                                    :key="year"
                                    :value="year"
                                >
                                    {{ year }}
                                </option>
                            </select>
                        </label>
                    </div>
                    <p class="field-hint">
                        年份个位 = 生产年份的最后一位，例如 2023 年印的是「3」；同一个数字会对应多个年份，用右侧「年份」确定具体是哪一年。若玻璃直接印两位年份（如 26），个位选 6、年份选 2026。
                    </p>

                    <label class="field">
                        <span class="field-label">编码形式</span>
                        <select v-model="glassFormat" class="field-input">
                            <option value="single">
                                单排点 · 数字前后（最常见）
                            </option>
                            <option value="double">
                                双排点 · 精确到日
                            </option>
                            <option value="month">
                                点数直接等于月份
                            </option>
                            <option value="year">只有年份数字</option>
                        </select>
                    </label>
                    <p class="field-hint">{{ glassFormatHint }}</p>

                    <template v-if="glassFormat === 'single'">
                        <div class="field-row">
                            <label class="field">
                                <span class="field-label">圆点数量</span>
                                <select
                                    v-model.number="glass.dots"
                                    class="field-input"
                                >
                                    <option
                                        v-for="count in 6"
                                        :key="count"
                                        :value="count"
                                    >
                                        {{ count }}
                                    </option>
                                </select>
                            </label>
                            <label class="field">
                                <span class="field-label">圆点位置</span>
                                <select
                                    v-model="glass.position"
                                    class="field-input"
                                >
                                    <option value="before">
                                        数字前（上半年）
                                    </option>
                                    <option value="after">
                                        数字后（下半年）
                                    </option>
                                </select>
                            </label>
                        </div>

                        <div v-if="glassSingleResult.ok" class="result">
                            <p class="result-main">
                                {{
                                    formatMonthCN(
                                        glassSingleResult.year,
                                        glassSingleResult.month,
                                    )
                                }}
                            </p>
                            <p class="result-note">
                                玻璃大约在该月生产，此编码只能精确到月
                            </p>
                        </div>
                        <p v-else class="error">
                            {{ glassSingleResult.error }}
                        </p>
                    </template>

                    <template v-else-if="glassFormat === 'double'">
                        <div class="field-row three">
                            <label class="field">
                                <span class="field-label">第一排点数</span>
                                <select
                                    v-model.number="glass.monthDots"
                                    class="field-input"
                                >
                                    <option
                                        v-for="month in 12"
                                        :key="month"
                                        :value="month"
                                    >
                                        {{ month }}
                                    </option>
                                </select>
                            </label>
                            <label class="field">
                                <span class="field-label">大点</span>
                                <select
                                    v-model.number="glass.bigDots"
                                    class="field-input"
                                >
                                    <option
                                        v-for="count in 4"
                                        :key="count"
                                        :value="count - 1"
                                    >
                                        {{ count - 1 }}
                                    </option>
                                </select>
                            </label>
                            <label class="field">
                                <span class="field-label">小点</span>
                                <select
                                    v-model.number="glass.smallDots"
                                    class="field-input"
                                >
                                    <option
                                        v-for="count in 10"
                                        :key="count"
                                        :value="count - 1"
                                    >
                                        {{ count - 1 }}
                                    </option>
                                </select>
                            </label>
                        </div>

                        <div v-if="glassDayResult.ok" class="result">
                            <p class="result-main">
                                {{ glassDayResult.year }}年{{
                                    glassDayResult.month
                                }}月{{ glassDayResult.day }}日
                            </p>
                        </div>
                        <p v-else class="error">
                            {{ glassDayResult.error }}
                        </p>
                    </template>

                    <template v-else-if="glassFormat === 'month'">
                        <label class="field">
                            <span class="field-label">圆点数量（1–12）</span>
                            <select
                                v-model.number="glass.monthCount"
                                class="field-input"
                            >
                                <option
                                    v-for="count in 12"
                                    :key="count"
                                    :value="count"
                                >
                                    {{ count }}
                                </option>
                            </select>
                        </label>

                        <div v-if="glassMonthResult.ok" class="result">
                            <p class="result-main">
                                {{
                                    formatMonthCN(
                                        glassMonthResult.year,
                                        glassMonthResult.month,
                                    )
                                }}
                            </p>
                            <p class="result-note">此编码只能精确到月</p>
                        </div>
                        <p v-else class="error">
                            {{ glassMonthResult.error }}
                        </p>
                    </template>

                    <template v-else>
                        <div v-if="glassYearResult.ok" class="result">
                            <p class="result-main">
                                {{ glassYearResult.year }} 年
                            </p>
                            <p class="result-note">
                                没有月份信息，建议结合车辆铭牌或年款判断
                            </p>
                        </div>
                        <p v-else class="error">
                            {{ glassYearResult.error }}
                        </p>
                    </template>
                </div>

                <p class="tool-disclaimer">
                    不同品牌、批次的编码规则可能略有差异，结果仅供参考；若与车辆出厂日期明显矛盾，建议进一步核实。
                </p>
            </section>
        </div>
    </Teleport>
</template>

<script setup>
    import {
        computed,
        nextTick,
        onMounted,
        onUnmounted,
        reactive,
        ref,
        watch,
    } from "vue";
    import {
        convertGlassByDay,
        convertGlassByDots,
        convertGlassByMonthCount,
        convertGlassYearOnly,
        formatDateCN,
        formatMonthCN,
        glassYearCandidates,
        parseTireCode,
    } from "../utils/carDate.js";

    const emit = defineEmits(["close"]);

    const tab = ref("tire");
    const closeButton = ref(null);

    const tireCode = ref("");
    const tireResult = computed(() => {
        const value = tireCode.value.trim();
        return value ? parseTireCode(value) : null;
    });

    const glassFormat = ref("single");
    const glass = reactive({
        yearDigit: 3,
        year: 0,
        dots: 2,
        position: "before",
        monthDots: 5,
        bigDots: 2,
        smallDots: 3,
        monthCount: 5,
    });

    const yearOptions = computed(() =>
        glassYearCandidates(glass.yearDigit),
    );

    // 年份个位变化时，自动切到该个位最近的一个年份
    watch(
        yearOptions,
        (years) => {
            if (!years.includes(glass.year)) {
                glass.year = years[0] ?? new Date().getFullYear();
            }
        },
        { immediate: true },
    );

    const glassSingleResult = computed(() =>
        convertGlassByDots({
            yearDigit: glass.yearDigit,
            dots: glass.dots,
            position: glass.position,
            year: glass.year,
        }),
    );

    const glassDayResult = computed(() =>
        convertGlassByDay({
            monthDots: glass.monthDots,
            bigDots: glass.bigDots,
            smallDots: glass.smallDots,
            year: glass.year,
        }),
    );

    const glassMonthResult = computed(() =>
        convertGlassByMonthCount({
            yearDigit: glass.yearDigit,
            dots: glass.monthCount,
            year: glass.year,
        }),
    );

    const glassYearResult = computed(() =>
        convertGlassYearOnly({
            yearDigit: glass.yearDigit,
            year: glass.year,
        }),
    );

    const glassFormatHint = computed(() => {
        switch (glassFormat.value) {
            case "double":
                return "第一排点数 = 月份，第二排大点 = 10 天、小点 = 1 天。例：5 点 + 2 大 3 小 → 5月23日。";
            case "month":
                return "点数直接等于月份（部分进口 / 韩系玻璃）。例：5 个点 → 5月。";
            case "year":
                return "玻璃上只有年份数字、没有圆点，只能判断年份，无法确定月份。";
            default:
                return "数字是年份个位；点在数字前：月份 = 7 − 点数；点在后：月份 = 13 − 点数。例：··3 → 2023年5月。";
        }
    });

    let lastFocused = null;

    function close() {
        emit("close");
    }

    function handleKeydown(event) {
        if (event.key === "Escape") close();
    }

    onMounted(() => {
        lastFocused = document.activeElement;
        document.addEventListener("keydown", handleKeydown);
        document.body.style.overflow = "hidden";
        nextTick(() => closeButton.value?.focus());
    });

    onUnmounted(() => {
        document.removeEventListener("keydown", handleKeydown);
        document.body.style.overflow = "";
        lastFocused?.focus?.();
    });
</script>

<style scoped>
    .tool-overlay {
        position: fixed;
        inset: 0;
        z-index: 2100;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(45, 32, 20, 0.5);
        overflow-y: auto;
    }

    .tool-modal {
        position: relative;
        width: min(460px, 100%);
        max-height: calc(100vh - 40px);
        overflow-y: auto;
        padding: 22px;
        border-radius: 24px;
        background: #fffdf9;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
        text-align: left;
    }

    .tool-modal h2 {
        margin: 0 0 6px;
        font-size: 1.3rem;
        color: #2d2a24;
    }

    .tool-sub {
        margin: 0 0 14px;
        font-size: 0.82rem;
        line-height: 1.5;
        color: #9b8a78;
    }

    .tool-close {
        position: absolute;
        top: 12px;
        right: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.08);
        color: #6b4f37;
        font-size: 20px;
        cursor: pointer;
    }

    .tool-tabs {
        display: flex;
        gap: 4px;
        padding: 4px;
        margin-bottom: 14px;
        border-radius: 999px;
        background: #f6ebdd;
    }

    .tool-tabs button {
        flex: 1;
        padding: 8px 6px;
        border: none;
        border-radius: 999px;
        background: transparent;
        color: #8a6b50;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        transition: 0.2s;
    }

    .tool-tabs button.active {
        background: #fff;
        color: #3e2a1a;
        box-shadow: 0 2px 6px rgba(120, 80, 40, 0.15);
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 10px;
    }

    .field-label {
        font-size: 0.82rem;
        font-weight: 600;
        color: #7a5c40;
    }

    .field-input {
        width: 100%;
        padding: 10px 12px;
        border: 2px solid #ead6c2;
        border-radius: 14px;
        background: #fffbf5;
        color: #2d241c;
        font-size: 1rem;
        outline: none;
        transition: 0.2s;
    }

    .field-input:focus {
        border-color: #f3a15d;
    }

    .field-row {
        display: flex;
        gap: 10px;
    }

    .field-row .field {
        flex: 1;
        min-width: 0;
    }

    .field-hint {
        margin: 0 0 12px;
        font-size: 0.78rem;
        line-height: 1.55;
        color: #a89786;
    }

    .result {
        margin-top: 6px;
        padding: 12px 14px;
        border: 1px solid #ffd9ad;
        border-radius: 16px;
        background: #fff4e4;
    }

    .result-main {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 700;
        color: #7a4216;
    }

    .result-sub {
        margin: 4px 0 0;
        font-size: 0.88rem;
        color: #6b5238;
    }

    .result-note {
        margin: 6px 0 0;
        font-size: 0.78rem;
        color: #9b8a78;
    }

    .error {
        margin: 8px 0 0;
        font-size: 0.85rem;
        color: #d9534f;
    }

    .warn {
        margin: 6px 0 0;
        font-size: 0.82rem;
        color: #b07d1f;
    }

    .tool-disclaimer {
        margin: 16px 0 0;
        padding-top: 10px;
        border-top: 1px dashed #ead6c2;
        font-size: 0.75rem;
        line-height: 1.55;
        color: #a89786;
    }

    @media (max-width: 360px) {
        .tool-modal {
            padding: 18px 16px;
            border-radius: 20px;
        }

        .field-row.three {
            flex-wrap: wrap;
        }
    }
</style>
