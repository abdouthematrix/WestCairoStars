// Leaderboard Module - Optimized for Subcollection Structure // Firestore structure: scores/{date}/{teamId}/{memberId}

const LeaderboardModule = { currentDateFilter: 'today', currentStartDate: null, currentEndDate: null,

memberDetailsCache: null,
teamsCache: null,

async initializeLeaderboard() {
    this.initializeDateFilters();
    await this.loadLeaderboards();
},

initializeDateFilters() {
    this.currentStartDate = this.currentEndDate = window.appUtils.getTodayString();

    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

    if (startDateInput) startDateInput.value = this.currentStartDate;
    if (endDateInput) endDateInput.value = this.currentEndDate;

    this.updateFilterStates();
},

updateFilterStates() {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    const activeButton = document.getElementById(`filter-${this.currentDateFilter}`);
    if (activeButton) activeButton.classList.add('active');

    const dateRangePicker = document.getElementById('date-range-picker');
    if (dateRangePicker) {
        if (this.currentDateFilter === 'range') {
            dateRangePicker.classList.remove('hidden');
            dateRangePicker.classList.add('visible');
        } else {
            dateRangePicker.classList.add('hidden');
            dateRangePicker.classList.remove('visible');
        }
    }

    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    if (startDateInput && this.currentStartDate) startDateInput.value = this.currentStartDate;
    if (endDateInput && this.currentEndDate) endDateInput.value = this.currentEndDate;

    const rangeDisplay = document.getElementById('current-range-display');
    if (rangeDisplay) rangeDisplay.textContent = this.getCurrentRangeText();

    this.updateLanguageTexts();
},

updateLanguageTexts() {
    const currentLanguage = window.appUtils.currentLanguage();
    document.querySelectorAll('[data-en][data-ar]').forEach(element => {
        if (element.getAttribute('data-en') && element.getAttribute('data-ar')) {
            element.textContent = currentLanguage === 'ar'
                ? element.getAttribute('data-ar')
                : element.getAttribute('data-en');
        }
    });
},

async setDateFilter(filterType) {
    this.currentDateFilter = filterType;
    const today = new Date();

    switch (filterType) {
        case 'today':
            this.currentStartDate = this.currentEndDate = window.appUtils.getTodayString();
            break;
        case 'yesterday':
            this.currentStartDate = this.currentEndDate = window.appUtils.getYesterdayString();
            break;
        case 'week': {
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            this.currentStartDate = startOfWeek.toISOString().split('T')[0];
            this.currentEndDate = endOfWeek.toISOString().split('T')[0];
            break;
        }
        case 'month': {
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            this.currentStartDate = startOfMonth.toISOString().split('T')[0];
            this.currentEndDate = endOfMonth.toISOString().split('T')[0];
            break;
        }
        case 'range':
            this.updateFilterStates();
            return;
    }

    this.updateFilterStates();
    await this.loadLeaderboards();
},

async applyDateRange() {
    const startDate = document.getElementById('start-date')?.value;
    const endDate = document.getElementById('end-date')?.value;

    if (!startDate || !endDate) {
        const lang = window.appUtils.currentLanguage();
        alert(lang === 'ar' ? 'يرجى تحديد تاريخ البداية والنهاية' : 'Please select both start and end dates');
        return;
    }

    if (startDate > endDate) {
        const lang = window.appUtils.currentLanguage();
        alert(lang === 'ar' ? 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' : 'Start date must be before end date');
        return;
    }

    this.currentStartDate = startDate;
    this.currentEndDate = endDate;

    this.updateFilterStates();
    await this.loadLeaderboards();
},

getCurrentRangeText() {
    const lang = window.appUtils.currentLanguage();

    if (!this.currentStartDate || !this.currentEndDate) {
        return lang === 'ar' ? 'لم يتم تحديد نطاق' : 'No range selected';
    }

    if (this.currentStartDate === this.currentEndDate) {
        return `${lang === 'ar' ? 'التاريخ:' : 'Date:'} ${this.formatDate(this.currentStartDate)}`;
    }

    return `${lang === 'ar' ? 'من:' : 'From:'} ${this.formatDate(this.currentStartDate)} ${lang === 'ar' ? 'إلى:' : 'to:'} ${this.formatDate(this.currentEndDate)}`;
},

formatDate(dateString) {
    const date = new Date(dateString);
    const lang = window.appUtils.currentLanguage();
    return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
},

getDateRange(start, end) {
    const dates = [];
    const current = new Date(start);
    const endDate = new Date(end);
    while (current <= endDate) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    return dates;
},

async getMemberDetails() {
    if (this.memberDetailsCache) return this.memberDetailsCache;

    const { db } = window.appUtils;
    const snapshot = await db.collection('teamMembers').get();

    this.memberDetailsCache = {};
    snapshot.docs.forEach(doc => {
        this.memberDetailsCache[doc.id] = {
            name: doc.data().name,
            teamCode: doc.data().teamCode,
            image: doc.data().teamMemberImage
        };
    });
    return this.memberDetailsCache;
},

async getTeamsData() {
    if (this.teamsCache) return this.teamsCache;

    const { db } = window.appUtils;
    const snapshot = await db.collection('teams').where('isAdmin', '==', false).get();

    this.teamsCache = {};
    snapshot.docs.forEach(doc => {
        this.teamsCache[doc.id] = doc.data();
    });
    return this.teamsCache;
},

async getAggregatedScores() {
    const { db } = window.appUtils;
    const dateRange = this.getDateRange(this.currentStartDate, this.currentEndDate);
    const memberDetails = await this.getMemberDetails();

    const membersByTeam = {};
    Object.entries(memberDetails).forEach(([id, d]) => {
        const teamCode = d.teamCode;
        if (!membersByTeam[teamCode]) membersByTeam[teamCode] = [];
        membersByTeam[teamCode].push(id);
    });

    const aggregatedData = {};
    const queryPromises = [];

    for (const date of dateRange) {
        for (const teamCode of Object.keys(membersByTeam)) {
            const promise = db.collection('scores').doc(date).collection(teamCode).get()
                .then(snapshot => ({ date, teamCode, snapshot }))
                .catch(() => null);
            queryPromises.push(promise);
        }
    }

    const results = await Promise.all(queryPromises);

    results.filter(Boolean).forEach(({ date, teamCode, snapshot }) => {
        snapshot.docs.forEach(doc => {
            const memberId = doc.id;
            const data = doc.data();

            // ✅ Skip if member is unavailable for this date
            if (data.unavailable === true) return;

            if (!aggregatedData[memberId]) {
                aggregatedData[memberId] = {
                    memberId,
                    teamCode,
                    totalScores: {},
                    totalReviewedScores: {},
                    activeDays: new Set(),
                    dates: new Set()
                };
            }

            aggregatedData[memberId].dates.add(date);

            const scores = data.scores || {};
            const reviewed = data.reviewedScores || {};

            const hasActivity = Object.values(scores).some(s => s > 0) || Object.values(reviewed).some(s => s > 0);
            if (hasActivity) aggregatedData[memberId].activeDays.add(date);

            window.appUtils.products.forEach(product => {
                aggregatedData[memberId].totalScores[product] = (aggregatedData[memberId].totalScores[product] || 0) + (scores[product] || 0);
                aggregatedData[memberId].totalReviewedScores[product] = (aggregatedData[memberId].totalReviewedScores[product] || 0) + (reviewed[product] || 0);
            });
        });
    });

    Object.values(aggregatedData).forEach(member => {
        member.activeDays = member.activeDays.size;
        member.totalDays = member.dates.size;
    });

    return aggregatedData;
},

async loadLeaderboards() {
    try {
        window.appUtils.showLoadingIndicator();
        if (!this.currentStartDate || !this.currentEndDate) {
            this.currentStartDate = this.currentEndDate = window.appUtils.getTodayString();
        }
        await Promise.all([
            this.loadTopAchievers(),
            this.loadTopTeams(),
            this.loadTopTeamLeaders(),
            this.loadTeamsWithZeroScores()
        ]);
    } catch (e) {
        console.error('Error loading leaderboards:', e);
        window.appUtils.showErrorMessage('Error loading leaderboards');
    } finally {
        window.appUtils.hideLoadingIndicator();
    }
}

};

window.modules = window.modules || {}; window.modules.leaderboard = LeaderboardModule; window.setDateFilter = LeaderboardModule.setDateFilter.bind(LeaderboardModule); window.applyDateRange = LeaderboardModule.applyDateRange.bind(LeaderboardModule);

export default LeaderboardModule;

