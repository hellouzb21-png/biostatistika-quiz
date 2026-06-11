// Biostatistics and Public Health Test Application Logic

document.addEventListener("DOMContentLoaded", () => {
    // --------------------------------------------------
    // 1. STATE MANAGEMENT
    // --------------------------------------------------
    let state = {
        activeTab: "home", // home, bookmarks, stats
        activeMode: "study", // study, quiz
        currentSetIdx: null, // null (dashboard) or 0, 1, 2, 3
        currentQuestionIdx: 0, // index relative to the active set
        
        // Quiz session state (for active quiz/study set)
        userAnswers: [], // Array matching length of current set: null or selected option index
        quizCompleted: false,
        reviewMode: false, // In quiz mode, true when reviewing answers after completion
        
        // Persisted state loaded from localStorage
        progress: {
            studyCorrect: {}, // questionUniqueKey -> boolean (true if answered correctly in study mode)
            studyIncorrect: {}, // questionUniqueKey -> boolean (true if answered incorrectly)
            quizScores: {} // setIndex -> { correctCount: X, totalCount: Y, completed: true }
        },
        bookmarks: [] // Array of questionUniqueKey strings
    };

    // Constant Range settings for the 4 sets of 50
    const SET_RANGES = [
        { start: 0, end: 49, title: "1-Blok (1-50)", desc: "Biostatistika va variatsion qatorlar asoslari" },
        { start: 50, end: 99, title: "2-Blok (51-100)", desc: "Korrelyatsiya, o'rtacha qiymatlar va ishonchlilik" },
        { start: 100, end: 149, title: "3-Blok (101-150)", desc: "Jamoat salomatligi va sog'liqni saqlash tashkiloti" },
        { start: 150, end: 192, title: "4-Blok (151-193)", desc: "Mehnatga layoqatsizlik va yakuniy qismlar" }
    ];

    // Helper to generate a unique key for each question (based on text hash)
    function getQuestionKey(qText) {
        let hash = 0;
        for (let i = 0; i < qText.length; i++) {
            hash = (hash << 5) - hash + qText.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        return `q_${hash}`;
    }

    // --------------------------------------------------
    // 2. DOM ELEMENTS
    // --------------------------------------------------
    const el = {
        // Tabs & Navigation
        tabHome: document.getElementById("tab-home"),
        tabBookmarks: document.getElementById("tab-bookmarks"),
        tabStats: document.getElementById("tab-stats"),
        btnHomeTab: document.getElementById("btn-home-tab"),
        btnBookmarksTab: document.getElementById("btn-bookmarks-tab"),
        btnStatsTab: document.getElementById("btn-stats-tab"),
        
        // Headers
        headerTitle: document.getElementById("header-title"),
        headerSubtitle: document.getElementById("header-subtitle"),
        btnModeStudy: document.getElementById("btn-mode-study"),
        btnModeQuiz: document.getElementById("btn-mode-quiz"),
        btnResetAll: document.getElementById("btn-reset-all"),
        
        // Dashboard
        dashboardSelector: document.getElementById("dashboard-set-selector"),
        setCards: document.querySelectorAll(".set-card"),
        
        // Workspace
        quizWorkspace: document.getElementById("quiz-workspace"),
        btnBackDashboard: document.getElementById("btn-back-dashboard"),
        workspaceTitleInfo: document.getElementById("workspace-title-info"),
        questionNavCounter: document.getElementById("question-nav-counter"),
        questionDotsGrid: document.getElementById("question-dots-grid"),
        
        // Active Question Card
        activeQuestionCard: document.getElementById("active-question-card"),
        questionBadgeInfo: document.getElementById("question-badge-info"),
        btnViewSource: document.getElementById("btn-view-source"),
        btnBookmarkQuestion: document.getElementById("btn-bookmark-question"),
        questionText: document.getElementById("question-text"),
        optionsContainer: document.getElementById("options-container"),
        explanationContainer: document.getElementById("explanation-container"),
        explanationText: document.getElementById("explanation-text"),
        
        // Navigation buttons
        btnPrevQuestion: document.getElementById("btn-prev-question"),
        btnNextQuestion: document.getElementById("btn-next-question"),
        btnSubmitAnswer: document.getElementById("btn-submit-answer"),
        
        // Results Card
        quizResultCard: document.getElementById("quiz-result-card"),
        resultScoreNum: document.getElementById("result-score-num"),
        resultScoreMessage: document.getElementById("result-score-message"),
        resultCorrectCount: document.getElementById("result-correct-count"),
        resultIncorrectCount: document.getElementById("result-incorrect-count"),
        resultPct: document.getElementById("result-pct"),
        btnReviewAnswers: document.getElementById("btn-review-answers"),
        btnRestartQuiz: document.getElementById("btn-restart-quiz"),
        btnFinishQuiz: document.getElementById("btn-finish-quiz"),
        
        // Bookmarks tab
        bookmarksEmptyState: document.getElementById("bookmarks-empty-state"),
        bookmarksList: document.getElementById("bookmarks-list"),
        bookmarkBadge: document.getElementById("bookmark-badge"),
        
        // Lightbox modal dialog
        lightbox: document.getElementById("source-lightbox"),
        lightboxTitle: document.getElementById("lightbox-title"),
        lightboxSourceText: document.getElementById("lightbox-source-text"),
        lightboxImageWrapper: document.getElementById("lightbox-image-wrapper"),
        lightboxImg: document.getElementById("lightbox-img"),
        lightboxPdfFallback: document.getElementById("lightbox-pdf-fallback"),
        lightboxPdfDesc: document.getElementById("lightbox-pdf-desc"),
        btnCloseLightbox: document.getElementById("btn-close-lightbox"),
        
        // Overall Stats
        overallRing: document.getElementById("overall-ring"),
        overallPctNum: document.getElementById("overall-pct-num"),
        statsTotalQuestions: document.getElementById("stats-total-questions"),
        statsCorrectTotal: document.getElementById("stats-correct-total"),
        statsIncorrectTotal: document.getElementById("stats-incorrect-total"),
        statsUnseenTotal: document.getElementById("stats-unseen-total")
    };

    // --------------------------------------------------
    // 3. STORAGE & INITIALIZATION
    // --------------------------------------------------
    function loadProgress() {
        const storedProgress = localStorage.getItem("biostat_progress");
        if (storedProgress) {
            try {
                state.progress = JSON.parse(storedProgress);
            } catch (e) {
                console.error("Error parsing progress from localStorage:", e);
            }
        }
        
        const storedBookmarks = localStorage.getItem("biostat_bookmarks");
        if (storedBookmarks) {
            try {
                state.bookmarks = JSON.parse(storedBookmarks);
            } catch (e) {
                console.error("Error parsing bookmarks from localStorage:", e);
            }
        }
        
        updateOverallProgress();
        renderSetCardsProgress();
    }

    function saveProgress() {
        localStorage.setItem("biostat_progress", JSON.stringify(state.progress));
        localStorage.setItem("biostat_bookmarks", JSON.stringify(state.bookmarks));
        updateOverallProgress();
        renderSetCardsProgress();
    }

    function resetAllProgress() {
        if (confirm("Haqiqatan ham barcha o'rganish va test natijalaringizni o'chirmoqchimisiz? Bu amalni ortga qaytarib bo'lmaydi.")) {
            state.progress = {
                studyCorrect: {},
                studyIncorrect: {},
                quizScores: {}
            };
            state.bookmarks = [];
            saveProgress();
            
            // Go back to home tab dashboard
            switchTab("home");
            exitWorkspace();
            alert("Barcha natijalar muvaffaqiyatli o'chirildi!");
        }
    }

    // --------------------------------------------------
    // 4. PROGRESS CALCULATION & UI BINDING
    // --------------------------------------------------
    function updateOverallProgress() {
        const totalQuestions = QUESTIONS.length;
        
        // Unique questions answered correctly in Study Mode
        const studyCorrectCount = Object.keys(state.progress.studyCorrect).length;
        const studyIncorrectCount = Object.keys(state.progress.studyIncorrect).length;
        const unseenCount = Math.max(0, totalQuestions - studyCorrectCount);
        
        const pct = totalQuestions > 0 ? Math.round((studyCorrectCount / totalQuestions) * 100) : 0;
        
        // Update Ring chart in stats tab
        if (el.overallRing) {
            const radius = el.overallRing.r.baseVal.value;
            const circumference = 2 * Math.PI * radius;
            el.overallRing.style.strokeDasharray = `${circumference} ${circumference}`;
            const offset = circumference - (pct / 100) * circumference;
            el.overallRing.style.strokeDashoffset = offset;
        }
        
        // Text updates
        if (el.overallPctNum) el.overallPctNum.textContent = `${pct}%`;
        if (el.statsTotalQuestions) el.statsTotalQuestions.textContent = `${totalQuestions} ta`;
        if (el.statsCorrectTotal) el.statsCorrectTotal.textContent = `${studyCorrectCount} ta`;
        if (el.statsIncorrectTotal) el.statsIncorrectTotal.textContent = `${studyIncorrectCount} ta`;
        if (el.statsUnseenTotal) el.statsUnseenTotal.textContent = `${unseenCount} ta`;
        
        // Update badge count
        if (el.bookmarkBadge) {
            el.bookmarkBadge.textContent = state.bookmarks.length;
        }
    }

    function renderSetCardsProgress() {
        SET_RANGES.forEach((range, idx) => {
            const totalInSet = (range.end - range.start) + 1;
            let correctInSet = 0;
            
            for (let i = range.start; i <= range.end; i++) {
                const key = getQuestionKey(QUESTIONS[i].question);
                if (state.progress.studyCorrect[key]) {
                    correctInSet++;
                }
            }
            
            const pct = Math.round((correctInSet / totalInSet) * 100);
            
            // Dashboard cards
            const pctText = document.getElementById(`set-${idx}-pct`);
            const barFill = document.getElementById(`set-${idx}-bar`);
            if (pctText) pctText.textContent = `${pct}%`;
            if (barFill) barFill.style.width = `${pct}%`;
            
            // Stats tab bars
            const statText = document.getElementById(`stat-set-${idx}-text`);
            const statFill = document.getElementById(`stat-set-${idx}-fill`);
            if (statText) statText.textContent = `${correctInSet} / ${totalInSet}`;
            if (statFill) {
                statFill.style.width = `${pct}%`;
            }
        });
    }

    // --------------------------------------------------
    // 5. NAVIGATION & TAB SWITCHING
    // --------------------------------------------------
    function switchTab(tabName) {
        state.activeTab = tabName;
        
        // Toggle tab elements visibility
        el.tabHome.classList.remove("active");
        el.tabBookmarks.classList.remove("active");
        el.tabStats.classList.remove("active");
        
        el.btnHomeTab.classList.remove("active");
        el.btnBookmarksTab.classList.remove("active");
        el.btnStatsTab.classList.remove("active");
        
        if (tabName === "home") {
            el.tabHome.classList.add("active");
            el.btnHomeTab.classList.add("active");
            el.headerTitle.textContent = "Bosh sahifa";
            el.headerSubtitle.textContent = "Biostatistika va Jamoat Salomatligi imtihoniga tayyorgarlik ko'ring.";
        } else if (tabName === "bookmarks") {
            el.tabBookmarks.classList.add("active");
            el.btnBookmarksTab.classList.add("active");
            el.headerTitle.textContent = "Yodlab qolishlar";
            el.headerSubtitle.textContent = "Saqlangan va qiyinchilik tug'dirgan savollar to'plami.";
            renderBookmarks();
        } else if (tabName === "stats") {
            el.tabStats.classList.add("active");
            el.btnStatsTab.classList.add("active");
            el.headerTitle.textContent = "Natijalar tahlili";
            el.headerSubtitle.textContent = "O'rganish va test topshirish jarayoni tahlili.";
            updateOverallProgress();
        }
    }

    // --------------------------------------------------
    // 6. QUIZ WORKSPACE MANAGEMENT
    // --------------------------------------------------
    function startSet(setIdx) {
        state.currentSetIdx = setIdx;
        state.currentQuestionIdx = 0;
        state.quizCompleted = false;
        state.reviewMode = false;
        
        const range = SET_RANGES[setIdx];
        const totalQuestions = (range.end - range.start) + 1;
        
        // Initialize userAnswers array
        state.userAnswers = new Array(totalQuestions).fill(null);
        
        // Hide dashboard, show workspace
        el.dashboardSelector.classList.add("hidden");
        el.quizWorkspace.classList.remove("hidden");
        
        // Update Title
        el.workspaceTitleInfo.querySelector("h4").textContent = range.title;
        el.workspaceTitleInfo.querySelector("span").textContent = 
            state.activeMode === "study" ? "O'rganish (Study) Rejimi" : "Test (Quiz) Rejimi";
            
        renderQuestionDots();
        renderQuestion();
    }

    function exitWorkspace() {
        state.currentSetIdx = null;
        el.quizWorkspace.classList.add("hidden");
        el.dashboardSelector.classList.remove("hidden");
    }

    function getAbsoluteQuestionIndex() {
        if (state.currentSetIdx === null) return 0;
        const range = SET_RANGES[state.currentSetIdx];
        return range.start + state.currentQuestionIdx;
    }

    // --------------------------------------------------
    // 7. QUESTION RENDERING & LOGIC
    // --------------------------------------------------
    function renderQuestionDots() {
        el.questionDotsGrid.innerHTML = "";
        const range = SET_RANGES[state.currentSetIdx];
        const total = (range.end - range.start) + 1;
        
        for (let i = 0; i < total; i++) {
            const dot = document.createElement("button");
            dot.className = "dot";
            dot.textContent = i + 1;
            
            const absoluteIdx = range.start + i;
            const q = QUESTIONS[absoluteIdx];
            const key = getQuestionKey(q.question);
            
            // Classes based on state & mode
            if (i === state.currentQuestionIdx) {
                dot.classList.add("active");
            }
            
            if (state.activeMode === "study") {
                if (state.progress.studyCorrect[key]) {
                    dot.classList.add("correct");
                } else if (state.progress.studyIncorrect[key]) {
                    dot.classList.add("incorrect");
                }
            } else { // Quiz Mode
                if (state.reviewMode) {
                    const ans = state.userAnswers[i];
                    if (ans !== null) {
                        if (ans === q.answer_index) {
                            dot.classList.add("correct");
                        } else {
                            dot.classList.add("incorrect");
                        }
                    } else {
                        dot.classList.add("incorrect"); // Unanswered is wrong
                    }
                } else {
                    if (state.userAnswers[i] !== null) {
                        dot.classList.add("answered");
                    }
                }
            }
            
            dot.addEventListener("click", () => {
                state.currentQuestionIdx = i;
                renderQuestion();
                
                // Update active dot class
                document.querySelectorAll(".dot").forEach(d => d.classList.remove("active"));
                dot.classList.add("active");
            });
            
            el.questionDotsGrid.appendChild(dot);
        }
        
        el.questionNavCounter.textContent = `${state.currentQuestionIdx + 1} / ${total}`;
    }

    function renderQuestion() {
        const absoluteIdx = getAbsoluteQuestionIndex();
        const q = QUESTIONS[absoluteIdx];
        const range = SET_RANGES[state.currentSetIdx];
        const totalInSet = (range.end - range.start) + 1;
        
        // Hide explanation initially
        el.explanationContainer.classList.add("hidden");
        
        // Result vs Active Card view toggling
        if (state.quizCompleted) {
            el.activeQuestionCard.classList.add("hidden");
            el.quizResultCard.classList.remove("hidden");
            renderQuizResults();
            return;
        } else {
            el.activeQuestionCard.classList.remove("hidden");
            el.quizResultCard.classList.add("hidden");
        }
        
        // Update header & badges
        el.questionBadgeInfo.textContent = `Savol #${state.currentQuestionIdx + 1} / ${totalInSet}`;
        el.questionText.textContent = q.question;
        
        // Bookmark star styling
        const qKey = getQuestionKey(q.question);
        const isBookmarked = state.bookmarks.includes(qKey);
        const starIcon = el.btnBookmarkQuestion.querySelector("i");
        if (isBookmarked) {
            starIcon.className = "fa-solid fa-star";
            el.btnBookmarkQuestion.classList.add("active");
            el.btnBookmarkQuestion.innerHTML = '<i class="fa-solid fa-star"></i> Saqlangan';
        } else {
            starIcon.className = "fa-regular fa-star";
            el.btnBookmarkQuestion.classList.remove("active");
            el.btnBookmarkQuestion.innerHTML = '<i class="fa-regular fa-star"></i> Saqlash';
        }
        
        // Show/hide source button if sources available
        if (q.sources && q.sources.length > 0) {
            el.btnViewSource.classList.remove("hidden");
        } else {
            el.btnViewSource.classList.add("hidden");
        }

        // Render option buttons
        el.optionsContainer.innerHTML = "";
        q.options.forEach((optText, optIdx) => {
            const btn = document.createElement("button");
            btn.className = "option-card";
            btn.dataset.optIndex = optIdx;
            
            const letterSpan = document.createElement("span");
            letterSpan.className = "option-letter";
            letterSpan.textContent = String.fromCharCode(65 + optIdx); // A, B, C, D...
            
            const textSpan = document.createElement("span");
            textSpan.className = "option-text";
            textSpan.textContent = optText;
            
            const checkIcon = document.createElement("i");
            checkIcon.className = "fa-solid fa-circle-check option-status-icon";
            
            btn.appendChild(letterSpan);
            btn.appendChild(textSpan);
            btn.appendChild(checkIcon);
            
            // Interaction logic based on Mode
            if (state.activeMode === "study") {
                const isCorrect = optIdx === q.answer_index;
                const wasAnswered = state.progress.studyCorrect[qKey] || state.progress.studyIncorrect[qKey];
                const savedAns = localStorage.getItem(`study_ans_${qKey}`);
                
                if (wasAnswered) {
                    btn.disabled = true;
                    if (isCorrect) {
                        btn.classList.add("correct");
                    } else if (savedAns && parseInt(savedAns) === optIdx) {
                        btn.classList.add("incorrect");
                        checkIcon.className = "fa-solid fa-circle-xmark option-status-icon";
                    }
                    
                    // Show explanation
                    el.explanationContainer.classList.remove("hidden");
                    el.explanationText.textContent = q.explanation || "M ± kσ oraliq qoidalari va biostatistik tahlil qoidasiga ko'ra.";
                } else {
                    btn.addEventListener("click", () => handleStudyAnswer(optIdx));
                }
            } else { // Quiz Mode
                const selectedAns = state.userAnswers[state.currentQuestionIdx];
                
                if (state.reviewMode) {
                    btn.disabled = true;
                    const isCorrect = optIdx === q.answer_index;
                    
                    if (isCorrect) {
                        btn.classList.add("correct");
                    } else if (selectedAns === optIdx) {
                        btn.classList.add("incorrect");
                        checkIcon.className = "fa-solid fa-circle-xmark option-status-icon";
                    }
                    
                    el.explanationContainer.classList.remove("hidden");
                    el.explanationText.textContent = q.explanation || "Biostatistik qoidalarga binoan javob to'g'ri.";
                } else {
                    // Normal quiz mode selections
                    if (selectedAns === optIdx) {
                        btn.classList.add("selected");
                    }
                    
                    btn.addEventListener("click", () => {
                        document.querySelectorAll(".option-card").forEach(b => b.classList.remove("selected"));
                        btn.classList.add("selected");
                        state.userAnswers[state.currentQuestionIdx] = optIdx;
                        
                        // Highlight answer dots as active/answered
                        renderQuestionDots();
                        
                        // Enable Submit / next button automatically
                        el.btnSubmitAnswer.classList.remove("hidden");
                    });
                }
            }
            
            el.optionsContainer.appendChild(btn);
        });
        
        // Navigation button states
        el.btnPrevQuestion.disabled = state.currentQuestionIdx === 0;
        
        // Next button configuration
        if (state.activeMode === "quiz" && !state.reviewMode) {
            // In Quiz, "Javobni tasdiqlash" (Submit) is shown instead of next if not answered
            const selectedAns = state.userAnswers[state.currentQuestionIdx];
            if (selectedAns !== null) {
                el.btnSubmitAnswer.classList.remove("hidden");
                
                if (state.currentQuestionIdx === totalInSet - 1) {
                    el.btnSubmitAnswer.textContent = "Testni tugatish";
                } else {
                    el.btnSubmitAnswer.textContent = "Keyingi savol";
                }
            } else {
                el.btnSubmitAnswer.classList.add("hidden");
            }
            el.btnNextQuestion.classList.add("hidden");
        } else {
            // Study mode or review mode has simple "Next" button
            el.btnSubmitAnswer.classList.add("hidden");
            el.btnNextQuestion.classList.remove("hidden");
            
            if (state.currentQuestionIdx === totalInSet - 1) {
                el.btnNextQuestion.innerHTML = 'Blokni yakunlash <i class="fa-solid fa-check-double"></i>';
            } else {
                el.btnNextQuestion.innerHTML = 'Keyingi <i class="fa-solid fa-chevron-right"></i>';
            }
        }
        
        // Update Grid navigator count highlight
        renderQuestionDots();
    }

    // --------------------------------------------------
    // 8. ANSWER ACTION HANDLERS
    // --------------------------------------------------
    function handleStudyAnswer(selectedIdx) {
        const absoluteIdx = getAbsoluteQuestionIndex();
        const q = QUESTIONS[absoluteIdx];
        const qKey = getQuestionKey(q.question);
        
        const isCorrect = selectedIdx === q.answer_index;
        
        // Save to state progress
        if (isCorrect) {
            state.progress.studyCorrect[qKey] = true;
            delete state.progress.studyIncorrect[qKey];
        } else {
            state.progress.studyIncorrect[qKey] = true;
            delete state.progress.studyCorrect[qKey];
        }
        
        localStorage.setItem(`study_ans_${qKey}`, selectedIdx.toString());
        saveProgress();
        renderQuestion();
    }

    function handleNext() {
        const range = SET_RANGES[state.currentSetIdx];
        const totalInSet = (range.end - range.start) + 1;
        
        if (state.currentQuestionIdx < totalInSet - 1) {
            state.currentQuestionIdx++;
            renderQuestion();
        } else {
            // End of set card options
            if (state.activeMode === "study") {
                alert("Siz ushbu blokdagi barcha savollarni o'rganib chiqdingiz!");
                exitWorkspace();
            }
        }
    }

    function handlePrev() {
        if (state.currentQuestionIdx > 0) {
            state.currentQuestionIdx--;
            renderQuestion();
        }
    }

    function handleQuizSubmit() {
        const range = SET_RANGES[state.currentSetIdx];
        const totalInSet = (range.end - range.start) + 1;
        
        if (state.currentQuestionIdx < totalInSet - 1) {
            state.currentQuestionIdx++;
            renderQuestion();
        } else {
            // Complete the quiz!
            state.quizCompleted = true;
            renderQuestion();
        }
    }

    // --------------------------------------------------
    // 9. QUIZ RESULTS CALCULATIONS
    // --------------------------------------------------
    function renderQuizResults() {
        const range = SET_RANGES[state.currentSetIdx];
        const totalInSet = (range.end - range.start) + 1;
        
        let correctCount = 0;
        let incorrectCount = 0;
        
        for (let i = 0; i < totalInSet; i++) {
            const absoluteIdx = range.start + i;
            const q = QUESTIONS[absoluteIdx];
            const ans = state.userAnswers[i];
            
            if (ans !== null && ans === q.answer_index) {
                correctCount++;
            } else {
                incorrectCount++;
            }
        }
        
        const pct = Math.round((correctCount / totalInSet) * 100);
        
        // Save quiz score
        state.progress.quizScores[state.currentSetIdx] = {
            correctCount: correctCount,
            totalCount: totalInSet,
            completed: true
        };
        saveProgress();
        
        // Display score
        el.resultScoreNum.textContent = correctCount;
        el.resultCorrectCount.textContent = correctCount;
        el.resultIncorrectCount.textContent = incorrectCount;
        el.resultPct.textContent = `${pct}%`;
        
        // Feedback message
        let msg = "";
        if (pct >= 90) msg = "A'lo natija! Siz imtihonga to'liq tayyorsiz. 🌟";
        else if (pct >= 75) msg = "Yaxshi natija! Mavzularni yaxshi o'zlashtirgansiz. 👍";
        else if (pct >= 50) msg = "Qoniqarli natija. Xatolar ustida ishlab, yana urinib ko'ring. 📖";
        else msg = "Natija past. Study rejimida savollarni chuqurroq o'rganishni maslahat beramiz. 🔄";
        
        el.resultScoreMessage.textContent = msg;
    }

    // --------------------------------------------------
    // 10. BOOKMARKS ACTION & RENDERING
    // --------------------------------------------------
    function toggleBookmark() {
        const absoluteIdx = getAbsoluteQuestionIndex();
        const q = QUESTIONS[absoluteIdx];
        const qKey = getQuestionKey(q.question);
        
        const bIdx = state.bookmarks.indexOf(qKey);
        if (bIdx > -1) {
            // Remove
            state.bookmarks.splice(bIdx, 1);
        } else {
            // Add
            state.bookmarks.push(qKey);
        }
        
        saveProgress();
        renderQuestion();
    }

    function renderBookmarks() {
        el.bookmarksList.innerHTML = "";
        
        if (state.bookmarks.length === 0) {
            el.bookmarksEmptyState.classList.remove("hidden");
            el.bookmarksList.classList.add("hidden");
            return;
        }
        
        el.bookmarksEmptyState.classList.add("hidden");
        el.bookmarksList.classList.remove("hidden");
        
        // Load bookmarked questions
        state.bookmarks.forEach(qKey => {
            const q = QUESTIONS.find(item => getQuestionKey(item.question) === qKey);
            if (!q) return;
            
            const card = document.createElement("div");
            card.className = "bookmark-item-card";
            
            // Find which set this question belongs to
            const absoluteIdx = QUESTIONS.indexOf(q);
            let setNum = 1;
            SET_RANGES.forEach((range, idx) => {
                if (absoluteIdx >= range.start && absoluteIdx <= range.end) {
                    setNum = idx + 1;
                }
            });
            
            const content = document.createElement("div");
            content.className = "bookmark-item-content";
            
            const meta = document.createElement("div");
            meta.className = "bookmark-item-meta";
            meta.innerHTML = `<span>Blok: ${setNum}</span><span>Savol: #${absoluteIdx + 1}</span>`;
            
            const qText = document.createElement("div");
            qText.className = "bookmark-item-question";
            qText.textContent = q.question;
            
            const correctAnsText = q.options[q.answer_index];
            const answer = document.createElement("div");
            answer.className = "bookmark-item-answer";
            answer.innerHTML = `<i class="fa-solid fa-circle-check"></i> To'g'ri javob: ${correctAnsText}`;
            
            content.appendChild(meta);
            content.appendChild(qText);
            content.appendChild(answer);
            
            const actions = document.createElement("div");
            actions.className = "bookmark-item-actions";
            
            // Go to question button
            const btnGo = document.createElement("button");
            btnGo.className = "btn-go-to-bookmark";
            btnGo.textContent = "O'tish";
            btnGo.addEventListener("click", () => {
                // Determine which set and relative index
                let targetSetIdx = 0;
                let targetRelIdx = 0;
                SET_RANGES.forEach((range, idx) => {
                    if (absoluteIdx >= range.start && absoluteIdx <= range.end) {
                        targetSetIdx = idx;
                        targetRelIdx = absoluteIdx - range.start;
                    }
                });
                
                switchTab("home");
                state.activeMode = "study"; // Always study mode on bookmark transition
                el.btnModeStudy.classList.add("active");
                el.btnModeQuiz.classList.remove("active");
                
                startSet(targetSetIdx);
                state.currentQuestionIdx = targetRelIdx;
                renderQuestion();
            });
            
            // Remove bookmark button
            const btnRemove = document.createElement("button");
            btnRemove.className = "btn-remove-bookmark";
            btnRemove.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            btnRemove.title = "O'chirish";
            btnRemove.addEventListener("click", () => {
                const bIdx = state.bookmarks.indexOf(qKey);
                if (bIdx > -1) {
                    state.bookmarks.splice(bIdx, 1);
                    saveProgress();
                    renderBookmarks();
                }
            });
            
            actions.appendChild(btnGo);
            actions.appendChild(btnRemove);
            
            card.appendChild(content);
            card.appendChild(actions);
            
            el.bookmarksList.appendChild(card);
        });
    }

    // --------------------------------------------------
    // 11. LIGHTBOX SOURCE VIEWER
    // --------------------------------------------------
    function openLightbox() {
        const absoluteIdx = getAbsoluteQuestionIndex();
        const q = QUESTIONS[absoluteIdx];
        
        if (!q.sources || q.sources.length === 0) return;
        
        const sourceName = q.sources[0]; // e.g. "IMAGE 2026-06-11 19:33:35.jpg" or "PDF1 Page 1"
        
        el.lightboxSourceText.textContent = `Manba: ${sourceName}`;
        
        if (sourceName.startsWith("IMAGE")) {
            // Load local image
            el.lightboxImg.src = sourceName;
            el.lightboxImageWrapper.classList.remove("hidden");
            el.lightboxPdfFallback.classList.add("hidden");
        } else {
            // Show PDF Description fallback
            el.lightboxImageWrapper.classList.add("hidden");
            el.lightboxPdfFallback.classList.remove("hidden");
            
            let pdfFile = sourceName.includes("PDF1") 
                ? "Jamoat Salomatligi 1-mavzu 75 ta.pdf" 
                : "Jamoat Salomatligi 2 mavzu 60.pdf";
            let pageNum = sourceName.replace("PDF1 Page ", "").replace("PDF2 Page ", "");
            
            el.lightboxPdfDesc.textContent = `Ushbu savol skan qilingan "${pdfFile}" hujjatining ${pageNum}-sahifasidan olingan bo'lib, biostatistik savollar va javoblar varaqasi hisoblanadi.`;
        }
        
        el.lightbox.showModal();
    }

    // Light-dismiss event logic (from retrieved guide)
    if (!('closedBy' in HTMLDialogElement.prototype)) {
        el.lightbox.addEventListener('click', (event) => {
            if (event.target !== el.lightbox) return;

            const rect = el.lightbox.getBoundingClientRect();
            const isDialogContent = (
                rect.top <= event.clientY &&
                event.clientY <= rect.top + rect.height &&
                rect.left <= event.clientX &&
                event.clientX <= rect.left + rect.width
            );

            if (isDialogContent) return;
            el.lightbox.close();
        });
    }

    // --------------------------------------------------
    // 12. EVENT LISTENERS SETUP
    // --------------------------------------------------
    
    // Tab controls
    el.btnHomeTab.addEventListener("click", () => switchTab("home"));
    el.btnBookmarksTab.addEventListener("click", () => switchTab("bookmarks"));
    el.btnStatsTab.addEventListener("click", () => switchTab("stats"));
    
    // Mode selectors
    el.btnModeStudy.addEventListener("click", () => {
        if (state.currentSetIdx !== null && state.activeMode === "quiz" && !state.quizCompleted) {
            if (!confirm("O'rganish rejimiga o'tsangiz, joriy test natijalaringiz saqlanmaydi. O'tishni tasdiqlaysizmi?")) {
                return;
            }
        }
        
        state.activeMode = "study";
        el.btnModeStudy.classList.add("active");
        el.btnModeQuiz.classList.remove("active");
        
        if (state.currentSetIdx !== null) {
            // Re-render current question under study mode
            state.quizCompleted = false;
            state.reviewMode = false;
            el.workspaceTitleInfo.querySelector("span").textContent = "O'rganish (Study) Rejimi";
            renderQuestion();
        }
    });

    el.btnModeQuiz.addEventListener("click", () => {
        if (state.currentSetIdx !== null && state.activeMode === "study") {
            if (!confirm("Test rejimiga o'tsangiz, ushbu blokdagi savollar test rejimida boshidan boshlanadi. Davom etasizmi?")) {
                return;
            }
        }
        
        state.activeMode = "quiz";
        el.btnModeQuiz.classList.add("active");
        el.btnModeStudy.classList.remove("active");
        
        if (state.currentSetIdx !== null) {
            // Start quiz mode fresh
            startSet(state.currentSetIdx);
        }
    });

    // Reset Progress
    el.btnResetAll.addEventListener("click", resetAllProgress);

    // Dashboard Cards click listeners
    document.querySelectorAll(".set-card").forEach(card => {
        const startBtn = card.querySelector(".btn-start-set");
        const setIdx = parseInt(card.dataset.setIndex);
        
        // Click on start button or card itself
        startBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            startSet(setIdx);
        });
        
        card.addEventListener("click", () => {
            startSet(setIdx);
        });
    });

    // Workspace actions
    el.btnBackDashboard.addEventListener("click", exitWorkspace);
    el.btnBookmarkQuestion.addEventListener("click", toggleBookmark);
    el.btnViewSource.addEventListener("click", openLightbox);
    el.btnCloseLightbox.addEventListener("click", () => el.lightbox.close());

    // Navigation buttons inside card
    el.btnPrevQuestion.addEventListener("click", handlePrev);
    el.btnNextQuestion.addEventListener("click", handleNext);
    el.btnSubmitAnswer.addEventListener("click", () => {
        if (state.activeMode === "quiz") {
            handleQuizSubmit();
        }
    });

    // Results card actions
    el.btnReviewAnswers.addEventListener("click", () => {
        state.reviewMode = true;
        state.quizCompleted = false;
        state.currentQuestionIdx = 0;
        renderQuestion();
    });
    
    el.btnRestartQuiz.addEventListener("click", () => {
        startSet(state.currentSetIdx);
    });
    
    el.btnFinishQuiz.addEventListener("click", () => {
        exitWorkspace();
    });

    // --------------------------------------------------
    // 13. BOOTSTRAP SYSTEM
    // --------------------------------------------------
    loadProgress();
});
